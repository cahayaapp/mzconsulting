const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
const FOUNDATION_CODES = new Set(['STR-01','STR-02','ORG-01','ORG-02','DAT-01','DAT-02']);
const SAFETY_CODES = new Set(['CARE-04','OPS-05','DAT-03']);

export function questionIndicatorMap(domains) {
  const map = {};
  domains.forEach((domain, domainIndex) => domain.questions.forEach((question, questionIndex) => {
    const section = Math.floor(questionIndex / 2) + 1;
    const indicator = (questionIndex % 2) + 1;
    map[question.id] = `D${String(domainIndex + 1).padStart(2, '0')}.S${String(section).padStart(2, '0')}.I${String(indicator).padStart(2, '0')}`;
  }));
  return map;
}

export function buildFindings(questionStats, indicatorByQuestion, options = {}) {
  return questionStats
    .filter(item => (item.gate ?? item.average) < (options.threshold || 3.4))
    .map(item => {
      const signal = item.gate ?? item.average;
      const confidenceScore = Math.min(1, (item.count / 3) * (item.spread > 1.5 ? .72 : item.spread > .8 ? .84 : 1));
      return {
        id: `finding-${item.questionId}`,
        question_id: item.questionId,
        indicator_id: indicatorByQuestion[item.questionId],
        score: signal,
        perception_gap: item.spread,
        evidence_gap: item.count < 2,
        confidence: confidenceScore >= .75 ? 'High' : confidenceScore >= .45 ? 'Medium' : 'Low',
        confidence_score: Number(confidenceScore.toFixed(2)),
        priority: signal < 1.8 ? 'P1' : signal < 2.7 ? 'P2' : 'P3'
      };
    })
    .filter(item => item.indicator_id);
}

function dependencyClosure(code, byCode, seen = new Set()) {
  if (seen.has(code)) return [];
  seen.add(code);
  const playbook = byCode.get(code);
  if (!playbook) return [];
  return playbook.dependencies.flatMap(dep => [...dependencyClosure(dep, byCode, seen), dep]);
}

export function recommendPlaybooks({ knowledgeBase, findings = [], existingStatuses = {}, evidenceFlags = [] }) {
  const byCode = new Map(knowledgeBase.playbooks.filter(item => item.active !== false).map(item => [item.code, item]));
  const candidates = new Map();
  for (const finding of findings) {
    for (const map of knowledgeBase.indicator_map.filter(item => item.indicator_id === finding.indicator_id)) {
      const playbook = byCode.get(map.playbook_code);
      if (!playbook) continue;
      const record = candidates.get(playbook.code) || { playbook, findings: [], indicators: new Set(), score: 0 };
      record.findings.push(finding);
      record.indicators.add(finding.indicator_id);
      record.score += (6 - finding.score) * finding.confidence_score;
      candidates.set(playbook.code, record);
    }
  }

  const safetyTriggered = new Set(evidenceFlags.filter(flag => flag.severity === 'critical').flatMap(flag => flag.playbook_codes || []));
  for (const code of safetyTriggered) if (byCode.has(code) && !candidates.has(code)) candidates.set(code, { playbook: byCode.get(code), findings: [], indicators: new Set(), score: 10 });

  for (const [code, candidate] of [...candidates]) {
    for (const dep of dependencyClosure(code, byCode)) {
      if (existingStatuses[dep] === 'Effective') continue;
      if (!candidates.has(dep) && byCode.has(dep)) candidates.set(dep, { playbook: byCode.get(dep), findings: [], indicators: new Set(), score: candidate.score * .72, prerequisiteFor: new Set([code]) });
      else if (candidates.get(dep)?.prerequisiteFor) candidates.get(dep).prerequisiteFor.add(code);
    }
  }

  return [...candidates.values()].map(item => {
    const isSafety = safetyTriggered.has(item.playbook.code) || SAFETY_CODES.has(item.playbook.code) && item.findings.some(f => f.score < 1.8);
    const isFoundation = FOUNDATION_CODES.has(item.playbook.code) || item.prerequisiteFor?.size;
    const priority = isSafety ? 'P0' : isFoundation ? 'P1' : item.findings.some(f => f.priority === 'P1') ? 'P1' : item.playbook.suggested_priority || 'P2';
    const confidenceScore = item.findings.length ? item.findings.reduce((sum, f) => sum + f.confidence_score, 0) / item.findings.length : .55;
    return {
      id: `recommendation-${item.playbook.code}`,
      playbook_id: item.playbook.id,
      playbook_code: item.playbook.code,
      playbook_version: item.playbook.version,
      title: item.playbook.title,
      priority,
      status: 'SYSTEM_SUGGESTED',
      confidence: confidenceScore >= .75 ? 'High' : confidenceScore >= .45 ? 'Medium' : 'Low',
      finding_ids: item.findings.map(f => f.id),
      trigger_indicators: [...item.indicators],
      dependencies: item.playbook.dependencies,
      missing_dependencies: item.playbook.dependencies.filter(dep => existingStatuses[dep] !== 'Effective'),
      prerequisite_for: [...(item.prerequisiteFor || [])],
      reason: item.findings.length
        ? `Pola pada ${item.indicators.size} indikator menunjukkan area ini perlu ditelaah bersama; rekomendasi tetap memerlukan validasi konsultan.`
        : `Prasyarat untuk ${[...(item.prerequisiteFor || [])].join(', ')} agar intervensi berikutnya tidak dibangun di atas fondasi yang belum siap.`,
      evidence_warning: item.findings.some(f => f.evidence_gap || f.confidence === 'Low'),
      score: Number(item.score.toFixed(2)),
      safety_override: isSafety
    };
  }).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Number(b.safety_override) - Number(a.safety_override) || b.score - a.score);
}

export function buildRoadmap(items, overrides = {}) {
  const byCode = new Map(items.map(item => [item.playbook_code, item]));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(item) {
    if (visited.has(item.playbook_code)) return;
    if (visiting.has(item.playbook_code)) return;
    visiting.add(item.playbook_code);
    const dependencies = overrides[item.playbook_code]?.dependencies || item.dependencies || [];
    if (!item.safety_override && !overrides[item.playbook_code]?.ignore_dependencies) dependencies.forEach(dep => { if (byCode.has(dep)) visit(byCode.get(dep)); });
    visiting.delete(item.playbook_code);
    visited.add(item.playbook_code);
    ordered.push(item);
  }
  [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]).forEach(visit);
  return ordered.map((item, index) => ({
    ...item,
    phase: item.safety_override ? 'RESPONSE NOW' : index < Math.ceil(ordered.length * .35) ? 'FOUNDATION' : index < Math.ceil(ordered.length * .7) ? 'IMPLEMENT' : index < Math.ceil(ordered.length * .9) ? 'CONTROL' : 'IMPROVE',
    target_window: item.safety_override ? 'Segera' : index < Math.ceil(ordered.length * .35) ? '0–30 hari' : index < Math.ceil(ordered.length * .7) ? '31–60 hari' : '61–90+ hari',
    transformation_mode: ordered.length > 8 ? 'Multi-phase Transformation' : 'Focused Transformation'
  }));
}

export function snapshotValidatedRecommendation(recommendation, playbook, actor, now = Date.now()) {
  return {
    ...recommendation,
    status: 'VALIDATED',
    validation_status: 'VALIDATED',
    selected_by: actor,
    selected_at: now,
    playbook_snapshot: JSON.parse(JSON.stringify(playbook)),
    audit: [{ action: 'VALIDATED', actor, at: now, reason: 'Validated by consultant' }]
  };
}

export function clientProjection(projectTransformation) {
  return { domainPlans: clientDomainPlanProjection(projectTransformation || {}) };
}

export function nextJourneyStep(project, transformation = {}) {
  const responses = Object.values(project?.perspectives || {});
  if (!responses.length) return { step: 2, label: 'Tambahkan responden', tab: 'perspectives' };
  if (!responses.some(item => item.submittedAt)) return { step: 3, label: 'Pantau pengumpulan', tab: 'perspectives' };
  if (!transformation.findings) return { step: 5, label: 'Buka diagnosis', tab: 'overview' };
  const recommendations = Object.values(transformation.recommendations || {});
  if (!recommendations.some(item => item.validation_status === 'VALIDATED')) return { step: 6, label: 'Validasi rekomendasi', tab: 'transformation' };
  if (!Object.keys(transformation.roadmap || {}).length) return { step: 7, label: 'Susun Transformation Plan', tab: 'transformation' };
  if (Object.values(transformation.roadmap || {}).some(item => ['Implemented','Verification Pending'].includes(item.status))) return { step: 9, label: 'Verifikasi efektivitas', tab: 'transformation' };
  return { step: 8, label: 'Lanjutkan implementasi', tab: 'transformation' };
}
import { clientDomainPlanProjection } from './domain-plan-engine.js';
