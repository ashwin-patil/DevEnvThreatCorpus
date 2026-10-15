# Research Workbench preview preparation — Issue #71

Status: reviewable preparation, **not approved for publication**. Origin:
[#71](https://github.com/ashwin-patil/DevEnvThreatCorpus/issues/71).
The [readiness audit](release-readiness.md) remains authoritative for outstanding
owner decisions. Preparing a preview does not close those decisions.

**Later source-boundary update — #73:** the original #71 preparation base and
results below are historical, not validation of the post-handoff-removal
candidate. [PR #74](https://github.com/ashwin-patil/DevEnvThreatCorpus/pull/74)
records the new full candidate SHA and fresh checks. Rebind and rerun release
checks after any merge/commit; release selection/publication remains unauthorized.
The new tree/source archive excludes handoff, while the
[immutable public archive](https://github.com/ashwin-patil/DevEnvThreatCorpus/tree/a29de1822513b77d15b6fcf1c88dff147bf6140c/handoff)
and Git history retain it. This does not settle rights or readiness decisions;
independent human release-boundary review remains mandatory.

## Proposed release

- Tag: `v0.3.0-preview.1` (no existing tags/releases observed on October 15, 2026).
- Title: **Research Workbench Preview — Nx / s1ngularity**.
- Kind: GitHub prerelease; keep unpublished until explicit publication approval.
- Preparation base: `40f14d91f2990581ab48fc072c36572dfe544192`.
- Release commit: **unselected**. After independent approval/merge of the README
  PR, record the full merged SHA, rerun validation and bind the draft to it.
- Repository currently private. The owner requested preparation for a separate
  approved public visibility change. Do not change visibility during this task.
  Public visibility exposes repository history, not just selected release assets.

## Release description candidate

This preview pairs the local Research Workbench with an inspectable Nx /
s1ngularity **Pending research draft**. It is software plus a research example;
it is not an independently validated or finalized corpus.

Explore 38 agent-extracted claims, 14 behaviors, three representative phase paths
(displayed as one campaign graph) and two Proposed framework mappings. Four
retained reports supplied 28 processed segments; two historical URL attempts
failed. The public projection contains 113 typed records. Independent human
research acceptance remains outstanding. Synthetic demos are benign exercises,
not incident evidence. No Nx timeline, detection hypothesis or OTEL sample is
provided by this draft.

Use the [getting started guide](getting-started.md) and
[Codespaces guide](guides/codespaces.md). The local POSIX preview requires the
pinned Node `22.23.3`: run `node scripts/server.mjs` from the checkout, then open
`http://127.0.0.1:4173/`. No application install/build is required. Keep Codespaces
ports private and test authenticated access independently. Native Windows is not
a validated research workflow. This GitHub release performs no deployment.

Claim decisions are available through the local review CLI. A comprehensive
artifact review UI is not implemented. Optional enrichments may remain Pending
even in reviewed-profile exports; those exports do not certify every annotation.
See [coverage and limitations](nx-corpus.md), [status](status.md), and the
[public-readiness audit](release-readiness.md).

Before publication, replace this paragraph with the **exact release SHA**, final
executed command results and durable check links. Current Windows results below
are failures/limitations and do not establish release readiness.

## Candidate attachment and boundaries

Only candidate additional asset: `docs/data/nx-draft.zip`.

SHA-256: `589449ebcd2af18b7551c14a3cf69ea0e576cc85a884ab035008d04837dc18ad`.

CRC check passed. Six members, all under `nx-draft/`: `cases.csv`,
`manifest.json`, `records.jsonl`, `schema.json`, `sources.csv`, `timelines.csv`.
No absolute/traversal member paths were found. This structural check is not a
rights clearance or comprehensive secret/content scan. Owner approval of the
public-boundary inventory in the readiness audit remains required before upload.
Recheck payload/manifest hashes and compare all 113 records with the display
projection on the final release revision. Do not attach private stores, full
articles, decisions, logs, run bundles or private screenshots.

GitHub also creates source archives at publication; inspecting an attached ZIP
alone does not approve the repository tree/history for public exposure.

## Verification and staged handoff

Initial checks used Windows, Node `20.18.3`, Python `3.13.15`, on the preparation
base plus this documentation diff. These are not the pinned supported runtimes.
Final PR evidence must name the committed tested SHA; no results carry forward
after a new commit.

- `python scripts/verify.py`: exit 2, installed YAML parser did not match pin.
- Installed `requirements-governance.txt` into an isolated ignored venv using
  `python -m venv .private-intake/preview-preparation/venv` and
  `.private-intake/preview-preparation/venv/Scripts/python.exe -m pip install --requirement requirements-governance.txt` (exit 0).
- `.private-intake/preview-preparation/venv/Scripts/python.exe scripts/verify.py`:
  exit 1; 37 Python tests attempted, one import error: Linux lifecycle module
  requires `fcntl`. Configured application commands were not reached.
- Separately ran each `node --test tests/NAME.test.mjs` command from
  `project.config.json`: contract 45 pass/1 fail; intake 5/34; extract 34/63;
  review 1/45; exports 10 pass/0 fail/1 skipped; workbench 118/1;
  server 0/14. Each failed suite exited 1; exports exited 0. Node major-version
  mismatch and native-Windows private-path/permission behavior appear in failures;
  no pass is claimed for the release environment.
- `git diff --check`: exit 0. Python heading/fragment inspection: all eight
  README main sections have matching table-of-contents links.
- `node scripts/server.mjs --port 4183`: printed loopback readiness. Browser
  navigation to that URL timed out; rendered interaction was not verified.

Next stages, in order:

1. Independently review the README diff and criterion evidence; merge only with
   required checks and human approval. Keep this PR focused on #71.
2. Select the exact merged release SHA. In Linux with Python 3.12, pinned Node
   and PyYAML, run `python scripts/verify.py` (all seven configured commands).
   Record full SHA, exact commands, exits and durable logs. Resolve failures
   within authorized scope or request a separately bounded fix; never waive them.
3. Exercise the talk: default Pending Nx case → campaign graph → cited claim
   and revision → Proposed mapping → disclosed omissions. Switch explicitly to
   synthetic research demo for comparison/timeline examples, then reload the
   public corpus. Check keyboard/desktop/mobile rendering and independent human
   visual/research acceptance. Exercise live Codespaces and private forwarding.
4. Obtain owner dispositions for readiness-audit rights/history/security/control
   blockers and separately approve the public-visibility change. No autonomous
   visibility or license change is authorized.
5. Recheck ZIP content, projection equality and checksum at selected SHA. Prepare
   GitHub **draft prerelease** with final evidence and only cleared attachments.
   Review generated source-archive exposure too. Request explicit publication
   approval against this concrete draft; publish only after it is given.
6. Keep the published tag immutable. Later fixes use a new preview version.

HITL UI, protected curation, Docker/hosting and deployment remain separate work.
