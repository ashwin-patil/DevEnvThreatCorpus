# DevEnvThreatCorpus v0.2

A local research prototype linking campaign reporting, cited evidence, interactive attack paths, reusable behaviors, framework techniques and proposed defensive telemetry. All LLM-derived content is **unreviewed**; this is a research seed, not a validated threat intelligence or detection service.

## Run and explore

Run `npm start` from this directory and open http://127.0.0.1:4173. The server binds to loopback. Node.js is the only runtime requirement; no external packages are needed. You can also open `index.html` directly.

Eight views cover attack paths, campaigns, repeatable behaviors, MITRE ATLAS, security telemetry, OpenTelemetry, research sources and methodology. Select graph nodes or edges to inspect evidence and inference labels. Controls support zoom, pan, node movement and layout reset; a text alternative lists nodes and relationships. Vector icons distinguish elements. Browser verification of these interactions remains pending.

Campaign cards can be hidden or restored locally. This changes presentation, not canonical data. Entity links use stable IDs. JSON export retains the full corpus, including records hidden from the current view.

## Review and contracts

- [Review and fix plan](REVIEW_AND_PLAN.md): researcher, practitioner and agent workflows; UI, usability and actionability gaps; implemented changes and outstanding checks.
- [OpenTelemetry reference](OTEL_REFERENCE.md): standard LogRecord fields, signal types, pinned experimental conventions, custom attributes and synthetic samples.
- [Agent contract](AGENT_CONTRACT.md): structured access, citations, inference limits and proposed evaluations.
- [Project brief](PROJECT_BRIEF.md) and [curation methodology](METHODOLOGY.md): scope, admission and review rules.

## Modular library

Edit entity files in `library/`, then run:

```powershell
npm run build
npm run check
```

`library/manifest.json` lists modules for campaigns, paths, evidence, sources, behaviors, frameworks, mappings, security telemetry, detections, OpenTelemetry actions, the OTEL reference and governance. Entities use stable IDs; remove or update their relationships together. Validation catches dangling references. Persistent authoring and human review remain planned.

`build-library.mjs` generates `corpus.json`, browser data `corpus.js`, typed records `corpus.jsonl` and `manifest.json` with a deterministic digest. `corpus.schema.json` defines the machine structure. `index.html`, `app-v2.js`, `style.css` and `v2.css` implement the interface.

Read-only agent access is available without an API server:

```powershell
node query.mjs list campaigns
node query.mjs get paths path-nx
node query.mjs bundle nx
```

The original `app.js`, `build-data.mjs`, `validate.mjs` and one-time migration scripts are historical files and **not used by v0.2**. Do not run the old builder or migration against the normalized library.

## Seed and provenance

The seed contains three campaigns (Nx/s1ngularity, Deadbugz and the September Shai-Hulud wave), one Invariant MCP exercise and one Gambit attacker-operated AI comparator: five paths, eight behavior categories and 23 evidence paraphrases. Six research articles are supplemented by official references. The framework library contains 208 ATLAS techniques/subtechniques from MITRE's 2026.09 release and two relevant ATT&CK techniques; ATT&CK is a subset.

The source chats were **Collect Campaign Articles** and **IDE Attack Incident Dataset**. Only accessible recent turns were available, without an older-page cursor. Some citations were placeholders. This is a selected seed, not a complete extraction: Gambit's link was visible, Nx and Deadbugz URLs were recovered from named examples, and Shai-Hulud and Invariant were supplemental selections. Source records retain these distinctions.

Claims cite URLs and section locators. Human review and article snapshots are pending. Relationships, generalizations and framework mappings identify LLM inference. Deadbugz intent does not establish successful victim credential theft; Gambit is a composite playbook. Taxonomy maturity does not imply campaign certainty or detection coverage.

Security telemetry describes sensor requirements and logical joins, not vendor-ready queries. OpenTelemetry actions are separate proposals; `devthreat.*` attributes are custom. Samples are synthetic logical records, not OTLP wire messages. Experimental GenAI/MCP conventions are pinned to a documented revision. No collector or tested production detection is included.

## Validation and remaining checks

Data/reference validation, generated JSON/browser parity, JSONL validation, JavaScript syntax, eight-view generation checks and seed-specific semantic checks passed. JSON Schema validation also passed. The preview loads for the user.

Visual and browser interaction QA remains **pending** because the automation tool reports a saved permission blocking this local origin, including after the user's Always allow update. Render-generation checks are not browser tests. The review document lists manual checks and remaining source review, persistent curation, telemetry adapters, detection validation and agent evaluations.
