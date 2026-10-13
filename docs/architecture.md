# Fresh-start corpus architecture

## Local Research Workbench and private curator studio

`src/index.html`, `src/style.css`, and vanilla ES modules implement the
read-only libraries and client-side curator studio. `node scripts/server.mjs` serves these local assets
and the official SVG logo/favicon with no external CDN or live retrieval.
Without `--corpus` it starts empty; the explicitly selected synthetic demo reads
only the benign 0.3.0 test fixture, not the frozen 0.2.0 reference corpus.
`--corpus /absolute/private/store/corpus.json` uses the existing private-file and
full contract validator before opening the listener. This includes retained
normalized article text; it is a private preview, not a public distribution.

The server binds only `127.0.0.1`, rejects foreign Host/Origin and cross-site
requests, exposes only exact allowlisted assets and read-only corpus endpoints,
and sends no-store, same-origin, and restrictive content-security headers.
There is no directory listing, arbitrary file path API, write endpoint, remote
fetch, or browser storage. Corpus responses are validated startup snapshots;
restart after intake/extraction changes. Local users can inspect the data, so do
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
conservative parser supports user-agent groups, literal path-prefix
Allow/Disallow rules, comments, and ignored informational Sitemap, Host,
Content-Signal, and Clean-param declarations (case-insensitive). These declarations
do not redirect retrieval, rewrite query parameters, or override access rules. Both matching
named and wildcard groups must allow the path; unsupported directives,
wildcards, encoded paths, or ambiguous syntax fail closed rather than ignore
possible restrictions. Authentication/access denials are not retried as
successful content. Robots permission is not a license:
operators must confirm their authorization, article-storage rights, and any
additional site restrictions before supplying a URL. When retrieval is denied,
do not circumvent restrictions; supplied-text fallback is appropriate only for
material the operator is authorized to supply and retain.

Issue [#30](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/30) evidence:
AC-01 maps to the informational-directive intake regression in
[`tests/intake.test.mjs`](../tests/intake.test.mjs); AC-02 maps to its fail-closed
robots tests (denials, wildcard/anchored paths, unsupported crawl delays,
malformed user-agent records, authentication, and cross-origin policy redirects).
AC-03 maps to this guidance, README, CHANGELOG, and final-commit
`python scripts/verify.py` results recorded on the originating PR.
Documentation relevance and accuracy still require independent human review.

### Deterministic readable text

Files and pasted text are strictly decoded UTF-8, preserving an input BOM in
the raw record/hash. Retrieval requires `text/plain; charset=utf-8`,
`text/plain; charset=us-ascii`, or `text/html; charset=utf-8` (case-insensitive).
Missing charset, other media types/encodings, non-ASCII bytes declared ASCII,
compressed content, NUL, malformed UTF-8, and empty readable text fail
explicitly. Supplied files/text are always plain text, not auto-detected HTML.

The conservative `readable-html/1` parser accepts properly nested common
document, paragraph, heading, list, table, and inline tags, optional HTML
doctype, quoted/unquoted attributes, and comments. It discards the head,
script, style, and template bodies and all attributes; nothing is executed.
Unknown tags, mismatched/unclosed tags, malformed comments, or unsupported
entities fail rather than fabricate content. Supported named entities are
`amp`, `lt`, `gt`, `quot`, `apos`, `nbsp`, `ndash`, `mdash`, `hellip`, `copy`, and
`reg`, plus valid decimal/hex Unicode numeric entities. Semicolons are required.
Block boundaries become LF, horizontal whitespace collapses, excess blank
lines collapse, and surrounding whitespace is trimmed before LF/NFC
normalization. This strict subset intentionally rejects some browser-valid
HTML (such as implicitly closed tags); it is neither a browser rendering engine
nor semantic claim extraction. Authorized plain-text fallback is available.

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
discarding events. No existing export path is claimed review-eligible.

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
