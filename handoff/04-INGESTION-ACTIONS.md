# PRD 04 — GitHub Actions draft ingestion

## Objective

Version 1.1 alignment: deferred automation only. Foundation intake is manual given URLs/text. Reuse its 0.3.0 source/case/claim, passage, categorization and review contracts. Draft extraction does not require paths/framework mappings. Implement this PRD only after manual pipeline gates pass and automation is explicitly requested.

Automate discovery, retrieval, extraction and proposals while preserving citations and human promotion. Actions orchestrates jobs; it is not an always-on ingestion server. Scheduled execution is best effort, with manual reruns supported. [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

## Pipeline

Source registry → bounded fetch → normalization/fingerprint → deduplication → optional structured LLM extraction → deterministic validation → staged proposal/run manifest → human review → corpus release.

## Requirements

- ING-01: Registry records HTTPS URL/feed, allowed domains, adapter/parser version, fetch policy, enabled flag and limits. Start with explicitly chosen primary URLs and recorded fixtures, not arbitrary crawling.
- ING-02: workflow_dispatch plus configurable daily schedule off the hour. Defaults: 10 new documents/run, 2 MiB/document, 20s timeout, two retries with backoff/Retry-After. Validate limits before fetch. Redirects revalidate domain/scheme and resolved destination; deny localhost/private/reserved networks. Article scripts never execute. Respect access restrictions; retain full text only where permitted.
- ING-03: Durable ledger key: canonical URL + normalized content hash + parser/extractor version. Duplicate content reuses prior result. Changed article creates linked revision and flags affected claims stale. Record partial failures; budget exhaustion stops cleanly. Runs cannot lose successful proposals because another source fails.
- ING-04: Extraction yields claim, sourceId, locator, evidence status, proposed path/behavior relationships and uncertain mappings through constrained schema. Reject missing/mismatched locators, invented quotes, unsafe IDs or cross-campaign scope. Unsupported reasoning stays inference. Extraction model has no shell, repository write, approval or deployment tools.
- ING-05: LLM optional behind adapter; record provider/actual model, parameters, prompt/input/output hashes, run ID, tokens and cost when available. Coding model and runtime model separate. Extraction defaults disabled until credentials and explicit token/cost budgets configured. Missing credentials yields fetch-only status. Cache results; identical requests need not produce identical generated text. Do not invent an API endpoint for GPT 6.1 Sol.
- ING-06: Run manifest reports fetched/skipped/changed/failed sources, hashes, validation, proposals and usage. Temporary artifact retention default 30 days; accepted lineage durable. Staging never enters public dist.
- ING-07: PR validation: contents:read, no ingestion/deployment secrets. Scheduled/manual ingestion uses trusted protected default branch. Pin external Actions to reviewed full commit SHAs. Job-scoped least privilege, concurrency lock on ledger mutation and explicit timeout. Never check out/execute untrusted PR code with privileged pull_request_target or workflow_run. [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [pull_request_target risks](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).
- ING-08: Optional publishing job grants contents:write/pull-requests:write only when enabled. Revalidate proposal data/path allowlist; write only staging and ledger. Open a draft PR; cannot alter workflows, canonical data, review approvals or deployment config. Prefer constructing a new draft commit from trusted branch and validated data files; never execute artifacts. If repository token cannot open PR, upload review artifact and explain manual path. No auto-merge/approval.
- ING-09: ATLAS/OTEL imports have dedicated version-pinned adapters. Upgrades produce metadata diff and impacted-mapping review proposal, not silent remapping.
- ING-10: No-change run emits no-op manifest, no duplicate PR. Failure summary actionable without secrets/full prompts/article payloads. Runner logs use bounded metadata.

## Acceptance criteria

- ING-A1: Duplicate URLs produce one proposal; identical second run produces none.
- ING-A2: Changed content preserves old hash and flags dependent evidence. Invalid locator/quote rejected.
- ING-A3: 429, timeout, oversize, private-network redirect and malformed HTML bounded and reported.
- ING-A4: Hostile article instructions cannot expose secrets, approve content or invoke tools; only data proposal results.
- ING-A5: Budget stops cleanly; missing credentials reports fetch-only; manifests disclose actual usage/failures.
- ING-A6: Scheduled/manual jobs emit manifests; publishing cannot change protected paths; fork PR validation has no secrets.
- ING-A7: End-to-end benign fixture run works offline without LLM. Small live-source/model smoke checks separately reported, never substituted for fixtures.

## Handoff

Deliver adapter interfaces, schemas, example manifest, permission matrix, budget/secret setup guide and fixture results. Configuration of real accounts and runtime model remains explicit destination-session work.
