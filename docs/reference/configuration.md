# Runtime configuration

This page owns runtime modes and limits. [CLI](cli.md) owns commands;
[setup and configuration](../setup-and-configuration.md) remains authoritative
for governance, configured verification and documentation upkeep.
[Codespaces operations](../guides/codespaces.md) owns managed lifecycle,
private forwarding, diagnostics and billing—not a new deployment.

## Startup modes

Use the exact [Node pin](../../scripts/.node-version), currently `22.23.3`,
in a POSIX environment. The runtime uses Node built-ins and local vanilla
browser modules: no application dependency install, build, CDN, database,
model adapter or cloud resource setup is needed after obtaining the clone/runtime.
Python 3.12 and the pinned governance dependency are for contributor verification
and the existing devcontainer lifecycle, not a Node runtime model service.

From the clone root, with an absolute `$PWD`:

```sh
node "$PWD/scripts/server.mjs"
```

| Mode | Behavior |
|---|---|
| No corpus/store flags | Binds `127.0.0.1:4173`. `/api/corpus` is empty; the **UI displays the bundled public Pending Nx draft**. Synthetic demos require explicit selection |
| `--corpus /absolute/private/store/corpus.json` | Validates a mode-0600 private startup snapshot; read-only, restart to see external changes |
| `--store /absolute/private/store` | Explicit dynamic private corpus, archive/enrichment reads, batch collection and campaign prepare/import/status/downloads |

`--corpus` and `--store` are mutually exclusive; no environment option implicitly
enables them. `--port` accepts integers 1–65535 (default 4173); it does not change
loopback binding or security gates. Stop a directly started server with Ctrl+C.
Do not start another on the managed Codespaces port. Native Windows private-file
permissions/file URLs are not a validated research workflow.

Automatic Codespaces startup supplies neither private flag and strips credential
and private-store options from the lifecycle environment. Use the guide's explicit
per-session private-store procedure rather than changing automatic startup.
Keep forwarding **Private** and independently verify signed-in success/signed-out
denial. Local readiness is not evidence of forwarded Host/Origin compatibility.

## Local API boundary

[server.mjs](../../scripts/server.mjs) owns the exact asset/route allowlist:

| Surface | Availability / action |
|---|---|
| `GET /api/corpus` | Empty default, validated snapshot, or dynamically loaded store; stale reviews are exposed as effective Pending with warnings |
| `GET /api/demo`, `/api/demo-research` | Separate benign synthetic fixtures; browser demo mode does not write a store |
| `POST /api/intake` | Store only: bounded explicit batch input, not a client-selected filesystem path |
| `POST /api/campaign/prepare`, `/api/campaign/import`, `/api/campaign/export` | Store only: shared campaign helpers, no model request; import validates/applies an explicit candidate; export returns private case-scoped JSON/Markdown for browser download |
| `GET /api/campaign/status?case=…` | Store only: case-scoped coverage and record status |
| `GET /api/enrichment` | Store only: validated bounded sidecar plus read-only run projection; errors warn without inventing annotations |
| `GET /api/archive/<source-id>/<revision-id>/<artifact>` | Store only: allowlisted `original.html`, `article.txt`, `metadata.json`, `assets.json`, not arbitrary paths |

The service binds only `127.0.0.1`, checks Host/Origin and Fetch Metadata, and
sends no-store, same-origin and restrictive CSP headers. Writes require exact
same-origin JSON POSTs and one active write at a time. There is no review-decision
web endpoint or arbitrary path API. Original HTML is an octet-stream attachment
with sandbox/no-resource CSP, never a DOM/iframe preview. No directory listing
or public deployment is supported. Imported prompts, commands and images are data.

## Private persistence

Within a clone, use only ignored `.private-intake/`; otherwise use an absolute
private directory outside it. Protect directories with mode `0700` and files
with `0600`. The entire corpus/store, not just article bodies, is private.
Git ignore is neither encryption, backup, retention policy nor release allowlist.
Do not commit private files/screenshots or upload them as Actions artifacts.

Contract helpers reject traversal, symlinks and unsafe file/link/permission
states, serialize writers with a private lock, validate before atomic corpus
replacement and preserve unrelated records. Never delete a lock another writer
may own. Invalid existing state and input fail closed. A storage failure may
prevent recording its own failure manifest. After a post-rename durability/
lock-release failure, inspect the corpus/event history before retrying.
See [recovery](cli.md#errors-and-recovery).

The canonical store is `<store>/corpus.json`. Batch archives are under
`articles/<source-id>/<revision-id>/`; enrichment is
`enrichment/annotations.json`; campaign run snapshots are in corpus governance.
Requests/candidates/decisions and output bundles are separately protected files
at operator-selected absolute paths; they are not automatically public exports.

## Retrieval and bounds

The current defaults are implementation constants, not an invitation to add
environment settings or weaken checks:

| Boundary | Limit / owner |
|---|---|
| Plain input, decision, source body | 2 MiB; [contract.mjs](../../scripts/contract.mjs) input/intake helpers |
| Retrieval | 20-second source deadline, two retries (three attempts), three redirects per chain, including access-policy retrieval |
| Batch | 1–20 explicit URLs, sequential; exactly one existing case ID or new Pending campaign name |
| Article images | 20 images, 5 MiB each, 50 MiB total/article; batch CLI `--max-images`, `--image-bytes`, `--image-total-bytes` can lower bounds |
| Web intake | 192 KiB JSON body and 10-second body deadline; at most 20 URLs |
| Campaign segmentation | 2,400 code points/segment, 1,000 segments/request |
| Campaign files/web import | Each request/candidate 2 MiB; web envelope 4 MiB + 64 KiB with combined items at most 4 MiB, 10-second body deadline |
| Enrichment | 2 MiB document/combined store, 1,000 annotations |
| Read-only list | Default 100 records, maximum 1,000 |

The exact body byte limit is allowed; streaming limits apply regardless of
Content-Length and after decompression as well as to the network response.
Deadline includes DNS, robots/access checks, redirects, retries and streaming.

Every initial/redirect/image URL must be credential-free public HTTPS. Every
resolved address is checked, DNS is pinned for the connection and the peer must
match. TLS certificate/hostname validation remains enabled. Private, loopback,
link-local, reserved, multicast, documentation and transition addresses are
prohibited. There are no cookies, authentication, script execution, recursive
crawling, arbitrary page-asset downloads, scheduling or access/paywall bypass.

Robots policy uses `DevEnvThreatCorpusIntake/1` and fails closed when it cannot
be safely established. A missing policy (404/410) allows retrieval; cross-origin
policy redirects fail. Bounded wildcard/end-anchor Allow/Disallow rules use
longest-match precedence and Allow on equal specificity. Informational Sitemap,
Host, Content-Signal and Clean-param declarations neither redirect retrieval
nor override access rules. Denials are not retried into success. Robots permission
is not a license: independently confirm retention rights. Authorized supplied
text can record a separate fallback event, never erase or relabel a failed fetch.

## Contributor configuration

[`project.config.json`](../../project.config.json) configures seven application
test argument arrays and trusted path classifications, not server/model settings.
`python scripts/verify.py` executes scaffold checks and those configured suites.
There is no configured application lint/build command or browser runner.
Do not treat agent browser checks, synthetic tests or model preference metadata
as independent human technical, visual, research or accessibility acceptance.
