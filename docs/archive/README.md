# Historical documentation archive

Historical proposals, session notes and acceptance records are retained for
traceability, not current instructions or accepted research. Consolidated
2026-10-15 after merged PRs #65–#68; inspected baseline:
`f15a8d806c4e2213896da1070dce218c881e5cc5`.
The [approved disposition plan](../documentation-plan.md#complete-disposition-inventory)
remains the complete file/asset inventory and topic-ownership authority.
Current readers start at the [docs index](../README.md); contributors use
the [development guide](../development/README.md).

## Before/after disposition and inbound links

The original #63 “archived in place” disposition preserved every heading/path.
Issue #73 supersedes that disposition only for the handoff pack, as recorded below.
Session narrative's old headings still link to matching archive sections. Historical
source content is reference data, not authority to execute old instructions.

| Before: source / navigation | After: disposition and current replacement | Preserved inbound/evidence handling |
|---|---|---|
| Primary docs index mixed current guidance, PRDs, handoff, policy and acceptance history | [Current-first index](../README.md); contributor routes via development, historical routes here | All existing destination paths retained; no frozen caller edited |
| [Campaign extraction PRD](../PRD-CAMPAIGN-EXTRACTION.md), 2026-10-13, base `a03fb8a` | Historical in place; current [campaign CLI](../reference/cli.md#campaign-requestchatcandidate-handoff), [formats](../reference/formats-and-versioning.md#campaign-handoff-and-runs), [status](../status.md) | Original stable criteria, proposed/deferred scope, evidence and headings unchanged |
| [Batch intake PRD](../PRD-BATCH-WEB-INTAKE.md), planning base `d404855` | Historical in place; current [CLI](../reference/cli.md) and [archive formats](../reference/formats-and-versioning.md) | Original requirements/criteria retained; historical implementation budget is not a current assignment |
| [Attack-path PRD](../PRD-ATTACK-PATH-MAPPING.md), 2026-10-13, base `a03fb8a` | Historical in place; [architecture](../architecture.md), [data model](../reference/data-model.md), status | Original criteria and [synthetic concept](../assets/attack-path-concept.html) retained; concept is not shipped acceptance |
| [Usability review](../usability-review.md), 2026-10-13 | Historical in place; [current limitations](../status.md); final revision/results remain on [PR #47](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/47) | Original observations, pending independent review and links unchanged |
| [Workbench session learning](../learnings/workbench-session-recovery.md), 2026-10-14 | Concise reusable principles at original path; [complete dated narrative](workbench-session-recovery.md) | All seven old section anchors link to their archive counterparts; source IDs/hashes, #51 AC/AP IDs, superseded decisions, failures and uncommitted-work warning preserved |
| [Status #61 evidence](../status.md#issue-61-acceptance-evidence) | [Development evidence #61](../development/documentation-review-evidence.md#issue-61-acceptance-evidence) | Old anchor retained as descriptive link; #61 AC-01–AC-05, PR/issue links, model metadata, coordination handoff and pending outcomes preserved |
| [Workflow review footer](../workflow.md#review-of-this-documentation) | Same development evidence section | Old heading retained as short history link, no reviewer/session instructions in research narrative |
| [Lifecycle](../lifecycle.md), [recovery](../recovery.md), [merge rules](../merge-rules.md), [assignment/models](../cloud-assignment-and-models.md) | Concise [contributor entrypoint](../development/README.md); detail authorities retained | Original text/anchors intact; 2026-10-12 Issue #4 enforcement observations remain dated, not current remote enforcement |
| [Acceptance audit](../acceptance-audit.md) | Intact ledger, reached through development/history | All AC IDs, tested revisions, evidence links, failures and pending human outcomes unchanged |
| Historical architecture issue sections | [Pinned pre-split architecture](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md); [evidence map](../development/documentation-review-evidence.md#other-preserved-documentation-evidence) | #30 AC-01–AC-03 and #31 AC-01–AC-04 remain at original revision, not silently replaced by ledger links |
| [Documentation plan](../documentation-plan.md) / original #59 evidence | Approved migration record retained, secondary navigation | Original inventory, criteria, amended ownership and historical model metadata intact |
| [Phased handoff](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/00-START-HERE.md), phases 01–06, changelog, prompts, foundation issue, shared contract and original user PRD | Relocated to immutable public archive under #73; [current architecture](../architecture.md) and development guide replace operating guidance | All 45 paths and bytes retained in the archived snapshot, including frozen references/manifest; removed from this candidate's tree |
| Logo/favicon concepts and [preview](../assets/preview.html) | Historical design exploration in original asset locations | No asset edits/deletions or runtime integration |
| `docs/assets/issue-25-*.png` (seven comparison/conflict/timeline screenshots enumerated in plan) | Synthetic historical screenshots, not current visual acceptance | Bytes and acceptance-audit links unchanged |
| Nx public draft, ZIP, source records and licenses/notices | [Case-study navigation](../case-studies/README.md); Pending remains Pending | No research/data/notices edits or regeneration; private omissions remain explicit |

## Frozen handoff and unavailable references

The [reference manifest](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/REFERENCE-MANIFEST.json) records version
0.2.0, captured 2026-10-11, and SHA-256 values for all 32 files under
`handoff/reference/` in the archive. No archived file or manifest was edited,
reformatted or regenerated. The earlier archive-in-place comparison results,
including their tested revision, remain recorded on
[PR #69](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/69).

The initial comparison found **14 pre-existing manifest mismatches** at the
inspected baseline and unchanged in this task: `README.md` and all thirteen
`library/*.json` entries. The other 18 file hashes match the manifest.
All 32 actual file hashes and the manifest's own bytes match the inspected Git
baseline. This demonstrates preservation, not a clean historical manifest
attestation. The frozen-reference custodian must decide any later reconciliation
in separately authorized work; no frozen file or recorded hash is repaired here.

The frozen [reference README](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference/README.md) links to absent
`PROJECT_BRIEF.md` and `METHODOLOGY.md`. These are unavailable historical
references already identified in the approved plan, not newly broken links.
Do not fabricate replacements or alter frozen bytes to hide them.
Static HTML inspection also cannot resolve the existing application-route
fragments `handoff/reference/index.html#paths` and `src/index.html#cases`;
these are not new documentation link failures.

## Handoff relocation — Issue #73

[#73](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/73) authorizes this
current-tree cleanup on [PR #74](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/74),
superseding #59/#63's archive-in-place/path-preservation decision for `handoff/`
only. Those earlier instructions and evidence describe their original revisions,
not the later relocation. Stable requirement and AC IDs and original evidence
remain historical; no old outcome is upgraded.

The authorized actor created `codex/archive-handoff`; remote ref verification
resolved it to **`a29de1822513b77d15b6fcf1c88dff147bf6140c`**.
Use the [immutable handoff tree](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff)
for navigation. This archival branch retains a **full repository snapshot**.
It is historical, not an application/release branch: do not merge later cleanup
into it or delete it. The owner accepts the archived material remaining public;
this is neither secrecy/history erasure nor attribution/redistribution clearance.

Before deletion, `git ls-remote origin refs/heads/main
refs/heads/codex/archive-handoff` returned the archive SHA for both refs.
`git ls-tree -r REV handoff` matched path/mode/blob entries for pre-authorization
main `651bbb38f1372dc159a89073ce27c09cf6472541`, the archive, and the refreshed
implementation tree. Per-path `git show REV:path` byte and SHA-256 comparisons
passed **45/45** with no inventory differences. The
[complete inventory](handoff-inventory.tsv) records each path, mode, blob ID and
actual SHA-256, not regenerated manifest assertions. Its SHA-256 is
`2fef571c3bf97fcccb6b3c0c6501c66d293ff4fcc538c6bd5bf500b0472e7dfe`.
All 32 frozen files, the manifest and the other 12 handoff files survive unchanged.
The 14 manifest mismatches and two absent historical documents remain unresolved.

Authorization was separately merged through [#75](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/75)
/ [PR #76](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/76) at the archive
SHA, then merged into PR #74 before deletion. Exact mappings and the trusted-base
evaluator are unchanged here. See [#73's acceptance map](../acceptance-audit.md#issue-73-handoff-relocation)
for final-revision checks and still-required independent human review.

### Open requirement reference replacements

Only the handoff references in issues #26–#29 may change; scope and all stable
criteria remain untouched. Issue editing is unavailable in this agent session,
so these **pending human edits** are not claimed complete:

| Issue | Replace each original handoff path with the corresponding immutable link |
|---|---|
| [#26](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/26) | [03-CURATION.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/03-CURATION.md), [SHARED-CONTRACT.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/SHARED-CONTRACT.md), [02-WORKBENCH-UI.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/02-WORKBENCH-UI.md) |
| [#27](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/27) | [04-INGESTION-ACTIONS.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/04-INGESTION-ACTIONS.md), [01-FOUNDATION.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/01-FOUNDATION.md), [SHARED-CONTRACT.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/SHARED-CONTRACT.md), [03-CURATION.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/03-CURATION.md) |
| [#28](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/28) | [05-RELEASE-DOCKER-HOSTING.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/05-RELEASE-DOCKER-HOSTING.md), [03-CURATION.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/03-CURATION.md) |
| [#29](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/29) | [06-AGENT-ACCESS.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/06-AGENT-ACCESS.md), [SHARED-CONTRACT.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/SHARED-CONTRACT.md), [01-FOUNDATION.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/01-FOUNDATION.md), [03-CURATION.md](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/03-CURATION.md) |

## Evidence and review

Use [documentation review evidence](../development/documentation-review-evidence.md)
for issue-qualified criteria, original reports, tested SHAs and pending reviews,
and the [acceptance audit](../acceptance-audit.md) for earlier implementation
records. Static link/hash checks cannot establish policy equivalence, research
acceptance or navigation/editorial quality. Independent human review remains
required; merging a PR alone does not turn a recorded pending outcome into a pass.
