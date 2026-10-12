# Contributing to DevEnvThreatCorpus

Thank you for your interest in contributing to DevEnvThreatCorpus! We welcome research contributions, source reporting, validation tooling improvements, and schema enhancements.

## Project principles

1. **Evidence before assertion:** All threat claims in the corpus must be anchored to explicit source passages with verifiable locators and content hashes.
2. **Preserve disagreement:** Contradictory reports are recorded as explicit conflicts, never silently averaged or smoothed over.
3. **No automatic acceptance:** Synthetic samples, AI-generated drafts, and proposed mappings require independent human review before acceptance.
4. **No secrets:** Never commit secrets, API keys, private credentials, or unauthorized private code to the repository.

## Workflow and pull requests

1. **Start with an issue:** Every implementation change begins with a clear implementation task issue containing stable acceptance criteria (`AC-01`, `AC-02`, ...).
2. **Work in a branch:** Create a feature branch with a descriptive name.
3. **Local validation:** Before submitting your PR, ensure all local checks pass:
   ```powershell
   python scripts/verify.py
   ```
4. **Documentation and changelog upkeep:**
   - Any application or governance changes require relevant documentation updates and substantive root `CHANGELOG.md` prose in the same pull request.
   - Updates to public entrypoints or setup instructions must be reflected in `README.md`.
5. **Code review and merge:** All pull requests require green `Verify` and `PR Policy` checks and at least one independent human approval before merge.

## Reporting sources and threat claims

When proposing new incident sources or threat claims:
- Provide full source provenance (canonical URL, author, publisher, and publication date).
- Include verbatim excerpt passages supporting the claim.
- Distinguish between observed execution, stated threat actor intent, and theoretical consequences.
