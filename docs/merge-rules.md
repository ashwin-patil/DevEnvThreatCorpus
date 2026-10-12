# Merge and repository rules

Require successful `Verify` and `PR Policy` checks and independent human approval before merge. Dismiss stale approvals after new commits and restrict direct pushes to the default branch. Protect policy/workflow files with trusted ownership where the repository host supports it. CODEOWNERS entries require repository-specific maintainers and must be customized; no owner is hardcoded here.

Inspect actual branch protection and rulesets before claiming these controls are enforced. A successful ruleset-list read that returns no rules means no rules were found; it does not demonstrate that rule creation is supported. This template never changes remote settings. A new policy workflow only becomes available on the default branch after it is merged there.

## Required settings on the default branch

An authorized administrator must configure and independently confirm either branch protection or an **active**, default-branch-targeting ruleset with equivalent controls:

- Require a pull request before merging, with at least **one independent human approving review**. Dismiss stale approvals after commits and require approval of the most recent reviewable push by someone other than the pusher. Agent/bot review is not human acceptance.
- Require the exact check contexts **`Verify`** and **`PR Policy`**, sourced from the repository's GitHub Actions workflows (select the expected integration, not an arbitrary external status). Require the branch to be up to date before merge so verification reflects the current base. Do not use workflow names alone as evidence that checks are required.
- Block force pushes, deletion, and direct/default-branch pushes that circumvent the required PR. For classic protection, enable enforcement for administrators (`enforce_admins`) and do not allow PR-review bypass actors. For rulesets, use an empty bypass list unless an owner explicitly approves and records a narrower policy.
- Obtain an owner decision before granting any bypass, modifying existing rule restrictions, or selecting private-repository hosting/plan changes. Do not silently relax settings to make bootstrap pass. Protect trusted workflow/configuration paths with repository-specific ownership where available.

Read `GET /repos/ashwin-patil/DevEnvThreatCorpus/branches/main/protection` and `GET /repos/ashwin-patil/DevEnvThreatCorpus/rulesets`, then inspect each applicable ruleset's details and effective branch rules. Record required status contexts, approval counts/stale-review behavior, enforcement mode, target patterns, integration, and bypass actors with the observation date. An HTTP 403/404 is not proof that protection is absent or that the plan supports creation.

## Observed enforcement and blocker — Issue #4

On 2026-10-12, GitHub MCP repository metadata reported default branch `main`, private visibility, and `permissions.admin: true` for that MCP connection. Its branch-list API reported `main` at `d97f77b6a3dd5e15b0d875eb2494f35ab2395912` with **`protected: false`**. This does not establish required checks/reviews; no live merge-gate enforcement has been verified.

Direct GETs to the repository, `/branches/main/protection`, and `/rulesets` at `https://api.github.com/repos/ashwin-patil/DevEnvThreatCorpus` returned **HTTP 403, `Blocked by DNS monitoring proxy`**. A separate fetch of the rulesets endpoint also returned 403. The available GitHub MCP tools can read repository/branch metadata but expose no protection/ruleset read or write operation. Thus the blocker is the environment's API access/tool capability, not a proven lack of repository admin permission or an established hosting-plan limitation. No remote settings were changed.

**Human decision required (AC-07):** an authorized administrator must inspect [branch settings](https://github.com/ashwin-patil/DevEnvThreatCorpus/settings/branches) and [rulesets](https://github.com/ashwin-patil/DevEnvThreatCorpus/settings/rules), verify private-repository plan support, approve the no-bypass configuration (or explicitly decide otherwise), configure the settings above where supported, and attach non-sensitive API/settings evidence to the originating PR. Keep merge blocked pending that decision and independent human approval. Workflow existence and local policy tests alone are insufficient.

Use squash merge where configured. The proposed PR squash message should explain what changed, why, the originating issue, acceptance, verification, and limitations. The PR template's suggested title/body and manual checks do not guarantee the final message entered into GitHub's merge dialog.
