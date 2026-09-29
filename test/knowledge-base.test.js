import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildKnowledgeBase } from '../scripts/import-knowledge-base.mjs';

const files = Array.from({ length: 10 }, (_, i) => `/Users/haimac/Downloads/MZ_Transformation_Playbook_D${String(i + 1).padStart(2, '0')}_Seed_V01.json`);
const { report, data } = buildKnowledgeBase(files);

test('seed import reads 50 unique playbooks across 10 domains', () => {
  assert.equal(report.valid, true, report.errors.join('\n'));
  assert.equal(data.domains.length, 10);
  assert.equal(data.playbooks.length, 50);
  assert.equal(new Set(data.playbooks.map(item => item.code)).size, 50);
});

test('toolkit codes are unique and approximately 300 are available', () => {
  assert.ok(data.toolkits.length >= 250);
  assert.equal(new Set(data.toolkits.map(item => item.code)).size, data.toolkits.length);
});

test('all indicator mappings point to existing versioned playbooks', () => {
  const ids = new Set(data.playbooks.map(item => item.id));
  assert.equal(data.indicator_map.length, 100);
  data.indicator_map.forEach(item => {
    assert.ok(ids.has(item.playbook_id));
    assert.match(item.indicator_id, /^D\d{2}\.S\d{2}\.I\d{2}$/);
  });
});

test('generated runtime knowledge base exists and is valid JSON', () => {
  const built = JSON.parse(fs.readFileSync(new URL('../data/knowledge-base.v1.json', import.meta.url), 'utf8'));
  assert.equal(built.playbooks.length, 50);
});
