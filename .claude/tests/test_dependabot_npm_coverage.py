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

A second, smaller invariant lives at the bottom (`DependabotGroupsTest`): the
workspace-root entry's `groups:` that bundle minor/patch updates into one PR.
Deleting that block, or letting a group admit `major`, fails nothing else — the
per-dependency PRs and their sequential `pnpm-lock.yaml` conflicts just quietly
come back (NERV Task CLE-T-M8RB67).

A third lives right after it (`DependabotIgnoreTest`): the same entry's `ignore:`
list. It holds the major bumps a human must decide (`typescript` · `@types/node`),
and PROJECT.md states how many there are. Dropping an item, or writing it without
`update-types` (which silences minor/patch too), fails nothing else — the next
major PR just arrives, or the group PRs quietly stop. PROJECT.md's count is edited
by hand in a second place, so the test reads that sentence too (NERV Task
CLE-T-8AHC63, after `#1533` tried to move the SDK's `@types/node` to `^26`).
"""

from __future__ import annotations

import json
import re
import subprocess
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below

REPO_ROOT = _harness.REPO_ROOT
WORKSPACE_YAML = REPO_ROOT / "pnpm-workspace.yaml"
DEPENDABOT_YAML = REPO_ROOT / ".github" / "dependabot.yml"
PROJECT_MD = REPO_ROOT / "PROJECT.md"

# The workspace ROOT package.json is the pnpm project itself — `pnpm audit` runs
# from here and covers it, so it is not an "independent tree".
_ROOT_MANIFEST = "package.json"

# …but it IS a legitimate dependabot registration, and for a different hole than
# the one this file's main invariant closes. `_independent_trees()` answers "who
# can `pnpm audit` not see?"; dependabot's root entry answers "who keeps
# `pnpm-lock.yaml` current?". Nothing did — the lockfile drifted behind its own
# manifests until a `--frozen-lockfile` CI failure surfaced it (#1029/#1030), and
# dependabot's npm ecosystem understands pnpm workspaces, so one `directory: "/"`
# covers every member. `_parse_dependabot_npm_directories` normalizes `/` → `""`.
_WORKSPACE_ROOT_DIRECTORY = ""


def _legitimate_dependabot_directories() -> set[str]:
    """Directories a dependabot npm entry may point at without being stale."""
    return set(_independent_trees()) | {_WORKSPACE_ROOT_DIRECTORY}


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
        legitimate = _legitimate_dependabot_directories()
        for registered in _dependabot_npm_directories():
            with self.subTest(directory=registered):
                self.assertIn(
                    registered, legitimate,
                    f"dependabot.yml registers `{registered}` but no independent "
                    "npm tree lives there (moved, deleted, or absorbed into the "
                    "pnpm workspace?) — drop the entry or fix the path. The one "
                    "non-independent directory that is allowed is the workspace "
                    "root, which exists to keep pnpm-lock.yaml current (#1029).",
                )

    def test_workspace_root_stays_registered(self):
        """The root entry is the lockfile-drift fix — losing it is silent.

        Nothing else fails when it goes: `pnpm audit` still passes (it reads the
        lockfile it is handed), and the staleness check above only looks at
        entries that ARE present. The drift only surfaces later, as a
        `--frozen-lockfile` failure on an unrelated PR (#1029/#1030).
        """
        self.assertIn(
            _WORKSPACE_ROOT_DIRECTORY, _dependabot_npm_directories(),
            'dependabot.yml lost its workspace-root npm entry (directory: "/") — '
            "pnpm-lock.yaml is no longer kept current by anything.",
        )

    def test_root_exception_does_not_admit_workspace_members(self):
        """The exception is one directory wide, not "any tracked manifest".

        Widening it to every package.json dir would re-admit exactly what the
        staleness check exists to catch: an entry for a tree that pnpm audit
        already covers, which reads as extra coverage while adding none.
        """
        members = [d for d in ("codebase/backend", "codebase/frontend")
                   if (REPO_ROOT / d / "package.json").exists()]
        self.assertTrue(members, "no workspace member manifest found to test with")
        legitimate = _legitimate_dependabot_directories()
        for member in members:
            with self.subTest(member=member):
                self.assertNotIn(member, legitimate)


# --- workspace-root `groups:` ------------------------------------------------

# Group name → the `applies-to` it must carry. PROJECT.md quotes both names, so a
# rename has to touch that bullet too.
_EXPECTED_GROUPS = {
    "npm-minor-patch": "version-updates",
    "npm-security": "security-updates",
}
# `major` stays out of every group: a human decides it, one at a time.
_GROUP_UPDATE_TYPES = {"minor", "patch"}
# Reason-pinned deps (PROJECT.md §버전 핀 정책 (b)) reviewed as individual PRs:
# dompurify · marked = sanitize path, three = 0.x tilde pin. react · react-dom
# are pinned only for monorepo alignment, and jsonwebtoken · @radix-ui/react-focus-scope
# follow their parent's exact dependency, so they stay grouped on purpose.
_INDIVIDUAL_PR_PINS = {"dompurify", "marked", "three"}

_GROUP_LIST_ITEM = re.compile(r"""\s*(?:"([^"]*)"|'([^']*)'|([^,"'\s\]]+))\s*""")


def _parse_flow_list(raw: str, where: str) -> list[str]:
    inner = raw.strip()
    if not (inner.startswith("[") and inner.endswith("]")):
        raise ValueError(f"{where}: expected a [..] list, got {raw!r}")
    inner = inner[1:-1].strip()
    if not inner:
        return []
    items: list[str] = []
    for part in inner.split(","):
        m = _GROUP_LIST_ITEM.fullmatch(part)
        if not m:
            raise ValueError(f"{where}: unparsable list item {part!r}")
        items.append(next(g for g in m.groups() if g is not None))
    return items


def _root_npm_block(text: str) -> str:
    """The workspace-root npm entry (`directory: "/"`) of dependabot.yml TEXT.

    Raises when it is absent: the callers read keys inside it, and an empty
    answer would make "key missing" and "entry missing" look the same.
    """
    for block in re.split(r"^\s*-\s*package-ecosystem:", text, flags=re.M)[1:]:
        eco = re.match(r"""\s*["']?([\w-]+)["']?""", block)
        d = re.search(r"""^\s*directory:\s*["']?([^"'#\s]*)["']?""", block, re.M)
        if eco and eco.group(1) == "npm" and d and d.group(1).strip("/") == "":
            return block
    raise ValueError('no workspace-root npm entry (directory: "/")')


def _parse_root_npm_groups(text: str) -> dict[str, dict[str, object]]:
    """`groups:` of the workspace-root npm entry in dependabot.yml TEXT.

    Returns {group: {key: str | list[str]}}; {} when the entry has no `groups:`.
    Handles the two YAML shapes a human would write here — flow lists
    (`["a", "b"]`) and block lists (`- a`). Anything else RAISES instead of being
    skipped: a silently dropped line would read as "key absent" and the test
    would then blame the config for what is really a parser gap.
    """
    root_block = _root_npm_block(text)

    lines = root_block.splitlines()
    start = next(
        (i for i, line in enumerate(lines)
         if re.fullmatch(r"\s*groups:\s*" + _TRAILING_COMMENT, line)),
        None,
    )
    if start is None:
        return {}
    base = len(lines[start]) - len(lines[start].lstrip())

    groups: dict[str, dict[str, object]] = {}
    group_indent = None
    current: dict[str, object] | None = None
    pending_key: str | None = None
    for line in lines[start + 1:]:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= base:
            break  # a sibling key (e.g. `ignore:`) ends the block
        if group_indent is None:
            group_indent = indent
        if indent == group_indent:
            m = re.fullmatch(r"\s*([\w|-]+):\s*" + _TRAILING_COMMENT, line)
            if not m:
                raise ValueError(f"unexpected group header: {line!r}")
            current = groups.setdefault(m.group(1), {})
            pending_key = None
            continue
        if current is None or indent < group_indent:
            raise ValueError(f"line outside any group: {line!r}")
        item = re.fullmatch(
            r"""\s*-\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))\s*""" + _TRAILING_COMMENT,
            line,
        )
        if item and pending_key is not None:
            current[pending_key].append(next(g for g in item.groups() if g is not None))
            continue
        kv = re.fullmatch(r"\s*([\w-]+):(.*)", line)
        if not kv:
            raise ValueError(f"unparsable line in groups: {line!r}")
        key, raw = kv.group(1), re.sub(r"\s+#.*$", "", kv.group(2)).strip()
        if not raw:
            current[key] = []
            pending_key = key
        elif raw.startswith("["):
            current[key] = _parse_flow_list(raw, key)
            pending_key = None
        else:
            current[key] = raw.strip("\"'")
            pending_key = None
    return groups


def _group_violations(groups: dict[str, dict[str, object]]) -> list[str]:
    """Every way `groups` departs from the policy; [] means it holds."""
    if not groups:
        return ["workspace-root npm entry has no `groups:` — per-dependency PRs "
                "(and their sequential pnpm-lock.yaml conflicts) are back"]
    problems: list[str] = []
    for name, applies_to in _EXPECTED_GROUPS.items():
        group = groups.get(name)
        if group is None:
            problems.append(f"group `{name}` is missing")
            continue
        if group.get("applies-to") != applies_to:
            problems.append(
                f"`{name}` applies-to is {group.get('applies-to')!r}, "
                f"expected {applies_to!r}")
        update_types = group.get("update-types")
        if not isinstance(update_types, list) or set(update_types) != _GROUP_UPDATE_TYPES:
            problems.append(
                f"`{name}` update-types is {update_types!r}; it must be exactly "
                f"{sorted(_GROUP_UPDATE_TYPES)} — omitting it admits major too")
        if group.get("patterns") != ["*"]:
            problems.append(
                f"`{name}` patterns is {group.get('patterns')!r}; spell out "
                '["*"] — the default when omitted is undocumented')
        excluded = group.get("exclude-patterns")
        if not isinstance(excluded, list) or set(excluded) != _INDIVIDUAL_PR_PINS:
            problems.append(
                f"`{name}` exclude-patterns is {excluded!r}, expected "
                f"{sorted(_INDIVIDUAL_PR_PINS)} (reason-pinned deps reviewed alone)")
    for name in sorted(set(groups) - set(_EXPECTED_GROUPS)):
        problems.append(f"unexpected group `{name}` — add it to _EXPECTED_GROUPS "
                        "and PROJECT.md, or drop it")
    return problems


def _root_npm_groups() -> dict[str, dict[str, object]]:
    return _parse_root_npm_groups(DEPENDABOT_YAML.read_text(encoding="utf-8"))


# --- workspace-root `ignore:` --------------------------------------------------

# Dependency → the `update-types` it must be ignored for. Both are majors a human
# decides: `typescript` is the whole build toolchain's contract (PROJECT.md 근거,
# #1047), `@types/node` follows the Node runtime major and differs between the
# apps (`^26`) and the published SDK (`^20`), which dependabot cannot tell apart
# (#1533). `update-types` must be exactly this: omitted, the entry ignores EVERY
# update of the dependency, so the minor/patch group PRs would silently stop.
_MAJOR = "version-update:semver-major"
_EXPECTED_IGNORES = {
    "typescript": [_MAJOR],
    "@types/node": [_MAJOR],
}
_IGNORE_KEYS = {"dependency-name", "update-types"}


def _parse_root_npm_ignore(text: str) -> list[dict[str, object]]:
    """`ignore:` items of the workspace-root npm entry in dependabot.yml TEXT.

    Returns one dict per `- dependency-name: …` item, keyed like the YAML; [] when
    the entry has no `ignore:`. Same contract as `_parse_root_npm_groups`: the two
    list shapes a human writes (flow `["a"]`, block `- a`) are read, and a line it
    cannot place RAISES — a dropped line would read as "key absent" and the test
    would blame the config for what is a parser gap.
    """
    lines = _root_npm_block(text).splitlines()
    start = next(
        (i for i, line in enumerate(lines)
         if re.fullmatch(r"\s*ignore:\s*" + _TRAILING_COMMENT, line)),
        None,
    )
    if start is None:
        return []
    base = len(lines[start]) - len(lines[start].lstrip())

    items: list[dict[str, object]] = []
    pending_key: str | None = None
    for line in lines[start + 1:]:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= base:
            break  # a sibling key ends the block
        start_item = re.fullmatch(
            r"\s*-\s*([\w-]+):(.*)", line)
        if start_item and start_item.group(1) == "dependency-name":
            raw = re.sub(r"\s+#.*$", "", start_item.group(2)).strip()
            items.append({"dependency-name": raw.strip("\"'")})
            pending_key = None
            continue
        if not items:
            raise ValueError(f"line before the first ignore item: {line!r}")
        current = items[-1]
        entry = re.fullmatch(
            r"""\s*-\s*(?:"([^"]*)"|'([^']*)'|([^#\s]+))\s*""" + _TRAILING_COMMENT,
            line,
        )
        if entry and pending_key is not None:
            current[pending_key].append(next(g for g in entry.groups() if g is not None))
            continue
        kv = re.fullmatch(r"\s*([\w-]+):(.*)", line)
        if not kv:
            raise ValueError(f"unparsable line in ignore: {line!r}")
        key, raw = kv.group(1), re.sub(r"\s+#.*$", "", kv.group(2)).strip()
        if not raw:
            current[key] = []
            pending_key = key
        elif raw.startswith("["):
            current[key] = _parse_flow_list(raw, key)
            pending_key = None
        else:
            current[key] = raw.strip("\"'")
            pending_key = None
    return items


def _ignore_violations(items: list[dict[str, object]]) -> list[str]:
    """Every way `ignore:` departs from the policy; [] means it holds."""
    if not items:
        return ["workspace-root npm entry has no `ignore:` — the major bumps a "
                "human must decide arrive as dependabot PRs again"]
    problems: list[str] = []
    names = [str(item.get("dependency-name")) for item in items]
    for name in sorted({n for n in names if names.count(n) > 1}):
        problems.append(f"`{name}` is listed {names.count(name)} times — merge the items")
    for name, expected in _EXPECTED_IGNORES.items():
        matching = [item for item in items if item.get("dependency-name") == name]
        if not matching:
            problems.append(f"`{name}` is missing from `ignore:`")
            continue
        update_types = matching[0].get("update-types")
        if update_types != expected:
            problems.append(
                f"`{name}` update-types is {update_types!r}, expected {expected!r} — "
                "omitting it ignores minor/patch too, so the group PRs stop")
    for item in items:
        extra = sorted(set(item) - _IGNORE_KEYS)
        if extra:
            problems.append(
                f"`{item.get('dependency-name')}` has unexpected keys {extra} "
                "(only dependency-name and update-types are fixed by this guard)")
    for name in sorted(set(names) - set(_EXPECTED_IGNORES)):
        problems.append(f"unexpected ignore `{name}` — add it to _EXPECTED_IGNORES "
                        "and the PROJECT.md count, or drop it")
    return problems


def _root_npm_ignore() -> list[dict[str, object]]:
    return _parse_root_npm_ignore(DEPENDABOT_YAML.read_text(encoding="utf-8"))


# PROJECT.md states the policy as "현재 `a` · `b` N건". The count is edited by hand
# in a second place (2-place edit), so the test reads it back.
_PROJECT_CLAIM = re.compile(r"현재\s+((?:`[^`]+`\s*(?:·\s*)?)+)(\d+)건")


def _parse_project_ignore_claim(text: str) -> tuple[list[str], int]:
    """(names, count) of the single "현재 `…` N건" sentence in PROJECT.md TEXT."""
    matches = _PROJECT_CLAIM.findall(text)
    if len(matches) != 1:
        raise ValueError(
            f'expected exactly one "현재 `…` N건" sentence in PROJECT.md, found {len(matches)}')
    names_raw, count = matches[0]
    return re.findall(r"`([^`]+)`", names_raw), int(count)


def _declared_specs(dep: str) -> list[str]:
    """Version specs `dep` is declared with across tracked workspace manifests."""
    specs = []
    for manifest in _tracked_package_jsons():
        if manifest.startswith(".claude/"):
            continue
        data = json.loads((REPO_ROOT / manifest).read_text(encoding="utf-8"))
        for section in ("dependencies", "devDependencies"):
            spec = (data.get(section) or {}).get(dep)
            if spec is not None:
                specs.append(spec)
    return specs


_POLICY_IGNORE_TEXT = (
    "    ignore:\n"
    '      - dependency-name: "typescript"\n'
    '        update-types: ["version-update:semver-major"]\n'
    '      - dependency-name: "@types/node"\n'
    '        update-types: ["version-update:semver-major"]\n'
)

_POLICY_GROUPS_TEXT = """\
updates:
  - package-ecosystem: "npm"
    directory: "/"
    groups:
      npm-minor-patch:
        applies-to: version-updates
        patterns: ["*"]
        exclude-patterns: ["dompurify", "marked", "three"]
        update-types: ["minor", "patch"]
      npm-security:
        applies-to: security-updates
        patterns: ["*"]
        exclude-patterns: ["dompurify", "marked", "three"]
        update-types: ["minor", "patch"]
""" + _POLICY_IGNORE_TEXT

_SECURITY_HEADER = "      npm-security:\n"
_IGNORE_TAIL = _POLICY_IGNORE_TEXT


def _edit_security_group(old: str, new: str) -> str:
    """Apply one edit inside the `npm-security` group only."""
    head, sep, tail = _POLICY_GROUPS_TEXT.partition(_SECURITY_HEADER)
    return head + sep + tail.replace(old, new, 1)


class DependabotGroupsParserTest(unittest.TestCase):
    """The parser is hand-rolled; pin that it reads what a human would write."""

    def test_policy_shaped_text_has_no_violations(self):
        """Anchors the mutants below: each differs from this by one edit."""
        self.assertEqual(
            _group_violations(_parse_root_npm_groups(_POLICY_GROUPS_TEXT)), [])

    def test_block_lists_and_comments_parse_like_flow_lists(self):
        text = _POLICY_GROUPS_TEXT.replace(
            '        update-types: ["minor", "patch"]\n' + _SECURITY_HEADER,
            "        # block style\n"
            "        update-types:\n"
            '          - "minor"   # comment\n'
            "          - patch\n" + _SECURITY_HEADER,
        )
        self.assertNotEqual(text, _POLICY_GROUPS_TEXT, "fixture edit did not apply")
        groups = _parse_root_npm_groups(text)
        self.assertEqual(groups["npm-minor-patch"]["update-types"], ["minor", "patch"])
        self.assertEqual(_group_violations(groups), [])

    def test_only_the_root_entry_is_read(self):
        """A `groups:` on another npm entry must not stand in for the root one."""
        text = (
            "updates:\n"
            '  - package-ecosystem: "npm"\n'
            '    directory: "/.claude/tools/mermaid-lint"\n'
            "    groups:\n"
            "      x:\n"
            '        patterns: ["*"]\n'
            '  - package-ecosystem: "npm"\n'
            '    directory: "/"\n'
            '    rebase-strategy: "auto"\n'
        )
        self.assertEqual(_parse_root_npm_groups(text), {})

    def test_unknown_shape_raises_instead_of_vanishing(self):
        text = _POLICY_GROUPS_TEXT.replace(
            "        applies-to: version-updates\n",
            "        applies-to: version-updates\n        {weird}\n",
            1,
        )
        self.assertNotEqual(text, _POLICY_GROUPS_TEXT, "fixture edit did not apply")
        with self.assertRaises(ValueError):
            _parse_root_npm_groups(text)


class DependabotGroupsTest(unittest.TestCase):
    """The root entry's grouping policy (PROJECT.md "dependabot 그룹 PR")."""

    def test_repo_groups_follow_policy(self):
        groups = _root_npm_groups()
        self.assertEqual(
            set(groups), set(_EXPECTED_GROUPS),
            f"parsed groups {sorted(groups)} — parser or config drifted",
        )
        self.assertEqual(_group_violations(groups), [])

    def test_each_violation_is_caught(self):
        """One-edit mutants of the policy text; each must be reported."""
        mutants = {
            "groups block deleted":
                _POLICY_GROUPS_TEXT.split("    groups:\n")[0] + _IGNORE_TAIL,
            "major admitted": _POLICY_GROUPS_TEXT.replace(
                'update-types: ["minor", "patch"]',
                'update-types: ["minor", "patch", "major"]', 1),
            "update-types omitted": _POLICY_GROUPS_TEXT.replace(
                '        update-types: ["minor", "patch"]\n' + _SECURITY_HEADER,
                _SECURITY_HEADER, 1),
            "security group admits major": _edit_security_group(
                'update-types: ["minor", "patch"]',
                'update-types: ["minor", "patch", "major"]'),
            "security group gone":
                _POLICY_GROUPS_TEXT.split(_SECURITY_HEADER)[0] + _IGNORE_TAIL,
            "applies-to swapped": _POLICY_GROUPS_TEXT.replace(
                "applies-to: security-updates", "applies-to: version-updates"),
            "patterns omitted": _POLICY_GROUPS_TEXT.replace(
                '        patterns: ["*"]\n', "", 1),
            "sanitize pin grouped": _POLICY_GROUPS_TEXT.replace(
                '["dompurify", "marked", "three"]', '["marked", "three"]', 1),
            "extra group": _POLICY_GROUPS_TEXT.replace(
                "    ignore:\n",
                '      npm-major:\n        patterns: ["*"]\n    ignore:\n'),
        }
        for label, text in mutants.items():
            with self.subTest(mutant=label):
                self.assertNotEqual(text, _POLICY_GROUPS_TEXT, "mutant did not apply")
                self.assertTrue(
                    _group_violations(_parse_root_npm_groups(text)),
                    f"mutant `{label}` slipped through _group_violations",
                )

    def test_excluded_pins_are_still_pinned(self):
        """An exclusion outlives its reason silently once the pin is relaxed to
        caret — then it only costs a separate PR. Fail so someone drops it."""
        for dep in sorted(_INDIVIDUAL_PR_PINS):
            with self.subTest(dep=dep):
                specs = _declared_specs(dep)
                self.assertTrue(specs, f"`{dep}` is declared in no workspace manifest")
                self.assertTrue(
                    any(not s.startswith("^") for s in specs),
                    f"`{dep}` is caret everywhere ({specs}); its pin reason is gone, "
                    "so drop it from exclude-patterns and _INDIVIDUAL_PR_PINS",
                )


class DependabotIgnoreParserTest(unittest.TestCase):
    """The `ignore:` parser is hand-rolled too; pin that it reads what a human writes."""

    def test_policy_shaped_text_has_no_violations(self):
        """Anchors the mutants below: each differs from this by one edit."""
        items = _parse_root_npm_ignore(_POLICY_GROUPS_TEXT)
        self.assertEqual(
            [item["dependency-name"] for item in items], ["typescript", "@types/node"])
        self.assertEqual(_ignore_violations(items), [])

    def test_block_lists_comments_and_quotes_parse_like_flow_lists(self):
        text = _POLICY_GROUPS_TEXT.replace(
            '      - dependency-name: "@types/node"\n'
            '        update-types: ["version-update:semver-major"]\n',
            "      # a note between items\n"
            "      - dependency-name: '@types/node'   # runtime major\n"
            "        update-types:\n"
            '          - "version-update:semver-major"   # comment\n',
        )
        self.assertNotEqual(text, _POLICY_GROUPS_TEXT, "fixture edit did not apply")
        items = _parse_root_npm_ignore(text)
        self.assertEqual(items[1]["dependency-name"], "@types/node")
        self.assertEqual(items[1]["update-types"], [_MAJOR])
        self.assertEqual(_ignore_violations(items), [])

    def test_only_the_root_entry_is_read(self):
        """An `ignore:` on another npm entry must not stand in for the root one."""
        text = (
            "updates:\n"
            '  - package-ecosystem: "npm"\n'
            '    directory: "/.claude/tools/mermaid-lint"\n'
            "    ignore:\n"
            '      - dependency-name: "typescript"\n'
            '  - package-ecosystem: "npm"\n'
            '    directory: "/"\n'
            '    rebase-strategy: "auto"\n'
        )
        self.assertEqual(_parse_root_npm_ignore(text), [])

    def test_a_sibling_key_after_ignore_ends_the_block(self):
        text = _POLICY_GROUPS_TEXT + '    open-pull-requests-limit: 5\n'
        self.assertEqual(len(_parse_root_npm_ignore(text)), 2)

    def test_unknown_shape_raises_instead_of_vanishing(self):
        text = _POLICY_GROUPS_TEXT.replace(
            '        update-types: ["version-update:semver-major"]\n',
            "        {weird}\n",
            1,
        )
        self.assertNotEqual(text, _POLICY_GROUPS_TEXT, "fixture edit did not apply")
        with self.assertRaises(ValueError):
            _parse_root_npm_ignore(text)

    def test_project_claim_reads_names_and_count(self):
        text = "x. 현재 `typescript` · `@types/node` 2건(`.github/dependabot.yml` 의 `ignore`). y"
        self.assertEqual(
            _parse_project_ignore_claim(text), (["typescript", "@types/node"], 2))

    def test_project_claim_must_appear_exactly_once(self):
        with self.assertRaises(ValueError):
            _parse_project_ignore_claim("count removed")
        with self.assertRaises(ValueError):
            _parse_project_ignore_claim("현재 `a` 1건. 현재 `b` 1건.")


class DependabotIgnoreTest(unittest.TestCase):
    """The root entry's `ignore:` list (PROJECT.md "빌드 툴체인 · 런타임 결속 major 자동 bump 차단")."""

    def test_repo_ignore_follows_policy(self):
        items = _root_npm_ignore()
        self.assertEqual(
            {item.get("dependency-name") for item in items}, set(_EXPECTED_IGNORES),
            f"parsed ignore items {items} — parser or config drifted",
        )
        self.assertEqual(_ignore_violations(items), [])

    def test_each_violation_is_caught(self):
        """One-edit mutants of the policy text; each must be reported."""
        node_item = (
            '      - dependency-name: "@types/node"\n'
            '        update-types: ["version-update:semver-major"]\n'
        )
        mutants = {
            "ignore block deleted":
                _POLICY_GROUPS_TEXT.split("    ignore:\n")[0],
            "typescript dropped": _POLICY_GROUPS_TEXT.replace(
                '      - dependency-name: "typescript"\n'
                '        update-types: ["version-update:semver-major"]\n', "", 1),
            "@types/node dropped": _POLICY_GROUPS_TEXT.replace(node_item, "", 1),
            "@types/node update-types omitted": _POLICY_GROUPS_TEXT.replace(
                node_item, '      - dependency-name: "@types/node"\n', 1),
            "@types/node narrowed to minor": _POLICY_GROUPS_TEXT.replace(
                node_item,
                '      - dependency-name: "@types/node"\n'
                '        update-types: ["version-update:semver-minor"]\n', 1),
            "@types/node also blocks minor": _POLICY_GROUPS_TEXT.replace(
                node_item,
                '      - dependency-name: "@types/node"\n'
                '        update-types: ["version-update:semver-major", '
                '"version-update:semver-minor"]\n', 1),
            "@types/node listed twice": _POLICY_GROUPS_TEXT + node_item,
            "version pinned instead": _POLICY_GROUPS_TEXT.replace(
                node_item,
                node_item + '        versions: [">=26"]\n', 1),
            "extra ignore": _POLICY_GROUPS_TEXT
                + '      - dependency-name: "react"\n'
                '        update-types: ["version-update:semver-major"]\n',
        }
        for label, text in mutants.items():
            with self.subTest(mutant=label):
                self.assertNotEqual(text, _POLICY_GROUPS_TEXT, "mutant did not apply")
                self.assertTrue(
                    _ignore_violations(_parse_root_npm_ignore(text)),
                    f"mutant `{label}` slipped through _ignore_violations",
                )

    def test_project_md_count_matches_the_ignore_block(self):
        """PROJECT.md and dependabot.yml are edited by hand in two places; this is
        the check the sentence itself asks for ("항목 수와 항상 같아야 한다")."""
        items = _root_npm_ignore()
        names, count = _parse_project_ignore_claim(
            PROJECT_MD.read_text(encoding="utf-8"))
        self.assertEqual(
            count, len(items),
            f"PROJECT.md says {count}건 but `ignore:` has {len(items)} — edit both "
            "in the same commit")
        self.assertEqual(
            len(names), count,
            f"PROJECT.md names {names} but counts {count}건")
        self.assertEqual(
            set(names), {str(item.get("dependency-name")) for item in items},
            "PROJECT.md names different dependencies than the `ignore:` block")


if __name__ == "__main__":
    unittest.main()
