# GitHub Codespaces operations

Start with [getting started](../getting-started.md) or
[create a Codespace for DevEnvThreatCorpus](https://codespaces.new/ashwin-patil/DevEnvThreatCorpus).
Sign in, select the supported default branch **`main`**, confirm creation and wait
for setup/start tasks. This is GitHub's creation flow, not instant provisioning;
no local clone/install is needed.

## Environment and automatic startup

The existing [devcontainer](../../.devcontainer/devcontainer.json) builds Python
3.12, installs Node from [`scripts/.node-version`](../../scripts/.node-version)
and governance dependencies from
[`requirements-governance.txt`](../../requirements-governance.txt).
The container supports amd64/arm64. Initial creation/rebuild needs network access
to download the image and pinned packages; no application install/build is needed.

Creation checks the installed environment. On creation, rebuild and subsequent
starts, the lifecycle starts the existing loopback server on `4173` and waits for
HTTP readiness. It does not start another server on attach or automatically supply
`--store`, `--corpus`, model credentials or private-data options.

Open **Research Workbench (private)** or, if browser popups prevent its tab,
**Ports → 4173 → Open in Browser**. Use an external browser, not an embedded
preview: existing frame, Host and Origin protections are unchanged.

The initial UI displays the bundled **Nx / s1ngularity public Pending draft**,
not a private store or reviewed release. **Load synthetic demo** and **Load
synthetic research demo** are explicit benign exercises, not incident evidence;
they do not populate a store. **Reload local corpus** leaves demo mode and
returns to the public draft when no private data is configured.

## Private port and access checks

Codespaces forwarded ports are private/authenticated by default. Keep `4173`
**Private** in the Ports panel. Do not change it to organization/public visibility,
share it or use public tunnels. The port label is not an access-control mechanism
and cannot prevent later visibility changes.

Before private research, independently verify that the forwarded URL works while
signed in and denies an unauthenticated/private-window session. Do not put tokens,
credential-bearing URLs or private screenshots in evidence. Local readiness
does not prove forwarded Host/Origin compatibility, authentication or browser usability.

If forwarded access returns 403, follow the diagnostic guidance below; never
solve it by publishing the port or weakening the server's protections.

## Stop, restart and rebuild

Use **Codespaces: Stop Current Codespace**, or stop it on your GitHub Codespaces
page, when finished. Reopening starts the workbench again. Closing a browser tab
alone does not immediately stop compute.

Use **Codespaces: Rebuild Container** after runtime pins, dependencies or
devcontainer configuration change. Do not change pins or skip checks to conceal
an environment mismatch.

From the repository root in the Codespace terminal, use these existing commands
as needed (not as a required first-use sequence):

```sh
python .devcontainer/workbench.py check
python .devcontainer/workbench.py status
python .devcontainer/workbench.py restart
python .devcontainer/workbench.py stop
python .devcontainer/workbench.py start
```

`check` validates runtime/dependencies; `status` reports managed server readiness.
`restart` stops and starts the matching managed process. Repeated `start` does
not add a second server. `stop` stops only the managed preview, not the Codespace
or its billing. These lifecycle operations are for the Linux devcontainer, not
a general cross-platform service manager.

## Troubleshooting

The lifecycle prints its mode-`0600` log location in an owned mode-`0700` `/tmp`
directory. Failures return nonzero and remain visible in lifecycle task output
and `server.log`; `status` also returns nonzero if stopped or unready.

| Symptom | Next action |
|---|---|
| No browser tab | Wait for setup/start; check `status`, then use **Ports → 4173 → Open in Browser** |
| Port `4173` occupied | Stop the conflicting server you started, then run `restart`; do not blindly kill unrelated processes |
| Runtime/dependency mismatch | Inspect `check` output and rebuild the container; preserve the pins/checks |
| Image or package download failure | Inspect the creation log and retry the build after network access is restored |
| Local HTTP works but forwarded browser returns 403 | Retain loopback binding and Host/Origin checks; record a synthetic-only failure for investigation, or use VS Code desktop's authenticated Codespaces connection and localhost forwarding |
| Private collection fails | Inspect per-URL results; check public DNS/TLS/network access, respect access denials and use authorized supplied-text fallback when appropriate |

Never turn a private port public, relax server validation or introduce a public
tunnel as a workaround. Keep private text and credentials out of logs shared for
diagnosis. Successful local checks do not establish live forwarding acceptance.

## Opt-in private store

Private store mode is **opt-in, per session**, never part of automatic startup.
Keep private research local instead if you do not intentionally accept storage
on a hosted development machine.

Stop the managed preview, then start the existing server explicitly from the
repository root:

```sh
python .devcontainer/workbench.py stop
umask 077
mkdir -p .private-intake/codespaces-store
chmod 700 .private-intake .private-intake/codespaces-store
node "$PWD/scripts/server.mjs" --store "$PWD/.private-intake/codespaces-store" --port 4173
```

The server runs in the foreground; Ctrl+C stops it.
`python .devcontainer/workbench.py start` restores the default preview with no
private store. Codespaces restarts do **not** automatically reopen your store.
Do not start the managed preview while the foreground server occupies `4173`.

Keep directories mode `0700` and files `0600`. `.private-intake/` is Git-ignored,
not a backup or access control. Do not import credentials or collect sources
automatically: collection requires an explicit researcher action and permission
to retrieve/retain each source. Retained HTML is untrusted and download-only;
do not open it in a privileged browser context.

Private retained text, candidates, decisions, exports and screenshots must not
be committed or published. Read the [intake trust boundary](../architecture.md#manual-intake-contract)
and [batch/archive limits](../architecture.md#batch-collection-and-private-archives)
before collecting. Read-only `--corpus` snapshots and local alternatives are
described in [getting started](../getting-started.md#local-data-modes).

## Quota, storage and billing

Availability depends on account/organization access, machine availability,
quota and idle-timeout settings. Review
[GitHub Codespaces billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-codespaces/about-billing-for-github-codespaces)
before creating a Codespace. Compute and retained storage can affect billing.
Stopped Codespaces can still consume storage; delete unused Codespaces once
their contents are no longer needed, preserving any authorized private work first.
No cost or provisioning-time guarantee is made here.

## Acceptance limits

The [setup authority](../setup-and-configuration.md#codespaces-environment-and-lifecycle)
and [existing Codespaces evidence ledger](../acceptance-audit.md#issue-53-codespaces-workbench)
distinguish configuration/local-process checks from live acceptance.

A human must perform authorized sign-in, creation, setup-to-workbench, stop/start,
rebuild and signed-in/signed-out private-access checks on the tested revision.
Record the full SHA, observations and safe evidence on the originating PR.
Static creation links, a local HTTP response and synthetic tests are not live
Codespaces acceptance or independent research/accessibility review.
