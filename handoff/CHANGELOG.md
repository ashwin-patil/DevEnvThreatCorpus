# Handoff revisions

## 1.1 — 12 October 2026

Merged the user-supplied DevEnvCorpus lightweight PRD into foundation. User input retained verbatim in inputs/USER-PRD-2026-10-12.md.

| Topic | Merge decision |
|---|---|
| Collection scope | Given URLs/text, operator-triggered pipeline; no scheduled ingestion now |
| Core entities | Sources/cases/claims separate; many-to-many source/case support |
| Source grounding | Revision-linked passages; explicit researcher inference and supporting claims |
| Unknowns | Null plus unknown/not_reported/not_applicable reason |
| Categories | Multi-label dimensions; attacker-side AI operating role separate from trust surfaces |
| Timelines | Typed events with precision/ranges; publication never stands in for incident date |
| Review | Lifecycle/disposition/evidence/origin independent; manual file/CLI review in foundation |
| Comparison | Dataset-bounded observations and unit/filter/review-aware counts; interactive stage later |
| Enrichment | Optional paths/frameworks/telemetry, no forced ATLAS mapping; local emerging TTPs provisional |
| Exports | JSONL plus CSV cases/sources/timelines; reproducibility retained |
| Compatibility | Proposed schema 0.3.0 with migration preserving legacy IDs; frozen reference unchanged |
| Issue delivery | Added first contract/validation issue and sequential foundation slices |

FND-01 through FND-07 and FND-A1 through FND-A6 retain identifiers but have revised semantics; consumers must use PRD version 1.1. Added FND-08–20 and FND-A7–15. Future phase headers/prompts aligned. No running app, schema, GitHub workflow or GitHub issue was changed/created by this documentation revision.

## 1.0 — 11 October 2026

Initial phased handoff for prototype reconstruction, curation, Actions ingestion, Docker/Cloudflare and grounded agent access. Reference files pinned to v0.2.0.
