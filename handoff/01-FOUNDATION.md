# PRD 01 — Manual source collection and corpus foundation

Version 1.1 · 12 October 2026 · Draft for implementation issues.

## Purpose and product boundary

Turn given article URLs or supplied text into reviewed, source-linked research records. Sources, cases and claims remain separate; uncertainty and conflicting reports survive normalization. This merges the supplied **DevEnvCorpus — Lightweight PRD** with the previous reproducible-build requirements.

The initial pipeline is operator-triggered and manual: **add source → extract draft → categorize → review → link to case → export**. Extraction can be manual or optionally model-assisted, but runtime LLM access is not required. No scheduled discovery, GitHub Actions ingestion, unattended crawling or automated approval in this phase. Actions may run ordinary schema/build tests later without being an ingestion service.

Attack paths, framework mappings, emerging TTPs, detection hypotheses and telemetry enrichment are optional later modules. A useful reviewed case must be collectible without any of them. Existing prototype enrichments remain legacy drafts, not prerequisites or automatically accepted research.

## Users and workflows

- Researcher: supply article/text, inspect supporting passages, correct extracted fields, retain disagreement and group reports under a case.
- Practitioner: find reported behaviors and evidence to seek, while preserving attempt/observation/possible consequence distinctions.
- Research agent: consume reviewed records and propose enrichment with citations; no acceptance authority.

Foundation includes CLI/file-based review. Side-by-side review UI follows in the UI/curation phases. Comparison/timelines get a data contract and exports here; interactive comparison follows after collection works.

## Required modules

Core: sources, cases, claims, categorizations, timelines, review events, intake/run manifests and governance. Optional enrichment: behaviors, paths, framework techniques, mappings, telemetry, detections and OTEL. See SHARED-CONTRACT.md for fields/enums and state semantics.

## Requirements

### Baseline compatibility and reproducible tooling

- FND-01: Versioned migration from reference/library preserves IDs, source links, evidence states, origins and limits. campaigns → cases and evidence → claims are explicit aliases/migrations. Imported claims stay review pending; missing passages/author/dates remain null with reason, never fabricated. Legacy enrichment is optional and retains original references. Do not run historical migration scripts.
- FND-02: Provide build/check/start and documented intake/extract/review/query commands. Build emits a selected-profile corpus JSON/JSONL, schema and manifest; future website assets join the explicit dist allowlist. No full website prerequisite for the first issue.
- FND-03: JSONL records contain schemaVersion, entityType and entity; add CSV views for cases, sources and timelines. Document null/reason encoding, multi-label fields and export profiles. Counts describe unit, filters and review coverage.
- FND-04: Schema plus referential checks enforce unique IDs, source/case/claim links, passage membership and revision, categorization support, date precision/type, dispositions and eligibility. Validate path/framework references only when optional enrichment exists. A core-only case passes without paths or techniques.
- FND-05: Read-only CLI list/get/bundle works for cases/sources/claims. Bundle includes all source records, cited passages, categories, timeline/review context and digest; include applicable optional enrichments and framework documentation if present. Unknown entity fails nonzero. Reviewed-only default; explicit draft profile retains warnings.
- FND-06: Source modules are editable truth, exports generated. Keep retained input/snapshots in a private explicit location. Addition/removal checks dependency closure; published IDs are retired, not silently reused. Do not edit generated exports as canonical input.
- FND-07: Pin supported Node LTS and lockfile. Validation offline against benign fixtures. Stable IDs/canonical serialization yield byte-identical builds; no fresh timestamps on rebuild. Do not hardcode all records to one review status.

### Manual intake and passage-grounded extraction

- FND-08: Accept a user-given HTTPS URL, UTF-8 pasted text or text file. Record original/canonical URL, input kind, supplied-by provenance, title/publisher/author where known, publication/update/retrieval dates, raw/normalized content hashes and extraction status. Text-only sources are valid with URL null and explicit reason. A manual batch lists explicit inputs and bounds; no discovery or scheduling.
- FND-09: Intake is bounded (default 2 MiB/source, 20s URL timeout, two retries). Validate redirects/network destinations; do not fetch private/reserved networks or execute scripts/commands. Report inaccessible, oversized, unsupported or failed extraction with recoverable status. Allow supplied text fallback. Respect access restrictions and article-storage rights.
- FND-10: Separate input registration, retrieval, extraction and review. Manual extraction uses schema-valid records; optional model adapter records actual provider/model, prompt/version and input/output hashes. Without a model, the pipeline still works. Model output never approves content.
- FND-11: Every substantive accepted claim has an exact supporting passage/locator anchored to a source revision, or explicit researcher-inference classification with cited supporting claim IDs and rationale. Potential consequences are not confirmed outcomes. Store extraction provenance and uncertainty. If input cannot establish a field, set null plus reason.
- FND-12: Cases can have multiple sources; one source can support multiple cases. Suggest duplicate sources/related cases; uncertain case merges require reviewer decision and retained aliases/lineage. Same campaign across several articles must not inflate case counts. Exact duplicate inputs are idempotent; changed content becomes a new source revision.
- FND-13: Preserve contradictory claims as distinct records with conflictsWith/relation references. Do not synthesize agreement or shared attribution automatically. Summaries cite supporting claims and identify unresolved disagreement.

### Categorization and temporal data

- FND-14: Multi-label trust surfaces and AI involvement are independent dimensions. Attacker-side AI is a role, never a trust surface. Every categorization assertion links supporting claim IDs and review status; negative/no-AI label is bounded to reviewed sources, not ecosystem truth.
- FND-15: Record execution locations, delivery mechanisms, reported objectives, tools/platforms, tags and evidence-to-seek categories. Controlled values plus documented other value supported; unknown/not reported/not applicable distinguished. Evidence-to-seek proposals are labeled analyst/LLM suggestions, not telemetry availability guarantees.
- FND-16: Timeline entries retain date type, precision, date/range, basis, claim/source references and uncertainty. Publication/update, activity, incident/execution, discovery and disclosure remain distinct. Month/year/range values valid. Never substitute publication date for incident date. Unknown event dates remain unknown and do not create fabricated ordering.

### Review, exports and evaluation

- FND-17: Collection lifecycle: Collected → Extracted — review pending → Reviewed, with Needs correction/Excluded branches. Per-claim reviewer disposition remains separate: Pending, Accepted, Needs correction, Excluded. Reviewed is not automatically Accepted. Decisions record actual reviewer, rationale, timestamp, content/dependency hashes; edits invalidate acceptance. Intake/extraction cannot create accepted claims.
- FND-18: CLI/file review can accept/correct/exclude claim proposals against a base digest with append-only history. Source fetch success and official metadata authenticity do not approve claims. Case linking/summary review separate from claim acceptance. Export accepted claims with supporting dependencies; clearly label draft exports.
- FND-19: Timeline/category CSV and JSONL schema validation use a small varied benign fixture set covering victim-side agent abuse, attacker-side AI use, AI review targeting and conventional developer attacks. Include conflicting sources, text-only intake, missing dates, duplicate report and unsupported field fixtures. Do not invent source-backed cases to satisfy a fixture quota: synthetic fixtures visibly marked.
- FND-20: Counts report cases vs sources vs claims, active filters, accepted/pending/excluded coverage and dataset snapshot. Qualitative comparisons are labeled observations within the collected dataset; no prevalence, measured detection coverage or attribution claims.

## Acceptance criteria

| ID | Expected behavior |
|---|---|
| FND-A1 | Migration preserves the 5 legacy record IDs, 23 claim IDs and source references; optional 5 paths/8 behaviors/210 framework entries retained without becoming mandatory or reviewed |
| FND-A2 | Identical inputs/tool versions yield identical bytes/digest; filesystem mtimes irrelevant |
| FND-A3 | Duplicate IDs, missing source/case, wrong-revision passage, dangling categories and invalid dates fail with entity-specific errors; core-only case succeeds |
| FND-A4 | Unknown CLI entity fails; case bundle resolves every source/passage/dependency, including optional framework documentation |
| FND-A5 | GC-05 semantic regressions pass; seed/model output never automatically accepted |
| FND-A6 | Public dist excludes staging, raw full articles, credentials, internal scripts/private review data |
| FND-A7 | Given URL and supplied text register valid source records; inaccessible URL yields explicit failure and allows text fallback |
| FND-A8 | Every accepted substantive claim has passage support or explicit inference basis/citations; unmatched passage/unsupported field rejected or retained pending/unknown |
| FND-A9 | Unknown/not reported/not applicable distinguishable in JSON and CSV; omitted dates/authors never guessed |
| FND-A10 | Two sources can share one case and one source can link two cases; duplicate article rerun creates no extra case; uncertain merge needs review |
| FND-A11 | Conflicting claims survive export separately; multi-label categories retain supporting claims; attacker-side AI absent from trust-surface enum |
| FND-A12 | Publication vs activity dates differ correctly; month/year/range preserved; missing activity date not backfilled from publication |
| FND-A13 | Reviewer acceptance records hash/identity/rationale; edited accepted claim/dependency returns pending and drops out of reviewed export |
| FND-A14 | JSONL/CSV exports validate and declare unit/profile/coverage; draft extraction absent from reviewed default |
| FND-A15 | Offline varied fixtures pass; optional live/model integration checks separately reported; pipeline works without model credentials |

## Issue sequence

Implement small issues in order, not all FND requirements in one change:

1. **Foundation data contracts and core-only validation** — ISSUE-001-FOUNDATION-CONTRACT.md.
2. Manual URL/text intake, revisions and failure reporting — FND-08/09/12 intake aspects.
3. Passage-linked extraction and optional model provenance — FND-10/11/13.
4. File/CLI review and acceptance eligibility — FND-17/18.
5. Reproducible JSONL/CSV/query exports and fixture evaluation — FND-02/03/05/19/20.

Cross-cutting FND-06/07 apply throughout. Issue 1 does not claim the complete foundation phase passes. Each issue lists its own gates; full phase completion requires all criteria.

## Non-goals and follow-on stages

No exhaustive coverage, ecosystem prevalence, validated detection coverage, incident replay or authoritative attribution. No attack command execution. Comparison UI/timelines follow collection; reviewed TTP mapping, emerging local TTPs, paths and detection/telemetry enrichment follow comparison. GitHub Actions ingestion remains deferred to PRD 04.
