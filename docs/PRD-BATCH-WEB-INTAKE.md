# PRD / Copilot issue: Batch article fetching and private campaign corpus

> **Historical specification — archived in place on 2026-10-15.**
> Inspected for consolidation at `f15a8d806c4e2213896da1070dce218c881e5cc5`;
> original planning reference: `d404855`. “Ready for implementation” and timing
> below are historical, not a new assignment or current capability claim.
> Use [current CLI recipes](reference/cli.md) and
> [collection/archive contracts](reference/formats-and-versioning.md) instead.
> The [capability matrix](status.md#capability-and-maturity-matrix) retains live
> access and review limitations; [history](archive/README.md) preserves this plan.

**Status:** Ready for implementation  
**Implementation budget:** 2–4 hours  
**Base:** Latest `main`; planning reference `d404855`  
**Suggested issue title:** Enable multi-URL campaign intake from CLI and web with private HTML/image snapshots

## Goal

Let a researcher supply several public blog/article URLs for a campaign, fetch them from either CLI or the local web workbench, and retain HTML, article text, images, and citation metadata locally. This private corpus will support subsequent researcher/agent tagging and preparation of a talk in two days.

Deliver a small working collection feature. Reuse the existing intake, case/source identities, validator, private store, and UI. No ingestion-platform redesign, database migration, cloud deployment, or new queue infrastructure.

## Current problem

- CLI intake handles one URL per invocation. It already has an HTTPS network fetcher.
- The web studio accepts pasted text but cannot fetch URLs or persist intake through its local backend.
- Conservative content-type, encoding, HTML, and robots handling rejects common public articles.
- Researchers need several reports grouped under one campaign, with locally retained material and usable citations.

This issue explicitly authorizes public HTTPS retrieval, local web intake writes, campaign/source linking, and changes needed for ordinary article parsing. Network access belongs in the Node backend. Keep retrieval safeguards and human review semantics.

## Required user experience

1. Select an existing case or enter a name to create a pending campaign case.
2. Paste multiple URLs, one per line, or supply a UTF-8 URL-list file through CLI.
3. Click **Fetch articles** / run the batch command.
4. See one result per URL: collected, already present, failed, or collected with image warnings.
5. Open the campaign and see all associated sources, normalized publishers, original links, and available local snapshots.
6. Use retained article text and an enrichment sidecar for subsequent manual/agent post-processing.

## Scope

### R1 — Batch fetching in CLI and web

- Add one shared batch helper around existing intake. A sequential loop is sufficient; accept up to 20 explicit URLs per batch and display the limit clearly.
- CLI supports `--urls-file`, existing case ID or new case name, operator attribution, and private store. Document an exact runnable example.
- Web adds campaign selection/creation and a multiline URL field. A bounded same-origin POST endpoint performs collection and returns per-URL outcomes. A simple waiting state is sufficient; no background-job system required.
- Persist successful intake and case/source links. Refresh the workbench from the updated corpus without requiring a server restart.
- One failure must not cancel or roll back the other articles. Retry is resubmission of selected failed URLs.
- Deduplicate identical input URLs and retain existing source/revision idempotency. Changed article content remains a new revision. Never merge campaigns automatically.

### R2 — Ordinary public article support

- Reuse the existing public-address, redirect, TLS, and request-budget protections for articles and image downloads.
- Replace restrictive HTML parsing with a maintained tolerant parser/article extractor, or a small equivalent implementation. Preserve headings, lists, code blocks, and command text in extracted article content.
- Support ordinary UTF-8 HTML, optional charset declarations with documented decoding rules, and common compression with limits enforced after decompression.
- Use standards-compatible robots handling rather than rejecting ordinary wildcard rules. Honor explicit access denials; no authentication, paywall, or anti-bot bypass.
- Return actionable errors identifying network, HTTP/access, content, parsing, and storage failures. Do not report a fetched article when collection failed.

### R3 — Private local HTML and image archive

- Store all collected artifacts under the already ignored `.private-intake/` tree. Verify that new nested archives and enrichment files are ignored by Git.
- Suggested layout: `.private-intake/articles/<source-id>/<revision-id>/` containing `original.html`, `article.txt`, `metadata.json`, `images/`, `assets.json`, and an optional `snapshot.html` for offline reading.
- Retain the full returned HTML. Download images referenced by the article body, including ordinary lazy-loaded image URLs where available; resolve relative URLs. Do not recursively crawl links or download arbitrary page assets.
- Bound image work: initial defaults of 20 images per article, 5 MiB per image, and 50 MiB total downloaded images per article. Document/configure limits. Enforce URL/redirect checks and content types; image failures become warnings without discarding article text.
- Record each asset's original URL, local path, hash, and success/failure/skip reason. An offline snapshot rewrites successfully downloaded image references to local files.
- Full HTML means response HTML plus supported article images, not a pixel-perfect browser capture or JavaScript-rendered page.
- Retained HTML is untrusted. Keep original HTML for download; do not render it in the application's origin. If previewing locally, use an inert sanitized snapshot with scripts, forms, frames, event handlers, and remote resource requests disabled. Display extracted text by default.

### R4 — Campaign references and publisher normalization

- Link each successfully collected source to the explicitly chosen campaign using existing `case.sourceIds`; one source may be linked to multiple cases.
- Save original/final URL, canonical identity, title, publisher, author if available, reported publication date, retrieval timestamp, revision hashes, parser version, and artifact paths. Respect existing schema fields; keep additional archive metadata in sidecars.
- Normalize publisher names through a small editable hostname-to-name map. Initial examples: StepSecurity, Socket, Red Canary, and confirmed domains for the researcher's other vendors/blogs.
- Preserve publisher text from the page separately from the normalized value. Unknown publishers remain unknown; do not guess what an ambiguous abbreviation such as “NC blog” means.
- Show/export all case-linked citations, not just one primary source. Each reference includes title, normalized publisher, URL, and available date. A failed fetch remains visible as a failed intake item, not successful evidence.

### R5 — Talk-oriented enrichment contract

Provide a documented JSON sidecar/template and a minimal CLI import/export path for researcher/agent annotations. Building an LLM integration or a new enrichment UI is **not required for this issue**. The collector must produce usable text and metadata so post-processing can start immediately.

Support these annotation types:

| Type | Information to retain |
|---|---|
| Role/context | Victim-side environment or agent abuse; attacker-controlled component/infrastructure; attacker-side AI use; AI review targeting; other/unclear. These are separate, overlapping dimensions. |
| Observed behavior | Reported actions, affected trust surface, objective, and whether observed, attempted, demonstrated, or inferred. |
| Data sources | Article-mentioned or proposed endpoint, process, network, DNS, identity, repository, package, agent/IDE, GitHub Actions, CI/CD, or cloud logs. Distinguish observed evidence from proposed collection. |
| Commands and AI artifacts | Exact command lines, executable names, flags/arguments, reported prompts/instructions, agent configuration, IDE/CLI names, extensions, Skills, MCP tools/servers. |
| Traditional indicators | Domains, IPs, URLs, hashes, file paths, package/repository names, user agents, workflow/action names and refs, runner details, and relevant configuration snippets. |
| TTP references | Source-mentioned techniques/IDs and separately labeled researcher-proposed mappings. Include framework/version when known; do not force a mapping. |
| Detection references | Public rules, queries, signatures, tools, advisories, mitigation/detection guidelines, and original links. Distinguish published references from untested researcher suggestions. |
| Talk tags | Researcher-defined themes and notes for selecting cases and citing material in the talk. |

Each annotation carries `id`, `caseId`, `sourceId`, `sourceRevisionId`, `type`, `value`, optional `context`, supporting passage/locator, `origin`, `status`, and optional external reference URL. Exact quoted artifacts retain their original text. Use normalized values only as additional fields. Store model/prompt versions when annotations are agent-generated.

Validate sidecars against a small versioned schema and existing case/source/revision references. Evidence-backed items must resolve to retained text; agent/manual assertions without support must be explicitly labeled inference or unresolved. An ambiguous/repeated quote needs a locator or remains unresolved. All imports remain pending; importing annotations does not accept corpus claims or imply confirmed maliciousness. Keep annotations private and outside the core 0.3.0 schema for this iteration.

## Acceptance criteria

- **AC-01:** CLI and web each collect a batch of at least three article URLs into one chosen/new pending campaign and persist its source links.
- **AC-02:** A failed URL leaves successful articles usable and reports a specific failure. Identical resubmission produces no duplicate source/revision or case/source links.
- **AC-03:** A representative static public blog page with ordinary HTML/compression is collected. HTML, extracted text, metadata, and permitted article images are retained locally; image failures appear as warnings.
- **AC-04:** Case references include every linked source, citation metadata, and normalized publisher where configured. Missing metadata is not fabricated.
- **AC-05:** Browser reload preserves collected material and case links. Archived HTML cannot execute in the workbench origin.
- **AC-06:** A sample enrichment sidecar can be validated, imported, and exported with revision-linked evidence and the annotation types above. It remains pending and leaves canonical review decisions unchanged.
- **AC-07:** Private artifacts are Git-ignored. Existing configured tests and `python scripts/verify.py` pass, with focused tests for batch partial failure/idempotency, web writes, asset boundaries, and sidecar validation. Record a manual smoke test against researcher-selected public articles; mock network fixtures alone do not prove live collection works.

## Delivery and timebox

Suggested allocation: 60–90 minutes for shared batch collection and article compatibility; 45–60 minutes for web intake/persistence; 30–45 minutes for archives, citations, and enrichment sidecars; remaining time for focused verification and usage docs. Reuse maintained libraries and existing helpers to stay within the budget.

Deliver one originating issue/PR with code, focused tests, README usage, relevant architecture notes, and CHANGELOG update. Include exact CLI/web steps and actual verification results. Do not publish the collected articles or automatically merge the PR.

If a source needs browser automation or a larger parser/storage change, report that source as unsupported and retain the supplied-text fallback. Do not expand this into a crawler, job platform, automated case-attribution system, production detection engine, framework-mapping pipeline, or full review-interface redesign.
