# PRD 06 — Grounded read-only agent access

## Objective

Version 1.1 alignment: sources/cases/claims and passage-supported categorizations/timelines are core. Accepted reviewed records queried by default. Optional paths/ATLAS/telemetry need not exist; missing enrichment is not evidence that behavior is absent. Bundle/answer citations use claim IDs plus source revision/passage/locator. Legacy evidence-ID fixture references remain migration-compatible.

Expose the same evidence model to agents without weakening human grounding. Static exports and CLI first; dynamic API/MCP only when explicitly requested. No autonomous remediation, source execution or corpus promotion.

## Requirements

- AGT-01: list/get/bundle return schema version, release profile and digest. Reviewed-only default with explicit includeDrafts; draft entities retain origin/review warning. Resolve research and framework documentation sources.
- AGT-02: Factual answers include evidence IDs, source URL/locator, evidence status, inference basis, review status and digest. Missing evidence means unsupported/unknown, not disproven behavior or invented support.
- AGT-03: Sources never become agent instructions. Read-only tools accept bounded typed IDs/filter values. Unknown IDs return structured errors, not fabricated entities.
- AGT-04: If API selected, versioned GET manifest/entities/bundle endpoints, bounded pagination and explicit draft profile. No write endpoint or browser-delivered model key. Static export remains baseline; dynamic platform/quota decision documented separately.
- AGT-05: Semantic search optional derived index with evidence/source hashes. Stale index rejected on digest mismatch; retrieval cannot create facts. Vector database unnecessary for baseline lookup.
- AGT-06: Evaluation fixtures cover grounded positive retrieval, intent/outcome, cross-campaign contamination, unmapped behavior, missing locator, hostile source instructions, stale reviews and OTEL custom/standard confusion. Deterministic contracts plus separately scored live-model run recording actual model/prompt/version.

## Acceptance criteria

- AGT-A1: Every factual assertion in gold fixture answers links expected evidence/source/locator; unsupported claims fail.
- AGT-A2: Deadbugz intent/unproven outcome preserved; Nx scanning not stretched into agent credential access; Gambit composite explicit.
- AGT-A3: Unmapped behavior returns local identity without invented ATLAS ID; unknown entity error.
- AGT-A4: Draft excluded from reviewed default; explicit draft query includes warnings.
- AGT-A5: OTEL examples identified as synthetic/custom/logical, never captured telemetry or standard OTLP payload.
- AGT-A6: Hostile-source fixture causes no tools, writes or approval and retains citation contract.

## Handoff

Provide consumer schemas/examples, fixture evaluation results and failed cases. View-generation tests do not establish production agent reliability.
