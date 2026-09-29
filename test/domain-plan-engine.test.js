import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS } from '../questions.js';
import { getQuestionDefinition } from '../lib/instrument.js';
import {
  addOrMergeDomainPlan,
  buildDomainPlanSnapshot,
  buildDomainSummary,
  buildNextLevelRequirements,
  clientDomainPlanProjection,
  progressOf,
  updateRequirement,
  verifyDomainPlan
} from '../lib/domain-plan-engine.js';
import { buildDomainPlanMigration } from '../scripts/migrate-domain-plans-v11.mjs';

const domain = DOMAINS[1];
const perspectiveScores = {
  leader: { domains: { governance: 2 } },
  unit: { domains: { governance: 4 } },
  missing: { domains: { governance: null } }
};
const questionValues = {
  governance_01: [3,3],
  governance_02: [2,2],
  governance_03: [2,2],
  governance_04: [3,2]
};
const summary = buildDomainSummary({ domain, domainIndex: 1, perspectiveScores, questionValues });
const requirements = buildNextLevelRequirements({ domain, summary, questionValues, getDefinition: getQuestionDefinition });

test('domain average min max use relevant submitted perspectives', () => {
  assert.equal(summary.average, 3);
  assert.equal(summary.min, 2);
  assert.equal(summary.max, 4);
  assert.equal(summary.respondentCount, 2);
});

test('missing answers are excluded instead of counted as zero', () => {
  assert.equal(summary.min, 2);
  assert.equal(requirements.length, 4);
  assert.equal(requirements.some(item => item.questionId === 'governance_05'), false);
});

test('next-level requirements use the cumulative gate target', () => {
  assert.equal(summary.currentMaturity, 2);
  assert.equal(summary.targetMaturity, 3);
  assert.match(requirements[0].condition, /struktur|Structure|proses/i);
});

test('completed requirements are separated from unresolved gaps', () => {
  const completed = requirements.filter(item => item.completed);
  const unresolved = requirements.filter(item => !item.completed);
  assert.ok(completed.length > 0);
  assert.ok(unresolved.length > 0);
  assert.equal(unresolved.some(item => completed.some(done => done.id === item.id)), false);
});

test('Add to Transformation Plan stores the required snapshot', () => {
  const plan = buildDomainPlanSnapshot({ projectId: 'p1', summary, requirements, selectedPIC: 'Kepala Unit', targetDate: '2026-11-01', suggestedPlaybooks: [{ code: 'ORG-02' }], suggestedTools: [{ code: 'T1', name: 'Matrix' }], sourceAnalysisVersion: 'V0.3:domain-gap-v1', actor: 'c1', createdAt: 100 });
  for (const key of ['projectId','domainCode','domainName','currentAverage','currentMin','currentMax','currentMaturity','targetMaturity','completedRequirements','missingRequirements','selectedPIC','targetDate','suggestedPlaybooks','suggestedTools','sourceAnalysisVersion','createdAt','createdBy']) assert.ok(key in plan, key);
});

test('duplicate domain returns a merge warning instead of a second record', () => {
  const first = buildDomainPlanSnapshot({ projectId: 'p1', summary, requirements, actor: 'c1', createdAt: 100 });
  const result = addOrMergeDomainPlan({ D02: first }, { ...first, selectedPIC: 'Direktur', updatedAt: 200 });
  assert.equal(result.duplicate, true);
  assert.equal(result.record.createdAt, 100);
  assert.equal(result.record.selectedPIC, 'Direktur');
});

test('completing checklist moves to verification pending without raising maturity', () => {
  let plan = buildDomainPlanSnapshot({ projectId: 'p1', summary, requirements, actor: 'c1' });
  for (const item of plan.implementationRequirements) plan = updateRequirement(plan, item.id, true);
  assert.equal(plan.status, 'Menunggu Verifikasi');
  assert.equal(plan.verifiedMaturity, null);
  assert.equal(plan.currentMaturity, 2);
});

test('verified maturity requires consultant evidence and effectiveness verification', () => {
  let plan = buildDomainPlanSnapshot({ projectId: 'p1', summary, requirements, actor: 'c1' });
  for (const item of plan.implementationRequirements) plan = updateRequirement(plan, item.id, true);
  assert.throws(() => verifyDomainPlan(plan, { actor: 'c1', evidence: '', effectivenessVerified: true }), /Bukti/);
  assert.throws(() => verifyDomainPlan(plan, { actor: 'c1', evidence: 'Ada bukti', effectivenessVerified: false }), /Bukti/);
  const verified = verifyDomainPlan(plan, { actor: 'c1', evidence: 'Review 60 hari menunjukkan kontrol berjalan', effectivenessVerified: true, at: 200 });
  assert.equal(verified.status, 'Terverifikasi');
  assert.equal(verified.verifiedMaturity, 3);
});

test('client projection only includes allowed domain plan fields', () => {
  const safe = clientDomainPlanProjection({ domainPlans: { D02: { domainCode: 'D02', domainName: 'Tata Kelola', currentMaturity: 2, targetMaturity: 3, selectedPIC: 'Kepala Unit', targetDate: '2026-11-01', implementationRequirements: requirements, status: 'Berjalan', clientVisible: true, internalFinding: 'secret' }, D03: { domainCode: 'D03', clientVisible: false } } });
  assert.deepEqual(safe.map(item => item.domainCode), ['D02']);
  assert.equal('internalFinding' in safe[0], false);
  assert.equal('confidence' in safe[0], false);
});

test('internal findings and diagnostic notes never leak through client projection', () => {
  const safe = clientDomainPlanProjection({ findings: { secret: true }, diagnosticNotes: 'hidden', domainPlans: { D02: { domainCode: 'D02', domainName: 'Tata Kelola', implementationRequirements: [], status: 'Belum Dimulai' } } });
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  assert.equal(JSON.stringify(safe).includes('hidden'), false);
  assert.deepEqual(progressOf([]), { completed: 0, total: 0, percent: 0 });
});

test('domain plan schema migration is additive and leaves legacy records untouched', () => {
  const database = { projects: { p1: { name: 'Lama' } }, projectTransformations: { p1: { findings: { f1: { score: 2 } }, roadmap: { old: true } } }, responses: { r1: { answers: { q1: { score: 2 } } } } };
  const before = JSON.parse(JSON.stringify(database));
  const { patch, report } = buildDomainPlanMigration(database, 100);
  assert.equal(report.destructiveOperations, 0);
  assert.equal(patch['projectTransformations/p1/schemaVersion'], '1.1');
  assert.equal(patch['projectTransformations/p1/domainPlanVersion'], '1.0');
  assert.deepEqual(database, before);
  assert.equal(Object.values(patch).some(value => value === null), false);
});
