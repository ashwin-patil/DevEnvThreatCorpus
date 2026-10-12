# DevEnvThreatCorpus: phased implementation handoff

PRD version 1.1 · 12 October 2026 · Proposed requirements, not implemented services.

## Product objective

Start with a manual pipeline for given articles/text: add source → extract draft → categorize → review → link to case → export. Then add comparison/timelines and optional enrichment. Researchers, defenders, curators and agents must retain passages, uncertainty and conflicting claims. Attack paths, framework mappings and telemetry/detection opportunities are later enrichment, not collection prerequisites. Reuse the prototype visual identity when implementing the website.

Use GPT 6.1 Sol when selectable in the destination session. This pack does not establish that Copilot offers that exact model name. Record the actual model used; do not silently claim equivalence. The coding-session model is separate from any runtime extraction model. Identical model choice does not guarantee identical output: determinism comes from frozen inputs, stable contracts, reproducible builds and acceptance tests.

## Read order and precedence

1. This document: scope, architecture and phase gates.
2. SHARED-CONTRACT.md: binding data and grounding rules.
3. Selected phase PRD: implementation requirements and tests.
4. reference/: frozen prototype and corpus.
5. COPILOT-PROMPTS.md: reusable session prompts.

Shared contract overrides examples; phase requirements override legacy reference behavior. Document discrepancies, migrations and decisions. Requirement IDs are stable. A PR must trace each requirement to implementation and acceptance evidence.

## Phase plan

| Phase | PRD | Deliverable | Prerequisite |
|---|---|---|---|
| 0 | 01-FOUNDATION.md | Manual intake, core source/case/claim contracts, CLI review and exports; delivered issue by issue | None |
| 1 | 02-WORKBENCH-UI.md | Collection/review/search first, then comparison/timelines and optional enrichment views | Relevant Phase 0 issue gates |
| 2 | 03-CURATION.md | Review UI and protected repository promotion over foundation review events | Phases 0–1 |
| 3 | 04-INGESTION-ACTIONS.md | Deferred automated source ingestion producing drafts | Phase 2 and explicit later authorization |
| 4 | 05-RELEASE-DOCKER-HOSTING.md | Container and static-hosting releases | Phases 0–2; ingestion optional |
| 5 | 06-AGENT-ACCESS.md | Grounded agent queries and evaluations | Phases 0–2; Phase 4 for public API |

Phase 4 may precede Phase 3. A draft-preview release can ship the seed before human review, with clear labeling. Foundation defines acceptance eligibility; Phase 2 strengthens repository promotion and UI. The supplied lightweight PRD stages map as follows: Collection → Phase 0 + first Phase 1 slices; Comparison → next Phase 1 slices; Enrichment → optional later Phase 1 views/mapping work. Start with ISSUE-001-FOUNDATION-CONTRACT.md; do not implement the whole roadmap in its first issue. No external issue publication or deployment is authorized by this pack alone.

## Architecture decisions

- Phases 0–1: static HTML/CSS/JavaScript modules and SVG; Node.js build/validation/query tooling; modular JSON source files. No frontend framework, database, vector database or runtime LLM required.
- Pin a supported Node LTS major at implementation kickoff and use a lockfile. Browser tests use Playwright as a development-only dependency.
- Foundation: manually supplied URLs/text and file/CLI-based review, no model required. Sources/cases/claims separate and many-to-many source/case relationships supported. Proposed target schema 0.3.0 explicitly migrates frozen 0.2.0; frozen reference is not modified.
- Phase 2: repository files/protected pull requests strengthen foundation review. Curator UI exports change sets; public browser has no repository write credentials. Hosted authentication, SQLite and shared server editing deferred.
- Phase 3: GitHub Actions orchestrates bounded fetch, draft extraction, validation and proposal submission.
- Phase 4: one explicit dist/ artifact feeds Docker and Cloudflare static hosting.
- Phase 5: existing static exports and CLI first; dynamic read-only API only when explicitly selected.

## Proposed repository structure

```text
library/                 sources, cases, claims, categories, timelines; optional enrichment
inputs/                  supplied text/retrieved content, private and rights-aware
staging/                 ingestion proposals, excluded from public releases
reviews/                 append-only review decisions
config/                  source registry, budgets and version pins
schemas/                 corpus, proposal, review and run schemas
src/                     HTML, CSS, browser modules and SVG icons
scripts/                 manual intake, extraction, review, build, query and eligibility
fixtures/                benign recorded source and semantic fixtures
tests/                   contracts, unit and browser acceptance
public-docs/             reviewed user-facing references
.github/workflows/       validation, ingestion and release
dist/                    generated explicit public release allowlist
docs/decisions/          decisions, migrations and traceability
docs/issues/             reviewable issue drafts, starting with Issue 001
```

## Definition of done

Implement only the requested phase. Each implementation PR lists requirement IDs, passed/failed acceptance criteria, actual commands, migrations, unresolved limitations and next-phase prerequisites. Mandatory failures mean the phase is incomplete. Tests verify meaningful behavior. Distinguish structural checks, browser QA, source review, sensor validation and live-model evaluations; one cannot substitute for another.

## Frozen reference limitations

The included v0.2 reference has five campaign/exercise/comparator records, five paths, eight behaviors, 23 evidence statements, 208 ATLAS techniques/subtechniques and two ATT&CK techniques. Derived claims/mappings are LLM-origin and unreviewed. Article snapshots are incomplete. Visual/pointer QA was blocked in the original session: source files are a layout baseline, not verified screenshots. Never infer inaccessible chat content or manufacture missing URLs.

REFERENCE-MANIFEST.json pins the included reference files by SHA-256. Preserve the reference; implement in the target source tree. Historical migration scripts are intentionally excluded.

## Revision 1.1 scope changes

The supplied lightweight PRD is retained in inputs/USER-PRD-2026-10-12.md inside this handoff. See CHANGELOG.md for merge decisions. DevEnvCorpus is treated as a short name for DevEnvThreatCorpus; no runtime/repository rename is performed. Source passages, manual collection and timelines now belong to foundation; paths/ATLAS are optional. Future-phase specs inherit the updated shared contract and cannot require enrichment to collect a case.
