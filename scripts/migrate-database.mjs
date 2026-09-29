import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const source = args.find(arg => arg.endsWith('.json'));
const write = args.includes('--write');
if (!source || !fs.existsSync(source)) {
  console.error('Gunakan: node scripts/migrate-database.mjs <firebase-export.json> [--write]');
  process.exit(1);
}

const original = JSON.parse(fs.readFileSync(source, 'utf8'));
const migrated = structuredClone(original);
const addedRoots = [];
for (const key of ['knowledgeBase', 'knowledgeBaseImports', 'projectTransformations', 'tenantProjects', 'userProjects', 'users', 'auditLogs']) {
  if (!(key in migrated)) { migrated[key] = {}; addedRoots.push(key); }
}
for (const [projectId, project] of Object.entries(migrated.projects || {})) {
  const tenantId = project.tenantId || project.createdBy;
  if (tenantId) {
    migrated.tenantProjects[tenantId] = migrated.tenantProjects[tenantId] || {};
    migrated.tenantProjects[tenantId][projectId] = true;
  }
  if (project.createdBy) {
    migrated.userProjects[project.createdBy] = migrated.userProjects[project.createdBy] || {};
    migrated.userProjects[project.createdBy][projectId] = true;
  }
  if (!migrated.projectTransformations[projectId]) {
    migrated.projectTransformations[projectId] = {
      schemaVersion: '1.0',
      migratedFrom: 'legacy',
      legacyAnalysisPreserved: Boolean(project.analysisNote),
      createdAt: Date.now(),
      recommendations: {},
      roadmap: {},
      findings: {}
    };
  }
}
const report = {
  mode: write ? 'write' : 'dry-run',
  source,
  projectCount: Object.keys(original.projects || {}).length,
  legacyAnalysisCount: Object.values(original.projects || {}).filter(item => item.analysisNote).length,
  legacyFollowupCount: Object.values(original.followups || {}).reduce((sum, rows) => sum + Object.keys(rows || {}).length, 0),
  addedRoots,
  destructiveChanges: 0
};
console.log(JSON.stringify(report, null, 2));
if (write) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${source}.backup-${stamp}`;
  const output = path.join(path.dirname(source), `${path.basename(source, '.json')}.migrated.json`);
  fs.copyFileSync(source, backup);
  fs.writeFileSync(output, `${JSON.stringify(migrated, null, 2)}\n`);
  console.log(`Backup: ${backup}`);
  console.log(`Migrated export: ${output}`);
}
