## Originating implementation issue

Closes #

## Scope

Summarize the authorized scope and exclusions. This PR must stay focused on its originating issue.

## Acceptance audit

Map every criterion from the originating issue to changed files and durable evidence for human review. `needs-human-review` is not a pass. Agent self-audit does not prove correctness. Record exact commands and results for the tested revision; any new commit invalidates previous test evidence. The policy check does not parse this text.

| Criterion | Observable outcome | Changed file(s) | Test/check and exact result | Durable evidence (run/log/link) | Outcome (`pass` / `fail` / `needs-human-review`) | Human reviewer / decision |
|-----------|--------------------|-----------------|-----------------------------|---------------------------------|-----------------------------------------------|---------------------------|
| AC-01 | TODO | TODO | TODO | TODO | needs-human-review | TODO |

## Verification performed

- Exact command(s), working directory, exit status, and concise result:
- Tested full commit SHA:
- Hosted check/run URL(s), if available:
- Scaffold-only or configured application verification (state which):
- New commit since these checks (must say no before review/merge):
- Limitations or blocked verification:

## Documentation, changelog, tests, and learnings

- Documentation changed: list paths or `N/A — reason`
- Changelog changed: list path or `N/A — reason`
- Tests changed/run: list paths and commands or `N/A — reason`
- Reusable learning claimed: list linked learning file(s) and index entry, or `N/A — no reusable lesson`

## Policy inputs

Link exactly one open originating implementation issue using a closing reference above. The trusted-base PR Policy uses GitHub's linked-issue and changed-file APIs, not this description or comments. `Verify` runs independently on the PR revision; configure both as required checks and require human approval in repository settings.

## Human review and merge

- [ ] I reviewed the implementation independently; agent self-audit is not approval.
- [ ] Automated criteria have executed evidence for the latest revision; subjective criteria have a human decision.
- [ ] Required `Verify` and `PR Policy` checks passed on the latest revision, or the bootstrap limitation is explicitly recorded.
- [ ] Scope, docs/changelog/test/learning evidence, and limitations are accurate.
- [ ] I entered and checked the final squash commit message in the merge dialog.

Keep this PR draft until ready for review. Passing declarations or local policy fixtures do not establish hosted enforcement.
