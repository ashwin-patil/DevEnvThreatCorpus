# Recovery and escalation

Recovery is manual and human-supervised; this repository contains no dispatch or retry automation. For a code failure, keep the originating issue assigned to the existing session and make a correction on the same PR. Run the relevant command, record the result against the latest revision, and wait for checks again. A workflow rerun does not guarantee the agent will continue.

The configuration's default is two manual repair attempts before escalation, not two automatic retries. After the bounded attempts, repeated non-progress, unclear results, or an expanding scope, stop and ask a human to decide.

For infrastructure failures (permissions, unavailable runner/service, API errors), do not ask the agent to change application code as a workaround. Capture the failing check/log link and exact error, then route the issue to a repository administrator. Stop for missing permissions or ambiguous requirements. Do not reassign the original issue: a fresh assignment may create a second agent session and PR.
