# Copilot cloud-session prompts

Extract/upload this entire pack into the selected repository. Select GPT 6.1 Sol if available; record actual model otherwise. These prompts do not launch sessions or configure accounts.

## First session: Issue 001 (foundation slice)

```text
Implement only handoff/ISSUE-001-FOUNDATION-CONTRACT.md, using
handoff/00-START-HERE.md, handoff/SHARED-CONTRACT.md and
handoff/01-FOUNDATION.md version 1.1.
Inspect repository instructions first. Treat handoff/reference as the frozen
code/data baseline; preserve IDs and grounding semantics. Do not infer
missing chat history or run historical migrations.
Implement core source/case/claim contracts, many-to-many source/case links,
revision-anchored passages, multi-label categorization, typed timelines,
review dispositions and optional enrichment references. No fetching or
LLM integration yet. Pin the selected Node toolchain. Document migration
from 0.2.0 to 0.3.0 and preserve IDs/uncertainty. Run Issue 001 gates and
GC-05 regressions; full foundation acceptance is deferred. Produce a reviewable
PR with requirement-to-test traceability, exact commands and failures.
Do not implement next issues, approve research claims or publish externally.
```

## Subsequent phase prompt

For remaining foundation slices, replace the phase instruction with the selected issue draft, cite PRD v1.1, run only that issue's gates plus affected regressions, and report full-phase criteria still outstanding. Manual given-article pipeline first; no automated ingestion until a later explicit issue.

```text
Implement only Phase [N] from handoff/[PHASE-PRD].md, following
handoff/00-START-HERE.md and handoff/SHARED-CONTRACT.md.
Verify prerequisite gates and read the prior implementation handoff.
Preserve stable IDs and interfaces; document migrations/decisions.
Use reference files for layout/data comparison, not to repeat known bugs.
Implement all requirements and run every acceptance criterion for this phase.
Update docs/decisions and requirement traceability. Stop with a concrete
reviewable PR; report unmet gates and deferred work honestly.
Do not implement later phases or deploy without explicit authorization.
```

| Phase | PHASE-PRD |
|---|---|
| 1 | 02-WORKBENCH-UI |
| 2 | 03-CURATION |
| 3 | 04-INGESTION-ACTIONS |
| 4 | 05-RELEASE-DOCKER-HOSTING |
| 5 | 06-AGENT-ACCESS |

## Review prompt

```text
Review against every requirement/acceptance ID in the selected PRD and
SHARED-CONTRACT.md. Check grounding, draft visibility, scoped mappings,
dependency integrity, reproducibility and actual test evidence.
UI review must inspect rendered screenshots and pointer/keyboard behavior;
HTML-generation checks are insufficient. Ingestion review must inspect
permissions, untrusted-input handling, budgets, manifests, fixtures and
approval separation. Report defects with file/line and severity. Mark
unmet mandatory gates; compiling alone is not approval.
```

## Completion report

Phase/PRD version; actual model/toolchain; implemented IDs; acceptance results/commands; artifact/corpus digests; migrations; unresolved issues; deferred requirements; next prerequisites. Distinguish structural validation, browser tests, source review, sensor tests and live-model evaluation.

When evidence is missing, document the gap; do not fabricate sources, reviewer identities, availability or test results. Architecture changes need a decision and amended acceptance criteria. Account and runtime model configuration are explicit deployment choices.
