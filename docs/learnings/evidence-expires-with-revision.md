# Evidence expires when the revision changes

CI results and local test output apply to the exact source revision that was tested. Any new commit can invalidate that evidence, even if it appears documentation-only. Rerun required checks on the final revision and consult their hosted run links before approval; do not substitute manually transcribed PR text for check status.

This prevents a common audit error: using a previously green run as evidence for code that was not present in that run.

## Record which revision supplies policy

The hosted PR Policy workflow checks out the trusted base SHA and evaluates
changed paths using that revision's `project.config.json`
(`.github/workflows/pr-policy.yml`, checkout step;
`scripts/pr_policy.py`, `evaluate`). Local verification of the head configuration
cannot prove that new path mappings will pass hosted policy in the same PR.
Keep new files within already mapped surfaces, or obtain a separately authorized
base-policy change. Do not switch the privileged policy job to PR-head code to
make a local result match the hosted gate.
