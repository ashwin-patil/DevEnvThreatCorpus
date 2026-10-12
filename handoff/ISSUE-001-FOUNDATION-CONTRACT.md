# Issue 001 — Define source, case and claim contracts for manual collection

Status: local issue draft, not published. PRD version: 1.1. Proposed label: foundation.

## Problem and outcome

The prototype assumes campaigns have attack paths and framework enrichment. Manual collection must instead accept sources and case-scoped claims before such enrichment exists. Define schema 0.3.0 and validation so a source-only intake and a case with passage-grounded claims are valid, without inventing dates, support or mappings.

## Governing documents

00-START-HERE.md, SHARED-CONTRACT.md and 01-FOUNDATION.md v1.1. Frozen reference is migration input, not a target schema. Repository instructions take precedence over coding conventions; document product-contract conflicts.

## Scope

- Implement JSON Schemas/types for sources/revisions/passages, cases, claims, categorization assertions, timeline entries, review events, collection manifests and optional enrichment references.
- Separate collection lifecycle, evidence status, origin and reviewer disposition.
- Implement relationship validator: stable unique IDs, source/case many-to-many support, revision-anchored passages, inference basis, categorization claim support, temporal types, conflicting claims and acceptance hash integrity.
- Add deterministic migration fixture from reference 0.2.0 to proposed 0.3.0: preserve IDs/semantics, keep legacy enriched records pending, record missing passage reasons. Preserve optional module references.
- Add documented canonical serialization/identity conventions and core-only fixture support. No source fetching needed.

## Out of scope

URL fetcher, runtime LLM integration, full review UI, source discovery, scheduled Actions ingestion, hosted services, Docker, production build/deploy, complete search/comparison UI and new ATLAS enrichment. Ordinary schema tests can be run locally; workflow setup is a later issue.

## Tasks

- [ ] Schemas and types match core fields/enums/null reasons in shared contract.
- [ ] Sources permit supplied text without URL; cases do not require paths/mappings.
- [ ] Claims require source support or explicit inference with cited supporting claims/rationale.
- [ ] Date precision and event types preserve publication/activity distinction.
- [ ] Review events bound to content/dependencies; extracted claims default Pending.
- [ ] Migration report preserves legacy IDs/origins/status details and lists gaps.
- [ ] Benign fixtures and validator errors cover invalid cases.
- [ ] Document module layout and requirement-to-test traceability.

## Issue-specific acceptance gates

1. A text-only source validates with URL null and provenance/reason.
2. Two sources support one case; one source supports claims in two cases without attribution inference.
3. Core-only case validates without any enrichment module.
4. Missing/wrong-revision passage, fabricated offset, missing inference basis, duplicate ID and dangling source fail clearly.
5. Unknown/not reported/not applicable remain distinguishable; positive AI roles can overlap; attacker-side AI cannot be a trust surface.
6. Publication vs execution date, month/year/range and unknown activity fixtures validate; invented day is not introduced by normalization.
7. Conflicting claims retained separately and related explicitly.
8. Frozen seed migrates without accepted claims; Deadbugz intent, Nx scanning scope and Gambit composite survive.
9. Same fixture inputs serialize identically; no model/network credentials needed for tests.

Requirement coverage: FND-01, FND-04, FND-06/07 conventions, FND-11/13/14/15/16/17 data-contract portions. These gates are a subset of foundation acceptance. Do not claim intake/extraction/review application or exports are complete.

## Implementation handoff

Submit one reviewable PR with schema version, decisions/migrations, fixture commands/results and remaining work. Next issue: bounded manual URL/text intake, revisions and extraction failures. Do not automatically implement it.
