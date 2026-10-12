# PRD 02 — Human-first research workbench

## Objective

Version 1.1 alignment: first implement collection, source/claim review, case library, filtering and export. Then comparison/timelines; graph/framework/detection views are optional enrichment slices. Preserve reference visual identity and eight-view end-state, but do not require paths or ATLAS to collect/review a case. Static public site read-only; local curator changes exported as proposals. Foundation already defines file/CLI review; Phase 2 adds durable curator UI/repository promotion.

## Layout contract

Use reference/index.html, style.css, v2.css and app-v2.js as structural references. Preserve the visual identity; avoid an unsolicited dashboard redesign. No remote fonts or raster icon generation required.

| Token | Value |
|---|---|
| paper | #f6f3eb |
| surface | #fffdf7 |
| ink | #25352f |
| muted | #68746b |
| divider | #dcded2 |
| accent | #cb572d |
| soft accent | #f5e5d8 |
| link/green | #2c5e50 |

Body: Segoe UI/Arial/sans-serif, 14px, line-height 1.6. Hero/headings: Georgia/serif. Main max-width 1540px, horizontal padding 4.5%. Header: brand left, release state/export right. Hero: two-column title/research note. Four-count stats strip. Eight-tab horizontal navigation, search/scope toolbar, view content, footer with version/trust state. At <=700px hide hero side note, stack workbench columns, use two-column stats, single-column cards and scrollable tabs; no document-wide horizontal overflow.

## Requirements

- UI-01: Initial collection navigation: Case library, Research library, Claims & review, Trust & method. Add Comparison & timelines in next slice. Reference eight-view enrichment navigation is a later optional mode; graph/ATLAS absence does not block core records. Empty enrichment views explicitly say not yet modeled, not no attack occurred. Active view and release/draft state visible.
- UI-02: Attack view has campaign selector, SVG canvas and selected-entity details. Desktop default viewBox 920×430, node 250×100, canvas height 390px/320px mobile. Fit-to-view handles longer paths; text must not be clipped merely to retain defaults.
- UI-03: Directed arrow edges: sequence solid, conditional dashed, propagation orange loop. Labels/legend explain reconstructed/composite uncertainty. Selecting node/edge reveals its evidence, basis, origin and review status. Inline vector icons: package, agent, key, network, source, shield, terminal and graph. Decorative icons aria-hidden; controls accessible names.
- UI-04: Zoom, pan, reset and node repositioning. Pan cannot steal activation; drag threshold 5px. Layout changes local only. Keyboard node/edge selection, visible focus and a complete text alternative. Escape cancels movement. Provide button alternatives for graph actions; rearrangement is optional for understanding.
- UI-05: Node details link campaign, source/locator, behaviors, scoped framework candidates, telemetry and detection hypotheses. Edge details distinguish supporting endpoint evidence from inferred causality.
- UI-06: Campaign cards show kind/limits/sources/path links. Hide/restore affects presentation only; active/total counts labeled. Behaviors compare distinct records without attribution inference.
- UI-07: ATLAS view includes full imported official catalog, mapped-only switch, versions/maturity and node-level applicability. ATT&CK subset labeled. Local behaviors without MITRE mapping remain discoverable.
- UI-08: Security view displays sensor families, logical fields, join keys, availability/limitations and hypotheses/test status. OTEL separately displays standard fields, Development conventions, proposed custom attributes, synthetic logs/spans and visibility gaps. Copy actions report success/error.
- UI-09: Research library lists all sources independent of campaign filtering, provenance, snapshot/fetch state and linked claims. Trust view explains origin/review/evidence axes and export semantics.
- UI-10: Stable routes include #paths/path-nx/nx-4 and #atlas/AML.T0053. Unknown/malformed hash recovers without crash. Crosslinks reveal their target even if old filters/hide preferences exclude it; explain context reset.
- UI-11: Search scope explicit per view; empty results explain filters and offer reset. Export downloads the complete selected release corpus, not the filtered view, with digest and eligibility state.
- UI-12: Source strings render as text; safe external URL handling. Never relabel LLM content as analyst-reviewed. Color is supplemental to text/symbol labels.
- UI-13: Source passage shown beside extracted claim fields with revision/locator, uncertainty, conflicts and reviewer disposition. Local corrections produce schema-valid change sets against base digest; public UI cannot silently accept claims. Optional graph source panels reuse this claim view.
- UI-14: Filter core records by trust surface, AI involvement, execution location, tool, delivery, objective, evidence status, disposition and typed date range. Multi-label filters describe AND/OR semantics. Counts show unit/filters/review coverage; repeated articles do not inflate cases. Timeline distinguishes publication/activity/discovery/disclosure with precision; comparisons labeled observations within the collected dataset.

## Acceptance criteria

Browser tests at 1440×900, 1024×768 and 390×844; screenshots attached to implementation review. The reference contains no verified screenshots. UI-02–08 graph/framework/telemetry portions and UI-A2–3 are gated to enrichment slices, not collection completion. UI-A1 tests all implemented core tabs first and eight enrichment tabs when that slice ships.

- UI-A1: All tabs load; deep-link reload retains selected node; malformed percent-encoding does not crash.
- UI-A2: Mouse/keyboard selection resolves every path node and edge to evidence; conditional and propagation fixtures have distinct legend/labels.
- UI-A3: Zoom/pan/drag/reset work; touch scrolling outside canvas works; text alternative usable without pointer.
- UI-A4: Crosslink reveals hidden campaign/filtered technique and explains changed context.
- UI-A5: No document overflow at target viewports; 200% zoom retains readable controls. No serious/critical automated accessibility findings; record keyboard walkthrough.
- UI-A6: Intent, inference and unreviewed labels visible in graph details, mappings and exports; counts distinguish campaign/exercise/comparator.
- UI-A7: Rendering requires only frozen local assets, not live third-party scripts/data.
- UI-A8: Core-only case/source/claim visible without paths/mappings; side-by-side passage review exports a proposal without mutating acceptance.
- UI-A9: Multi-label filter, typed approximate timeline and duplicate-source fixture retain correct case count and review coverage; conflicting claims visible separately.

Visual fidelity gate compares layout order, typography, tokens, spacing and graph/detail structure to reference source. Different OS fonts need not be pixel-identical. Any redesign requires a documented decision. HTML-generation tests are not browser QA.
