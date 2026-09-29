#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const outputArg = args.find(arg => arg.startsWith('--output='));
if (!input) {
  console.error('Usage: node scripts/migrate-consultant-interventions-v12.mjs <database-export.json> [--dry-run] [--output=patch.json]');
  process.exit(1);
}
const database = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
const patch = {};
let transformationsUpdated = 0;
for (const [projectId, record] of Object.entries(database.projectTransformations || {})) {
  if (record.schemaVersion !== '1.2') patch[`projectTransformations/${projectId}/schemaVersion`] = '1.2';
  if (record.interventionVersion !== '1.0') patch[`projectTransformations/${projectId}/interventionVersion`] = '1.0';
  if (record.schemaVersion !== '1.2' || record.interventionVersion !== '1.0') transformationsUpdated += 1;
}
const report = { dryRun, transformationsUpdated, destructiveOperations: 0, paths: Object.keys(patch).length };
if (outputArg) fs.writeFileSync(path.resolve(outputArg.slice('--output='.length)), `${JSON.stringify(patch, null, 2)}\n`);
console.log(JSON.stringify({ report, patch }, null, 2));
