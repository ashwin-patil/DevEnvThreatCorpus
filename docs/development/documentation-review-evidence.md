# Documentation review evidence

This development/history record preserves implementation evidence, not research
acceptance. Criterion IDs are qualified by originating issue; merging a
documentation PR does not resolve its outstanding research/editorial outcomes.
Consolidation date: 2026-10-15. Inspected default-branch revision:
`f15a8d806c4e2213896da1070dce218c881e5cc5`, containing merged PRs #65–#68.
The [archive inventory](../archive/README.md) records old paths and replacements.

## Issue #61 acceptance evidence

Relocated from [the original status section](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/f15a8d806c4e2213896da1070dce218c881e5cc5/docs/status.md#issue-61-acceptance-evidence).
Its [incoming anchor](../status.md#issue-61-acceptance-evidence) and
[workflow footer anchor](../workflow.md#review-of-this-documentation) remain
descriptive links. The original footer is preserved at the
[inspected revision](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/f15a8d806c4e2213896da1070dce218c881e5cc5/docs/workflow.md#review-of-this-documentation).

Originating issue: [#61](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/61);
tracking/coordinator issue: [#58](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/58).
Implementation and corrections stay on [PR #67](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/67).
The approved [plan and ownership lock](../documentation-plan.md#downstream-file-ownership-and-dependency-locks)
assigned those three pages and the next sequential index edit after merged #60.
At that implementation, README/getting-started and the old architecture remained
unchanged; no runtime, policy, learning or changelog change was warranted.
Independent human README-applicability and documentation-relevance review remained
required under the upkeep policy.

| Stable criterion | Changed files and check/evidence destination | Required independent review / preserved state |
|---|---|---|
| #61 AC-01 | [Workflow](../workflow.md): five stage sections, each with inputs/actions/outputs/uncertainty/acceptance boundary and current references; final-revision report on PR #67. | Methodology reviewer to inspect all five stages: **needs-human-review**. |
| #61 AC-02 | [Methodology worked example](../methodology.md#public-safe-nx-worked-example), linked commit-pinned public records and public draft ZIP; provenance comparison reported on PR #67. | Research reviewer to compare linkage, omissions and truthful Pending status: **needs-human-review**. |
| #61 AC-03 | [Capability matrix](../status.md#capability-and-maturity-matrix) cites code/tests and public/historical evidence separately; exact verifier results and tested SHA on PR #67. | Technical/research reviewer to verify status and maturity distinctions: **needs-human-review**. |
| #61 AC-04 | [Methodology](../methodology.md), [workflow](../workflow.md) and [status](../status.md) distinguish identity, stale acceptance, chronology and detection hypotheses. | Independent research/editorial reviewer: **needs-human-review**; self-audit is not approval. |
| #61 AC-05 | [Docs index](../README.md), cross-page/reference links; executed local navigation/link checks reported on PR #67. Existing architecture anchors were retained. | Human rendered navigation, terminology and relevance review: **needs-human-review**. |

Original handoff: the human coordinator (@ashwin-patil) must arrange independent
reviewers and carry PR URL, current head SHA, check status, blockers and next action
to #58. Keep the implementation PR draft pending required review and require
independent human approval before merge. This records the handoff as written;
PR #67 is now merged, which is not evidence that every listed outcome passed.
Requested session model: **GPT-6.1 Sol**. Effective selection was unavailable in
the exposed session metadata; no match or substitution was asserted.

The [PR #67 report](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/67)
binds verification to `33eca1fd7928023bc71d824d026ee01df03efef7`:
93 local links/anchors and public JSON/ZIP provenance checks passed.
`python scripts/verify.py` locally exited 1: 46 Python tests passed and 371/372
application tests passed, with the Git environment-filtering failure; direct
extraction passed 97/97. Hosted Verify and PR Policy subsequently passed at that
same SHA (46 Python / 372 Node, zero failures/skips), as linked through
[PR checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/67/checks).
Both the failure and hosted success are historical, not fresh #63 results.

## Other preserved documentation evidence

| Origin | Revision-bound record and limitations |
|---|---|
| #59 AC-01–AC-04 | [Approved plan](../documentation-plan.md), [PR #65](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/65); original plan criteria and human-review boundaries remain there. |
| #60 AC-01–AC-07 | [PR #66](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/66) records evidence at `cc601575eb11a7d7672862bb176a3c139471e1cd`, not its later head `6638c7f10d94090fda2db9340d75b7e908e00df9`. Local launch/navigation/assets passed; local verifier had the Git filtering failure, direct extraction passed. Live Codespaces, desktop/mobile rendering and independent review were pending. Later visual placement was superseded, not retrospectively accepted. |
| #62 AC-01–AC-08 | [PR #68](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/68), reviewed head `6bc27a11ec1024b4b457c336a89bc918e86004e3`: [hosted Verify](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38783981487) passed 46 Python and 372 Node tests, zero failures/skips; [PR Policy](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38784041678) passed. The report retains earlier local Git filtering failure, recipe-retest limitations and required human technical/editorial/accessibility/visual/README review. |
| #30 AC-01–AC-03; #31 AC-01–AC-04 | [Pre-split architecture](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md), specifically [retrieval trust boundary](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md#retrieval-trust-boundary-and-finite-bounds) and [studio proposal formats](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md#studio-boundary-and-proposal-formats). These tables were not copied into the acceptance ledger; original evidence and limitations remain at that revision. |
| Earlier implementation and session records | [Acceptance audit](../acceptance-audit.md) remains intact, including failed/pending outcomes; [PR #52 session archive](../archive/workbench-session-recovery.md) retains #51 AC-01–AC-07 and AP-01–AP-09, source hashes, uncommitted-work context and failed Windows verification. |

## Issue #63 acceptance evidence

Originating [#63](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/63);
corrections and final-revision check results belong on draft
[PR #69](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/69).
Requested model: **GPT-6.1 Sol**; effective model is not exposed, so selection or
substitution cannot be confirmed. No artwork is added or generated; the supplied
visual hierarchy and bytes remain unchanged.

| Stable criterion | Changed files / durable check destination | Independent outcome |
|---|---|---|
| #63 AC-01 | [Docs index](../README.md), development/case/decision indexes, historical wrappers; PR #69 navigation report | Independent human navigation/README-relevance reviewer: **needs-human-review**. |
| #63 AC-02 | [Before/after inventory](../archive/README.md#beforeafter-disposition-and-inbound-links), preserved old paths/headings and relocated session links; PR #69 link/anchor and evidence comparison | Independent traceability reviewer: **needs-human-review**. |
| #63 AC-03 | This ledger, unchanged acceptance audit, pinned pre-split architecture and complete session archive; PR #69 before/after evidence comparison | Independent AC/revision/failure/pending-outcome review: **needs-human-review**. |
| #63 AC-04 | No handoff edits; PR #69 exact Git diff and all 32 actual SHA-256 comparisons against `f15a8d806c4e2213896da1070dce218c881e5cc5`, plus unchanged manifest bytes. [Fourteen pre-existing manifest mismatches](../archive/README.md#frozen-handoff-and-unavailable-references) remain explicitly unresolved. | Executed preservation results must be read with their tested SHA; custodian review/reconciliation remains human and outside this task. |
| #63 AC-05 | Link/anchor checks on PR #69; [updated learning index](../learnings/README.md); current policy detail pages remain intact | Independent governance/editorial reviewer: **needs-human-review**. |
| #63 AC-06 | Status/workflow compatibility links point here; methodology retains research rules, not session metadata; original #61 section/footer pinned above | Before/after evidence and anchor checks on PR #69; independent editorial/traceability reviewer: **needs-human-review**. |

The human coordinator must carry PR #69's URL, final head SHA, exact check results,
blockers and next action to #58. Required next action is independent navigation,
traceability, governance/editorial and README-applicability review, plus
authorization of hosted checks where requested. Do not infer those outcomes from
agent self-audit or this matrix. No merge, publication or remote-setting change is
authorized by this record.
