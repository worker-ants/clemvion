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


# A value may carry a trailing `# comment`; without allowing it the `$` anchor
# silently drops the entry, which reads as "not registered" and sends whoever
# hits it looking in the wrong place.
_TRAILING_COMMENT = r"(?:\s+#.*)?"


def _parse_workspace_globs(text: str) -> list[str]:
    """The `packages:` globs from pnpm-workspace.yaml TEXT.

    Takes text, not a path, so the parser's edge cases can be pinned with
    synthetic input instead of only against whatever the repo happens to hold.
    """
    globs: list[str] = []
    in_block = False
    for line in text.splitlines():
        if re.match(r"^packages:\s*$", line):
            in_block = True
            continue
        if in_block:
            m = re.match(
                r"""^\s*-\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))\s*""" + _TRAILING_COMMENT + r"$",
                line,
            )
            if m:
                globs.append(next(g for g in m.groups() if g is not None).strip())
                continue
            if line.strip() and not line.startswith((" ", "\t", "-")):
                break  # a new top-level key ended the list
    return globs


def _parse_dependabot_npm_directories(text: str) -> set[str]:
    """`directory:` values of every npm-ecosystem entry in dependabot.yml TEXT."""
    dirs: set[str] = set()
    # Entries are `- package-ecosystem: "npm"` followed by `directory: "…"`.
    for block in re.split(r"^\s*-\s*package-ecosystem:", text, flags=re.M)[1:]:
        eco = re.match(r"""\s*["']?([\w-]+)["']?""", block)
        if not eco or eco.group(1) != "npm":
            continue
        d = re.search(
            r"""^\s*directory:\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))\s*"""
            + _TRAILING_COMMENT + r"$",
            block, re.M,
        )
        if d:
            value = next(g for g in d.groups() if g is not None)
            dirs.add(value.strip().strip("/"))
    return dirs


def _workspace_globs() -> list[str]:
    return _parse_workspace_globs(WORKSPACE_YAML.read_text(encoding="utf-8"))


def _dependabot_npm_directories() -> set[str]:
    return _parse_dependabot_npm_directories(
        DEPENDABOT_YAML.read_text(encoding="utf-8")
    )


def _glob_to_regex(glob: str) -> re.Pattern[str]:
    """pnpm (micromatch) glob → regex.

    A single `*` stays INSIDE one path segment; only `**` crosses `/`.
    `fnmatch` gets this wrong — it turns `*` into `.*`, so
    `codebase/packages/*` also matches `codebase/packages/a/b`. A genuinely
    independent nested tree would then be classified as workspace-covered and
    its CVEs would stay silent — the exact failure this guard exists to catch,
    reproduced inside the guard itself.
    """
    out: list[str] = []
    i = 0
    while i < len(glob):
        if glob.startswith("**", i):
            out.append(".*")
            i += 2
        elif glob[i] == "*":
            out.append("[^/]*")
            i += 1
        elif glob[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def _independent_trees() -> list[str]:
    """package.json dirs that pnpm audit cannot see."""
    patterns = [_glob_to_regex(g.rstrip("/")) for g in _workspace_globs()]
    independent = []
    for manifest in _tracked_package_jsons():
        if manifest == _ROOT_MANIFEST:
            continue
        pkg_dir = manifest.rsplit("/", 1)[0]
        if any(p.match(pkg_dir) for p in patterns):
            continue
        independent.append(pkg_dir)
    return independent


class GlobSemanticsTest(unittest.TestCase):
    """`*` must not cross `/` — the classifier's own blind-spot risk."""

    def test_single_star_stays_within_one_segment(self):
        pattern = _glob_to_regex("codebase/packages/*")
        self.assertTrue(pattern.match("codebase/packages/sdk"))
        self.assertFalse(
            pattern.match("codebase/packages/sdk/nested"),
            "a nested tree is NOT covered by pnpm's single `*`; treating it as "
            "covered would hide an unregistered npm tree — exactly what this "
            "guard exists to prevent (fnmatch has this bug)",
        )

    def test_double_star_crosses_segments(self):
        pattern = _glob_to_regex("codebase/**")
        self.assertTrue(pattern.match("codebase/packages/sdk"))

    def test_literals_are_escaped(self):
        self.assertTrue(_glob_to_regex("a.b").match("a.b"))
        self.assertFalse(_glob_to_regex("a.b").match("axb"))

    def test_classifier_actually_uses_these_semantics(self):
        """Guards the USE, not just the helper.

        Testing `_glob_to_regex` alone would still pass if `_independent_trees`
        went back to `fnmatch` and left the helper unused — and with no nested
        tree in the repo today, nothing else would notice. So inject a synthetic
        one and assert the classifier calls it independent.
        """
        nested = "codebase/packages/sdk/vendor/thing"
        real = _tracked_package_jsons
        globals()["_tracked_package_jsons"] = lambda: real() + [
            f"{nested}/package.json"
        ]
        try:
            self.assertIn(
                nested, _independent_trees(),
                "a package.json nested BELOW a `packages/*` member is outside "
                "the pnpm workspace and must be flagged for dependabot",
            )
        finally:
            globals()["_tracked_package_jsons"] = real


class ParserEdgeCaseTest(unittest.TestCase):
    """Both parsers are hand-rolled; pin the shapes that silently lose entries."""

    def test_workspace_globs_handle_quotes_and_comments(self):
        text = (
            "packages:\n"
            '  - "codebase/backend"   # quoted with a comment\n'
            "  - 'codebase/frontend'\n"
            "  - codebase/packages/*\n"
            "\n"
            "otherKey: value\n"
        )
        self.assertEqual(
            _parse_workspace_globs(text),
            ["codebase/backend", "codebase/frontend", "codebase/packages/*"],
        )

    def test_dependabot_directory_survives_a_trailing_comment(self):
        """`directory: "/x" # note` used to fail the `$` anchor and vanish,
        surfacing later as a confusing "not registered" failure."""
        text = (
            "version: 2\n"
            "updates:\n"
            '  - package-ecosystem: "npm"\n'
            '    directory: "/.claude/tools/mermaid-lint"   # harness tooling\n'
            "      schedule:\n"
            '        interval: "weekly"\n'
        )
        self.assertEqual(
            _parse_dependabot_npm_directories(text),
            {".claude/tools/mermaid-lint"},
        )

    def test_non_npm_ecosystems_are_ignored(self):
        text = (
            "updates:\n"
            '  - package-ecosystem: "github-actions"\n'
            '    directory: "/"\n'
            '  - package-ecosystem: "npm"\n'
            '    directory: "/tools/x"\n'
        )
        self.assertEqual(_parse_dependabot_npm_directories(text), {"tools/x"})


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
