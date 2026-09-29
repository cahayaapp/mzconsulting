export const INTERNAL_ROLES = new Set(['admin', 'consultant']);

export function canAccessInternalKnowledgeBase(user) {
  return Boolean(user?.uid && INTERNAL_ROLES.has(user.role));
}

export function canAccessProject(user, project, action = 'read') {
  if (!user?.uid || !project) return false;
  if (user.role === 'admin') return true;
  if (project.tenantId && user.tenantId !== project.tenantId) return false;
  if (user.role === 'consultant') return project.createdBy === user.uid || Boolean(project.members?.[user.uid]);
  if (user.role === 'coordinator') return action === 'read' && Boolean(project.members?.[user.uid]);
  if (user.role === 'client') return action === 'read_client' && Boolean(project.clientMembers?.[user.uid]);
  return false;
}

export function respondentProjection(invite) {
  if (!invite) return null;
  const { projectId, perspectiveId, perspectiveLabel, respondentName, pesantren, assessmentName, period, domains, active, createdAt } = invite;
  return { projectId, perspectiveId, perspectiveLabel, respondentName, pesantren, assessmentName, period, domains, active, createdAt };
}

export function coordinatorProjection(project) {
  if (!project) return null;
  const { analysisNote, internalNotes, rawResponses, transformationInternal, ...safe } = project;
  return safe;
}
