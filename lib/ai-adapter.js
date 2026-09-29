// Integration boundary for a future AI provider. Core decisions stay deterministic.
export function buildAiContext({ project, findings, validatedRecommendations, roadmap }) {
  return {
    task_scope: ['summarize_findings', 'draft_narrative', 'explain_playbook', 'draft_roadmap', 'summarize_progress'],
    project: { name: project?.name || '', pesantren: project?.pesantren || '', period: project?.period || '' },
    findings: (findings || []).map(({ id, indicator_id, score, perception_gap, evidence_gap, confidence }) => ({ id, indicator_id, score, perception_gap, evidence_gap, confidence })),
    validated_recommendations: (validatedRecommendations || []).filter(item => item.validation_status === 'VALIDATED'),
    roadmap: roadmap || [],
    constraints: {
      may_validate_playbook: false,
      may_assign_p0: false,
      may_close_intervention: false,
      may_verify_effectiveness: false,
      output_is_draft: true
    }
  };
}

export function assertAiOutputIsAdvisory(output) {
  const forbidden = ['validation_status', 'effectiveness_verified', 'closed_at', 'priority_override'];
  const found = forbidden.filter(key => Object.prototype.hasOwnProperty.call(output || {}, key));
  if (found.length) throw new Error(`AI output mencoba menetapkan field keputusan manusia: ${found.join(', ')}`);
  return { ...output, status: 'DRAFT_AI_ASSISTED' };
}
