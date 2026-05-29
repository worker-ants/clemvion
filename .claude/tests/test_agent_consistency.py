"""Guard against drift across the four places a reviewer/checker/analyzer is
declared:

  1. `role_instructions.py`   — the SSOT dicts (perspective + checklist).
  2. `.claude/agents/<name>.md` — the sub-agent definition the Agent tool loads.
  3. `.claude.project.json`    — the per-agent enable toggles.
  4. `README.md` table         — the human-facing reviewer index.

Adding, renaming, or removing an agent historically meant editing all four by
hand; a miss only surfaced at runtime. These tests fail the build instead.

Design note — NOT a content/verbatim check. The `.md` files are intentionally a
lightly-edited, human-facing rendering of the SSOT (an analyzer `.md` may add a
"you may call `git diff` yourself" hint, trim a parenthetical, or — for the
summary agents — carry a wholly different "수행 절차" structure). So we assert
only *registry-level* invariants that tolerate prose edits but catch the real
drift hazards from add/rename/remove: a key with no `.md`, an orphan `.md`, a
toggle-list mismatch, or a frontmatter name that doesn't match its file. Prose
checklist wording is deliberately left unguarded.
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

from _harness import CLAUDE_DIR, REPO_ROOT, load_module_by_path

ROLE = load_module_by_path(
    "role_instructions",
    CLAUDE_DIR / "skills" / "code-review-agents" / "lib" / "role_instructions.py",
)

AGENTS_DIR = CLAUDE_DIR / "agents"
README = CLAUDE_DIR / "skills" / "code-review-agents" / "README.md"
PROJECT_JSON = REPO_ROOT / ".claude.project.json"

# key → .md filename rule, per family.
#   reviewers: `<dashed-key>-reviewer.md`
#   checkers:  `<dashed-key>-checker.md`
#   analyzers: `<dashed-key>.md`  (keys already carry their role suffix)
FAMILIES = {
    "REVIEWER_INSTRUCTIONS": "-reviewer",
    "CHECKER_INSTRUCTIONS": "-checker",
    "ANALYZER_INSTRUCTIONS": "",
}

# Agents NOT backed by a role_instructions entry — standalone sub-agents with
# bespoke prompts. Listed explicitly so the orphan check can tell
# "intentionally standalone" from "lost its SSOT entry".
STANDALONE_AGENTS = {
    "review-router",
    "resolution-applier",
    "code-review-summary",
    "consistency-summary",
    "spec-impl-coverage-auditor",
    "user-guide-writer",
}


def _md_name(key: str, suffix: str) -> str:
    return f"{key.replace('_', '-')}{suffix}.md"


def _all_instruction_md_names() -> set[str]:
    names = set()
    for attr, suffix in FAMILIES.items():
        for key in getattr(ROLE, attr):
            names.add(_md_name(key, suffix))
    return names


def _read_frontmatter_name(md_path: Path) -> str | None:
    text = md_path.read_text(encoding="utf-8")
    m = re.search(r"(?ms)\A---\s*\n(.*?)\n---\s*\n", text)
    if not m:
        return None
    nm = re.search(r"(?m)^name:\s*(.+?)\s*$", m.group(1))
    return nm.group(1) if nm else None


class AgentRegistryTest(unittest.TestCase):
    """key ↔ .md completeness, both directions."""

    def test_every_instruction_key_has_md(self):
        for attr, suffix in FAMILIES.items():
            for key in getattr(ROLE, attr):
                with self.subTest(key=key):
                    md = AGENTS_DIR / _md_name(key, suffix)
                    self.assertTrue(
                        md.is_file(),
                        f"role_instructions key '{key}' expects {md.name}, "
                        f"which does not exist in {AGENTS_DIR}",
                    )

    def test_no_orphan_agent_md(self):
        expected = _all_instruction_md_names()
        on_disk = {p.name for p in AGENTS_DIR.glob("*.md")}
        allowed = expected | {f"{n}.md" for n in STANDALONE_AGENTS}
        orphans = on_disk - allowed
        self.assertFalse(
            orphans,
            f"agent .md files with no role_instructions entry and not in "
            f"STANDALONE_AGENTS: {sorted(orphans)}. Add the SSOT entry or list "
            f"it as standalone in test_agent_consistency.py.",
        )

    def test_standalone_allowlist_is_accurate(self):
        on_disk = {p.stem for p in AGENTS_DIR.glob("*.md")}
        missing = STANDALONE_AGENTS - on_disk
        self.assertFalse(
            missing,
            f"STANDALONE_AGENTS lists agents with no .md on disk: {sorted(missing)}",
        )


class ProjectJsonToggleTest(unittest.TestCase):
    """.claude.project.json toggle keys == SSOT keys."""

    def test_project_json_keys_match_ssot(self):
        cfg = json.loads(PROJECT_JSON.read_text(encoding="utf-8"))
        for kind, attr in (
            ("reviewers", "REVIEWER_INSTRUCTIONS"),
            ("checkers", "CHECKER_INSTRUCTIONS"),
        ):
            with self.subTest(kind=kind):
                json_keys = set((cfg.get("agents") or {}).get(kind, {}).keys())
                ssot_keys = set(getattr(ROLE, attr).keys())
                self.assertEqual(
                    json_keys,
                    ssot_keys,
                    f".claude.project.json agents.{kind} keys != {attr}.\n"
                    f"  only in json: {sorted(json_keys - ssot_keys)}\n"
                    f"  only in SSOT: {sorted(ssot_keys - json_keys)}",
                )


class ReadmeToggleColumnTest(unittest.TestCase):
    """README reviewer table's toggle column == REVIEWER_INSTRUCTIONS keys."""

    def test_readme_toggle_column_matches_reviewers(self):
        text = README.read_text(encoding="utf-8")
        keys = set()
        for line in text.splitlines():
            if "-reviewer`" not in line:
                continue
            backticked = re.findall(r"`([^`]+)`", line)
            if backticked:
                keys.add(backticked[-1])  # final token = the toggle key
        ssot = set(ROLE.REVIEWER_INSTRUCTIONS.keys())
        self.assertEqual(
            keys,
            ssot,
            f"README reviewer toggle column != REVIEWER_INSTRUCTIONS keys.\n"
            f"  only in README: {sorted(keys - ssot)}\n"
            f"  only in SSOT:   {sorted(ssot - keys)}",
        )


class FrontmatterNameTest(unittest.TestCase):
    """frontmatter `name:` == filename stem, for every agent .md."""

    def test_frontmatter_name_matches_filename(self):
        for md_path in sorted(AGENTS_DIR.glob("*.md")):
            with self.subTest(md=md_path.name):
                name = _read_frontmatter_name(md_path)
                self.assertIsNotNone(
                    name, f"{md_path.name} has no `name:` in frontmatter"
                )
                self.assertEqual(
                    name,
                    md_path.stem,
                    f"{md_path.name}: frontmatter name '{name}' != stem "
                    f"'{md_path.stem}'",
                )


if __name__ == "__main__":
    unittest.main()
