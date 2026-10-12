# DevEnvThreatCorpus

DevEnvThreatCorpus is building a human-reviewed corpus for research on
developer-environment threats. The current work establishes the data contract
and validation foundation for a new corpus; it is not yet a blog-processing
application or pipeline.

## Current implementation

The 0.3.0 contract models sources and their revisions, passages, cases, claims,
categorization, timelines, and review events. Its validator checks schema shape
and relationships between records, including evidence references, content
hashes, date precision, conflicts, and review dependencies. Canonical
serialization and identity helpers support deterministic record comparison.

The new corpus starts from newly supplied source material. Existing 0.2.0
claims are not migrated, copied, or used to seed it. The frozen 0.2.0 material
under `handoff/` is retained as historical and design reference only.

**No blogs have been processed by this contract or pipeline in this
implementation.** Test records are synthetic fixtures used to check the
contract; they are not extracted blog content or evidence that intake and
review workflows are operational.

## Validate locally

Requirements: Python with the pinned dependency from
`requirements-governance.txt`, plus Node.js v22.23.3 as declared by
`scripts/.nvmrc`.

```powershell
python -m pip install --requirement requirements-governance.txt
python scripts/verify.py
```

`python scripts/verify.py` runs the repository governance checks and configured
project commands, including the offline Node contract suite. To run that
focused suite directly with the pinned Node runtime:

```powershell
npm.cmd exec --yes --package=node@22.23.3 -- node --test --test-reporter=dot tests/contract.test.mjs
```

The tests check valid and invalid synthetic records: source and passage
provenance, case/claim relationships, hash and locator consistency,
categorization and timeline constraints, conflict links, current human-review
requirements, clean-start behavior, optional enrichment, and deterministic
serialization. They do not fetch websites or assess whether a research claim
is factually true.

## Project status and next work

Implemented now:

- JSON Schema 0.3.0 and matching TypeScript declarations.
- Offline validation for structural rules and cross-record relationships.
- Deterministic identity and serialization helpers.
- Synthetic positive and negative contract fixtures with acceptance-focused
  tests.
- Project documentation describing the clean-start decision and evidence
  limits.

Not implemented yet:

- Fetching or registering blogs from URLs or supplied files.
- Article parsing, claim extraction, or assisted research workflows.
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

Keep implementation scoped to its originating issue and preserve stable
acceptance-criterion IDs. Update focused tests, relevant documentation, and
`CHANGELOG.md` together. Automated checks establish contract behavior, not
research truth or authenticated human approval; subjective acceptance requires
human review. Do not put secrets in source records, issues, prompts, or logs.
