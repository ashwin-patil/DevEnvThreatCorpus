# Formats and versioning

## Ownership

| Contract | Authoritative implementation |
|---|---|
| Canonical corpus `0.3.0` shape (JSON Schema Draft 2020-12) | [corpus.schema.json](../../schemas/corpus.schema.json) |
| Corresponding static interfaces/enums | [contract.d.ts](../../schemas/contract.d.ts) |
| Runtime shape, relationships, grounding, identities, review eligibility, exports | [contract.mjs](../../scripts/contract.mjs): `validateShape`, `validateCorpus`, `canonicalSerialize`, `reviewEligibleCorpus`, `profileRecords` |
| Manual extraction / human decision inputs | [extract.mjs](../../scripts/extract.mjs), [review.mjs](../../scripts/review.mjs) |
| Annotation sidecar schema and validator | [enrichment.mjs](../../src/enrichment.mjs): `enrichmentSchema`, `validateEnrichment` |
| Campaign request/candidate/run validation | [campaign.mjs](../../src/campaign.mjs); candidate record guide/normalization in [campaign-records.mjs](../../src/campaign-records.mjs) |
| Private archive metadata/readable HTML | [article.mjs](../../src/article.mjs) and contract intake/archive helpers |
| Bundled public input projection | [public-profile.mjs](../../src/public-profile.mjs), separate from generic profile export |

Schema shape alone is insufficient: runtime validation enforces references,
exact retained support, inference/conflict rules and current acceptance.
Type declarations do not run validation. Only corpus `0.3.0` is supported by
profile commands; other versions return `UNSUPPORTED_SCHEMA_VERSION`.
There is no `0.2.0` migration/import compatibility contract.

## Identity and normalization

Single-source intake uses `manual-intake/1`, URL identity `https-tracking/1`,
plain parser `utf8-text/1`, and normalization `unicode-lf-nfc/1`.
Credential-free HTTPS URL identity removes fragments and case-insensitive
`utm_*`, `fbclid`, `gclid` keys, preserving other query parameters and order.
Unsafe/sensitive URLs are rejected, not sanitized into another source.
Successful retrieval derives canonical identity from the final URL and the
explicit article-alias rules in `canonicalArticleUrl`; it can reuse an existing
retained source/revision. This is not arbitrary title/content/similarity merging
and does not establish case membership. Every redirect still passes retrieval
authorization and address checks.

Source and revision identity are distinct. An exact successful rerun reuses its
records without refreshing retrieval dates; changed content under the same
canonical source adds a revision. Standalone changed text is a new source.
`--source-url` associates supplied text with a URL without fetching/authenticating
it. Single-source intake does not infer titles, publisher, author or publication/
activity dates; batch article metadata extraction is a separate bounded path.
Failed collection has no invented content/hash/revision.

Plain text/files require strict UTF-8, preserve a BOM in the raw record/hash,
and reject NUL/empty readable text. Normalization changes CRLF/CR to LF and
applies NFC. HTML retrieval uses **`readable-html/5`**. It tolerates ordinary
mismatched/optional tags, extracts headings/lists/preformatted code and excludes
scripts/style/templates/chrome without executing markup. Earlier `/1`–`/4`
revisions retain their own parser identities; changed parser/normalization
identity must remain distinguishable, not rewrite old revisions.

HTTP charset takes precedence over early HTML meta charset, otherwise UTF-8.
UTF-8/US-ASCII decoding is fatal on malformed bytes; Windows-1252, ISO-8859-1
and Latin-1 declarations use Windows-1252. Returned response bytes have separate
archive hash provenance from decoded raw text and normalized UTF-8 hashes.
HTML NULs survive the raw archive and are replaced only in the parser projection.
Supplied text is not auto-detected as HTML. No renderer, JavaScript execution or
pixel-perfect capture is promised.

## Manual extraction

`manual-extraction/1` is a private JSON object with a nonempty `claims` array.
Each entry names existing case/source/revision, normalized `revisionHash`,
description, evidence status, origin and either exact passages or inference
support. Passage objects include ID, locator, code-point `start`/`end` and text.
Unknown fields, duplicate IDs, bad scope/hash/text/offsets and invalid reciprocal
conflicts/inferences fail without partial writes. New records remain Pending;
no model or review event is created. Exact successful replay is idempotent and
records a success extraction manifest.
See [synthetic template](../../tests/fixtures/extraction/manual.json) and
[CLI exercise](cli.md#manual-extraction).

## Review decisions

`manual-review/1` contains exactly `schemaVersion`, `claimId`, `action`,
`baseDigest`, nonblank `rationale`, and (only for `correct`) nonempty `correction`.
Actions `accept`, `correct`, `exclude` produce `Accepted`, `Needs correction`,
`Excluded`. Reviewer/supplier IDs are ASCII letters/digits/`_`/`.`/`-`,
1–64 characters, starting with a letter/digit.

Corrections may patch only `description`, `passageIds`, `inference`,
`evidenceStatus`, `uncertainty`, `observationContext`, `nullReasons`. They must
change content and pass the full contract; passages already belong to the original
revision. Attribution, origin, conflicts, disposition and history cannot be
patched. A correction creates a new claim revision and requires separate acceptance.

Events preserve ID, supplied human reviewer, UTC timestamp, rationale, entity
revision/content hash, input base digest and dependency hashes. Correction binds
corrected content/dependencies against its input base; later acceptance binds the
resulting base. Repeated successful decisions append distinct events.
Earlier events/history cannot be edited/deleted by the updater. They are not
complete historical claim snapshots or tamper-proof/authenticated storage;
keep protected backups if earlier wording must be reconstructed.
See [freshness rules](data-model.md#review-freshness-and-status-axes).

## Private archives

Batch archives use `<store>/articles/<source-id>/<revision-id>/`:

- `original.html`: returned article, untrusted and download-only.
- `article.txt`: retained normalized readable text.
- `metadata.json`: original/final/canonical URL identity, reported and normalized
  publisher metadata/dates, retrieval time, parser/normalization/hash provenance,
  original response-byte hash and artifact paths.
- `assets.json`: image URL, path/hash and success/failure/skip reason.

Archive metadata is outside canonical `0.3.0`. Confirmed hostname publisher
mappings start with StepSecurity, Socket and Red Canary; unrecognized identity
is not guessed from abbreviations. Image failures remain warnings, not invented
assets or loss of successfully extracted text. URLs/content/archives remain private.

## Private enrichment

`talk-enrichment/1` lives at `<store>/enrichment/annotations.json`, outside core
arrays. Each annotation requires ID, case/source/revision, type, literal `value`,
evidence status, origin (`manual`/`agent`) and lowercase `status: "pending"`.
Agent records require model/prompt versions; `normalizedValue` supplements
rather than replaces the literal. Credential-free HTTP(S) reference links are
not instructions to fetch or execute.

| Type | Required distinction / optional context |
|---|---|
| `role-context` | Overlapping `roles`: victim-side environment/agent abuse, attacker-controlled component/infrastructure, attacker-side AI use, AI review targeting, other/unclear |
| `observed-behavior` | `behavior`: observed/attempted/demonstrated/inferred; optional trust surface/objective |
| `data-sources` | `collection`: article-mentioned/proposed; optional data-source classes |
| `commands-ai-artifacts` | Optional artifact kind (command, executable, argument, prompt, configuration, IDE/CLI, extension, Skill, MCP tool/server); exact literal |
| `traditional-indicators` | Optional indicator kind (domain/IP/URL/hash/path/package/repository/user-agent/workflow/runner/configuration) |
| `ttp-references` | `mapping`: source-mentioned/researcher-proposed; optional framework/version |
| `detection-references` | `detection`: published-reference/untested-suggestion; original literal/link |
| `talk-tags` | Researcher theme and optional notes |

Evidence status is `evidence-backed`, `inference` or `unresolved`; evidence-backed
support must resolve exact retained text. Inferred behavior and proposed
collection/mappings/detections stay inference/unresolved even with an article
citation. Missing/ambiguous text cannot become evidence-backed.
Imports validate links, are idempotent by ID and reject changed-ID collisions.
They cannot accept records, mutate canonical reviews or infer attribution.
Exports refuse existing output files.

## Campaign handoff and runs

Current identities are separate, not interchangeable:

| Identity | Current value |
|---|---|
| Extraction | `campaign-extraction/2` |
| Request / candidate interfaces | `campaign-request/1` / `campaign-candidate/1` |
| Prompt | **`passage-grounded-campaign/4`** |
| Record normalization | `campaign-record-normalization/2` |
| Governance snapshot / new run | `campaign-snapshot/1` / `campaign-run/2` |
| Read-only annotation compatibility projection | `campaign-projection/1` |
| Private case talk export | `campaign-talk-bundle/1` |

Preparation requires an existing case, deduplicates source IDs and defaults to
the last retained normalized revision in each source's ordered list; explicit
revision IDs must belong to selected sources. Unavailable text gets a reason and
no segments, never a refetch. Requests freeze case scope/associations, base/review
digests, citations, parser/normalization/input hashes, segments, prompt text/hash,
catalog snapshot, candidate guide, limitations and selection metadata.

Requested model is advisory. Effective model/version stay null with `unknown`
reasons if the configured chat does not expose them. No runtime provider, model
credential, automatic fallback or endpoint is configured.

Validation recomputes the request against the current corpus, rejects stale or
tampered input and requires exactly one completed/skipped/failed coverage result
per segment. Revision coverage is complete/partial/failed, not semantic completeness.
Claims require exact supplied quotes in completed segments, or explicit
claim-supported inference/rationale. Optional candidate arrays belong at the
**top level**; the guide's `records` property is documentation, not candidate input.
Prompt `/4` distinguishes explicit source framework IDs from grounded proposals.

Apply validates the projected full corpus before atomically adding passages,
Pending claims and optional records to core arrays, with a digest-checked immutable
run under `governance.campaignExtraction`. Frozen claim/passage/record snapshots,
request/response/input hashes, model/prompt/catalog provenance, coverage, absences,
limitations, unresolved mappings and annotations remain bound to the run.
Identical request/response replay is idempotent; changed input yields a new
superseding identity. Invalid closure, collisions, stale/tampered input, concurrent
writes or crashes preserve the previous canonical file within the persistence
boundary. Manual records, review history and enrichment sidecars are not rewritten.

Historical `campaign-run/1` envelopes remain readable/immutable and replayable
only when that matching run was already applied; old unapplied requests must be
prepared again. New `/2` validation checks support/scope and Pending provenance
independently of envelope hashes. Today's catalog does not reinterpret old runs;
legacy missing unresolved metadata is `unavailable`, not retroactively invented.
Read-only `unresolvedMappingAvailability` distinguishes recorded/unavailable
metadata and explicit node scope from broader case/behavior scope.

Protected campaign JSON/Markdown exports close inference/conflict, case/source/
revision/passage, path/behavior/mapping/framework, telemetry/detection/OTEL and
run/catalog/review dependencies. They retain complete revision records, including
private `rawContent` (decoded HTML for HTML sources) and normalized text, and carry
Pending/private/synthetic warnings. Separately archived HTML/image files are not
copied into the bundle; that does not mean raw HTML text is withheld. Presentation-only
talk bundles scope shared behavior occurrences/claims to the selected case and
omit full normalized bodies from revision provenance. Neither is a reviewed
release, selected-path-only campaign export or automatic public publisher.

## Pinned framework references

[framework-catalog.mjs](../../src/framework-catalog.mjs) owns
`pinned-catalog-resolver/2`; requests embed the full pin, membership and digest.
Catalog changes therefore change request/run identity. No runtime catalog fetch
or arbitrary candidate-supplied catalog is trusted.

| Projection | Upstream immutable revision | Material SHA-256 |
|---|---|---|
| ATT&CK 19.2: `T1059` only | `6cda5ad8462c79e14fbb872f4e09059b18e0cfc4` | `dc1639caa5501d720e280cf1cbd8fbe009884a0c9b3e6e9ed9d0c25166c3d8f4` |
| ATLAS 2026.09: checked-in technique/subtechnique projection | `3259f388d19cbcca11bacf12a0ef97f4198f711b` | `935efa93e28294432d3e2f537eb94991ef8d1f8c58341cd360ea3321ddb66688` |

The code and [ATLAS projection](../../src/atlas-catalog.json) retain upstream
URLs, Git blob hashes, retrieval dates and license provenance.
See [ATLAS notice](../licenses/ATLAS-NOTICE.txt) and
[Apache-2.0 text](../licenses/Apache-2.0.txt); ATT&CK's pinned license URL is in
the catalog. Reference data is not incident evidence.

Exact framework/version/technique membership can produce a Proposed mapping and
a separately identified official catalog source. A changed record at its generated
ID fails. Source-mentioned mappings also require the supplied literal/ID in supporting
passage text. Unsupported/unverified literals stay explicit Pending unresolved
records with rationale, applicability and support. Membership alone proves neither
case applicability nor acceptance; node scope must independently validate.

## Profile exports

`contract.mjs export` supports `reviewed` (default) and `draft`. It creates exactly
`schema.json`, `records.jsonl`, `cases.csv`, `sources.csv`, `timelines.csv`,
`manifest.json` in a new directory through a temporary sibling/rename.
The manifest records profile digest, non-manifest file hashes and unit-aware
coverage; it excludes source bodies, review events/rationales and internal staging.

Reviewed selection requires current human claim acceptance and transitive
inference/conflict closure; zero eligible claims yields an empty reviewed profile.
Cases/sources provide dependency context. Optional enrichments can accompany
selected evidence as explicitly unreviewed context without making claims eligible
or blocking core-only exports. If projection removes an entity dependency, its
projected disposition becomes Pending with a warning; canonical acceptance does
not transfer automatically. Full raw/normalized bodies are stripped, but supporting
passage excerpts and revision metadata can remain. Independently review rights
and privacy before sharing.

JSONL rows identify schema/entity type, review status and draft warning. CSV rows
repeat profile/draft warnings, encode arrays/structured dates as JSON, and preserve
null reasons beside empty cells. Formula-leading cells receive a reversible
apostrophe; `parseCsv` supports round trips. Draft markings are not acceptance.
Counts name their units/profile/snapshot, not prevalence or detection coverage.
Queries/bundles use the same profile boundaries and omit private decision events.

## Studio proposals

[studio.mjs](../../src/studio.mjs) keeps drafts separately in browser memory.
Paste is literal `supplied-text`/`utf8-text/1`, not HTML parsing, and rejects
unsafe/malformed inputs or existing canonical URLs rather than overwriting.
Claims need selected exact passages or earlier saved same-case inference support;
referenced support cannot be deleted. Categories and behavior/artifact/technique
candidates are Pending proposals, not official mappings.

- **`manual-extraction/1` download:** only claims for cases/revisions already in
  the loaded base; excludes categories/behaviors and passes through the CLI gate.
- **Private corpus proposal `0.3.0`:** only new authored records and dependency
  context, with `governance.studio.baseDigest` of canonical loaded JSON (not review
  eligibility). `contextCaseIds`/`contextSourceIds` are snapshots, not replacements;
  cases have minimal Pending context without existing summaries/reviews.
  Never replace an existing corpus with this file. Human reconciliation and
  fresh eligibility checks are required.

Blob downloads are local and revoked after activation. Neither browser storage,
automatic upload/persistence nor review acceptance is provided. Save authorized
private downloads before reload/corpus switch; unsaved fields are not durable.
