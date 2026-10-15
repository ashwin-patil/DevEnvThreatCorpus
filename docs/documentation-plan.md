# Public documentation plan

## Boundary and inspected baseline

This is the reviewable plan for [#59](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/59),
under human-coordinated [#58](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/58).
The original plan was approved and merged in
[PR #65](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/65).
The owner-approved [#62 amendment](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/62)
below supersedes only the listed placement/ownership rows. Neither plan approval
nor visual appearance approval accepts research; independent implementation review
remains required.

**Later disposition — Issue #73:** the original plan below is retained as dated
policy/evidence, including its archive-in-place and path-preservation instructions.
The separately authorized [handoff relocation](archive/README.md#handoff-relocation--issue-73)
supersedes only those instructions for `handoff/`: all 45 files now reside
unchanged in the [immutable archived snapshot](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff),
not the current tree. The inventory, frozen enumeration and original #59/#63
criteria below describe their inspected revisions; they are not new commands
to restore the pack or change its bytes.

On 2026-10-15, the remote default branch was confirmed as `main` at
`53c10b5c4e607c93530c637ec4e7b0d47c05573a`. Its tracked inventory was reinspected:
README has 964 lines and architecture 1,038. These are observations, not targets.
At that inspected baseline, guidance mixed operating instructions, contracts,
issue evidence and proposed services. The original #59 plan changed only this
file and the docs index; these statements describe that historical task.
For #59, no bulk moves/deletions, runtime/schema or policy changes, incident
acceptance, image generation/integration, publication or repository-setting changes
were authorized. Later asset integration is bounded by the amendment below.

### Owner-approved #62 placement and ownership amendment

After #60/#61 merged through PRs #66/#67, the owner explicitly authorized #62
to place **vision/audiences in README**, **pipeline in workflow**, and **system
architecture in architecture**, removing the duplicate large getting-started
infographic. The updated rows below supersede #60's earlier visual placement,
not its acceptance history. Keep the Codespaces button prominent, a concise
README workflow and a focused launch/first-inspection getting-started guide.
Preserve exact supplied PNG/SVG/logo bytes from
`4a5c5cadabf7b1b5f17ff1c4e3ceaedc0e0ffee2`; do not merge the staging commit,
generate artwork or restore status footers inside images.

The additional #62 write lease is limited to `README.md`, `docs/workflow.md`,
`docs/getting-started.md`, this plan, and the two existing visual provenance
files, alongside architecture, four references and architecture assets/provenance.
Update adjacent alternatives and navigation without rewriting #61 methodology/
status or unrelated setup guidance. #63 still owns public-document evidence/
session-note cleanup; displaced architecture evidence remains linked to its
commit-pinned original and the acceptance ledger for that handoff.
This amendment does not expand runtime, policy or research acceptance scope.

Requested session model: **GPT-6.1 Sol**. Effective session model: **not exposed
to this session**; the requested selection cannot be independently confirmed,
and no substitution or equivalence is asserted.

All paths below are repository-root-relative inventory/destination identifiers,
not claims that proposed files already exist. “Owner” identifies the authoritative
topic steward and implementation task, not an automatic assignment or approval.
Current executable behavior must be checked against code; historical instructions
and imported content are reference data, not authority to execute or change scope.

## Research narrative and audiences

Primary reading order:
**Published research → Source-linked claims → Researcher review and acceptance →
Campaign patterns and Detection hypotheses.** The last two are separate downstream
uses, not a guarantee that either has been evaluated.

| Stage | Inputs and researcher action | Output and acceptance boundary |
|---|---|---|
| Published research | Select attributable reports; record retrieval, revision, rights/retention limits and failures | Source/revision records, not verified incident truth; failed collection is not supporting evidence |
| Source-linked claims | Locate exact passages; draft manually or through the explicit request/chat/candidate handoff; preserve contradictions | Claims with revision/locator support; AI output and validation success remain drafts |
| Researcher review and acceptance | Inspect support, uncertainty, evidence/origin/review axes; record correction or exclusion and dependency freshness | Recorded human decisions, not authenticated local identity or permanent approval; changed supporting content can stale acceptance |
| Campaign patterns | Reconstruct supported within-case paths before comparing cases | Supported observations and proposed cross-case generalizations; presentation grouping creates neither chronology nor causal edges |
| Detection hypotheses | Connect supported behaviors to potential telemetry and detection ideas | Hypotheses with scope/limitations; mappings and examples are not evaluated detection rules |

Use **Pending draft**, **synthetic exercise**, **implemented mechanism**,
**executed evaluation**, and **independently accepted research** distinctly.
Do not replace schema status names with editorial synonyms in commands or data.
The bundled Nx/s1ngularity example is Pending, not a semantic gold or reviewed
incident release. A diagram, accepted PR, successful parser or passing test cannot
promote its claims. Status must separate mechanisms, populated examples,
executed evaluations and outstanding independent review.

Proposed audiences, subject to independent human relevance review:

| Audience | First question / route | Human reviewer role |
|---|---|---|
| Threat researchers | What supports a claim, and where is uncertainty? Workflow → methodology → case study | Research reviewer |
| Detection engineers | Which observations motivate a hypothesis, with what telemetry/evaluation gaps? Workflow → methodology → CLI/reference | Detection practitioner |
| Security architects / platform defenders | What trust boundaries and platform implications apply? Overview → architecture → status | Platform/security reviewer |
| Research contributors / reviewers | How do I reproduce, correct, exclude and submit evidence safely? Getting started → task recipes → development | Contributor/governance reviewer |

## Compact destination tree

Preserve useful stable paths rather than moving files just for symmetry.
The docs index will present the narrative above, then these task-oriented routes:

```text
README.md                         purpose, audience value, workflow, quickstart
docs/
  README.md                       current navigation; history separated below
  documentation-plan.md           approved migration/ownership record
  getting-started.md               recommended browser route; local alternative
  workflow.md                     stage inputs/actions/outputs/limits
  methodology.md                  provenance, review, uncertainty, worked example
  status.md                       capability/maturity and outstanding-review matrix
  guides/codespaces.md             lifecycle, private ports/stores, recovery, billing
  architecture.md                 components, flow and trust boundaries
  reference/
    data-model.md                 core entities before optional derived records
    cli.md                        commands and task recipes, errors/recovery
    formats-and-versioning.md      contracts, exports, revisions, pinned catalogs
    configuration.md              runtime modes, bounds and configuration
  case-studies/README.md           case navigation and draft/accepted labeling
  nx-corpus.md                    existing Pending example and artifact boundary
  development/README.md           contribution, verification, lifecycle entrypoint
  setup-and-configuration.md       authoritative governance/setup/upkeep policy
  decisions/README.md             durable decisions/principles with source evidence
  learnings/                      reusable lessons and their configured index
  archive/README.md               dated historical specs, handoff and evidence map
  acceptance-audit.md             preserved criterion/evidence ledger
  assets/, data/, licenses/       retained assets, exports and notices
handoff/                          historical pack retained at its original paths
```

Task guides are not a second contract: the Codespaces guide owns environment
operations; CLI reference sections own intake, batch collection, extraction,
review, export/query and curator handoff recipes. Getting started links to them
instead of repeating long exercises. Case studies describe evidence and limitations,
not generic API rules. Development covers contributor procedure, not researcher
acceptance. Durable decisions summarize still-useful choices with dated source
links; do not invent ADRs or turn session logs into enduring authority.
Archive navigation distinguishes historical proposals from currently implemented
behavior and links each to its current replacement or explicit deferred status.

### First-use placement reserved for #60

README opens with purpose, audience value and the research workflow, then a concise
capability overview and quickstart. Reserve a prominent standard **Open in GitHub
Codespaces** badge/button beside that quickstart and at the top of
`docs/getting-started.md`. Both use the direct creation URL
`https://codespaces.new/ashwin-patil/DevEnvThreatCorpus`, with a descriptive text
link as an accessible fallback. This is a placement specification, not an
integrated badge or a live-startup claim.

Recommend the existing Codespaces configuration as the browser-based first-use
route: sign in, confirm creation for the supported default branch, wait for
existing setup/start tasks, then open the Research Workbench. No local clone or
install is needed for that route; do not promise instant provisioning or bypass
GitHub confirmation. Keep the pinned-runtime local setup as an alternative in
getting started, without implying native-Windows acceptance.

Move the README's detailed lifecycle/private-store/troubleshooting explanation
into `docs/guides/codespaces.md` under #60, retaining private-port/access checks,
stop/start/rebuild, diagnostics/recovery, resource/quota/billing and explicit
private-store constraints. Link it from both entrypoints and the existing setup
page where coordination permits. #60 owns rendered-link checks and authorized
sign-in/creation/setup-to-workbench evidence at its final SHA; static URL inspection
does not establish live acceptance. No devcontainer changes are planned here.

## Complete disposition inventory

Dispositions: **keep** at the listed path; **rewrite** there with scoped extraction
to named destinations; **move** topic content only after its replacement lands;
**archive** in place through historical navigation unless explicitly stated.
No row authorizes deleting research/data or modifying frozen bytes.

Inbound-link rules used in every row:

- **K:** retain path and existing anchors; update owned inbound links if adding navigation.
- **S:** split topic content only after replacement review; retain old headings/anchors
  with descriptive links to the precise new sections, not an HTTP-redirect assumption.
  Update non-frozen inbound links in the owning task or a coordinated later task.
- **H:** preserve original path/anchors and durable issue/PR/commit evidence;
  use dated archive wrappers and replacement links. Never silently retarget an
  evidence URL to a new interpretation. Frozen sources remain untouched.

The following groups enumerate all tracked documentation, community guidance,
assets/data/notices and historical handoff at the inspected baseline.

| Source document or enumerated group | Disposition → destination | Authoritative topic steward / task | Inbound handling |
|---|---|---|---|
| `README.md` | Keep #60 first-use routes; #62 replaces temporary exercise links with current references and places vision/audiences here, removing pipeline image | #60 merged; explicit owner handoff to #62 for amended placement/navigation only | S; preserve exercise/preview anchors and Codespaces prominence |
| `docs/README.md` | Rewrite at same path to current tree, archive secondary | Navigation coordinator; serialized handoffs #60 → #61 → #62 → #63; #59 adds only plan link | K |
| `docs/documentation-plan.md` | Keep approved disposition record; record owner's superseding #62 visual hierarchy and scoped lease | Human coordinator #58; #62 amendment explicitly authorized | K; preserve historical #59 criteria/evidence |
| `docs/architecture.md` | Rewrite overview at same path; move detailed mechanics → `docs/reference/{data-model,cli,formats-and-versioning,configuration}.md`; methodology → three #61 pages; historical issue narrative → archive map | Technical maintainer #62; #61 reads but does not edit source; #63 preserves historical context | S; #62 retains contract and issue-section anchors, including evidence tables or precise ledger links |
| `docs/getting-started.md` | Keep launch/inspection/local routes and concise audience table; #62 removes duplicate large infographic and links README/workflow | #60 merged; owner handoff to #62 for visual/navigation amendment only | K; retain audience and local-mode anchors |
| `docs/workflow.md` | Keep #61 five-stage narrative; #62 places pipeline image and complete adjacent alternative at overview | #61 merged; owner handoff to #62 for amended visual placement only | K; retain stage and review anchors |
| `docs/methodology.md`, `docs/status.md` | Keep merged #61 narrative/evidence | #61; read-only for #62 | K; #63 evidence cleanup remains separately owned |
| `docs/assets/communication/{research-pipeline,vision-and-audiences}.{png,svg,provenance.json}` | Keep image bytes; update per-visual placement/alt/textAlternative metadata for amended locations | #60 copied assets; owner hands metadata-only corrections to #62 | K; preserve source commit, PNG/SVG and logo hashes |
| `docs/assets/communication/system-architecture.{png,svg,provenance.json}` | Copy approved architecture bytes; scoped provenance/alternative links | #62 | K; compare with pinned source package |
| `docs/setup-and-configuration.md` | Keep policy/setup authority; link environment operations to #60 guide and runtime mechanics to #62 reference, without changing policy | Governance maintainer #63; #60/#62 request link handoff, do not edit independently | K; policy anchors remain authoritative |
| `docs/lifecycle.md`, `docs/recovery.md`, `docs/merge-rules.md`, `docs/cloud-assignment-and-models.md` | Move concise explanations → `docs/development/README.md`; retain original policy/detail pages and dated remote-observation limits | Governance maintainer #63; no policy relaxation or remote-setting changes | S; preserve all original paths/anchors and unresolved decisions |
| `docs/acceptance-audit.md` | Keep ledger intact; archive navigation separates dated records from present status; current status links back | Evidence steward #63; human traceability reviewer | H; do not rewrite failed/pending outcomes as passed |
| `docs/usability-review.md` | Archive in place via `docs/archive/README.md`; current limitations summarized in `docs/status.md` | UX/research steward #63; status editor #61 reads only | H; retain measured observations and outstanding independent reviews |
| `docs/nx-corpus.md` | Keep Pending case at same path; expose through `docs/case-studies/README.md`; #61 methodology links worked example here | Research steward #63 for wrapper/navigation; #61 consumes public records only | K; no claim acceptance or private quotation restoration |
| `docs/PRD-CAMPAIGN-EXTRACTION.md`, `docs/PRD-BATCH-WEB-INTAKE.md`, `docs/PRD-ATTACK-PATH-MAPPING.md` | Archive in place with dated historical-spec labels/replacement links; distinguish implemented portions from proposed/deferred requirements | Requirements/evidence steward #63 | H; preserve stable criteria, concept links and originating issue references |
| `docs/learnings/README.md` | Keep configured learning index; link from development/decisions; update if any note changes | Learning steward #63 | K; no index rename or ceremonial entries |
| `docs/learnings/evidence-expires-with-revision.md`, `docs/learnings/preserve-originals-version-html-decoding.md` | Keep durable principles at same paths, link from decisions | Learning steward #63 | K |
| `docs/learnings/workbench-session-recovery.md` | Keep durable lesson at same path; move session-specific narrative, if useful, → `docs/archive/workbench-session-recovery.md` with original evidence links | Learning/evidence steward #63; learning-index edit mandatory if changed | S + H; preserve superseded decisions as superseded, not current guidance |
| `docs/assets/logo.svg`, `docs/assets/favicon.svg` | Keep current identity assets at original paths; references may be reused, not redesigned | Brand owner; #60 placement | K; retain runtime consumers |
| `docs/assets/logo-concept-a.svg`, `logo-concept-b.svg`, `logo-concept-c.svg`, `favicon-concept-a.svg`, `favicon-concept-b.svg`, `favicon-concept-c.svg`, `preview.html` (all under `docs/assets/`) | Archive in place as design exploration via archive index | Brand owner / #63 | H; keep preview-relative paths; no runtime integration |
| `docs/assets/attack-path-concept.html` | Archive in place as synthetic interactive proposal, not shipped functionality | Research/UX steward #63 | H; preserve PRD inbound link and synthetic label |
| `docs/assets/issue-25-comparison-1024.png`, `issue-25-comparison-1440.png`, `issue-25-comparison-390.png`, `issue-25-conflicts-1440.png`, `issue-25-timeline-1024.png`, `issue-25-timeline-1440.png`, `issue-25-timeline-390.png` (all under `docs/assets/`) | Keep bytes/paths; archive navigation labels synthetic historical screenshots, not current visual acceptance | Evidence/UX steward #63; artifact audit #64 | H; retain acceptance-record references |
| `docs/data/nx-draft.zip` | Keep byte-preserving typed Pending export at same path; link through case page | Research/data steward; #63 navigation, #64 provenance/rights audit | K; compare against documented export/hashes, do not regenerate or relabel accepted |
| `docs/licenses/ATLAS-NOTICE.txt`, `docs/licenses/Apache-2.0.txt` | Keep notices at original paths, linked from framework reference where applicable | Attribution owner; #62 references, #64 rights-wording audit | K; no new licensing decision |
| `AGENTS.md`, `.github/copilot-instructions.md` | Keep contributor instructions at same paths, reference from development | Governance maintainer; read-only throughout overhaul | K; no policy/instruction edits |
| `.github/CONTRIBUTING.md` | Keep authoritative contribution entrypoint; link current development guidance via coordinated #63 update if needed | Community/governance maintainer #63 | K; do not change research/policy obligations |
| `.github/CODE_OF_CONDUCT.md`, `.github/SECURITY.md`, `.github/LICENSE` | Keep community, private-reporting and license authorities at original paths | Repository owner; #64 audits wording/remaining decisions, not policy | K; retain GitHub discovery locations; never route disclosures into public issues |
| `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/implementation-task.yml`, `.github/ISSUE_TEMPLATE/product-requirement.yml` | Keep intake/review guidance at original paths | Governance maintainer; read-only throughout overhaul | K; no template or gate changes |
| `CHANGELOG.md` | Keep release/history record at root; link from development/history | Maintainer; read-only unless a downstream change independently triggers upkeep | K; documentation-only planning needs no ceremonial entry |
| `handoff/00-START-HERE.md`, `01-FOUNDATION.md`, `02-WORKBENCH-UI.md`, `03-CURATION.md`, `04-INGESTION-ACTIONS.md`, `05-RELEASE-DOCKER-HOSTING.md`, `06-AGENT-ACCESS.md` (all under `handoff/`) | Archive in place via `docs/archive/README.md`; no handoff edits/moves | Historical requirements steward #63 wrapper only | H; do not execute proposed phases or present them as shipped |
| `handoff/CHANGELOG.md`, `handoff/COPILOT-PROMPTS.md`, `handoff/ISSUE-001-FOUNDATION-CONTRACT.md`, `handoff/SHARED-CONTRACT.md`, `handoff/inputs/USER-PRD-2026-10-12.md` | Archive in place, preserving requirement IDs and precedence as historical context | Historical requirements/evidence steward #63 wrapper only | H; current instructions/policy take precedence |
| `handoff/REFERENCE-MANIFEST.json` and all `handoff/reference/` files enumerated below | Keep frozen bytes and locations; archive wrapper only | Frozen-reference custodian; #63 hash comparison, #64 artifact inventory | H; no edits, moves, reformatting or regenerated manifest |

Frozen reference enumeration (paths relative to `handoff/reference/`):
`AGENT_CONTRACT.md`, `OTEL_REFERENCE.md`, `README.md`, `REVIEW_AND_PLAN.md`,
`app-v2.js`, `build-library.mjs`, `corpus.js`, `corpus.json`, `corpus.jsonl`,
`corpus.schema.json`, `index.html`, `manifest.json`, `package.json`, `query.mjs`,
`server.mjs`, `style.css`, `unit-check.mjs`, `v2.css`, `validate-library.mjs`;
and `library/behaviors.json`, `campaigns.json`, `detections.json`, `evidence.json`,
`frameworks.json`, `governance.json`, `manifest.json`, `mappings.json`,
`otel-reference.json`, `otel.json`, `paths.json`, `sources.json`, `telemetry.json`
(the latter thirteen all under `library/`). The manifest's SHA-256 values remain
the frozen-reference integrity authority, not a current product contract.
The frozen `handoff/reference/README.md` already links to absent
`PROJECT_BRIEF.md` and `METHODOLOGY.md`. Record these as unavailable historical
references in the archive wrapper and final audit, not newly introduced broken
links; do not fabricate files or edit the frozen README to make a link check green.

Related runtime/data/config surfaces are **keep/read-only**, not documentation
rewrite targets: `.devcontainer/`, `.github/workflows/`, `project.config.json`,
`requirements-governance.txt`, `schemas/`, `scripts/`, `src/` (including
`src/data/nx-draft.json`, `src/atlas-catalog.json`, UI assets and exact prompt
presentation), and `tests/` including fixtures. #62 cites them for technical truth;
#64 inventories public artifacts/rights with coverage limits. Historical corpus
material must not seed new accepted claims. No policy mappings are expanded.

## Downstream file ownership and dependency locks

This matrix is an edit lease proposal for human approval, not permission to expand
an issue. File ownership and topic authority above must agree. All tasks start
from the latest merged default branch after prerequisites are reviewed and merged.

| Task | Exclusive write set / deliverable | Read-only sources / coordination | Observable completion condition |
|---|---|---|---|
| #59 (this PR) | `docs/documentation-plan.md`; one `docs/README.md` link | All inventoried sources | Independent AC-01–AC-04 review and merge before dependents |
| #60 after #59 (merged #66) | Original README/getting-started/Codespaces and pipeline/vision integration; earlier visual locations now superseded by owner's #62 amendment | No concurrent edits; #62 lease below is the explicit subsequent handoff | Original evidence/criteria remain on #66; visual relocation is not retrospective acceptance |
| #61 after #59 (merged #67) | Workflow/methodology/status narrative; workflow visual placement now handed to #62 | Methodology/status remain read-only for #62; shared index lock unchanged | Original five-stage/evidence criteria remain on #67 |
| #62 after merged #60/#61 | `docs/architecture.md`, four named `docs/reference/*.md`; system PNG/SVG/provenance; scoped README/workflow/getting-started/plan edits and pipeline/vision provenance metadata | Read current runtime/schema and #61 narrative; no runtime/policy edits; existing image bytes unchanged; shared index only under lock | Current component/contracts/config/version references, all old anchors, final three-image hierarchy and consistent alternatives/provenance; command/link/hash evidence and independent technical/editorial/desktop-mobile review |
| #63 after #60, #61, #62 | `docs/archive/README.md`, optional `docs/archive/workbench-session-recovery.md`, `docs/development/README.md`, `docs/decisions/README.md`, `docs/case-studies/README.md`; scoped wrappers/links in existing docs/governance/community/learning rows above; final primary index consolidation | No frozen or other `handoff/` edits; no writes to #60–#62 primary pages without explicit handoff | Before/after disposition/link/AC-evidence comparison; unchanged frozen hashes/manifest; policy meaning preserved; human traceability review |
| #64 after #60–#63 | `docs/release-readiness.md`; narrowly scoped documentation corrections after owner handoff | Read tracked public artifacts, licenses and current code/check evidence; no runtime/policy/settings changes | Revision-bound link/command/artifact audit; each blocker has owner/next action/completion criterion; independent owner readiness decision, not automatic release |

#60 and #61 may run in parallel only after this matrix is approved. Default to
serial assignment otherwise. **Shared `docs/README.md` lock:** coordinator grants
one task at a time; #60 adds its completed destinations first, #61 rebases and adds
its pages next, then #62, then #63. If #61 finishes first, defer its index edit
until #60's index change is merged; do not publish dead links. No simultaneous
index edits. All other shared-file corrections, including setup links, learning
index, visual metadata, README and status corrections, require an explicit
file/PR handoff recorded by the coordinator in #58. Prefer separate per-visual
metadata files to avoid a shared asset-manifest write race. #64 corrections occur
after all previous tasks have merged. Stop rather than silently widen ownership.

## Visual placements and complete text alternatives

The owner creates/reviews imagery in ChatGPT. This task generates no images and
does not require image tooling. The tracker supplies a later-task
[staged package](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/4a5c5cadabf7b1b5f17ff1c4e3ceaedc0e0ffee2/docs/assets/communication)
at `4a5c5cadabf7b1b5f17ff1c4e3ceaedc0e0ffee2`, outside the inspected default-branch
inventory. Do not merge/cherry-pick that staging commit or copy assets in #59.
Later authorized tasks copy only their relevant files, verify supplied hashes
and provenance, and use local relative references. Concept/appearance approval
does not establish technical, accessibility or research acceptance.
This revised package supersedes the earlier staging revision. Its presentation
omits concept/review badges, Pending notices and maturity footers inside images;
do not restore them there. Keep accurate draft/review/maturity status in adjacent
documentation and data views, independently of visual presentation.

| Visual / eventual asset paths | Intended placement and exclusive integration owner | Required alternative and adjacent explanation |
|---|---|---|
| `docs/assets/communication/research-pipeline.png`, `research-pipeline.svg` | #62 owner amendment: `docs/workflow.md` overview; supersedes #60 README placement | Alt describes published reports → source-linked draft claims → human review → patterns/hypotheses. Five-stage text explains inputs/actions/outputs, drafts, uncertainty, stale review and unevaluated hypotheses; provenance `textAlternative` targets `docs/workflow.md#research-workflow` |
| `docs/assets/communication/vision-and-audiences.png`, `vision-and-audiences.svg` | #62 owner amendment: README vision/audiences; supersedes #60 getting-started placement. No duplicate large image in getting started and no pipeline image in README | Alt names researchers, detection engineers, architects/platform defenders and contributors/reviewers. Adjacent audience routes and concise workflow explain intended value/limits; provenance `textAlternative` targets `README.md#vision-and-audiences` |
| `docs/assets/communication/system-architecture.png`, `system-architecture.svg` | #62: architecture overview after component/trust-boundary text, before detailed-reference links | Alt describes browser, loopback Node server/shared CLI tooling, private files/archives, public projections and explicit researcher-configured chat handoff. Text explains storage is files, not a database dependency; arrows are data/shared-tooling relationships, not guaranteed subprocess calls; no automatic model or acceptance |
| Existing `docs/assets/logo.svg`, `favicon.svg` | #60 preserves brand header; #62 may reference existing logo in supplied composition | Accessible project-name text for meaningful logo; decorative duplicates have empty alt. No redesign or new runtime asset integration |

Scope alt-text/provenance notes per visual to its integration owner. Owner-supplied
assets remain optional to #59 planning approval; later task criteria determine
their required integration. If unavailable or technically misleading, keep complete
text, record the missing review/blocker and seek owner correction rather than
inventing imagery or declaring full visual acceptance. #64 checks rendered
desktop/mobile readability, accessible alternatives, local links, hashes and
outstanding visual decisions; do not claim full release readiness with mandatory
reviews outstanding.

## Migration safeguards and measurable review gates

1. **Replacement before retirement:** land current guidance first; then archive
   navigation. For every split, record old path + heading/anchor → new path +
   section, and inspect tracked inbound links, HTML asset links, README, docs
   index, community guidance and historical references. Retain compatibility
   anchors/wrappers where external or frozen callers cannot be updated.
   No blanket “all old links redirected” claim without checking each target.
2. **Traceability:** preserve stable IDs with their originating issue namespace
   (for example #59 AC-01 is not #60 AC-01), criterion meaning, evidence URLs,
   full tested SHAs, command results, failures/skips and pending-human outcomes.
   Archive wrappers add inspected dates/revisions and current replacements;
   they do not overwrite original evidence or turn historical success into
   current validation. Use commit-pinned source/evidence links for durable claims.
3. **Integrity:** compare `handoff/REFERENCE-MANIFEST.json` and every enumerated
   frozen file against the pre-migration revision, including SHA-256 checks.
   Leave all handoff paths unchanged; wrappers stay under mapped `docs/`.
   A mismatch is a blocker, not permission to regenerate the manifest.
   Preserve the current architecture's fresh-input decision: historical 0.2.0
   migration proposals do not authorize importing the frozen seed or promising
   compatibility. Reconcile stale “no exports/batch/server” statements against
   current implementation rather than copying them into the new references.
4. **Public/private boundary:** keep retained article text, raw archives, private
   candidates/decisions, credentials and private stores out of public docs and
   screenshots. Use synthetic examples or the existing public projection with
   its omissions explicitly described. No recovered quotations from private
   inputs, new incident acceptance, or invented locators. #64 records artifact
   provenance/review/rights/retention limits, including ZIPs, screenshots, exact
   prompt literals, framework projections and historical data; this is not legal
   clearance or a secret-free-history guarantee.
5. **Authority and applicability:** one authoritative home per topic; summaries
   link instead of duplicating contracts. Preserve trusted-base boundaries,
   independent README applicability/relevance review, private vulnerability
   reporting and human approval. Follow
   [documentation upkeep policy](setup-and-configuration.md#documentation-upkeep-policy);
   documentation-only planning needs no ceremonial changelog or learning entry.
   Runtime/governance changes, policy refinements and existing #26/#27/#28/#29
   implementation remain outside this overhaul.
6. **Validation:** on each final committed revision, run `python scripts/verify.py`.
   It runs scaffold checks and the seven configured commands:
   `node --test tests/contract.test.mjs`, `node --test tests/intake.test.mjs`,
   `node --test tests/extract.test.mjs`, `node --test tests/review.test.mjs`,
   `node --test tests/exports.test.mjs`, `node --test tests/workbench.test.mjs`,
   `node --test tests/server.test.mjs`. Record exact commands, exit results,
   environment, full tested SHA and durable PR/CI evidence. A new commit requires
   rerunning. No new prose-presence tests or lint/build tools are warranted here.
   Existing checks do not establish editorial correctness, live Codespaces,
   accessibility, research acceptance or current remote enforcement.

### #59 stable acceptance and durable evidence

Implementation/evidence home: [PR #65](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/65).
Executed verification, automated review, final SHA and limitations belong on that
PR, not in a self-certifying plan. The index change makes this proposal reachable;
it does not make it approved.

| Criterion (unchanged) | Changed file / plan evidence | Required independent decision; current state |
|---|---|---|
| AC-01 — Complete disposition inventory with destinations and authoritative topic ownership | This file: complete inventory and frozen enumeration; `docs/README.md` discovery link | Documentation/asset owner compares rows against tracked baseline and confirms every destination/steward; **needs-human-review** |
| AC-02 — Navigation and terminology follow the talk workflow; distinguish draft exploration from accepted research outputs | This file: narrative, audience routes, tree, Pending/synthetic/accepted distinctions | Editorial + research reviewers assess talk alignment and audience relevance; **needs-human-review** |
| AC-03 — Preserve stable acceptance IDs, durable evidence links, private/public boundaries and frozen-reference integrity in the migration plan | This file: link rules, inventory and migration safeguards | Traceability + privacy/frozen-reference reviewers confirm preserved IDs/evidence/boundaries; **needs-human-review** |
| AC-04 — Identify downstream file ownership, dependency order, visual placements and measurable completion conditions | This file: edit leases, serialized index lock, first-use reservations, visual table and review gates | Human coordinator approves ownership/sequence/placements before dependent assignments; **needs-human-review** |

For the coordinator's #58 update, use: task state, originating PR URL, current full
head SHA, Verify and trusted-base PR Policy run URLs/results, blocker and next
action. For #59 the next action is independent inventory/editorial/traceability
and ownership approval, then human merge; downstream tasks remain blocked until
that merge. Keep this PR draft pending review readiness. No agent self-audit,
issue closure or local green check substitutes for independent human approval.
