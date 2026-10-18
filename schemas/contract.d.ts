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
  localReview?: { schemaVersion: 'local-hitl/1'; events: ItemReviewEvent[] };
  regeneration?: { schemaVersion: 'campaign-regeneration/1'; baselineHash: SHA256; caseId: ID;
    sourceRevisions: { id: ID; sourceId: ID; hash: SHA256 }[] };
  baselineSelections?: BaselineSelection[];
  [extension: string]: unknown;
}
export type ExtractionStage = 'ground' | 'interpret' | 'relate';
export interface StageProcessing { inputId: ID; status: 'completed' | 'skipped' | 'failed'; reason: string | null }
export interface StageInput {
  itemKey: string; type: ItemReviewType; id: ID; record: Record<string, unknown>;
  originalHash: SHA256; binding: SHA256; effectiveRevision: SHA256;
  contentOrigin: string; labelAuthorship: string; editor: string | null;
  evidence: Record<string, unknown>[]; decisionId: ID | null; reviewState: string; runIds: ID[];
}
export interface StageRequest {
  schemaVersion: 'campaign-stage-request/1'; extractionVersion: 'campaign-stages/1';
  kind: ExtractionStage; caseId: ID; baseDigest: SHA256; requestHash: SHA256;
  inputPolicy: 'grounded-applied-pending/1'; allowedOutputs: string[];
  selection: { inputKeys: string[]; revisionIds: ID[] };
  inputs: Record<string, unknown>[]; upstream: StageInput[];
  caseScope: Record<string, unknown>; chunkPolicy: Record<string, unknown>;
  catalogSnapshot: Record<string, unknown>; provider: Record<string, unknown>;
  prompt: { version: string; text: string; hash: SHA256 };
  limits: { bytes: number; items: number; text: number };
  candidateGuide: Record<string, unknown>; limitations: string[];
}
export interface StageCandidate {
  schemaVersion: 'campaign-stage-candidate/1'; requestHash: SHA256; kind: ExtractionStage;
  model: { effectiveModel: string | null; version: string | null; nullReasons: Record<string, 'unknown'> };
  processing: StageProcessing[];
  outputs: { claims: Record<string, unknown>[]; artifacts: Record<string, unknown>[] }
    | { behaviors: Record<string, unknown>[] } | { paths: Record<string, unknown>[]; mappings: Record<string, unknown>[] };
  limitations: string[];
}
export interface BaselineSelection {
  schemaVersion: 'campaign-baseline-selection/1'; caseId: ID; baselineHash: SHA256; candidateHash: SHA256;
  annotationsHash: SHA256; comparisonHash: SHA256; rubricVersion: 'campaign-major-mismatch/1';
  adjudication: Record<string, unknown>; reviewer: string; timestamp: string;
  previous: SHA256 | null; selectionHash: SHA256;
}
export type ItemReviewType = ReviewEntityType | 'behaviors' | 'occurrences' | 'paths' | 'nodes' | 'edges'
  | 'mappings' | 'telemetry' | 'detections' | 'otel' | 'annotations';
export interface ItemReviewEvent {
  id: ID; itemKey: string; action: 'accept' | 'modify' | 'exclude' | 'unsure' | 'provenance';
  reviewer: string; reviewerKind: 'self-attested-human'; timestamp: string; rationale: string;
  guideVersion: string; binding: SHA256; originalHash: SHA256; original: Record<string, unknown>;
  supportBindings: Record<string, { revision: SHA256; decisionId: ID | null; state: string }>;
  contentOrigin: string; labelAuthorship: string; sourceIds: ID[]; claimIds: ID[];
  runMetadata: Record<string, unknown>[]; previous: SHA256 | null; eventHash: SHA256;
  checks?: Record<'evidence' | 'fidelity' | 'scope' | 'type', { result: 'pass' | 'not-applicable'; reason?: string }>;
  confirmation?: string;
  patch?: Record<string, unknown>; researcherTags?: string[]; labelEdited?: boolean;
  provenanceEvidence?: string; previousOrigin?: string; previousLabelAuthorship?: string;
  exclusionReason?: string; replacementKeys?: string[];
}
export interface ProfileAcceptance {
  currentAcceptance: true; guideVersion: string; contentOrigin: string; labelAuthorship: string;
  humanReviewed: true; binding: SHA256; caseIds: ID[];
}
export interface ProfileCaseContext { id: ID; name: string; sourceIds: ID[]; contextOnly: true }
export interface ProfileChild {
  id: ID; localId: string; parent: { type: 'paths' | 'behaviors'; id: ID };
  [field: string]: unknown;
}
export interface ProfileAnnotation {
  id: ID; caseId: ID; sourceId: ID; sourceRevisionId: ID; type: string;
  evidenceStatus: 'evidence-backed' | 'inference' | 'unresolved'; origin: 'agent' | 'manual';
  status: 'pending'; contentOmitted: string; claimIds?: ID[]; runId?: ID; externalReferenceUrl?: string;
}
export interface ProfileRow {
  schemaVersion: '0.3.0';
  entityType: ItemReviewType | 'sources' | 'sourceRevisions' | 'passages' | 'frameworks';
  entity: Source | SourceRevision | Passage | Case | ProfileCaseContext | Claim | Categorization | Timeline
    | Behavior | Path | Mapping | SecurityTelemetry | Detection | OtelAction | Technique | ProfileChild | ProfileAnnotation;
  reviewStatus: ProfileAcceptance | { recordedDisposition: Disposition; effectiveDisposition: Disposition;
    currentAcceptance: boolean; stale: boolean; projected: boolean } | null;
  warnings: string[];
}
export interface Corpus {
  schemaVersion: '0.3.0'; name: string; sources: Source[]; sourceRevisions: SourceRevision[]; passages: Passage[]; cases: Case[]; claims: Claim[];
  categorizations: Categorization[]; timelines: Timeline[]; reviews: ReviewEvent[]; collectionManifests: CollectionManifest[];
  governance: Governance;
  paths?: Path[]; behaviors?: Behavior[]; frameworks?: Technique[]; mappings?: Mapping[]; telemetry?: SecurityTelemetry[];
  detections?: Detection[]; otel?: OtelAction[]; otelReference?: Record<string, unknown>;
}
