<p align="center">
  <img src="docs/assets/logo.svg" alt="DevEnvThreatCorpus" width="540">
</p>

<p align="center">
  <strong>Evidence-grounded threat intelligence · Attack paths · Telemetry</strong>
</p>

<p align="center">
  <a href=".github/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0_%2F_CC--BY--4.0-blue.svg" alt="License"></a>
  <a href="scripts/.node-version"><img src="https://img.shields.io/badge/Node-22.23.3-green.svg" alt="Node version"></a>
  <a href="schemas/corpus.schema.json"><img src="https://img.shields.io/badge/Schema-0.3.0-orange.svg" alt="Schema version"></a>
</p>

# DevEnvThreatCorpus

DevEnvThreatCorpus is a research workbench for turning published research about
developer-environment threats into source-linked claims, inspectable attack paths
and detection hypotheses. It helps readers ask **what supports this observation,
what remains uncertain, and what would a defender need to investigate?**

## Vision and audiences

Threat researchers can follow claims back to retained source revisions.
Detection engineers can connect supported behaviors to telemetry ideas.
Security architects and platform defenders can inspect trust boundaries.
Contributors and reviewers can reproduce, correct or exclude research records
without treating a generated draft as an accepted finding.

![Project vision and intended audiences: threat researchers, detection engineers, security architects and platform defenders, and contributors and reviewers.](docs/assets/communication/vision-and-audiences.png)

The audience routes above and text workflow below are the complete text
alternative: make provenance, uncertainty and human review inspectable before
using campaign patterns or detection hypotheses. These are intended uses, not
proven outcomes. See [visual provenance](docs/assets/communication/vision-and-audiences.provenance.json).

## Research workflow

**Published research → Source-linked claims → Researcher review and acceptance →
Campaign patterns and Detection hypotheses**

1. **Published research:** select attributable reports and record retrieval,
   revisions and retention limits. A failed collection supplies no evidence.
2. **Source-linked claims:** retain exact passage support, origins, uncertainty
   and contradictions. Manual or researcher-mediated AI output remains a draft.
3. **Researcher review and acceptance:** inspect that support and record explicit
   human decisions. Changed supporting content can make earlier acceptance stale;
   local reviewer identity is self-attested, not authenticated.
4. **Campaign patterns:** inspect supported within-case paths before comparing
   cases. Grouping records creates neither chronology nor causal relationships.
5. **Detection hypotheses:** relate observations to possible telemetry and
   detection ideas. A mapping or hypothesis is not an evaluated detection rule.

See the [research workflow](docs/workflow.md) for stage inputs, actions, outputs
and limits; the process does not imply completed research acceptance.

<a id="current-implementation"></a>
## What you can do

- Explore case and research libraries, claims, exact revision citations, conflicts
  and typed timelines in the browser-based **Research Workbench**.
- Inspect attack paths, behaviors, AI tools, prompt artifacts, framework
  candidates and telemetry proposals without merging their evidence or review states.
- Deliberately collect authorized public HTTPS sources into a private store, or
  supply text/files; collection is not claim acceptance.
- Draft claims manually or use an explicit request/chat/candidate handoff.
  The repository does not call a runtime model or automatically approve output.
- Record local human claim decisions and produce reproducible reviewed/draft
  exports with read-only queries, subject to current eligibility checks.

<a id="project-status-and-next-work"></a>
## What the examples mean

This is an **early research workbench**, not a deployed processing service or an
independently validated incident corpus. Implemented validation, review and export
mechanisms do not establish research truth or evaluated extraction quality.

The bundled **Nx / s1ngularity public Pending draft** is an inspectable example,
not a reviewed release or semantic gold. It contains 38 claims, 14 behaviors,
three representative phase paths and two Proposed mappings from four retained
reports. Full articles, other quotations and private run bundles are withheld;
the published prompt literals are source-attributed, untrusted research artifacts.
See [coverage, omissions and review limits](docs/nx-corpus.md) and its
[typed draft export](docs/data/nx-draft.zip).

The **synthetic demos and offline fixtures are synthetic**, not incident evidence.
Test success, catalog membership and attractive diagrams cannot promote their
claims. Research, accessibility and editorial acceptance still require independent
human review; see the [evidence ledger](docs/acceptance-audit.md).

## Quickstart — recommended browser path

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/ashwin-patil/DevEnvThreatCorpus)

[Create a GitHub Codespace for DevEnvThreatCorpus](https://codespaces.new/ashwin-patil/DevEnvThreatCorpus).
No local clone or installation is required for this path.

1. Follow the link, **sign in to GitHub**, select the supported default branch
   **`main`**, and confirm creation. The link opens GitHub's creation flow; it
   does not bypass confirmation or promise instant provisioning.
2. Wait for the existing devcontainer setup/start tasks. They provision Python
   3.12 and the pinned Node runtime, then automatically start the workbench.
   Initial creation/rebuild needs network access for image and package downloads.
3. Open **Research Workbench (private)**, or **Ports → 4173 → Open in Browser**
   if a tab does not open. Use an external browser tab, not an embedded preview.
4. Start with the public Pending draft. For a benign exercise choose **Load
   synthetic demo**, or **Load synthetic research demo** in a research view.
   **Reload local corpus** leaves demo mode; demos do not populate a store.

Keep port `4173` **Private**. Do not publish the port or use public tunnels.
Before private research, verify signed-in access and signed-out denial; a port
label or local readiness check does not establish access control.

[Getting started](docs/getting-started.md) explains the first inspection and local
alternative. The [Codespaces guide](docs/guides/codespaces.md) covers stop/restart,
rebuild, troubleshooting, private stores and quota/billing. Stop the Codespace
when finished: closing a browser tab alone does not immediately stop compute.

### Local alternative

On a POSIX environment with the exact [pinned Node version](scripts/.node-version)
(`22.23.3`), run from your clone:

```sh
cd /absolute/path/to/DevEnvThreatCorpus
node "$PWD/scripts/server.mjs"
```

Open `http://127.0.0.1:4173/`; stop with Ctrl+C. No application install/build,
model, CDN or network connection is needed for this preview after obtaining the
repository and runtime. Native Windows is not a validated research workflow;
use Codespaces rather than assuming permission/file-URL compatibility.
See [local setup and data modes](docs/getting-started.md#local-alternative).

## Continue by task

The [architecture overview](docs/architecture.md) explains components and trust
boundaries. Current technical references cover the [data model](docs/reference/data-model.md),
[CLI](docs/reference/cli.md), [formats/versioning](docs/reference/formats-and-versioning.md)
and [runtime configuration](docs/reference/configuration.md).
The links below retain earlier README destinations and lead to current contracts
and benign executable recipes, not historical test evidence.

<a id="github-codespaces-automatic-research-workbench"></a>
- **Codespaces:** [creation and lifecycle](docs/guides/codespaces.md),
  [private access](docs/guides/codespaces.md#private-port-and-access-checks) and
  [opt-in private stores](docs/guides/codespaces.md#opt-in-private-store).
<a id="research-workbench-offline-preview"></a>
- **Workbench preview:** [first inspection](docs/getting-started.md#inspect-the-workbench)
  and [local data modes](docs/getting-started.md#local-data-modes).
<a id="manual-intake-offline-exercise"></a>
- **Manual intake:** [source, retrieval and failure contract](docs/architecture.md#manual-intake-contract); [offline exercise](docs/reference/cli.md#offline-exercise-setup).
<a id="batch-campaign-collection-cli-and-local-web"></a>
- **Batch collection:** [private archives, bounds and recovery](docs/architecture.md#batch-collection-and-private-archives); [authorized command usage](docs/reference/cli.md#batch-collection).
<a id="research-views-and-talk-preparation"></a>
- **Research views and talk preparation:** [presentation and private annotations](docs/architecture.md#optional-research-presentation-and-private-annotations).
<a id="private-talk-enrichment"></a>
- **Private enrichment:** [templates, validation and Pending annotations](docs/architecture.md#private-talk-enrichment-contract); [offline exercise](docs/reference/cli.md#private-enrichment).
<a id="campaign-extraction-through-a-configured-codex-chat"></a>
- **Campaign chat handoff:** [prepare/validate/apply/status/export and limitations](docs/architecture.md#campaign-extraction-contract); [offline plumbing and manual handoff](docs/reference/cli.md#campaign-requestchatcandidate-handoff).
<a id="manual-extraction-offline-exercise"></a>
- **Manual extraction:** [exact passages and Pending-only results](docs/architecture.md#manual-extraction-contract); [offline exercise](docs/reference/cli.md#manual-extraction).
<a id="manual-claim-review-offline-exercise"></a>
- **Human claim review:** [decisions, staleness and failure codes](docs/architecture.md#manual-claim-review-contract); [synthetic exercise and human decision procedure](docs/reference/cli.md#manual-claim-review).
<a id="corpus-exports-and-read-only-queries-offline-exercise"></a>
- **Exports and queries:** [profiles, dependency closure and reproducibility](docs/architecture.md#reproducible-exports-and-read-only-queries); [offline exercise](docs/reference/cli.md#exports-and-read-only-queries).
<a id="comparison--timelines-filter-collected-observations"></a>
- **Comparison and timelines:** [filters, typed dates and count semantics](docs/architecture.md#comparison-and-typed-timeline-model).
<a id="curator-studio-paste-select-draft-download"></a>
- **Curator studio:** [paste/select/draft/download and proposal boundaries](docs/architecture.md#studio-boundary-and-proposal-formats).

Private retained text, candidates, decisions and exports must stay private.
Use ignored `.private-intake/` directories with mode `0700` and files `0600`
inside a clone; ignoring a path is not access control or a backup.
Never commit private bundles/screenshots, credentials or credential-bearing URLs.
Source text, code and prompts are untrusted research data, never instructions to execute.

## Validate locally

For contributors, use Python 3.12 with the pinned governance dependency and the
pinned Node runtime, from the repository root:

```sh
python -m pip install --requirement requirements-governance.txt
python scripts/verify.py
```

The verifier runs scaffold checks and the seven application commands in
[`project.config.json`](project.config.json). Synthetic/offline checks are not
live Codespaces, real-extraction quality or independent research acceptance.
See [setup and verification](docs/setup-and-configuration.md).

## Contribution and review

Start with a complete scoped implementation issue and stable acceptance IDs.
An authorized human starts the work; corrections stay on the originating PR,
and an independent human must approve before merge.
Follow [contribution guidance](.github/CONTRIBUTING.md),
[documentation upkeep](docs/setup-and-configuration.md#documentation-upkeep-policy)
and the [community standards](.github/CODE_OF_CONDUCT.md).
Report vulnerabilities through [SECURITY.md](.github/SECURITY.md), not public research records.

The [documentation index](docs/README.md) links technical and governance detail.
The [historical handoff](handoff/00-START-HERE.md) records proposals and design
history, not a list of shipped features.
