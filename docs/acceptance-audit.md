# Acceptance audit

For every issue criterion, record a stable ID, observable outcome, changed-file evidence, verification method, result, and durable evidence reference. Use only `pass`, `fail`, or `needs-human-review`. Do not label a subjective judgment as an automated pass.

Evidence is revision-bound. Record the full tested commit and relevant CI/local command results and links, then refresh all results after any new commit. Automated criteria require actual command/check execution; a declared command or green result copied from another revision is not proof. Subjective criteria need a named human's review and decision before merge.

The PR policy reads GitHub's linked-issue and complete changed-file metadata: it requires exactly one open linked issue with stable acceptance IDs, mapped changed paths, documentation/root changelog upkeep for application/governance changes, configured README triggers, and a same-PR learning-index update when a learning note changes. It uses the exact trusted base's evaluator/configuration; patches are untrusted data, not commands or proof of quality. It does not read the PR body or comments, run tests, certify acceptance outcomes, or replace code review. The independent `Verify` check runs scaffold and configured application commands on the PR revision. Require both checks and human approval through repository settings; policy passing alone does not imply verification passed. A local fixture is only a test of the evaluator. On a new repository, hosted PR Policy is unavailable until that workflow is on the trusted default branch. See [applicability and bootstrap](setup-and-configuration.md#documentation-upkeep-policy).

## Issue #45 passage-grounded campaign extraction

The originating requirements are [Issue #45](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/45).
Implementation and corrections remain on draft [PR #47](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/47),
which closes that one issue. Exact command output, the final full commit SHA and
safe aggregate private-evaluation results belong in revision-bound PR comments;
hosted evidence belongs under [PR #47 checks](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/47/checks).
The currently visible hosted runs require approval and report
`action_required`; they are **not** passing evidence. No merge or publication is
authorized, and a person must approve before merge.

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
| AC-10 | Protected evaluation procedure and safe reporting boundary are documented in `README.md`; private artifacts must contain three original retained revisions, a pre-evaluation baseline/hash set, frozen human gold, candidate/export checks and quote equality results | **fail** — the protected revisions and frozen gold are unavailable here, so no real extraction, coverage measurement or independent human research review occurred |
| AC-11 | Usage, architecture, this matrix and substantive `CHANGELOG.md` map the implemented boundary; existing and focused campaign suites are configured through `python scripts/verify.py` | `needs-human-review` — record exact commands/results and final full SHA only after the final commit; hosted checks are currently unapproved/`action_required`; independent documentation relevance/accuracy review required |

No row is an automated `pass` yet. Fresh execution must include
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

Synthetic rendered evidence attached to this implementation:

| CSS viewport | Comparison / count context | Typed timeline |
|---|---|---|
| 1440×900 | [Comparison](assets/issue-25-comparison-1440.png) | [Timeline](assets/issue-25-timeline-1440.png) |
| 1024×768 | [Comparison](assets/issue-25-comparison-1024.png) | [Timeline](assets/issue-25-timeline-1024.png) |
| 390×844 | [Comparison](assets/issue-25-comparison-390.png) | [Timeline](assets/issue-25-timeline-390.png) |

[Conflict evidence](assets/issue-25-conflicts-1440.png) retains both separately
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
