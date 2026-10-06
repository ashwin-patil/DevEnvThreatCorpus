#!/usr/bin/env python3
"""Read-only evaluator for live PR and linked-issue metadata; never executes PR content."""

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

VALID_STATUSES = {"added", "modified", "removed", "renamed", "copied", "changed"}


def _fail(message: str) -> None:
    raise VerificationError(message)


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
        _fail(f"{label} has invalid PR number")
    for field in ("base_sha", "head_sha", "base_ref"):
        if not isinstance(snapshot[field], str) or not snapshot[field].strip():
            _fail(f"{label}.{field} is required")
    issue = snapshot["originating_issue"]
    if not isinstance(issue, dict) or set(issue) != {"number", "state", "body"}:
        _fail(f"{label} must have exactly one linked originating issue")
    if (
        not isinstance(issue["number"], int)
        or isinstance(issue["number"], bool)
        or issue["number"] <= 0
        or issue["number"] == snapshot["number"]
        or issue["state"] != "OPEN"
        or not isinstance(issue["body"], str)
    ):
        _fail(f"{label} linked originating issue is invalid or closed")
    if not isinstance(snapshot["files"], list) or not snapshot["files"]:
        _fail(f"{label}.files must be a non-empty array")
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


def evaluate(payload: Any, config: dict[str, Any]) -> dict[str, Any]:
    validate_config(config)
    if not isinstance(payload, dict) or set(payload) != {"snapshot_before", "snapshot_after"}:
        _fail("policy input must contain exactly before and after snapshots")
    before = _check_snapshot(payload["snapshot_before"], "snapshot_before")
    after = _check_snapshot(payload["snapshot_after"], "snapshot_after")
    if before != after:
        _fail("stale PR event: live-before and live-after snapshots differ")

    issue_ids = re.findall(r"\bAC-\d{2,}\b", before["originating_issue"]["body"])
    if not issue_ids:
        _fail("linked originating issue must have stable acceptance criterion IDs")
    paths = {item["path"] for item in before["files"]}
    for path in paths:
        if not any(
            _matches(path, pattern)
            for category in ("documentation", "tests", "changelog", "learnings", "governance")
            for pattern in config["paths"][category]
        ):
            _fail(f"changed path has no configured surface mapping: {path}; update project.config.json")
    index = config["paths"]["learning_index"]
    if any(
        path != index and any(_matches(path, pattern) for pattern in config["paths"]["learnings"])
        for path in paths
    ) and index not in paths:
        _fail("a changed learning note must update the learning index in the same PR")

    return {"changed_paths": len(paths), "criteria": len(set(issue_ids))}


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
        f"{result['criteria']} linked-issue criteria. "
        "This metadata result is not proof of test correctness or approval."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
