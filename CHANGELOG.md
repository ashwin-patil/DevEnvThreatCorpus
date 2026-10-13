# Changelog

## 2026-10-13

- Issue #30: safely ignore informational `Host:`, `Content-Signal:`, and `Clean-param:` robots declarations alongside `Sitemap:` during manual URL intake. Preserve literal-path access enforcement and fail-closed rejection of unsupported policies and cross-origin robots redirects; add offline regression coverage and document the supported directives without introducing crawling or URL rewriting.
- Issue #21: implement private local claim acceptance, correction, and exclusion
  with explicit self-attested reviewer identity, rationale, append-only UTC
  events, input-base/content/dependency hashes, and preserved provenance.
  Add read-only review-aware status/validation, conservative stale-acceptance
  invalidation and explicit re-review, schema-valid corrections requiring
  separate acceptance, configured regression tests, and workflow/audit guidance.
  No browser writes, authenticated hosted review, model, export eligibility,
  conflict resolution, or source/case attribution changes are introduced.

- Issue #20: authorize the planned `scripts/review.mjs` manual review CLI in the trusted-base application and README-trigger mappings before implementation. Update setup guidance and README to clarify that this mapping is a prerequisite only; review behavior remains unimplemented.

## 2026-10-12

- Issue #30: allow standard benign informational directives in the conservative robots.txt parser (`Host:`, `Content-Signal:`, `Clean-param:`, and `Sitemap:`) so that standard public documentation and engineering blogs are not rejected with `ROBOTS_UNSUPPORTED` when access is otherwise allowed. Retain fail-closed enforcement for invalid or ambiguous path expressions, redirects, and crawl delays; add regression test coverage in `tests/intake.test.mjs` and update architecture documentation.

- Document a Windows-to-WSL URL intake pilot in README: Linux-native checkout and pinned Node setup, private store permissions, one authorized article request, explicit failure/text fallback handling, validation, and loopback-only preview. Clarify that intake does not create cases, extract claims, or approve research, and that native Windows private persistence remains unsupported by the POSIX permission checks.

- Issue #16: add a Reload local corpus button to leave the synthetic demo without refreshing the browser, restoring the configured startup snapshot and clearing filters; cover empty and configured corpus restoration with regression tests.

- Issue #16 follow-up: prevent passage selections from carrying across facet changes and keep source/revision routes synchronized after filtered fallback navigation. Three focused regression tests cover the corrected state transitions; acceptance guidance distinguishes final-revision execution from stale results and pending hosted/human review.
- Issue #16: implement the offline, read-only 0.3.0 Research Workbench with case/source browsing, exact Unicode revision-passage highlights, linked assertions and inferences, uncertainty and reciprocal conflict comparison, search/facets, and responsive local logo/favicon branding. Add a loopback-only, same-origin preview server that validates private corpus snapshots and allowlists assets, configured focused UI/server checks, usage/privacy guidance, and stable acceptance evidence mapping. No curator writes, claim acceptance, legacy seed data, graph editor, model service, or public deployment is introduced; independent human UX and documentation approval remain required.
- Issue #18: map the client-side workbench UI tree (`src/**`) and preview dev server (`scripts/server.mjs`) in `project.config.json` under `paths.application` and `paths.readme_triggers` to authorize upcoming research workbench surfaces before implementation, satisfying trusted-base PR Policy bootstrapping requirements for Issue #16. Update setup documentation and root README accordingly.
- Issue #14: map `scripts/extract.mjs` in `project.config.json` under `paths.application` and `paths.readme_triggers` to authorize the upcoming manual extraction entrypoint before implementation, satisfying trusted-base PR Policy bootstrapping requirements for Issue #12. Update setup documentation and root README accordingly.
- Issue #12: add offline researcher-template claim extraction against validated 0.3.0 sources, retained revisions, and existing cases. Verify revision hashes and exact Unicode code-point passage slices; preserve explicit case/source links, inference rationale/support, and reciprocal conflicts. Private atomic persistence, idempotent success manifests, pending-only claims, negative fixtures, configured CLI tests, README/architecture usage, and AC/FND evidence mapping document the limits. No model, network, case creation/merge, acceptance, review, or contradiction resolution is introduced.
- Increase configured verification command and hosted Verify job limits to 30 minutes, with regression checks and setup guidance updated.
- Issue #8: add operator-triggered HTTPS URL, UTF-8 text, and text-file intake against the existing 0.3.0 source/revision/manifest contract. Retain private local content, versioned URL/text normalization, deterministic identities and revision history, bounded destination-checked retrieval, and explicit recoverable failure/fallback outcomes. Offline fake-transport and CLI tests join configured verification; README and architecture guidance describe access restrictions, private retention, and remaining human review. No extraction, research acceptance, case linking, exports, or legacy import is introduced.
- Issue #10: establish repository logistics, visual identity branding, community standards, and project metadata. Add vector logo (`docs/assets/logo.svg`), icon/favicon (`docs/assets/favicon.svg`), and local brand preview (`docs/assets/preview.html`) featuring Concept A with `#cb572d` terracotta threat styling and synchronized project tagline: "Evidence-grounded threat intelligence · Attack paths · Telemetry". Add dual licensing (`.github/LICENSE`: Apache-2.0 and CC-BY-4.0), vulnerability disclosure policy (`.github/SECURITY.md`), contribution guide (`.github/CONTRIBUTING.md`), and Contributor Covenant code of conduct (`.github/CODE_OF_CONDUCT.md`) placed under the `.github/` governance surface in alignment with trusted-base PR Policy boundaries. Update `README.md` with visual branding lockup, badges, and community cross-links.
- Issue #4: accept standalone implementation requirements with optional PRD/context links; enforce same-PR documentation and substantive root changelog upkeep for application/governance changes, configured README triggers, and conditional learning-index updates. Explicit application mappings, rename/deletion regressions, trusted-base bootstrap guidance, and human relevance review preserve policy boundaries. Live merge-settings inspection is blocked by API access; independent human approval and final-revision hosted evidence remain required.
- Align Copilot cloud agent setup in `.github/workflows/copilot-setup-steps.yml` by renaming `jobs.setup` to the required exact job ID `jobs.copilot-setup-steps`, preserving least-privilege permissions and governance Python dependencies, and explicitly provisioning the repository's pinned Node runtime using `scripts/.node-version` via pinned `actions/setup-node`.
- Add focused regression coverage in `scripts/verify.py` and `tests/test_verify.py` to enforce the setup job ID and Node runtime provisioning.
- Update setup documentation in `docs/setup-and-configuration.md`.
- Define the Issue #1 offline 0.3.0 source/case/claim contracts, relationship checks, and synthetic acceptance fixtures. New records start from scratch; the frozen 0.2.0 handoff is reference-only. Intake, extraction, review operations, exports, and new enrichment are not implemented.
- Add the phased DevEnvThreatCorpus product handoff and frozen reference package for future issue-by-issue implementation.
- Install the pinned governance dependency in PR Policy and verify workflow dependency setup.
- Replace the template-oriented root README with project status, local validation, test coverage, and implementation limits.

## 2026-10-06

- Replace PR-body verification declarations with linked-issue and changed-file metadata checks; rely on the separate required `Verify` check for executed evidence and human review for acceptance.

## 2026-10-02

- Add the human-supervised, language-neutral GitHub project scaffold, issue forms, acceptance-audit PR template, configuration contract, and lifecycle guidance.
- Add deterministic offline verification, PR metadata policy evaluation, focused tests, and least-privilege workflow examples.
