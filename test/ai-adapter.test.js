import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAiOutputIsAdvisory, buildAiContext } from '../lib/ai-adapter.js';

test('AI integration context forbids human decision fields', () => {
  const context = buildAiContext({ project: { name: 'Audit' }, findings: [], validatedRecommendations: [], roadmap: [] });
  assert.equal(context.constraints.may_validate_playbook, false);
  assert.equal(context.constraints.may_assign_p0, false);
  assert.throws(() => assertAiOutputIsAdvisory({ validation_status: 'VALIDATED' }));
  assert.equal(assertAiOutputIsAdvisory({ narrative: 'draft' }).status, 'DRAFT_AI_ASSISTED');
});
