# Fresh-start corpus architecture

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
6. Submit proposed records for a future review workflow; acceptance requires
   current human review and matching content/dependency hashes.

Steps 1–4 have operator-triggered implementations. Steps 5–6 remain subsequent
work.

## Current implementation

The repository supplies the 0.3.0 JSON Schema, corresponding TypeScript declarations,
offline structural and relationship validation, deterministic identity and
serialization utilities, manual source intake and template-based claim
extraction, and visibly synthetic positive/negative fixtures. Tests exercise
these contracts and offline behaviors; they are not processed blog records.

Collection and extraction do not persist authenticated reviewer identity,
provide review operations or UI, generate exports, or deploy the pipeline.
Those are follow-up implementation work. No legacy migration command,
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
Allow/Disallow rules, comments, and ignored Sitemap declarations. Both matching
named and wildcard groups must allow the path; unsupported directives,
wildcards, encoded paths, or ambiguous syntax fail closed rather than ignore
possible restrictions. Authentication/access denials are not retried as
successful content. Robots permission is not a license:
operators must confirm their authorization, article-storage rights, and any
additional site restrictions before supplying a URL. When retrieval is denied,
do not circumvent restrictions; supplied-text fallback is appropriate only for
material the operator is authorized to supply and retain.

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

## Review and trust boundary

The validator can establish that records have the required shape and that
references and supplied hashes are internally consistent. A reviewer name and
hash in a record do not authenticate a person or prove research truth.
Authenticated review, append-only persistence, and release controls belong to
the future application/storage workflow.
