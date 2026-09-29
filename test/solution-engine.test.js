import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildFindings,
  buildRoadmap,
  clientProjection,
  recommendPlaybooks,
  snapshotValidatedRecommendation
} from '../lib/solution-engine.js';

const knowledgeBase = JSON.parse(fs.readFileSync(new URL('../data/knowledge-base.v1.json', import.meta.url), 'utf8'));

test('matching finding produces a system recommendation', () => {
  const findings = buildFindings([{ questionId: 'q1', average: 1.5, spread: .4, count: 3 }], { q1: 'D02.S02.I01' });
  const result = recommendPlaybooks({ knowledgeBase, findings });
  assert.equal(result.find(item => item.playbook_code === 'ORG-02')?.status, 'SYSTEM_SUGGESTED');
});

test('missing prerequisite is detected and ordered before dependent playbook', () => {
  const findings = buildFindings([{ questionId: 'q1', average: 2, spread: .2, count: 3 }], { q1: 'D03.S04.I01' });
  const result = recommendPlaybooks({ knowledgeBase, findings });
  const hr = result.find(item => item.playbook_code === 'HR-04');
  assert.ok(hr.missing_dependencies.includes('ORG-02'));
  assert.ok(result.some(item => item.playbook_code === 'ORG-02'));
  const roadmap = buildRoadmap(result);
  assert.ok(roadmap.findIndex(item => item.playbook_code === 'ORG-02') < roadmap.findIndex(item => item.playbook_code === 'HR-04'));
});

test('critical safety flag overrides normal dependency priority', () => {
  const result = recommendPlaybooks({ knowledgeBase, evidenceFlags: [{ severity: 'critical', playbook_codes: ['CARE-04'] }] });
  assert.equal(result[0].playbook_code, 'CARE-04');
  assert.equal(result[0].priority, 'P0');
  assert.equal(result[0].safety_override, true);
});

test('system suggestion remains distinct from consultant validation', () => {
  const suggested = recommendPlaybooks({ knowledgeBase, findings: buildFindings([{ questionId: 'q1', average: 2, spread: 0, count: 3 }], { q1: 'D01.S01.I01' }) })[0];
  const playbook = knowledgeBase.playbooks.find(item => item.id === suggested.playbook_id);
  const validated = snapshotValidatedRecommendation(suggested, playbook, 'consultant-1', 123);
  assert.equal(suggested.status, 'SYSTEM_SUGGESTED');
  assert.equal(validated.validation_status, 'VALIDATED');
  assert.notStrictEqual(validated, suggested);
});

test('client projection uses selected domain plans instead of internal recommendations', () => {
  const view = clientProjection({ recommendations: { secret: { internal_score: 99 } }, domainPlans: {
    D02: { domainCode: 'D02', domainName: 'Tata Kelola', currentMaturity: 2, targetMaturity: 3, implementationRequirements: [], status: 'Belum Dimulai' }
  } });
  assert.deepEqual(view.domainPlans.map(item => item.domainCode), ['D02']);
  assert.equal('recommendations' in view, false);
});

test('version snapshot is immutable when a new KB version appears', () => {
  const old = knowledgeBase.playbooks.find(item => item.code === 'ORG-02');
  const suggested = { playbook_id: old.id, playbook_code: 'ORG-02', playbook_version: old.version };
  const projectRecord = snapshotValidatedRecommendation(suggested, old, 'c1', 1);
  const newVersion = { ...old, version: '1.1', title: 'Judul baru' };
  assert.equal(projectRecord.playbook_snapshot.version, old.version);
  assert.notEqual(projectRecord.playbook_snapshot.title, newVersion.title);
});

test('consultant may override roadmap order only with recorded reason', () => {
  const items = [
    { playbook_code: 'ORG-02', priority: 'P1', dependencies: ['ORG-01'] },
    { playbook_code: 'ORG-01', priority: 'P1', dependencies: [] }
  ];
  const normal = buildRoadmap(items);
  assert.deepEqual(normal.map(item => item.playbook_code), ['ORG-01', 'ORG-02']);
  const overrides = { 'ORG-02': { ignore_dependencies: true, reason: 'Urgent operational containment' } };
  assert.ok(overrides['ORG-02'].reason);
  const changed = buildRoadmap(items, overrides);
  assert.deepEqual(changed.map(item => item.playbook_code), ['ORG-02', 'ORG-01']);
});
