import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessInternalKnowledgeBase, canAccessProject, coordinatorProjection, respondentProjection } from '../lib/access-control.js';
import fs from 'node:fs';

const project = { createdBy: 'consultant-a', tenantId: 'tenant-a', members: { coordinator: true }, clientMembers: { client: true }, analysisNote: 'internal', rawResponses: { secret: true } };

test('respondent cannot access internal knowledge base', () => assert.equal(canAccessInternalKnowledgeBase({ uid: 'r1', role: 'respondent' }), false));
test('coordinator projection excludes diagnostic notes and raw responses', () => {
  const safe = coordinatorProjection(project);
  assert.equal(safe.analysisNote, undefined);
  assert.equal(safe.rawResponses, undefined);
});
test('client only gets explicit client project access', () => {
  assert.equal(canAccessProject({ uid: 'client', role: 'client', tenantId: 'tenant-a' }, project, 'read_client'), true);
  assert.equal(canAccessProject({ uid: 'client', role: 'client', tenantId: 'tenant-a' }, project, 'read'), false);
});
test('cross-tenant access is blocked', () => assert.equal(canAccessProject({ uid: 'consultant-a', role: 'consultant', tenantId: 'tenant-b' }, project), false));
test('respondent projection contains invite scope only', () => {
  const view = respondentProjection({ projectId: 'p', perspectiveId: 'r', active: true, internalNote: 'hidden' });
  assert.equal(view.internalNote, undefined);
});
test('database rules keep knowledge base and transformations away from anonymous respondents', () => {
  const rules = JSON.parse(fs.readFileSync(new URL('../firebase-rtdb-rules.json', import.meta.url), 'utf8')).rules;
  assert.match(rules.knowledgeBase['.read'], /auth\.token\.email/);
  assert.match(rules.projectTransformations.$projectId['.read'], /auth\.token\.email/);
  assert.equal(rules.knowledgeBase['.read'].includes('invites'), false);
  assert.match(rules.projects.$projectId['.read'], /tenantId/);
  assert.match(rules.projects['.read'], /role.*admin/);
});
