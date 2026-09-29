export const DOMAIN_PLAN_STATUSES = [
  'Belum Dimulai',
  'Berjalan',
  'Implementasi Selesai',
  'Menunggu Verifikasi',
  'Terverifikasi',
  'Perlu Penyesuaian'
];

export const MATURITY_LABELS = {
  1: 'Belum Tertata',
  2: 'Mulai Tertata',
  3: 'Sudah Dijalankan',
  4: 'Sudah Dikendalikan',
  5: 'Terus Disempurnakan'
};

const cleanNumbers = values => values.filter(value => Number.isFinite(Number(value))).map(Number);
export const average = values => { const clean = cleanNumbers(values); return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null; };

export function cumulativeGate(values, threshold = .7) {
  const clean = cleanNumbers(values);
  if (!clean.length) return null;
  for (let gate = 5; gate >= 1; gate--) if (clean.filter(value => value >= gate).length / clean.length >= threshold) return gate;
  return 1;
}

export function buildDomainSummary({ domain, domainIndex, perspectiveScores = {}, questionValues = {} }) {
  const values = Object.values(perspectiveScores).map(item => item.domains?.[domain.id]).filter(value => value != null);
  const allSignals = domain.questions.flatMap(question => questionValues[question.id] || []);
  const currentMaturity = cumulativeGate(allSignals) ?? cumulativeGate(values);
  return {
    domainId: domain.id,
    domainCode: `D${String(domainIndex + 1).padStart(2, '0')}`,
    domainName: domain.title,
    average: average(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    respondentCount: values.length,
    currentMaturity,
    targetMaturity: currentMaturity == null || currentMaturity >= 5 ? null : currentMaturity + 1,
    maturityLabel: currentMaturity ? MATURITY_LABELS[currentMaturity] : 'Belum cukup data'
  };
}

export function buildNextLevelRequirements({ domain, summary, questionValues = {}, getDefinition }) {
  if (!summary?.targetMaturity || summary.currentMaturity >= 5) return [];
  return domain.questions.flatMap(question => {
    const values = cleanNumbers(questionValues[question.id] || []);
    if (!values.length) return [];
    const definition = getDefinition(question.id);
    const targetOption = definition?.answer_options?.find(option => !option.excluded_from_score && (option.gate_signal ?? option.diagnostic_signal ?? option.internal_value) === summary.targetMaturity);
    const supportCount = values.filter(value => value >= summary.targetMaturity).length;
    const completed = supportCount / values.length >= .7;
    return [{
      id: `${question.id}-L${summary.targetMaturity}`,
      questionId: question.id,
      indicatorId: definition?.indicator_id || null,
      title: question.action,
      condition: targetOption ? `${targetOption.label}: ${targetOption.description}` : question.text,
      supportCount,
      responseCount: values.length,
      completed,
      source: 'assessment_gate'
    }];
  });
}

export function progressOf(requirements = []) {
  const completed = requirements.filter(item => item.completed).length;
  return { completed, total: requirements.length, percent: requirements.length ? Math.round(completed / requirements.length * 100) : 0 };
}

export function buildDomainPlanSnapshot({ projectId, summary, requirements, selectedPIC = '', targetDate = '', suggestedPlaybooks = [], suggestedTools = [], sourceAnalysisVersion = 'domain-gap-v1', actor, createdAt = Date.now(), existing = null }) {
  const completedRequirements = requirements.filter(item => item.completed);
  const missingRequirements = requirements.filter(item => !item.completed);
  return {
    id: summary.domainCode,
    projectId,
    domainCode: summary.domainCode,
    domainName: summary.domainName,
    currentAverage: summary.average,
    currentMin: summary.min,
    currentMax: summary.max,
    currentMaturity: summary.currentMaturity,
    targetMaturity: summary.targetMaturity,
    completedRequirements,
    missingRequirements,
    implementationRequirements: requirements.map(item => ({ ...item, completed: existing?.implementationRequirements?.find(saved => saved.id === item.id)?.completed ?? item.completed })),
    selectedPIC,
    targetDate,
    suggestedPlaybooks,
    suggestedTools,
    sourceAnalysisVersion,
    status: existing?.status || 'Belum Dimulai',
    deliverables: existing?.deliverables || [],
    completionEvidence: existing?.completionEvidence || '',
    effectivenessCheck: existing?.effectivenessCheck || '',
    createdAt: existing?.createdAt || createdAt,
    createdBy: existing?.createdBy || actor,
    updatedAt: createdAt,
    updatedBy: actor,
    clientVisible: existing?.clientVisible !== false
  };
}

export function addOrMergeDomainPlan(existingPlans = {}, snapshot) {
  const existing = existingPlans[snapshot.domainCode];
  return { duplicate: Boolean(existing), record: existing ? { ...existing, ...snapshot, createdAt: existing.createdAt, createdBy: existing.createdBy } : snapshot };
}

export function updateRequirement(plan, requirementId, completed) {
  const implementationRequirements = (plan.implementationRequirements || []).map(item => item.id === requirementId ? { ...item, completed } : item);
  const progress = progressOf(implementationRequirements);
  const status = progress.total > 0 && progress.completed === progress.total ? 'Menunggu Verifikasi' : progress.completed > 0 ? 'Berjalan' : 'Belum Dimulai';
  return { ...plan, implementationRequirements, status, verifiedMaturity: plan.verifiedMaturity || null };
}

export function verifyDomainPlan(plan, { actor, evidence, effectivenessVerified, at = Date.now() }) {
  const progress = progressOf(plan.implementationRequirements || []);
  if (!progress.total || progress.completed !== progress.total) throw new Error('Semua requirement implementasi harus selesai sebelum verifikasi.');
  if (!effectivenessVerified || !String(evidence || '').trim()) throw new Error('Bukti dan verifikasi efektivitas wajib diisi.');
  return { ...plan, status: 'Terverifikasi', verifiedMaturity: plan.targetMaturity, verificationEvidence: String(evidence).trim(), effectivenessVerified: true, effectivenessVerifiedAt: at, effectivenessVerifiedBy: actor };
}

export function clientDomainPlanProjection(transformation = {}) {
  return Object.values(transformation.domainPlans || {}).filter(plan => plan.clientVisible !== false).map(plan => ({
    domainCode: plan.domainCode,
    domainName: plan.domainName,
    currentMaturity: plan.currentMaturity,
    targetMaturity: plan.targetMaturity,
    actions: (plan.implementationRequirements || []).map(({ id, title, completed }) => ({ id, title, completed })),
    pic: plan.selectedPIC || '',
    deadline: plan.targetDate || '',
    progress: progressOf(plan.implementationRequirements || []),
    status: plan.status
  }));
}
