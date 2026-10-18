# Nx source expansion and human-gated gold plan

Originating planning issue: [#89](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/89).
This is an **unreviewed extraction preview and execution plan**, not applied
corpus data, completed HITL review, or a gold release. The human requested an
updated extraction first; the linked execution tasks are not started by this PR.

## Current baseline and source identities

Inspected repository revision: `4cc1cc3591d27c61f9355d108386c6968fa99a41`.
The [public Nx draft](../nx-corpus.md) contains 38 Pending claims, 14 behavior
definitions, three canonical paths and two Proposed framework mappings. Its four
retained incident reports are Nx, StepSecurity, Wiz and Socket. No independent
human acceptance is established. The public projection is not an importable
private corpus or a substitute for retained passage evidence.

Keep **one Nx / s1ngularity campaign**. For the three requested URLs, preserve
three publisher-specific article identities: Semgrep, StepSecurity and Panther.
StepSecurity already exists; it is not a second new article simply because it
appears second in the request or contains more detail. Associate the two new
publishers with the existing campaign only through explicit curation. Successful
collection would expand four retained reports to six, not replace them with three.
Group article cards by publisher while keeping StepSecurity linked on the
campaign card. Do not merge publishers because they describe similar TTPs.

Existing StepSecurity source:
`source-a51036e953e037c63840945207be185e7cf43bdd22f70a8c8712959ae5f24bd3`.
Its public retained revision:
`source-revision-682a51fd30b46aee1bd5dc6eee22ec5487f733eded5044200f83e80e527786ad`.
Recollection must compare normalized content and preserve revision history;
the currently accessible page must not overwrite an older retained revision.
Shared behavior definitions may link multiple independently supported occurrences.
Claims, prompts, literals, revisions, failures and contradictions remain source-local.

## Updated extraction preview

A delegated source researcher accessed all three requested public articles during
this planning session. This is web research, **not** a run of the protected
collector, exact-span validation, or an independent human semantic evaluation.
The preview has no canonical passage offsets, retained hashes, or accepted IDs.
The `NX-Pxx` identifiers below identify planning rows only. Article sections are
navigation aids, not fabricated retained-passage locators.

Source key:

- **S**: [Semgrep, Security alert: Nx compromised to steal wallets and credentials](https://semgrep.dev/blog/2025/security-alert-nx-compromised-to-steal-wallets-and-credentials).
- **T**: [StepSecurity, Nx build system compromise](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware).
- **P**: [Panther, Nx threat analysis](https://panther.com/blog/nx-threat-analysis).

These are publisher statements or published code descriptions, not independently
observed incident events. No source command or malware was executed.

| Preview ID | Candidate extraction and evidence boundary | Source and section | Baseline / proposed delta |
|---|---|---|---|
| NX-P01 | Package installation invokes `telemetry.js` through `postinstall`. The displayed sample exits on `win32`; do not generalize that platform exclusion to every campaign variant. | T: Attack Vector; The telemetry.js Payload; References | Installation and Windows exclusion already have broad claims. Review exact literals/conditions, not a new TTP count. |
| NX-P02 | The malicious AI prompt requests filename/path matching for `UTC--`, `keystore`, `wallet`, `*.key`, `*.keyfile`, `.env`, `metamask`, `electrum`, `ledger`, `trezor`, `exodus`, `trust`, `phantom`, `solflare`, `keystore.json`, `secrets.json`, `.secret`, `id_rsa`, `Local Storage`, `IndexedDB`. These are prompt criteria, not proof of reads or a deterministic implemented glob engine. | T: Novel Attack Technique: AI CLI Exploitation; References. S: Technical Deep Dive | Expand target precision and retain source-specific prompt occurrences; existing inventory-prompt claims are not evidence that every target was found. |
| NX-P03 | Requested roots include `$HOME`, `$HOME/.config`, `$HOME/.local/share`, `$HOME/.ethereum`, `$HOME/.electrum`, macOS `$HOME/Library/Application Support`, readable/non-root-owned `/etc`, `/var`, `/tmp`. Prompt requests depth 8, no sudo, and skipping `/proc`, `/sys`, `/dev`, mounts and other filesystems. | T: full prompt in References. S: Technical Deep Dive | Separate requested scope/constraints from actual assistant enforcement. |
| NX-P04 | Prompt output is `/tmp/inventory.txt`, with `/tmp/inventory.txt.bak` requested if an inventory already exists. Published code reads listed regular files and individually base64-encodes their contents. A pre-existing inventory can be read even if the current assistant attempt fails. | T: References, PROMPT and processFile | Separate inventory request, inventory artifact, conditional reads and control-flow interpretation. |
| NX-P05 | Direct harvesting attempts `gh auth token`, accepts prefixes `gho_` or `ghp_`, and stores a result field named `ghToken`. Conditional `.npmrc` collection follows successful nonempty `npm whoami`; the result also includes `process.env`. | T: Development Credentials; References | Refine existing generic authentication/npm claims into distinct credential mechanisms and prerequisites. `ghToken` is not an environment-variable name. |
| NX-P06 | Exact `GITHUB_TOKEN` is documented for the initial privileged `pull_request_target` workflow compromise. It must be distinguished from the npm publishing token and victim GitHub CLI credentials. Broad environment capture could include a populated variable of that name, but the shown payload does not explicitly select that key. | T: Elevated Permissions via pull_request_target; How the NPM Token Was Compromised; References. P: Phase 0 | Add role-specific literal precision; do not claim a named victim `GITHUB_TOKEN` filter. |
| NX-P07 | Availability checks target `claude`, `gemini`, `q`; reported invocations lower permission checks. Semgrep reproduces a Claude refusal. Attempted AI reconnaissance does not establish success; direct harvesting remains a separate branch. | T: Novel Attack Technique; References. S: Technical Deep Dive | Existing attempted-CLI claims need new source-local support and a scoped negative/refusal observation, not universal success/failure. |
| NX-P08 | Published code attempts to append `sudo shutdown -h 0` to `$HOME/.bashrc` and `$HOME/.zshrc`. That append is not contingent on successful exfiltration. Actual shutdown requires successful mutation, sourcing, authorization and execution; no particular completed shutdown is established here. | T: Persistence and Sabotage; References, forceAppendAgentLine. S: Technical Deep Dive | Shutdown and local sudo conditions already have broad claims. Add exact files and separate mutation, intent and execution. The article heading alone does not prove persistent attacker access. |
| NX-P09 | With a captured GitHub token, code attempts public repository creation and upload of `results.b64`. Preserve source-specific `s1ngularity-repository` / suffix variants. Subsequent private-repository disclosure/forking is a separate reported phase. | T: Exfiltration Mechanism; Second Wave; References. P: Phases 1 and 2 | Refine existing conditional upload/later-wave claims, without joining every phase by invented successful edges. |
| NX-P10 | Semgrep describes double encoding; StepSecurity/Panther describe triple. Request-field encoding versus stored-blob encoding is a possible explanation, not an adjudicated resolution. | S: Technical Deep Dive, final encoding paragraph. T: Exfiltration Mechanism; References. P: Phase 1 | Preserve source statements and inspect encoding layers independently. Existing Wiz variants remain separate evidence. |
| NX-P11 | Semgrep contributes Nx Console exposure/investigation guidance and reported refusal; Panther contributes workflow/GitHub detection-oriented analysis; StepSecurity includes a vendor runtime experiment and payload. | S: Are you impacted?; Technical Deep Dive. T: Runtime analysis with Harden-Runner. P: Phases 0-2 | New publisher perspectives, not three independent confirmations of every claim. Linked runtime recordings/rule implementations were not independently validated. |

### Additional precision and review exceptions

- StepSecurity's executive-summary `.gitconfig` theft statement is a publisher
  claim; its displayed payload has no explicit `.gitconfig` read or exact prompt
  criterion. Do not silently elevate it to a demonstrated explicit target.
- Semgrep's `~/.npm/_logs`, `~/.claude/projects`, `*.jsonl` and `extensions.json`
  appear in defender investigation guidance, not malware-target evidence.
- Credential-rotation recommendations are not evidence of exact AI-provider key
  names. Do not invent `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or similar literals.
- Semgrep's printed Nx Console range `18.6.30`-`18.65.1` differs from StepSecurity's
  `18.63.x`-`18.65.x` discussion. Retain the discrepancy for primary-source review;
  do not auto-correct a suspected typo.
- Panther's hunting text uses `s1ingularity-repository`, unlike the attack
  description's `s1ngularity-repository`. Treat that as a source inconsistency,
  not a confirmed new indicator.
- Preserve existing Nx/StepSecurity package-availability conflicts. New sources
  do not settle older disagreements by majority vote. Novelty/first-known claims
  remain attributed to their publisher.

All preview rows require exact retained grounding and independent human review.
The existing public dataset and review history are unchanged by this document.

## Delegated execution tasks and stop gates

| Task | Assigned execution roles | Dependency and bounded output | Human gate |
|---|---|---|---|
| [Source expansion #90](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/90) | Source researcher/operator; staged-extraction implementer | After #89 preview approval: protected baseline, explicit collection outcomes, publisher-separated candidate, exact target/token/condition deltas and comparison evidence. | Inspect candidate before application/publication; independent source/semantic/privacy review. |
| [HITL and gold qualification #91](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/91) | Independent researcher; release/privacy reviewer; documentation/UX reviewer | Freeze expectations before #90 regeneration; final item review depends on #90. Produce revision-bound eligibility and a bounded gold manifest only if qualified. | A real person records every decision and verifies reviewer independence; gold and public release are separate approvals. |
| [Detection/telemetry/replay design #92](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/92) | Detection engineer; telemetry engineer; replay designer; independent researcher | Evidence from #90; final gold-linked publication depends on #91's accepted scope. Produce proposed mapping matrix and inert storyboard, not a deployed rule or viewer. | Approve collection feasibility, privacy, semantics and synthetic safety before any implementation. |

These are delegated task contracts, not running implementation agents. A human
starts each bounded implementation session; each issue owns one PR and keeps
corrections there. This planning PR closes only #89. Human scope approval is
required before schema/UI/policy expansion; no task authorizes hidden new surfaces.

### Order of operations

1. **Preview approval:** inspect NX-P01-NX-P11 and source attribution. Confirm
   article identities and scope before private collection or extraction.
2. **Freeze before generation:** preserve the protected old corpus, exact
   revisions, run configuration, overlays and historical decisions. An independent
   researcher freezes expected spans/literals/classes before seeing the new
   result. Do not use this agent preview as independent human gold.
3. **Separate comparison cohorts:** compare old/new extraction on identical
   retained revisions using the [staged comparison gate](../researcher-review-guide.md#staged-extraction-and-independent-comparison).
   Evaluate new Semgrep/Panther revisions or changed StepSecurity content in a
   separate expansion ledger. Absence from the old corpus is not an extraction
   failure against material it never contained.
4. **Ground, Interpret, Relate:** use minimal coherent cohorts and existing
   frozen handoffs. Retain original candidates, exact source support and honest
   attempted/reported/inferred labels. New material stays Pending.
5. **Independent adjudication and item review:** account for every major
   comparison group; review matched groups too. Accept supporting items and then
   each derived item separately. Modification is not acceptance. Corpus edits can
   stale earlier approvals; recheck current eligibility, not recorded counts.
6. **Qualify a bounded gold version:** manifest included/excluded/deferred IDs,
   source revisions, review evidence, unresolved conflicts, rubric and hashes.
   A baseline, selected candidate, green verifier or populated graph is not gold.
   Keep advanced proposals deferred unless explicitly in the reviewed scope.
7. **Public/scaling gate:** independently approve rights/privacy, documentation
   relevance, README applicability, evidence navigation and UX/accessibility.
   Export only authorized public-safe material. Reuse the checklist on the next
   campaign; do not transfer Nx decisions or assume comparable publisher coverage.

## Proposed mapping and replay boundary

Start from accepted evidence, not a desired connected visual. Each future row
must bind claim/behavior -> actual required data source -> fields and availability
-> detection hypothesis/benign alternatives -> OTEL representation -> OTLP
encoding/export -> synthetic replay step. Endpoint process/file/network events
and GitHub workflow/audit/security events are candidate sources, not confirmed
collection coverage. Observing process invocation does not prove a token value,
file content, or successful exfiltration was captured.

OpenTelemetry signals/semantic conventions are not the OTLP transport itself.
Pin representation/convention versions, identify custom security fields, and
validate any claimed OTLP sample encoding rather than calling arbitrary JSON
OTLP. Minimize/redact credentials and personal paths. Preserve proposed versus
article-mentioned guidance and unevaluated rule effectiveness.

Replay design uses dummy/reserved values and inert event descriptions, never
real token reads, shutdown, exfiltration or malware execution. Show branches for
assistant refusal, missing credentials, failed upload and unexecuted shutdown.
Constructed event order is synthetic, not proof of incident chronology. A runnable
viewer/emitter requires separate human-authorized implementation scope.

## Planning acceptance evidence

| Criterion | Durable evidence / expected check | Current boundary |
|---|---|---|
| AC-01 | Baseline/source section; existing `src/data/nx-draft.json` and `docs/nx-corpus.md` | Agent inspection only; human attribution/identity review pending. |
| AC-02 | NX-P01-NX-P11 and linked publisher sections | Unreviewed preview; no retained-span integrity or independent semantic acceptance. |
| AC-03 | Linked #90, #91, #92 contracts and execution table | Issues created; execution and human scope approval pending. |
| AC-04 | Documentation-only changed-file inventory; freeze/cohort gates above | No public data or human decisions changed; independent privacy/relevance review pending. |
| AC-05 | Originating draft PR's final-SHA verifier log and template audit | Exact executed results belong on that PR; no test result establishes research acceptance. |

No entrypoint, setup, usage, schema, or runtime behavior changes are proposed by
this planning PR. No new focused code test is appropriate for prose alone; run
the required repository verifier and disclose native Windows skips/runtime limits.
README applicability and documentation accuracy still require independent human
review. There is no new reusable learning claimed from planning alone.
