# Fresh-start corpus architecture

## Local Research Workbench and private curator studio

`src/index.html`, `src/style.css`, and vanilla ES modules implement the
read-only libraries and client-side curator studio. `node scripts/server.mjs` serves these local assets
and the official SVG logo/favicon with no external CDN.
Without `--corpus` or `--store` it starts empty; the explicitly selected synthetic demo reads
only the benign 0.3.0 test fixture, not the frozen 0.2.0 reference corpus.
`--corpus /absolute/private/store/corpus.json` uses the existing private-file and
full contract validator before opening the listener. This includes retained
normalized article text; it is a private preview, not a public distribution.

The server binds only `127.0.0.1`, rejects foreign Host/Origin and cross-site
requests, exposes only exact allowlisted assets and corpus endpoints,
and sends no-store, same-origin, and restrictive content-security headers.
There is no directory listing or arbitrary file path API. `--corpus` responses
are validated read-only startup snapshots; restart after external changes.
Issue #39's explicit `--store` mode adds bounded same-origin collection writes
and dynamic corpus reload. Network requests run in the Node backend, not the
browser. Collection never accepts annotations or canonical claims.
Local users can inspect the data, so do
not expose the port through tunnels or deploy this server.

Passage positions are half-open Unicode code-point offsets into the *exact*
retained `sourceRevisionId`, not UTF-16 indexes or offsets into the latest source
revision. Overlaps must preserve all linked claims without duplicating text.
Source-grounded assertions and researcher inferences retain separate labels;
inferences show rationale and supporting claims rather than fabricated passages.
Conflict comparison preserves both records, dispositions, and uncertainty, not
a resolution or ranking. Imported content is displayed as text, never executable
markup. Sources remain browsable without a case. Search and facet counts describe
the supplied corpus, not threat prevalence.

Node unit/DOM and server checks are configured in `project.config.json`.
Automated fixture assertions and agent browser exercises do not substitute for
independent human visual inspection at desktop/mobile widths, keyboard review,
research-semantics review, or documentation relevance approval before merge.

### Comparison and typed timeline model

The Issue #25 slice stays inside the existing `src/model.mjs`, `src/render.mjs`,
and `src/app.mjs` modules; it needs no new asset route, runtime, framework, or
policy authorization. `comparisonRecords` applies search AND facets, with
explicit per-facet OR/AND modes. Categorization dimensions are associations at
case scope, not asserted truth about each claim. Evidence status and reviewer
disposition match individual claims; cases with no matching claims are removed
when those claim facets are active. Empty cases can otherwise remain visible.

Source-supported comparison requires a non-inference claim with a retained
passage in its exact revision. Inferences, unavailable text/locator-only support,
and unresolved support remain separately labeled rather than supplying a
comparison conclusion. The view reuses the complete claim renderer, keeps
category assertion origins/dispositions and support links, and retains both
conflict counterparts, including clearly labeled out-of-filter context.
Shared citations connect records only; they never imply common actors,
equivalent behavior, prevalence, or independently established execution.

`dateBounds` derives calendar intervals only for inclusive overlap and sorting;
the stored/displayed precision is untouched. Month ends include leap-year rules.
`recordDates` uses a claim's own source metadata and explicitly supporting
timeline records, whereas cases use associated sources and case timelines.
`comparisonTimeline` shows all selected case timeline assertions plus deduplicated
source metadata, filtered by date type/range. Sorting by earliest possible bound
does not resolve ordering between overlapping intervals. Unknown dates remain
unordered, excluded by bounds unless the explicit unknown-only mode ignores
those bounds. No publication date becomes an inferred incident date.

Counts use distinct case/source IDs and matching claim IDs. Sources and timelines
are labeled as selected case context, which may extend beyond matching claims.
`comparisonCoverage` counts last recorded human events matching entity/revision/
disposition and separately reports dispositions; it deliberately does not
reimplement the CLI's cryptographic current-review/dependency eligibility gate.
The UI warns that recorded events are not current eligibility or independent
approval. `fetchCorpus` hashes the loaded JSON representation using existing
Web Crypto support; this snapshot identifier is not a review-base or profile
digest. Tests and screenshots use synthetic data only.

### Studio boundary and proposal formats

`src/studio.mjs` owns a separate in-memory state, not the loaded model. Direct
paste records literal text/HTML as `supplied-text` with `utf8-text/1` parsing;
it never uses an HTML parser or DOM markup sink. LF/NFC normalization, UTF-8
SHA-256, canonical serialization, and source/revision identities match
`scripts/contract.mjs`, with parity tests. Empty, malformed-surrogate, NUL, and
over-2-MiB text and credential-bearing/non-HTTPS URLs are rejected. Optional
metadata is operator-supplied; missing metadata/dates keep explicit null reasons.
An existing canonical URL is rejected rather than overwriting a retained revision.

Browser Range endpoints are UTF-16 node offsets. `selectedPassage` traverses
the exact displayed text nodes (including nested highlights), resolves each
endpoint within its root, rejects cross-root or surrogate-splitting selections,
and counts Unicode code points in prefixes. It never searches for a quote, so
repeated text and backward selections retain the correct occurrence. Text must
equal the retained normalized revision. A captured selection is bound to its
revision ID and normalized hash and is checked again on save; saving, clearing,
or switching source/revision clears it. Keyboard selection uses the same handler.

The composer creates new pending claims, never edits or accepts existing ones.
Source assertions require exact selected passages; inferences require an explicit
rationale and earlier same-case draft support. Support must be saved first,
preventing self-reference/cycles, and cannot be removed while referenced.
Multi-label categories cite the new claim and its exact source scope. Optional
local behaviors hold `claimIds`, text-only `artifacts`, and `candidateTechniques`
extensions. Candidates may come from the loaded catalog or manually entered IDs;
syntactic ID validation is not verification of an official technique/version.
No official framework records, mappings, or acceptance are invented.

Two explicit downloads serve different purposes:

- `manual-extraction/1` uses the existing exact extraction template contract,
  with revision hashes, generated passage IDs/locators, and grounding. It is
  available only for cases/revisions already in the loaded base; it excludes
  categories and behavior annotations. The CLI remains the application gate,
  including stale-base/review constraints and independent subsequent review.
- The standalone **private corpus proposal** is schema `0.3.0`, with only new
  claims/categories/behaviors and their source/revision/case context. Its
  `governance.studio.baseDigest` is SHA-256 of the canonical loaded corpus,
  not a review-eligibility digest. `contextCaseIds`/`contextSourceIds` identify
  dependency snapshots, not replacement records. Existing cases are minimal
  pending identity context, without summaries or review histories; the base's
  decisions remain untouched. New authored records are pending and the proposal
  has no review events. This download is not a release or an automatic change-set
  applier; never replace a corpus with it. A human must reconcile scoped changes
  against the base, preserving reviews and checking eligibility after edits.

Downloads use local `application/json` Blob URLs, revoked after activation.
No browser storage, uploads, external CDN, runtime model, or write endpoint is
introduced; server CSP and the exact asset allowlist remain enforced. Downloads
contain private retained content and require restricted local storage. Saved
drafts persist across tabs only, with discard warnings on unload/corpus switch;
unsaved form fields are not durable. The [README studio guide](../README.md#curator-studio-paste-select-draft-download)
documents local use and application limitations.

Issue [#31](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/31) evidence:

| Criterion | Durable implementation / executed-check location | Independent review still required |
|---|---|---|
| AC-01 | `src/studio.mjs` `selectedPassage`; `src/render.mjs` source selection; `tests/workbench.test.mjs` tests prefixed `Issue #31 AC-01` cover nested/repeated/multibyte text, backward and invalid boundaries, normalization parity, revision clearing | Visual Unicode selection and keyboard walkthrough |
| AC-02 | `saveDraft`, `extractionProposal`, `corpusProposal`; `Issue #31 AC-02` tests apply exported JSON through `applyExtraction`, `validateShape`, and `assertValid`; `tests/fixtures/extraction/studio-input.json` generates a standalone proposal and checks CLI identity parity | Grounding, context-only records, categories, and candidate semantics |
| AC-03 | Literal HTML and Blob download tests in workbench suite; `tests/server.test.mjs` checks CSP, read-only methods, allowlisted assets, Host/Origin boundaries | Private retention and offline workflow inspection |
| AC-04 | README usage, this architecture/evidence mapping, CHANGELOG; final-commit `python scripts/verify.py` results on the originating PR | Documentation relevance/accuracy and README applicability; human approval before merge |

Exact commands, exit results, full tested SHA, and any browser limitations belong
on the originating PR and must be refreshed after each commit. Automated checks
are not independent subjective approval; overall acceptance remains
`needs-human-review` until those decisions are recorded.

## Decision

The 0.3.0 corpus is built from newly supplied source inputs. Existing 0.2.0
claims and records are not imported, migrated, or used to seed the new corpus.
The frozen prototype under `handoff/reference/` remains available as historical
reference material; it is not an input dataset or a compatibility target for
the new collection pipeline.

This current decision supersedes the migration proposal in the preserved
handoff documents for Issue #1. Those files remain unchanged as product-history
and design references.

## Data flow and implementation boundary

The operator-driven pipeline separates collection from later research:

1. Register a newly supplied URL, text, or text file as a source, recording
   provenance and collection state.
2. Record each retrieved or supplied content version as a source revision with
   raw and normalized hashes and explicit retention metadata.
3. Manually enter claims supported by exact passages and locators, or record
   explicit researcher inferences with their supporting claims.
4. Associate sources and claims with explicitly selected cases without inferring
   attribution from shared sources or similar URLs.
5. Add supported categorizations and timelines, preserving uncertainty,
   conflicts, date precision, and the distinction between publication and
   activity.
6. Review proposed claims through the local file/CLI workflow; acceptance requires
   current human review and matching content/dependency hashes.

Steps 1–4 and claim review in step 6 have operator-triggered implementations.
The studio can draft supported categorizations; applying richer proposals,
creating timelines, and reviewing non-claim entities remain subsequent work.

## Current implementation

The repository supplies the 0.3.0 JSON Schema, corresponding TypeScript declarations,
offline structural and relationship validation, deterministic identity and
serialization utilities, manual source intake and template-based claim
extraction, manual claim review, and visibly synthetic positive/negative fixtures. Tests exercise
these contracts and offline behaviors; they are not processed blog records.

Collection and extraction do not approve claims. Local review records
self-attested reviewer identity, not authenticated identity. Hosted review/UI,
public release exports, and deployment remain follow-up work. No legacy migration command,
migration fixture, or migration-only schema field is part of this design.

## Manual intake contract

The entrypoint is `scripts/contract.mjs intake text|file|url`. Each invocation
requires an explicit absolute `--store` directory and `--supplied-by` attribution.
The supplier is a 1–64 character operator identifier: ASCII letters/digits,
`_`, `.`, or `-`, starting with a letter/digit (not a display name with spaces).
Text uses `--text`; a UTF-8 file uses an absolute `--file`; retrieval uses
`--url`. The [README exercise](../README.md#manual-intake-offline-exercise)
provides executable commands, including local record inspection and validation.
There is no batch, discovery, crawling, scheduling, local application server,
model adapter, or automatic case creation.

### Records, identity, and provenance

The private store contains `corpus.json`, canonical 0.3.0 JSON validated before
commit. It uses the existing `sources`, `sourceRevisions`, and
`collectionManifests` collections, not a parallel intake schema. Raw and
normalized content are retained in revision fields with `retention: private`,
raw/normalized SHA-256 hashes, normalization/parser versions, and provenance.
No passage, claim, case, categorization, timeline, acceptance, or review event
is generated. Existing unrelated records must survive updates.

URL identity uses `https-tracking/1`: require credential-free HTTPS, remove
fragments and case-insensitive `utm_*`, `fbclid`, and `gclid` keys, and preserve
all other query parameters and their order. Meaningful query differences stay
distinct. Similar paths, redirect destinations, matching titles, or matching
content never merge different URL sources or create cases. Unsafe URLs and
sensitive query parameters are rejected, not rewritten into a different source.
Do not supply signed URLs or URLs carrying secrets.

Source identity is separate from revision identity. Exact successful reruns
reuse existing source/revision/success-manifest records without refreshing
retrieval dates. Changed content under a canonical source URL adds a linked
revision and retains prior content. Without a URL, the supplied content
determines identity; changed standalone text is a new source, since intake
cannot establish that two different texts represent the same article.
Text and file inputs may carry `--source-url` to establish an explicitly
supplied URL association or fallback without fetching it. That association
is an operator statement, not proof of the article's identity or authenticity.

Text-only sources have null original/canonical URLs with field-specific reasons,
and supplied-text provenance with the required supplier. Titles, publishers,
authors, and publication/update dates remain null with reasons: this slice
does not infer metadata from page titles, hostnames, file names, or text.
Successful URL retrieval records a retrieval day, not a publication, update,
or activity date. Manifest limitations record the retrieval/collection event
and tool/rules/failure information without raw URLs, query values, file paths,
or content. Failed requests must never invent hashes or retained revisions.

### Retrieval trust boundary and finite bounds

Retrieval is HTTPS only with normal TLS certificate/hostname verification.
Every initial and redirect URL is validated before use; every resolved address
must be allowed before connecting. DNS resolution is pinned for the request
and the connected peer must match the checked address, preventing a second
resolution or redirect from bypassing address validation. IPv4/IPv6 private,
loopback, link-local, reserved, multicast, documentation, and transition
destinations are prohibited. No browser, article script, shell command,
credentials, cookies, authentication, or paywall bypass is used.

Defaults are **2 MiB per body**, **20 seconds per source**, and **at most two
retries** (three attempts total), and **three redirects per request chain**,
including access-policy retrieval. The byte limit is enforced while streaming
regardless of missing or misleading Content-Length;
the exact limit is allowed. DNS, access-policy checks, redirects, retries, and
streaming remain within the deadline. A single CLI call processes one explicit
input, so there is no unbounded batch. Failure codes distinguish inaccessible,
timeout, oversized, unsupported, and normalization failures.
The same 2 MiB byte limit applies to pasted UTF-8 text and text files.

The fetcher checks `robots.txt` using `DevEnvThreatCorpusIntake/1` and fails closed
when access policy cannot be safely established. A missing policy (404/410)
allows retrieval; a policy redirect to another origin is rejected. The
parser supports user-agent groups, wildcard and end-anchored
Allow/Disallow rules, comments, and ignored informational Sitemap, Host,
Content-Signal, and Clean-param declarations (case-insensitive). These declarations
do not redirect retrieval, rewrite query parameters, or override access rules.
Issue #39 replaces the earlier restrictive wildcard subset with compatible
path matching; explicit access denials remain authoritative.
Authentication/access denials are not retried as
successful content. Robots permission is not a license:
operators must confirm their authorization, article-storage rights, and any
additional site restrictions before supplying a URL. When retrieval is denied,
do not circumvent restrictions; supplied-text fallback is appropriate only for
material the operator is authorized to supply and retain.

Issue [#30](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/30) evidence:
AC-01 maps to the informational-directive intake regression in
[`tests/intake.test.mjs`](../tests/intake.test.mjs); AC-02 maps to its fail-closed
robots tests (denials, wildcard/anchored paths,
malformed user-agent records, authentication, and cross-origin policy redirects).
AC-03 maps to this guidance, README, CHANGELOG, and final-commit
`python scripts/verify.py` results recorded on the originating PR.
Documentation relevance and accuracy still require independent human review.

### Deterministic readable text

Files and pasted text are strictly decoded UTF-8, preserving an input BOM in
the raw record/hash. Public article retrieval supports HTML/plain text with
optional charset declarations and bounded common compression; absent charset
uses UTF-8. Unsupported encodings, NUL, malformed text, and empty readable
content fail explicitly. Limits apply after decompression as well as to the
network response. HTTP charset takes precedence over an early HTML meta charset;
otherwise UTF-8 is used. Explicit UTF-8 and US-ASCII use fatal decoding;
Windows-1252, ISO-8859-1, and Latin-1 declarations use Windows-1252 decoding,
with returned bytes retained separately from decoded text/hash provenance.
Supplied files/text remain plain text, not auto-detected HTML.

Issue #39 replaces the strict `readable-html/1` subset with a small tolerant
article parser. It tolerates ordinary optional/mismatched closing tags,
extracts body/article text without executing markup, and preserves headings,
list boundaries, preformatted code, and command text. Script, style, template,
and non-article chrome are not research content. Metadata and body image
references are separate from extracted text. This is not a browser renderer,
pixel-perfect capture, or semantic claim extractor. Sources requiring
JavaScript, authentication, paywall, or anti-bot bypass remain unsupported;
authorized supplied-text fallback remains available.

The retained normalized string uses `unicode-lf-nfc/1`: CRLF/CR become LF and
Unicode is NFC-normalized. A separately versioned parser identifies HTML
handling rules. Hashes cover raw UTF-8 bytes and normalized UTF-8 text. Future
passages must use Unicode code-point, end-exclusive offsets anchored to the
retained normalized text and revision hash, not HTML byte offsets. A different
normalization/parser version must produce a distinguishable revision.

### Private persistence and recovery

Within the clone, retain only under the ignored `.private-intake/` directory;
alternatively supply an absolute private directory outside the clone.
The whole corpus file is private, not just its revision content. Do not commit,
upload as an Actions artifact, publish in future exports, or copy it into docs.
Git ignore is an accident-prevention mechanism, not encryption or a release
allowlist. Set appropriate filesystem permissions, backup/access policies, and
retention/deletion rules; never use a shared/public folder.

Intake rejects traversal and symlink destinations, uses private directory/file
permissions, serializes writers, and replaces the validated corpus atomically.
Unrelated files and earlier revisions must not be overwritten on error.
Invalid existing state, unsafe paths, or write failures cause non-success
without changing the prior corpus. A storage failure may prevent recording
its own manifest; the CLI still exits nonzero and must not claim persistence.
Do not remove a writer lock while another process may still own it.

Recoverable input/retrieval failures record `outcome: Failed` manifests with safe
codes and no success revision. Inspect these locally and correct the input or
use authorized text/file fallback with supplier provenance. Fallback appends
a separate successful event; it neither erases the failed attempt nor claims
the URL was fetched. Distinct failed attempts retain distinct event identities;
only exact successful reruns are deduplicated, not evidence of repeated failure.
CLI diagnostics do not print article content or URL values;
the private source records still contain supplied URLs, so protect the store.

### Evidence and remaining limitations

`tests/intake.test.mjs` uses benign fixtures and injected transports/resolvers,
not live sites or model credentials. `project.config.json` runs that suite and
the existing contract suite through `python scripts/verify.py`. There is no
configured lint/build command. Executed CLI fixtures and automated address
tests do not replace independent human review of the fetch boundary, private
retention, README applicability, or documentation accuracy.

The AC-01–AC-10 and scoped FND mapping is in
[Acceptance audit](acceptance-audit.md#issue-8-manual-intake-and-revisions).
No optional live probe is necessary or claimed. Human approval is required
before merge; source collection does not approve research truth.

## Manual extraction contract

The operator-triggered entrypoint is `scripts/extract.mjs --template
<absolute-file> --supplied-by <operator-id> --store <absolute-private-dir>`.
The store must already contain a valid 0.3.0 `corpus.json` with the referenced
sources, retained revisions, and cases. The template must be a private UTF-8
JSON file with `schemaVersion: "manual-extraction/1"` and a nonempty `claims`
array. It is researcher input, not executable content. The committed example
`tests/fixtures/extraction/manual.json` uses only the synthetic base fixture.

Every claim names its case, source, source revision, and exact normalized
revision hash. A source-grounded claim also supplies passage IDs, locators,
text, and zero-based half-open Unicode code-point offsets; extraction checks
that the supplied text equals the corresponding slice of retained normalized
content before creating a passage. Wrong source/revision/hash, absent retained
content, fabricated text, invalid offsets, unknown fields, and duplicate IDs
fail without persisting partial records. The existing validator then checks
relationships, null states, inference support/cycles, and reciprocal
same-case conflicts.

Claims and cases are never auto-created or merged. Each claim links to exactly
one explicitly named case; a case may link several sources and a source may be
explicitly linked to several cases. A source association is added to the named
case when a claim explicitly refers to it. Inference records require the
`Researcher inference` status, `Human inference` origin, rationale, and
supporting claim IDs; they have no passages and remain distinct from
source-grounded claims. Contradictory records stay separate. All new claims
remain `Pending`; no review, acceptance, ranking, resolution, or model adapter
is provided.

The CLI writes through the existing private-store lock, validation, restrictive
permissions, and atomic replacement helpers. Exact successful template reruns
are idempotent. It reports JSON success/failure with a nonzero exit on failure;
invalid input leaves the previous corpus unchanged. It records an extraction
manifest for success only. No network, model, credentials, or adapter is used.
An operator must assess source authorization, retention rights, research
semantics, and case identity independently.

The extraction contract and AC-01–AC-07 evidence mapping for Issue #12 are in
[Acceptance audit](acceptance-audit.md#issue-12-manual-claim-extraction-and-case-linking).

## Manual claim review contract

`scripts/review.mjs` supports three local commands:

- `status --file <absolute-private-corpus>` reports the normalized `baseDigest`
  and each claim's recorded/effective disposition, acceptance eligibility,
  staleness, origin, evidence status, and ordered event history.
- `validate --file <absolute-private-corpus>` validates the full 0.3.0 contract
  using effective dispositions and lists eligible accepted and stale claim IDs.
  Success does not mean all claims are accepted, nor that their assertions are true.
- `decide --template <absolute-private-file> --store <absolute-private-dir>
  --reviewer <human-id>` applies one explicit human decision atomically.

The decision is a private UTF-8 JSON object with exactly `schemaVersion:
"manual-review/1"`, `claimId`, `action`, `baseDigest`, `rationale`, and, only for
`correct`, a nonempty `correction` object. Actions map to `Accepted`,
`Needs correction`, and `Excluded`. The reviewer identifier follows the intake
supplier's ASCII 1–64-character format; rationale must contain nonblank text.
The researcher must supply their actual identity and justification: no default,
agent-generated attribution, authenticated identity provider, or automatic approval
exists. Review text is data, not instructions or executable content.

### Correction and append-only audit

Corrections may patch `description`, `passageIds`, `inference`, `evidenceStatus`,
`uncertainty`, `observationContext`, and `nullReasons`. They must change content
and satisfy the existing complete 0.3.0 contract, including grounded passages,
inference classification/support, and field-specific null reasons. Passage IDs
must refer to already recorded passages of the original revision. Corrections
cannot change claim/case/source/revision attribution, origin, reciprocal conflict
links, disposition, or history. No evidence, case, source, or conflict is
automatically created or resolved. A corrected claim receives a new revision,
`Needs correction`, and requires a separate explicit acceptance of its new base.

Every event records a unique ID, actual supplied reviewer, human reviewer kind,
UTC timestamp, rationale, claim ID/revision/content hash, the input base digest,
and dependency hashes keyed by source, exact revision, passage, supporting or
conflicting claim, and case scope. Hashes include dependency revisions and
normalization/parser metadata through the existing contract helpers. A correction
event hashes the corrected content/dependencies against its *input* base;
subsequent acceptance binds the resulting base. Earlier event objects and ordered
history IDs survive subsequent corrections, exclusions, and re-review. Events
retain prior decisions/hashes, not complete historical claim snapshots; protect
private backups if full prior wording must be reconstructed.

Review writes reuse the private-store writer lock, mode-0700 directory,
mode-0600 single-link files, symlink/traversal restrictions, validated atomic
replacement, and optimistic persistence check. Within the clone use only
`.private-intake/`; external stores must be absolute private paths. Decision
files share the existing 2 MiB strict UTF-8 input limit. Successful repeated
decisions append distinct events; they are not silently deduplicated.
The updater rejects modifications/deletions of existing events. This is a local
application invariant, not tamper-proof storage: a filesystem owner can edit the
file directly. No repository-write credential or network operation is involved.

### Current eligibility and status axes

`reviewEligibleCorpus` produces a copy: an accepted record is effectively pending
unless its latest event matches the entity, human reviewer, revision, disposition,
content, dependencies, and normalized base. Accepted inference/summary/category/
timeline records also require currently accepted supporting claims, transitively.
Malformed evidence, missing references, invalid timestamps, and agent acceptance
still fail validation; eligibility does not repair invalid corpus content.
Status/validation do not write or erase recorded dispositions/events.
A successful decision persists these pending dispositions alongside its new event
so the result also passes strict validation.

The existing `reviewBaseDigest` removes review events and normalizes reviewable
dispositions/history and case collection lifecycle. Thus decisions alone do not
invalidate other decisions, but **any non-review base change**, even unrelated
content or a newly linked source revision, conservatively invalidates acceptance.
The source dependency binds all linked revisions, not just one latest revision.
Re-read status and explicitly re-review after changes; never transplant old hashes.
Strict `contract.mjs validate`, intake/extraction, and the unchanged read-only
workbench remain fail-closed on stale accepted records. Review-aware commands
allow valid stale records to be inspected and explicitly re-reviewed without
discarding events.

Collection lifecycle is not updated by claim decisions: `Reviewed` never means
all claims are `Accepted`. Claim disposition, evidence status, and origin remain
independent. Human acceptance/correction/exclusion never rewrites LLM/authorship
origin. Intake/extraction remain pending-only and cannot create review acceptance.

### Failures and trust boundary

All commands emit JSON and exit zero only on success. `INVALID_INPUT` denotes
invalid command/flag combinations; `INVALID_REVIEW` covers malformed decisions,
invalid reviewer/rationale, no-op/forbidden corrections, contract violations,
and acceptance without eligible inference support. `UNKNOWN_CLAIM` names an
unknown proposal; `STALE_BASE` rejects a mismatched expected digest.
`INVALID_CORPUS`, `UNSAFE_PATH`, `STORE_BUSY`, `TOO_LARGE`, `MALFORMED_TEXT`,
and `PERSISTENCE` retain the existing private-file/storage meanings.
Invalid decisions and unknown claims leave canonical corpus bytes unchanged.
Diagnostics may contain contract errors; keep them private.
As with intake, a post-rename filesystem durability/lock-release failure can
report `PERSISTENCE` even after replacement; inspect the event history before
retrying rather than assuming no event was written. Never delete an active lock.

The validator can establish that records have the required shape and that
references and supplied hashes are internally consistent. A reviewer name and
hash in a record do not authenticate a person or prove research truth.
Authenticated review and release controls remain future work. The
[README exercise](../README.md#manual-claim-review-offline-exercise) demonstrates
the supported local workflow. `tests/review.test.mjs` executes focused positive
and negative checks; independent human workflow and documentation review on
the originating PR is required before merge.

## Batch collection and private archives

Issue #39 wraps source intake in one shared sequential batch helper, used by
the `intake batch` CLI and explicit store-mode web POST. Each batch supplies
1–20 public HTTPS URLs, an operator identifier, and exactly one existing case
ID or new pending campaign name. Only successfully collected revisions enter
the explicitly selected case's `sourceIds`. Input deduplication and existing
source/revision identities prevent duplicate links; changed content remains
a new revision. A failed URL does not roll back another source, and a shared
source does not merge campaigns or establish attribution.

Network work retains public-address checks, DNS pinning, TLS verification,
peer-address verification, redirect checks, robots policy, and request budgets.
Article body images use the same boundary; relative and supported lazy URLs
are resolved against the final article URL. Initial image limits are 20
images, 5 MiB per image, and 50 MiB total per article; callers may configure
lower bounds. There is no recursive link crawl or download of arbitrary page
assets. Failed/denied/oversized assets remain manifest warnings without
discarding extracted text.

Private artifacts live in `<store>/articles/<source-id>/<revision-id>/`.
`original.html` retains the returned article, `article.txt` its normalized text,
`metadata.json` original/final URL, canonical identity, extracted and normalized
publisher metadata, reported dates, retrieval time, parser/hash provenance
(`readable-html/2`, `unicode-lf-nfc/1`), original response-byte hash,
and artifact paths. `assets.json` records image URL, local path, hash, and
success/failure/skip reason. The editable hostname map starts with confirmed
StepSecurity, Socket, and Red Canary domains; unrecognized publisher identity
is never guessed from an abbreviation. Extra archive metadata stays outside
the canonical 0.3.0 schema.

Original HTML is untrusted and is not placed in a DOM, iframe, or application
markup sink. Archive APIs accept allowlisted artifact names and source/revision
identifiers, not filesystem paths; downloads are octet-stream attachments with
sandbox/no-resource CSP. Extracted text remains the default source view.
Private-store locking, restrictive permissions, path checks, and atomic
canonical persistence remain in force. The entire nested store is Git-ignored.
Article commands, prompts, configurations, and images are evidence, not
instructions to execute.

Store-mode web collection requires exact same-origin Host/Origin matching,
JSON content, bounded request bytes and body time, and one active write at a
time. It refreshes corpus data without a restart. Read-only `--corpus` mode is
unchanged. Case citation rendering/downloads include every linked source and
preserve missing metadata rather than fabricating it.

## Private talk enrichment contract

`src/enrichment.mjs` exports the versioned `talk-enrichment/1` JSON schema and
validator; `scripts/extract.mjs enrichment template|validate|import|export`
provides the private CLI. Sidecars remain outside the core 0.3.0 schema and
are stored in `<store>/enrichment/annotations.json`, with mode-0700 directories
and mode-0600 files. Documents are bounded to 2 MiB and 20 annotations.
Import is idempotent by annotation ID; a changed value under the same ID is
a collision rather than silent replacement. Exports refuse existing outputs.

Each item requires `id`, `caseId`, `sourceId`, `sourceRevisionId`, `type`,
`value`, `evidenceStatus`, `origin` (`manual` or `agent`), and `status: "pending"`.
Optional `normalizedValue` supplements, never replaces, the literal `value`.
Agent items also require `modelVersion` and `promptVersion`. An optional
`externalReferenceUrl` is a credential-free HTTP(S) reference, never a request
to fetch or execute its contents.

| Type | Context fields and research distinction |
|---|---|
| `role-context` | Required overlapping `roles`: victim-side environment/agent abuse, attacker-controlled component/infrastructure, attacker-side AI use, AI review targeting, other/unclear |
| `observed-behavior` | Required `behavior`: observed, attempted, demonstrated, or inferred; optional `trustSurface` and `objective` |
| `data-sources` | Required `collection`: article-mentioned or proposed; optional `dataSources` covers endpoint, process, network, DNS, identity, repository, package, agent/IDE, GitHub Actions, CI/CD, cloud |
| `commands-ai-artifacts` | Optional `artifactKind` distinguishes command, executable, flag/argument, prompt/instruction, agent configuration, IDE/CLI, extension, Skill, MCP tool/server; preserve exact text |
| `traditional-indicators` | Optional `indicatorKind` distinguishes domain, IP, URL, hash, file path, package/repository, user agent, workflow/action ref, runner, configuration |
| `ttp-references` | Required `mapping`: source-mentioned or researcher-proposed; optional `framework` and `frameworkVersion`; no forced mapping |
| `detection-references` | Required `detection`: published-reference or untested-suggestion; preserve original link and literal rule/query/tool/advisory/guideline text |
| `talk-tags` | Researcher-defined themes in `value` and optional `context.notes` |

`evidenceStatus` is `evidence-backed`, `inference`, or `unresolved`. Evidence
support is `{ "quote": "exact retained text", "locator": { "start": 0, "end": 19 } }`,
where offsets are half-open Unicode code points in the named retained revision,
not bytes or UTF-16 positions. A unique exact quote can resolve without offsets;
a repeated quote needs an exact locator or remains explicitly unresolved.
Unretained, missing, ambiguous, or unsupported assertions cannot be imported
as evidence-backed. Inferred behavior and researcher-proposed collection,
mappings, or detections remain inference/unresolved even when an article is
cited. Case/source/revision links must exist and agree.

Template placeholders are explicitly inference, not source facts. Imports
cannot accept annotations, mutate canonical claims/reviews, run a model,
infer case attribution, or establish maliciousness. Collection itself changes
the canonical review base, so earlier acceptance may become stale under the
existing review contract; independent human review is still required.

## Reproducible exports and read-only queries

Issue #24 adds `export`, `list`, `get`, and `bundle` to the already authorized
`scripts/contract.mjs` entrypoint. They read an explicitly supplied, locally
stored 0.3.0 corpus and perform no network retrieval, ingestion, write-back, or
model calls. Only schema 0.3.0 is currently supported; other versions fail with
`UNSUPPORTED_SCHEMA_VERSION`.

`export --file <private-corpus> --profile reviewed|draft --out <new-directory>`
creates exactly `schema.json`, `records.jsonl`, `cases.csv`, `sources.csv`,
`timelines.csv`, and `manifest.json`. It refuses an existing destination, writes
to a temporary sibling, and renames the completed allowlisted artifact. The
manifest contains the selected-profile digest, file hashes (excluding its own
hash), profile, and unit-aware review coverage. It does not contain source text,
review events/rationales, staging, internal scripts, or credentials.

The reviewed profile accepts only claims with a current human acceptance and
dependency closure; conflicting or inference-support claims must also be
currently accepted. Cases and sources are included only as context/dependency
records for selected material. Applicable optional enrichments may accompany
that evidence as separate, explicitly unreviewed context; they never make a
claim eligible or block a core-only export. If projection removes a reviewable
entity dependency, the exported view shows it as pending and warns that the
canonical acceptance does not apply to the projected entity. Supporting passage
excerpts and revision metadata remain available, while full `rawContent` and
`normalizedContent` are removed. A zero-eligible corpus yields an empty reviewed
profile. Draft output is visibly marked on every typed record and in the
manifest; it is not an eligible reviewed release. Review coverage and exported
counts state their units (cases, sources, claims, categorizations, timelines),
profile, optional-enrichment counts, and snapshot; they do not imply prevalence,
attribution, or detection coverage.

JSONL rows identify `schemaVersion`, `entityType`, `entity`, review status, and
draft warnings. CSV columns are stable, and each row repeats the profile and
draft warning so an individual table cannot silently lose draft status. Null
values produce empty cells and their field-specific reason is retained in the
`nullReasons` JSON column.
Arrays and structured dates are JSON-valued cells, preserving multi-label
values and day/month/year/range/unknown precision. Cells beginning with a
spreadsheet formula marker receive a reversible leading apostrophe; `parseCsv`
supports the corresponding round trip. The contract and fixture tests cover
unknown/null values, multi-labels, approximate dates, and formula-like text.

`list --file <private-corpus> --entity cases|sources|claims` returns bounded,
typed results (default limit 100; maximum 1,000); `get` requires an entity and
ID; `bundle --case <case-id>` resolves selected claims, supporting/conflicting
claims, citations, passages, source revisions, categories, timelines, and
non-private review status without revealing decision events. Unknown IDs and
invalid entity kinds return structured nonzero failures. All query operations
are read-only; corpus values remain untrusted data, never executable input.
The [README exercise](../README.md#corpus-exports-and-read-only-queries-offline-exercise)
uses only synthetic fixtures. `tests/exports.test.mjs` covers deterministic
profiles, current/stale/excluded acceptance, dependency closure, CSV round trips,
private snapshot exclusion, and query behavior. Its end-to-end CLI test is
skipped on Windows because the existing private-file checks require POSIX mode
permissions; the platform limitation is not an application-test pass.

Acceptance remains `needs-human-review` for independent review of output
usability, documentation relevance, and the exported evidence boundary.
