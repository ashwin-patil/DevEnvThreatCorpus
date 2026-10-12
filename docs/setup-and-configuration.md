# Setup and configuration

## Configure a consuming project

Edit the versioned `project.config.json` using `schemas/project-config.schema.json` as the shape reference. Configure one exact `paths.learning_index` file and map its directory under `paths.learnings`. Install the pinned YAML parser once with `python -m pip install --requirement requirements-governance.txt`; then the authoritative offline command is `python scripts/verify.py`. It parses every workflow and issue-form YAML file, validates the JSON config and governance contracts, runs its unit tests, and runs configured project commands. Semantic checks require non-empty command argument arrays, safe repository-local mapped paths, advisory-only model preference, and bounded recovery guidance. Do not put shell command strings in configuration.

`project_commands` are argument arrays executed by `scripts/verify.py` using `subprocess` with `shell=False`, a repository-root working directory, a timeout, and sensitive token/secret/password/credential/key/auth/connection environment variables removed. Shell `-c`/`-command` text is rejected. The verification workflow grants only `contents: read` and does not pass secrets. A consuming project should add tests in `tests/` and configure the commands it actually uses. An empty list reports **scaffold-only** validation. The read-only PR policy and Copilot setup workflow never execute these commands.

The `paths` mappings classify documentation, tests, changelog, learnings, and governance surfaces. Extend them when adding a new surface. Unsafe absolute paths, parent traversal, wildcards, and contradictory duplicate mappings are rejected. Policy compares the complete changed-file inventory to explicit PR declarations, including rename and deletion metadata.

## Dependencies and extension points

The governance checks use Python's standard library and `unittest`; no third-party validation dependencies are required. In `.github/workflows/copilot-setup-steps.yml`, GitHub Copilot cloud agent requires the exact job ID `copilot-setup-steps` (`jobs.copilot-setup-steps`); an unrecognized job ID such as `setup` triggers cloud agent configuration warnings. The setup workflow maintains least-privilege `contents: read` permissions, installs governance dependencies (`requirements-governance.txt` with Python 3.12), and explicitly provisions the repository's pinned Node runtime using `actions/setup-node` pinned to a full commit SHA with `node-version-file: "scripts/.node-version"`. Consuming projects can extend this workflow to install additional language runtimes or dependencies needed by configured commands. The setup job timeout limits that GitHub Actions job only; it does not set a total Copilot cloud-agent session timeout.

## Model preference

`model_preference` is optional advice, not an operational default or an enforced selection. It must be explicitly selected at the assignment entrypoint. Model support and names change; report the requested preference separately from the effective model and explicitly say when a choice is unsupported or unavailable.
