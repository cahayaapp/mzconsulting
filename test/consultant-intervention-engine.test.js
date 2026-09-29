import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MATURITY_JOURNEY,
  additiveInterventionMigration,
  buildKnowledgeInterventions,
  clientSafeInterventionProjection,
  domainMaturityDescription,
  maturityMarkerPosition,
  resolveMaturityPosition,
} from '../lib/consultant-intervention-engine.js';

const kb = JSON.parse(fs.readFileSync(new URL('../data/knowledge-base.v1.json', import.meta.url)));
const playbook = kb.playbooks.find(item => item.code === 'ORG-02');
const recommendation = { finding_ids: ['finding-D02-01'], evidence_warning: true };

test('maturity journey always contains five accessible stages', () => {
  assert.equal(MATURITY_JOURNEY.length, 5);
  assert.deepEqual(MATURITY_JOURNEY.map(item => item.level), [1, 2, 3, 4, 5]);
});

test('current position marker supports values between stages', () => {
  assert.equal(maturityMarkerPosition(2.4), 35);
});

test('average 2.4 remains an average and never becomes Level 2.4', () => {
  const position = resolveMaturityPosition({ average: 2.4 });
  assert.equal(position.averagePerspective, 2.4);
  assert.equal(position.displayLevel, 2);
  assert.equal(position.verifiedMaturity, null);
});

test('validated maturity is distinct from average perspective', () => {
  const position = resolveMaturityPosition({ average: 2.4, validatedMaturity: 3 });
  assert.equal(position.averagePerspective, 2.4);
  assert.equal(position.verifiedMaturity, 3);
  assert.equal(position.label, 'Posisi terverifikasi konsultan');
});

test('domain-specific maturity description is sourced from knowledge base', () => {
  const result = domainMaturityDescription([playbook], 2);
  assert.match(result.description, /Sosialisasikan/);
  assert.equal(result.source, 'ORG-02@0.1');
});

test('interventions are traceable to knowledge base playbook and version', () => {
  const queue = buildKnowledgeInterventions({ playbook, recommendation, evidenceGap: true });
  assert.ok(queue.length > 0);
  assert.ok(queue.every(item => item.playbookCode === 'ORG-02' && item.playbookVersion === '0.1' && item.source.field));
});

test('interview intervention contains an editable structured form', () => {
  const interview = buildKnowledgeInterventions({ playbook, recommendation }).find(item => item.type === 'INTERVIEW');
  assert.ok(interview.form.questions.length >= 1);
  assert.ok('consultantInsight' in interview.form && 'conclusion' in interview.form);
});

test('clarification stores aggregate source context without raw confidential responses', () => {
  const clarification = buildKnowledgeInterventions({ playbook, recommendation, perceptionGap: 1.2 }).find(item => item.type === 'CLARIFICATION');
  assert.match(clarification.form.sourceSummary, /tanpa identitas/);
  assert.equal('rawResponses' in clarification.form, false);
  assert.equal('respondentIdentity' in clarification.form, false);
});

test('workshop intervention uses the knowledge base workshop definition', () => {
  const workshop = buildKnowledgeInterventions({ playbook, recommendation }).find(item => item.type === 'WORKSHOP');
  assert.equal(workshop.title, playbook.workshops[0].name);
  assert.equal(workshop.form.expectedOutput, playbook.workshops[0].result);
});

test('tool interventions keep valid toolkit mapping', () => {
  const tools = buildKnowledgeInterventions({ playbook, recommendation }).filter(item => item.type === 'TOOL_TEMPLATE');
  const validCodes = new Set(playbook.toolkits.map(item => item.code));
  assert.ok(tools.length && tools.every(item => validCodes.has(item.toolkit.code)));
});

test('consultant interventions are separate from client transformation actions', () => {
  const intervention = buildKnowledgeInterventions({ playbook, recommendation })[0];
  assert.equal('implementationRequirements' in intervention, false);
  assert.equal('clientAction' in intervention, false);
});

test('safety remains a priority flag and never changes maturity position', () => {
  const queue = buildKnowledgeInterventions({ playbook, recommendation, safetyFlag: true });
  assert.ok(queue.some(item => item.type === 'SPECIALIST_REFERRAL' && item.priority === 'P0'));
  assert.equal(resolveMaturityPosition({ average: 2.4 }).displayLevel, 2);
});

test('additive migration preserves legacy project data', () => {
  const legacy = { projects: { p1: { name: 'Lama' } }, projectTransformations: { p1: { findings: { f1: { title: 'Tetap' } } } } };
  const migrated = additiveInterventionMigration(legacy, 123);
  assert.deepEqual(migrated.projects, legacy.projects);
  assert.deepEqual(migrated.projectTransformations.p1.findings, legacy.projectTransformations.p1.findings);
  assert.equal(migrated.projectTransformations.p1.interventionVersion, '1.0');
});

test('client never receives consultant intervention notes', () => {
  assert.deepEqual(clientSafeInterventionProjection({ internalNotes: 'rahasia' }), {});
});
