import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('migration is additive and preserves legacy analysis, recommendations, and followups', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mz-migration-'));
  const source = path.join(dir, 'firebase-export.json');
  const legacy = {
    projects: { p1: { name: 'Legacy', createdBy: 'consultant-legacy', analysisNote: 'Keep this', recommendations: { old: 'Keep this too' } } },
    followups: { p1: { f1: { title: 'Legacy followup' } } },
    responses: { invite1: { submittedAt: 1 } }
  };
  fs.writeFileSync(source, JSON.stringify(legacy));
  execFileSync(process.execPath, [new URL('../scripts/migrate-database.mjs', import.meta.url).pathname, source, '--write']);
  const migrated = JSON.parse(fs.readFileSync(path.join(dir, 'firebase-export.migrated.json'), 'utf8'));
  assert.deepEqual(migrated.projects, legacy.projects);
  assert.deepEqual(migrated.followups, legacy.followups);
  assert.deepEqual(migrated.responses, legacy.responses);
  assert.ok(migrated.projectTransformations.p1);
  assert.equal(migrated.userProjects['consultant-legacy'].p1, true);
  assert.equal(fs.readdirSync(dir).some(name => name.includes('.backup-')), true);
});
