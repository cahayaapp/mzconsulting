import fs from 'node:fs';
import path from 'node:path';

export function buildDomainPlanMigration(database, timestamp = Date.now()) {
  const patch = {};
  let transformationsUpdated = 0;
  for (const projectId of Object.keys(database.projects || {})) {
    if (!database.projectTransformations?.[projectId]) continue;
    patch[`projectTransformations/${projectId}/schemaVersion`] = '1.1';
    patch[`projectTransformations/${projectId}/domainPlanVersion`] = '1.0';
    transformationsUpdated++;
  }
  patch[`auditLogs/schema_domain_plans_${timestamp}`] = { action: 'MIGRATE_DOMAIN_PLAN_SCHEMA', schemaVersion: '1.1', domainPlanVersion: '1.0', transformationsUpdated, destructiveOperations: 0, at: timestamp };
  return { patch, report: { transformationsUpdated, destructiveOperations: 0, paths: Object.keys(patch).length } };
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/migrate-domain-plans-v11.mjs <production-export.json> [--write]');
  const database = JSON.parse(fs.readFileSync(source, 'utf8'));
  const result = buildDomainPlanMigration(database);
  const base = source.replace(/\.json$/i, '');
  fs.writeFileSync(`${base}.domain-plans-v11-report.json`, `${JSON.stringify(result.report, null, 2)}\n`);
  if (process.argv.includes('--write')) fs.writeFileSync(`${base}.domain-plans-v11-patch.json`, `${JSON.stringify(result.patch, null, 2)}\n`);
  console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'WRITE_PATCH' : 'DRY_RUN', source: path.basename(source), report: result.report }, null, 2));
}
