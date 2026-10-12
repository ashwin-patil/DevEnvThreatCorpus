#!/usr/bin/env python3
"""Run deterministic scaffold checks and explicitly configured project commands."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path
from typing import Any, Callable

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "project.config.json"
SCHEMA_PATH = ROOT / "schemas" / "project-config.schema.json"
REQUIRED_CONFIG_KEYS = {
    "schema_version",
    "model_preference",
    "project_commands",
    "paths",
    "recovery",
}
REQUIRED_PATH_CATEGORIES = {
    "application",
    "documentation",
    "tests",
    "changelog",
    "learnings",
    "governance",
}
REQUIRED_PATH_KEYS = REQUIRED_PATH_CATEGORIES | {"learning_index", "readme_triggers"}
RECURSION_GUARD = "AI_NATIVE_VERIFY_COMMAND_ACTIVE"


class VerificationError(ValueError):
    """Raised when configuration or scaffold contracts are invalid."""


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise VerificationError(f"duplicate JSON object key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
    except (OSError, json.JSONDecodeError) as exc:
        raise VerificationError(f"cannot read valid JSON from {path.relative_to(ROOT)}: {exc}") from exc


def _safe_pattern(pattern: Any) -> bool:
    if not isinstance(pattern, str) or not pattern or "\\" in pattern:
        return False
    if any(ord(char) < 32 for char in pattern):
        return False
    if pattern.startswith("/") or re.match(r"^[A-Za-z]:", pattern):
        return False
    if any(part in {"", ".", ".."} for part in pattern.removesuffix("/**").split("/")):
        return False
    has_glob = any(char in pattern for char in "*?[]")
    return not has_glob or (
        pattern.endswith("/**")
        and pattern.count("*") == 2
        and "?" not in pattern
        and "[" not in pattern
        and "]" not in pattern
    )


def _path_matches_pattern(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return path == pattern


def _is_self_verification(command: list[str]) -> bool:
    joined = " ".join(command).replace("\\", "/").lower()
    return "scripts/verify.py" in joined or "scripts.verify" in joined


def _uses_shell_command_text(command: list[str]) -> bool:
    executable = command[0].replace("\\", "/").rsplit("/", 1)[-1].lower().removesuffix(".exe")
    shells = {
        "bash",
        "cmd",
        "cmd.exe",
        "dash",
        "fish",
        "ksh",
        "powershell",
        "pwsh",
        "sh",
        "zsh",
    }
    shell_switches = {"-c", "-command", "/c", "/command", "--command"}
    return executable in shells and any(arg.lower() in shell_switches for arg in command[1:])


def validate_config(config: Any, schema: Any | None = None) -> None:
    if not isinstance(config, dict) or set(config) != REQUIRED_CONFIG_KEYS:
        raise VerificationError(f"configuration keys must be exactly: {', '.join(sorted(REQUIRED_CONFIG_KEYS))}")
    if config["schema_version"] != 1 or isinstance(config["schema_version"], bool):
        raise VerificationError("schema_version must be integer 1")

    preference = config["model_preference"]
    if not isinstance(preference, dict) or set(preference) != {"value", "status"}:
        raise VerificationError("model_preference must contain exactly value and status")
    if preference["status"] != "advisory":
        raise VerificationError("model_preference.status must be advisory")
    if preference["value"] is not None and (
        not isinstance(preference["value"], str) or not preference["value"].strip()
    ):
        raise VerificationError("model_preference.value must be null or a non-empty string")

    commands = config["project_commands"]
    if not isinstance(commands, list):
        raise VerificationError("project_commands must be an array of argument arrays")
    for index, command in enumerate(commands):
        if not isinstance(command, list):
            raise VerificationError(
                f"project_commands[{index}] must be an argument array, not shell command text"
            )
        if (
            not command
            or any(not isinstance(arg, str) or not arg.strip() for arg in command)
        ):
            raise VerificationError(f"project_commands[{index}] must be a non-empty array of non-empty strings")
        if _is_self_verification(command):
            raise VerificationError("project_commands must not recursively invoke scripts/verify.py")
        if _uses_shell_command_text(command):
            raise VerificationError(
                f"project_commands[{index}] must not pass shell text to a shell -c/-command option"
            )

    paths = config["paths"]
    if not isinstance(paths, dict) or set(paths) != REQUIRED_PATH_KEYS:
        raise VerificationError(f"paths must define exactly: {', '.join(sorted(REQUIRED_PATH_KEYS))}")
    index_path = paths["learning_index"]
    if not _safe_pattern(index_path) or any(char in index_path for char in "*?[]"):
        raise VerificationError("paths.learning_index must be one exact safe repository-relative path")
    owners: dict[str, str] = {}
    for category in REQUIRED_PATH_CATEGORIES | {"readme_triggers"}:
        patterns = paths[category]
        if not isinstance(patterns, list) or (
            not patterns and category not in {"application", "readme_triggers"}
        ):
            raise VerificationError(f"paths.{category} must be an array (non-empty for core surfaces)")
        seen: set[str] = set()
        for pattern in patterns:
            if not _safe_pattern(pattern):
                raise VerificationError(f"unsafe path pattern in paths.{category}: {pattern!r}")
            if pattern in seen:
                raise VerificationError(f"duplicate path pattern in paths.{category}: {pattern}")
            seen.add(pattern)
            if category == "readme_triggers":
                continue
            # Identical patterns in two categories make classification ambiguous.
            if pattern in owners and owners[pattern] != category:
                raise VerificationError(
                    f"conflicting path pattern {pattern!r} in {owners[pattern]} and {category}"
                )
            owners[pattern] = category
    for application in paths["application"]:
        for category in REQUIRED_PATH_CATEGORIES - {"application"}:
            for pattern in paths[category]:
                if _path_matches_pattern(application.removesuffix("/**"), pattern) or (
                    _path_matches_pattern(pattern.removesuffix("/**"), application)
                ):
                    raise VerificationError("application mappings must not overlap other surfaces")
    for trigger in paths["readme_triggers"]:
        if not any(
            _path_matches_pattern(trigger, pattern)
            for category in ("application", "governance")
            for pattern in paths[category]
        ):
            raise VerificationError("README triggers must be covered by implementation mappings")
    for path, category in (("README.md", "documentation"), ("CHANGELOG.md", "changelog")):
        if path not in paths[category]:
            raise VerificationError(f"{path} must be explicitly mapped under {category}")
    index_parent = index_path.rsplit("/", 1)[0] if "/" in index_path else ""
    if not index_parent or not all(
        pattern.startswith(index_parent + "/") for pattern in paths["learnings"]
    ):
        raise VerificationError("paths.learning_index must be the index for the configured learning directory")
    if not any(_path_matches_pattern(index_path, pattern) for pattern in paths["learnings"]):
        raise VerificationError("paths.learning_index must be covered by paths.learnings")

    recovery = config["recovery"]
    if not isinstance(recovery, dict) or set(recovery) != {
        "manual_repair_attempts_before_escalation",
        "guidance",
    }:
        raise VerificationError("recovery must contain exactly repair limit and guidance")
    attempts = recovery["manual_repair_attempts_before_escalation"]
    if not isinstance(attempts, int) or isinstance(attempts, bool) or not 0 <= attempts <= 10:
        raise VerificationError("manual repair attempts must be an integer from 0 through 10")
    if not isinstance(recovery["guidance"], str) or not recovery["guidance"].strip():
        raise VerificationError("recovery.guidance must be non-empty")
    if schema is not None:
        validate_schema_contract(schema)


def validate_schema_contract(schema: Any) -> None:
    if not isinstance(schema, dict):
        raise VerificationError("configuration schema must be a JSON object")
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        raise VerificationError("configuration schema must declare JSON Schema 2020-12")
    if schema.get("additionalProperties") is not False:
        raise VerificationError("configuration schema must reject unknown top-level properties")
    required = schema.get("required")
    if not isinstance(required, list) or any(not isinstance(key, str) for key in required):
        raise VerificationError("configuration schema must list required fields")
    if set(required) != REQUIRED_CONFIG_KEYS or len(required) != len(set(required)):
        raise VerificationError("configuration schema required keys do not match the validator")
    properties = schema.get("properties")
    if not isinstance(properties, dict) or set(properties) != REQUIRED_CONFIG_KEYS:
        raise VerificationError("configuration schema properties do not match the validator")
    if properties.get("schema_version", {}).get("const") != 1:
        raise VerificationError("configuration schema version does not match the validator")
    expected_nested = {
        "model_preference": {"value", "status"},
        "project_commands": None,
        "paths": REQUIRED_PATH_KEYS,
        "recovery": {"manual_repair_attempts_before_escalation", "guidance"},
    }
    for name, fields in expected_nested.items():
        item = properties.get(name)
        if not isinstance(item, dict):
            raise VerificationError(f"configuration schema is missing {name}")
        if fields is not None:
            if item.get("additionalProperties") is not False:
                raise VerificationError(f"configuration schema must reject unknown {name} properties")
            if (
                set(item.get("required", [])) != fields
                or set(item.get("properties", {})) != fields
            ):
                raise VerificationError(f"configuration schema {name} fields do not match the validator")
    model = properties["model_preference"]["properties"]
    if model.get("status", {}).get("const") != "advisory":
        raise VerificationError("configuration schema must keep model preference advisory")
    commands = properties["project_commands"]
    command_items = commands.get("items", {}) if isinstance(commands, dict) else {}
    if (
        not isinstance(commands, dict)
        or commands.get("type") != "array"
        or command_items.get("type") != "array"
        or command_items.get("minItems") != 1
        or command_items.get("items", {}).get("type") != "string"
    ):
        raise VerificationError("configuration schema must require project command argument arrays")
    if properties["paths"]["properties"].get("learning_index", {}).get("type") != "string":
        raise VerificationError("configuration schema must make the learning index path configurable")
    path_schema = schema.get("$defs", {}).get("pathPatterns")
    if not isinstance(path_schema, dict) or path_schema.get("uniqueItems") is not True:
        raise VerificationError("configuration schema must reject duplicate path patterns")
    optional = schema.get("$defs", {}).get("optionalPathPatterns", {})
    if optional.get("uniqueItems") is not True or optional.get("minItems") != 0:
        raise VerificationError("configuration schema must allow empty optional path arrays")
    for category in ("application", "readme_triggers"):
        if properties["paths"]["properties"][category].get("$ref") != "#/$defs/optionalPathPatterns":
            raise VerificationError("configuration schema must define application and README mappings")


def validate_scaffold(config: dict[str, Any]) -> None:
    required_files = [
        ".gitignore",
        "README.md",
        "AGENTS.md",
        ".github/copilot-instructions.md",
        "CHANGELOG.md",
        "docs/README.md",
        "docs/learnings/evidence-expires-with-revision.md",
        "docs/setup-and-configuration.md",
        "docs/lifecycle.md",
        "docs/acceptance-audit.md",
        "docs/cloud-assignment-and-models.md",
        "docs/recovery.md",
        "docs/merge-rules.md",
        "requirements-governance.txt",
        ".github/ISSUE_TEMPLATE/config.yml",
        ".github/ISSUE_TEMPLATE/product-requirement.yml",
        ".github/ISSUE_TEMPLATE/implementation-task.yml",
        ".github/PULL_REQUEST_TEMPLATE.md",
        ".github/workflows/verify.yml",
        ".github/workflows/pr-policy.yml",
        ".github/workflows/copilot-setup-steps.yml",
        config["paths"]["learning_index"],
    ]
    missing = [name for name in required_files if not (ROOT / name).is_file()]
    if missing:
        raise VerificationError(f"required scaffold files missing: {', '.join(missing)}")

    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    if not re.search(r"^## 2026-10-02$", changelog, re.MULTILINE):
        raise VerificationError("CHANGELOG.md must have a reverse-chronological 2026-10-02 entry")
    if config["recovery"]["manual_repair_attempts_before_escalation"] != 2:
        raise VerificationError("the scaffold default must be two manual repair attempts")
    dependency = (ROOT / "requirements-governance.txt").read_text(encoding="utf-8").strip()
    if dependency != f"PyYAML=={yaml.__version__}":
        raise VerificationError("requirements-governance.txt must pin the installed YAML parser version")

    issue_prd = (ROOT / ".github/ISSUE_TEMPLATE/product-requirement.yml").read_text(encoding="utf-8")
    for field in ("problem", "users", "goals", "non-goals", "constraints", "risks", "success-measures"):
        if f"id: {field}" not in issue_prd:
            raise VerificationError(f"PRD issue form is missing required field: {field}")
    task_form = (ROOT / ".github/ISSUE_TEMPLATE/implementation-task.yml").read_text(encoding="utf-8")
    for field in ("parent-prd", "dependencies", "scope", "exclusions", "acceptance-criteria", "model-preference", "definition-of-done"):
        if f"id: {field}" not in task_form:
            raise VerificationError(f"implementation issue form is missing required field: {field}")
    for token in ("AC-01", "observable outcome", "verification method", "advisory only"):
        if token.lower() not in task_form.lower():
            raise VerificationError(f"implementation issue form is missing measurable contract: {token}")

    pr_template = (ROOT / ".github/PULL_REQUEST_TEMPLATE.md").read_text(encoding="utf-8")
    for token in ("originating implementation issue", "changed file(s)", "tested full commit SHA",
                  "human review", "closing reference"):
        if token.lower() not in pr_template.lower():
            raise VerificationError(f"pull request template is missing contract: {token}")
    if "pr-policy:begin" in pr_template or "pr-policy:end" in pr_template:
        raise VerificationError("pull request template must not require a machine-readable evidence block")

    verify_workflow = (ROOT / ".github/workflows/verify.yml").read_text(encoding="utf-8")
    for token in ("pull_request:", "push:", "default_branch", "contents: read",
                  "scripts/verify.py", "actions/checkout@", "actions/setup-python@"):
        if token not in verify_workflow:
            raise VerificationError(f"Verify workflow is missing contract: {token}")
    policy_workflow = (ROOT / ".github/workflows/pr-policy.yml").read_text(encoding="utf-8")
    for token in ("pull_request_target:", "pull-requests: read", "issues: read", "contents: read",
                  "pull_request.base.sha", "persist-credentials: false",
                  "github.paginate", "3000-file cap", "closingIssuesReferences",
                  "snapshot_before", "snapshot_after",
                  "scripts/pr_policy.py"):
        if token not in policy_workflow:
            raise VerificationError(f"PR Policy workflow is missing trusted-base contract: {token}")
    if "pull_request.head.sha }}" in policy_workflow or "ref: ${{ github.event.pull_request.head" in policy_workflow:
        raise VerificationError("PR Policy must not check out the untrusted PR head")
    if "pr.body" in policy_workflow:
        raise VerificationError("PR Policy must not require PR-body evidence")
    setup_workflow = (ROOT / ".github/workflows/copilot-setup-steps.yml").read_text(encoding="utf-8")
    for token in (
        "copilot-setup-steps:",
        "actions/checkout@",
        "actions/setup-python@",
        "actions/setup-node@",
        "scripts/.node-version",
    ):
        if token not in setup_workflow:
            raise VerificationError(f"Copilot setup workflow is missing contract: {token}")
    if "scripts/verify.py" in setup_workflow:
        raise VerificationError("Copilot setup must not execute configured project commands")
    for name, workflow in (
        ("Verify", verify_workflow),
        ("PR Policy", policy_workflow),
        ("Copilot setup", setup_workflow),
    ):
        if "pip install --requirement requirements-governance.txt" not in workflow:
            raise VerificationError(f"{name} must install the pinned governance dependency")
    for workflow in (
        verify_workflow,
        policy_workflow,
        setup_workflow,
    ):
        for action in re.findall(r"uses:\s*([^\s]+)", workflow):
            if not re.fullmatch(r"[^@]+@[0-9a-f]{40}", action):
                raise VerificationError(f"workflow action is not pinned to a full SHA: {action}")
        if "persist-credentials: false" not in workflow:
            raise VerificationError("workflows must disable persisted checkout credentials")

    docs = "\n".join(path.read_text(encoding="utf-8") for path in (ROOT / "docs").glob("*.md"))
    required_doc_claims = (
        "POST /repos/OWNER/REPO/issues/ISSUE/assignees",
        "POST /agents/repos/OWNER/REPO/tasks",
        "user-to-server",
        "GITHUB_TOKEN",
        "requested preference separately from the effective model",
        "rerun does not guarantee",
    )
    for claim in required_doc_claims:
        if claim.lower() not in docs.lower():
            raise VerificationError(f"documentation is missing lifecycle/API limitation: {claim}")

    learning_index_path = ROOT / config["paths"]["learning_index"]
    learning_dir = learning_index_path.parent
    learning_index = learning_index_path.read_text(encoding="utf-8")
    indexed_notes: set[str] = set()
    for target in re.findall(r"\]\(([^)#]+\.md)\)", learning_index):
        if target.startswith("/") or "\\" in target or ".." in target.split("/"):
            raise VerificationError(f"unsafe learning index target: {target}")
        resolved = (learning_index_path.parent / target).resolve()
        if not resolved.is_file() or ROOT not in resolved.parents:
            raise VerificationError(f"learning index links to missing or external path: {target}")
        if resolved != learning_index_path.resolve():
            indexed_notes.add(resolved.relative_to(learning_dir.resolve()).as_posix())
    note_paths: set[str] = set()
    for learning in learning_dir.rglob("*.md"):
        if learning.resolve() == learning_index_path.resolve():
            continue
        relative = learning.relative_to(learning_dir).as_posix()
        note_paths.add(relative)
        if relative not in indexed_notes:
            raise VerificationError(f"learning note is not indexed: {learning.relative_to(ROOT).as_posix()}")
    if indexed_notes != note_paths:
        stale = sorted(indexed_notes - note_paths)
        raise VerificationError(f"learning index contains stale note links: {', '.join(stale)}")

    validate_yaml_tree(ROOT)


def validate_yaml_tree(root: Path = ROOT) -> None:
    """Parse GitHub issue forms and workflows without YAML 1.1 key coercion."""
    github_dir = root / ".github"
    yaml_files = sorted([*github_dir.rglob("*.yml"), *github_dir.rglob("*.yaml")])
    if not yaml_files:
        raise VerificationError("no GitHub YAML files found")
    parsed: dict[str, dict[str, Any]] = {}
    for path in yaml_files:
        relative = path.relative_to(root).as_posix()
        try:
            documents = list(yaml.load_all(path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader))
        except (OSError, yaml.YAMLError) as exc:
            raise VerificationError(f"invalid YAML in {relative}: {exc}") from exc
        if len(documents) != 1 or not isinstance(documents[0], dict):
            raise VerificationError(f"{relative} must contain exactly one YAML mapping")
        parsed[relative] = documents[0]

    for name, form in parsed.items():
        if not name.startswith(".github/ISSUE_TEMPLATE/"):
            continue
        if name.endswith("config.yml"):
            if form.get("blank_issues_enabled") != "false":
                raise VerificationError("issue template configuration must disable blank issues")
            continue
        body = form.get("body")
        if not isinstance(body, list):
            raise VerificationError(f"{name} must have a form body array")
        ids = [item.get("id") for item in body if isinstance(item, dict) and item.get("id")]
        if len(ids) != len(set(ids)):
            raise VerificationError(f"{name} contains duplicate form field IDs")
        if not isinstance(form.get("name"), str) or not isinstance(form.get("description"), str):
            raise VerificationError(f"{name} must declare a name and description")

    workflows = {
        name: value for name, value in parsed.items()
        if name.startswith(".github/workflows/")
    }
    expected = {
        ".github/workflows/verify.yml",
        ".github/workflows/pr-policy.yml",
        ".github/workflows/copilot-setup-steps.yml",
    }
    if not expected <= set(workflows):
        raise VerificationError("required GitHub Actions workflows are missing")
    for name, workflow in workflows.items():
        if not isinstance(workflow.get("on"), dict) or not isinstance(workflow.get("jobs"), dict):
            raise VerificationError(f"{name} must declare event triggers and jobs")
        permissions = workflow.get("permissions")
        if not isinstance(permissions, dict):
            raise VerificationError(f"{name} must declare workflow permissions")
        expected_permissions = (
            {"contents": "read", "issues": "read", "pull-requests": "read"}
            if name.endswith("pr-policy.yml")
            else {"contents": "read"}
        )
        if permissions != expected_permissions:
            raise VerificationError(f"{name} workflow permissions are not least-privilege read-only")
        raw_workflow = (root / name).read_text(encoding="utf-8")
        if "${{ secrets." in raw_workflow:
            raise VerificationError(f"{name} must not reference repository secrets")
        for job_name, job in workflow["jobs"].items():
            if not isinstance(job, dict) or not isinstance(job.get("steps"), list):
                raise VerificationError(f"{name} job {job_name} must declare steps")
            if "permissions" in job:
                raise VerificationError(f"{name} must not override permissions at job level")
            for step in job["steps"]:
                if not isinstance(step, dict):
                    raise VerificationError(f"{name} job {job_name} contains an invalid step")
                if "uses" in step and not re.fullmatch(r"[^@]+@[0-9a-f]{40}", step["uses"]):
                    raise VerificationError(f"{name} action is not pinned to a full SHA: {step['uses']}")
                if "${{ secrets." in str(step.get("env", {})) or "${{ secrets." in str(step.get("with", {})):
                    raise VerificationError(f"{name} must not expose repository secrets to action steps")

    verify = workflows[".github/workflows/verify.yml"]
    if "pull_request" not in verify["on"] or "push" not in verify["on"]:
        raise VerificationError("Verify must trigger for pull requests and pushes")
    if "default_branch" not in str(verify["jobs"].get("verify", {}).get("if", "")):
        raise VerificationError("Verify push runs must be limited to the repository default branch")
    if "pull_request_target" not in workflows[".github/workflows/pr-policy.yml"]["on"]:
        raise VerificationError("PR Policy must use pull_request_target")
    setup = workflows[".github/workflows/copilot-setup-steps.yml"]
    if "workflow_dispatch" not in setup["on"]:
        raise VerificationError("Copilot setup workflow must remain an explicitly invoked setup example")
    if "copilot-setup-steps" not in setup.get("jobs", {}):
        raise VerificationError("Copilot setup workflow must define the exact job ID copilot-setup-steps")
    setup_steps = setup["jobs"]["copilot-setup-steps"].get("steps", [])
    has_setup_node = any(
        isinstance(step, dict)
        and step.get("uses", "").startswith("actions/setup-node@")
        and step.get("with", {}).get("node-version-file") == "scripts/.node-version"
        for step in setup_steps
    )
    if not has_setup_node:
        raise VerificationError(
            "Copilot setup workflow must provision Node runtime via actions/setup-node using scripts/.node-version"
        )
    setup_text = (root / ".github/workflows/copilot-setup-steps.yml").read_text(encoding="utf-8")
    if "python scripts/verify.py" in setup_text:
        raise VerificationError("Copilot setup must not execute project verification commands")


def run_project_commands(
    config: dict[str, Any],
    root: Path,
    runner: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> list[str]:
    """Execute configured commands as argument arrays from the repository root."""
    failures: list[str] = []
    for index, command in enumerate(config["project_commands"]):
        print(f"RUN project command {index + 1}: {json.dumps(command)}")
        command_env = {
            key: value
            for key, value in os.environ.items()
            if not any(
                token in key.upper()
                for token in (
                    "TOKEN",
                    "SECRET",
                    "PASSWORD",
                    "CREDENTIAL",
                    "KEY",
                    "AUTH",
                    "CONNECTION",
                    "DATABASE_URL",
                    "DB_URL",
                )
            )
        }
        command_env[RECURSION_GUARD] = "1"
        try:
            result = runner(
                command,
                cwd=root,
                env=command_env,
                shell=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=900,
                check=False,
            )
        except subprocess.TimeoutExpired:
            failures.append(f"project command {index + 1} timed out after 900 seconds")
            continue
        except OSError as exc:
            failures.append(f"project command {index + 1} could not start: {exc}")
            continue
        if result.stdout:
            print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
        if result.returncode:
            failures.append(f"project command {index + 1} exited with status {result.returncode}")
    return failures


def verification_mode_message(config: dict[str, Any]) -> str:
    if not config["project_commands"]:
        return "SCAFFOLD-ONLY: no project commands configured; application tests were not run."
    return f"APPLICATION-VERIFICATION: {len(config['project_commands'])} configured project command(s) will run."


def run_tests() -> bool:
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), top_level_dir=str(ROOT))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return result.wasSuccessful()


def main() -> int:
    if os.environ.get(RECURSION_GUARD) == "1":
        print("VERIFY ERROR: recursive invocation from a configured project command is not allowed", file=sys.stderr)
        return 2
    try:
        config = load_json(CONFIG_PATH)
        schema = load_json(SCHEMA_PATH)
        validate_config(config, schema)
        validate_scaffold(config)
    except VerificationError as exc:
        print(f"VERIFY ERROR: {exc}", file=sys.stderr)
        return 2

    if not run_tests():
        print("VERIFY ERROR: governance unit tests failed", file=sys.stderr)
        return 1
    print(verification_mode_message(config))
    failures = run_project_commands(config, ROOT)
    if failures:
        for failure in failures:
            print(f"VERIFY ERROR: {failure}", file=sys.stderr)
        return 1
    print("PASS: scaffold configuration, governance contracts, and governance unit tests.")
    if config["project_commands"]:
        print(f"PASS: {len(config['project_commands'])} configured project command(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
