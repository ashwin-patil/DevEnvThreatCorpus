# Contributor guide

Research users should start with [getting started](../getting-started.md),
[workflow](../workflow.md) and [methodology](../methodology.md).
Contributors follow [AGENTS.md](../../AGENTS.md) and the
[contribution guide](../../.github/CONTRIBUTING.md); this page summarizes, not
replaces, their requirements or the [setup/upkeep policy](../setup-and-configuration.md).

## Lifecycle and assignment

Capture bounded scope, exclusions, dependencies, stable acceptance IDs and
observable outcomes in one implementation issue. Separate PRDs are optional.
An authorized human starts one session and draft PR for that issue. Assignment
is not approval; there is no automatic dispatch. Map each criterion to files,
executed checks and durable evidence; subjective outcomes need independent human
review. See the [full lifecycle](../lifecycle.md).

Model preference is advisory and must be selected at a supported entrypoint.
Record requested and effective models separately; report unavailable metadata or
substitution rather than asserting a match. API acceptance does not prove session
launch. See [assignment and model details](../cloud-assignment-and-models.md).

## Verification and documentation

Run `python scripts/verify.py` from the repository root. It runs scaffold checks,
Python tests and all seven configured application command arrays in
[`project.config.json`](../../project.config.json). Record exact commands,
results, full tested SHA and limitations on the originating PR; rerun after every
new commit. Synthetic tests do not establish live access, research acceptance,
usability or independent documentation relevance.

Application/governance changes require relevant docs and substantive root
changelog prose. README changes depend on entrypoint/setup/usage applicability;
an independent human decides relevance. Documentation-only maintenance needs no
ceremonial changelog or learning entry. Any changed learning note requires an
edit to the [configured index](../learnings/README.md). The
[upkeep policy](../setup-and-configuration.md#documentation-upkeep-policy) is authoritative.

## Recovery and merge

Correct failures on the same PR; do not reassign the issue to create another
session. The configured two manual repair attempts are an escalation bound, not
automatic retries. Stop for repeated non-progress, ambiguous scope or missing
permissions. Route infrastructure failures with exact logs to a human rather
than changing application code as a workaround. See [recovery](../recovery.md).

Successful `Verify` and trusted-base `PR Policy`, plus independent human
approval, precede merge. Stale approvals must be dismissed; required contexts,
up-to-date checks, push restrictions and bypass controls need administrator
confirmation. Workflow existence is not enforcement evidence. The
[merge rules](../merge-rules.md#required-settings-on-the-default-branch) preserve
the full requirements; their Issue #4 remote observations are dated 2026-10-12,
not a statement of current protection. This consolidation changes no policy or
remote settings.

## Evidence and history

- [Historical documentation review evidence](https://github.com/ashwin-patil/DevEnvThreatCorpus/blob/a29de1822513b77d15b6fcf1c88dff147bf6140c/docs/development/documentation-review-evidence.md) — original issue-qualified criteria and revisions; [current outstanding obligations](../acceptance-audit.md#issue-77-retained-obligations) remain open.
- [Acceptance audit](../acceptance-audit.md) — retained implementation evidence, including failures and pending outcomes.
- [Historical archive](../archive/README.md) — before/after disposition and frozen references.
- [Durable principles](../decisions/README.md) and [learnings](../learnings/README.md).
- [Changelog](../../CHANGELOG.md) — release and implementation history.
