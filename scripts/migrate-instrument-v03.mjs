import fs from 'node:fs';
import path from 'node:path';
import { buildInstrument } from './build-instrument.mjs';

export function buildInstrumentMigration(database, timestamp = Date.now()) {
  const patch = {};
  const report = { projectsUpgraded: 0, activeInvitesUpgraded: 0, completedInvitesPinnedLegacy: 0, draftResponsesUpgraded: 0, completedResponsesPinnedLegacy: 0, answersChanged: 0 };
  const projectsToUpgrade = new Set();
  for (const [inviteId, invite] of Object.entries(database.invites || {})) {
    if (invite.active === false) continue;
    const response = database.responses?.[inviteId];
    const version = response?.submittedAt ? 'V0.2' : 'V0.3';
    patch[`invites/${inviteId}/instrumentVersion`] = version;
    if (version === 'V0.3') {
      report.activeInvitesUpgraded++;
      projectsToUpgrade.add(invite.projectId);
    } else report.completedInvitesPinnedLegacy++;
    if (response) {
      patch[`responses/${inviteId}/instrumentVersion`] = version;
      if (version === 'V0.3') report.draftResponsesUpgraded++;
      else report.completedResponsesPinnedLegacy++;
    }
    if (invite.projectId && invite.perspectiveId && database.projects?.[invite.projectId]?.perspectives?.[invite.perspectiveId]) {
      patch[`projects/${invite.projectId}/perspectives/${invite.perspectiveId}/instrumentVersion`] = version;
    }
  }
  for (const projectId of projectsToUpgrade) {
    patch[`projects/${projectId}/instrumentVersion`] = 'V0.3';
    patch[`projects/${projectId}/instrumentUpgradedAt`] = timestamp;
    report.projectsUpgraded++;
  }
  patch['knowledgeBase/instruments/V0_3'] = { ...buildInstrument(), publishedAt: timestamp };
  patch['knowledgeBase/activeInstrumentVersion'] = 'V0.3';
  patch[`auditLogs/instrument_v03_${timestamp}`] = { action: 'PUBLISH_INSTRUMENT', version: 'V0.3', at: timestamp, scope: 'active_unsubmitted_invitations', report };
  return { patch, report };
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: node scripts/migrate-instrument-v03.mjs <production-export.json> [--write]');
  const database = JSON.parse(fs.readFileSync(source, 'utf8'));
  const timestamp = Date.now();
  const result = buildInstrumentMigration(database, timestamp);
  const base = source.replace(/\.json$/i, '');
  fs.writeFileSync(`${base}.instrument-v03-report.json`, `${JSON.stringify(result.report, null, 2)}\n`);
  if (process.argv.includes('--write')) fs.writeFileSync(`${base}.instrument-v03-patch.json`, `${JSON.stringify(result.patch, null, 2)}\n`);
  console.log(JSON.stringify({ mode: process.argv.includes('--write') ? 'WRITE_PATCH' : 'DRY_RUN', source: path.basename(source), report: result.report }, null, 2));
}
