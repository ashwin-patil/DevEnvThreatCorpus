# Research workbench usability review

> **Historical walkthrough — archived in place on 2026-10-15.**
> Consolidation inspected `f15a8d806c4e2213896da1070dce218c881e5cc5`.
> The observations below date to 2026-10-13; the final tested revision and results
> remain on [PR #47](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/47).
> They are not a current-revision usability pass. See [current maturity and
> outstanding review](status.md) and the [history inventory](archive/README.md).

Reviewed 2026-10-13 on the extraction implementation branch. The walkthrough
covered all eleven research views on the local protected test corpus at desktop,
1024×768 and 390×844. It checked content rendering, page overflow, visible empty
states, behavior/source navigation and browser console errors. No retained text,
private corpus, logs or screenshots accompany this document. Executed results
and the final tested revision belong in PR #47; this review is not independent
human acceptance or a comprehensive accessibility certification.

## Addressed findings

- Research chips were full article titles, and retained sources without reported
  publisher metadata displayed unknown names even on recognizable official
  domains. Shared publisher normalization now supplies compact labels, including
  Nx, and consistent facets/citations/source display. Multiple articles from one
  publisher have numbered chips with full title tooltips and accessible names.
  Unknown domains remain explicitly unverified; original publisher metadata and
  its null reasons are preserved, including in exports. Known-host matching uses
  exact/suffix boundaries so lookalike domains cannot claim a recognized label.
- Behavior variations were displayed as unrelated definitions. A presentation
  inventory suggests local concepts using normalized labels and conservative
  lexical rules, retaining every source-specific member and its separate support,
  evidence classification and review state. A match is a review candidate, not
  proven semantic equivalence or an automatic merge. The versioned extraction
  prompt encourages one definition with distinct supported occurrences instead
  of one behavior per CLI flag or wording variation.
- Prototype arrow labels could imply chains were atomic behaviors. The inventory
  labels arrow-named records as activity-pattern candidates and presents chained
  activities separately from existing supported path relationships. It retains
  relationship type, basis, origin and claim links; absent paths produce an
  explicit empty state, not an invented chain or inferred chronology.
- Invalid deep links could display a different record. Unknown core/exploration
  targets now show an explicit return action without substitution. Existing core
  source-filter fallback remains supported but now warns which record is shown;
  exact revision routes and passage-selection reset behavior remain covered.
- A new shared browser helper must be served by the preview's explicit static
  allowlist. A focused server regression verifies it loads while private runtime
  modules remain inaccessible; no broad filesystem serving was introduced.

## Remaining research/product boundaries

Inventory consolidation needs human confirmation and eventually a durable
curation proposal/review workflow. Current lexical grouping is intentionally
limited; it neither promises arbitrary semantic deduplication nor changes
canonical IDs. Mixed-source case grouping still requires researcher judgment.

The retained exercise is partial and has no recorded attack paths, detections or
OTEL samples. Empty views are truthful coverage gaps, not evidence of absent
behavior. Comprehensive extraction and a frozen human gold checklist are still
required. Resolver coverage is limited; missing ATLAS is explicit. The current
stylesheet supplies a light appearance, not an implemented dark-theme switch;
full dual-theme and screen-reader acceptance remain outstanding. Graph features
beyond this bounded pass remain scoped to issue #46. Docker human-in-the-loop
packaging and a hosted public site are deferred, with separate private/public
data and write-permission decisions required for those deployments.
