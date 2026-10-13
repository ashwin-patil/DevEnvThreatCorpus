<p align="center">
  <img src="docs/assets/logo.svg" alt="DevEnvThreatCorpus Logo" width="540">
</p>

<p align="center">
  <strong>Evidence-grounded threat intelligence · Attack paths · Telemetry</strong>
</p>

<p align="center">
  <a href=".github/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0_%2F_CC--BY--4.0-blue.svg" alt="License"></a>
  <a href="scripts/.node-version"><img src="https://img.shields.io/badge/Node-22.23.3-green.svg" alt="Node version"></a>
  <a href="schemas/corpus.schema.json"><img src="https://img.shields.io/badge/Schema-0.3.0-orange.svg" alt="Schema version"></a>
</p>

---

# DevEnvThreatCorpus

DevEnvThreatCorpus is building a human-reviewed corpus for research on
developer-environment threats. The current work provides the data contract,
offline validation, operator-triggered source intake, researcher-triggered
manual claim extraction, local human claim review, and reproducible
reviewed/draft exports with read-only queries for a new corpus.
The private review CLI records append-only decisions and checks current
acceptance eligibility; local reviewer identity is self-attested, not authenticated.

## Current implementation

The 0.3.0 contract models sources and their revisions, passages, cases, claims,
categorization, timelines, and review events. Its validator checks schema shape
and relationships between records, including evidence references, content
hashes, date precision, conflicts, and review dependencies. Canonical
serialization and identity helpers support deterministic record comparison.
Manual HTTPS URL, UTF-8 text, and UTF-8 file intake persist private source
revisions and explicit success/failure manifests using that same contract. The
offline manual extraction CLI adds pending, passage-grounded claims and case
associations from a researcher-completed template; it does not accept or review
claims.
The separate manual review CLI accepts, corrects, or excludes explicit claims;
its status/validation commands distinguish recorded acceptance from current eligibility.

The local Research Workbench displays fresh 0.3.0 cases, sources, exact
revision passages, and claims locally, with search, facets, and explicit conflict
comparison. Its curator studio adds in-memory article intake, passage selection,
and pending claim/behavior proposal downloads. It never writes to the loaded
corpus, accepts claims, or adjudicates research.

The new corpus starts from newly supplied source material. Existing 0.2.0
claims are not migrated, copied, or used to seed it. The frozen 0.2.0 material
under `handoff/` is retained as historical and design reference only.

**No live blogs or legacy records are used in the offline exercise or tests.**
Fixtures are visibly synthetic, not incident evidence. Retrieval success does
not establish research truth or human acceptance.

## Manual intake: offline exercise

Run these Bash commands from the clone with the pinned Node runtime. All
repository paths below are absolute; adjust `R` to your clone location.
The explicit private store is ignored by Git and must never be published.

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/exercise"
umask 077
mkdir -p "$S"
node "$R/scripts/contract.mjs" intake text --text 'Synthetic intake exercise; not incident evidence.' --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" intake file --file "$R/tests/fixtures/intake/benign.txt" --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" validate --file "$S/corpus.json"
# Inspect only locally: this file includes retained article content.
node --input-type=module -e 'import fs from "node:fs"; const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(JSON.stringify({sources:c.sources,revisions:c.sourceRevisions,manifests:c.collectionManifests},null,2));' "$S/corpus.json"
# The identical rerun must add no sources, revisions, or success manifests.
node "$R/scripts/contract.mjs" intake file --file "$R/tests/fixtures/intake/benign.txt" --supplied-by operator --store "$S"
# Expected nonzero exit and a retained Failed manifest; no network request.
node "$R/scripts/contract.mjs" intake url --url http://example.org/offline-fixture --supplied-by operator --store "$S"
# Supplied-text fallback is a separate, attributed event; it performs no fetch.
node "$R/scripts/contract.mjs" intake file --file "$R/tests/fixtures/intake/benign.txt" --source-url https://example.org/offline-fixture --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" validate --file "$S/corpus.json"
```

The invalid HTTP input demonstrates failure-history preservation, not
same-source recovery: it is rejected before source registration. The fallback
explicitly associates supplied content with its HTTPS URL. Offline transport
tests separately exercise inaccessible valid-HTTPS requests and same-source
fallback without contacting a website.

To request a real public HTTPS source deliberately, replace the fixture URL:

```bash
node "$R/scripts/contract.mjs" intake url --url https://example.org/article --supplied-by operator --store "$S"
```

That command uses the network; it is not part of the offline exercise.
The robots parser ignores informational `Sitemap:`, `Host:`, `Content-Signal:`,
and `Clean-param:` declarations without changing the requested URL or access
rules. Denials, wildcard (`*`, `$`) Allow/Disallow paths, unsupported crawl
delays, malformed user-agent records, and cross-origin robots redirects still
fail closed. Robots permission does not replace operator authorization or
article-storage rights.
See [intake rules and limitations](docs/architecture.md#manual-intake-contract)
for access policy, supported encodings/HTML, identity, bounds, safe retention,
and failure handling. Do not pass credentials or confidential text on a shared
command line; use a permission-restricted UTF-8 file instead.

## Manual extraction: offline exercise

Extraction reads an existing valid private `corpus.json` and an explicit
researcher-completed JSON template. It never retrieves sources, calls a model,
creates cases, merges cases, or accepts claims. The committed example and base
corpus below are synthetic test data only:

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/extraction-exercise"
umask 077
mkdir -p "$S"
cp "$R/tests/fixtures/benign/core-only.json" "$S/corpus.json"
cp "$R/tests/fixtures/extraction/manual.json" "$S/template.json"
chmod 600 "$S/corpus.json" "$S/template.json"
node "$R/scripts/extract.mjs" --template "$S/template.json" --supplied-by operator --store "$S"
node "$R/scripts/contract.mjs" validate --file "$S/corpus.json"
# Repeating the exact template is idempotent.
node "$R/scripts/extract.mjs" --template "$S/template.json" --supplied-by operator --store "$S"
```

For research input, set `schemaVersion` to `manual-extraction/1` and provide a
`claims` array. Each claim names an existing `caseId`,
`sourceId`, `sourceRevisionId`, and the revision's exact `normalizedHash`, plus
its description, evidence status, origin, and a researcher-assigned ID.
Source-grounded claims include passage records with IDs, locators, zero-based
half-open Unicode code-point offsets, and passage text that exactly matches the
retained normalized revision. Inference claims instead set `evidenceStatus` to
`Researcher inference`, `origin` to `Human inference`, and provide an
`inference` object with rationale and supporting claim IDs. Conflict links must
be reciprocal in the template. See `tests/fixtures/extraction/manual.json` for
the complete synthetic format. Use an explicit existing case; the CLI never
infers case identity from sources or content.

The template and private store must be absolute local paths with restrictive
permissions. Success and failure are JSON outcomes; invalid templates leave the
corpus unchanged. A successful extraction records a manifest and leaves claims
`Pending`. This operation does not establish source truth, reviewer identity,
acceptance, or conflict resolution. See [manual extraction rules and
limitations](docs/architecture.md#manual-extraction-contract).

## Manual claim review: offline exercise

Review is an explicit human operation, not an intake/extraction side effect.
Use the synthetic fixture only to exercise commands; it is not incident evidence:

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/review-exercise"
umask 077
mkdir -p "$S"
cp "$R/tests/fixtures/benign/core-only.json" "$S/corpus.json"
cp "$R/tests/fixtures/review/accept.json" "$S/decision.json"
chmod 600 "$S/corpus.json" "$S/decision.json"
node "$R/scripts/review.mjs" status --file "$S/corpus.json" > "$S/status.json"
# Copy the current base digest into the synthetic decision, not a cached approval.
node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));d.baseDigest=JSON.parse(fs.readFileSync(process.argv[2],"utf8")).baseDigest;fs.writeFileSync(process.argv[1],JSON.stringify(d,null,2)+"\n");' "$S/decision.json" "$S/status.json"
node "$R/scripts/review.mjs" decide --template "$S/decision.json" --store "$S" --reviewer synthetic-human-reviewer
node "$R/scripts/review.mjs" status --file "$S/corpus.json"
node "$R/scripts/review.mjs" validate --file "$S/corpus.json"
```

For real review, inspect the claim and its exact cited passages first; supply
your own reviewer identifier (1–64 ASCII letters/digits, `_`, `.`, `-`, starting
with a letter/digit) and substantive rationale. Do not use the fixture's identity
or rationale as actual research approval. The template requires
`schemaVersion: "manual-review/1"`, `claimId`, `baseDigest`, `rationale`, and
`action: "accept"`, `"correct"`, or `"exclude"`.

To correct, edit the private decision to set `"action": "correct"` and add, for
example, `"correction": {"description": "Corrected claim wording"}`. The claim
becomes `Needs correction` with a new revision and event, never automatically
accepted. To exclude, set `"action": "exclude"` and remove `correction`.
Accept/exclude cannot include a correction. After changing content, rerun
`status` and copy the new `baseDigest` before a separate accept decision.
Decisions may revisit existing dispositions; each successful invocation appends
an event, including repeated decisions, rather than deduplicating human actions.

Review-aware `status` and `validate` are read-only and report only current
acceptance: stale recorded acceptance is effectively `Pending`. Strict
`contract.mjs validate` and the unchanged workbench reject stale acceptance.
Unknown claims, stale bases, invalid corrections, blank rationale, malformed
templates, unsafe paths, and concurrent writers exit nonzero without modifying
the corpus. See [review semantics and failure codes](docs/architecture.md#manual-claim-review-contract)
for audit, correction-field, identity, and storage limitations.

## Corpus exports and read-only queries: offline exercise

Exports use a private local corpus file and never fetch or ingest a source.
Reviewed output contains only currently accepted claims and their accepted
claim-dependency closure; with no eligible claims it produces a valid empty
reviewed profile. Draft output is separately labeled and warns that its records
are not an eligible reviewed release. Both omit full article snapshots and
review-event history. Output directories must not already exist.

```bash
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
S="$R/.private-intake/export-exercise"
umask 077
mkdir -p "$S"
cp "$R/tests/fixtures/benign/core-only.json" "$S/corpus.json"
chmod 600 "$S/corpus.json"
node "$R/scripts/contract.mjs" export --file "$S/corpus.json" --profile reviewed --out "$S/reviewed"
node "$R/scripts/contract.mjs" export --file "$S/corpus.json" --profile draft --out "$S/draft"
node "$R/scripts/contract.mjs" list --file "$S/corpus.json" --profile draft --entity claims
node "$R/scripts/contract.mjs" get --file "$S/corpus.json" --profile draft --entity claims --id synthetic-claim-a
node "$R/scripts/contract.mjs" bundle --file "$S/corpus.json" --profile draft --case synthetic-case-a
```

Each export contains an allowlisted schema, typed JSONL, case/source/timeline
CSV, and manifest with file hashes, snapshot digest, profile, unit counts, and
review coverage. CSV null values are empty cells accompanied by `nullReasons`;
multi-label fields and typed dates use JSON cells so labels, precision, ranges,
and unknown values round-trip. Formula-like cells are prefixed with an
apostrophe, with the repository parser reversing that prefix for round trips.
Counts identify cases, sources, or claims and do not imply prevalence or
detection coverage. List/get/bundle accept only cases, sources, and claims;
unknown IDs and unsupported schema versions fail explicitly. See
[export/query rules and limitations](docs/architecture.md#reproducible-exports-and-read-only-queries).

## Research Workbench: offline preview

With the pinned Node runtime, start the loopback-only preview from the repository
root; no installation, build, CDN, model, or internet connection is required:

```sh
node scripts/server.mjs
```

Open `http://127.0.0.1:4173/`. The initial corpus is empty. Select **Load synthetic
demo** to exercise benign 0.3.0 fixtures, including emoji passages, inference,
and conflicting claims. Demo records are not incident evidence and are never
written to your corpus. Browse cases and sources independently; click passage
highlights or claim links to inspect their exact retained revision.

Select **Reload local corpus** to leave the demo and restore the configured
startup snapshot (or the empty corpus if none was supplied), clearing search
and filters. This does not reread changed files; restart the server for that.

To inspect fresh intake/extraction output instead, supply its absolute private
corpus path (file mode `0600`, as produced by intake):

```sh
node scripts/server.mjs --corpus /absolute/private/store/corpus.json --port 4173
```

This validates the whole corpus before serving a read-only startup snapshot.
Restart the server to reload changed records; stop it with Ctrl+C. Retained
article content is exposed only to the local browser. Do not deploy, tunnel,
share screenshots containing private material, or relax file permissions to use
this preview. Missing retained text is reported, not reconstructed. For further
privacy, filtering, and acceptance limits see [Architecture](docs/architecture.md)
and [Acceptance audit](docs/acceptance-audit.md).

### Curator studio: paste, select, draft, download

1. Open **Curator studio → Direct article intake / paste**. Supply an authorized
   article, its credential-free HTTPS URL, supplier identifier, and optional
   title/publisher/author. Nothing is fetched. Text is retained privately in
   memory, with CRLF/CR converted to LF and Unicode NFC normalization. Pasted
   HTML is **literal text**, not rendered or converted to readable HTML; paste
   the article's readable text instead if you do not want tags in your evidence.
   The 2 MiB limit matches CLI supplied-text intake. An already-loaded URL is
   not overwritten: select its retained revision instead.
2. Select a source and exact revision, then drag over the normalized text.
   Alternatively extend a text selection with Shift+arrow keys, or activate
   **Select entire revision** with the keyboard. The captured quote,
   revision hash, locator, and zero-based half-open **code-point** interval
   appear beside the composer. Selecting text in the Research library also
   opens this drawer; **Draft from this revision** opens it without a selection.
3. Choose an existing case, or explicitly create a named draft case with a kind.
   Enter a claim, evidence status, and uncertainty. A source assertion needs an
   active passage; **Researcher inference** instead needs a rationale and at
   least one earlier same-case saved draft claim. Saving consumes the selection.
   Choose a new passage for another assertion. Inferences do not fabricate quotes.
4. Optionally describe a behavior, choose multiple categorization values, enter
   IOCs/artifacts one per line, and pick techniques from a loaded local catalog
   or enter candidate ATT&CK/ATLAS IDs. Candidate IDs are unverified annotations,
   not official catalog entries or reviewed mappings. No remote catalog is used.
   Remove a mistaken draft and compose it again; remove dependent inferences first.
5. **Download manual-extraction/1** exports claims/passages only when all referenced
   cases and revisions already exist in the loaded corpus. Apply this JSON using
   the existing extraction command below. Behavior, categories, IOCs, and technique
   candidates are **not** part of that CLI format.
6. **Download private corpus proposal** includes intake metadata, normalized/raw
   text, claims, categories, and behavior annotations as standalone schema-valid
   0.3.0 JSON. It identifies the original corpus by digest and marks existing
   case/source identities as context, not updates. **Do not overwrite an existing
   corpus with it.** There is no automatic merge/promotion command for this richer
   proposal; a human must inspect it and arrange a scoped local application.

Protect downloaded files (mode `0600`) in a private directory (mode `0700`).
Do not commit or upload them. To apply an existing-record extraction download:

```sh
R=/home/runner/work/DevEnvThreatCorpus/DevEnvThreatCorpus
node "$R/scripts/extract.mjs" --template /absolute/private/manual-extraction.json --store /absolute/private/store --supplied-by operator
# Validate a standalone richer proposal without applying it:
node "$R/scripts/contract.mjs" validate --file /absolute/private/curator-proposal.json
```

Saved drafts survive Workbench tab navigation only. Reloading the page, closing
it, or confirming a corpus switch discards them; unsaved composer fields are
discarded when the panel is rebuilt. Download first. All authored records remain
pending, and independent human research review and merge approval are required.

## Validate locally

Requirements: Python with the pinned dependency from
`requirements-governance.txt`, plus Node.js v22.23.3 as declared by
`scripts/.nvmrc`.

```powershell
python -m pip install --requirement requirements-governance.txt
python scripts/verify.py
```

`python scripts/verify.py` runs the repository governance checks and configured
project commands, including the offline contract, intake, extraction, review, workbench,
export/query, workbench, and preview-server suites.
To run the focused suites directly with the pinned Node runtime:

```powershell
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/contract.test.mjs
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/intake.test.mjs
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/extract.test.mjs
node --test tests/review.test.mjs
node --test tests/exports.test.mjs
node --test tests/workbench.test.mjs
node --test tests/server.test.mjs
```

The tests check valid and invalid synthetic records: source and passage
provenance, case/claim relationships, hash and locator consistency,
categorization and timeline constraints, conflict links, current human-review
requirements, clean-start behavior, optional enrichment, and deterministic
serialization. Intake checks use injected fake DNS/transports, while extraction
tests use synthetic corpus/templates and temporary private stores. Neither suite
contacts websites or assesses whether a research claim is factually true.
Review tests exercise private decisions, append-only history, stale acceptance,
negative inputs, and separate provenance/status axes without authenticating a human.
Export/query tests use only visibly synthetic corpus fixtures and check reproducible
profiles, eligibility/dependency closure, CSV round trips, safe cell handling,
and private snapshot exclusion.

## Project status and next work

Implemented now:

- JSON Schema 0.3.0 and matching TypeScript declarations.
- Offline validation for structural rules and cross-record relationships.
- Deterministic identity and serialization helpers.
- Manual URL/text/file intake, bounded destination-checked HTTPS retrieval,
  private atomic retention, linked revisions, and recoverable failure manifests.
- Offline manual extraction from researcher-completed templates, exact
  revision-grounded passages, explicit case/source links, inference and conflict
  records, and pending-only outcomes.
- Private local claim acceptance, correction, and exclusion with append-only
  digest-bound events, explicit reviewer attribution, and current-eligibility checks.
- Deterministic reviewed/draft export profiles, typed JSONL, case/source/timeline
  CSV, digests and coverage metadata, plus read-only case/source/claim queries.
- Read-only client-side research workbench (`src/**`) with Unicode passage
  inspection, case/claim exploration, conflicts, facets, local branding, and a
  loopback-only offline preview server (`scripts/server.mjs`).
- Synthetic positive and negative contract fixtures with acceptance-focused
  tests.
- Project documentation describing the clean-start decision and evidence
  limits.

Not implemented yet:

- Semantic article interpretation or assisted research workflows.
- Authenticated reviewer identity, hosted review, or an in-browser curator interface.
- Deployment or an operational corpus-processing pipeline.

See [Architecture](docs/architecture.md) for the intended fresh-input flow,
[Acceptance audit](docs/acceptance-audit.md) for criterion-to-test and evidence
mapping, and [Documentation index](docs/README.md) for the other project
guides. The preserved [handoff](handoff/00-START-HERE.md) describes product
history and possible future work; it does not indicate that those features are
already implemented.

## Contribution and review

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for contribution guidelines, [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) for community standards, and [SECURITY.md](.github/SECURITY.md) for vulnerability disclosure.

Start with a complete implementation-task issue containing requirements,
scope/exclusions, dependencies, stable acceptance criteria, and definition of
done. PRD issues/files or other requirements links are optional. An authorized
human starts one Copilot session; corrections stay on its originating PR.

Keep implementation scoped to its originating issue and preserve stable
acceptance-criterion IDs. Application and governance changes require relevant
documentation and substantive root `CHANGELOG.md` prose in the same PR.
Maintain this README when public entrypoints, setup, or usage change; configured
triggers enforce a minimum, not proof of relevance. Documentation-only and
test-only maintenance need no ceremonial changelog or learning entry.
Changed learning notes must update the learning index in the same PR.
See [upkeep rules](docs/setup-and-configuration.md#documentation-upkeep-policy)
and [required merge settings and inspection blocker](docs/merge-rules.md).
Automated checks establish contract behavior, not
research truth or authenticated human approval; subjective acceptance requires
independent human review before merge. Do not put secrets in source records,
issues, prompts, or logs.
