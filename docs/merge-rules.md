# Merge and repository rules

Require successful `Verify` and `PR Policy` checks and independent human approval before merge. Dismiss stale approvals after new commits and restrict direct pushes to the default branch. Protect policy/workflow files with trusted ownership where the repository host supports it. CODEOWNERS entries require repository-specific maintainers and must be customized; no owner is hardcoded here.

Inspect actual branch protection and rulesets before claiming these controls are enforced. A successful ruleset-list read that returns no rules means no rules were found; it does not demonstrate that rule creation is supported. This template never changes remote settings. A new policy workflow only becomes available on the default branch after it is merged there.

Use squash merge where configured. The proposed PR squash message should explain what changed, why, the originating issue, acceptance, verification, and limitations. The PR template's suggested title/body and manual checks do not guarantee the final message entered into GitHub's merge dialog.
