# PRD 05 — Shared release, Docker and Cloudflare

## Objective

Version 1.1 alignment: release core-only collection datasets without mandatory paths/framework entries. Eligibility uses foundation Accepted claim dispositions, strengthened by Phase 2 protected review. CSV cases/sources/timelines can be public artifacts when intended; full passages/articles remain rights-aware and private by default.

Package one versioned static site/corpus for local Docker and inexpensive hosting. Initial proposed cloud target: Cloudflare Pages; Workers Static Assets is an alternative if a future API warrants it. Cloudflare serves the assets directly; it does not need to run the local Docker image.

## Requirements

- REL-01: dist uses an explicit allowlist: website assets, intended public docs, corpus exports, schema and manifest. Exclude staging, scripts, credentials, raw article snapshots and private review data. Draft-preview and reviewed profiles have distinct visible states.
- REL-02: Manifest records app/corpus/schema version, digest, git commit, framework/OTEL revisions, eligibility profile and file hashes. Container and hosting consume the same artifact; no independently rebuilt divergent corpora.
- REL-03: Multi-stage Docker build validates with pinned Node toolchain, then copies dist into a small non-root static-server image pinned by digest. No LLM key or runtime model. Listen on container interface; documented local port maps 127.0.0.1:4173 to container port. Read-only filesystem-compatible runtime; healthcheck index/manifest. Explicit .dockerignore.
- REL-04: Image labels identify app/corpus digest. Immutable version tags, amd64/arm64 when supported by CI, no latest promotion before gates. Updating corpus requires a new snapshot/image; server editing deferred.
- REL-05: Cloudflare uploads dist. Implementation previews separate from approved production job on protected branch/tag. Credentials restricted to trusted deployment job/environment. Obtain real account/project/domain settings; never invent them. Respect configured environment approval policy.
- REL-06: Correct content types, HTTPS, safe external links and CSP compatible with local scripts/SVG. Long cache for hashed assets; HTML/manifest revalidate to prevent version mixing. Hash routes and corpus downloads work. No remote analytics or telemetry collection enabled by default.
- REL-07: Document rollback to prior artifact/image/site and digest verification. Validate eligibility/dependency closure, Docker smoke and hosted preview smoke before promotion.

## Acceptance criteria

- REL-A1: Docker serves all views/exports without secrets; local host port is localhost-bound.
- REL-A2: Intended file hashes match Docker contents and hosting artifact.
- REL-A3: Public dist contains no internal paths or ingestion payloads.
- REL-A4: Hosted deep links/cache refresh work; rollback restores previous corpus digest.
- REL-A5: Draft preview cannot be mistaken for reviewed release; missing approval blocks reviewed promotion.

## Hosting assumptions

Cloudflare supports [static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/). Static asset requests are currently [free and unlimited](https://developers.cloudflare.com/pages/functions/pricing/), subject to [platform limits](https://developers.cloudflare.com/pages/platform/limits/). Recheck at implementation. Domains, API calls and storage may have separate costs; do not promise a free dynamic backend.
