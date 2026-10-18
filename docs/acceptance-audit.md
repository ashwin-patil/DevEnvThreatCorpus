# Acceptance audit

## Issue #83 optional public-research model adapter

Originating requirements: [#83](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/83).
Human-selected design: CLI-only, disabled-by-default OpenAI Responses at the fixed
global endpoint, `gpt-6-luna`, explicit process `OPENAI_API_KEY`, operator-confirmed
published research and per-request transmission confirmation. Public prompt
literals are article artifacts, not confidential user prompts. Keep chat handoff
as the default. No live call is authorized by design approval.

The approved profile is low reasoning, at most 256 KiB serialized full payload
and 32,000 reference tokens, 16,000 output tokens, 120-second provider deadline,
2 MiB response and one attempt without automatic retries. Protected artifacts
remain until explicit operator cleanup. Input reference counts are not exact
provider accounting; `store:false` is not a zero-retention guarantee.

| Criterion | Implementation / focused executable evidence | Independent outcome / limitation |
|---|---|---|
| AC-01 opt-in | `src/model-adapter.mjs`, explicit CLI dispatch in `scripts/extract.mjs`; disabled/missing/denied/stale no-network tests and CLI unknown-flag checks | Configuration/transmission walkthrough **needs-human-review**; no browser generation or startup setting |
| AC-02 versioned boundary | `src/campaign.mjs` request `/3`, run `/4`, provider receipt and explicit historical readers; request/provider/model/policy tamper, provenance and rehashed-snapshot negatives | Provider/provenance review **needs-human-review**; local receipts are not signed provider attestations |
| AC-03 untrusted output | Existing candidate normalization, exact passage/coverage/closure/geometry checks; receipt-required validation, human-origin/acceptance/checklist/unsupported-output negatives; POSIX generate then explicit apply | JSON mode is not semantic/schema approval; generated records Pending; independent candidate-to-review inspection required |
| AC-04 review preservation | Reviewed claims/tools/prompts/behaviors/mapping fixture before/after generation; unchanged human edits/history/states, changed proposals Pending, stale dependent acceptance blocked; replay checks | Independent researcher judgment **needs-human-review**; no semantic accuracy improvement claimed |
| AC-05 concurrent review | POSIX delayed fake provider modifies human decisions during generation; stale text/receipt retained, full-base validation/application reject, review history preserved | Actual private-store tests require POSIX execution; native-Windows skips are not persistence evidence |
| AC-06 limits/privacy | Byte/reference-token boundaries, response ceiling/deadline/abort, single attempt/status classification, no redirect/fallback/tools, diagnostic/credential assertions, malformed/incomplete/refusal/storage-failure cases | Independent privacy review **needs-human-review**; timeout is not exactly-once execution or zero cost; no credentials/live endpoint exercised |
| AC-07 regressions | Adapter tests imported by configured extraction suite; existing campaign/chunk/HITL/server/workbench/export suites and `python scripts/verify.py` | Exact commands/results/skips/final SHA and hosted links belong on the originating PR; live-provider operation, browser/researcher and documentation relevance review remain separate |

API payload `public-research-projection/1` explicitly omits full catalog descriptions
because those alone exceed the approved reference budget. Full pins/catalog and
unchanged canonical windows remain bound locally; sent IDs/names/URLs/tactics are
not an assertion of semantic completeness. No chunk or staged-extraction changes,
public corpus mutation, acceptance transfer or automatic application are included.
Compatibility with the landed #85 pipeline is covered by applying manual Ground
and receipt-bound adapter runs in both orders, validating their shared snapshot,
and preparing Interpret from adapter-generated Pending support. Stage-run identity
is separate from the adapter receipt argument. Collision regressions require
`UNSAFE_PATH` without overwriting output and distinguish an unwritable failure
manifest as `PERSISTENCE` with uncertain retention.

## Issue #85 staged extraction - implementation, independent acceptance pending

Originating requirements: [#85](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/85).
The owner approved grounded applied Pending inputs, Ground/Interpret/Relate scope,
bounded explicit handoffs and the major-mismatch/adoption package, then authorized
implementation. Upstream #84 merged at `0799fe143ab155e4d1d8f27f40292ee53e1a387f`.
No live private-corpus extraction, model call, real semantic evaluation or adoption
has been performed by this implementation session. Final-revision command results
and hosted evidence belong on the originating draft PR; native Windows skips
are not private POSIX validation.

| Criterion | Implementation and executable evidence | Remaining independent/operator evidence |
|---|---|---|
| AC-01 | `stage-contract.mjs`, `stages.mjs`; `stages.test.mjs` boundary/version/limit rejection, historical campaign suite | Human contract/scope review; optional adapter integration remains separate. |
| AC-02 | Effective input snapshots, existing exact grounding/record normalizers; Unicode, missing support, wrong-case and classification fixtures | Frozen human-reviewed evaluation and researcher interpretation. |
| AC-03 | `hitl.mjs` stage dependencies and effective revisions; stage claim/literal/behavior/path/mapping gating fixtures | Independent end-to-end review walkthrough. |
| AC-04 | Request/response-derived stage IDs, frozen proposals, append-only history; stage replay/rerun and existing HITL history tests | Historical private overlays inspection. |
| AC-05 | Full-base freshness, sidecar recheck, effective human corrections; edit-before/after preparation and stale application fixtures | Private concurrency/recovery walkthrough. |
| AC-06 | Explicit per-input processing, stage/source/review denominators; partial/failed processing fixtures and UI regressions | Human interpretation of interrupted work/progress. |
| AC-07 | Shared HITL/export closure, studio validate/apply, bounded private routes; stage/export and DOM/server regressions | POSIX hosted checks and independent UX/accessibility/public-boundary review. |
| AC-08 | Reproducible private evaluation procedure in researcher guide; synthetic mechanism tests only | **Not performed:** frozen independent semantic evaluation, measured cost/latency if applicable and non-sensitive results. |
| AC-09 | `stage-comparison.mjs`, `stage-view.mjs`; freeze/renamed-ID/equal-count/split-merge/literal/adoption-blocking tests | **Not performed:** authorized Nx baseline/regeneration/comparison and independent discrepancy adjudication/selection. |

All source/test paths above are under `src/` and `tests/` respectively. The CLI,
formats, data model, architecture and researcher guide describe the shared
mechanisms and conservative cohort dependencies. No AC is declared independently
accepted by agent testing; the PR remains draft pending its human/operator gates.

## Issue #84 context chunks — integration, independent acceptance pending

Requirements and approved policy: [#84](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/84).
Implementation and corrections remain on [PR #86](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/86).
The initial checkpoint is superseded by integrated request/run versions below.
Final-revision command results, counts, platform limitations and hosted check
results must accompany the originating PR; earlier checkpoint results do not
validate later commits. Native-Windows skips are not POSIX test success.

| Criterion | Current files/tests | Status and remaining evidence |
|---|---|---|
| AC-01 | `src/chunks.mjs`, `src/article.mjs`, `scripts/package-lock.json`; `tests/chunks.test.mjs` measured thresholds, deterministic identity, paragraphs/Markdown/retained HTML/code/prompt/oversize tests | Mechanism implemented; independent policy implementation review required. |
| AC-02 | `src/campaign.mjs` canonical quote resolver; chunk Unicode/hash/slice fixtures and campaign repeated-location/request/run tamper tests | Exact canonical coordinates retained; synthetic checks do not establish real source interpretation. |
| AC-03 | Chunk boundary/full-coverage fixtures; `chunkReport`, `campaign report-demo` and protected `campaign report`; campaign readable/private report tests | Inspect benign report and authorized private output. POSIX permissions/overwrite exercise must execute on POSIX; independent quotation-context review required. |
| AC-04 | Campaign exact-overlap claim/inference/artifact/behavior dedup, conflicting duplicate metadata and distinct-location tests; HITL stable-unit and repeated-evidence navigation regressions | Only exact normalized support/content collapses. No semantic behavior merge or transfer of human acceptance. Independent review required. |
| AC-05 | Campaign mixed-version before/after edited/accepted/excluded fixture; `tests/hitl.test.mjs` dependency invalidation/history; `tests/workbench.test.mjs` evidence/support-return navigation | Existing history/proposals preserved; new identities Pending and withheld from reviewed exports. Independent real-source/UX inspection remains required. |
| AC-06 | `progressSummary`, `unionCoverage`, `renderProgress`; campaign overlap/partial/skipped/failed/mixed-version and HITL historical/empty/unavailable fixtures | Canonical code-point numerator/denominator unions policies without window inflation; historical unlocated partial work is disclosed separately. Independent interpretation review required. |
| AC-07 | Request `/2`, extraction/run `/3`, prompt `/5`; fixed request `/1` / run `/2` validation and frozen run `/1` replay fixtures; all eight configured application suites via `python scripts/verify.py` | Manual handoff and export contracts retained; pinned final-revision and hosted POSIX evidence required. No provider/context/throughput/semantic-quality guarantee. |

No criterion is declared fully accepted. This PR must remain draft until its gates are met;
automated tests and agent review do not supply independent human acceptance.

## Issue #81 local HITL review

Originating requirements: [#81](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/81).
Implementation and corrections remain on draft [PR #82](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/82).
Owner refinements: [fast-review scope](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/82#issuecomment-6225237637)
and [revision-472aee0 review](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/82#issuecomment-6225829634).
The PR's final verification reply is the durable record of full tested SHA,
exact commands, counts, limitations and current hosted-check links. A new commit
invalidates earlier revision-specific results; temporary local logs are not proof.

**Authorized first pass, not all-artifact acceptance:** AC-01 now defaults to
artifact category with blog grouping available. AC-03/04/07/14 use one explicit
human attestation and per-tab self-attested identity, retaining guide v1 and
revision-bound decisions. AC-05 prioritizes AI/coding tools, behavior definitions
and source-local occurrences, and prompt literal/context/usage. Polished editors
and semantic acceptance for mappings/TTPs/ATLAS/ATT&CK, timelines, summaries,
paths/nodes/edges, other annotation categories and telemetry/detection/instrumentation
are **deferred**. Generic item review remains available; no catalog entry, accepted
endpoint or supporting claim approves a derived record. Pending advanced records
stay withheld. No real Nx research acceptance or new campaign population is claimed.

| Criterion | Implementation / automated regression surface | Durable evidence / independent outcome |
|---|---|---|
| AC-01 organization | `src/review-ui.mjs` category/blog queues; `tests/hitl.test.mjs` stable identities/grouping/triage; `tests/workbench.test.mjs` support-return context | Final-revision command results on PR #82; independent category/blog walkthrough **needs-human-review**. Source/category selection never batch approves. |
| AC-02 evidence | `src/hitl.mjs` exact revision grounding; `src/review-ui.mjs` compact candidate/citations/context, span-aware repeated-evidence display; HITL grounding and rendered distinct-revision/location tests | Synthetic checks cannot establish actual source fidelity; independent evidence inspection **needs-human-review**. Private/missing passages are not fabricated. |
| AC-03 decisions/edits | `applyItemReview`, friendly `renderReview` fields; HITL transition/reason/edit-before-accept tests; mounted support/decision/reload tests; HTTP synthetic exercise | Each Save remains distinct from Accept. Independent priority workflow **needs-human-review**; advanced friendly editing deferred. |
| AC-04 checklist | `src/review-guide.mjs` guide-v2 confirmation; `docs/researcher-review-guide.md` retains v1; HITL checklist/confirmation/N/A/version consistency tests | Independent researcher judgment of one-action attestation/examples **needs-human-review**. LLM suggestions do not complete checks. |
| AC-05 coverage | `reviewUnits` covers registered core/optional/nested/annotation types; per-type synthetic accept/modify/exclude/defer tests | These are contract scenarios, not all-artifact UX/semantic acceptance. Priority types only for first pass; advanced coverage deferred as above. |
| AC-06 dependencies | `reviewSnapshot` support bindings/invalidation; transitive, unrelated-item, exclusion, stale, missing/cycle tests | No automatic support/downstream approvals. Independent dependency interpretation **needs-human-review**. |
| AC-07 audit/identity | `governance.localReview`, `runItemReview`, existing private lock/CAS/atomic transaction; HITL POSIX reload/concurrent-write/history tests; server HTTP disk persistence across server instances/stale/concurrent tests; per-tab identity tests | Filesystem tests must execute on POSIX, not be inferred from memory demo. Self-attested, not authenticated; independent audit inspection **needs-human-review**. |
| AC-08 queue/resume | navigation allowlist, bounded nested support-return trail, status filters, previous/history; mounted reload restores workload/category/group/source/filter | Independent keyboard, screen-reader and narrow-screen walkthrough **needs-human-review**. Navigation records no decision. |
| AC-09 eligibility | `reviewedProfile`, generated typed `profileSchema`, `queryProfile`; HITL/export suites cover optional/nested/redacted rows, closure, privacy, withholding and determinism | Final-revision independent Draft 2020-12 row-validation result on PR #82. Context-only case identities have no summary/acceptance. No publication or operational validation. |
| AC-10 verification/docs | Eight `project_commands`, retained command-contract assertion, focused HTTP/UI suites, `python scripts/verify.py`; README, architecture/setup/CLI, guide and changelog | Exact final-revision results/limits on PR #82. Hosted `action_required` is not success; required approval gates remain. Independent semantic/UX/accessibility/docs relevance and README applicability **needs-human-review**. |
| AC-11 progress | `progressSummary`, `renderProgress`; applicable-label/N/A, stable segment union, historical lower bound, mixed/stale/excluded/empty tests | Counts describe priority artifacts and disclose hidden evidence/exceptions/deferred records, not corpus approval. Human interpretation **needs-human-review**. |
| AC-12 exclusions | canonical rejection choice/rationale, originals/replacements/history retained; exclusion persistence/export tests; current Excluded badge test | Excluded is reviewed, not accepted or false/negative training data. Independent retained-history inspection **needs-human-review**; public rejection supplements remain deferred. |
| AC-13 provenance | audited correction and effective private projection; HITL original/edit/dependency tests; rendered tool identity consistency and no-product-merge test | Original LLM contribution survives acceptance. Independent badge/identity interpretation **needs-human-review**. Published preview remains frozen. |
| AC-14 guide | linked/embedded `researcher-review/2`, immutable historical v1 text; checklist/version consistency tests | Independent examples/rules review **needs-human-review**. No silent reinterpretation of old decisions. |

Synthetic HTTP/browser exercises must be identified as agent observations, not
independent human research approval. Existing native-Windows/non-pinned results
remain limited historical evidence in the owner's review; they do not substitute
for final pinned POSIX verification. Merge/publication, gate bypass, issue
reassignment and a second implementation PR are not authorized.

## Issue #77 Planning and historical asset relocation

Originating issue: [#77](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/77);
implementation and corrections: [PR #78](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/78).
The owner's explicit mixed-snapshot amendment preserves 20 files at
`a29de1822513b77d15b6fcf1c88dff147bf6140c` and two updated documents at
`a1cd31eef5ebe9dce7cf564e317cf5691a1343dc`; no archival branch edit is authorized.

| Criterion | Changed files / executed-check surface | Durable evidence / remaining acceptance |
|---|---|---|
| #77 AC-01 | [22-path inventory](archive/planning-assets-inventory.tsv), [disposition](archive/README.md#planning-and-asset-relocation--issue-77); remote ref and intake-base bytes/mode/blob/SHA-256/length comparison | Rechecked 22/22 against pre-removal intake base `a1cd31eef5ebe9dce7cf564e317cf5691a1343dc` and each actual preservation commit; exactly the authorized 22 paths are absent. This recheck does not independently attest the original comparison's timing. Final revision and scope evidence on PR #78; independent preservation review required. |
| #77 AC-02 | README/docs navigation, pinned source links and immutable Issue #25 image targets; Markdown/HTML target/fragment inventory against current and archived Git objects | Final-revision inventory/results on PR #78; no archived script execution or broad external-link claim. Independent rendered navigation/editorial/README-applicability review: **needs-human-review**. |
| #77 AC-03 | Before/after obligation map below; status and readiness retain Pending, rights, verification and historical limitations | Original issue-qualified criteria, revisions and failed/pending outcomes remain pinned; human traceability review: **needs-human-review**. |
| #77 AC-04 | Documentation-only diff, static runtime/config/workflow dependency inspection; `python scripts/verify.py` executes all seven configured application commands | Exact final SHA, environment, command exits/counts and latest hosted Verify/PR Policy belong on PR #78, not a stale self-certification here. No runtime, evaluator, config or policy changes. |
| #77 AC-05 | Archive index, root CHANGELOG and navigation; one originating issue/PR | Independent scope/docs/README review and human approval required before merge. Record resulting full source/release candidate SHA after merge; release publication remains unauthorized. |

### Issue #77 retained obligations

Before/after inventory of the seven removed narratives: the linked originals
remain evidence authorities, while the following current homes keep outcomes
visible. No merged PR or relocated narrative promotes a pending result.

| Removed source / original evidence | Current home and retained outcome |
|---|---|
| [Attack-path PRD](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a1cd31eef5ebe9dce7cf564e317cf5691a1343dc/docs/PRD-ATTACK-PATH-MAPPING.md#stable-acceptance-criteria) | [#46](#issue-46-node-scoped-attack-path-exploration) keeps #46 AC-01–AC-09 / AP-01–AP-09: supported graph/mappings, interaction, accessibility, evidence traversal, export closure, final checks and independent review. Original planning base `a03fb8a`, consolidation `f15a8d806c4e2213896da1070dce218c881e5cc5`; the synthetic concept is not acceptance. |
| [Batch PRD](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/PRD-BATCH-WEB-INTAKE.md#acceptance-criteria) | [#39](#issue-39-batch-article-intake-and-private-campaign-corpus) retains #39 AC-01–AC-07, planning base `d404855`, successful live CLI **and** browser requirements, ignored/private archives, inert HTML and Pending sidecars. Historical WSL retries and failed cloud/DNS attempts remain distinct, not universal publisher success. |
| [Campaign PRD](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/PRD-CAMPAIGN-EXTRACTION.md#initial-evaluation-set) | [#45](#issue-45-passage-grounded-campaign-extraction) keeps #45 AC-01–AC-11; **AC-10 remains fail**. Protect the original three revisions and frozen human-authored gold (including explicit absences), compare per-revision coverage/exact quotations/discrepancies, and obtain independent semantic review before talk use. Original hashes/code-point counts remain in the pinned evaluation table; no refetch substitution. Mixed Shai-Hulud/s1ngularity grouping is not one campaign or permission to merge/relabel cases. Raw text and evaluation outputs remain private. |
| [Documentation plan](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a1cd31eef5ebe9dce7cf564e317cf5691a1343dc/docs/documentation-plan.md#59-stable-acceptance-and-durable-evidence), PR #65, inspected main `53c10b5c4e607c93530c637ec4e7b0d47c05573a` | #59 AC-01 inventory/destinations/stewards, AC-02 talk-workflow navigation and Pending distinctions, AC-03 IDs/evidence/privacy/frozen integrity, AC-04 ownership/sequence/visual placement all retain independent inventory/editorial/research/traceability/coordinator review requirements. Historical assignment locks are not current authorization; #62 visual placement and #73 handoff disposition remain superseding decisions. |
| [Usability review](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/usability-review.md#remaining-researchproduct-boundaries), 2026-10-13 / PR #47 | [Current status](status.md) retains human confirmation of inventory consolidation, deferred durable curation and lexical-grouping limits. Partial private-corpus walkthrough is not current capability, extraction completeness, independent accessibility or deployment acceptance. Original tested revision/results remain on PR #47; do not copy dated missing-feature observations into current claims. |
| [Documentation evidence ledger](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md) | Issue-qualified pending documentation criteria and original check outcomes are retained immediately below. [Readiness](release-readiness.md#mandatory-owner-decisions-and-observable-completion) keeps current review/rights/release roles and completion conditions. |
| [PR #52 session narrative](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/archive/workbench-session-recovery.md#recovery-procedure-and-validation-limits), 2026-10-14 | [#51](#issue-51-article-aliases-and-campaign-graph) and #46 below retain #51 AC-01–AC-07 / AP-01–AP-09, failed collection, literal provenance, no inferred chronology/merging and uncommitted-work limitations. Windows `9ae064127434f9bd0740befeb1fedb17c8ee462c` **plus uncommitted work**, Node 22.15.0 vs pin 22.23.3: six focused tests passed, full verifier failed. The later AP-01 diagnosis was an ambiguous substring test lookup, not permission to change valid graph behavior or weaken assertions. |

The archived [documentation ledger](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md#other-preserved-documentation-evidence)
retains complete historical evidence, not fresh #77 test results:

| Origin / current unresolved criteria | Original revision-bound results and evidence |
|---|---|
| #61 AC-01 five workflow stages, AC-02 worked-example provenance, AC-03 capability maturity, AC-04 research boundaries, AC-05 navigation | [PR #67](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/67), `33eca1fd7928023bc71d824d026ee01df03efef7`: 93 link/anchor/provenance checks; local verifier exit 1 (46 Python, 371/372 application), direct extraction 97/97. Hosted Verify/PR Policy subsequently passed at the same SHA (46 Python/372 Node, zero failures/skips). Independent methodology, research, technical/editorial and rendered navigation/README relevance decisions remain **needs-human-review**. |
| #60 AC-01–AC-07 first-use/README/navigation/visual/verification criteria | [PR #66](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/66): initial `cc601575eb11a7d7672862bb176a3c139471e1cd` local launch/navigation/assets checks plus Git-filtering verifier failure; final corrected `6638c7f10d94090fda2db9340d75b7e908e00df9` hosted Verify 46 Python/372 Node, zero failures/skips, and PR Policy passed. Live Codespaces, desktop/mobile rendering and independent review remain outstanding. Later visual placement superseded, not accepted retrospectively. |
| #62 AC-01–AC-08 visual hierarchy, technical recipes, accessibility/editorial and README review | [PR #68](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/68), `6bc27a11ec1024b4b457c336a89bc918e86004e3`: hosted Verify 46 Python/372 Node, zero failures/skips, and PR Policy passed. Earlier local Git-filtering failure and recipe-retest limits remain; independent technical/editorial/accessibility/visual/README review is **needs-human-review**. |
| #63 AC-01 navigation, AC-02 before/after traceability, AC-03 AC/revision/failure/pending evidence, AC-04 frozen integrity, AC-05 governance/editorial/links, AC-06 compatibility anchors | [PR #69](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/69) owns original final-SHA checks; the removed ledger does not supply a final tested SHA. Independent navigation/README, traceability and governance/editorial decisions remain **needs-human-review**. Fourteen manifest mismatches and two unavailable documents remain unresolved. #77 supersedes location preservation only for its 22 paths. |
| #30 AC-01–AC-03 and #31 AC-01–AC-04 architecture criteria | [Pinned pre-split architecture](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md#retrieval-trust-boundary-and-finite-bounds) and [studio formats](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a741924a776bff0a0ea17b7920a7282320d2caaf/docs/architecture.md#studio-boundary-and-proposal-formats) retain original evidence and limitations, not new acceptance. |

The original #58 coordinator handoffs, model-request/unknown-effective-model
metadata and review destinations remain in the pinned originals. A human must
carry current PR/SHA/checks/blockers/next actions forward; agent self-audit is not
independent proof. Pending research, protected evaluation, rights, missing frozen
references, platform limits and release gates remain open after removal.

## Issue #73 Handoff relocation

Requirements: [#73](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/73);
implementation/corrections: [PR #74](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/74).
Prerequisite [#75 / PR #76](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/76)
merged at `a29de1822513b77d15b6fcf1c88dff147bf6140c` and was merged into this
branch before deletion. Exact path authorization and evaluator/workflow gates
are unchanged. This task does not approve a release or remove public history.

| Criterion | Files and executed-check surface | Durable evidence / remaining acceptance |
|---|---|---|
| AC-01 | [Inventory](archive/handoff-inventory.tsv), [archive disposition](archive/README.md#handoff-relocation--issue-73); remote ref + per-path mode/blob/byte/SHA-256 comparison | Before removal: 45/45 match both `651bbb38f1372dc159a89073ce27c09cf6472541` and the immutable archive SHA, no differences. Exact commands/results and final SHA on PR #74. Independent preservation review remains required. |
| AC-02 | Unchanged runtime/CLI/Codespaces; `python -m unittest tests.test_archive tests.test_policy`; `python scripts/verify.py` runs all seven configured application commands; static dependency inventory and bounded public/synthetic browser smoke | PR #74 records final SHA, environment, exact exits/counts and browser evidence/limitations. Static inventory alone is not runtime proof. Live Codespaces/private forwarding and independent human usability review are not established by local smoke. |
| AC-03 | README, archive, architecture/data-model, attack-path PRD, original disposition-plan annotation; pinned links; `tests/test_archive.py` | Automated inventory verifies pinned targets; original historical text/IDs/outcomes remain dated. The owner's NOT_PLANNED disposition for issues #26–#29 supersedes their former pending reference edits; [historical requirements context](archive/README.md#open-requirement-reference-replacements) remains available. No implementation acceptance is implied. Independent editorial/traceability/README-relevance review remains required. |
| AC-04 | Merged trusted base #76; authorized removals only; existing policy regression rejects unmapped/new handoff paths | Current-head hosted Verify and PR Policy results/base/head belong on PR #74. Agent fixture checks are not hosted policy or independent approval. Human approval required before merge. |
| AC-05 | [Readiness boundary](release-readiness.md#post-audit-source-boundary--issue-73), preview preparation annotation, root changelog; candidate `git archive` inspection | PR #74 records full candidate SHA and zero handoff members versus 45 in archive snapshot. Earlier release checks invalid for the new tree; default branch changes only after human merge. Pending research, rights and readiness decisions remain open; independent human release-boundary review required. |

All final-revision command results must be read with the full tested SHA on
PR #74 and its [Actions/checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/74/checks).
Local `/tmp` logs alone are not durable evidence. New commits invalidate previous
verification. No new learning is warranted for a relocation with unchanged runtime.

## Issue #53 Codespaces Workbench

Originating requirements remain [#53](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/53);
implementation and corrections stay on [PR #55](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/55).
Prerequisite [PR #57](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/57)
landed on `main` as `9c555ce9726f64d11c73b1fed0505dcbdd9041c7` and was merged into
this branch before implementation. No new mapping or evaluator policy is added.

| Criterion | Files and focused checks | Durable evidence / remaining acceptance |
|---|---|---|
| AC-01 | `.devcontainer/Dockerfile`, `Dockerfile.dockerignore`, `devcontainer.json`, `workbench.py check`; `tests/test_devcontainer.py` pin/check regressions | Record exact final SHA, image build, fresh Codespace and rebuild version/dependency output on PR #55. Local versions and static checks are partial only; actual Codespaces provisioning remains blocked/unverified without access. |
| AC-02 | `postStartCommand`, bind-message + HTTP readiness, repeated/concurrent start/restart tests | Record fresh creation, stop/start and rebuild HTTP results on PR #55; human browser and explicit synthetic-demo walkthrough required. Local process checks do not prove forwarding/browser compatibility. |
| AC-03 | Single labeled forwarded port, no automatic private arguments/credential environment, protected lifecycle files and pin-only build context; unchanged server regression suite | Private is a Codespaces platform default, not enforced by the label. Human signed-in/signed-out access review and ignored/permission-restricted optional store review remain required. No credentials, private research or credential-bearing URLs in evidence. |
| AC-04 | `workbench.py` lock/process identity, nonzero failures, log and stop/restart recovery; real occupied-port, stale-PID, repeated-start and permissions tests | Final-revision local lifecycle command results go on PR #55; actual Codespaces failure/recovery remains unverified until executed there. |
| AC-05 | `README.md` creation/preview/lifecycle/troubleshooting/private stores/billing; `docs/setup-and-configuration.md`; root `CHANGELOG.md` | Independent human usage and documentation relevance/accuracy review required; agent self-audit and content-presence checks are not acceptance. |
| AC-06 | Unchanged server and existing `project_commands`; authoritative `python scripts/verify.py` discovers new Python checks and all seven configured Node suites | Record exact commands, results, final tested full SHA and limitations on PR #55 after the last commit. Any new commit invalidates revision-specific evidence. |

AC-01–AC-06 are not declared complete by this file. The originating PR is the
durable revision-bound command/evidence record. Fresh Codespace creation,
stop/start, rebuild, private-access, browser and independent review outcomes stay
**blocked/unverified** when unavailable, even if every local automated check
passes. No merge or automated approval is authorized.

## Issue #51 article aliases and campaign graph

Originating requirements: [#51](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/51).
Implementation and corrections stay on [PR #52](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/52),
based on `data/nx-corpus` (`a79e05f101abc5cf201b08f799a1f3f8f77561b8`).
The prerequisite is incorporated, not reimplemented; its historical verification
is not evidence for changed code. AP-01 through AP-09 retain their existing meaning.
The PR's revision-bound verification comment records the final full SHA, exact
commands/counts and hosted check URLs after the last commit.
The hosted PR Policy workflow runs only when the target is the repository default
branch. While this PR targets `data/nx-corpus`, a skipped or approval-blocked policy
run is not trusted-base enforcement proof. Human prerequisite approval and the
normal default-branch policy gate remain outstanding; this task does not change
workflow conditions, approve runs or bypass that boundary.

| Criterion | Implementation / observable boundary | Executed evidence to record on PR #52 | Remaining independent acceptance |
|---|---|---|---|
| AC-01 | `scripts/contract.mjs`, `src/research-inventory.mjs`, `src/render.mjs`: bounded robots compatibility and logical article aliases; original routes, revisions and failures retained | `tests/intake.test.mjs`, `tests/article-display.test.mjs`: applicable policy/denial, redirects, alias retries, citation closure, safe links and nonmutation | Protected operator-triggered live Red Canary and Zscaler checks; historical Red Canary failure cause is not inferred from Zscaler policy |
| AC-02 | `src/explore.mjs` and campaign presentation: same-case read-only graph across retained phase paths, no invented linking edges or shared support | Synthetic workbench multi-path, repeated occurrence, conflicting classification, case isolation, mapping-support and digest checks | Human research review of chronology, attribution and attempted/completed interpretation |
| AC-03 | Friendly activity/phase names; technical provenance and canonical path/member routes retained | Workbench named/unnamed/collision/stale target fixtures, evidence return, revision selection, reload/back/forward regressions | Human graph-to-evidence-to-return walkthrough with protected corpus |
| AC-04 | Compact named icon controls and discoverable non-drag pan/move actions, deterministic bounded reset | Synthetic DOM/pointer/keyboard checks; responsive/theme/reduced-motion browser observations recorded separately, never inferred from unit tests | Independent screen-reader, keyboard and touch usability review |
| AC-05 | Evidence/origin/review axes, activity icons and card-boundary connector routing retain independent support | Graph geometry fixtures and workbench inspection checks for branches, reversed edges, cycles, self-loops, disconnected/long/moved nodes | Human visual/semantic acceptance against prototype; geometry fixtures alone are not visual proof |
| AC-06 | One expandable overview per campaign; linked claim context and uncertainty, normalized research links and honest public withholding | Synthetic empty/partial/shared-source/mixed-status summary, support closure, alias citations and expansion checks | Human overview/research review; projected context is not accepted summary evidence |
| AC-07 | Existing public/private export and review contracts, mapped application surfaces, safe DOM rendering | Fresh `python scripts/verify.py`, relevant campaign/citation suites, tracked-file/secret scan, code/security validation; exact final SHA and hosted Verify/PR Policy URLs on PR | Human documentation relevance, privacy/research approval and required hosted checks; no merge/deployment authorized |

All independent outcomes above remain **needs-human-review** until an authorized
human records durable decisions. A successful synthetic fixture or agent browser
observation does not establish live access permission, research truth, accessibility,
visual parity, documentation accuracy or review acceptance. If a check is blocked,
record the failure/limitation rather than substituting a prior revision's result.

### Campaign presentation follow-up evidence

The user's UI refinements are covered without changing AP-01–AP-09 or AC-01–AC-07:
`tests/workbench.test.mjs` adds Issue #51 follow-up regressions for concise campaign
cards and single source navigation, framework-catalog exclusion from the article
library, exact published prompt variants and source citations, grouped non-merged claim navigation,
collapsible behavior and relationship tiles, and initial phase-focused graph controls.
`README.md`, `docs/architecture.md` and the root changelog describe the resulting
public presentation. These automated checks do not prove prototype parity, content
accuracy or accessibility; independent visual and keyboard/touch review remains
`needs-human-review` on the final tested revision.

The user-directed prompt follow-up replaces activity-claim cards with published
literal prompts. `src/public-profile.mjs` validates source/revision/claim closure,
locator coverage, bounded text and unique artifact identities; `src/explore.mjs`
renders each exact variant once as text with source-specific provenance.
The public campaign card links to these entries and opens expanded, shows a
bounded claim-backed summary, and puts AI references before compact behavior links.
`tests/workbench.test.mjs` covers literal equality, source filtering/navigation,
invalid support/locators, identity collisions, text-only rendering and the absence
of claim descriptions in the prompt view. Wiz's retained article contains no
complete literal, so activity reports are not relabeled as a Wiz prompt.

On 2026-10-14, read-only `node --input-type=module -` checks using `readableHtml`
and `sha256` confirmed that live StepSecurity and Socket text matched normalized
revision hashes `40365a366c3b84b99356a23be3ffaab56883915f4daaa3b8337434f47ac4fb1f`
and `be9fa7a0348a6fdd8f5cd18cee0d897493bff5481957e5c0c26f0a0ec67850b1`.
The exact extracted spans are StepSecurity `[27428, 28196)`, Socket
`[4163, 4600)` and Socket `[7073, 7841)`. This is agent extraction evidence,
not independent human content or documentation approval. The corpus snapshot
digest and typed export are unchanged; published prompt literals are additional
display artifacts, not new accepted corpus records.

Prompt follow-up validation on
`9ae064127434f9bd0740befeb1fedb17c8ee462c` plus the uncommitted changes
(Node 22.15.0, Windows; pinned Node is 22.23.3):

| Command | Executed result |
|---|---|
| `node --test --test-name-pattern="Issue #51 follow-up\|Issue #51 public prompt" tests/workbench.test.mjs` | 6 passed, 0 failed |
| `node --check src/public-profile.mjs`, `node --check src/explore.mjs`, `node --check src/app.mjs` | Each exited 0 |
| `git diff --check` | Exited 0 |
| `node --input-type=module -` with the read-only source hash/literal comparison | All 3 source occurrences matched their normalized revision hash and exact locator text |
| `python scripts/verify.py` | Exited 1: governance 35/35, contract 46/46; intake 5/39, extraction 34/97, review 1/46, exports 10 passed/1 skipped, workbench 117/119, server 6/14 |

The verifier is not green: Windows private-path/temp-directory failures and the
existing AP-01 route-callback assertion remain. A broader name-filtered run also
hit the existing test-file `FakeDocument` initialization-order limitation; the
complete configured workbench run passed the prompt tests. Browser inspection
at `http://127.0.0.1:4181/#prompts//` showed two wrapped literal blocks,
three source citations, zero activity cards and zero cited-claim buttons without
horizontal overflow. This agent smoke check is not independent human review.

## Issue #46 node-scoped attack-path exploration

Originating implementation requirements: [#46](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/46);
the merged [PRD](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a1cd31eef5ebe9dce7cf564e317cf5691a1343dc/docs/PRD-ATTACK-PATH-MAPPING.md) remains context. Extraction and grounded
mapping contracts are reused from merged #45/#48 work; no provider, catalog
resolution, persistence, review workflow or public publication is introduced.
Corrections stay on the originating implementation PR. Its revision-bound
progress record must give exact final commands, full SHA, synthetic browser
results and hosted Verify/PR Policy links; a new commit invalidates earlier checks.

The focused `AP-01/07 source revision changes retain path context through reload
and back/forward` regression in `tests/workbench.test.mjs` covers revision URL
changes, saved history state, return selection/filter restoration, same-case
evidence, ordinary source navigation and unchanged corpus digest. It does not
replace independent browser/accessibility or protected research acceptance.

| Stable alias | Outcome and implementation/test evidence | Acceptance result and remaining evidence |
|---|---|---|
| AC-01 = AP-01 | `src/app.mjs` related history/context and `src/explore.mjs` invalid/no-path states; `tests/workbench.test.mjs` AP-01 routes, active graph-search evidence traversal, reload/back/forward, invalid/retired saved context, mixed-case and no-path regressions | `needs-human-review`: final executed fixtures plus independent navigation review |
| AC-02 = AP-02 | Case-scoped support/conflicts and separate named edge inspection; AP-02 unsafe/mixed-case tests and AP-08 export-scope negatives | `needs-human-review`: supported nodes must not imply supported edges; human origin/uncertainty review |
| AC-03 = AP-03 | `nodeMappings` checks every claim, behavior, path/node and retained catalog/version; AP-03 valid/invalid/no-match fixtures; mapping scope labels in private exports | `needs-human-review`: independent rationale/applicability and unresolved literal interpretation |
| AC-04 = AP-04 | Existing SVG with distinct directed sequence/conditional/propagation geometry, visible loop labels and full text inspection; branching/cycle/self-loop/disconnected AP-04 fixtures | `needs-human-review`: final desktop/tablet/mobile light/dark browser evidence and human visual review |
| AC-05 = AP-05 | Stable SVG attributes, bounded zoom/pan/node positions relative to reset fit, deterministic fit, explicit grips, pointer-ID/cancel/capture-loss lifecycle, click suppression; AP-05 repeated/extreme pointer and button controls, stable selection/focus and unchanged corpus digest | `needs-human-review`: final pointer/touch/browser checks plus independent interaction review |
| AC-06 = AP-06 | Named Enter/Space controls, selected/focused cues, non-drag pan/move/reset, complete text support and concise live status; AP-06 selection/DOM identity tests | `needs-human-review`: independent screen-reader/focus/accessibility review remains unmet |
| AC-07 = AP-07 | Return-to-selection through claims/sources/behaviors/frameworks/telemetry/OTEL, same-case projections, published/proposed/synthetic distinctions and inert imported text; AP-07 traversal/shared-behavior/detection-only regressions | `needs-human-review`: independent protected real-campaign walkthrough and semantics review |
| AC-08 = AP-08 | Case-wide talk JSON/Markdown includes paths/support, mapping scope/catalogs, framework parents, source/revision provenance and exact passages; `tests/exports.test.mjs` checks standalone shared-behavior claim/occurrence projection, limit labels, complete same-case closure, no canonical mutation and invalid scope; private-store ignore boundary unchanged | `needs-human-review`: final executed closure/tracked-file checks and independent private-bundle review; full article bodies stay in protected campaign export |
| AC-09 = AP-09 | Focused tests, README usage, architecture and substantive CHANGELOG; `python scripts/verify.py` runs scaffold and all seven configured application commands, with additional campaign suites run directly | `needs-human-review`: exact final-SHA command results and hosted checks required; independent research/UX/documentation relevance review and approval before merge remain unmet |

Requested implementation setting is advisory GPT-6.1 Sol / High. The effective
main-session model/reasoning setting is not exposed here and is unknown; no Auto
fallback or model configuration is assumed. Synthetic cloud checks do not establish
real campaign accuracy, independent accessibility or human acceptance. No private
article bodies, corpus content or private screenshots may enter Git.

Follow-up corrections address [review comment 6159260454](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/50#issuecomment-6159260454)
on this same PR. Focused synthetic probes and fixture tests are not production
browser or independent acceptance evidence. This cloud follow-up's browser MCP
requires browser-based OAuth, so desktop/narrow light/dark, touch and screen-reader
checks remain unmet until an authorized session executes them. The final SHA,
exact command/count results and fresh hosted-check links belong in that PR's
revision-bound progress/reply record, not a self-referential commit assertion here.

## Issue #48 grounded self-loops and unresolved mapping provenance

Originating requirements: [#48](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/48);
implementation and corrections stay on [PR #49](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/49).
Durable revision-bound command results, counts and the final full SHA belong in
that PR's progress/evidence record and [hosted checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/49/checks),
not a self-referential commit assertion here. Each new commit invalidates earlier
test evidence. Pending/approval-required hosted jobs are not passing evidence.

| ID | Files and executed-check targets | Independent evidence still required |
|---|---|---|
| AC-01 | `src/campaign-records.mjs` endpoint/support checks; `tests/campaign-records.test.mjs` source-supported/inferred loops, cycles and invalid edges; `tests/campaign.test.mjs` normalize/validate/atomic apply/status/export equality | `needs-human-review`: relationship semantics, no invented repetition/chronology/causality |
| AC-02 | Shared `validateMappingScope`; campaign record and no-write tests repeat paired-ID, unknown path/node, wrong behavior, mixed-case and all-claim negatives for a catalog hit, unknown ID/version and unsupported literal; positive node/broad candidates | `needs-human-review`: human scope/behavior interpretation; executed command evidence on final SHA |
| AC-03 | Unresolved normalization and `validateRunMappings`; integration tests assert exact field equality, pending provenance, Unicode/hostile Markdown, no-match and dependency closure; rehashed malformed run negatives | `needs-human-review`: rationale/applicability, exact metadata and authorship review |
| AC-04 | Versioned extraction/run/record identities; baseline-generated `tests/fixtures/benign/campaign-run-v1.json` reattaches unchanged catalog/inputs and verifies its original hash; tests cover unavailable/broad metadata, no reconstruction/write, old replay, new IDs/supersession, collision and stale base; configured manual extraction/sidecar suites | `needs-human-review`: historical/manual compatibility; executed final-revision regressions |
| AC-05 | Existing private-store atomic update and case-wide export helpers unchanged; campaign invalid-input byte/digest comparisons, original manual/review/source preservation and export closure; configured contract/review/export/server tests | `needs-human-review`: independent isolation, pinned-provenance and compatibility review |
| AC-06 | Updated README campaign usage, architecture and root CHANGELOG; direct campaign command plus pinned-runtime verifier; PR #49 final-SHA results and hosted Verify/PR Policy checks | `needs-human-review`: independent documentation relevance/accuracy, semantic gold/research review and approval before merge; missing hosted evidence remains unmet |

Required final commands are `node --test tests/campaign-records.test.mjs tests/campaign.test.mjs`
and `python scripts/verify.py` (which executes every configured application command),
on Node 22.23.3 in the supported POSIX private-file environment. Native Windows
file-URL and permission limitations are not repaired or reported as passes.
Fixture automation establishes contract behavior, not factual extraction quality.
No private source bodies, evaluation material or conversation details belong here.

After this prerequisite is independently reviewed and merged, #46 remains the
originating graph/navigation/accessibility implementation issue. Preserve AP-01
through AP-09 and their AC aliases for node/edge inspection, stable selection and
return context, focus/non-drag alternatives, gesture cancellation, responsive/theme
rendering and scoped presentation inside existing case-wide private exports.
Normalized behavior and AI tool/prompt groups are presentation projections:
retain source-specific IDs, exact literals, usage labels and provenance. Current
resolver references and historical catalogs remain distinct from recorded mappings.
Selected-path-only export is deferred, and real-output use still needs independent
human semantic gold acceptance and research/accessibility review.

### ATLAS reference catalog and evidence readability (PR #47)

AC-06: `tests/campaign-records.test.mjs` checks ATLAS membership, wrong-version/ID
failures, absent source literals, official name and Pending inferred mapping
provenance. The projection pins 208 official techniques/sub-techniques with raw
SHA-256 and Git blob hash; source hashes were verified before generation. Current
resolver catalogs do not replace historic run snapshots or create mappings.
AC-09: `tests/workbench.test.mjs` checks compact citations still navigate to exact
claim/revision targets, collapsed IDs and undated entries remain retrievable, and
review symbols/accessible labels distinguish Pending from attack outcome. The
catalog disclosure/search test checks reference counts separately from mappings
and unchanged corpus content. These are implementation checks, not independent
semantic or UX acceptance. AC-10 human-authored frozen gold and independent review
remain unmet; final executed commands/SHA and browser checks are recorded on PR #47.

### Card spacing and publisher follow-up (PR #47)

Publisher regressions cover explicit HTML publisher declarations, canonical
domain migration, raw metadata preservation, legacy Red Canary identity and
matching Publisher facets without source mutations. Variable-height card spacing
and source usage backgrounds require browser geometry/visual checks in addition
to the configured application suites. Existing revision hashes remain frozen;
new metadata extraction uses readable-html/5. Independent UX review remains open.

### Campaign/source card alignment (PR #47)

`tests/workbench.test.mjs` covers one expandable card per case, one card per blog,
many-to-many campaign tags, no corpus mutations, usage-color accessible labels,
Amazon Q executable alias normalization with raw literal retention, source-local
behavior links and category headings separate from behavior titles. These are
implementation regressions; independent UX/research review remains required.

### AI-tool and prompt library follow-up (PR #47)

The user-requested follow-up adds private views and campaign-card links for
grounded AI products and exact prompts. `tests/workbench.test.mjs` verifies known
aliases, ambiguous executable isolation, exact prompt variants, case/source/search
scoping, member-ID navigation, source citation clicks and private talk export.
`tests/campaign-records.test.mjs` verifies usage enum rejection and unsupported
literal rejection. These checks establish implementation behavior, not incident
truth or a detection's effectiveness. Vendor URL intake may remain blocked by the
normal robots policy; no bypass is authorized. Retained revisions can still be
used for independent implementation exercises. AC-10 frozen human gold and
independent semantic review remain unmet until supplied by a human reviewer.

For every issue criterion, record a stable ID, observable outcome, changed-file evidence, verification method, result, and durable evidence reference. Use only `pass`, `fail`, or `needs-human-review`. Do not label a subjective judgment as an automated pass.

Evidence is revision-bound. Record the full tested commit and relevant CI/local command results and links, then refresh all results after any new commit. Automated criteria require actual command/check execution; a declared command or green result copied from another revision is not proof. Subjective criteria need a named human's review and decision before merge.

The PR policy reads GitHub's linked-issue and complete changed-file metadata: it requires exactly one open linked issue with stable acceptance IDs, mapped changed paths, documentation/root changelog upkeep for application/governance changes, configured README triggers, and a same-PR learning-index update when a learning note changes. It uses the exact trusted base's evaluator/configuration; patches are untrusted data, not commands or proof of quality. It does not read the PR body or comments, run tests, certify acceptance outcomes, or replace code review. The independent `Verify` check runs scaffold and configured application commands on the PR revision. Require both checks and human approval through repository settings; policy passing alone does not imply verification passed. A local fixture is only a test of the evaluator. On a new repository, hosted PR Policy is unavailable until that workflow is on the trusted default branch. See [applicability and bootstrap](setup-and-configuration.md#documentation-upkeep-policy).

## Issue #45 passage-grounded campaign extraction

The researcher-requested UI follow-up makes the source library a card overview
with case/article/claim/path/behavior navigation while retaining exact source-ID
routes. Focused workbench regressions cover direct behaviors without paths,
article-filter isolation, independent sources, safe imported titles, and explicit
resolver-reference/unresolved/mapping distinctions in the TTP view. No missing
ATLAS catalog or candidate mapping is filled with legacy incident assertions.

The originating requirements are [Issue #45](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/45).
Implementation and corrections remain on draft [PR #47](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/47),
which closes that one issue. Exact command output, the final full commit SHA and
safe aggregate private-evaluation results belong in revision-bound PR comments;
hosted evidence belongs under [PR #47 checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/47/checks).
The cloud session stopped with a failure before final verification. Its initial
run state is not passing evidence; current hosted results must be inspected for
the latest head. Same-PR fixes are authorized, while merge and public corpus
publication still require a person.

Local follow-up reproduced and fixed behavior annotations that promoted
potential/disputed claims to observed activity, and node-scoped mappings that
accepted additional claims outside the node's support. Three focused synthetic
regressions demonstrate those boundaries. Full final-revision commands, SHA and
hosted results are recorded in the PR description rather than a self-referential
commit assertion here.

The original three retained revision hashes were verified in a protected local
copy. Preparation covered 25 segments with no unavailable sources. A deliberately
partial source-grounded smoke candidate exercised validation, atomic apply,
idempotent replay, JSON/Markdown exports and browser evidence presentation:
four exact quotations from three examined segments remained pending, case count
and review history stayed unchanged, and all remaining segments were explicitly
skipped. This is pipeline testing, not completed corpus extraction or human gold
evaluation. No frozen human checklist was present; AC-10 remains unmet.

The configured Codex chat handoff is the only model/provider integration.
`GPT-6.1 Sol High` is requested advisory metadata for the implementation; the
effective main-chat setting is not exposed and remains unknown. This is distinct
from any implementation agent's model. Synthetic automated checks cannot
establish factual extraction quality. All semantic, research, mapping-rationale,
UX, accessibility, visual and documentation judgments below remain
`needs-human-review`, regardless of later automated results.

| ID | Observable implementation and synthetic automated evidence | Current result / durable evidence still required |
|---|---|---|
| AC-01 | `src/campaign.mjs` `prepareCampaign` and `scripts/extract.mjs` campaign CLI; `scripts/server.mjs` prepare route; `tests/campaign.test.mjs` and server cases cover existing-case selection, source/revision deduplication, last-retained policy, explicit revisions, bounded code-point segments, unavailable text and unchanged associations | `needs-human-review` — execute configured final-revision checks; protected real-set coverage and human mixed-grouping review remain required |
| AC-02 | `CAMPAIGN_PROMPT`, request/provider metadata, exported `candidateGuide`, strict request hash/reconstruction and 2 MiB bounds in `src/campaign.mjs`; `tests/campaign.test.mjs` uses hostile synthetic text/no adapter, while `tests/workbench.test.mjs` exercises the two-step handoff and unknown model disclosure | `needs-human-review` — no executed final-revision evidence yet; human prompt/provider disclosure review required |
| AC-03 | `resolveQuote` locally derives half-open code-point offsets from exact supplied segment quotes/occurrences; request and revision hashes fail closed. `tests/campaign.test.mjs` covers long Unicode segmentation, repetition/occurrence, tampering and staleness | `needs-human-review` — execute checks and programmatically validate every protected-set quotation; independent semantic review required |
| AC-04 | `normalizeCandidate` and `src/campaign-records.mjs` preserve atomic source-local claims, overlapping roles, literal/normalized artifacts, inference support, null reasons and reciprocal conflicts; `tests/campaign.test.mjs` and `tests/campaign-records.test.mjs` use strict benign fixtures | `needs-human-review` — synthetic structure is not factual completeness; private frozen-gold comparison and human review of every factual claim required |
| AC-05 | `normalizeCampaignRecords` requires claim support for behavior occurrences and every path node/edge, labels inferred edges and allows an unordered-only behavior set; `tests/campaign-records.test.mjs` contains supported/inferred/unordered graph cases | `needs-human-review` — execute final checks; independently review relationships, chronology and cross-source semantics |
| AC-06 | `src/framework-catalog.mjs` freezes resolver version/digest/full pin and membership into each request; `src/campaign-records.mjs` requires exact built-in membership, deterministically separates the official catalog source, rejects collisions and emits invalid/source-literal IDs as unresolved. `tests/campaign-records.test.mjs` covers the narrow snapshot and resolution boundary | `needs-human-review` — a reported focused run occurred before a committed final revision and is not accepted evidence; independently review catalog provenance, rationale and applicability. Initial projection is only ATT&CK 19.2 T1059 |
| AC-07 | Candidate normalization separates article-mentioned/proposed telemetry and published references/hypotheses, disables unaudited templates, and restricts OTEL to inert allowlisted synthetic values. `tests/campaign-records.test.mjs` covers pending labels, empty template allowlist and unsafe samples | `needs-human-review` — execute checks; human gold, labeling and proposal/deployment-boundary review required |
| AC-08 | `applyCampaign` plus review-aware `updatePrivateCorpus` publishes core records and the versioned `governance.campaignExtraction` run in one locked atomic `corpus.json`; `tests/campaign.test.mjs` covers replay, staleness, collision/tampering, lock/interrupted-file behavior, private paths and prior manual/history preservation | `needs-human-review` — final POSIX execution and review-staleness inspection required |
| AC-09 | `campaignStatus`, `campaignAnnotations` and dependency-closing `campaignExport`; same-origin bounded server routes and workbench integration in `scripts/server.mjs`, `src/app.mjs`, `src/studio.mjs`; `tests/campaign.test.mjs`, `tests/exports.test.mjs`, server and workbench suites cover closure, escaped Markdown, route/file bounds, pending status and JSON/Markdown paths | `needs-human-review` — reported pre-final focused results are not final evidence; execute checks, then independently inspect exact passages/literals and browser behavior at 1440×900, 1024×768 and 390×844 in light/dark themes with keyboard traversal |
| AC-10 | Protected evaluation procedure and safe reporting boundary are documented in `README.md`; retained revisions were hash-verified and partial pipeline smoke tested locally, preserving private baseline and pending state | **fail** — comprehensive extraction, frozen human gold measurement and independent human research review remain outstanding; partial smoke coverage is not acceptance |
| AC-11 | Usage, architecture, this matrix and substantive `CHANGELOG.md` map the implemented boundary; existing and focused campaign suites are configured through `python scripts/verify.py` | `needs-human-review` — record exact commands/results and final full SHA only after the final commit; hosted checks are currently unapproved/`action_required`; independent documentation relevance/accuracy review required |

Automated command success does not close the composite human-review criteria. Fresh execution must include
`python scripts/verify.py` and every configured application command on the final
full SHA; a later commit invalidates that evidence. The private POSIX exercise
must copy and protect the pre-evaluation store, retain baseline and gold hashes,
and never refetch replacement data. Its terminal/PR record may contain only safe
counts, hashes and discrepancy summaries, never retained text. Browser evidence
must include desktop 1440×900, tablet 1024×768, mobile 390×844, light/dark and
keyboard results. Agent self-audit cannot satisfy any independent review.

## Issue #39 batch article intake and private campaign corpus

### Researcher-requested local presentation follow-up

The researcher requested integration of the older presentation features while
preserving existing functionality and layout. This extends presentation beyond
the original intake issue; no legacy incidents are migrated or accepted.

| Requirement | Evidence / verification | Human boundary |
|---|---|---|
| Preserve core collection, review, comparison, and studio | Existing configured suites plus updated workbench/server regression assertions | No review or acceptance contract changes |
| Restore paths, behaviors, framework references, telemetry, OTEL | `src/explore.mjs`, safe DOM/SVG rendering, optional-core empty states, synthetic fixture, case-scope/graph/catalog tests | Authored relationships and pending/synthetic labels remain visible |
| Display private evidence-linked annotations | Validated read-only `/api/enrichment`; grouped campaign panel; exact passage navigation; sidecar failure/isolation tests | Not independent confirmation or automatic acceptance |
| Export private talk bundles | JSON/Markdown provenance, scoped citations/claims/passages/annotations and enrichment tests; imported Markdown escaped | Presentation exports are not reviewed releases or article publication |
| Preserve layout / interactions | Real-browser node/edge, zoom/reset, reference navigation and export smoke checks; desktop/tablet/mobile width measurements | Independent visual review remains required |

Local execution evidence and screenshots are retained privately by the
researcher; final revision and exact outcomes must accompany any resulting PR.
The original basic synthetic demo remains unchanged. The new research demo is
separate, benign, and prominently marked synthetic.

Originating implementation requirements are [Issue #39](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/39),
including its authoritative clarification that the 2–4 hour estimate does not
reduce scope. Corrections and execution evidence stay on [PR #40](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/40).
No collected article, image, annotation, or private corpus is attached to this
audit. Exact commands, full tested commit, per-suite results, live smoke
outcomes, automated review, and limitations belong in that PR's revision-bound
comments and [checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/40/checks).

| ID | Required outcome and implementation / check evidence | Acceptance boundary |
|---|---|---|
| AC-01 | `scripts/contract.mjs` shared batch/CLI and campaign persistence; `scripts/server.mjs` same-origin intake; `src/app.mjs` collection controls. Focused intake/server tests exercise at least three URLs and explicit pending case links | Executed fixture checks required; successful live CLI and web collection must be recorded separately |
| AC-02 | Intake/server fixtures exercise per-URL failure, unchanged resubmission, new revision on changed content, and unique explicit source links | A failure remains an intake result, never successful evidence; no campaign merge |
| AC-03 | Intake fixtures exercise tolerant static HTML, compression, private HTML/text/metadata/image retention, lazy/relative URLs, asset limits, and warning outcomes | Fixture success does not establish real publisher compatibility; access-denied/JavaScript sources remain unsupported |
| AC-04 | Collection metadata and workbench case/source rendering preserve every linked citation, normalized publisher, original URL, and available date; workbench tests inspect safe DOM/citation output | `needs-human-review`: independently inspect citation completeness and missing-data handling |
| AC-05 | Dynamic store-mode corpus reload and allowlisted attachment downloads in `scripts/server.mjs`; server/workbench tests cover persistence, hostile origins, and archived-content isolation | `needs-human-review`: independent browser UX and archived-content isolation review; agent browser exercises are supplemental |
| AC-06 | `src/enrichment.mjs`, `scripts/extract.mjs`, and focused extraction fixtures cover versioned sidecars, all annotation types, exact revision-linked evidence, repeated quotes, inference/unresolved support, import/export, and pending-only/no-review-mutation invariants | Imported agent or manual assertions are unreviewed, not confirmation of maliciousness |
| AC-07 | Existing configured Node commands plus `python scripts/verify.py`; `git check-ignore` for nested archive/enrichment paths; secret scan and automated PR review | Final committed revision execution and live-network evidence required; independent human approval before merge |

All seven IDs retain their originating meaning. No subjective criterion is
certified by agent self-audit, metadata policy, or a fixture test. DNS, TLS,
robots, publisher access, browser-tool, or runner limitations must be reported
concretely rather than converted to a pass. Subsequent commits invalidate
earlier verification. Documentation relevance, README applicability, research
semantics, and release approval remain independent human responsibilities.

### Continuation environment findings

#### Subsequent local verification and HTML fix

Local Ubuntu WSL testing reproduced successful live collection of both
StepSecurity articles through CLI and a real browser, with explicit image
access warnings. The Nx postmortem initially failed because its returned HTML
contained nine NUL bytes. `readable-html/4` now retains the original response
privately and applies NUL replacement only to the HTML parsing projection;
prior parser transformations and evidence remain reproducible.

A live retry of `https://nx.dev/blog/s1ngularity-postmortem` succeeded, retained
8,741 normalized characters and one 47,688-byte AVIF image with no image
warnings, and linked the source to the explicitly selected existing campaign.
A browser retry reported `already present · OK`, establishing unchanged-input
idempotency. Earlier failed intake manifests remain history. No real article
text, image, private sidecar, or private corpus was committed. The final tested
commit, full-suite outcomes, and remaining hosted/human review boundaries are
recorded in the PR summary comment; these local results supersede the earlier
cloud DNS limitation for the locally tested sources, not for all publishers.

The continuation from `39ea6305d770ec44383ebe82977086845f485edd` recovered
the pushed implementation, not an unfinished local worktree. Hosted
[Verify run 38354186934](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38354186934)
reported `action_required` with zero jobs; it is not passing hosted evidence.
The preceding [agent job](https://github.com/ashwin-patil/DevEnvThreatCorpus/actions/runs/38352989745/job/115149392644)
completed setup successfully but its processing step was cancelled. Its
retrieved log tail contains cleanup, not a root-cause diagnostic; a session
deadline or application failure cannot be inferred from that record.

Live CLI, same-origin HTTP intake, and installed Chromium form attempts used
the three public article URLs in the README. All returned `NETWORK` for each
URL, retained failed-source manifests, and produced no successful revisions
or campaign links. `getent ahosts nx.dev` returned no addresses and
`curl --max-time 15 -I https://nx.dev/blog/s1ngularity-postmortem` reported
`Could not resolve host: nx.dev`. The browser MCP transport was closed;
installed Chromium/ChromeDriver provided supplemental form/reload checks.
These observations establish concrete environment limitations, not live
collection acceptance. A maintainer must authorize the hosted checks and
repeat successful CLI/browser collection on a network-capable final revision.
Exact final commands, outcomes, and tested SHA remain recorded on PR #40.
Full-diff continuation review identified four corrected fixture gaps: hidden
extraction roots (AC-03), charset-expanded archive read/idempotency bounds
(AC-02/AC-03), fetched revisions of initially supplied-text sources (AC-05),
and core-compatible enrichment reference identifiers (AC-06). Regression
checks are in the existing intake, workbench, and extraction suites.

## Issue #25 comparison and timelines

Originating requirements: [Issue #25](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/25).
All implementation stays within the existing authorized workbench modules.
The `Issue #25 AC-*` tests in `tests/workbench.test.mjs` reuse benign synthetic
data for shared citations, contradictory claims, incomplete dates, repeated
reports, and mixed recorded review status. Automated execution is
revision-bound; exact commands, full tested SHA, results, and browser evidence
must be recorded on the originating implementation PR after the final commit.

| ID | Implementation and executable evidence | Result / remaining independent evidence |
|---|---|---|
| AC-01 | `src/model.mjs`: `comparisonRecords`, `dateBounds`, `matchesDate`; `src/app.mjs`: facet/date modes and reset; `Issue #25 AC-01` tests cover every category dimension, claim-status isolation, AND/OR, inclusive day/month/year/range/unknown, invalid/no-result/reset states | Final-revision executed workbench command required; human review of scope and semantics |
| AC-02 | `src/render.mjs`: `renderComparison` reuses full claims and `renderConflicts`; `Issue #25 AC-02/03` asserts separate shared-source/contradictory claims, unresolved support, citations, origin, uncertainty, and disposition | `needs-human-review`: independent rendered research-semantics review; no attribution/prevalence inference |
| AC-03 | `comparisonTimeline`, `comparisonCoverage`, loaded JSON SHA-256 in `fetchCorpus`; `Issue #25 AC-01/03` and `AC-03` tests cover source/event distinctions, interval precision, unknown ordering, duplicate reports, exact count units and mixed recorded review events | Final-revision automated output required; human review of case-context counts and non-eligibility language |
| AC-04 | `src/index.html`, `src/style.css`, `src/app.mjs`; `Issue #25 AC-01/04` exercises semantic controls, navigation focus, reset and read-only requests; existing server suite retains CSP/offline asset boundaries | `needs-human-review`: target-viewport screenshots, executed browser/keyboard results, independent visual/accessibility review. Fake-DOM tests are not browser QA |
| AC-05 | README comparison guide, architecture model semantics, setup/browser applicability, root CHANGELOG and this mapping; configured workbench/server commands and `python scripts/verify.py` | `needs-human-review`: exact final-revision commands and limitations on PR; independent documentation relevance/accuracy and README-applicability decision |

Historical synthetic rendered evidence attached to the Issue #25 implementation
([original record and revision context](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/acceptance-audit.md#issue-25-comparison-and-timelines)):
the viewport labels, captions and original PR's tested revision remain historical.
These images do not establish current responsive or accessibility acceptance.
The original implementation is [PR #36](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/36),
final head `ef4d9a17fd7877b4163ed853d5d7eb0e048c79f7`; its report records 35
governance and 203 application tests. Those historical results do not validate #77.

| CSS viewport | Comparison / count context | Typed timeline |
|---|---|---|
| 1440×900 | [Comparison](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-comparison-1440.png) | [Timeline](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-timeline-1440.png) |
| 1024×768 | [Comparison](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-comparison-1024.png) | [Timeline](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-timeline-1024.png) |
| 390×844 | [Comparison](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-comparison-390.png) | [Timeline](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-timeline-390.png) |

[Conflict evidence](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/assets/issue-25-conflicts-1440.png) retains both separately
cited claims. Installed Chromium/ChromeDriver exercised exact CSS viewports,
document overflow, same-origin resources, Enter navigation/disclosure/reset/
citation activation, Space checkbox selection, Tab traversal and visible focus,
bounded unknown exclusion, unknown-only mode, and a 720×450 layout equivalent to
200% desktop zoom. These are agent-executed browser checks, not an automated
accessibility audit or independent human acceptance. The browser MCP transport
was unavailable; no browser package or repository runner was installed.
Refresh execution results on the final revision and record human review on the PR.

No new lint/build/browser dependency or configured browser command is introduced.
Recorded review-event coverage is not current acceptance eligibility; the review
CLI remains authoritative. Overall acceptance remains `needs-human-review`
until independent human UX/accessibility, research-semantics, and documentation
decisions and final-revision hosted checks are recorded. A person must approve
before merge; agent self-audit is supplemental only.

## Issue #24 reproducible exports and read-only queries

Originating requirements: [Issue #24](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/24).
The implementation reuses the previously authorized `scripts/contract.mjs`
entrypoint. Fixtures are synthetic and no source is fetched or ingested.
Automated results are revision-bound and must be refreshed after every commit;
independent human review remains required before merge.

| ID | Implementation and executable evidence | Remaining independent evidence |
|---|---|---|
| AC-01 | `profileRecords`/`profileFiles` in `scripts/contract.mjs`; `Issue #24 AC-01/05` and unsupported-version tests in `tests/exports.test.mjs` cover deterministic bytes, empty reviewed profiles, explicit file allowlist, and unknown schema rejection | Execute the final configured export CLI test on a POSIX runner; inspect reproducibility and actionable failures |
| AC-02 | `csvFile`, `parseCsv`, and `spreadsheetSafe`; `Issue #24 AC-02` in `tests/exports.test.mjs` round-trips null reasons, arrays, month precision, and formula-like cells | Human review of spreadsheet behavior and format usability |
| AC-03 | `queryProfile` and CLI branches in `scripts/contract.mjs`; `Issue #24 AC-01/03/04` tests cover list/get/bundle, cited source/revision/passage closure, optional enrichment context, and unknown IDs/entities | Human inspection that query/bundle output is sufficient for read-only research |
| AC-04 | `profileRecords` current-review, dependency-closure, and coverage logic; tests cover accepted/conflicting, pending/zero-eligible, stale acceptance, excluded dependencies, and optional enrichment without acceptance | Human review that eligibility/coverage language makes no prevalence, attribution, or detection claim |
| AC-05 | Explicit six-file allowlist in `profileFiles`; profile strips revision text, omits review events and collection manifests; synthetic snapshot-exclusion assertions in `tests/exports.test.mjs` | Review the complete generated artifact inventory; no credentials or real article inputs used |
| AC-06 | README export exercise, architecture and setup guidance, root changelog; configured `node --test tests/exports.test.mjs` plus `python scripts/verify.py` | Record final full SHA and exact command results on the originating PR; independent documentation relevance/accuracy review and hosted checks |

The Windows worktree cannot run the private-corpus CLI path because the
pre-existing private-file policy tests POSIX permission mode bits, which
Windows does not enforce through Node's `mode` option. Pure profile/query tests
remain executable locally; the end-to-end CLI test runs on POSIX. This
environment limitation is not evidence of CLI acceptance. Overall status is
`needs-human-review` until final-revision hosted execution and independent
human review are recorded.

## Issue #21 manual claim review and acceptance eligibility

Originating requirements: [Issue #21](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/21),
scoped FND-17/FND-18 and the shared review/reproducibility contract.
[Implementation PR #23](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/23)
holds exact executed commands, results, tested full revision, and manual CLI
evidence; [its checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/23/checks)
are the durable hosted execution location. Refresh evidence after every commit.

| ID | Implementation and executable evidence | Remaining independent evidence |
|---|---|---|
| AC-01 | `scripts/review.mjs` `applyReview`/`runReview` and CLI; `tests/review.test.mjs` accept/correct/exclude and invalid-input/no-mutation tests; `tests/fixtures/review/accept.json` with synthetic `benign/core-only.json` | Human local workflow inspection on originating PR |
| AC-02 | Existing 0.3.0 `ReviewEvent`; review event construction and private updater's `assertAppendOnlyReviews`; focused event-field, correction/reacceptance history, and rewritten-event rejection tests | Human identity/justification and private audit/backup semantics review; no authentication or tamper-proof claim |
| AC-03 | `scripts/contract.mjs` `currentReview`/`reviewEligibleCorpus`; review-aware private read/update and status/validation; tests for unchanged/multiple decisions, changed claim/revision/source/passage/case/base, inference support, invalid evidence, correction invalidation and explicit re-review; existing intake/extraction pending-only tests | Human review of conservative whole-base invalidation; no export eligibility claim |
| AC-04 | Claim-only decision updates, correction-field allowlist, preserved origin and unchanged source/case records; focused LLM-origin/evidence/lifecycle assertions including `Reviewed` case with pending disposition | Human research/provenance interpretation review |
| AC-05 | README commands, architecture event/status/failure rules, setup guidance, root CHANGELOG, this mapping; configured `node --test tests/review.test.mjs` plus all existing commands through `python scripts/verify.py` | Full tested SHA/exact results on PR; executed hosted Verify/PR Policy; independent human documentation relevance/accuracy, README applicability, and approval before merge |

Automated tests use synthetic data and temporary private stores, no runtime model
or network, and do not assess research truth or authenticate a reviewer.
No lint/build command is configured. Overall acceptance is
`needs-human-review` until independent workflow/documentation decisions and
final-revision hosted checks are recorded. Agent self-audit is supplemental only.

## Issue #16 Phase 1 read-only Research Workbench

Originating requirements: [Issue #16](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/16).
[Implementation PR #17](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/17)
contains revision-bound command results and human review decisions;
[its checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/17/checks)
provide durable hosted execution evidence. This mapping describes
executable checks, not an assertion of independent visual acceptance.

| ID | Implementation and executable evidence | Remaining independent evidence |
|---|---|---|
| AC-01 | `src/model.mjs` `passageSegments`, `src/render.mjs` `renderSourceText`/`renderSource`; `tests/workbench.test.mjs` Unicode, overlap, exact-revision and linked-claim assertions; benign `tests/fixtures/benign/core-only.json` | Human inspection of highlighted normalized text; attach rendered passage screenshot and decision to originating PR |
| AC-02 | `src/render.mjs` `renderCase`/`renderClaim`, `src/app.mjs` `mountWorkbench`; workbench tests for associations, inference/support, navigation/filter state and safe DOM rendering | Human case click-through and DOM snapshot/research-state review on originating PR |
| AC-03 | `src/model.mjs` `conflictPairs`, `src/render.mjs` `renderConflicts`; reciprocal conflicting-claim fixture and workbench assertions | Human side-by-side warning/uncertainty inspection on originating PR |
| AC-04 | `src/style.css`, `src/index.html`, official `docs/assets/logo.svg` and favicon; workbench styling checks and browser exercise at 1440×900, 1024×768 and 390×844 | Independent human screenshot, responsiveness and keyboard audit; agent exercise is supplemental, not independent proof |
| AC-05 | README offline commands, architecture/setup/privacy guidance, substantive CHANGELOG; `tests/server.test.mjs`; configured `python scripts/verify.py` executes all five application suites | Final tested SHA and exact command results/check links recorded on PR; human documentation relevance/accuracy and README applicability approval |

Acceptance remains `needs-human-review` until the independent decisions above
are recorded. Refresh all executed evidence after any new commit. No live source
or model calls, research truth assessment, authenticated curation, or writes are
part of this slice. A person must approve before merge.

The AC-02 navigation regressions are covered by the executable tests
`source facet fallback clears passage selection so the newly visible source keeps its claims`,
`tag mode changes clear selected passages instead of retaining a hidden subset of claims`,
and `revision selection on a filtered fallback source updates the complete route and survives reset`
in `tests/workbench.test.mjs`. Facet changes clear the previous passage selection;
choosing a displayed source revision updates both the internal source route and
the URL, including when filters initially hid the routed source.

Final-revision command results and browser smoke evidence are recorded on
[PR #17](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/17), not inferred
from earlier commits. An `action_required` hosted run with no jobs is not a
passing check; a repository maintainer must resolve the required GitHub action
and obtain executed Verify/PR Policy results before merge. Local synthetic
screenshots and agent click-throughs are supplemental, not independent human
visual or documentation approval.

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
Location note added by #73: the following Issue #1 record describes its original
revision. Its [shared contract](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/SHARED-CONTRACT.md)
and [foundation requirements](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/ISSUE-001-FOUNDATION-CONTRACT.md)
are now archived unchanged; relocation supersedes location preservation, not
requirement IDs, original outcomes or the fresh-input policy.

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

## Issue #8 manual intake and revisions

Originating implementation requirements:
[Issue #8](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/8).
[PR #9](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/9) is the single
implementation/evidence location; corrections remain on that PR. The base
includes Issue #1's contracts and the merged setup/documentation-upkeep fixes.
The fresh-input architecture supersedes the historical handoff's migration
proposal. No 0.2.0 records, later extraction/review operations, or exports are
inputs or outputs of this slice.

### Stable acceptance traceability

The runtime/CLI is in the already authorized `scripts/contract.mjs`, with
existing `schemas/corpus.schema.json` and `schemas/contract.d.ts` unchanged.
`tests/intake.test.mjs` provides focused offline checks and temporary persisted
records using `tests/fixtures/intake/`; synthetic content is not incident
evidence. Test assertions inspect actual persisted source/revision/manifests,
hashes, history, permissions, and exit status rather than self-audit claims.
Generated article stores are private and must not be committed as evidence.

| ID | Observable outcome and executable evidence | Documentation / independent evidence |
|---|---|---|
| AC-01 | URL via injected transport, pasted UTF-8 text, and a UTF-8 file produce contract-valid source/revision/manifests with explicit provenance; text-only URLs have null reasons | CLI commands in README; `tests/intake.test.mjs` and benign fixtures |
| AC-02 | Missing metadata remains null with reasons, retrieval is not activity, failures cannot succeed, and no research entities are generated | Architecture records/state guidance; focused metadata/failure assertions |
| AC-03 | Repeated content does not duplicate successful records; changed content appends revisions; meaningful query values remain distinct and collisions cannot overwrite identity | Existing `https-tracking/1`, hash/ID/serialization helpers and focused persisted-history tests |
| AC-04 | Streaming byte boundaries, absent/misleading Content-Length, deadline, retries, and redirects are finite; each CLI call has one input | Focused fake-transport boundary tests; documented retrieval bounds |
| AC-05 | Initial URL, DNS results, redirect, and peer checks reject prohibited IPv4/IPv6/schemes; scripts are not executed | Focused negative tests; independent fetch-boundary review **needs-human-review**, link/decision pending on PR #9 |
| AC-06 | Versioned plain text/HTML normalization, Unicode, raw/normalized hashes, malformed encoding, and unsupported input are tested | Benign text/HTML fixtures; architecture normalization/offset limits |
| AC-07 | Non-success manifests/exit statuses remain inspectable; authorized supplied-text fallback retains prior failed events and provenance | Offline CLI/failure/fallback tests; README exercise |
| AC-08 | Explicit private stores, safe paths, permission checks, atomic updates, and write-failure preservation are tested; diagnostics/manifests exclude input secrets | `.gitignore`, focused persistence tests; independent retention review **needs-human-review**, link/decision pending on PR #9 |
| AC-09 | Exact offline README commands cover text/file intake, inspection, validation, idempotent rerun, deterministic invalid-URL failure, and fallback | Record executed command output on PR #9; independent README relevance/accuracy review **needs-human-review**, link/decision pending |
| AC-10 | Existing contract/governance suites and the configured intake suite must execute on the final commit through `python scripts/verify.py` | Record exact revision/commands/results and hosted check links on PR #9; refresh after every commit |

### Foundation scope

This implements FND-08/09 and the intake idempotence/source-revision aspects of
FND-12, with FND-06 private retention and FND-07 pinned/offline deterministic
tooling. FND-10's separation of collection from extraction/review is preserved;
its extraction/model-adapter aspects are not implemented. FND-12 case
association/merge suggestions, FND-11 passage-grounded extraction, FND-17/18
review operations, and FND-02/03/05 exports/query remain later issues. Matching
URLs never establish case identity, attribution, activity dates, or acceptance.

### Revision-bound execution and review

Configured commands are `node --test tests/contract.test.mjs` and
`node --test tests/intake.test.mjs`. The authoritative combined command is
`python scripts/verify.py`; it runs the scaffold's own tests and both configured
project commands. This is contract/intake verification, not a full research
application test or proof of factual truth. No lint/build command is configured,
no live network probe is required, and no model credentials are used.
Final output on PR #9 must identify the full tested SHA, exact commands and
exit/results, the executed README exercise, and any unavailable hosted checks.
Do not substitute evidence from an earlier commit.

Requested implementation model: `GPT 6.1-Sol` (`gpt-6.1-sol`). The implementation
subagent was explicitly invoked with that available model selection; the
parent session's effective runtime model is not exposed, so it cannot be
certified or claimed to match. No unsupported-model substitution was reported
by the tool, and no runtime extraction model exists in this implementation.

Independent destination-safety, retention, documentation/README applicability,
and merge approval remain **needs-human-review** until a human records a
decision/link on PR #9. Automated review and security checks are supplemental,
not independent human approval. Hosted Verify/PR Policy may need approval to
run; unavailable or stale checks must be reported, never called passing.

## Issue #12 manual claim extraction and case linking

Originating requirements: [Issue #12](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/12), directly in the implementation issue. This same-PR implementation is [PR #13](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/13); final tested revision and exact command results must be recorded there and refreshed after every commit. No 0.2.0 record is an implementation input.

The runtime is `scripts/extract.mjs`, which imports canonical serialization, hashes, validation, and private-store locking/atomic persistence from `scripts/contract.mjs`. The manual template fixture is `tests/fixtures/extraction/manual.json`; all content is synthetic. No adapter is included.

### Foundation requirement mapping

| Requirement | Implementation, test, and evidence |
|---|---|
| FND-10 — keep collection, extraction, and review distinct | `scripts/extract.mjs` creates only pending records from manual JSON; no model/adapter, network, review, or acceptance operation. `tests/extract.test.mjs`; [manual extraction contract](architecture.md#manual-extraction-contract); final offline verification on PR #13. |
| FND-11 — source-revision-grounded claims or explicit researcher inferences | Each input claim names a source, revision, normalized hash, and exact passage or inference rationale/support. Unicode and invalid evidence cases are tested in `tests/extract.test.mjs`; validator rules are in `scripts/contract.mjs`. |
| FND-12 — explicit many-to-many case/source association without inferred identity or merging | Existing case IDs are required; claim source association is added only to its explicitly selected case. No case is created or merged. `AC-04` extraction test and existing core contract fixture; README and architecture document the boundary. |
| FND-13 — preserve contradictory claims as separate reciprocal references | `conflictsWith` is supplied in both directions; contract validation rejects self, dangling, cross-case, and nonreciprocal relations. `AC-06` extraction and contract tests plus synthetic fixture. |

### Stable acceptance traceability

| ID | Observable result and focused verification | Durable evidence / remaining decision |
|---|---|---|
| AC-01 | Valid template creates contract-valid pending claims and a success manifest; malformed CLI/template, ID collision, and exact rerun behavior are tested in `tests/extract.test.mjs`. | `scripts/extract.mjs`; `tests/fixtures/extraction/manual.json`; README offline exercise; final commands/results and SHA on PR #13. |
| AC-02 | Correct revision/hash and exact half-open Unicode code-point passage slice required; supplementary emoji, NFC composition, wrong hash/revision, fabricated text, and invalid offset cases are exercised in `tests/extract.test.mjs`. | Synthetic Unicode fixture and `scripts/contract.mjs` passage/hash validation; final offline test results on PR #13. |
| AC-03 | Manual mode runs without any adapter; test invokes the CLI offline with local files only and verifies success/failure status. No adapter, live model, network call, or credential is present. | `scripts/extract.mjs`, configured `node --test tests/extract.test.mjs`; no adapter-failure test applies because no adapter is implemented. |
| AC-04 | Multiple sources and claims can be explicitly associated with one case; a source can be linked to claims in multiple cases; unknown case/source or inconsistent revision fails. Claims retain one `caseId` and cases are never auto-merged. | Extraction relationship test and existing `tests/fixtures/benign/core-only.json` contract fixture; `README.md`/`docs/architecture.md`. |
| AC-05 | Inference rationale and same-case supporting claim IDs remain distinct from passages and pending; dangling, self, cross-case, and cyclic support is rejected by contract/extraction tests. | `tests/extract.test.mjs`, inference tests in `tests/contract.test.mjs`, schema inference definition; independent research-semantics review pending. |
| AC-06 | Conflicts remain distinct and reciprocal; self-conflict, dangling references, and missing reciprocity fail without changing the corpus. | `tests/extract.test.mjs`, reciprocal conflict test in `tests/contract.test.mjs`, synthetic fixture; no resolution/ranking is performed. |
| AC-07 | Intake/contract suites remain configured alongside extraction; README, architecture, changelog, and this table describe usage, limits, and evidence links. | `project.config.json`, `README.md`, `docs/architecture.md`, `CHANGELOG.md`; `python scripts/verify.py` and configured commands on final SHA. Independent human review of documentation and research-state semantics is **needs-human-review**. |

CLI failures return JSON with a nonzero exit and do not persist partial claims.
Success stores an `extraction` manifest and leaves all claims `Pending`; only
successful identical template reruns are idempotent. There is no durable failure
manifest for an invalid extraction template. Tests establish contract behavior,
not factual research truth or human approval.

Requested model preference: **Auto**. The effective session model is not exposed
to this record; no runtime extraction model or credentials are used. No unsupported
runtime-model claim is made.

No lint or production build command is configured. Final local and hosted check
results, full tested SHA, and any unavailable checks must be recorded in PR #13.
Independent review and human approval remain required before merge.
