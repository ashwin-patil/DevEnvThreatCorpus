#!/usr/bin/env python3
"""Read-only evaluator for declared PR metadata; never executes PR content."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Any

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.verify import (
    CONFIG_PATH,
    ROOT,
    VerificationError,
    _unique_object,
    load_json,
    validate_config,
)

POLICY_CATEGORIES = ("documentation", "tests", "changelog", "learnings")
VALID_STATUSES = {"added", "modified", "removed", "renamed", "copied", "changed"}
AUDIT_START = "<!-- pr-policy:begin -->"
AUDIT_END = "<!-- pr-policy:end -->"


def _fail(message: str) -> None:
    raise VerificationError(message)


def _read_object(text: str, label: str) -> dict[str, Any]:
    try:
        value = json.loads(text, object_pairs_hook=_unique_object)
    except (json.JSONDecodeError, VerificationError) as exc:
        raise VerificationError(f"{label} is not valid unambiguous JSON: {exc}") from exc
    if not isinstance(value, dict):
        _fail(f"{label} must be a JSON object")
    return value


def parse_audit(body: str) -> dict[str, Any]:
    if not isinstance(body, str) or body.count(AUDIT_START) != 1 or body.count(AUDIT_END) != 1:
        _fail("PR body must contain exactly one pr-policy declaration block")
    section = body.split(AUDIT_START, 1)[1].split(AUDIT_END, 1)[0]
    match = re.fullmatch(r"\s*```json\s*(.*?)\s*```\s*", section, flags=re.DOTALL)
    if not match:
        _fail("PR policy block must contain exactly one JSON fenced block")
    audit = _read_object(match.group(1), "acceptance audit")
    if _contains_placeholder(audit):
        _fail("acceptance audit contains an unfilled placeholder")
    return audit


def _contains_placeholder(value: Any) -> bool:
    if isinstance(value, dict):
        return any(_contains_placeholder(item) for item in value.values())
    if isinstance(value, list):
        return any(_contains_placeholder(item) for item in value)
    if isinstance(value, str):
        lowered = value.lower()
        return any(token in lowered for token in ("todo", "placeholder", "full-commit-sha", "n/a — reason"))
    return False


def _safe_path(value: Any, label: str) -> str:
    if (
        not isinstance(value, str)
        or not value
        or "\\" in value
        or any(ord(char) < 32 for char in value)
    ):
        _fail(f"{label} must be a non-empty repository-relative POSIX path")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in value.split("/")):
        _fail(f"{label} is unsafe: {value!r}")
    return value


def _matches(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        prefix = pattern[:-3].rstrip("/")
        return path == prefix or path.startswith(prefix + "/")
    return fnmatch.fnmatchcase(path, pattern)


def _check_snapshot(snapshot: Any, label: str) -> dict[str, Any]:
    required = {
        "number",
        "state",
        "draft",
        "body",
        "base_sha",
        "base_ref",
        "head_sha",
        "originating_issue",
        "files_complete",
        "files",
    }
    if not isinstance(snapshot, dict) or set(snapshot) != required:
        _fail(f"{label} has missing or unexpected snapshot fields")
    if snapshot["files_complete"] is not True:
        _fail(f"{label} file list is incomplete or truncated")
    if snapshot["state"] != "open":
        _fail(f"{label} pull request is not open")
    if not isinstance(snapshot["number"], int) or isinstance(snapshot["number"], bool) or snapshot["number"] <= 0:
        _fail(f"{label} has invalid issue number")
    for field in ("base_sha", "head_sha", "base_ref"):
        if not isinstance(snapshot[field], str) or not snapshot[field].strip():
            _fail(f"{label}.{field} is required")
    if not isinstance(snapshot["body"], str) or not isinstance(snapshot["draft"], bool):
        _fail(f"{label} has invalid body or draft field")
    issue = snapshot["originating_issue"]
    if not isinstance(issue, dict) or set(issue) != {
        "number",
        "state",
        "title",
        "body",
        "is_pull_request",
    }:
        _fail(f"{label} has incomplete originating issue metadata")
    if (
        not isinstance(issue["number"], int)
        or isinstance(issue["number"], bool)
        or issue["number"] <= 0
        or issue["state"] != "open"
        or not isinstance(issue["title"], str)
        or not issue["title"].strip()
        or not isinstance(issue["body"], str)
        or issue["is_pull_request"] is not False
    ):
        _fail(f"{label} originating issue is closed, is a pull request, or has invalid metadata")
    if not isinstance(snapshot["files"], list):
        _fail(f"{label}.files must be an array")
    seen: set[str] = set()
    normalized = []
    for item in snapshot["files"]:
        if not isinstance(item, dict) or set(item) != {"path", "status", "previous_path"}:
            _fail(f"{label} contains incomplete file metadata")
        path = _safe_path(item["path"], f"{label} file path")
        status = item["status"]
        previous = item["previous_path"]
        if path in seen:
            _fail(f"{label} contains duplicate file metadata for {path}")
        seen.add(path)
        if not isinstance(status, str) or status not in VALID_STATUSES:
            _fail(f"{label} contains unsupported file status {status!r}")
        if status == "renamed":
            _safe_path(previous, f"{label} previous path")
            if previous == path:
                _fail(f"{label} rename must have distinct old and new paths")
        elif status == "copied" and previous is not None:
            _safe_path(previous, f"{label} previous path")
            if previous == path:
                _fail(f"{label} copy must have distinct source and destination paths")
        elif previous is not None:
            _fail(f"{label} non-rename file must not have a previous path: {path}")
        normalized.append({"path": path, "status": status, "previous_path": previous})
    snapshot["files"] = sorted(normalized, key=lambda item: (item["path"], item["status"]))
    return snapshot


def _require_keys(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        _fail(f"{label} must contain exactly: {', '.join(sorted(keys))}")
    return value


def _string_list(value: Any, label: str, allow_na: bool = False) -> list[str] | None:
    if not isinstance(value, list) or not value:
        _fail(f"{label} must be a non-empty array")
    if len(set(item for item in value if isinstance(item, str))) != len(value):
        _fail(f"{label} contains duplicate values")
    if allow_na and len(value) == 1 and isinstance(value[0], str) and value[0].startswith("N/A — "):
        if len(value[0]) <= len("N/A — "):
            _fail(f"{label} not-applicable reason must be explicit")
        return None
    paths = [_safe_path(item, label) for item in value]
    return paths


def _text_list(value: Any, label: str) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item.strip() for item in value)
    ):
        _fail(f"{label} must be a non-empty array of non-empty text")
    if len(set(value)) != len(value):
        _fail(f"{label} contains duplicate values")
    return value


def evaluate(payload: Any, config: dict[str, Any]) -> dict[str, Any]:
    validate_config(config)
    if not isinstance(payload, dict) or not {"snapshot_before", "snapshot_after"} <= set(payload):
        _fail("policy input must include before and after snapshots")
    if set(payload) != {"snapshot_before", "snapshot_after"}:
        _fail("policy input has unexpected top-level fields")
    before = _check_snapshot(payload["snapshot_before"], "snapshot_before")
    after = _check_snapshot(payload["snapshot_after"], "snapshot_after")
    if before != after:
        _fail("stale PR event: live-before and live-after snapshots differ")

    audit = parse_audit(before["body"])
    if not isinstance(audit.get("originating_issue"), int) or isinstance(audit["originating_issue"], bool):
        _fail("originating_issue must be a positive issue number")
    if audit["originating_issue"] <= 0 or audit["originating_issue"] == before["number"]:
        _fail("originating_issue must identify a distinct implementation issue")
    issue = before["originating_issue"]
    if issue["number"] != audit["originating_issue"]:
        _fail("originating_issue does not match the live issue fetched from GitHub")
    if not re.search(rf"(?<!\w)#{audit['originating_issue']}(?!\d)", before["body"]):
        _fail("PR body must visibly reference its originating issue number")

    scope = _require_keys(audit.get("scope"), {"included", "excluded"}, "scope")
    for field in ("included", "excluded"):
        _text_list(scope[field], f"scope.{field}")

    declarations = _require_keys(
        audit.get("declarations"),
        {
            "documentation",
            "tests",
            "changelog",
            "learnings",
            "learning_index",
            "human_review_required",
        },
        "declarations",
    )
    if declarations["human_review_required"] is not True:
        _fail("human_review_required must be true")

    actual = before["files"]
    if not actual:
        _fail("pull request changed-file list must not be empty")
    changed_files = audit.get("changed_files")
    if not isinstance(changed_files, list) or not changed_files:
        _fail("changed_files must declare the complete non-empty PR file list")
    declared_by_path: dict[str, dict[str, Any]] = {}
    for item in changed_files:
        if not isinstance(item, dict) or set(item) != {"path", "status", "previous_path"}:
            _fail("changed_files contains incomplete or unexpected metadata")
        path = _safe_path(item["path"], "changed_files.path")
        if path in declared_by_path:
            _fail(f"changed_files contains duplicate or conflicting declarations for {path}")
        if not isinstance(item["status"], str) or item["status"] not in VALID_STATUSES:
            _fail(f"changed_files has unsupported status for {path}")
        if item["status"] == "renamed":
            _safe_path(item["previous_path"], f"changed_files.previous_path for {path}")
        elif item["status"] == "copied" and item["previous_path"] is not None:
            _safe_path(item["previous_path"], f"changed_files.previous_path for {path}")
        elif item["previous_path"] is not None:
            _fail(f"changed_files previous_path is only valid for renames: {path}")
        declared_by_path[path] = item
    if actual != sorted(changed_files, key=lambda item: (item["path"], item["status"])):
        _fail("declared changed_files do not exactly match the complete live PR file list")

    path_mappings = {
        category: patterns
        for category, patterns in config["paths"].items()
        if category != "learning_index"
    }
    classified: dict[str, set[str]] = {category: set() for category in path_mappings}
    for item in actual:
        matches = [
            category
            for category, patterns in path_mappings.items()
            if any(_matches(item["path"], pattern) for pattern in patterns)
        ]
        if not matches:
            _fail(f"changed path has no configured surface mapping: {item['path']}; update project.config.json")
        for category in matches:
            classified[category].add(item["path"])

    declared_categories: dict[str, set[str]] = {}
    for category in POLICY_CATEGORIES:
        paths = _string_list(
            declarations[category],
            f"declarations.{category}",
            allow_na=True,
        )
        declared_categories[category] = set(paths or [])
        required_paths = classified[category]
        if required_paths != declared_categories[category]:
            missing = sorted(required_paths - declared_categories[category])
            extra = sorted(declared_categories[category] - required_paths)
            details = []
            if missing:
                details.append("omits " + ", ".join(missing))
            if extra:
                details.append("lists unchanged " + ", ".join(extra))
            _fail(f"declarations.{category} does not exactly match changed mapped paths: {'; '.join(details)}")

    index_paths = _string_list(declarations["learning_index"], "declarations.learning_index", allow_na=True)
    index_declared = set(index_paths or [])
    learning_paths = classified["learnings"]
    configured_index = config["paths"]["learning_index"]
    changed_learning_notes = {
        path for path in learning_paths if path != configured_index
    }
    if changed_learning_notes and configured_index not in index_declared:
        _fail(f"a changed learning note must declare {configured_index} as its index")
    if changed_learning_notes and configured_index not in {item["path"] for item in actual}:
        _fail("a changed learning note must update the learning index in the same PR")
    expected_index_declaration = {configured_index} if configured_index in learning_paths else set()
    if index_declared != expected_index_declaration:
        _fail("learning_index declaration must exactly match the configured index's changed status")
    if learning_paths and not learning_paths <= declared_categories["learnings"] | index_declared:
        _fail("changed learning surface is missing from learning declarations or index")

    criteria = audit.get("acceptance_criteria")
    if not isinstance(criteria, list) or not criteria:
        _fail("acceptance_criteria must contain at least one criterion")
    ids: set[str] = set()
    automated_verifications: list[tuple[str, str]] = []
    for criterion in criteria:
        _require_keys(
            criterion,
            {
                "id",
                "outcome",
                "evidence",
                "evidence_files",
                "verification",
                "verification_kind",
                "reviewer_decision",
            },
            "acceptance criterion",
        )
        identifier = criterion["id"]
        if not isinstance(identifier, str) or not re.fullmatch(r"AC-\d{2,}", identifier):
            _fail(f"invalid stable acceptance criterion ID: {identifier!r}")
        if identifier in ids:
            _fail(f"duplicate acceptance criterion ID: {identifier}")
        ids.add(identifier)
        if not isinstance(criterion["outcome"], str) or criterion["outcome"] not in {
            "pass",
            "fail",
            "needs-human-review",
        }:
            _fail(f"{identifier} has invalid outcome")
        if criterion["outcome"] == "fail":
            _fail(f"{identifier} is marked fail")
        if not isinstance(criterion["evidence"], str) or not criterion["evidence"].strip():
            _fail(f"{identifier} requires an evidence reference")
        evidence_files = _string_list(criterion["evidence_files"], f"{identifier}.evidence_files")
        if not evidence_files:
            _fail(f"{identifier} requires at least one evidence file")
        if not isinstance(criterion["verification"], str) or not criterion["verification"].strip():
            _fail(f"{identifier} requires a verification method")
        if not isinstance(criterion["verification_kind"], str) or criterion["verification_kind"] not in {
            "automated",
            "human_review",
        }:
            _fail(f"{identifier} verification_kind must be automated or human_review")
        if criterion["verification_kind"] == "human_review":
            if criterion["outcome"] == "pass" and not (
                isinstance(criterion["reviewer_decision"], str)
                and criterion["reviewer_decision"].strip()
            ):
                _fail(f"{identifier} cannot pass human review without a reviewer decision")
            if criterion["outcome"] != "pass" and criterion["reviewer_decision"] not in (None, ""):
                _fail(f"{identifier} has conflicting pending outcome and reviewer decision")
        elif criterion["reviewer_decision"] not in (None, ""):
            _fail(f"{identifier} automated criterion cannot contain a human decision")
        elif criterion["verification_kind"] == "automated":
            automated_verifications.append((identifier, criterion["verification"]))

    issue_ids = set(re.findall(r"\bAC-\d{2,}\b", issue["body"]))
    if not issue_ids or ids != issue_ids:
        _fail("acceptance criterion IDs must exactly match the live originating issue")

    evidence = _require_keys(
        audit.get("evidence"),
        {"tested_revision", "verification_commands", "verification_results", "hosted_check_urls"},
        "evidence",
    )
    if evidence["tested_revision"] != before["head_sha"]:
        _fail("tested_revision must equal the current live head SHA; prior evidence is stale")
    commands = evidence["verification_commands"]
    results = evidence["verification_results"]
    if not isinstance(commands, list) or not commands or any(
        not isinstance(command, str) or not command.strip() for command in commands
    ):
        _fail("verification_commands must list exact, non-empty commands")
    if not isinstance(results, list) or not results:
        _fail("verification_results must map exact commands to exit status and result")
    result_commands: list[str] = []
    for result in results:
        if not isinstance(result, dict) or set(result) != {"command", "exit_status", "summary"}:
            _fail("each verification result must contain exactly command, exit_status, and summary")
        if not isinstance(result["command"], str) or not result["command"].strip():
            _fail("verification result command must be exact non-empty text")
        if (
            not isinstance(result["exit_status"], int)
            or isinstance(result["exit_status"], bool)
            or result["exit_status"] != 0
        ):
            _fail(f"verification command did not pass: {result['command']}")
        if not isinstance(result["summary"], str) or not result["summary"].strip():
            _fail(f"verification result summary is required: {result['command']}")
        result_commands.append(result["command"])
    if len(set(commands)) != len(commands) or len(set(result_commands)) != len(result_commands):
        _fail("verification command/result declarations must not contain duplicates")
    if set(commands) != set(result_commands):
        _fail("verification results must map every exact command, with no undeclared command")
    for identifier, verification in automated_verifications:
        if not any(command in verification for command in commands):
            _fail(f"{identifier} automated verification must reference an exact declared command")
    urls = evidence["hosted_check_urls"]
    if not isinstance(urls, list) or any(
        not isinstance(url, str) or not url.startswith("https://") for url in urls
    ):
        _fail("hosted_check_urls must be an array of HTTPS URLs")

    proposed = audit.get("proposed_squash_message")
    if not isinstance(proposed, str) or "\n" not in proposed:
        _fail("proposed_squash_message must be detailed multiline text")
    for label in ("issue:", "acceptance:", "verification:", "limitations:"):
        if label not in proposed.lower():
            _fail(f"proposed_squash_message must include {label}")
    if not re.search(rf"issue:\s*#?{audit['originating_issue']}\b", proposed, re.IGNORECASE):
        _fail("proposed squash message must identify the originating issue")

    return {
        "changed_paths": len(actual),
        "criteria": len(criteria),
        "human_review_required": True,
        "draft": before["draft"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args()
    try:
        config = load_json(CONFIG_PATH)
        schema = load_json(ROOT / "schemas/project-config.schema.json")
        validate_config(config, schema)
        payload = json.loads(args.input.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
        result = evaluate(payload, config)
    except (OSError, json.JSONDecodeError, VerificationError) as exc:
        print(f"PR POLICY ERROR: {exc}", file=sys.stderr)
        return 2
    print(
        f"PR metadata policy PASS: {result['changed_paths']} changed paths; "
        f"{result['criteria']} criteria; human review required. "
        "This metadata result is not proof of test correctness or approval."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
