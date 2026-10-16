// Published versions are immutable: add a new version rather than changing decision rules.
export const GUIDE_VERSION = 'researcher-review/1';
export const CONTENT_ORIGINS = [
  'Human authored', 'Human source paraphrase', 'Human inference', 'Official framework',
  'LLM source paraphrase', 'LLM synthesis', 'LLM reconstruction', 'LLM inferred relationship',
  'LLM inferred mapping', 'LLM normalized behavior', 'LLM proposed categorization',
  'LLM proposed collection', 'LLM proposed detection', 'LLM proposed instrumentation',
  'LLM synthetic fixture; not incident evidence', 'unknown',
];
export const COMMON_CHECKS = {
  evidence: 'Supported by the cited evidence; uncertainty and conflicts are explicit.',
  fidelity: 'Faithful to the source; reported, attempted, inferred and confirmed are not interchangeable.',
  scope: 'Correct campaign, source occurrence, actor/role and scope.',
};
export const TYPE_CHECKS = {
  claims: 'The atomic claim and its evidence classification are supported.',
  cases: 'The summary adds nothing beyond its independently accepted supporting claims.',
  categorizations: 'The existing category/tag value and its scope are supported.',
  timelines: 'The date type and precision are supported, not invented.',
  behaviors: 'The behavior definition adds no unsupported action or trust boundary.',
  occurrences: 'This distinct behavior occurrence has its own source-local support.',
  paths: 'The path scope is supported; ordering is not inferred from layout.',
  nodes: 'The node action and linked behaviors have independent support.',
  edges: 'This relationship has its own evidence; accepted endpoints do not approve it.',
  mappings: 'The mapping fits the pinned definition; membership alone is not evidence.',
  telemetry: 'Collection is a proposal unless separately evidenced; availability is honest.',
  detections: 'Human review approves a proposal, not operational validation or deployment.',
  otel: 'Instrumentation remains a proposal; synthetic samples are not incident evidence.',
  annotations: 'Identity, role and usage are supported; prompt literals and use context are exact.',
};
export const EXCLUSION_REASONS = [
  'unsupported', 'inaccurate', 'duplicate', 'outside scope', 'misattributed', 'insufficient evidence',
];
export const checksFor = type => ({ ...COMMON_CHECKS, type: TYPE_CHECKS[type] });
export const LABEL_FIELDS = {
  claims: ['evidenceStatus'], cases: [], categorizations: ['dimension', 'value'],
  timelines: ['dateType', 'date.precision'], behaviors: ['boundary'], occurrences: [],
  paths: ['scope'], nodes: ['evidenceStatus'], edges: ['relation', 'basis'],
  mappings: ['framework', 'version', 'techniqueId', 'mappingStatus'],
  telemetry: ['category', 'eventType', 'availability'], detections: ['validation'],
  otel: ['sampleOrigin', 'stability'],
  annotations: ['type', 'evidenceStatus'],
};
export function labelFields(type, record) {
  return [...(LABEL_FIELDS[type] ?? []), ...(type !== 'annotations' ? [] :
    record.type === 'commands-ai-artifacts' ? ['context.artifactKind', 'context.artifactUsage'] :
      record.type === 'traditional-indicators' ? ['context.indicatorKind'] :
        record.type === 'role-context' ? ['context.roles'] :
          record.type === 'observed-behavior' ? ['context.behavior'] :
            record.type === 'data-sources' ? ['context.collection'] :
              record.type === 'ttp-references' ? ['context.mapping'] :
                record.type === 'detection-references' ? ['context.detection'] : [])];
}
export function labelCompleteness(type, record) {
  const fields = labelFields(type, record);
  if (!fields.length) return { state: 'complete', applicable: false, fields };
  const present = fields.filter(field => {
    const value = field.split('.').reduce((node, key) => node?.[key], record);
    return typeof value === 'string' ? !!value.trim() : Array.isArray(value) && value.length > 0;
  }).length;
  return { state: present === fields.length ? 'complete' : present ? 'incomplete' : 'missing', applicable: true, fields };
}
