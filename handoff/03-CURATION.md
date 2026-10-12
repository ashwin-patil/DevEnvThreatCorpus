# PRD 03 — Durable curation and review

## Objective and architecture

Version 1.1 alignment: strengthen the foundation review-event and file/CLI acceptance model through curator UI and protected pull requests. Sources/cases/claims core; enrichment optional. Public browser read-only; no GitHub write credentials. Database/authenticated server editing deferred. Interpret legacy approval wording below as reviewer disposition Accepted for core claims and Reviewed mapping status for enrichment; do not use a second incompatible state machine.

## Requirements

- CUR-01: Proposal schema: id, base corpus digest, operation add/update/retire, entity type/id, candidate content, dependencies, origin and author/run metadata.
- CUR-02: Append-only review events: decision id, entity id/type, content/dependency hashes, reviewer identity, timestamp, outcome, rationale and provenance. Corrections append superseding events rather than editing old history.
- CUR-03: Use collection lifecycle and claim disposition from SHARED-CONTRACT.md; Reviewed is not automatically Accepted. Edits/dependency changes invalidate acceptance. Enrichment mappings remain Proposed until separately reviewed. Reviewer identity must match configured curators/protected review process; model-produced identity strings insufficient.
- CUR-04: Reviewed release includes eligible entities and dependency closure only. Draft-preview is separate and prominent. A path with unapproved nodes/evidence is held as a whole; do not silently publish a misleading partial path. Approved source metadata alone cannot approve claims derived from it.
- CUR-05: Curator view lists pending entities, source locator/snapshot, before/after diff, dependencies, origin and decision rationale. Download a schema-valid proposal; CLI applies only after base-digest and dependency checks. Stale concurrent proposals fail without partial mutation.
- CUR-06: Retire published IDs with tombstone/reason/replacement, preserving historical releases. Dependent entities updated or retired together. Reject dangling dependencies.
- CUR-07: Evidence status, origin and review are independent axes. Official metadata authenticity is distinct from approval of a campaign mapping. Relevance scores do not replace review.
- CUR-08: Bootstrap legacy claims as Extracted — review pending / Pending. Zero eligible cases is valid. No path or mapping required to accept a grounded core claim/case. Exact supporting passages absent in legacy claims must be supplied or explicitly held pending.

## Acceptance criteria

- CUR-A1: Edit an approved claim: approval invalidates and reviewed export excludes it.
- CUR-A2: Change underlying evidence: dependent mapping/path becomes ineligible until review.
- CUR-A3: Unauthorized/model-created approval fails repository validation; authorized protected review can approve matching hash only.
- CUR-A4: Two stale-base proposals: second fails before mutation and reports conflict.
- CUR-A5: Retire cited source alone fails; coordinated dependency update succeeds and historical version remains reproducible.
- CUR-A6: Draft/ reviewed builds visibly distinct; zero-approved seed corpus does not become falsely populated.

## Deferred

Automatic submission from a public browser, login/authentication, shared database, concurrent server editing. Add a separate PRD if these become necessary.
