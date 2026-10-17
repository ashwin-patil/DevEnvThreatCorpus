# Setup and configuration

## Configure a consuming project

Before application tests, run `npm ci --prefix scripts --ignore-scripts` using the
pinned Node runtime. The lockfile pins `tiktoken` 1.0.22 and its bundled WASM/encoding
assets; installation needs registry access, but chunking and tests need no network
or model credentials afterward. Both Verify jobs install this lockfile. Existing
cloud-agent/devcontainer sessions must run this command explicitly before
verification; this checkpoint does not modify their setup workflows.

Edit the versioned `project.config.json` using `schemas/project-config.schema.json` as the shape reference. Configure one exact `paths.learning_index` file and map its directory under `paths.learnings`. Install the pinned YAML parser once with `python -m pip install --requirement requirements-governance.txt`; then the authoritative offline command is `python scripts/verify.py`. It parses every workflow and issue-form YAML file, validates the JSON config and governance contracts, runs its unit tests, and runs configured project commands. Semantic checks require non-empty command argument arrays, safe repository-local mapped paths, advisory-only model preference, and bounded recovery guidance. Do not put shell command strings in configuration.

`project_commands` are argument arrays executed by `scripts/verify.py` using `subprocess` with `shell=False`, a repository-root working directory, a 30-minute per-command timeout, and sensitive token/secret/password/credential/key/auth/connection environment variables removed. Shell `-c`/`-command` text is rejected. The `Verify` GitHub Actions job has a 30-minute overall timeout, including setup and dependency installation. The workflow grants only `contents: read` and does not pass secrets. A consuming project should add tests in `tests/` and configure the commands it actually uses. An empty list reports **scaffold-only** validation. The read-only PR policy and Copilot setup workflow never execute these commands.

### Platform scope and Windows validation

The existing `Verify` job remains on Linux, including private-store and real
devcontainer lifecycle checks. A separate `Verify Windows public preview` job
runs the same verifier on `windows-latest`. Both jobs install Python 3.12,
the pinned YAML dependency and Node from `scripts/.node-version`; neither job
executes with secrets or changes the trusted-base PR Policy workflow.

Native Windows supports the data-free public preview, not private `--corpus`
or `--store` server modes. Those modes fail explicitly before private storage
is touched. Private CLI collection/review/export workflows remain POSIX-only.
Windows ACL support is not implemented, and POSIX permission/link checks remain
unchanged. Use the [Windows/WSL2 guidance](getting-started.md#windows-public-preview)
for local operation.

Portable configuration checks must not import the Linux lifecycle manager on
other platforms: it depends on `fcntl`, `/proc`, Unix identities and signals.
Only its execution checks are Linux-scoped. `tests/platform.mjs` marks actual
private-store integration tests as unsupported on native Windows; it does not
skip pure corpus validation, in-memory transformations or public-server tests.
Mixed proposal/export tests keep their portable assertions separate from private
disk persistence. Record skipped counts and reasons; a passing Windows run is
not evidence for the skipped workflows.

For filesystem paths, convert `file:` URLs with Node's `fileURLToPath`, or pass a
URL directly to a filesystem API that accepts it. Do not use `URL.pathname` as
a native filesystem path: Windows drive prefixes and percent-encoded spaces,
`#` and `%` require decoding. HTTP URL pathnames remain appropriate for routing.

The `paths` mappings classify application, documentation, tests, changelog, learnings, and governance surfaces. Application paths must be explicit and cannot overlap other surfaces: runtime `scripts/contract.mjs`, `scripts/extract.mjs`, `scripts/review.mjs`, `scripts/server.mjs`, the client-side workbench UI tree (`src/**`), and its corpus schema/types are application, not governance. Governance mappings cover the evaluator, verifier, workflows, and tooling/configuration; they are not a runtime-code catch-all. Empty application mappings are allowed for governance-only consumers. `paths.readme_triggers` is a separate, possibly empty list of known entrypoint/setup/usage paths covered by implementation mappings. Safe exact paths and directory `/**` suffixes are supported; arbitrary wildcards, traversal, and contradictory duplicate mappings are rejected. Policy uses the complete GitHub changed-file inventory (including rename origins and deletions), not PR declarations.

The `scripts/review.mjs` mapping was authorized by Issue #20 before Issue #21's
manual claim review implementation. No new application surface or trusted-base
policy change is needed for the local review CLI. Issue #24 likewise keeps
profile export and read-only query commands within the already mapped
`scripts/contract.mjs` entrypoint; it adds no runtime path or trusted-base
authorization.

## Requirements intake

A complete implementation-task issue is the entrypoint: requirements directly in its scope and stable acceptance criteria, required exclusions, dependencies, and definition of done. A parent PRD issue, repository PRD document, or other requirements source is optional context, never a prerequisite. An authorized human reviews scope and starts a session; no automatic assignment or merge is provided.

## Documentation upkeep policy

- **Implementation trigger:** any application or governance file added, modified, copied, renamed, or removed requires a relevant documentation update and a substantive root `CHANGELOG.md` update in the same PR. Both rename endpoints are classified; moving or deleting code does not evade upkeep. Even small workflow/config/dependency/formatting changes on implementation surfaces trigger upkeep: there is no broad maintenance exemption.
- **Mechanical floor:** qualifying documentation and changelog updates must survive at their destination with patch metadata containing added nonblank, non-heading, non-comment prose. Deletions, rename-only changes, heading-only entries, and missing patches cannot satisfy this floor. Learning notes/index and changelog files do not substitute for relevant documentation. A patch is treated only as untrusted data, never executed. The prose test establishes content presence, not correctness or semantic substance; a human must reject irrelevant/ceremonial text and review accuracy, relevance, and changelog quality.
- **README:** known `paths.readme_triggers` require a content-bearing root `README.md` update, including deletions and rename origins on those surfaces. Current triggers include the public contract/schema/types, extraction entrypoint, workbench UI and dev preview server (`src/**`, `scripts/server.mjs`), project commands/dependencies, pinned runtimes, and cloud setup. Other implementation paths may still affect public entrypoints/setup/usage: every PR requires an independent human README-applicability decision and an update when applicable. Agent declarations or a green metadata check cannot exempt those changes.
- **Narrow non-implementation cases:** PRs exclusively changing mapped documentation, changelog, learnings, or tests need no additional docs/changelog/README update merely for their filenames. Examples are typo/link fixes, correcting an existing changelog, or adding a regression fixture without implementation changes. Humans must verify that the classification reflects actual scope and update README if documented usage/setup changes. Unknown paths fail closed; labels or PR-body claims cannot opt out.
- **Conditional learnings:** ordinary changes require no note. Add/update a reusable learning only when useful. Any changed note, including removal or rename out of the learning directory, requires a surviving configured learning-index edit in the same PR. Removing a stale index link is a valid edit; deleting the index or a rename-only index change is not.

GitHub may omit patches for binary/large changes. Missing patch metadata cannot satisfy an upkeep requirement; keep relevant documentation/changelog updates small enough for the API to supply them or ask a human to resolve the blocker without bypassing checks. Comment filtering retains destination-side patch context and conservatively rejects additions before an orphan comment closure or after an unclosed opener. Comment boundaries entirely outside supplied hunks cannot be inferred; humans must inspect the rendered/full documents. GitHub metadata cannot reliably establish documentation quality or completeness.

## Trusted-base bootstrap

Hosted PR Policy checks out the exact event base SHA and uses only that base's evaluator/configuration plus read-only live GitHub metadata. It never checks out PR head or executes configured project commands; `Verify` is a separate, unprivileged head check. Head-only mappings cannot authorize new application paths in the same PR.

For a new surface, first land a human-authorized, reviewed mapping/policy prerequisite within already mapped surfaces with required docs/changelog updates. Then update the dependent implementation PR's base and rerun both checks. This governance issue updates classification for paths already mapped by the older base; hosted policy will initially use that older version, while head tests exercise the new rules. Do not switch policy to head code or disable merge gates to bootstrap. Re-run policy after trusted-base changes; document which base and head were evaluated.

## Dependencies and extension points

### Historical handoff archival authorization — Issue #75

The 45 historical `handoff/` paths are individually classified as
**documentation** for the archival cleanup in Issue #73 / PR #74. The historical
prototype scripts and data are inert reference artifacts, not current runtime
application or trusted governance code. Exact mappings deliberately exclude new
unlisted handoff files; this classification grants no execution or redistribution
approval. Policy does not encode deletion-only permissions: these existing paths
are classified for any change status, while the originating issue limits the
authorized operation to archival removal. Independent scope review remains required.

Prerequisite [PR #76](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/76)
merged at `a29de1822513b77d15b6fcf1c88dff147bf6140c` and was merged into PR #74
before removal; head-only configuration never authorized deletion. An authorized
actor created the public `codex/archive-handoff` branch at that SHA, and all 45
files were independently compared before removal. The
[immutable archive](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff)
and [inventory/disposition](archive/README.md#handoff-relocation--issue-73) preserve
bytes, provenance and defects. Exact mappings and evaluator/workflow gates remain
unchanged. Removing files from this candidate tree does not remove public Git
history, clear rights or authorize release; independent human approval is required.

### Codespaces authorization prerequisite

The `.devcontainer/**` mapping is governance, not runtime application code, and
is also a README trigger because container lifecycle configuration changes setup
and usage. Future changes under this directory require relevant documentation,
a substantive root changelog entry, and a content-bearing README update. This
mapping authorization alone does not verify Codespaces startup.

Merge the mapping-only prerequisite with independent human approval before
refreshing Issue #53's implementation PR #55 from `main`. Hosted PR Policy must
then evaluate the implementation against a base that contains these mappings;
head-only authorization remains insufficient. Keep the existing trusted-base
evaluator and merge gates unchanged. Actual runtime provisioning, automatic
startup, private port forwarding and live Codespaces evidence belong to #53.

### Codespaces environment and lifecycle

Issue [#53](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/53) uses the
trusted-base authorization landed by [PR #57](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/57)
at `9c555ce9726f64d11c73b1fed0505dcbdd9041c7`. Implementation PR #55 incorporates
that base; the policy evaluator, mappings and merge gates are not changed by the
implementation. Human approval is still required before merge.

`.devcontainer/devcontainer.json` is the Codespaces entrypoint. Its Dockerfile
pins the Python 3.12 devcontainer base by digest, downloads the Node archive for
the version in `scripts/.node-version`, verifies it against the HTTPS Node
distribution checksums, and installs `requirements-governance.txt`. Supported
container architectures are amd64 and arm64. The Dockerfile-specific ignore file
allows only these two pin files into the build context: no source corpus,
`.private-intake/`, workspace credentials or research files are copied into image
layers. The workspace is mounted by Codespaces separately. No runtime application
dependencies, build, secrets, database or cloud resource provisioning are added.
Rebuild after changing either pin file; failed downloads fail the build.

`postCreateCommand` checks the installed versions and `pip check`.
`postStartCommand` checks them again, then runs the existing `scripts/server.mjs`
in its own session with only PATH/HOME/LANG from the lifecycle environment.
Credential variables, Node options and private store options are not forwarded
to the default server. The container uses the non-root `vscode` user and an init
process for reaping children. `waitFor: postStartCommand` waits for readiness,
including on first creation after setup. There is no second server on attach.

`python .devcontainer/workbench.py check|start|status|stop|restart` provides
explicit diagnostics and recovery from the repository root (choose one verb).
An exclusive file lock serializes lifecycle operations. A per-user, per-checkout
owned mode-0700 `/tmp` directory holds mode-0600 process/lock/log files. Process
identity includes Linux start time and exact command line, so stale PIDs never
authorize stopping an unrelated process. Startup requires the server's successful
bind message and a bounded loopback HTTP check; a foreign listener is not treated
as a managed success. A failed child is stopped, its record removed, and its log
printed with nonzero exit status. Repeat start checks the existing process;
restart stops only a matching managed server. These are Linux devcontainer
operations, not a new cross-platform application entrypoint or a service manager.

Only `4173` is requested for forwarding, labeled **Research Workbench (private)**,
using HTTP internally and the authenticated Codespaces HTTPS browser URL
externally. Other discovered ports are ignored. Codespaces supplies private
visibility by default; the devcontainer port label cannot enforce visibility
against a user's later changes. The standard devcontainer schema has no
port-visibility switch. Keep the Ports panel **Private** and independently test
signed-in access and signed-out denial. No public port command, tunnel, host
allowlist, origin rewrite or non-loopback binding is added. A browser-forwarding
403 must be investigated with actual Codespaces evidence before considering any
server change; local readiness does not prove forwarded Host/Origin compatibility.

The [Codespaces operations guide](guides/codespaces.md)
covers creation, preview, synthetic demos, stop/start/rebuild, log recovery,
quota/storage billing, and opt-in private stores. Private collection remains
explicit under ignored `.private-intake/` directories (0700) and files (0600).
Automatic startup never supplies `--store` or `--corpus`; it serves only the
existing bundled public draft and explicit synthetic demos. Keep private
research off hosted machines unless you intentionally accept that storage model.

`python -m unittest tests.test_devcontainer` executes focused configuration and
real local-process lifecycle checks, including concurrent starts, restart,
controlled occupied-port failure/recovery, stale identities and permissions.
`python scripts/verify.py` discovers those Python tests and runs all eight
configured application suites. Neither command proves Codespaces creation,
rebuild, stop/start, private access or browser usability. AC-01–AC-06 evidence and
the still-required independent reviews are tracked in
[the acceptance audit](acceptance-audit.md#issue-53-codespaces-workbench).

Manual review requires only the pinned Node runtime, an existing private 0.3.0
corpus, and a researcher-completed private decision file. Use
`node scripts/review.mjs status --file /absolute/private/store/corpus.json` to
obtain the current base digest, then `decide --template /absolute/private/decision.json
--store /absolute/private/store --reviewer your-id`. Protect the directory with
mode `0700` and both JSON files with mode `0600`; inside the clone use the ignored
`.private-intake/` tree. No credentials, model, network service, or install/build
step is required. See the [executable review recipe](reference/cli.md#manual-claim-review)
and [architecture](architecture.md)
guidance for correction/exclusion input, self-attested identity, append-only
events, staleness, failure codes, and recovery. The configured review suite is
executed by `python scripts/verify.py`; passing tests do not replace independent
human research/workflow or documentation relevance review.

The local Research Workbench needs only the pinned Node runtime:
`node scripts/server.mjs` serves the vanilla `src/` assets on
`http://127.0.0.1:4173/`. An optional `--corpus` takes an absolute private
mode-0600 corpus file and validates it before serving; `--port` changes the local
port. There is no install/build step. Restart to refresh the read-only
`--corpus` snapshot. Issue #39 adds `--store /absolute/private/store` for
explicit public HTTPS collection and dynamic corpus reload; it requires working
public DNS, TLS, and network access. Keep the store under `.private-intake/`
inside the clone, with directory mode `0700` and file mode `0600`. Never expose
private retained text through a public host or tunnel.
The configured workbench and server Node tests join the existing
application commands in `python scripts/verify.py`; independent human UX and
documentation relevance review is still necessary.

### Private item-level HITL review

In `--store` mode, open **Review** after loading the private corpus. No install,
new dependency, provider, authentication or network call is needed for review.
Keep one active self-attested reviewer. `GET /api/review` returns revision-bound
items/progress and `POST /api/review` writes one explicit decision using the existing
private transaction/lock and a current snapshot. A stale tab/write returns 409;
reload and inspect again, never blindly replay acceptance. The server keeps the
same Host/Origin/Fetch-Metadata/CSP boundary and request-size/time limits.
Public draft, inspect-only demos and `--corpus` views cannot write corpus decisions.
From Review, **Start synthetic review exercise (isolated, not Nx)** explicitly
loads a separate server-memory fixture. It supports decision/reload/history
exercises without a store; server restart resets it. It is not private filesystem
durability, authenticated identity or research evidence, and never writes Nx.

Use the [versioned guide](researcher-review-guide.md) embedded in the item panel.
Guide `researcher-review/2` consolidates common/type checks into one explicit
**Accept item — I confirm** human action after inspecting the category attestation.
LLM suggestions never complete checks; N/A exceptions require a reason. Historical
v1 guide text/decisions remain retained. Set the self-attested identifier once per
tab session, with visible correction controls. Navigation and Next item do not decide.
Review filters and selection persist separately from decisions; browser storage
failure is reported, while durable decisions remain in the private corpus.
Do not use browser storage as a backup. Preserve `corpus.json`, source archives,
sidecars and request/candidate files with their permissions for a private backup.

Compatibility: reviewed CLI exports now require item-level acceptance and no
longer include pending enrichments or unaccepted summary content. Legacy claim
decisions remain readable and auditable but need explicit checklist-based re-review.
Reviewed output strips retained bodies/passages and annotation content. The local
`/api/review/export` projection includes accepted sidecar annotation metadata;
file-based CLI exports cannot discover sidecars. Private campaign/talk draft
exports retain their existing private-content warnings. Neither route publishes.
The configured review suite includes the synthetic HITL tests; these executed
application checks do not establish human semantic/UX/accessibility approval.
The HITL suite is explicitly the eighth configured command. Priority category
queues default to grounded tool/behavior/prompt candidates; claims remain in the
evidence queue and advanced artifacts remain withheld until explicitly accepted.
Support review returns to the saved priority context, including after reload.
See the [issue-81 evidence ledger](acceptance-audit.md#issue-81-local-hitl-review)
for exact-check surfaces, owner-authorized deferrals and required human review.

### Explicit workbench themes

`src/theme.js` is an allowlisted same-origin classic script loaded before the
stylesheet. It restores only a valid explicit `light`/`dark` preference, defaulting
to light even on a dark-preferring system, before the page styles are applied.
The header's compact sun/moon button retains the accessible name **Dark mode**,
exposes its state through `aria-pressed` and supports native keyboard activation.
Its outlined segment indicates the current theme; the control expands to at
least 44px high for coarse-pointer touch input. The existing Content Security Policy
remains unchanged: no inline script, third-party dependency or unsafe-inline
exception is needed.

Both palettes define semantic surface, text, highlight, control and status tokens
in `src/style.css`; an explicit root `data-theme` selects dark. Avoid introducing
fixed light backgrounds into components or automatic system-theme overrides.
The light/dark wordmark assets preserve the same geometry and use text colors
appropriate to their surrounding surfaces.

Preference storage is limited to `devenv-threat-corpus.theme` in browser
`localStorage`, never research content. Theme changes only update presentation
and the toggle state; they do not rerender the workbench, fetch a corpus or mutate
drafts. Invalid stored values and storage access failures produce a visible
header notice. A failed write still changes the current page's theme without
claiming it was saved.

`tests/theme.test.mjs` joins the configured workbench suite and checks explicit
defaults, persistence, storage failures, startup order and normal-text contrast
of at least 4.5:1 for the declared theme combinations, plus 3:1 control boundaries.
Retain browser evidence for both themes and the documented viewport sizes;
token arithmetic does not replace independent visual/accessibility review.

The batch endpoint is enabled only in explicit store mode. Browser collection
uses a bounded same-origin JSON POST, never arbitrary client-selected storage
paths. Original HTML downloads are attachments rather than application-origin
previews. No runtime LLM, cloud service, database, queue, or automatic approval
is configured. Public-source DNS/access failures must be reported separately
from offline fixture success; live CLI and browser smoke evidence remains
required on the final committed revision.

The Comparison & timelines tab uses the same offline server and bundled modules,
with no additional install/build step. Open `#comparison` after loading the local
snapshot or explicit synthetic demo; see the [comparison model](reference/data-model.md)
for multi-label/date modes
and count/review semantics. No browser runner or lint/build command is configured.
Use browser checks at 1440×900, 1024×768, and 390×844 plus a keyboard walkthrough;
retain synthetic-only screenshots on the originating PR and record the tested
revision. Agent browser exercises do not replace independent human visual,
accessibility, research-semantics, or documentation relevance review.

The governance checks use Python's standard library and `unittest` plus the pinned PyYAML parser. In `.github/workflows/copilot-setup-steps.yml`, GitHub Copilot cloud agent requires the exact job ID `copilot-setup-steps` (`jobs.copilot-setup-steps`); an unrecognized job ID such as `setup` triggers cloud agent configuration warnings. The setup workflow maintains least-privilege `contents: read` permissions, installs governance dependencies (`requirements-governance.txt` with Python 3.12), and explicitly provisions the repository's pinned Node runtime using `actions/setup-node` pinned to a full commit SHA with `node-version-file: "scripts/.node-version"`. Consuming projects can extend this workflow to install additional language runtimes or dependencies needed by configured commands. The setup job timeout limits that GitHub Actions job only; it does not set a total Copilot cloud-agent session timeout.

## Model preference

`model_preference` is optional advice, not an operational default or an enforced selection. It must be explicitly selected at the assignment entrypoint. Model support and names change; report the requested preference separately from the effective model and explicitly say when a choice is unsupported or unavailable.
