from __future__ import annotations

import csv
import json
import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = "a29de1822513b77d15b6fcf1c88dff147bf6140c"
PREFIX = "https://github.com/ashwin-patil/DevEnvThreatCorpus/"


class HandoffArchiveTests(unittest.TestCase):
    def setUp(self) -> None:
        with (ROOT / "docs/archive/handoff-inventory.tsv").open(encoding="utf-8", newline="") as stream:
            self.inventory = list(csv.DictReader(stream, delimiter="\t"))
        self.paths = {row["path"] for row in self.inventory}

    def test_inventory_covers_exact_authorized_removal_surface(self) -> None:
        config = json.loads((ROOT / "project.config.json").read_text(encoding="utf-8"))
        authorized = {p for p in config["paths"]["documentation"] if p.startswith("handoff/")}
        self.assertEqual(len(self.inventory), 45)
        self.assertEqual(len(self.paths), 45)
        self.assertEqual(self.paths, authorized)
        self.assertFalse((ROOT / "handoff").exists())
        for row in self.inventory:
            with self.subTest(path=row["path"]):
                self.assertEqual(row["mode"], "100644")
                self.assertRegex(row["blob"], r"^[0-9a-f]{40}$")
                self.assertRegex(row["sha256"], r"^[0-9a-f]{64}$")

    def test_handoff_navigation_is_pinned_and_in_archived_inventory(self) -> None:
        links = 0
        for document in [ROOT / "README.md", *(ROOT / "docs").rglob("*.md")]:
            text = document.read_text(encoding="utf-8")
            targets = re.findall(r"\]\(([^)\s]+)\)|(?:href|src)=[\"']([^\"']+)[\"']", text)
            for markdown, html in targets:
                target = markdown or html
                if "handoff/" not in target:
                    continue
                with self.subTest(document=document.relative_to(ROOT), target=target):
                    self.assertTrue(target.startswith(PREFIX), target)
                    parts = urlsplit(target).path.split("/")
                    self.assertIn(parts[3], ("blob", "tree"))
                    self.assertEqual(parts[4], ARCHIVE)
                    path = unquote("/".join(parts[5:])).rstrip("/")
                    if parts[3] == "blob":
                        self.assertIn(path, self.paths)
                    else:
                        self.assertTrue(any(p.startswith(path + "/") for p in self.paths))
                    links += 1
        self.assertGreater(links, 0)


class PlanningArchiveTests(unittest.TestCase):
    def setUp(self) -> None:
        with (ROOT / "docs/archive/planning-assets-inventory.tsv").open(encoding="utf-8", newline="") as stream:
            self.inventory = list(csv.DictReader(stream, delimiter="\t"))
        self.preserved = {row["path"]: row["preservation_commit"] for row in self.inventory}

    def test_exact_scope_and_mixed_preservation_commits(self) -> None:
        updated = {"docs/PRD-ATTACK-PATH-MAPPING.md", "docs/documentation-plan.md"}
        documents = {
            *updated, "docs/PRD-BATCH-WEB-INTAKE.md", "docs/PRD-CAMPAIGN-EXTRACTION.md",
            "docs/usability-review.md", "docs/development/documentation-review-evidence.md",
            "docs/archive/workbench-session-recovery.md",
        }
        assets = {
            *(f"docs/assets/{kind}-concept-{variant}.svg"
              for kind in ("logo", "favicon") for variant in "abc"),
            "docs/assets/preview.html", "docs/assets/attack-path-concept.html",
            *(f"docs/assets/issue-25-{view}-{width}.png"
              for view in ("comparison", "timeline") for width in (1024, 1440, 390)),
            "docs/assets/issue-25-conflicts-1440.png",
        }
        self.assertEqual(len(self.inventory), 22)
        self.assertEqual(set(self.preserved), documents | assets)
        for row in self.inventory:
            with self.subTest(path=row["path"]):
                expected = "a1cd31eef5ebe9dce7cf564e317cf5691a1343dc" if row["path"] in updated else ARCHIVE
                self.assertEqual(row["preservation_commit"], expected)
                self.assertEqual(row["mode"], "100644")
                self.assertRegex(row["blob"], r"^[0-9a-f]{40}$")
                self.assertRegex(row["sha256"], r"^[0-9a-f]{64}$")
                self.assertGreater(int(row["bytes"]), 0)
                self.assertFalse((ROOT / row["path"]).exists())

    def test_incoming_navigation_uses_each_actual_preservation_commit(self) -> None:
        linked = set()
        for document in [ROOT / "README.md", *(ROOT / "docs").rglob("*.md")]:
            text = document.read_text(encoding="utf-8")
            for markdown, html in re.findall(r"\]\(([^)\s]+)\)|(?:href|src)=[\"']([^\"']+)[\"']", text):
                target = unquote(markdown or html)
                parts = urlsplit(target)
                if parts.scheme or parts.netloc:
                    for path, revision in self.preserved.items():
                        if parts.path.endswith("/" + path):
                            with self.subTest(document=document.relative_to(ROOT), target=target):
                                self.assertEqual(parts.scheme, "https")
                                self.assertEqual(parts.netloc, "github.com")
                                self.assertEqual(parts.path, f"/ashwin-patil/DevEnvThreatCorpus/blob/{revision}/{path}")
                            linked.add(path)
                elif parts.path:
                    resolved = (document.parent / parts.path).resolve().relative_to(ROOT).as_posix()
                    self.assertNotIn(resolved, self.preserved, f"{document}: {target}")
        self.assertTrue({p for p in self.preserved if p.endswith(".md") or p.endswith(".png")} <= linked)
