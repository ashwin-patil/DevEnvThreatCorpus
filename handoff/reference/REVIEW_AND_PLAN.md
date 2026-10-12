# Researcher, practitioner and AI-consumer review

Reviewed 11 October 2026. Baseline: v0.1. Revised prototype: v0.2.

## Main finding

The original prototype was a useful article-to-evidence sketch, but not yet a reliable investigation workbench or a trustworthy autonomous-agent knowledge base. It mixed representations of an attack, framework interpretation and collection proposals. Those distinctions matter more than increasing the article count.

This review is based on the application source, corpus structure and documented task workflows. Browser inspection was blocked by a saved site-access preference. A retry after the user changed permissions still returned the same block. Consequently, visual appearance, mobile layout, pointer interaction and perceived usability are not empirically verified here. Findings about those areas are design/code observations or explicit hypotheses, not user-study results.

## Human-first workflows

| User and question | Recommended path through the application | Useful output |
|---|---|---|
| Researcher: “What happened, and what is actually established?” | Campaign library → path → cited node or edge → source record | Source section, evidence status, limitations and separately labeled inference |
| Practitioner: “Could I detect this in my environment?” | Path node → behavior → security telemetry → detection hypothesis | Required events, logical fields, joins, sensor gaps and benign controls |
| Agent platform engineer: “What must the runtime expose?” | Behavior → OTEL opportunity → standard reference → synthetic sample | Standard versus custom fields, instrumented action, trace correlation and privacy requirements |
| Corpus curator: “Should this article be added?” | Admission gate → source register → evidence ledger → proposed path → human review | Include/hold/reject decision and source-supported novelty |
| Framework researcher: “Which ATLAS techniques fit?” | ATLAS catalog → proposed mappings → particular path node → evidence | A conditional candidate mapping rather than a broad campaign-level label |

The workbench should preserve the user's place when moving between these views. A path is the narrative entry point, but campaign and source libraries are equally important entry points. An agent should traverse these same relationships through IDs, not scrape the rendered page.

## Findings, impact and disposition

| Priority | Baseline gap | Why it matters | v0.2 response / remaining work |
|---|---|---|---|
| P0 | “Attack path” was a card grid with edge text | Branches, loops and optional actions were difficult to see | Added SVG graph with selectable nodes/edges, zoom, pan, drag grips, arrows, conditional lines and propagation loops. Visual/pointer QA remains pending. |
| P0 | LLM authorship hidden behind “analyst draft” | A reader or downstream model could treat generated interpretation as reviewed research | Explicit origin and review labels on claims, edges, mappings, behaviors, detections and samples. Every derived seed remains unreviewed. |
| P0 | Generic behavior-to-ATLAS mapping | Conventional secret scanning could be misrepresented as agent credential access | Introduced mapping entities scoped to campaign, path and node, with evidence IDs, applicability and rationale. Removed the Nx package-scanning→agent-retrieval assertion. |
| P0 | A Deadbugz delivery→execution edge implied adoption | Unmerged PRs and researchers' endpoint tests do not establish victim installation | Made the relationship conditional and contextual; kept credential seeking as intent. Human source review still needed. |
| P0 | Agent consumption flattened evidence and proposals | Retrieval could turn a hypothetical detector or synthetic event into an observed fact | Normalized entities, versioned schema, deterministic entity/bundle query, JSONL export and consumer contract. |
| P1 | Campaigns, paths and sources embedded in seed generator | Adding/removing articles could orphan claims or require editing UI code | Separate library modules plus reference validation; local hide/restore. Canonical retirement and review UI are planned. |
| P1 | Regular telemetry mixed with OTEL | EDR, network and identity collection cannot be assumed to be agent spans | Separate tabs and entities. Security telemetry describes logical sensor requirements; OTEL describes runtime instrumentation proposals. |
| P1 | No standalone framework library | Reader could not inspect unmapped techniques or conventional TTPs | Imported pinned ATLAS 2026.09 metadata and selected ATT&CK techniques; dedicated catalog with corpus reverse links. Definition text remains on official pages. |
| P1 | Sparse detection actionability | “Monitor secret access” is not enough to implement or evaluate a detector | Added logical fields, joins, proposed correlation window, false-positive tuning, test plan and explicit untested state. Vendor adapters and measured rules remain future work. |
| P1 | Generic OTEL custom fields without a standard reference | Consumers could mistake prototype attributes for an adopted standard | Added standard log-field model, signal types, development-status GenAI/MCP fields, pinned docs and redacted synthetic examples. No harness exporter is claimed. |
| P1 | No stable entity navigation | Researchers lose the relationship between a technique and the exact node | Added hash routes and reverse links between path nodes, campaigns, behaviors, sources and framework mappings. |
| P1 | No source snapshots or conflict handling | A live page may change; disagreement between reports disappears | Snapshot/hash status is visible. Only framework/docs fingerprints are recorded now; article snapshots, conflict records and claim comparison are planned. |
| P2 | Empty states and library lifecycle limited | Curators cannot tell whether a record was retired, filtered or absent | Added scope/search empty-state guidance and reversible local hide/restore. Named retirement reason and impact preview are planned. |
| P2 | Long dense panels and unclear icon semantics | Reader has to scan prose before identifying a host, agent or data boundary | Added local vector icons, progressive disclosure and separate views. Screen-reader, contrast, focus and mobile checks remain pending. |
| P2 | No coverage measurements | Record count can look like detection completeness | Labels distinguish catalog, mappings and hypotheses. Coverage by sensor availability and validated test result remains future work. |

## Avoiding shallow AI-generated content

An attractive graph does not prove causality. A link to a primary article does not prove that every generated claim matches it. A high admission score does not mean source accuracy was checked by a human. A framework technique with “Realized” maturity does not mean this campaign executed it. The application now exposes these distinctions, but human semantic review remains necessary.

Do not add material just to fill every column. Leave a behavior unmapped if ATLAS does not fit; optionally assess ATT&CK or retain a local category. Keep unknown dates and outcomes unknown. Limit article paraphrases to claims needed for the representative path. Do not infer shared attribution from similar techniques. Do not convert malicious instructions into confirmed credential access.

Review should operate on individual claims and relationships. Each approval needs reviewer identity, timestamp, corpus version, source locator and rationale. Source text, README files, retrieved pages and telemetry payloads must be treated as untrusted content, including any instructions embedded inside them.

## AI-agent corpus assessment

The revised corpus is suitable for bounded, read-only retrieval and evidence-aware synthesis. It is not suitable as a source of automatically approved incident facts, autonomous containment decisions or production detection rules.

Useful tasks include retrieving an evidence bundle for one campaign, comparing a behavior across independent records, identifying sensor requirements, finding candidate ATLAS mappings and drafting a review checklist. The agent should return structured statements with evidence IDs, URLs, locators, evidence status, representation origin and review state. Its answer must carry limitations from the originating record.

Remaining backend gaps: no transactional curator API, authoritative human review store, semantic retrieval evaluation set, conflict-aware ranking, snapshot replay, tenancy/access controls or deployed SIEM connector. Those are explicitly separate from static corpus export. The read-only query script provides deterministic ID lookup and bundles; it does not claim a hosted backend service or MCP endpoint.

## Fix plan and acceptance gates

| Stage | Work | Acceptance gate | Status |
|---|---|---|---|
| 1. Evidence and model | Modular entities, explicit origins, scoped mappings, conditional edges, reference checks | No orphaned links; no intent promoted to observed exfiltration; synthetic samples remain labeled | Implemented; automated checks pass; semantic human review pending |
| 2. Exploration | Graph, vector icons, entity routes, campaign/source libraries, separate telemetry and framework views | Researcher can traverse source→node→behavior→candidate TTP→sensor without losing context | Implemented; browser acceptance pending |
| 3. Curation | Add/import/retire UI, dependency impact preview, named claim/edge review, source snapshots, conflict records | New content cannot be promoted without required evidence and review; retirement preserves historical citations | Planned |
| 4. Practical detections | Choose one benign-controlled scenario, map actual SIEM tables, instrument one harness, implement adapter and rule | Replay malicious and benign fixtures; measure recall/false positives; publish supported fields and limitations | Planned |
| 5. Agent contract | Evidence bundles, schema validation, retrieval evaluations, answer citation validator, read-only API/MCP | Unsupported assertions and instruction injection from source text are rejected; citations resolve reproducibly | Local contract/query implemented; API and evals planned |

First validation scenarios should be package-install→agent-launch and MCP-definition-change→sensitive-tool-intent. Begin with synthetic fixtures and benign controls, not live malware. Set the analytic window after measuring actual workflow timing; the prototype's 300 seconds is a proposed starting value only.

## Browser acceptance checklist

- Desktop and mobile: graph labels, edge crossings, pan/zoom, node dragging and layout reset.
- Keyboard and screen reader: node/edge selection, text alternative, visible focus, tab switching and details controls.
- Crosslinks: campaign/source/behavior/framework routes and back/forward navigation under active filters.
- State: hide/restore, empty scope, malformed/unknown hash, and persistence without changing canonical data.
- Samples/export: copy behavior, complete JSON export and schema validation after export.
- Research tasks: time to find the source-supported endpoint of a path; ability to explain why a candidate mapping is conditional.

These checks are outstanding until browser access or a human testing session verifies them.
