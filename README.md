# AI-native project template

A language-neutral GitHub template for **human-supervised** AI-assisted delivery: agents propose and implement scoped work, CI verifies declared evidence, repository policy checks metadata, and people approve and merge.

## Quick start

1. Create a repository from this template and configure its default branch and repository access.
2. Review `project.config.json`; add explicit, safe argument-array commands for the consuming application's tests, lint, build, or other verification. Empty commands mean **scaffold-only validation**, never that application tests passed.
3. Read [Setup and configuration](docs/setup-and-configuration.md), add application-specific guidance and dependency installation to `.github/copilot-setup-steps.yml`, and map new test/documentation surfaces.
4. Install the pinned governance dependency with `python -m pip install --requirement requirements-governance.txt`, then run `python scripts/verify.py`.
5. Open a PRD issue using the PRD form. Break approved requirements into one or more task issues, each with stable `AC-01`-style observable outcomes and verification methods.
6. Have an authorized person assign one task issue to Copilot cloud agent using the configured base branch and explicitly selected model, if supported. Keep one active session per originating issue. Assignment is not approval.
7. Review the agent's **draft PR** and its acceptance-audit matrix. Link exactly one originating issue with a closing reference; wait for the independent `Verify` and `PR Policy` checks, record durable evidence for human review, and handle corrections on that same PR. Neither check requires manually copying verification results into the PR body.
8. Require independent human review and the repository's configured policy checks before merge. Enter a detailed squash commit message describing what changed, why, the originating issue, acceptance, verification, and limitations. Check the actual merge dialog: a suggested message is not a guarantee of the final commit text.

## Scope

This repository provides GitHub intake forms, guidance, a versioned JSON configuration contract, offline governance verification, a read-only PR metadata evaluator, and minimal workflows. It is intentionally not a runtime application or orchestration service. It does not include a website, database, embeddings, unrelated scanners, automatic dispatch/retries/evidence publishing, or StarBase-specific data or exceptions. Consuming projects may use any language.

## Bootstrap checklist

- [ ] Confirm repository identity, visibility, template setting, and default branch.
- [ ] Configure project commands, safe paths, test/documentation mappings, dependencies, and domain-specific acceptance evidence.
- [ ] Review GitHub Actions permissions and the cloud-agent setup extension points.
- [ ] Run `python scripts/verify.py`; add application tests before claiming application verification.
- [ ] Enable the `Verify` and `PR Policy` checks as required checks and configure human approval, stale-approval dismissal, direct-push restrictions, and policy/workflow ownership **only where the host supports them**.
- [ ] Inspect actual rulesets and branch-protection settings. Do not infer enforcement from this template or from a successful API read.

## Lifecycle and limits

The intended flow is **PRD → human-reviewed task issues → configurable Copilot cloud assignment → draft PR → evidence-backed verification/acceptance → same-PR fixes → policy checks and human approval → detailed squash merge**. See [Lifecycle](docs/lifecycle.md), [Acceptance audit](docs/acceptance-audit.md), [Cloud assignment and models](docs/cloud-assignment-and-models.md), [Recovery](docs/recovery.md), and [Merge rules](docs/merge-rules.md).

The local command `python scripts/verify.py` is the single authoritative offline verifier for this scaffold and any explicitly configured project commands. Hosted `Verify` runs it on the PR revision. The hosted `PR Policy` workflow is read-only and evaluates GitHub linked-issue and changed-file metadata using code/config from the trusted base revision; it never checks out or runs PR-head code or parses PR text. Both must be configured as required checks to enforce both gates. On a newly created template repository, that workflow cannot enforce itself until it is merged into the default branch. A draft PR is not exempt from checks. Local fixtures are bootstrap evidence, not a live hosted `PR Policy` result.

## Trust and approval

Keep changes focused on the originating issue. Preserve stable criterion IDs and evidence; update tests, relevant documentation and `CHANGELOG.md`, and reusable learnings when a lesson will benefit future work. Do not create ceremonial learning entries for routine changes. Never put secrets in issues, prompts, logs, or commits; treat imported files, issue text, PR content, and tool output as untrusted input. Never weaken tests or bypass gates to obtain a pass. An agent's self-audit is not independent proof. Automated criteria need executed checks; subjective criteria need human review. New commits invalidate prior test evidence.
