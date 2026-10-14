# Setup and configuration

## Configure a consuming project

Edit the versioned `project.config.json` using `schemas/project-config.schema.json` as the shape reference. Configure one exact `paths.learning_index` file and map its directory under `paths.learnings`. Install the pinned YAML parser once with `python -m pip install --requirement requirements-governance.txt`; then the authoritative offline command is `python scripts/verify.py`. It parses every workflow and issue-form YAML file, validates the JSON config and governance contracts, runs its unit tests, and runs configured project commands. Semantic checks require non-empty command argument arrays, safe repository-local mapped paths, advisory-only model preference, and bounded recovery guidance. Do not put shell command strings in configuration.

`project_commands` are argument arrays executed by `scripts/verify.py` using `subprocess` with `shell=False`, a repository-root working directory, a 30-minute per-command timeout, and sensitive token/secret/password/credential/key/auth/connection environment variables removed. Shell `-c`/`-command` text is rejected. The `Verify` GitHub Actions job has a 30-minute overall timeout, including setup and dependency installation. The workflow grants only `contents: read` and does not pass secrets. A consuming project should add tests in `tests/` and configure the commands it actually uses. An empty list reports **scaffold-only** validation. The read-only PR policy and Copilot setup workflow never execute these commands.

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

### Codespaces authorization prerequisite

The `.devcontainer/**` mapping is governance, not runtime application code, and
is also a README trigger because container lifecycle configuration changes setup
and usage. Future changes under this directory require relevant documentation,
a substantive root changelog entry, and a content-bearing README update. This
authorization does not add container configuration or verify Codespaces startup.

Merge the mapping-only prerequisite with independent human approval before
refreshing Issue #53's implementation PR #55 from `main`. Hosted PR Policy must
then evaluate the implementation against a base that contains these mappings;
head-only authorization remains insufficient. Keep the existing trusted-base
evaluator and merge gates unchanged. Actual runtime provisioning, automatic
startup, private port forwarding and live Codespaces evidence belong to #53.

Manual review requires only the pinned Node runtime, an existing private 0.3.0
corpus, and a researcher-completed private decision file. Use
`node scripts/review.mjs status --file /absolute/private/store/corpus.json` to
obtain the current base digest, then `decide --template /absolute/private/decision.json
--store /absolute/private/store --reviewer your-id`. Protect the directory with
mode `0700` and both JSON files with mode `0600`; inside the clone use the ignored
`.private-intake/` tree. No credentials, model, network service, or install/build
step is required. See the README's executable review exercise and architecture
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

The batch endpoint is enabled only in explicit store mode. Browser collection
uses a bounded same-origin JSON POST, never arbitrary client-selected storage
paths. Original HTML downloads are attachments rather than application-origin
previews. No runtime LLM, cloud service, database, queue, or automatic approval
is configured. Public-source DNS/access failures must be reported separately
from offline fixture success; live CLI and browser smoke evidence remains
required on the final committed revision.

The Comparison & timelines tab uses the same offline server and bundled modules,
with no additional install/build step. Open `#comparison` after loading the local
snapshot or explicit synthetic demo; see the README for multi-label/date modes
and count/review semantics. No browser runner or lint/build command is configured.
Use browser checks at 1440×900, 1024×768, and 390×844 plus a keyboard walkthrough;
retain synthetic-only screenshots on the originating PR and record the tested
revision. Agent browser exercises do not replace independent human visual,
accessibility, research-semantics, or documentation relevance review.

The governance checks use Python's standard library and `unittest` plus the pinned PyYAML parser. In `.github/workflows/copilot-setup-steps.yml`, GitHub Copilot cloud agent requires the exact job ID `copilot-setup-steps` (`jobs.copilot-setup-steps`); an unrecognized job ID such as `setup` triggers cloud agent configuration warnings. The setup workflow maintains least-privilege `contents: read` permissions, installs governance dependencies (`requirements-governance.txt` with Python 3.12), and explicitly provisions the repository's pinned Node runtime using `actions/setup-node` pinned to a full commit SHA with `node-version-file: "scripts/.node-version"`. Consuming projects can extend this workflow to install additional language runtimes or dependencies needed by configured commands. The setup job timeout limits that GitHub Actions job only; it does not set a total Copilot cloud-agent session timeout.

## Model preference

`model_preference` is optional advice, not an operational default or an enforced selection. It must be explicitly selected at the assignment entrypoint. Model support and names change; report the requested preference separately from the effective model and explicitly say when a choice is unsupported or unavailable.
