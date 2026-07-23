"""Guard: every npm tree OUTSIDE the pnpm workspace must be in dependabot.yml.

The invariant this enforces, and why it exists:

`deps-security-checks.yml` runs `pnpm audit`, which only sees the pnpm workspace
(`pnpm-workspace.yaml` → `packages:`). An independent `package.json` outside that
set is covered by NOTHING — no audit job, no config guard — so its CVEs are
permanently silent. That is not hypothetical: `.claude/tools/mermaid-lint` sat
unscanned until 2026-07-18, when a manual `npm audit` turned up an `undici` HIGH
and a `dompurify` moderate that had been sitting there. The fix registered it in
`.github/dependabot.yml`; this test is what stops the NEXT such tree from being
forgotten (review/code/2026/07/18/12_31_29 W5 — deferred there, no guard existed).

Parsing is deliberately minimal (stdlib only, per .claude/tests/README.md), so
both parsers assert they actually found something rather than silently returning
an empty set and passing vacuously — and `test_known_independent_tree_is_detected`
pins that the classifier still SEES the one tree we know is independent.
"""

from __future__ import annotations

import fnmatch
import re
import subprocess
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below

REPO_ROOT = _harness.REPO_ROOT
WORKSPACE_YAML = REPO_ROOT / "pnpm-workspace.yaml"
DEPENDABOT_YAML = REPO_ROOT / ".github" / "dependabot.yml"

# The workspace ROOT package.json is the pnpm project itself — `pnpm audit` runs
# from here and covers it, so it is not an "independent tree".
_ROOT_MANIFEST = "package.json"


def _tracked_package_jsons() -> list[str]:
    """Repo-relative package.json paths that git tracks (so never node_modules)."""
    out = subprocess.run(
        ["git", "ls-files", "--", "*package.json"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    ).stdout
    return sorted(
        line.strip() for line in out.splitlines()
        if line.strip().endswith("package.json")
    )


def _workspace_globs() -> list[str]:
    """The `packages:` globs from pnpm-workspace.yaml."""
    globs: list[str] = []
    in_block = False
    for line in WORKSPACE_YAML.read_text(encoding="utf-8").splitlines():
        if re.match(r"^packages:\s*$", line):
            in_block = True
            continue
        if in_block:
            m = re.match(r"""^\s*-\s*["']?([^"'#]+?)["']?\s*$""", line)
            if m:
                globs.append(m.group(1).strip())
                continue
            if line.strip() and not line.startswith((" ", "\t", "-")):
                break  # a new top-level key ended the list
    return globs


def _dependabot_npm_directories() -> set[str]:
    """`directory:` values of every npm-ecosystem entry in dependabot.yml."""
    text = DEPENDABOT_YAML.read_text(encoding="utf-8")
    dirs: set[str] = set()
    # Entries are `- package-ecosystem: "npm"` followed by `directory: "…"`.
    for block in re.split(r"^\s*-\s*package-ecosystem:", text, flags=re.M)[1:]:
        eco = re.match(r"""\s*["']?([\w-]+)["']?""", block)
        if not eco or eco.group(1) != "npm":
            continue
        d = re.search(r"""^\s*directory:\s*["']?([^"'#\n]+?)["']?\s*$""", block, re.M)
        if d:
            dirs.add(d.group(1).strip().strip("/"))
    return dirs


def _independent_trees() -> list[str]:
    """package.json dirs that pnpm audit cannot see."""
    globs = _workspace_globs()
    independent = []
    for manifest in _tracked_package_jsons():
        if manifest == _ROOT_MANIFEST:
            continue
        pkg_dir = manifest.rsplit("/", 1)[0]
        if any(fnmatch.fnmatch(pkg_dir, g.rstrip("/")) for g in globs):
            continue
        independent.append(pkg_dir)
    return independent


class ParserSanityTest(unittest.TestCase):
    """Both parsers are hand-rolled; an empty result would make the real test
    pass for the wrong reason, so each is pinned to find something real."""

    def test_workspace_globs_are_parsed(self):
        globs = _workspace_globs()
        self.assertTrue(globs, f"parsed no packages: globs from {WORKSPACE_YAML}")
        self.assertIn("codebase/backend", globs,
                      f"pnpm-workspace.yaml parse looks wrong: {globs}")

    def test_dependabot_npm_directories_are_parsed(self):
        dirs = _dependabot_npm_directories()
        self.assertTrue(
            dirs, f"parsed no npm `directory:` entries from {DEPENDABOT_YAML}"
        )

    def test_known_independent_tree_is_detected(self):
        """If the classifier ever marked everything as workspace-covered, the
        coverage test below would pass with an empty set and guard nothing."""
        self.assertIn(
            ".claude/tools/mermaid-lint", _independent_trees(),
            "the harness mermaid-lint tree must classify as OUTSIDE the pnpm "
            "workspace — if it no longer does, this guard has gone vacuous",
        )


class DependabotCoverageTest(unittest.TestCase):
    def test_every_independent_npm_tree_is_registered(self):
        registered = _dependabot_npm_directories()
        for tree in _independent_trees():
            with self.subTest(tree=tree):
                self.assertIn(
                    tree, registered,
                    f"`{tree}/package.json` is outside the pnpm workspace, so "
                    "`pnpm audit` never sees it. Register it in "
                    ".github/dependabot.yml under an npm ecosystem entry "
                    f'(directory: "/{tree}") or its CVEs stay permanently '
                    "silent — the exact failure that hid undici HIGH in "
                    ".claude/tools/mermaid-lint until 2026-07-18.",
                )

    def test_no_stale_dependabot_npm_entry(self):
        """A `directory:` pointing at a tree that no longer exists is dead
        config that reads as coverage."""
        independent = set(_independent_trees())
        for registered in _dependabot_npm_directories():
            with self.subTest(directory=registered):
                self.assertIn(
                    registered, independent,
                    f"dependabot.yml registers `{registered}` but no independent "
                    "npm tree lives there (moved, deleted, or absorbed into the "
                    "pnpm workspace?) — drop the entry or fix the path.",
                )


if __name__ == "__main__":
    unittest.main()
