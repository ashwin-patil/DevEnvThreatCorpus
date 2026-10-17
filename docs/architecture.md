<a id="fresh-start-corpus-architecture"></a>
# System architecture

DevEnvThreatCorpus is an operator-driven research workbench:
**published research → source-linked claims → researcher review and acceptance →
campaign patterns and detection hypotheses**. Collection, drafting, review and
export are separate actions. No runtime model, database, queue, hosted review
service or automatic acceptance is configured.

## Components and responsibilities

The staged manual pipeline is implemented in [stages.mjs](../src/stages.mjs) with
[stage-contract.mjs](../src/stage-contract.mjs) owning its named contracts.
Ground permits source-local claims and literal artifacts; Interpret permits
behavior definitions/occurrences; Relate permits paths and framework mappings.
It uses the existing campaign normalizers, private transaction boundary and HITL
projection rather than another review store. Stage run snapshots coexist with
historical monolithic runs. Stage derivation does not add source coverage.

[stage-comparison.mjs](../src/stage-comparison.mjs) freezes protected baselines,
creates separate candidates and binds comparisons/adjudications/selection by hash.
The browser receives only an inert comparison renderer, not filesystem helpers
or an adoption endpoint. Baseline selection is not acceptance/publication.
Manual handoff is independent of optional model adapters: stage-specific versions
do not reinterpret campaign request/run transport versions.

| Component | Responsibility and implementation |
|---|---|
| Browser workbench | Vanilla local HTML/CSS/ES modules: [app](../src/app.mjs), [model](../src/model.mjs), [rendering](../src/render.mjs), [exploration](../src/explore.mjs). Displays sources, claims, conflicts, paths, typed timelines and proposals; imported text is inert |
| Loopback Node server | [server.mjs](../scripts/server.mjs) serves allowlisted assets and bounded APIs at `127.0.0.1:4173`; explicit store mode enables collection and campaign handoff, not arbitrary filesystem access |
| Contract and intake tooling | [contract.mjs](../scripts/contract.mjs) owns validation, canonical identity/hashes, private persistence, single/batch intake, reviewed/draft exports and queries. Server and CLI share helpers; the server need not spawn a CLI process |
| Extraction tooling | [extract.mjs](../scripts/extract.mjs) applies manual templates and exposes enrichment/campaign commands; [campaign.mjs](../src/campaign.mjs) binds requests, validates untrusted candidates and applies Pending records |
| Human review tooling | [review.mjs](../scripts/review.mjs) retains legacy claim decisions; [hitl.mjs](../src/hitl.mjs) owns item-level review/eligibility and [review-ui.mjs](../src/review-ui.mjs) extends the Workbench; identity is self-attested |
| Private storage | Protected `corpus.json`, article archives, annotation sidecars and operator-held request/candidate/decision/export files. Immutable campaign run snapshots live inside corpus governance, not a database |
| Public views | The bundled [Nx draft projection](../src/data/nx-draft.json), explicit synthetic demos and separately generated profile exports have different withholding/review semantics; none is the private archive |

## Data flow and implementation boundary

1. A researcher deliberately supplies authorized text/files or selects public HTTPS
   URLs. Intake records source identity, exact retained revisions, hashes, parser
   versions and collection outcomes. Batch collection associates successful sources
   with an explicit existing case or new Pending campaign; failures remain failures.
2. Manual extraction uses an explicit existing case and exact revision passages.
   Alternatively, campaign preparation freezes retained input and a versioned
   prompt into a **private request**. The researcher transfers it to their configured
   chat and returns a **private candidate**. Local validation and explicit apply
   check scope, freshness, coverage, exact quotations and dependency closure.
   No repository code contacts a model provider, discovers credentials or silently
   refetches missing text.
3. Claims and optional derived records remain Pending. A human inspects wording,
   evidence, inference and conflicts before recording explicit item decisions.
   Legacy claim events bind the whole non-review base. New HITL events bind the
   selected content/provenance, source evidence and required support revisions.
4. The private Review page records decisions through a bounded same-origin API.
   Other browser projections remain inspect-only. Graph layout,
   article/product/prompt grouping and comparison facets are presentation only.
   They create neither evidence, chronology, attribution nor shared review status.
5. Explicit exports select reviewed or draft material and close dependencies.
   Reviewed profile exports strip full article bodies, passage excerpts and
   annotation content; draft profile behavior is unchanged.
   Campaign talk bundles can contain raw HTML text and normalized private bodies
   and must stay private; separately archived files are not copied into them.
   Neither an export command nor this diagram authorizes public redistribution.

## Trust boundaries

### Item-level local HITL contract (issue #81)

`governance.localReview` is an append-only `local-hitl/1` log in the existing private
corpus transaction. Extraction proposals and campaign run envelopes remain untouched.
Events retain original candidates, extraction metadata, self-attested reviewer,
time, action/reason, guide/checks, item binding, support revision/decision bindings,
patches, provenance corrections and replacement keys. A hash chain detects accidental
history edits; it is not authentication, a signature or protection from a malicious
local filesystem owner. The existing store lock, baseline comparison, file modes,
atomic rename and fsync protect writes. A snapshot CAS rejects stale tabs and
concurrent decisions; no reviewer assignment or shared-user service is added.

Stable review keys are type plus record ID. Nested nodes/edges use path ID plus
their own ID; occurrences use behavior ID plus immutable proposal-array position.
An insertion/reordering is a changed proposal, not a way to inherit acceptance.
Shared campaign definitions have one key; source counts may overlap. Blog and
artifact-category grouping never merge distinct occurrences. Local storage holds
only navigation keys, including a bounded support-return trail; returning after
an explicit support decision restores workload/category/group/source/filter.
Per-tab session storage separately holds the editable self-attested identifier.
Every durable decision records that identifier; neither storage authenticates it.

Dependencies flow from claims to definitions, occurrences/nodes, edges, paths,
mappings and proposal dependencies. Case summaries depend on claims but claims
do not depend on summary acceptance. Definitions do not depend on their optional
telemetry/detections: this avoids inventing a cycle. Relationship evidence and
mapping definitions bind independently. Missing/cyclic support remains blocked.
Conflicts bind content but are not reciprocal acceptance prerequisites. When a
conflicting claim is withheld, the reviewed projection marks `conflictsWithheld`;
it does not represent the remaining assertion as a resolved contradiction.
Content/provenance edits invalidate affected downstream decisions, never unrelated
records. A support's exclusion or re-review changes its decision binding.

Corrections overlay frozen candidates and need separate acceptance. Null-reason
cleanup is validated with the effective corrected record. Simple text/label edits
are allowlisted; structural corrections need exclusion/regeneration. Provenance is
a separate audited action, including human-to-LLM corrections with reason/evidence.
Authorship is never inferred from acceptance/exclusion. Unretained or mismatching
evidence is explained and cannot be replaced with invented quotations.
Private models project effective edits and review state over a copy; curator
transactions and frozen originals retain the canonical corpus. A human-corrected
tool display identity appears consistently in Review, library and campaign/blog
cards while the extracted literal remains visible. Corrected identities do not
automatically merge product groups or source occurrences. Current exclusions are
human-reviewed, not accepted; changed decisions are not current review. Identical
exact passages are displayed once per revision/code-point span, retaining each
passage/direct-support attribution and supporting-record navigation.

`profileRecords(..., 'reviewed')` selects only currently HITL-accepted records.
Framework definitions and source/revision provenance are reference metadata, not
incident approvals. Pending enrichment is withheld. Nested items may be exported
independently as typed review records; parent paths require all their nodes/edges.
Accepted case summaries are independent records; accepted claims can be listed
with minimal `contextOnly: true` case identity rows, not an unaccepted case summary.
Those rows have null review status and cannot imply summary approval. The generated
profile schema validates accepted optional/nested units and redacted annotation
metadata, independently of the importable corpus schema. Reviewed projections are not
round-trippable private corpus/audit backups. Campaign/talk exports remain private
drafts and preserve exclusions and LLM metadata. No publication or operational
detection validation is implied. See the [decision guide](researcher-review-guide.md).

Priority triage is deterministic: tool/prompt/behavior category, exact retained
evidence and no structurally unresolved required support. Pending claims require
their own short human review step. Missing support remains an exception, not
permission to waive acceptance. N/A units are outside label denominators; retained
canonical ranges are unioned across extraction runs and chunk-policy versions.
The denominator is retained canonical code points, not overlapping window counts.
Historical partial counts without positions are disclosed but excluded from that
numerator; known fixed windows and complete historical runs remain locatable.

The explicitly selected `/api/review-demo` exercise uses per-server in-memory
synthetic state and the same decision contract, never the public Nx snapshot or
private store. Reload retains it; restart resets it. Only explicit `--store`
review has filesystem durability. The owner-authorized first pass prioritizes
tools, behaviors/occurrences and prompts; polished advanced-artifact UX and
independent semantic acceptance remain deferred, with pending records withheld.

- **External content → intake:** credential-free public HTTPS only, address and
  redirect checks, DNS pinning, TLS/peer verification, robots policy and finite
  budgets. Access denial is not permission to bypass a site. Supplied-text
  fallback is allowed only with independent authorization to supply and retain it.
- **Private files → local server/browser:** restrictive filesystem permissions,
  validation, exact asset/artifact allowlists, loopback Host/Origin/Fetch-Metadata
  checks and CSP. Original HTML is download-only, never rendered in the application.
  Local users can see private text; do not deploy or publicly tunnel this server.
  Codespaces forwarding must remain Private and needs independent access checks.
- **Retained text → claims:** exact Unicode code-point passage support is checked
  against the named normalized revision, not the current live page. Correspondence
  is not incident truth. Inferences have explicit rationale and supporting claims.
- **Chat/browser draft → canonical corpus:** candidates and proposals are untrusted
  data. Validation is not semantic approval; imports cannot create human acceptance.
  The richer studio proposal is not a replacement corpus or automatic merge format.
- **Recorded decision → eligible acceptance:** hashes and append-only application
  rules do not authenticate a reviewer or make filesystem storage tamper-proof.
  Review status, evidence status and authorship origin stay independent.
- **Private corpus → output:** withholding and profile closure are explicit.
  Review eligibility is not copyright clearance, and draft/synthetic outputs are
  not accepted research or evaluated detection rules.

![Browser workbench and loopback Node server share contract, intake, extraction and review tooling over private files; a researcher manually exchanges requests and candidates with chat, and explicit projections and exports expose selected views.](assets/communication/system-architecture.png)

The component table and numbered flow are the complete text alternative.
The storage symbol means **private files and archives**, not a database dependency.
Server/CLI arrows describe shared tooling and data flow, **not guaranteed subprocess
calls**. Chat handoff crosses an explicit researcher-controlled external boundary;
it is not a runtime model integration. Public projections are narrower views,
not copies of private storage or evidence of research acceptance.
The supplied image bytes/logo are unchanged; see
[asset provenance](assets/communication/system-architecture.provenance.json).

## Authoritative technical references

| Topic | Current authority |
|---|---|
| Core entities, support, status axes and derived presentation | [Data model](reference/data-model.md) |
| Commands, benign executable exercises, errors and recovery | [CLI](reference/cli.md) |
| Schema/type ownership, wire formats, version identities, framework pins, export contracts | [Formats and versioning](reference/formats-and-versioning.md) |
| Startup modes, local APIs, private storage and finite bounds | [Configuration](reference/configuration.md) |
| Research interpretation and maturity | [Methodology](methodology.md), [workflow](workflow.md), [status](status.md) |
| Environment lifecycle and governance policy | [Codespaces guide](guides/codespaces.md), [setup and configuration](setup-and-configuration.md) |

The JSON Schema, TypeScript declarations and runtime validators remain the
implementation authorities; these references explain them, not replace them.

## Decision

The current `0.3.0` corpus starts from newly supplied sources. Frozen `0.2.0`
material in the [archived `handoff/reference/`](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference)
is historical, not an input dataset, migration
seed or compatibility target. The older migration proposal remains preserved,
not revived by the workbench's adapted presentation.

## Current implementation

Default startup has an empty local corpus API but the **browser displays the
bundled public Pending Nx draft**, not an empty screen. Explicit synthetic demos
are separate. `--corpus` is a validated read-only startup snapshot; `--store`
enables dynamic private data and bounded collection/campaign writes. Both
batch collection and reproducible profile exports are implemented.
There is no application install/build step, model adapter or automatic review.
See [configuration](reference/configuration.md#startup-modes).

## Preserved technical entrypoints

These existing headings remain usable for inbound links. Detailed contracts now
have the single authoritative homes below; dated evidence is not current test proof.

## Issue #51 campaign presentation and article identity

See [presentation-only grouping](reference/data-model.md#presentation-only-grouping).

### ATLAS catalog and compact evidence presentation

See [pinned framework references](reference/formats-and-versioning.md#pinned-framework-references).

### Campaign AI artifacts

See [literal artifacts and grouping](reference/data-model.md#presentation-only-grouping).

## Optional research presentation and private annotations

See [optional derived records](reference/data-model.md#optional-derived-records)
and [private enrichment](reference/formats-and-versioning.md#private-enrichment).

## Local Research Workbench and private curator studio

See [startup modes](reference/configuration.md#startup-modes) and
[curator studio](reference/cli.md#curator-studio).

### Comparison and typed timeline model

See [dates and comparison](reference/data-model.md#dates-and-comparison).

### Studio boundary and proposal formats

See [studio proposals](reference/formats-and-versioning.md#studio-proposals).

## Manual intake contract

See [intake commands](reference/cli.md#manual-intake).

### Records, identity, and provenance

See [core entities](reference/data-model.md#core-entities) and
[identity and normalization](reference/formats-and-versioning.md#identity-and-normalization).

### Retrieval trust boundary and finite bounds

See [retrieval and bounds](reference/configuration.md#retrieval-and-bounds).

### Deterministic readable text

See [identity and normalization](reference/formats-and-versioning.md#identity-and-normalization).

### Private persistence and recovery

See [private persistence](reference/configuration.md#private-persistence) and
[recovery](reference/cli.md#errors-and-recovery).

### Evidence and remaining limitations

See [preserved evidence and handoff](#preserved-evidence-and-handoff).

## Manual extraction contract

See [manual extraction](reference/cli.md#manual-extraction) and
[exact passage support](reference/data-model.md#exact-passage-support).

## Manual claim review contract

See [review commands](reference/cli.md#manual-claim-review).

### Correction and append-only audit

See [review decisions](reference/formats-and-versioning.md#review-decisions).

### Current eligibility and status axes

See [review freshness](reference/data-model.md#review-freshness-and-status-axes).

### Failures and trust boundary

See [errors and recovery](reference/cli.md#errors-and-recovery).

## Batch collection and private archives

See [batch commands](reference/cli.md#batch-collection) and
[archive format](reference/formats-and-versioning.md#private-archives).

## Private talk enrichment contract

See [enrichment commands](reference/cli.md#private-enrichment) and
[enrichment format](reference/formats-and-versioning.md#private-enrichment).

## Campaign extraction contract

See [manual chat handoff](reference/cli.md#campaign-requestchatcandidate-handoff)
and [campaign formats](reference/formats-and-versioning.md#campaign-handoff-and-runs).

## Reproducible exports and read-only queries

See [exports and queries](reference/cli.md#exports-and-read-only-queries) and
[profile contracts](reference/formats-and-versioning.md#profile-exports).

## Preserved evidence and handoff

Historical acceptance IDs, tables, dated observations and limitations from the
replaced sections remain in the
[pre-split architecture at merged PR #67](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md).
In particular, preserve its [#31 AC-01–AC-04 table](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md#studio-boundary-and-proposal-formats)
and [#30 AC-01–AC-03 mapping](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md#retrieval-trust-boundary-and-finite-bounds).
The existing [acceptance audit](acceptance-audit.md) retains the #8, #12, #21,
#24, #25, #39, #45, #46 and #51 evidence records.
[Task #63](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/63) owns
evidence/session-note archive navigation and cleanup; this split does not rewrite
acceptance history. Current #62 command results and AC-01–AC-08 review handoff
belong on [PR #68](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/68),
not in the technical contracts. Independent technical, editorial, accessibility,
rendered-document and README-relevance review remain required before human merge.
