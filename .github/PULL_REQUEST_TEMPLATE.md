## Originating implementation issue

Closes #

## Scope

Summarize the authorized scope and exclusions. This PR must stay focused on its originating issue.

## Acceptance audit

Complete every criterion from the originating issue. `needs-human-review` is not a pass. Agent self-audit and declarations do not prove correctness. Record exact commands and results for the tested revision; any new commit invalidates previous test evidence.

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

## File declaration contract

The trusted-base PR Policy reads this machine-readable declaration and compares it with the complete live PR file list. Update each path and status, including prior path for a rename. Keep category declarations accurate. This metadata is not proof that tests passed.

<!-- pr-policy:begin -->
```json
{
  "originating_issue": 0,
  "scope": {
    "included": ["TODO"],
    "excluded": ["TODO"]
  },
  "changed_files": [
    {
      "path": "TODO",
      "status": "modified",
      "previous_path": null
    }
  ],
  "acceptance_criteria": [
    {
      "id": "AC-01",
      "outcome": "needs-human-review",
      "evidence": "TODO",
      "evidence_files": ["TODO"],
      "verification": "TODO",
      "verification_kind": "automated",
      "reviewer_decision": null
    }
  ],
  "evidence": {
    "tested_revision": "TODO-full-commit-sha",
    "verification_commands": ["TODO exact command"],
    "verification_results": [
      {
        "command": "TODO exact command",
        "exit_status": 0,
        "summary": "TODO exact result"
      }
    ],
    "hosted_check_urls": []
  },
  "declarations": {
    "documentation": ["TODO path or N/A — reason"],
    "tests": ["TODO path or N/A — reason"],
    "changelog": ["TODO path or N/A — reason"],
    "learnings": ["TODO linked file or N/A — no reusable lesson"],
    "learning_index": ["TODO index path or N/A — no reusable lesson"],
    "human_review_required": true
  },
  "proposed_squash_message": "What changed and why.\n\nIssue: #0\nAcceptance: ...\nVerification: ...\nLimitations: ..."
}
```
<!-- pr-policy:end -->

## Human review and merge

- [ ] I reviewed the implementation independently; agent self-audit is not approval.
- [ ] Automated criteria have executed evidence for the latest revision; subjective criteria have a human decision.
- [ ] Required `Verify` and `PR Policy` checks passed on the latest revision, or the bootstrap limitation is explicitly recorded.
- [ ] Scope, docs/changelog/test/learning declarations, limitations, and proposed detailed squash message are accurate.
- [ ] I entered and checked the final squash commit message in the merge dialog.

Keep this PR draft until ready for review. Passing declarations or local policy fixtures do not establish hosted enforcement.
