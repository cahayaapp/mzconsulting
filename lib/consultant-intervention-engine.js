export const MATURITY_JOURNEY = Object.freeze([
  { level: 1, label: 'Belum Tertata', description: 'Cara kerja belum jelas dan masih bergantung pada kebiasaan atau individu.' },
  { level: 2, label: 'Mulai Tertata', description: 'Aturan, peran, atau standar dasar sudah mulai tersedia tetapi belum konsisten digunakan.' },
  { level: 3, label: 'Sudah Dijalankan', description: 'Sistem telah dipahami dan digunakan dalam pekerjaan nyata.' },
  { level: 4, label: 'Sudah Dikendalikan', description: 'Pelaksanaan diperiksa, penyimpangan ditindaklanjuti, dan hasilnya dipantau.' },
  { level: 5, label: 'Terus Disempurnakan', description: 'Sistem diperbaiki berdasarkan evaluasi dan manfaat perbaikannya diperiksa lintas periode.' },
]);

export const INTERVENTION_TYPES = Object.freeze([
  'INTERVIEW', 'CLARIFICATION', 'DOCUMENT_REVIEW', 'OBSERVATION', 'WORKSHOP',
  'ANALYSIS', 'TOOL_TEMPLATE', 'IMPLEMENTATION', 'VERIFICATION',
  'EFFECTIVENESS_REVIEW', 'SPECIALIST_REFERRAL',
]);

export const INTERVENTION_STATUSES = Object.freeze([
  'Disarankan Sistem', 'Perlu Validasi', 'Disetujui Konsultan', 'Dijadwalkan',
  'Sedang Dilakukan', 'Menunggu Klien', 'Selesai', 'Perlu Tindak Lanjut', 'Dibatalkan',
]);

const clone = value => JSON.parse(JSON.stringify(value));
const list = value => Array.isArray(value) ? value.filter(Boolean) : value ? Object.values(value).filter(Boolean) : [];
const text = value => typeof value === 'string' ? value : value?.name || value?.title || value?.step || value?.stage || '';

export function maturityStage(level) {
  const normalized = Math.max(1, Math.min(5, Math.round(Number(level) || 1)));
  return MATURITY_JOURNEY[normalized - 1];
}

export function maturityMarkerPosition(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, ((numeric - 1) / 4) * 100));
}

export function domainMaturityDescription(playbooks, level) {
  const target = `L${Math.max(1, Math.min(5, Math.round(Number(level) || 1)))}`;
  for (const playbook of list(playbooks)) {
    const path = list(playbook.maturity_paths).find(item => String(item.level).toUpperCase() === target);
    if (path?.focus) return { description: path.focus, source: `${playbook.code}@${playbook.version}` };
  }
  return { description: maturityStage(level).description, source: 'general-maturity-definition' };
}

export function resolveMaturityPosition({ average, validatedMaturity }) {
  const hasValidated = Number.isFinite(Number(validatedMaturity));
  const verified = hasValidated ? Math.max(1, Math.min(5, Math.round(Number(validatedMaturity)))) : null;
  return {
    averagePerspective: Number.isFinite(Number(average)) ? Number(average) : null,
    verifiedMaturity: verified,
    displayLevel: verified || (Number.isFinite(Number(average)) ? Math.max(1, Math.min(5, Math.floor(Number(average)))) : null),
    markerValue: verified || (Number.isFinite(Number(average)) ? Number(average) : null),
    label: verified ? 'Posisi terverifikasi konsultan' : 'Posisi berdasarkan perspektif masuk',
  };
}

export function currentConditionNarrative({ summary, domainName, strongestIndicator, weakestIndicator, perceptionGap = 0, evidenceConfidence = 'Belum dinilai', validatedMaturity }) {
  if (!summary || summary.average == null) return `Belum ada cukup perspektif untuk menggambarkan kondisi ${domainName}.`;
  const position = resolveMaturityPosition({ average: summary.average, validatedMaturity });
  const stage = maturityStage(position.displayLevel);
  const parts = [`Rata-rata ${summary.respondentCount} perspektif menempatkan ${domainName} pada rentang ${Number(summary.min).toFixed(1)}–${Number(summary.max).toFixed(1)}.`];
  if (strongestIndicator) parts.push(`Sinyal yang relatif paling kuat terlihat pada ${strongestIndicator}.`);
  if (weakestIndicator) parts.push(`Area yang masih perlu ditelaah adalah ${weakestIndicator}.`);
  if (perceptionGap >= .7) parts.push('Terdapat perbedaan perspektif yang perlu diklarifikasi sebelum menarik kesimpulan lebih jauh.');
  if (evidenceConfidence === 'Low') parts.push('Bukti pendukung masih terbatas, sehingga kondisi ini belum boleh diperlakukan sebagai kesimpulan final.');
  parts.push(`${position.label} berada pada tahap “${stage.label}”.`);
  return parts.join(' ');
}

function sourceRef(playbook, field, index) {
  return { playbookCode: playbook.code, playbookVersion: playbook.version, field, index };
}

function baseIntervention(playbook, recommendation, type, title, purpose, source, generatedAt) {
  return {
    id: `${playbook.code}-${type}-${source.index ?? 0}`,
    domainCode: playbook.domain_code,
    findingIds: clone(recommendation?.finding_ids || []),
    playbookCode: playbook.code,
    playbookVersion: playbook.version,
    type,
    title,
    purpose,
    consultantPIC: '',
    participants: '',
    dueDate: '',
    status: 'Disarankan Sistem',
    output: '',
    evidence: '',
    nextIntervention: '',
    internalNotes: '',
    source,
    generated_at: generatedAt,
    consultantValidation: { status: 'PENDING', validatedBy: null, validatedAt: null },
  };
}

export function buildKnowledgeInterventions({ playbook, recommendation = {}, perceptionGap = 0, evidenceGap = false, safetyFlag = false, generatedAt = Date.now() }) {
  if (!playbook?.code || playbook.active === false) return [];
  const result = [];
  const questions = list(playbook.diagnosis_questions).map(text).filter(Boolean);
  if (questions.length) {
    const interview = baseIntervention(playbook, recommendation, 'INTERVIEW', `Wawancara terstruktur — ${playbook.title}`, playbook.purpose || `Memperdalam diagnosis untuk ${playbook.title}.`, sourceRef(playbook, 'diagnosis_questions', 0), generatedAt);
    interview.form = { interviewee: '', role: '', date: '', suggestedDuration: '45–60 menit', questions: questions.map((question, index) => ({ id: `q${index + 1}`, question, answerNotes: '' })), consultantInsight: '', evidenceReference: '', conclusion: '', nextAction: '' };
    result.push(interview);
  }
  if (perceptionGap >= .7) {
    const clarification = baseIntervention(playbook, recommendation, 'CLARIFICATION', 'Klarifikasi Perception Gap', 'Memahami perbedaan pengalaman antarperspektif tanpa membuka identitas responden rahasia.', sourceRef(playbook, 'diagnosis_questions', 0), generatedAt);
    clarification.form = { parties: '', construct: playbook.linked_indicators?.[0] || playbook.domain_code, sourceSummary: 'Ringkasan agregat tanpa identitas dan tanpa jawaban mentah.', questions: questions.slice(0, 3), result: '', resolved: false, evidence: '', diagnosisChange: '' };
    result.push(clarification);
  }
  if (evidenceGap) {
    const review = baseIntervention(playbook, recommendation, 'DOCUMENT_REVIEW', `Telaah dokumen — ${playbook.title}`, 'Memeriksa apakah bukti yang tersedia mendukung praktik yang dinyatakan.', sourceRef(playbook, 'completion_criteria', 0), generatedAt);
    review.form = { documentName: '', version: '', reviewDate: '', criteria: playbook.completion_criteria || '', findings: '', gaps: '', evidenceCode: '', conclusion: '', followUp: '' };
    result.push(review);
  }
  list(playbook.workshops).slice(0, 2).forEach((workshop, index) => {
    const name = workshop.name || workshop.session || `Workshop ${index + 1}`;
    const intervention = baseIntervention(playbook, recommendation, 'WORKSHOP', name, workshop.goal || playbook.purpose || '', sourceRef(playbook, 'workshops', index), generatedAt);
    intervention.form = { participants: workshop.participants || '', agenda: workshop.agenda || workshop.goal || '', expectedOutput: workshop.result || workshop.output || '', toolkitCodes: list(playbook.toolkits).slice(0, 3).map(item => item.code), preparationChecklist: ['Konfirmasi peserta', 'Siapkan data/bukti relevan', 'Sepakati output sesi'], notes: '' };
    result.push(intervention);
  });
  list(playbook.toolkits).slice(0, 3).forEach((toolkit, index) => {
    const intervention = baseIntervention(playbook, recommendation, 'TOOL_TEMPLATE', toolkit.name, toolkit.purpose || toolkit.description || '', sourceRef(playbook, 'toolkits', index), generatedAt);
    intervention.toolkit = { code: toolkit.code, name: toolkit.name, purpose: toolkit.purpose || '', usage: toolkit.usage || '', expectedOutput: toolkit.expected_output || '', status: 'Belum digunakan', outputReference: '' };
    result.push(intervention);
  });
  const steps = list(playbook.intervention_steps);
  if (steps.length) {
    const step = steps[0];
    const intervention = baseIntervention(playbook, recommendation, 'IMPLEMENTATION', text(step) || `Implementasi ${playbook.title}`, step.activity || playbook.purpose || '', sourceRef(playbook, 'intervention_steps', 0), generatedAt);
    intervention.expectedOutput = step.output || '';
    result.push(intervention);
  }
  const verification = baseIntervention(playbook, recommendation, 'VERIFICATION', `Verifikasi penggunaan — ${playbook.title}`, playbook.completion_criteria || 'Memastikan deliverable digunakan dalam pekerjaan nyata.', sourceRef(playbook, 'completion_criteria', 0), generatedAt);
  verification.form = { criteria: playbook.completion_criteria || '', evidence: '', conclusion: '', verified: false };
  result.push(verification);
  const effectiveness = baseIntervention(playbook, recommendation, 'EFFECTIVENESS_REVIEW', `Review efektivitas — ${playbook.title}`, playbook.effectiveness_criteria || 'Memeriksa manfaat setelah periode penerapan.', sourceRef(playbook, 'effectiveness_criteria', 0), generatedAt);
  effectiveness.form = { reviewDate: '', criteria: playbook.effectiveness_criteria || '', evidence: '', result: '', effective: false };
  result.push(effectiveness);
  if (safetyFlag && list(playbook.specialist_boundaries).length) {
    const referral = baseIntervention(playbook, recommendation, 'SPECIALIST_REFERRAL', `Tinjau kebutuhan rujukan specialist — ${playbook.title}`, list(playbook.specialist_boundaries).join(' '), sourceRef(playbook, 'specialist_boundaries', 0), generatedAt);
    referral.priority = 'P0';
    referral.form = { boundary: list(playbook.specialist_boundaries), referralTarget: '', reason: '', safeHandover: '', status: '' };
    result.unshift(referral);
  }
  return result;
}

export function mergeInterventionQueue(stored = {}, generated = []) {
  const result = clone(stored || {});
  for (const item of generated) if (!result[item.id]) result[item.id] = clone(item);
  return result;
}

export function validateIntervention(intervention, actor, at = Date.now()) {
  return { ...clone(intervention), status: 'Disetujui Konsultan', consultantValidation: { status: 'VALIDATED', validatedBy: actor, validatedAt: at } };
}

export function clientSafeInterventionProjection() {
  return {};
}

export function additiveInterventionMigration(database, at = Date.now()) {
  const migrated = clone(database || {});
  migrated.projectTransformations ||= {};
  for (const record of Object.values(migrated.projectTransformations)) {
    record.schemaVersion ||= '1.1';
    record.interventionVersion ||= '1.0';
    record.migratedInterventionsAt ||= at;
  }
  return migrated;
}
