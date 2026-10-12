# Acceptance audit

For every issue criterion, record a stable ID, observable outcome, changed-file evidence, verification method, result, and durable evidence reference. Use only `pass`, `fail`, or `needs-human-review`. Do not label a subjective judgment as an automated pass.

Evidence is revision-bound. Record the full tested commit and relevant CI/local command results and links, then refresh all results after any new commit. Automated criteria require actual command/check execution; a declared command or green result copied from another revision is not proof. Subjective criteria need a named human's review and decision before merge.

The PR policy reads GitHub's linked-issue and complete changed-file metadata: it requires exactly one open linked issue with stable acceptance IDs, mapped changed paths, documentation/root changelog upkeep for application/governance changes, configured README triggers, and a same-PR learning-index update when a learning note changes. It uses the exact trusted base's evaluator/configuration; patches are untrusted data, not commands or proof of quality. It does not read the PR body or comments, run tests, certify acceptance outcomes, or replace code review. The independent `Verify` check runs scaffold and configured application commands on the PR revision. Require both checks and human approval through repository settings; policy passing alone does not imply verification passed. A local fixture is only a test of the evaluator. On a new repository, hosted PR Policy is unavailable until that workflow is on the trusted default branch. See [applicability and bootstrap](setup-and-configuration.md#documentation-upkeep-policy).

## Issue #10 project branding, logo assets, community health files, and repository logistics

Originating requirements: [Issue #10](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/10), directly in that issue. PR is the durable location for final command output, tested SHA, and independent human approval.

### Decisions and boundaries

- Repository policy takes precedence over the issue's proposed root layout for community files. Hosted PR Policy uses the trusted base configuration; head-only mapping changes cannot authorize new file surfaces in the same PR. Standard community health and governance files therefore live under `.github/` (`.github/LICENSE`, `.github/SECURITY.md`, `.github/CONTRIBUTING.md`, `.github/CODE_OF_CONDUCT.md`), which is already mapped under `governance` (`.github/**`). No workflow or trusted-base policy is changed.

| ID | Changed files and automated verification | Durable evidence / remaining human decision |
|---|---|---|
| AC-01 | `docs/assets/logo.svg`, `docs/assets/favicon.svg`, `docs/assets/preview.html`; verified via file existence and local side-panel browser preview | Vector logo and favicon render cleanly with `#cb572d` terracotta threat styling and synchronized tagline; human visual acceptance |
| AC-02 | `.github/LICENSE`, `.github/SECURITY.md`, `.github/CONTRIBUTING.md`, `.github/CODE_OF_CONDUCT.md`; verified via file existence and content check | Apache-2.0 / CC-BY-4.0 dual license, vulnerability disclosure SLA, contribution process, and Contributor Covenant v2.1 in place in .github/ governance surface |
| AC-03 | `README.md`; verified via human review | Brand SVG banner, tagline ("Evidence-grounded threat intelligence · Attack paths · Telemetry"), badges, and community cross-links integrated |
| AC-04 | `CHANGELOG.md`, `docs/acceptance-audit.md`; verified by `python scripts/verify.py` passing scaffold and governance tests | Substantive changelog entries for branding and logistics; criteria-to-file evidence mapped |

Requested coding model: **Auto**.

## Issue #4 ongoing upkeep and flexible intake

Originating requirements: [Issue #4](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/4), directly in that issue; no separate parent PRD. [Implementation PR #5](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/5) is the durable location for final command output, full tested SHA, hosted run URLs, and independent review decisions. This table links executable tests/files; it does not self-certify human acceptance.

| ID | Changed files and automated verification | Durable evidence / remaining human decision |
|---|---|---|
| AC-01 | `.github/ISSUE_TEMPLATE/implementation-task.yml`; `test_ac01_flexible_issue_form_keeps_required_task_fields` in `tests/test_verify.py` | Executed focused results in originating PR; human rendered-form review/link required |
| AC-02 | `AGENTS.md`, `.github/copilot-instructions.md`, PR template, README, lifecycle/setup docs; `test_ac02_lifecycle_allows_standalone_requirements_and_human_launch` | Focused consistency check plus independent documentation review/link required (not exhaustive semantic proof) |
| AC-03 | `scripts/pr_policy.py`, PR Policy workflow, setup guidance; `test_ac03_*` in `tests/test_policy.py` | Positive/negative fixtures execute missing docs/changelog, substantive metadata floor, and documentation/test-only cases; human relevance/quality review required |
| AC-04 | `project.config.json` README triggers, evaluator, README, PR template; `test_ac04_readme_triggers_and_uncertain_relevance` | Deterministic trigger fixtures; independent human applicability decision for paths outside triggers and rule relevance |
| AC-05 | Evaluator, conditional learning guidance; `test_learning_note_requires_same_pr_index_update`, `test_ac05_learning_removal_and_rename_require_surviving_index_update`, ordinary no-note fixtures | Executed positive/negative results; no ceremonial note created for this task |
| AC-06 | Config/schema/verifier/evaluator/workflow; `test_ac06_*`, `test_workflows_separate_hosted_verification_from_metadata_policy`, nonexecution test, contract AC-09 mapping regression | Executed mapping/trust regressions; human workflow/bootstrap inspection/link required. Existing paths are reclassified; older trusted-base policy governs this PR initially |
| AC-07 | [Merge rules and observed API blocker](merge-rules.md#observed-enforcement-and-blocker--issue-4) | MCP default-branch `protected: false`; protection/ruleset GETs blocked by HTTP 403. Administrator settings decision/evidence required; no enforcement claim or remote change |
| AC-08 | `python scripts/verify.py`; configured `node --test tests/contract.test.mjs`; focused `python -B -m unittest tests.test_policy tests.test_verify -v` | Final full SHA/exact output and hosted `Verify`/`PR Policy` links belong in originating PR; rerun after each commit. Offline contract verification is not an intake/extraction app |

Requested coding model: **GPT 6.1-Sol**. This session does not expose an effective model identifier, so selection/support cannot be verified; no substitution or effective-model claim is made. No local application session is started.

Human decisions remain `needs-human-review` until independent review links are attached. Hosted checks on the final revision and live settings evidence must be inspected before merge; local test success is not hosted proof. There is no configured lint or production build command.

## Issue #1 foundation contract

Originating issue: [#1](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/1).
Governing requirements: `handoff/SHARED-CONTRACT.md` and
`handoff/ISSUE-001-FOUNDATION-CONTRACT.md`, version 1.1. This implements
FND-01 as re-scoped by the current clean-start decision, FND-04, the FND-06/07
conventions, and only the data-contract portions of FND-11/13/14/15/16/17. It
does not establish completion of foundation.

### Decisions and boundaries

- New 0.3.0 records start from newly supplied inputs. No 0.2.0 claims or records
  are imported or migrated. The frozen handoff reference remains unchanged and
  is used only as historical design material, not as test input or corpus seed.
  This current Issue #1 decision supersedes the migration proposal in the
  preserved handoff reference documents; those files are not modified here.
- Identity is typed: `(entity type, id)`. IDs may match across different entity
  types, but duplicates within a type are invalid. Passage identity is anchored
  to its revision. No automatic case attribution or merging follows from a
  shared source or behavior.
- Missing values use field-specific `nullReasons`: `unknown`, `not_reported`,
  and `not_applicable` are different states. Known values cannot carry a null
  reason. Publication metadata does not establish an execution date.
- Supporting text is checked using normalized Unicode code-point offsets,
  zero-based and end-exclusive. Retained-content absence requires an explicit
  attested locator and revision hash; an attestation record is not proof of a
  reviewer's identity or research truth.
- The 0.3.0 schema explicitly introduces `Human authored`,
  `Human source paraphrase`, and `Human inference` origins for manual collection.
  Reviewer acceptance never changes authorship. Synthetic fixtures are
  labeled as such, not incident evidence.
- Controlled tool/platform/tag aliases are unique arrays of nonempty strings.
  Malformed alias maps fail structural validation rather than permitting
  substring matches or throwing during category membership checks.
- Content/dependency hash checks establish structural acceptance eligibility,
  not authenticated authorization. Actual reviewer authentication, append-only
  storage enforcement, review operations, and release eligibility workflows
  require later issues and independent human approval.
- The frozen reference and its manifest remain historical reference material;
  they are not read by the 0.3.0 contract tests and are not migrated or repaired
  by this issue.
- Repository policy takes precedence over the handoff's proposed layout.
  Hosted PR Policy uses the trusted **base** configuration; changing head
  mappings cannot authorize new surfaces for this PR. Types therefore live
  under `schemas/`, fixtures under `tests/fixtures/`, and Node package/version
  files under `scripts/`. No workflow or trusted-base policy is changed.

### Module layout and reproducibility

- `schemas/corpus.schema.json`: versioned core JSON Schema and optional
  enrichment references; `schemas/contract.d.ts`: corresponding TypeScript types.
- `scripts/contract.mjs`: offline structural and relationship validation,
  text normalization, canonical serialization, identity and hash primitives.
- `tests/fixtures/benign/core-only.json` and `tests/fixtures/benign/negative.json`:
  visibly synthetic positive and negative contract inputs.
- `tests/contract.test.mjs`: executable Issue #1 acceptance gates.
  `project.config.json` configures this offline contract suite;
  `python scripts/verify.py` runs it alongside scaffold verification.

Node 22 LTS is pinned by `scripts/.nvmrc`/`scripts/.node-version`;
`scripts/package-lock.json` records the dependency-free Node tooling.
No network, model, or credentials are needed
for tests. Normalize supplied text with `unicode-lf-nfc/1` (CRLF/CR to LF and
Unicode NFC) before calculating normalized hashes or passage offsets; raw
hashes refer to the original text.

Canonical JSON recursively sorts object keys and entity collections by ID,
preserves semantic node/edge ordering, and uses UTF-8 with a final LF.
Never add fresh build timestamps or machine paths to hashed content; a digest
must not include its own field. Retrieval and review times describe recorded
events and must not change on rebuild.

New IDs use the full SHA-256 of namespace plus canonical identity, not random
values, wall-clock times, or model-generated text alone. IDs stay stable across
rebuilds of the same inputs. A duplicate/collision fails validation; resolution
requires an explicit recorded identity discriminator, never silently replacing
an ID.
URL identity rule `https-tracking/1` rejects non-HTTPS and embedded credentials,
removes fragments and known `utm_*`, `fbclid`, and `gclid` tracking keys, and
retains other query parameters. Similar URLs never establish shared attribution.

### Stable acceptance traceability

Every row uses `schemas/corpus.schema.json`, `schemas/contract.d.ts`, and
`scripts/contract.mjs`. Test names retain the originating `AC-01`–`AC-09` IDs
in `tests/contract.test.mjs`; negative inputs are durable patch fixtures in
`tests/fixtures/benign/negative.json`, applied to the core fixture by that suite.
The [implementation PR](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/3)
records exact commands, final tested SHA, exit codes, and results. Its hosted
checks are separate evidence and may still require approval to run.

| ID | Observable outcome / focused tests | Durable fixture / implementation evidence |
|---|---|---|
| AC-01 | Supplied-text, source-only input validates with absent URLs, provenance, and null reasons | `tests/fixtures/benign/core-only.json`; `AC-01 supplied-text source-only intake` test |
| AC-02 | Two sources support one case; one source supports separate claims in two cases without attribution inference | Core fixture; `AC-02 many-to-many links` test |
| AC-03 | Core case validates with all enrichment absent | Core fixture; `AC-03 core-only fixture` test |
| AC-04 | Bad references/revisions/offsets, duplicate IDs, and missing inference basis fail clearly | Negative fixture; `AC-04` negative, Unicode, attestation, inference, and duplicate-ID tests |
| AC-05 | Null states remain distinct; positive AI roles overlap; attacker-side AI is not a trust surface | Core/negative fixtures; `AC-05` null, source-scoped AI, and controlled-category tests |
| AC-06 | Publication/execution types and day/month/year/range/unknown precision remain distinct, without invented days | Core/negative fixtures; `AC-06` calendar and supported-timeline tests |
| AC-07 | Contradictory claims survive separately with explicit links | Core fixture; `AC-07 conflicting claims` round-trip test |
| AC-08 | Fresh 0.3.0 records validate without imported 0.2.0 claims or migration metadata; legacy-only fields are rejected; acceptance requires a current human review bound to content and dependencies | Synthetic core fixture; `AC-08 fresh 0.3.0 records`, current-review, append-only-review, and dependent-acceptance tests; schema and type declarations |
| AC-09 | Repeated serialization is deterministic and the focused contract suite runs offline without migration inputs | `AC-09` serialization, schema/type alignment, and configured-command tests |

### Commands and evidence limits

From the repository root, with the pinned Node version:

```text
node --test tests/contract.test.mjs
python scripts/verify.py
```

There is no configured lint or production build command in this issue.
Configured project verification runs the contract suite, not a complete
intake/extraction/review application. The frozen 0.2.0 handoff is not loaded by
the suite. After any new commit, rerun verification and record the new SHA in
the PR rather than reusing the earlier result.

### Model and review record

Requested coding model: `gpt-6.1-sol`. The implementation tool was explicitly
invoked with `model: gpt-6.1-sol`, without substitution, and its status metadata
reports `model: gpt-6.1-sol` for the implementation agent. The parent session's
effective model is not exposed; this record does not certify that session's
runtime model. No runtime extraction model is used.

Automated gates require executed results on the final commit, recorded in
the implementation PR. Independent human review of contract choices, source
semantics, model metadata, and merge approval remains `needs-human-review`.
An agent's local tests and self-audit do not replace hosted policy checks or
human approval.
