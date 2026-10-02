# Evidence expires when the revision changes

CI results and local test output apply to the exact source revision that was tested. Any new commit can invalidate that evidence, even if it appears documentation-only. Rerun required checks on the final revision and update the PR's tested revision and run links before approval.

This prevents a common audit error: using a previously green run as evidence for code that was not present in that run.
