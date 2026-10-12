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
offline validation, operator-triggered source intake, and researcher-triggered
manual claim extraction for a new corpus. Claim acceptance and review operations
are not implemented.

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

## Validate locally

Requirements: Python with the pinned dependency from
`requirements-governance.txt`, plus Node.js v22.23.3 as declared by
`scripts/.nvmrc`.

```powershell
python -m pip install --requirement requirements-governance.txt
python scripts/verify.py
```

`python scripts/verify.py` runs the repository governance checks and configured
project commands, including the offline contract, intake, and extraction suites.
To run the focused suites directly with the pinned Node runtime:

```powershell
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/contract.test.mjs
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/intake.test.mjs
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/extract.test.mjs
```

The tests check valid and invalid synthetic records: source and passage
provenance, case/claim relationships, hash and locator consistency,
categorization and timeline constraints, conflict links, current human-review
requirements, clean-start behavior, optional enrichment, and deterministic
serialization. Intake checks use injected fake DNS/transports, while extraction
tests use synthetic corpus/templates and temporary private stores. Neither suite
contacts websites or assesses whether a research claim is factually true.

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
- Synthetic positive and negative contract fixtures with acceptance-focused
  tests.
- Project documentation describing the clean-start decision and evidence
  limits.

Not implemented yet:

- Semantic article interpretation or assisted research workflows.
- Authenticated reviewer identity, a review interface, or durable review
  storage.
- Public exports, deployment, or an operational corpus-processing pipeline.

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
