# Acceptance audit

For every issue criterion, record a stable ID, observable outcome, changed-file evidence, verification method, result, and durable evidence reference. Use only `pass`, `fail`, or `needs-human-review`. Do not label a subjective judgment as an automated pass.

Evidence is revision-bound. Record the full tested commit and relevant CI/local command results and links, then refresh all results after any new commit. Automated criteria require actual command/check execution; a declared command or green result copied from another revision is not proof. Subjective criteria need a named human's review and decision before merge.

The PR policy reads GitHub's linked-issue and complete changed-file metadata: it requires exactly one open linked issue with stable acceptance IDs, mapped changed paths, and a same-PR learning-index update when a learning note changes. It does not read the PR body or comments, run tests, certify acceptance outcomes, or replace code review. The independent `Verify` check runs scaffold and configured application commands on the PR revision. Require both checks and human approval through repository settings; policy passing alone does not imply verification passed. A local fixture is only a test of the evaluator. On a new repository, hosted PR Policy is unavailable until that workflow is on the trusted default branch.
