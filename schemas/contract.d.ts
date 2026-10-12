export type ID = string;
export type SHA256 = string;
export type NullReason = 'unknown' | 'not_reported' | 'not_applicable';
export type NullReasons = Record<string, NullReason>;
export type CollectionState = 'Collected' | 'Extracted — review pending' | 'Reviewed' | 'Needs correction' | 'Excluded';
export type Disposition = 'Pending' | 'Accepted' | 'Needs correction' | 'Excluded';
export type EvidenceStatus = 'Source-reported observation' | 'Attempted behavior' | 'Demonstrated capability or proof of concept' | 'Potential consequence' | 'Researcher inference' | 'Unclear or disputed';
export type Origin = 'Human authored' | 'Human source paraphrase' | 'Human inference' | 'Official framework' | 'LLM source paraphrase' | 'LLM synthesis' | 'LLM reconstruction' | 'LLM inferred relationship' | 'LLM inferred mapping' | 'LLM normalized behavior' | 'LLM proposed categorization' | 'LLM proposed collection' | 'LLM proposed detection' | 'LLM proposed instrumentation' | 'LLM synthetic fixture; not incident evidence';
export type Precision = 'day' | 'month' | 'year' | 'range' | 'unknown';
export type DateType = 'publication' | 'source_update' | 'first_reported_activity' | 'incident_execution' | 'discovery' | 'disclosure';
export type TrustSurface = 'Social engineering and malicious repositories' | 'Package or registry compromise' | 'IDE and local execution paths' | 'Skill marketplace poisoning' | 'MCP or tool poisoning' | 'Credentials and identity' | 'CI/CD and cloud';
export type AIRole = 'Victim-side agent abuse' | 'Attacker-side AI use' | 'AI review targeting' | 'AI assets targeted' | 'No AI involvement reported' | 'Unclear';
export type ExecutionLocation = 'endpoint' | 'IDE' | 'CLI' | 'WSL' | 'container' | 'CI runner' | 'cloud' | 'remote service' | 'unknown';
export type Delivery = 'recruiter lure' | 'repository content' | 'package install/update' | 'extension' | 'Skill' | 'MCP integration' | 'configuration change' | 'other';
export type Objective = 'credential theft' | 'data theft' | 'persistence' | 'execution' | 'lateral movement' | 'disruption' | 'other/unknown';
export type EvidenceToSeek = 'native agent records' | 'endpoint telemetry' | 'package provenance' | 'repository/CI records' | 'identity/cloud logs' | 'network records';
export interface DateValue { precision: Precision; value: string | null; start: string | null; end: string | null; nullReasons: NullReasons }
export interface Provenance { kind: 'supplied-text' | 'supplied-url'; suppliedBy: string | null; description: string; nullReasons: NullReasons }
export interface Source {
  id: ID; originalUrl: string | null; canonicalUrl: string | null; title: string | null; publisher: string | null; author: string | null;
  publicationDate: DateValue; updateDate: DateValue; retrievalDate: DateValue;
  inputKind: 'url' | 'supplied-text' | 'text-file'; provenance: Provenance; revisionIds: ID[];
  extractionStatus: 'Not started' | 'Pending' | 'Extracted' | 'Failed' | 'Unavailable'; collectionState: CollectionState;
  nullReasons: NullReasons;
}
export interface SourceRevision {
  id: ID; sourceId: ID; rawHash: SHA256 | null; normalizedHash: SHA256 | null; normalizationVersion: string; parserVersion: string;
  provenance: Provenance; rawContent: string | null; normalizedContent: string | null;
  retention: 'private' | 'permitted-public' | 'not-retained'; nullReasons: NullReasons;
}
export interface Attestation { reviewer: string; reviewerKind: 'human'; timestamp: string; revisionHash: SHA256; rationale: string }
export interface Passage { id: ID; sourceRevisionId: ID; text: string | null; locator: string; start: number; end: number; attestation: Attestation | null; nullReasons: NullReasons }
export interface Reviewable { id: ID; origin: Origin; disposition: Disposition; revision: ID; history: ID[]; nullReasons: NullReasons }
export interface Case extends Reviewable {
  name: string; aliases: string[]; kind: 'Campaign' | 'Incident' | 'Research exercise' | 'Comparator' | 'Composite playbook' | 'Other';
  summary: string | null; summaryClaimIds: ID[]; sourceIds: ID[]; collectionState: CollectionState; limits: string | null;
  pathIds?: ID[];
}
export interface Inference { rationale: string; supportingClaimIds: ID[] }
export interface Claim extends Reviewable {
  caseId: ID; sourceId: ID; sourceRevisionId: ID; description: string; passageIds: ID[]; inference: Inference | null;
  evidenceStatus: EvidenceStatus; conflictsWith: ID[]; uncertainty: string | null; observationContext: string | null;
}
export type CategoryDimension = 'trust_surface' | 'ai_involvement' | 'execution_location' | 'delivery' | 'objective' | 'evidence_to_seek' | 'tool' | 'platform' | 'tag';
export interface Categorization extends Reviewable {
  caseId: ID; dimension: CategoryDimension; value: string | null; otherText: string | null; sourceIds: ID[]; supportingClaimIds: ID[];
}
export interface Timeline extends Reviewable {
  caseId: ID; description: string; date: DateValue; dateType: DateType; supportingClaimIds: ID[]; sourceRevisionIds: ID[];
  basis: string; uncertainty: string | null;
}
export type ReviewEntityType = 'cases' | 'claims' | 'categorizations' | 'timelines';
export interface ReviewEvent {
  id: ID; entityType: ReviewEntityType; entityId: ID; revision: ID; baseDigest: SHA256; reviewer: string; reviewerKind: 'human' | 'agent';
  timestamp: string; disposition: Disposition; rationale: string; contentHash: SHA256; dependencyHashes: Record<string, SHA256>;
}
export interface CollectionManifest {
  id: ID; kind: 'manual-collection' | 'extraction'; inputSourceIds: ID[]; inputRevisionIds: ID[];
  outcome: 'Pending' | 'Succeeded' | 'Partial' | 'Failed'; provenance: Provenance; toolVersion: string;
  inputHash: SHA256 | null; outputHash: SHA256 | null; limitations: string[]; nullReasons: NullReasons;
}
export interface Node {
  id: ID; title: string; detail: string; claimIds: ID[]; behaviorIds: ID[]; evidenceStatus: EvidenceStatus; origin: Origin; disposition: Disposition;
  [extension: string]: unknown;
}
export interface Edge {
  id: ID; from: ID; to: ID; claimIds: ID[]; relation: 'sequence' | 'conditional' | 'propagates'; basis: string; origin: Origin;
  [extension: string]: unknown;
}
export interface Path {
  id: ID; caseId: ID; nodes: Node[]; edges: Edge[]; scope: 'representative' | 'composite'; origin: Origin; disposition: Disposition;
  [extension: string]: unknown;
}
export interface Behavior {
  id: ID; namespace: string; name: string; boundary: string; description: string; signalIds: ID[]; detectionIds: ID[]; otelIds: ID[]; origin: Origin; disposition: Disposition;
  [extension: string]: unknown;
}
export interface Technique {
  id: ID; name: string; framework: 'ATLAS' | 'ATT&CK'; version: string; sourceId: ID; url: string;
  parentId?: ID | null; tacticIds?: ID[]; maturity?: string; [extension: string]: unknown;
}
export interface Mapping {
  id: ID; caseId: ID; behaviorId: ID; framework: string; version: string; techniqueId: ID; claimIds: ID[];
  pathId?: ID; nodeId?: ID; rationale: string; applicability: string; origin: Origin; mappingStatus: 'Proposed' | 'Reviewed' | 'Rejected';
  disposition: Disposition; provisional?: boolean; [extension: string]: unknown;
}
export interface SecurityTelemetry {
  id: ID; behaviorId: ID; category: string; eventType: string; logicalFields: string[]; joinKeys: string[]; availability: string;
  schema: string; limitations: string; origin: Origin; disposition: Disposition; [extension: string]: unknown;
}
export interface Detection {
  id: ID; behaviorId: ID; hypothesis: string; signalIds: ID[]; otelIds: ID[]; windowSeconds: number; windowBasis: string;
  tuning: string; testPlan: string; validation: string; origin: Origin; disposition: Disposition; [extension: string]: unknown;
}
export interface OtelAction {
  id: ID; behaviorId: ID; action: string; standardSourceIds: ID[]; customFields: string[]; sample: Record<string, unknown>;
  sampleFormat: string; sampleOrigin: string; stability: string; limitations: string; origin: Origin; disposition: Disposition; [extension: string]: unknown;
}
export interface Governance {
  controlledAliases?: Record<string, string[]>;
  [extension: string]: unknown;
}
export interface Corpus {
  schemaVersion: '0.3.0'; name: string; sources: Source[]; sourceRevisions: SourceRevision[]; passages: Passage[]; cases: Case[]; claims: Claim[];
  categorizations: Categorization[]; timelines: Timeline[]; reviews: ReviewEvent[]; collectionManifests: CollectionManifest[];
  governance: Governance;
  paths?: Path[]; behaviors?: Behavior[]; frameworks?: Technique[]; mappings?: Mapping[]; telemetry?: SecurityTelemetry[];
  detections?: Detection[]; otel?: OtelAction[]; otelReference?: Record<string, unknown>;
}
