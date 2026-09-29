import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = Array.from({ length: 10 }, (_, i) =>
  `/Users/haimac/Downloads/MZ_Transformation_Playbook_D${String(i + 1).padStart(2, '0')}_Seed_V01.json`
);

const args = process.argv.slice(2);
const write = args.includes('--write');
const sourceFlag = args.indexOf('--source-dir');
const sourceFiles = sourceFlag >= 0
  ? Array.from({ length: 10 }, (_, i) => path.join(args[sourceFlag + 1], `MZ_Transformation_Playbook_D${String(i + 1).padStart(2, '0')}_Seed_V01.json`))
  : defaults;

export function splitIndicators(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function dependencyCodes(value) {
  return [...new Set((String(value || '').match(/\b(?:STR|ORG|HR|EDU|CARE|OPS|FIN|SRV|DAT|QLT)-\d{2}\b/g) || []))];
}

function normalizeCompetencies(items = []) {
  return items.map(item => Array.isArray(item)
    ? { competency: item[0] || '', class: item[1] || '', standard: item[2] || '' }
    : item);
}

function normalizeMaturity(items = []) {
  return items.map(item => Array.isArray(item)
    ? { level: item[0] || '', focus: item[1] || '', avoid: item[2] || '' }
    : item);
}

function normalizePlaybook(raw, domain, sourceVersion) {
  const code = raw.code || raw.id;
  const indicators = splitIndicators(raw.indicators || raw.linked_indicators);
  const dependencyText = raw.dependency || raw.dependencies || '';
  const version = String(raw.version || sourceVersion || '1.0').replace(/^V/i, '');
  const templates = raw.templates || raw.toolkits || [];
  return {
    id: `${code}@${version}`,
    code,
    domain_code: domain.code,
    domain_name: domain.name,
    title: raw.title,
    description: raw.one_liner || raw.purpose || '',
    purpose: raw.purpose || raw.one_liner || '',
    ideal_condition: raw.ideal || raw.ideal_condition || '',
    trigger_conditions: raw.triggers || [],
    linked_indicators: indicators,
    dependencies: dependencyCodes(dependencyText).filter(item => item !== code),
    dependency_note: dependencyText,
    maturity_paths: normalizeMaturity(raw.maturity_path || raw.maturity || []),
    diagnosis_questions: raw.confirm_questions || raw.diagnosis_questions || [],
    intervention_steps: raw.steps || raw.stages || [],
    workshops: raw.workshops || [],
    consultant_competencies: normalizeCompetencies(raw.competencies || []),
    specialist_boundaries: raw.boundaries || [],
    deliverables: raw.deliverables || (raw.steps || raw.stages || []).map(step => step.output).filter(Boolean),
    completion_criteria: raw.completion || raw.done || '',
    effectiveness_criteria: raw.effectiveness || raw.effective || '',
    web_rules: raw.web_rules || [],
    suggested_priority: /safety|safeguard|darurat|emergency|kebocoran|breach/i.test(`${code} ${raw.title} ${(raw.web_rules || []).join(' ')}`) ? 'P0' : 'P2',
    version,
    active: true,
    toolkits: templates.map((toolkit, index) => ({
      id: `${toolkit.code}@${version}`,
      playbook_id: `${code}@${version}`,
      playbook_code: code,
      code: toolkit.code,
      name: toolkit.name,
      purpose: toolkit.purpose || toolkit.function || '',
      category: toolkit.category || 'Template kerja',
      description: toolkit.description || toolkit.function || toolkit.purpose || '',
      usage: toolkit.usage || `Digunakan dalam pelaksanaan ${code}.`,
      expected_output: toolkit.output || toolkit.name,
      template_type: toolkit.template_type || 'reference',
      order: index + 1,
      version,
      active: true
    }))
  };
}

export function buildKnowledgeBase(files) {
  const errors = [];
  const warnings = [];
  const playbooks = [];
  const domains = [];
  for (const file of files) {
    if (!fs.existsSync(file)) { errors.push(`Seed tidak ditemukan: ${file}`); continue; }
    let raw;
    try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { errors.push(`JSON tidak valid ${file}: ${error.message}`); continue; }
    const code = raw.instrument_domain || raw.domain?.id;
    const name = raw.domain_name || raw.domain?.name;
    const version = raw.playbook_version || raw.version || '1.0';
    if (!/^D\d{2}$/.test(code || '') || !name) errors.push(`Metadata domain tidak valid: ${file}`);
    if (!Array.isArray(raw.playbooks) || raw.playbooks.length !== 5) errors.push(`${code || file} harus memiliki 5 playbook.`);
    domains.push({ code, name, version: String(version).replace(/^V/i, '') });
    for (const item of raw.playbooks || []) playbooks.push(normalizePlaybook(item, { code, name }, version));
  }

  const duplicate = (items, key) => [...new Set(items.map(key).filter((v, i, all) => all.indexOf(v) !== i))];
  const playbookDuplicates = duplicate(playbooks, item => item.code);
  const toolkits = playbooks.flatMap(item => item.toolkits);
  const toolkitDuplicates = duplicate(toolkits, item => item.code);
  if (playbookDuplicates.length) errors.push(`Kode playbook duplikat: ${playbookDuplicates.join(', ')}`);
  if (toolkitDuplicates.length) errors.push(`Kode toolkit duplikat: ${toolkitDuplicates.join(', ')}`);

  const codes = new Set(playbooks.map(item => item.code));
  const indicatorMap = [];
  for (const playbook of playbooks) {
    if (!playbook.code || !playbook.title || !playbook.version) errors.push(`Field wajib playbook tidak lengkap: ${playbook.code || '(tanpa kode)'}`);
    if (!playbook.linked_indicators.length) errors.push(`${playbook.code} tidak memiliki indikator.`);
    playbook.linked_indicators.forEach(indicator_id => {
      if (!new RegExp(`^${playbook.domain_code}\\.S\\d{2}\\.I\\d{2}$`).test(indicator_id)) errors.push(`Mapping indikator tidak valid: ${playbook.code} -> ${indicator_id}`);
      indicatorMap.push({ playbook_id: playbook.id, playbook_code: playbook.code, indicator_id, relationship: 'trigger', priority: 1 });
    });
    playbook.dependencies.forEach(dep => { if (!codes.has(dep)) errors.push(`Dependency tidak ditemukan: ${playbook.code} -> ${dep}`); });
  }
  const indicatorDuplicates = duplicate(indicatorMap, item => `${item.playbook_code}:${item.indicator_id}`);
  if (indicatorDuplicates.length) errors.push(`Link indikator duplikat: ${indicatorDuplicates.join(', ')}`);
  if (domains.length !== 10) errors.push(`Jumlah domain ${domains.length}; seharusnya 10.`);
  if (playbooks.length !== 50) errors.push(`Jumlah playbook ${playbooks.length}; seharusnya 50.`);
  if (toolkits.length < 250) errors.push(`Jumlah toolkit ${toolkits.length}; seed tampak tidak lengkap.`);
  else if (toolkits.length !== 300) warnings.push(`Seed berisi ${toolkits.length} toolkit (target deskriptif sekitar 300).`);

  return {
    report: { valid: errors.length === 0, errors, warnings, counts: { domains: domains.length, playbooks: playbooks.length, toolkits: toolkits.length, indicator_links: indicatorMap.length } },
    data: {
      schema_version: '1.0',
      knowledge_base_version: '1.0',
      generated_at: new Date().toISOString(),
      source: 'MZ Transformation Playbook D01-D10 Seed V01',
      domains,
      playbooks,
      toolkits,
      indicator_map: indicatorMap
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = buildKnowledgeBase(sourceFiles);
  console.log(JSON.stringify(result.report, null, 2));
  if (!result.report.valid) process.exitCode = 1;
  else if (write) {
    const output = path.join(root, 'data', 'knowledge-base.v1.json');
    const reportOutput = path.join(root, 'data', 'import-report.v1.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result.data, null, 2)}\n`);
    fs.writeFileSync(reportOutput, `${JSON.stringify({ ...result.report, sourceFiles: sourceFiles.map(file => path.basename(file)), generatedAt: result.data.generated_at }, null, 2)}\n`);
    console.log(`Knowledge base ditulis ke ${output}`);
    console.log(`Import report ditulis ke ${reportOutput}`);
  } else console.log('Dry-run selesai; tidak ada file atau database yang diubah.');
}
