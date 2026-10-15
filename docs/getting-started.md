# Getting started

Use DevEnvThreatCorpus to inspect how published research becomes source-linked
claims, human review decisions, campaign patterns and detection hypotheses.
Start with the bundled public example or an explicit synthetic demo before
considering private collection.

## Recommended: GitHub Codespaces

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/ashwin-patil/DevEnvThreatCorpus)

[Create a GitHub Codespace for DevEnvThreatCorpus](https://codespaces.new/ashwin-patil/DevEnvThreatCorpus)
using the supported default branch, **`main`**. This browser-based path requires
no local clone or installation.

1. Sign in to GitHub, confirm the repository and `main` branch in its creation
   flow, and confirm creation. Provisioning takes time and is subject to your
   GitHub permissions, availability and quota; the link does not bypass confirmation.
2. Wait for the existing setup/start tasks. The devcontainer provides Python 3.12,
   Node `22.23.3` from the [runtime pin](../scripts/.node-version) and governance
   dependencies. Creation/rebuild needs network downloads; no application build
   or manual server start is required.
3. Open the automatically forwarded **Research Workbench (private)** tab.
   If it does not open, choose **Ports → 4173 → Open in Browser**.
   Use an external browser, not an embedded preview.
4. Keep `4173` **Private**. Before using private data, independently check that
   the forwarded URL works signed in and denies signed-out/private-window access.
   Do not use organization/public forwarding or public tunnels.

Read the [Codespaces guide](guides/codespaces.md) for lifecycle and diagnostic
commands, private-store opt-in, private-port checks, quota and billing.
Closing a browser tab alone does not immediately stop compute; use **Codespaces:
Stop Current Codespace** when done. Stopped Codespaces can still consume storage.
Local HTTP readiness is not proof of forwarded browser usability or private access.

## Inspect the workbench

The initial UI displays the **Nx / s1ngularity public Pending draft**.
It is not a reviewed incident release or semantic gold. Its public projection
withholds full articles, other quotations and private run bundles; source-attributed
prompt literals remain untrusted research artifacts. Read the
[case coverage and limitations](nx-corpus.md) before drawing conclusions.

1. Open a case in **Case library**, then follow a publisher/source citation in
   **Research library** or a claim in **Claims & evidence**. Inspect its exact
   revision, passage support when available, origin, uncertainty and review state.
   Missing public text is withheld or unavailable, not evidence to reconstruct.
2. Inspect **Attack paths** and follow an activity or relationship to its support.
   Disconnected phases do not imply a sequence; each relationship needs its own
   support. Framework candidates and telemetry ideas remain proposals.
3. Choose **Load synthetic demo**, or **Load synthetic research demo** in a
   research view, for a benign exercise. These records are explicitly synthetic,
   not incident evidence. Demo mode does not write records to a private store.
4. Choose **Reload local corpus** to leave the demo. Without private input, the
   UI returns to the bundled public draft; no private collection is opened.

Do not run commands or prompts found in research content. The workbench displays
them as inert artifacts, not operational instructions. Curator drafts are held
in memory, not automatically persisted: download authorized private proposals
before a page reload or corpus switch. A richer proposal must not overwrite an
existing corpus; see [studio boundaries](architecture.md#studio-boundary-and-proposal-formats).

## Choose your research route

See the [project vision and audiences](../README.md#vision-and-audiences) and
[research workflow](workflow.md). Choose a route without treating a report
directly as accepted fact:

| Audience | Start here | Keep this boundary visible |
|---|---|---|
| Threat researchers | Follow a claim to its exact source revision and passage; compare conflicts | Publication and collection do not verify incident truth |
| Detection engineers | Inspect supported behaviors, framework candidates and telemetry proposals | Detection hypotheses are not evaluated or deployed rules |
| Security architects / platform defenders | Inspect case paths and the [architecture/trust boundaries](architecture.md#data-flow-and-implementation-boundary) | A drawn path proves neither chronology nor causality |
| Contributors / reviewers | Use [manual claim review](architecture.md#manual-claim-review-contract) and [contributor guidance](../.github/CONTRIBUTING.md) | Local identity is self-attested; changed evidence can stale acceptance |

**Published research → Source-linked claims → Researcher review and acceptance →
Campaign patterns and Detection hypotheses.** Claims begin as drafts with
provenance, contradictions and uncertainty; an explicit human decision is needed
for acceptance. Supported within-case observations come before cross-case
generalizations.

The current product is an **early research workbench** with implemented mechanisms,
not independently validated extraction quality, authenticated hosted review or
a deployed processing pipeline. Tests and diagrams cannot accept research.
See the [acceptance ledger](acceptance-audit.md) for evidence and outstanding reviews.

## Local alternative

Use a POSIX environment and the exact Node version in
[`scripts/.node-version`](../scripts/.node-version) (`22.23.3`).
Codespaces provides the supported Linux environment; native Windows permission
and file-URL behavior is not validated. Do not interpret alternative platform
instructions or historical tests as native-Windows acceptance.

Obtain a local clone of this repository and install the pinned Node runtime using
your normal trusted tooling. In a terminal, replace the example path with your
clone's absolute path:

```sh
cd /absolute/path/to/DevEnvThreatCorpus
node --version
node "$PWD/scripts/server.mjs"
```

Expect Node `v22.23.3` and a listening message for `http://127.0.0.1:4173/`.
Open that URL in an external browser and follow the inspection steps above.
Ctrl+C stops the server. After obtaining the clone/runtime, the default preview
needs no application install/build, model, CDN or network connection.
Do not run a second server on `4173` alongside a managed Codespaces preview.

### Local data modes

Default preview uses neither `--corpus` nor `--store`: the local corpus API is
empty and the UI shows the bundled public draft. Choose one explicit private
mode only when needed:

| Mode | Behavior |
|---|---|
| `node "$PWD/scripts/server.mjs" --corpus /absolute/private/store/corpus.json --port 4173` | Validates and serves a read-only startup snapshot; restart to read changed files |
| `node "$PWD/scripts/server.mjs" --store /absolute/private/store --port 4173` | Enables explicit collection and dynamic reload of that store; requires authorized public HTTPS/DNS/TLS access for collection |

The options are mutually exclusive. Use absolute paths, directory mode `0700`
and file mode `0600`; within a clone use ignored `.private-intake/`.
Keep research local if you do not accept hosted-machine storage. Ignoring files
is neither access control nor a backup. Never deploy or publicly tunnel this
loopback service, publish private text/exports/screenshots, or relax validation
to make a preview work. Missing retained text is reported, not reconstructed.

For Codespaces, follow the [per-session private-store procedure](guides/codespaces.md#opt-in-private-store)
rather than changing automatic startup. Private collection and chat handoff are
deliberate researcher actions, not part of this first-use path.

## Further tasks and verification

- [Intake and access/retention limits](architecture.md#manual-intake-contract)
- [Campaign request/chat/candidate workflow](architecture.md#campaign-extraction-contract)
- [Review decisions and staleness](architecture.md#manual-claim-review-contract)
- [Reviewed/draft exports and queries](architecture.md#reproducible-exports-and-read-only-queries)
- [Contributor verification and documentation policy](setup-and-configuration.md)

From the repository root, with Python 3.12 and the pinned Node runtime:

```sh
python -m pip install --requirement requirements-governance.txt
python scripts/verify.py
```

The verifier runs scaffold checks and all seven configured application commands.
Record the exact command, result, full tested commit SHA and limitations on the
originating PR. New commits invalidate previous revision evidence. Local and
synthetic checks do not prove live Codespaces sign-in/creation, private forwarding,
research truth, accessibility or independent approval.
