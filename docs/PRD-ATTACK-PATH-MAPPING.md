# Attack-path mapping and interactive exploration

> **Historical specification — archived in place on 2026-10-15.**
> Inspected for consolidation at `f15a8d806c4e2213896da1070dce218c881e5cc5`;
> original planning base: `a03fb8a` (2026-10-13), with frozen 0.2.0 prototype
> references. Requirements and the synthetic concept below are not proof of
> shipped functionality or research acceptance. Use [architecture](architecture.md),
> [current data model](reference/data-model.md) and [status](status.md) for
> implemented, partial and unevaluated behavior. Stable criteria and concept
> links remain intact; see [history](archive/README.md).

Status: Draft baseline for later implementation/enhancement. Prepared 2026-10-13.
Inspected application base: `a03fb8a`; prototype reference: frozen 0.2.0 handoff.
Proposed issue title: `[Task] Ground node-scoped attack-path mappings and interactive exploration`.

## Purpose and current baseline

Let a researcher traverse **case -> path node/relationship -> supporting claim
-> exact source passage -> local behavior -> candidate technique -> collection
or detection proposal** without losing provenance or confusing inference with
reported activity. A visually connected graph alone does not establish execution,
causality, chronology, attribution, or a shared campaign.

This PRD preserves the useful interaction model from
[`app-v2.js`](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference/app-v2.js),
[`REVIEW_AND_PLAN.md`](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference/REVIEW_AND_PLAN.md), and
[`AGENT_CONTRACT.md`](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff/reference/AGENT_CONTRACT.md). The current
[`src/explore.mjs`](../src/explore.mjs) already restores an SVG graph, selectable
nodes/edges, zoom/pan, node drag grips, reset, a text alternative, evidence links,
and optional research views. This is an incremental specification, not a request
to rebuild that working baseline or import the prototype's incident assertions.

The checked-in [interactive concept](assets/attack-path-concept.html) is a
standalone synthetic example for reviewing navigation and visual semantics.
It contains no incident assertions, real quotations, framework IDs, runtime
model calls, or corpus write-back. Open it in a browser; select nodes/relationships
or use the text controls, zoom/pan, move nodes by their grips, and reset. Its
synthetic inspection text is illustrative, not a validated corpus record.
Prototype and concept behavior do not constitute production browser acceptance.

## Dependencies and boundary with extraction

- Use core 0.3.0 paths, nodes, edges, behaviors, mappings, claims, passages,
  frameworks, telemetry, detections, and OTEL contracts and existing private store.
- The [campaign extraction PRD](PRD-CAMPAIGN-EXTRACTION.md) owns retained-text
  extraction, provider/prompt/run provenance, grounded candidate generation,
  catalog resolution, private validation/persistence and pending outputs.
- This PRD owns path/mapping semantics, interactive inspection, navigation,
  accessibility, and presentation of those validated records. It may use synthetic
  fixtures before extraction exists. Do not require a separate implementation PR
  for features already delivered under the extraction issue: assign overlapping
  work to one originating issue and record satisfied criteria explicitly.
- A future implementation must have one human-authorized originating issue/PR,
  with scope and criteria copied here. No issue is created by this draft commit.
- Production framework mappings require a pinned, official, versioned catalog;
  the concept deliberately uses an unresolved candidate instead of inventing IDs.

## Research semantics

Paths belong to one explicit case and identify representative or composite scope.
Composite/research exercises must be visibly labeled. Node IDs are stable within
their path; a node represents an action or context, links local behavior IDs and
supporting claim IDs, and retains evidence status, origin and pending disposition.
A setup node need not have a technique mapping. A shared behavior is not proof
of common actor identity or of adoption in every environment.

Each edge has stable ID, endpoints within the path, relation, supporting claims,
origin and a plain-language basis. `sequence` denotes a reported or reconstructed
sequence according to that basis; `conditional` denotes a prerequisite, optional
transition or unestablished execution; `propagates` denotes supported/reconstructed
propagation, including loops. Relation and evidence strength are separate: a
solid line can still be inferred. Display that distinction in the legend and
inspection. Do not turn publication order or canvas position into event chronology.
Unordered behaviors are acceptable when no relationship is supported.

Claims referenced by nodes/edges must belong to the path's case and resolve to
their own source revision/passages or explicitly labeled inference support.
Retain contradictory reports independently and expose conflicts. Missing support
is unresolved, never silently represented as established evidence. Graph scope
filters cannot pull another case's claims or mappings into the current path.

Node-specific mappings include caseId, pathId, nodeId, behaviorId, techniqueId,
framework/version, exact claimIds, rationale, applicability, origin, and Proposed
status. The behavior must belong to the target node; supporting claims must
support that node, and catalog membership/version must validate. Broader
behavior/case mappings may exist, but label their scope separately rather than
presenting them as node-specific. No forced ATLAS/ATT&CK match. Preserve literal
source-mentioned IDs separately when official resolution fails.

Retain the prototype's semantic guardrails: intended credential theft is not
completed exfiltration; malicious PR delivery is not proof of victim installation;
conventional package scanning is not automatically agent credential retrieval;
AI-assisted attacker activity and victim-side agent abuse are separate roles.
These are interpretation constraints, not accepted assertions about old cases.

## Interaction requirements

### Path selection and canvas

List paths in the selected case/filter scope with case kind, path scope and review
state. Route to stable path/node identifiers using existing routing conventions;
preserve case/filter context on related-view navigation. Invalid or retired IDs
produce an explanatory state with navigation back to the case, not a crash or a
silent selection in another case. A case without paths shows its available claims
and behaviors with a clear no-path state; collection alone must not create a graph.

Show direction arrows, readable node labels, relationship labels, and a compact
legend. Use solid/dashed/loop geometry plus text so color is never the only cue.
Distinguish selected from focused elements. Labels that exceed the visible box
remain available in inspection and the text alternative. Handle branching,
cycles, self-loops and disconnected components without suppressing evidence.

Reuse SVG and existing dependencies. Support bounded zoom, background pan,
node movement through explicit grips, and reset to a deterministic layout fitted
to all nodes. Pointer capture and cancellation terminate gestures cleanly;
dragging must not accidentally select another entity. Positions, zoom, and pan
are presentation state only and never alter corpus content/hashes/review status.
For the first production enhancement, keep layout state in memory; durable user
layouts and automated layout libraries are deferred.

### Node and relationship inspection

Selecting a node shows title/detail, evidence classification, authorship/review
state, supported claims and their source citations/exact passages, uncertainty
and conflicts, local behaviors, and relevant node-scoped candidate mappings.
Each mapping displays framework/version, status, rationale and applicability;
an empty mapping list means no candidate recorded, not absence of the behavior.

Selecting an edge shows named endpoints, relation, basis, origin, review state,
support and uncertainty/conflicts. Keep sequence/reconstruction/conditional
wording visible. Do not display node evidence as if it independently establishes
the edge. Preserve selection while inspecting linked evidence and allow return.

From a selected behavior, offer explicit navigation to source-reported data
sources/published detection references, proposed security telemetry/detections,
and proposed OTEL instrumentation. Keep these distinctions and synthetic sample
labels visible. Opening a reference never executes its contents or launches a
model. Render imported text safely and preserve exact artifact text on inspection.

### Keyboard, touch, theme, and export

All nodes/edges are reachable through named keyboard controls; Enter/Space select,
focus is visible and stable after redraw, and pointer gestures have non-dragging
alternatives. Provide zoom/reset controls and a complete text alternative listing
nodes, directed relationships, relation/basis and evidence links. Arrow pan/move
controls or equivalent accessible buttons provide alternatives for layout changes.
Inspection updates are announced without repeatedly reading the entire graph.

At desktop and narrow mobile widths, controls and inspection remain usable;
long commands/quotes wrap or scroll within their container. Respect both existing
themes and reduced-motion preferences; use existing design tokens and typography.
Do not introduce another product shell or restyle unrelated views.

Private JSON/Markdown talk exports preserve paths, node/edge support, scoped
mappings, source/revision/passage closure, uncertainty and proposal labels. Visual
canvas positioning is optional presentation metadata, excluded from research
identity. Standalone graph-image exports and public interactive publication are
future work; a screenshot is never substitute evidence for a source passage.

## Exclusions and future enhancements

No autonomous attack execution/replay, model service/provider integration, article
collection/OCR, public publishing, new review workflow, automatic acceptance,
legacy incident import, inferred case merging, full graph-authoring editor,
graph database, external layout dependency, automatic attack simulation, or
unrelated theme redesign. Defer saved layouts, large-graph minimaps/clustering,
side-by-side path comparison, visual exports and collaborative authoring.
The synthetic concept is documentation, not a second production application.

## Stable acceptance criteria

| ID | Observable outcome | Verification |
|---|---|---|
| AP-01 | Existing case/path/node routes and filters isolate path records; missing/empty/retired targets explain their state without cross-case fallback. | Model/routing/workbench fixtures including no-path and mixed-case cases; human navigation review. |
| AP-02 | Node and edge references resolve within case/path scope; origins, classifications, pending state, uncertainty and conflicts survive display/export. | Contract/reference tests; human review that supported nodes do not imply supported edges. |
| AP-03 | Node-scoped mappings match the node's behavior/support and pinned framework version; broad/unresolved mappings are labeled separately; no forced mapping. | Valid/invalid scope/catalog fixtures and no-match case; human rationale/applicability review. |
| AP-04 | Selectable directed branches, conditional transitions, propagation loops and disconnected nodes show distinct geometry/text and retain full inspection labels. | Synthetic graph fixtures and browser inspection at desktop/mobile widths in both themes. |
| AP-05 | Zoom/pan/drag/reset behave predictably within bounds; cancelled gestures stop; graph content/hashes/review state stay unchanged; reset fits every node. | Pointer/browser checks including drag versus click, cancellation, multirow graph and before/after corpus digest. |
| AP-06 | Keyboard/text alternatives reach every node/edge and inspect the same support; non-dragging movement alternatives, stable focus, accessible names and announced inspection work. | Browser keyboard checks and independent human screen-reader/focus review. |
| AP-07 | Traversal node -> claim/passage -> behavior -> mapping/telemetry/OTEL retains case context and separates published references, proposals and synthetic samples. | Navigation/export regressions and human walkthrough; unsafe imported-text fixture. |
| AP-08 | Private JSON/Markdown exports contain complete selected path/mapping support closure and all limits/provenance labels; no private bodies or screenshots enter Git. | Export/reference tests, Git-ignore/tracked-file checks, human bundle review. |
| AP-09 | Existing intake/history, manual extraction, review, comparisons, theme and research views pass final checks; implementation docs/changelog and criterion evidence are fresh. | `python scripts/verify.py` with configured application commands on full final SHA; hosted Verify/PR Policy and independent human research/UX review. |

AP IDs remain stable during refinement and are separate from extraction AC IDs.
Independent semantic/accessibility/UX review cannot be satisfied by an agent
self-audit or automated metadata checks.

## Definition of done for a future implementation

Confirm bounded issue scope, reuse already-working graph components, implement
missing criteria with synthetic fixtures, then inspect a privately extracted
campaign without treating real source associations as shared attribution.
Record criterion-to-file/test/durable-evidence links, exact final commands/counts
and SHA, and limitations. Follow AGENTS.md and documentation applicability rules;
update relevant architecture/README/acceptance audit and substantive CHANGELOG
for production code changes, with learnings only when useful. Obtain independent
human research, accessibility and UX review before merge. Publishing or merging
requires user authorization. This draft commit claims only documentation and a
synthetic interactive concept, not implemented production enhancements.
