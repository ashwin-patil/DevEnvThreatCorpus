# Public-release readiness audit — Issue #64

**Decision: not release-ready.** Text and navigation have been mechanically
checked; independent editorial/research, visual/accessibility, rights, live
Codespaces and repository-owner decisions remain outstanding. This agent audit
is not independent approval, legal clearance or a secret-free-history guarantee.

## Post-audit source boundary — Issue #73

The dated #64 results below remain historical and do **not** validate the new
post-removal candidate. [PR #74](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/74)
records its full candidate/tested SHA, source-archive inventory and fresh exact
command results. Every subsequent commit invalidates that evidence.
The candidate excludes all 45 `handoff/` files; `main` retains them until human
approval and merge. The [immutable archive](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff)
and public Git history retain them, within a full repository snapshot.
The [new disposition and per-file evidence](archive/README.md#handoff-relocation--issue-73)
supersede archive-in-place/path preservation only, not the original findings.
All 14 manifest mismatches, two missing historical documents, Pending/research
limitations, rights/redistribution and public-readiness decisions below remain
open. Source-tree cleanup is not a release, rights clearance or history erasure.
Independent human editorial/traceability and release-boundary review, plus human
merge approval and current hosted Verify/PR Policy, are still required.

Issue #77 additionally relocates seven historical documents and 15 assets;
[its disposition/inventory](archive/README.md#planning-and-asset-relocation--issue-77)
records two owner-authorized preservation commits and exact hashes.
[PR #78](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/78) owns the new
candidate SHA and fresh evidence; #64/#73 results below do not validate it.
Only current logo/favicon and communication images remain in the current asset
tree. Archived design sources and synthetic screenshots remain public history,
not current responsive/accessibility acceptance or a hosted HTML preview.
All rights/provenance, research and release decisions below remain open for
both current-tree and archived assets.

Origin: [#64](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/64);
implementation/evidence: draft [PR #70](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/70).
Audited 2026-10-15 from merged default branch
[`729ee522c34c9de727705c6b2ce9c3245896ae73`](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/729ee522c34c9de727705c6b2ce9c3245896ae73)
(#60–#63 / PRs #66–#69), confirmed with `git ls-remote origin refs/heads/main`.
The [approved plan](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a1cd31eef5ebe9dce7cf564e317cf5691a1343dc/docs/documentation-plan.md#downstream-file-ownership-and-dependency-locks)
assigns this report here. The human handoff authorized this audit after those
merges; a merge alone does not close the pending subjective outcomes in the
[documentation evidence ledger](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md)
and [retained current obligations](acceptance-audit.md#issue-77-retained-obligations).
Requested model: **GPT-6.1 Sol**. Effective model: **not exposed in session
metadata**; availability, matching selection or substitution cannot be confirmed.

## Documentation and capability findings

| Surface | Audit result / remaining boundary |
|---|---|
| [README](../README.md), [getting started](getting-started.md) | Vision/audiences in README; prominent direct Codespaces links in both; getting started is launch/first-inspection focused with no duplicate infographic. Local preview requires pinned Node, not an application install/build. Audience relevance needs independent editorial review. |
| [Workflow](workflow.md), [methodology](methodology.md), [status](status.md) | Consistent published research → source-linked claims → researcher review → patterns/hypotheses narrative. Evidence status, authorship origin and review disposition remain separate. Implemented mechanisms and synthetic plumbing are not evaluated extraction quality or accepted incident research. |
| [Architecture](architecture.md), [references](reference/cli.md) | Pipeline visual is in workflow; architecture is under docs. This audit moves the architecture figure/alternative after trust boundaries, before references, as planned; no asset bytes change. Schema/type/runtime authorities and seven configured commands agree with the references. |
| [History](archive/README.md), [development](development/README.md) | Historical PRDs, session notes, prototype and dated results are distinguished from current instructions. Compatibility anchors and issue-qualified AC evidence remain. Missing frozen references are disclosed, not fabricated. |
| Public example and deferred work | Nx remains **Pending**: 38 claims, 14 behaviors, three canonical paths (one displayed campaign graph), two Proposed mappings, no independently accepted claims. No Nx timelines, detection hypotheses or OTEL samples. #26 curation, #27 automated ingestion, #28 releases and #29 agent access remain outside this overhaul; existing local drafting/batch/export mechanisms do not deliver those open issues. |

“Validated” in command output means mechanical contract validation, not research
acceptance. Local identities are self-attested; non-review corpus edits can stale
acceptance. Framework catalog membership does not count as a campaign mapping,
and hypotheses are not deployed/evaluated rules.

## Executed evidence and operating environments

Commands run from the repository root. Local environment: **Linux x86_64,
Python 3.12.15, Node v22.23.3, PyYAML 6.0.3**. Node agrees with both runtime pin
files and `scripts/package.json`; Python 3.12 agrees with setup configuration.
The pinned governance dependency was already installed; `python -m pip check`
exited **0**. No dependencies, runtimes or gates were changed.

| Exact command / inspection | Local result |
|---|---|
| `python scripts/verify.py` | **Exit 1**: scaffold checks and all 46 Python tests pass; configured Node commands total 371 passes / 1 failure / 0 skips. Not an application-suite pass. |
| `node --test tests/contract.test.mjs` | Via verifier: exit 0; 46/46 pass. |
| `node --test tests/intake.test.mjs` | Via verifier: exit 0; 39/39 pass. |
| `node --test tests/extract.test.mjs` | Via verifier: exit 1; 96/97 pass. Direct invocation: exit 0; 97/97 pass, zero skips. |
| `node --test tests/review.test.mjs` | Via verifier: exit 0; 46/46 pass. |
| `node --test tests/exports.test.mjs` | Via verifier: exit 0; 11/11 pass. |
| `node --test tests/workbench.test.mjs` | Via verifier: exit 0; 119/119 pass. |
| `node --test tests/server.test.mjs` | Via verifier: exit 0; 14/14 pass. |
| [CLI offline recipes](reference/cli.md#offline-exercise-setup) | Nine shell blocks, setup through exports/queries, executed in order with `bash -eux`: exit 0. Only disposable synthetic `/tmp` stores; live batch and cleanup blocks excluded. All-skipped campaign output is not semantic success; simulated review is not human acceptance. |
| Local links | Python standard-library inspection of 58 tracked/new Markdown files: 447 local inline links/images and HTML `href`/`src`, with Markdown heading/explicit anchors checked; only the two known missing frozen documents below. 98 unique external URLs enumerated, not live-validated; dynamic application-route fragments and rendered navigation are not established by this check. |
| Public artifact integrity | `git ls-files` inventory; Python `zipfile` CRC/member checks and JSON comparison: six ZIP members, 113 records equal the display projection. Six communication asset SHA-256 values match their provenance files. All 32 actual frozen files plus manifest bytes equal the merged baseline; 14 recorded hashes still mismatch. |
| Preview and scan | `node scripts/server.mjs` starts the documented loopback preview; `curl http://127.0.0.1:4173/` returns HTTP 200 and `curl http://127.0.0.1:4173/api/corpus` returns the expected empty private API. Five ZIP payload hashes match the manifest. Changed-file secret scanning reports no secrets in this report, docs index and architecture only; not a history scan. |

The failing test is `issue45 AC-08 private outputs enforce
permissions/symlinks/hardlinks/size and ignored paths` at
[`tests/campaign.test.mjs`](../tests/campaign.test.mjs), line 458: nested
`git check-ignore` exits 128 instead of 0 in the verifier's filtered environment.
Reproduction reports `missing config key GIT_CONFIG_KEY_0`: filtering removes
the injected key but leaves its configuration count. Direct extraction passes.
The same local failure was recorded for #60–#62 in
the [historical ledger](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md).
Classify this as a **pre-existing local environment/verification limitation**,
not a documentation regression or a waived failure. No workaround or runtime fix
is authorized here. Other platform/product failures must not be inferred from it.

**Revision binding:** the full final tested commit SHA, exact rerun counts,
link totals, command logs and check status belong in the final evidence checklist
on [PR #70](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/70) and its
[Actions/checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/70/checks).
Results above must be read with that SHA; no pass carries forward after a new
commit. Local full transcripts are captured in the
[agent session run](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38789223161);
`/tmp` logs alone are not durable evidence.
The [base Verify success](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38788877742)
is historical, not validation of this PR. Initial PR Verify
[38789224647](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38789224647)
and PR Policy
[38789221431](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38789221431)
reported `action_required`, with no failed-job logs available for Verify; neither
is a pass. Final-head hosted authorization/results require owner follow-through.

Linux local CLI/process fixtures are executed evidence. Codespaces is the
documented recommended **Linux container route**, not a live-accepted environment:
fresh creation, rebuild, stop/start, forwarded Host/Origin behavior, signed-in
access and signed-out denial still need human evidence. Native Windows permission
and file-URL behavior remains unvalidated with historical failures; WSL/macOS and
arm64 were not exercised here. Do not convert POSIX results or container
configuration into native-Windows or cross-platform support claims.
No lint/build/browser-test command is configured. No new prose-presence tests
were added; these documentation-only changes need no ceremonial changelog or
learning entry under the [upkeep policy](setup-and-configuration.md#documentation-upkeep-policy).
The browser smoke attempt could not start: Playwright returned `Transport closed`.
HTTP success is not rendered documentation, responsive, keyboard or accessibility
evidence; those checks remain outstanding rather than silently passed.

## Public tracked-artifact inventory

Inventory covers current tracked paths and targeted content/ZIP/hash inspection,
not all Git history, deleted/unreachable objects, private stores, remote releases,
LFS payloads or a comprehensive secret/malware/rights scan. No research prompt,
prototype command or imported instruction was executed. “Public” describes the
tracked publication surface, not a claim about current repository visibility.
The [plan's historical asset enumeration](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a1cd31eef5ebe9dce7cf564e317cf5691a1343dc/docs/documentation-plan.md#complete-disposition-inventory)
and [archive disposition](archive/README.md#beforeafter-disposition-and-inbound-links)
remain authoritative navigation.

| Artifact / purpose | Provenance and review state | Attribution/rights statement; retention boundary and owner decision |
|---|---|---|
| [Nx JSON](../src/data/nx-draft.json), [draft ZIP](data/nx-draft.zip): public demonstration | Based on `3456f2b0df700d0b173f3ac98c59bff198c0783a`; four retained reports / 28 processed segments; two failed URLs remain failures. 113 typed rows, six ZIP files; Pending, not semantic gold. [Case coverage](nx-corpus.md) names Nx, StepSecurity, Wiz and Socket and failed Red Canary/Zscaler attempts. | Citations/hashes/locators retained; general quotations nulled. Full article bodies, decisions, private runs/logs/screenshots withheld. Private-retention metadata does not permit republication. Research/rights owner must approve existing redistribution/retention boundaries, including paraphrases and ZIP contents. |
| `prompts` in the Nx JSON: inspect attempted-abuse artifacts | Two exact literal variants / three source occurrences, attributed to StepSecurity and Socket; untrusted/inert, not executed. Not reproduced in this report. | Exact literals are an exception to general quotation withholding. Source attribution is not permission; rights/research owner must review necessity, quotation rights and continued retention. Do not reconstruct withheld passages. |
| [ATLAS catalog](../src/atlas-catalog.json), [framework resolver](../src/framework-catalog.mjs): reference resolution | ATLAS 2026.09: 208 techniques, upstream revision `3259f388d19cbcca11bacf12a0ef97f4198f711b`. ATT&CK 19.2: T1059-only projection, revision `6cda5ad8462c79e14fbb872f4e09059b18e0cfc4`. Retrieved 2026-10-13; not incident evidence. | [ATLAS notice](licenses/ATLAS-NOTICE.txt) and [Apache text](licenses/Apache-2.0.txt) retained; ATT&CK terms linked at its pinned revision in resolver metadata. Attribution owner must check adaptation/redistribution obligations and distinct upstream terms; repository license is not blanket clearance. |
| Three [communication PNG/SVG pairs](assets/communication/): vision, pipeline, architecture | Owner-supplied ImageGen compositions from `4a5c5cadabf7b1b5f17ff1c4e3ceaedc0e0ffee2`; each has a provenance JSON. All six hashes match. SVG wrappers contain raster artwork; not wholly vector-editable. | Supplied appearance approval is not rights, technical or accessibility acceptance. Embedded/standalone logo hashes intentionally differ as documented. Retain unchanged supplied bytes; visual/rights owners must approve actual reuse and final rendering. |
| Seven archived `docs/assets/issue-25-*.png` screenshots | Immutable #77 inventory/acceptance-audit links preserve synthetic comparison/conflict/timeline evidence at 1440, 1024 and 390 widths; not current responsive acceptance. | Repository authorship context, no separate per-image rights clearance established. Retain historical evidence only; visual/rights owner reviews content and distribution, never substitute private screenshots. |
| Current `docs/assets/{logo,favicon}.svg`; archived six `*-concept-{a,b,c}.svg`, `preview.html`, `attack-path-concept.html` | Current brand assets unchanged; historical concepts relocated under #77, not implemented feature acceptance. Original inventory: 21 images (10 PNG, 11 SVG). Current tree: eight images (three communication PNG, three communication SVG, logo and favicon); archive: seven screenshot PNG and six concept SVG plus two HTML sources. | Repository license wording exists, but asset-specific ownership/reuse is not independently attested here. Concepts remain historical; authorized relocation grants no rights clearance or acceptance. Owner must still decide reuse/retention for both trees. |
| [Frozen reference](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference/README.md), [manifest](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/REFERENCE-MANIFEST.json), other archived `handoff/` material | At the original audit revision: 32 frozen 0.2.0 files: corpus JSON/JSONL/JS, 13 library JSON modules, prototype UI/scripts and reference docs. Selected chat-derived seed with incomplete snapshots/placeholder citations and unreviewed inference; phase plans/prompts are history, not current operating instructions or accepted research. | Retained byte-for-byte in the #73 archive, not the new source candidate. Imported source/framework content still needs separate provenance/rights review; never seed new accepted claims or promise current 0.3.0 import compatibility. Custodian decides separately authorized reconciliation of the defects below. |
| Nine `tests/fixtures/` files, synthetic demos in `src/`, historical PRDs/session evidence | Benign/synthetic contract exercises and dated implementation records, not independent incident or visual validation. [Archive](archive/README.md) preserves source/revision/AC links. | Repository contribution/license context, not clearance of every embedded external reference. Retain synthetic labels and historical boundaries; contributor/rights reviewer must confirm no private content is exposed. |

**Frozen defects, unresolved:** 18 of 32 recorded SHA-256 values match; 14 do not:
`handoff/reference/README.md` and all thirteen `handoff/reference/library/`
entries `{behaviors,campaigns,detections,evidence,frameworks,governance,manifest,
mappings,otel-reference,otel,paths,sources,telemetry}.json`.
These predate this audit and remain unchanged. The frozen README also links to
absent `PROJECT_BRIEF.md` and `METHODOLOGY.md`. Do not regenerate hashes, edit
frozen bytes or invent documents to hide these defects.

## Mandatory owner decisions and observable completion

Current [license wording](../.github/LICENSE) combines Apache-2.0 with a broad
CC-BY-4.0 statement for research records, schemas and corpus data. That statement
does not establish rights in third-party quotations, imported assets or artwork;
schema/code applicability and upstream exceptions need owner clarification.
This audit changes no license or redistribution policy.

Every row is **open / needs-human-review** unless independently evidenced on
PR #70; this report assigns roles, not people or new policy.

| Owner role / blocker | Next action | Observable completion criterion |
|---|---|---|
| Independent editorial/contributor reviewer | Review audience routes, terminology, commands, link relevance, historical navigation and README applicability on final head; verify external destinations manually. | Dated independent review naming final SHA, findings/dispositions and README/upkeep relevance decision. |
| Independent research/methodology reviewer | Check implemented/draft/accepted/validated distinctions, Nx source/claim/path/prompt meanings and protected evaluation gaps. | Issue-qualified review of AC-03 and retained research criteria; no promotion from Pending without separate research acceptance. |
| Visual/accessibility reviewer + asset owner | Review integrated supplied visuals and text alternatives on desktop/mobile, zoom, keyboard/screen-reader routes; confirm figure placement after trust boundaries. No new images authorized. | Final-head rendered evidence and independent accessibility/technical sign-off for README, workflow, architecture and task-focused getting started. Static placement/hash checks are insufficient. |
| Research/rights owner, with qualified legal advice as needed | Resolve each inventory group's provenance, attribution, redistribution and retention, especially prompt literals, imported seed/framework content and generated artwork/logo. Audit `.github/LICENSE` wording. | Recorded per-group decision and approved follow-up scope. No claim of legal clearance from this inventory. |
| Frozen-reference custodian | Investigate the 14 mismatches and two unavailable documents without changing this PR's frozen bytes. | Documented reconciliation/disposition with authorized follow-up evidence; no concealed hash regeneration. |
| Environment/verification maintainer | Triage the verifier-only Git exit 128; authorize final-head hosted checks and retain exact outcomes. Do not weaken filtering/tests. | Final-head Verify and PR Policy results, with the local failure explicitly resolved or dispositioned by a human; direct extraction alone does not replace Verify. |
| Codespaces/operator reviewer | Exercise creation/rebuild/stop/start and private forwarding, browser usability and recovery with public/synthetic data only. | Dated final-head live results, signed-in success and signed-out denial, supported runtime output and no private data in evidence. Native Windows remains unaccepted absent separate authorized work. |
| Security maintainer | Confirm [private vulnerability reporting](../.github/SECURITY.md) works, define the currently unspecified email/restricted fallback and confirm 48-hour/5-business-day commitments. Never disclose via public issues. | Tested private route and owner-approved actionable fallback/response ownership; any policy wording change separately authorized. |
| Repository administrator | Reinspect effective protection/rulesets, required check integration, approvals/staleness, target/enforcement and bypass actors. [Issue #4 observations](merge-rules.md#observed-enforcement-and-blocker--issue-4) date to 2026-10-12 and prove no current enforcement or hosting-plan limitation. | Non-sensitive dated effective-settings evidence and independent owner decision under existing merge rules. No setting, plan, visibility or publication change in this audit. |
| Human coordinator / independent scope approver | Review final documentation-only diff and all blocker dispositions; reconcile #58 only after this PR is reviewed and merged. | Independent final-head approval and explicit readiness decision. Keep PR #70 draft while mandatory reviews remain; no agent merge, deployment or release authorization. |

## Stable acceptance-criterion map

| Criterion | Changed files / executed evidence | Independent outcome still required |
|---|---|---|
| AC-01 | This report, [docs index](README.md), architecture figure move; local links, offline recipes, runtime pins and final PR #70 SHA/check record | Editorial/technical review |
| AC-02 | Public tracked-artifact inventory and frozen/ZIP/visual checks above | Artifact/rights owner review with scan limits preserved |
| AC-03 | Primary-page capability comparison above; unchanged methodology/status/data | Independent research review |
| AC-04 | Exact verifier/application results, environment classification and revision-bound PR/Actions evidence above | Human disposition of failure and final hosted checks |
| AC-05 | Open owner/next-action/completion checklist above, including live and visual review | Owner review of blockers/readiness decision |
| AC-06 | Documentation-only diff on PR #70; unchanged runtime, policy, licenses, frozen data and assets | Independent human scope/README-relevance approval |
