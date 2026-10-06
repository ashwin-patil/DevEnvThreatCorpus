# Human-supervised lifecycle

1. Write a PRD issue describing the problem, users, goals, non-goals, constraints, risks, and success measures. A human reviews and approves the product intent.
2. Split the approved PRD into implementation task issues. Each task has an originating PRD, dependencies, bounded scope/exclusions, stable `AC-01`-style outcomes, and observable verification methods. A PRD may span multiple task issues.
3. An authorized human assigns one task issue to Copilot cloud agent, selecting a supported base and model where available. Keep one active session per originating issue; assignment is not approval.
4. The agent proposes a focused draft PR referencing that issue. It completes an acceptance matrix that maps each criterion to changed files, test(s), and durable evidence. It records commands/results, tested revision, and limitations.
5. CI `Verify` runs on the PR revision; trusted-base PR Policy checks the linked issue and changed-file relationships without reading PR text. Configure both as required checks. Automated criteria need executed checks, while subjective criteria remain `needs-human-review`. Neither a PR body nor local metadata fixture proves behavior by declaration alone.
6. The agent or human adds corrections to the same PR. After each commit, rerun checks and refresh the tested revision, results, and links; earlier results are stale.
7. Required checks and independent human approval precede merge. Follow repository policy and enter a detailed squash message.

One issue may represent one implementation task and one active session/PR. Do not reassign it to recover a failed attempt: that can start a second session and PR. See [Recovery](recovery.md).
