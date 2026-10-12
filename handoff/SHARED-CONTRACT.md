# Shared corpus and grounding contract

Version 1.1 · 12 October 2026. Normative across all phases. The supplied lightweight PRD supersedes the enrichment-first assumptions. reference/corpus.schema.json (0.2.0) is a legacy migration input, not the target contract. The new target schema version is 0.3.0: sources/cases/claims are core; enrichment collections optional. Implement the schema in Issue 1; this document does not change the running prototype.

## Entity contract

| Entity | Required meaning and relationships |
|---|---|
| Source | id, originalUrl/canonicalUrl (HTTPS or null for text-only input), title, publisher, author, publication/update/retrieval dates, input kind, provenance, revision/content hashes and extraction status |
| Case | id, name, aliases, kind, summary with claim references, sourceIds, review state and limits; pathIds optional |
| Claim | id, caseId, sourceId, sourceRevisionId, behavior description, supporting passage/location OR explicit inference basis, evidenceStatus, origin, reviewer disposition, revision/history |
| Categorization | id, caseId, dimension, value, supportingClaimIds, origin and reviewer disposition; multiple assertions per dimension |
| Timeline entry | id, caseId, description, date/range, precision, dateType, supporting claim/source revision, uncertainty |
| Review event | append-only id, entity/revision, base digest, reviewer, timestamp, disposition/rationale, content/dependency hashes |
| Path (optional) | id, caseId, nodes, edges, origin, review state; representative/composite scope explicit |
| Node (optional) | stable globally unique id, title/detail, nonempty claimIds, behaviorIds, evidenceStatus, origin, disposition |
| Edge (optional) | id, from/to in its path, claimIds, relation, basis, origin; relation: sequence, conditional or propagates |
| Behavior | local id/namespace, repeatable action/trust boundary, signalIds, detectionIds, otelIds; MITRE membership optional |
| Technique | official id, name, framework, version, sourceId, URL; maturity/tactics where available |
| Mapping (optional) | id, caseId, behaviorId, framework/version, techniqueId or provisional local candidate, nonempty claimIds, rationale, applicability, origin, mappingStatus; pathId/nodeId optional together |
| Security telemetry | id, behaviorId, sensor family/event type, logicalFields, joinKeys, availability, schema, limitations, origin/review |
| Detection | id, behaviorId, hypothesis, signalIds/otelIds, window/basis, tuning, testPlan, validation |
| OTEL action | id, behaviorId, standard/convention references and versions, customFields, synthetic sample, format/origin, visibility gaps |
| Governance | selection history, consumer rules, framework/OTEL snapshots, review policy |

Sources and cases are many-to-many through sourceIds and source-supported claims. Each claim belongs to one case; a source can support claims in several cases. If a claim applies to multiple cases, retain explicit case-scoped claims with shared source/passage identity rather than silently asserting attribution. Case merge proposals require review and retained aliases/tombstones.

Optional mapping supports case-scoped claimIds and behaviorId without a path requirement. If node/path scope exists, referenced claims must belong to the case and intersect node evidence; behavior must belong to the node. Endpoint evidence supports reconstruction without proving timing/causality. Shared behavior never proves attribution.

### Core field rules

Unknown values are null with a field-specific reason: unknown, not_reported or not_applicable. Use a consistent nullReasons object keyed by field path; empty strings and missing keys are not interchangeable with these states. Known values cannot simultaneously have a null reason. Sources lacking URL are valid only with supplied-text provenance. Required passage references cannot be satisfied by null.

Source revisions store raw/normalized SHA-256, content normalization/parser version and input provenance. Supporting passage includes exact text where permitted, sourceRevisionId, locator and offsets in normalized Unicode text (zero-based, end-exclusive code-point offsets). Validator checks the substring when retained content is available. Otherwise a reviewer-attested passage/locator and revision hash are required; this limitation visible. Passage references are stable within a revision, not across changed article text. Full articles excluded from public distribution unless explicitly permitted.

Claim evidenceStatus: Source-reported observation; Attempted behavior; Demonstrated capability or proof of concept; Potential consequence; Researcher inference; Unclear or disputed. Preserve legacy Research observed vs Demonstrated detail as observationContext. Researcher inference requires rationale plus supportingClaimIds; origin identifies human/LLM authorship independently. Conflicts use conflictsWith claim IDs, never an automatically merged conclusion.

Collection lifecycle: Collected; Extracted — review pending; Reviewed; Needs correction; Excluded. Reviewer disposition: Pending; Accepted; Needs correction; Excluded. These are separate from evidenceStatus/origin and source retrieval/extraction outcome. Reviewed means processed, not necessarily accepted. Accepted claims require valid current review events. Future enrichment retains Proposed/Reviewed/Rejected mapping status independent of official technique metadata.

Legacy migration: campaigns → cases (same IDs), evidence → claims (same IDs), campaignId → caseId; node evidenceIds and mapping references migrated explicitly. Reported → Source-reported observation; Attempt reported and Intent only → Attempted behavior with legacy label/outcome uncertainty preserved; Research observed/Demonstrated → Demonstrated capability or proof of concept with context retained. Intent only remains intent, never claimed execution. Unreviewed → Extracted — review pending / Pending. Legacy Approved is not accepted without matching authenticated review/hash. Missing source passages remain pending, not invented. Preserve originalStatus and originalOrigin for audit.

### Controlled multi-label dimensions

- Trust surfaces: Social engineering and malicious repositories; Package or registry compromise; IDE and local execution paths; Skill marketplace poisoning; MCP or tool poisoning; Credentials and identity; CI/CD and cloud.
- AI involvement: Victim-side agent abuse; Attacker-side AI use; AI review targeting; AI assets targeted; No AI involvement reported; Unclear. Several positive roles can coexist. No AI involvement reported cannot coexist with a positive role in the same reviewed-source scope; use claim/source-scoped assertions to preserve disagreement across reports. Absence of an AI mention is not evidence of no AI use outside the reviewed source.
- Execution location: endpoint, IDE, CLI, WSL, container, CI runner, cloud, remote service, unknown.
- Delivery: recruiter lure, repository content, package install/update, extension, Skill, MCP integration, configuration change, other.
- Objective: credential theft, data theft, persistence, execution, lateral movement, disruption, other/unknown.
- Evidence to seek: native agent records, endpoint telemetry, package provenance, repository/CI records, identity/cloud logs, network records. These suggestions are not collected sensor evidence.
- Tools/platforms/tags: controlled aliases with explicit other text; never conflate similarly named tools.

Date type: publication, source_update, first_reported_activity, incident_execution, discovery, disclosure. Precision: day, month, year, range, unknown. Values use ISO dates at stated precision (YYYY, YYYY-MM, YYYY-MM-DD) or explicit start/end range, with support and uncertainty. Incomplete dates are not converted to invented days. A source's publication timestamp is metadata, not an incident date. Counts state source/case/claim unit, filters, review coverage and snapshot; qualitative comparisons are observations within the collected dataset.

Unmapped reviewed behaviors can later become candidate emerging TTPs with local namespace, provisional name/definition/examples/related techniques. They are not official MITRE techniques and never receive invented AML identifiers.

## Grounding invariants

- GC-01: Use the core evidence, collection and disposition axes above. Preserve legacy distinctions through migration metadata. Do not collapse source observation, attempt, potential consequence and inference into confirmed execution.
- GC-02: Origin identifies official metadata, LLM source paraphrase, inferred mapping/relationship or proposed defensive content. Human approval never erases generation origin. Human-authored variants require a schema migration.
- GC-03: Every accepted substantive claim has a source passage/location or explicit researcher inference with rationale and supporting claims. Inferred mappings require rationale and reviewed claim support. Missing support stays pending or fails validation; never fabricated quotations.
- GC-04: Approval is bound to reviewer identity, entity content hash and dependency revisions. Changed content invalidates approval. Automated checks cannot approve research truth.
- GC-05: Preserve semantic regressions: Deadbugz intent is not confirmed victim theft; Nx ordinary secret scanning is not agent credential access solely because both read secrets; Gambit is a composite playbook.
- GC-06: Framework maturity is taxonomy metadata, not campaign certainty or detection coverage. Admission scores never bypass evidence or review.
- GC-07: Source articles, issue text and model outputs are untrusted data, never executable instructions. Do not run malware, embedded commands or article scripts.
- GC-08: Security telemetry and OTEL are separate entities/views. OTEL does not automatically observe OS file reads. Logical sensor fields are not vendor schema names.
- GC-09: devthreat.* fields are proposed custom attributes. Samples include devthreat.synthetic=true and formatted synthetic trace/span IDs. Logical LogRecord JSON is not OTLP wire format. Stable and Development conventions are distinguished with pinned references.
- GC-10: Detection hypotheses stay Untested until sensor evidence and fixture runs justify a changed validation state. The seed's 300-second window is a proposal, not an empirical threshold.

## Reproducibility

Preserve current IDs. New IDs derive from canonical identity, not random UUIDs, wall-clock timestamps or model text alone. Record collision resolution. Canonical URL removes fragments and known tracking parameters according to versioned rules, not all query parameters; distinct articles must not collide. No automatic campaign merge from URL similarity or embeddings. Canonical serialization: recursively sorted object keys, entity collections sorted by id, semantic node/edge ordering preserved, UTF-8/LF and final newline. A migration may change the baseline digest; explain it. Digest excludes its own field, build wall-clock time and machine paths. Retrieval/review dates are recorded events, unchanged by ordinary rebuilds. Identical inputs/tool versions produce identical bytes.

Acceptance hashes cover content and cited revisions/dependencies. Release manifests record dependency digests. Unknown major schema versions fail closed. Migrations require before/after fixtures. Render source strings safely; reject executable URLs. Fetch success is separate from claim acceptance. CSV represents null as empty value plus corresponding reason column and multi-label values as JSON arrays; document round-trip semantics and spreadsheet formula escaping. Public release eligibility starts in foundation through file/CLI review; later curator UI enhances the same event model rather than redefining approval.
