# Human-supervised lifecycle

1. Capture requirements directly in a correctly completed implementation task issue: dependencies (or "None"), bounded scope, exclusions, stable `AC-01`-style outcomes with observable verification methods, and definition of done. No separate PRD issue or repository PRD file is required.
2. A PRD issue, repository document, or other requirements source is optional context. A human reviews the task's intent and authorization; larger requirements may be split into bounded implementation issues.
3. An authorized human starts one Copilot cloud-agent session from the task, selecting a supported base and model where available. Keep one active session per originating issue; session launch or assignment is not approval. There is no automatic assignment.
4. The agent proposes a focused draft PR referencing that issue. It completes an acceptance matrix that maps each criterion to changed files, test(s), and durable evidence. It records commands/results, tested revision, and limitations.
5. CI `Verify` runs on the PR revision; trusted-base PR Policy checks the linked issue, changed-file relationships, and [documentation upkeep](setup-and-configuration.md#documentation-upkeep-policy) using GitHub metadata without reading PR text. Configure both as required checks. Automated criteria need executed checks, while subjective criteria remain `needs-human-review`. Neither a PR body nor local metadata fixture proves behavior by declaration alone.
6. The agent or human adds corrections to the same PR. After each commit, rerun checks and refresh the tested revision, results, and links; earlier results are stale.
7. Required checks and independent human approval precede merge. Follow repository policy and enter a detailed squash message.

One issue may represent one implementation task and one active session/PR. Do not reassign it to recover a failed attempt: that can start a second session and PR. See [Recovery](recovery.md).
