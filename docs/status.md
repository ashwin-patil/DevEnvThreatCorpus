# Current capabilities and research maturity

This is an **early research workbench**, not an independently validated incident
corpus or proven detection service. Read the [workflow](workflow.md) and
[methodology](methodology.md) before interpreting counts, diagrams or review labels.

## Evidence boundary

Implementation and public-data statements below were inspected against
[`06f93a10f4481378c394785f4e2d239886a92c21`](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/06f93a10f4481378c394785f4e2d239886a92c21),
the merged #60 default-branch baseline. This documentation does not change those
mechanisms or records. Links to source/tests explain where a mechanism is
implemented and checked, not that its tests have run on every later revision.

Revision-bound command results and their **full tested commit SHA** are linked
from the [historical verification record](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md).
Read each report with its check results; a later commit invalidates earlier test
evidence. Historical results in
[the acceptance audit](acceptance-audit.md) or [Nx notes](nx-corpus.md#usage-and-review)
remain historical, not fresh validation or independent acceptance.

The optional provider transport described here is a subsequent #83 addition,
not a capability asserted at that historical baseline. Its current-revision
evidence and outstanding independent reviews belong in the acceptance audit/PR.

## Capability and maturity matrix

“Implemented” means a checked-in mechanism, not proven research quality.
“Populated” identifies an example, not representative coverage. An empty optional
collection is not evidence that a mechanism or real-world behavior is absent.

| Capability | Implemented mechanism and code | Populated demonstration | Executed evaluation boundary / outstanding human review |
|---|---|---|---|
| Sources, revisions and collection | Explicit text/file/public HTTPS intake, bounded batch collection, failure manifests, private archives; [contract](../scripts/contract.mjs), [server](../scripts/server.mjs) | Nx has four retained incident reports; two historical URL failures remain failures. Official catalog sources are separate reference material, not additional incident reports. | [Intake](../tests/intake.test.mjs) and [server](../tests/server.test.mjs) fixtures exercise collection boundaries. Live access/retention permission and protected source review remain operator/human obligations; fixture success is not live collection. |
| Manual claim extraction | Exact passage/hash checks, explicit cases/inference/conflicts, Pending-only persistence; [extract](../scripts/extract.mjs) | [Synthetic manual template](../tests/fixtures/extraction/manual.json); Nx is an agent-extracted example, not manual semantic gold. | [Extraction suite](../tests/extract.test.mjs) checks mechanical behavior. No independent manual-extraction quality evaluation is established here. |
| AI-assisted campaign extraction | Default external-chat handoff, or optional disabled-by-default CLI OpenAI generation, then separate candidate validation/application; coverage, provenance, immutable runs; [extract](../scripts/extract.mjs), [adapter](../src/model-adapter.mjs) | Nx public projection: 38 Pending claims, 14 behaviors, 3 path records, 2 Proposed mappings. Private run envelopes and article bodies are not published. | Campaign/record/adapter tests provide synthetic contract evidence, not model accuracy or live API proof. Protected human-gold evaluation and independent privacy/research review remain outstanding; generation never accepts research. |
| Claim review and stale eligibility | Explicit local decisions, correction/exclusion history and dependency/base-bound eligibility; [review](../scripts/review.mjs), [contract](../scripts/contract.mjs) | [Review fixtures](../tests/review.test.mjs) exercise decisions. No Nx claim has independent human acceptance. | Mechanical review tests do not authenticate reviewer identities or attest research truth. Local identifiers are self-attested; independent research review is outstanding. Browser counts show recorded events, not current CLI eligibility. |
| Within-case paths and cross-case comparison | Supported nodes/edges, unordered behaviors, facets and typed dates; [exploration](../src/explore.mjs), [model](../src/model.mjs) | Nx displays one campaign graph over three canonical phase paths, 12 nodes and 7 relationships. Synthetic fixtures demonstrate comparisons; Nx alone is not a cross-case pattern study. | [Workbench tests](../tests/workbench.test.mjs) exercise projections. Independent chronology, causal interpretation and cross-case synthesis remain human work; layout/shared labels prove none of them. |
| Framework and AI-artifact inspection | Pinned resolver/catalogs, scoped Proposed/unresolved mappings, exact tool/prompt projections; [framework catalog](../src/framework-catalog.mjs), [AI library](../src/ai-library.mjs) | Nx has Proposed T1059 and AML.T0053 analogies; two published prompt variants span three source occurrences. Catalog membership is not a campaign mapping count. | [Campaign-record](../tests/campaign-records.test.mjs) and [workbench](../tests/workbench.test.mjs) checks test linkage/presentation. Applicability, source meaning and artifact interpretation still need human review. |
| Telemetry and detection hypotheses | Claim-linked proposal records and allowlisted inert synthetic OTEL samples; [campaign records](../src/campaign-records.mjs), [enrichment](../src/enrichment.mjs) | Synthetic examples exercise optional records. Nx has no generated telemetry, detection hypotheses or OTEL samples; vendor guidance is not evaluated coverage. | Synthetic contract checks are not incident telemetry evaluation. No rule effectiveness, false-positive rate or detection coverage is established; rule implementation/evaluation is outside #61. |
| Exports and read-only queries | Reviewed/draft profiles, dependency closure, hashes, private/public allowlists; [contract](../scripts/contract.mjs) | [Nx typed draft ZIP](data/nx-draft.zip) and [display projection](../src/data/nx-draft.json) are locator-only public examples, not private-corpus imports or reviewed releases. | [Export suite](../tests/exports.test.mjs) checks reproducibility/eligibility/privacy boundaries. Public omissions prevent quotation verification; independent output/research review remains necessary. Private talk bundles are not public releases. |
| Browser workbench and Codespaces route | Loopback server, read-only snapshot/public preview, opt-in private store; [server](../scripts/server.mjs), [Codespaces guide](guides/codespaces.md) | Public Pending Nx draft and explicitly synthetic demos. Demos do not populate a private store. | Server/workbench and local lifecycle tests do not prove hosted startup, signed-out denial or usable rendering. Independent live Codespaces, responsive, keyboard, accessibility and editorial review still require evidence. |

Test files listed above identify relevant coverage, not an assertion that every
file is a separately configured command. The eight configured suites include
additional imported tests; current execution results must come from the verifier.

## Partial, deferred and unvalidated work

- **Partial research coverage:** four retained reports are not all relevant
  literature. Historical Red Canary/Zscaler failures are not successful retries;
  later parser support does not retroactively establish collection.
- **Partial framework resolution:** immutable catalog membership supports narrow
  resolution, not universal ATT&CK/ATLAS mapping or independently proven relevance.
  Unresolved candidates and historical unavailable metadata stay explicit.
- **Researcher-controlled AI:** external-chat handoff remains default. Optional
  CLI generation supports only explicitly confirmed public research using a
  process credential; no automatic fallback, scheduler or research acceptance.
  Requested, provider-reported and model-authored provenance remain separate.
- **Local review only:** no authenticated local identity or hosted review service.
  Mechanism correctness is separate from independent researcher acceptance.
- **Partial authoring/review:** typed timelines and additional reviewable entities
  exist in the data/display contract, but the local decision CLI is claim-only.
  Richer proposal application and timeline creation remain follow-up work; Nx
  has no timeline records. Date display is not automatic chronology extraction.
- **Unexecuted quality acceptance:** synthetic fixtures do not replace the
  protected campaign evaluation against a pre-frozen human checklist, nor human
  interpretation of conflicts, path semantics and extraction omissions.
- **Unevaluated detection:** proposal support is implemented; detection-rule
  execution and effectiveness are not demonstrated. No performance metric is
  inferred from a framework mapping or synthetic sample.
- **No release/deployment claim:** a public draft artifact is not an approved
  research release. Human review, public-artifact review and release readiness
  remain separate from local tests; this task publishes no site.

## Reproducing mechanical verification

From the repository root, run `python scripts/verify.py`. It runs scaffold
validation/Python tests and the following configured application commands from
[`project.config.json`](../project.config.json):

```sh
node --test tests/contract.test.mjs
node --test tests/intake.test.mjs
node --test tests/extract.test.mjs
node --test tests/review.test.mjs
node --test tests/exports.test.mjs
node --test tests/workbench.test.mjs
node --test tests/server.test.mjs
```

There is no configured lint/build or browser-test command. Record exact command
results, failures/skips, runtime/platform and full final tested commit SHA on the
originating PR; rerun after the final commit. These are application contract and
synthetic-fixture tests, not live research acceptance or independent visual review.
See [setup and verification policy](setup-and-configuration.md).

## Issue #61 acceptance evidence

The historical [criterion evidence and unresolved reviews](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md#issue-61-acceptance-evidence)
are retained in development history, separate from capability maturity.
The [current obligation map](acceptance-audit.md#issue-77-retained-obligations)
keeps the documentation/research reviews open after archival removal, including
human confirmation of inventory consolidation and deferred durable curation from
the dated usability review. Archiving a narrative does not complete its outcomes.
