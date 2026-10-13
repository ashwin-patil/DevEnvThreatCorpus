# Campaign extraction and enrichment

Status: Draft for human scope/provider review; implementation issue not yet published.
Prepared: 2026-10-13. Inspected base: `a03fb8a` (merged PRs #40 and #42).
Proposed implementation issue title: `[Task] Extract passage-grounded campaign drafts from retained articles`.

## Problem and outcome

Batch intake retains articles and explicitly associates sources with cases. It does
not extract claims or populate behaviors, paths, framework mappings, telemetry,
detections, or OTEL. The old library was pre-authored; assembling it is not an
extraction engine. Researchers need a repeatable workflow that turns retained
text into validated pending research records and usable private talk bundles.

The smallest complete slice is **prepare -> agent-assisted extract -> validate ->
apply -> inspect/export** for one explicitly selected existing case. CLI and the
local workbench share the same preparation, validation, and persistence logic.
The workbench's `Enrich campaign` action prepares a private extraction request;
the researcher brings it to the current Codex chat, then imports the returned
candidate file through that action. Explain these two steps in the UI. Do not
present preparation as completed extraction or imply an unattended model call.

This document is also the proposed self-contained implementation issue body:
dependencies, scope, exclusions, stable criteria, and definition of done below
must survive publication. Assign one issue number before runtime implementation
and use one originating PR. The documentation branch is local preparation only.

## Dependencies and inspected integration points

- PRs #40/#42 are merged. Preserve their collection/archive/history behavior.
- `scripts/extract.mjs` already validates manual claim templates against exact
  retained revisions and persists through the private-store lock/update helpers.
  Its inference path currently requires `Human inference`; do not mislabel model
  synthesis as human authorship merely to fit that contract.
- `src/enrichment.mjs` provides pending `talk-enrichment/1` annotations, exact
  quote resolution, overlapping roles, literal artifacts, and private persistence.
  It lacks complete run metadata, canonical claim links, and explicit conflicts.
- `scripts/server.mjs`, `src/studio.mjs`, `src/explore.mjs`, and existing model,
  view, comparison, and export helpers provide the integration surface.
- Core 0.3.0 already defines optional behavior/path/framework/mapping/telemetry/
  detection/OTEL entities. Validate generated records and reference closure rather
  than relaxing that contract. Use additive versioned private run/candidate
  envelopes; keep manual-extraction/1 and talk-enrichment/1 readable unchanged.
- Stay in already mapped application paths (`scripts/extract.mjs`,
  `scripts/server.mjs`, `scripts/contract.mjs`, `src/**`, existing schema/types).
  A new application surface needs the documented prerequisite policy process.
- A pinned, provenance-validated framework catalog is required for resolved
  candidates. Legacy framework metadata is a lead, not sufficient verification.
  In particular, ATT&CK's legacy `Page checked 2026-10-11` label is not a release
  version. Missing catalog coverage must produce unresolved candidates.

## Provider and model choice

Proposed first-slice provider: the researcher's existing Codex chat, using its
configured model. The repository orchestrates local files and validates output;
it adds no API client, credentials, paid integration, background service, or
model selection override. Agent output is untrusted candidate data. This choice
requires a researcher handoff between preparation and import; an unattended
one-click extraction service is a separate provider decision.

Record provider/entrypoint, requested model, effective model/version when
available, extraction version, prompt version and hash, request/response hashes,
input snapshot digest, and run identity. Never invent an effective model version:
record a null plus `unknown` when the entrypoint cannot expose it. Define the new
envelope to support that honestly; retain existing sidecar requirements for
agent annotations with known model metadata. Any future runtime integration
requires an explicit provider/data-transfer/credential/cost decision before
introducing it. Never silently fall back to another model or remote endpoint.

## Scope and workflow

### 1. Freeze the extraction request

Require an existing case ID; enumerate all its associated sources, deduplicate
source/revision inputs, and explicitly select retained revisions. Default to the
last retained revision in each source's revision list, recording the selection
policy; optional older revisions must be explicitly named. Report missing or
unretained sources instead of silently omitting them. Preparation changes no
association, case identity, or review state.

Freeze base digest, case/source/revision IDs, normalized hashes, parser and
normalization versions. Hash-check retained normalized content before use.
Deterministically segment whole texts into bounded passages with code-point
start/end positions; overlap/context is permitted but must not duplicate claims.
Include source citations and extraction instructions in an ignored private
request bundle. Process all segments and report completed/skipped/failed coverage
per revision; never truncate an article without a visible limitation.

### 2. Extract candidates with source-specific support

Treat article prose, code, prompts, and linked content as data, never instructions
for the extractor. The model returns literal quotations and supplied passage
references; local code derives offsets and verifies exact equality. Do not trust
model-calculated offsets. Disambiguate repeated quotations using segment context
and an explicit occurrence; unresolved ambiguity cannot become evidence-backed.

Produce atomic claims, their supporting passages, and explicit uncertainty or
null reasons. Separate source-reported observations, attempts, demonstrations,
potential consequences, inferences, and disputed reports. Preserve source and
revision identity for every assertion. Cross-source synthesis cites supporting
claim IDs, retains conflicts, and never fabricates chronology or attribution.

Capture overlapping victim-side environment/agent abuse, attacker-controlled
components/infrastructure, attacker-side AI use, and AI review targeting.
Capture exact commands, flags, prompts/instructions, IDE/CLI/extension/Skill/MCP
names/configurations, domains/IPs/URLs/hashes/paths/user agents, package/repository
identifiers, workflows/actions/runner/configuration artifacts. Normalize into a
separate value without replacing literals or executing anything. State absent
information as not reported; do not interpret absence as proof of no AI use.

### 3. Build grounded enrichment

Normalize local behavior definitions and link each case occurrence to its claims.
Build representative paths only where reports support relationships. Distinguish
source-supported sequence from inferred/conditional relationships and keep node
and edge support explicit. An unordered supported behavior set is a valid output
when the articles do not establish a path; do not require a fabricated graph.

Resolve ATLAS/ATT&CK candidate IDs by exact membership in a pinned local catalog.
Catalog metadata includes official upstream source, immutable revision/release,
framework version, digest, retrieval provenance, and license. Keep authoritative
catalog records separate from incident evidence and version the resolver. Each
mapping includes exact supporting claim IDs, behavior link, rationale,
applicability, source-mentioned versus researcher-proposed origin, and Proposed
status. Unsupported, out-of-catalog, or ambiguous mappings remain explicitly
unresolved; local behaviors need no forced mapping. If a source mentions a
technique that fails catalog validation, preserve that literal source statement
without registering it as a resolved technique. Validate reused legacy metadata
against official pinned data before enabling it; do not invent release labels.

Keep article-mentioned data sources and published detection rules/tools/advisories/
guidelines separate from proposed sensors and detection hypotheses. Preserve
published references and literal queries with supporting claims. Do not follow
links automatically. A linked detection's content is not verified unless retained
as a separately associated source and extracted through the same workflow.

Reuse only individually audited legacy behavior/sensor/detection/OTEL templates,
with template version/hash and provenance. Generated sensors, hypotheses, joins,
and instrumentation remain proposals; OTEL examples use inert synthetic values
and carry `LLM synthetic fixture; not incident evidence`/sample-origin labels.
No executable commands or real credentials/IOCs in synthetic samples. Do not
claim these sensors were deployed or validated in the incident.

### 4. Validate, persist, inspect, and export

Create a versioned private candidate/run bundle linking every generated record
to run metadata, input revisions/hashes, claims/passages, and uncertainty/conflict
records. Validate the complete dependency closure before applying. New records
are pending, mappings Proposed, and no human attestation/review is generated.
Honor the existing review-base invalidation semantics and show stale prior
reviews where applicable; never silently delete or rewrite review history.

Keep one authoritative atomic validated snapshot containing all related outputs;
derive read-only compatibility projections for the existing views and sidecar
export. Use the private-store lock and atomic publication boundary so crashes,
invalid records, stale input, or concurrent writes cannot leave claims without
their enrichment. Do not introduce several independent writes and call them a
transaction. Preserve manual records, prior accepted content, and other cases.
Reject changed content under an existing ID; identical replay is idempotent.
Changed source/provider/prompt/catalog snapshots produce a new run, preserving
earlier records with explicit supersession instead of silently replacing them.

CLI exposes prepare/validate/apply/status/export operations under the existing
extraction entrypoint. The same-origin loopback workbench uses the same helpers
for prepare/import, displays coverage/limitations/pending state and errors, and
links records to exact source passages and complete campaign citations. Private
JSON/Markdown talk exports include all selected dependency-closed draft records,
run/catalog provenance and conspicuous proposal/synthetic labels. Export remains
an explicit private action and does not imply a reviewed release.

## Initial evaluation set

The existing temporary WSL `Local-live-verification` case has these retained
sources (metadata inspected; extraction accuracy has not yet been evaluated):

| Report | Retained normalized code points | SHA-256 |
|---|---:|---|
| StepSecurity: s1ngularity / Nx compromise | 34,085 | `40365a366c3b84b99356a23be3ffaab56883915f4daaa3b8337434f47ac4fb1f` |
| Nx: S1ngularity postmortem | 8,741 | `9cc9cc4e7dbc722e3deb93df887724ca14246bfbf3aab5b601a9100284e7bcde` |
| StepSecurity: Shai-Hulud / compromised npm packages | 13,131 | `5f6e16efd4014400e64c65079d2d42b0ddc53145bf3200c4e6e4e08e3bd291ed` |

This is an evaluation grouping, not an assertion that all three describe one
campaign. Preserve its explicit association and flag mixed scope; report
source-local observations without conflating Shai-Hulud and s1ngularity. Do not
create, merge, or relabel cases automatically. Treat the temporary store as
non-durable: establish a protected evaluation copy before mutation, verify hashes,
and preserve the intake baseline. If unavailable, report that limitation rather
than treating a refetch as the same revision. Raw text/images and evaluation
outputs remain private; only synthetic fixtures and safe evidence summaries
belong in Git/issue/PR.

Before extraction, a human creates a private gold checklist covering the relevant
commands/prompts/tools, artifacts, behaviors, roles, relationships, conflicts,
and published detection references in these texts. A category with no reported
item receives an explicit absence entry. Freeze that checklist and hashes for
the evaluation; measure coverage against it, not against the model's own answer.

## Exclusions

No intake redesign, re-fetch/crawl, image OCR, archive migration, new hosted
service/runtime model adapter, credentials, scheduled job, autonomous acceptance,
review-policy weakening, automatic campaign identity/attribution, framework
invention, executable incident replay, or bulk import of legacy incident claims.
No changes to merged PRs #40/#42. No public corpus/talk publication or merge.
No automatic fetch/execute of URLs, scripts, packages, MCP tools, or embedded
article instructions. Catalog provenance validation is bounded reference work,
not an expansion into arbitrary remote enrichment.

## Stable acceptance criteria

| ID | Observable outcome | Verification and evidence |
|---|---|---|
| AC-01 | CLI and Enrich campaign prepare the same frozen existing-case request; all retained selected revisions/segments are accounted for; duplicates and unavailable text are explicit; case count/associations stay unchanged. | Automated synthetic preparation/CLI/server tests; private real-set coverage report and human grouping review. |
| AC-02 | Provider and model metadata are honest; versioned prompts/runs are reproducible and bounded; preparation/import make no runtime model/network call; embedded instructions cannot alter orchestration. | Adapter-free request tests, hostile synthetic article fixture, missing-model null-reason test; human inspection of prompt/provider disclosure. |
| AC-03 | Every evidence-backed claim/artifact resolves to the named revision/hash and exact code-point quote range; Unicode, repeated quotes, tampering, stale hashes and ambiguity fail safely. | Synthetic Unicode/repetition/offset/hash cases; programmatic equality check over every supported real-set record plus human semantic review. |
| AC-04 | Atomic pending claims and overlapping role/artifact categories retain exact literals, separate normalized values, inference support, null reasons and reciprocal conflicts; no invented dates/identity/attribution. | Candidate validation/reference/conflict tests; private gold-checklist comparison and human review of every factual claim, recording all omissions/errors. |
| AC-05 | Behavior occurrences and available path relationships link to exact supporting claims; unsupported chronology is absent or marked inference; local behaviors can stay unmapped. | Graph/reference tests including unordered-only output; human relationship and cross-source semantics review. |
| AC-06 | Resolved mappings exist in a provenance-validated pinned official catalog; candidates include framework/version, rationale, applicability, claim support and Proposed status; invalid IDs remain unresolved. | Catalog hash/membership/version tests, empty/no-match fixture, invalid source-mentioned ID fixture; human rationale review. |
| AC-07 | Published detection references and reported data sources stay distinct from proposed sensors/hypotheses; template provenance survives; OTEL samples are visibly synthetic and inert. | Synthetic source/proposal fixtures, unsafe sample rejection, export tests; human label and gold-checklist review. |
| AC-08 | Validated application is atomic, private and idempotent; stale/concurrent/invalid/crashed operations leave the prior authoritative state usable; manual records/review history persist and review staleness is accurate. | Lock/crash/stale-input/collision/replay/isolation tests, private-path/symlink/size tests, no-review-mutation assertions, Git-ignore checks. |
| AC-09 | Existing views show grounded pending behaviors/paths/mappings/telemetry/OTEL and exact passages; private JSON/Markdown exports retain citations, support closure, limitations, run/catalog metadata and synthetic labels. | Model/workbench/server/export regressions; human browser review at desktop/mobile widths and both themes, escaped hostile content and literal artifact inspection. |
| AC-10 | Three retained revisions receive explicit complete/partial/failed coverage; all gold-checklist items are correctly extracted or explicitly unresolved with reason; all evidence quotes validate; semantic discrepancies are resolved or visible before any talk use. | Private frozen gold/evaluation bundles and hashes; safe aggregate counts/results in acceptance audit/PR; independent human research review (agent self-review insufficient). |
| AC-11 | Existing manual extraction, sidecars, intake/history, review, comparisons and exports pass fresh checks; relevant usage/architecture/audit/CHANGELOG updates describe actual implemented behavior. | `python scripts/verify.py` plus configured Node suites on final full SHA; hosted Verify/PR Policy links, criterion-to-file/test evidence, independent human documentation review. |

Criteria IDs remain stable when wording is clarified. Missing live evaluation or
human review is an unmet criterion, not a passing test or a reason to weaken it.

## Definition of done and implementation order

Human reviews this concrete scope and provider proposal; publish one originating
implementation issue before coding. Implement a vertical synthetic slice through
prepare/validate/atomic apply/export first, then wire the workbench and optional
research projections, then run the protected real evaluation. These are steps
within one issue/PR, not permission to omit criteria or call preparation alone an
extraction engine. Estimate effort after resolving implementation details; no
earlier advisory time estimate is a stopping condition.

Use the configured Node/Python versions and pinned governance dependencies.
Run `python scripts/verify.py` (which executes all configured application commands)
in a POSIX-capable environment for private permissions/paths. Native Windows
limitations must be reported. Record exact commands, counts, final tested SHA,
catalog/prompt/extraction versions, and durable safe evidence links. Keep real
evaluation bundles/logs/screenshots protected and Git-ignored. Update README for
new usage, architecture, acceptance audit, and substantive CHANGELOG; add a
learning only if implementation yields one useful to future work.

Open one draft implementation PR linked to that issue when authorized to publish.
Hosted verification and independent human research/documentation/UX review are
required before merge; no agent-generated Accepted state or self-audit substitutes
for them. Publication and merge require the user's authorization. Current draft
does not claim implemented functionality or fresh application verification.
