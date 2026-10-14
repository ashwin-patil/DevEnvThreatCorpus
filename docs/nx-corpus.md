# Nx / s1ngularity public Pending draft

This case was prepared from main `3456f2b0df700d0b173f3ac98c59bff198c0783a`.
It contains 38 agent-extracted claims, 14 behavior definitions, 3 representative
paths (12 nodes and 7 relationships), and 2 Proposed framework mappings.
No claim or optional record has independent human acceptance. The case remains
Pending. This is a research draft, not a reviewed release or semantic gold.

## Source coverage

| Explicit URL | Collection and extraction |
|---|---|
| [Nx postmortem](https://nx.dev/blog/s1ngularity-postmortem) | 8,741 normalized code points; all 4 segments processed in the initial run |
| [StepSecurity Nx analysis](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | 34,085 points; all 15 segments processed in the initial run |
| [Wiz s1ngularity analysis](https://www.wiz.io/blog/s1ngularity-supply-chain-attack) | 7,456 points; all 4 segments processed in the initial run |
| [Socket Nx analysis](https://socket.dev/blog/nx-packages-compromised) | 11,825 points; all 5 segments processed in a separate incremental run |
| [Zscaler AI CLI tools](https://www.zscaler.com/blogs/cybersecurity-best-practices/ai-cli-tools) | Retrieval failed `ROBOTS_UNSUPPORTED`; no retained body or extracted claim |
| [Red Canary AI CLI tools](https://redcanary.com/blog/threat-detection/ai-cli-tools/) | Retrieval failed `ROBOTS_UNSUPPORTED`; no retained body or extracted claim |

Images were disabled. Image-limit warnings do not mean article text failed.
The incremental run explicitly skips previously processed segments and preserves
the first run. Combined coverage is 28 processed segments from four reports.
Failed URLs are listed in public coverage metadata but are not successful case
evidence. No Shai-Hulud article or legacy prototype claim seeds this case.

Issue #51 displays the Red Canary AI CLI URL and its verified Zscaler destination
as one logical article reference. The two historical failed URL attempts above
remain unchanged; parser compatibility is not evidence of a successful retry.
An explicit protected operator-triggered collection is still required to establish
live retention permission and retained coverage.

## Interpretation and public boundary

The upstream path follows Nx's reported title injection, repository token,
altered workflow dispatch, npm token theft and package publication. The victim
path distinguishes installation, attempted AI reconnaissance, credential
collection, conditional upload and attempted shutdown; disconnected nodes do
not acquire invented relationships. A separate later-wave path follows Wiz's
reported reuse of leaked credentials for repository disclosure.

The workbench now presents these retained records in one named campaign graph.
Phase grouping is display organization only; the three canonical paths, twelve
nodes, seven independently supported relationships and historical routes remain.
No arrow is added between phases merely to make the picture connected, and the
number of displayed campaign graphs must not be reported as a path-record count.
The campaign card's concise incident overview is a Pending display projection
supported by the cited CI-injection, npm-token-theft, malicious-release and
attempted-AI-reconnaissance claims. It does not replace the corpus's unrecorded
summary, establish human acceptance, or rely on the unretained Zscaler article.

Nx and StepSecurity's package availability estimates remain reciprocal conflicts.
Wiz's repository exposure interval is a different measurement. Attempted CLI use,
Wiz's aggregate success report and StepSecurity's vendor experiment retain their
different evidence classifications. Shutdown requires local conditions; neither
node selection nor a sequence line establishes universal completion.

The node-scoped T1059 (ATT&CK 19.2) and AML.T0053 (ATLAS 2026.09) mappings are
grounded researcher analogies resolved against the existing pinned catalogs.
They are Proposed, not source-mentioned IDs or independent confirmation. The
catalog's full membership is never counted as campaign mappings.

`src/data/nx-draft.json` contains the display projection; `docs/data/nx-draft.zip`
contains the corresponding typed draft export and hashes. The archive preserves
the export's exact file bytes across Git line-ending conversions. The existing export
allowlist supplies the core records. This public projection additionally nulls
every quotation, preserves its original locator without shortening or inventing
offsets, and adds bounded claim-linked AI tool labels and source coverage.
It retains public revision hashes, citations, source-local descriptions and graph
support references. It omits article bodies, human decisions, private campaign
run envelopes, research logs and screenshots. A separate `prompts` display
projection contains two published literal variants across three source occurrences:
the wallet-inventory prompt reported by StepSecurity and Socket, and Socket's
authorized-testing inventory variant. The shared variant appears once with both
source citations. Wiz's retained article discusses AI tools and flags without
quoting a complete prompt; it has no literal entry.

The draft export conforms to its typed-row schema. It is not an importable
private corpus: missing source text has no fabricated human passage attestation.
The browser loads a display projection through a separate adapter rather than
bypassing private-corpus validation. Public evidence navigation shows the cited
revision and locator, with explicit quotation limits. Published prompt literals
are shown as inert text, without claim-description substitutes. Full article
evidence inspection requires the protected private workbench. Tool aliases use the
existing normalization; q displays as Amazon Q with its original literal.

## Usage and review

Run `node scripts/server.mjs --port 4181` from this checkout for the bundled
public draft. Explicit `--corpus` and `--store` modes retain their prior private
behavior, including an explicitly empty store. No server writes are enabled by
the public loader. A static server serving this repository also loads the draft
from `src/index.html` when the local API is absent. Hosting and deployment are
separate actions; this change does not publish a site.

Review focus: extraction AC-01/AC-03/AC-05/AC-06 and attack-path AP-02/AP-03/AP-07/
AP-08 remain traceable to the existing contract, source hashes, graph support and
privacy checks. Full AP-09 release verification and independent human semantic,
accessibility, UX, documentation and protected real-campaign review remain
outstanding unless separately evidenced. Automated tests and an agent browser
smoke check do not satisfy those human criteria.

The matching native-POSIX verification copy passed `python3 scripts/verify.py`:
35 governance tests and 350 configured application executions, with no failures
or skips. Node was 22.23.3, Python was 3.12.3 and the existing PyYAML 6.0.3 was
loaded read-only; no dependency installation was required. A standard Draft
2020-12 JSON Schema validator accepted all 113 typed export rows. `git diff --check`
passed. Earlier Windows/mounted-filesystem attempts failed on network, file-URL,
POSIX permissions or missing disposable Git metadata; those are not test passes.

An agent browser smoke check displayed all three paths, selected the upstream
injection node and its Proposed mapping, and found no console errors. It does
not establish comprehensive keyboard, pointer, responsive, theme or screen-reader
acceptance. Public source text and private prompt variants were not uploaded as
test fixtures or screenshots. Hosted checks have not been run for this change.
