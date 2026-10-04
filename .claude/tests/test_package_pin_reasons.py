"""Every non-caret dependency in a workspace manifest has a written reason.

PROJECT.md §버전 핀 정책: (a) declarations default to caret, (b) an exact or
tilde pin needs a reason in the adjacent ``"//pin"`` field, (c) a pin without a
reason is relaxed to caret. Nothing enforced (b) or (c): on 2026-10-02 a full
sweep found three exact pins whose manifest gave no reason
(``jsonwebtoken`` · ``@radix-ui/react-focus-scope`` · ``eslint-config-next``),
and three version numbers quoted in the ``"//pin"`` texts of two manifests that
dependabot had already moved (``three ~0.184.0`` · ``react 19.2.4`` in
frontend, ``react 19.2.4`` in channel-web-chat). NERV Task ``CLE-T-BZ0AK9``.

So this checks, for the root manifest and every package that
``pnpm-workspace.yaml`` lists:

* each dependency whose spec is not caret is named in that manifest's
  ``"//pin"``, as a whole token. ``react-dom`` does not name ``react``, and
  ``@radix-ui/react-focus-scope`` does not either. A prose word that equals a
  package name (``three``) still counts, since the check cannot read meaning;
* ``"//pin"`` quotes no version numbers. Dependabot bumps the spec, not the
  comment, so a quoted version goes stale on the next update (the second
  finding above). Only the dotted form ``N.N[.N]`` is seen. A bare major such
  as ``v19`` passes. A dotted tool version such as ``pnpm 10.23`` is reported
  although it is not a pin version, so say it in words instead.

The reason text must also reach CI: a pin without a reason arrives as a PR that
edits only a manifest, so ``harness-checks.yml`` has to run for that PR.
``TriggerCoverageTest`` holds that.

Not scanned on purpose: ``peerDependencies``. A peer range states which
versions a consumer may bring, and it is not a version this repo pins.
"""

from __future__ import annotations

import json
import re
import unittest

import _harness  # noqa: F401  — side effect: harness path setup; REPO_ROOT used below
# The sibling guard already owns "what is a workspace member": the `packages:`
# parser, pnpm's glob semantics (a single `*` does not cross `/`, which
# `fnmatch` gets wrong) and the tracked-manifest listing. Reusing them keeps one
# definition. The trigger half reuses the pathspec parser and matcher of the
# guard that watches harness-checks.yml.
from test_dependabot_npm_coverage import (
    _glob_to_regex,
    _parse_workspace_globs,
    _tracked_package_jsons,
)
from test_harness_checks_paths_coverage import filter_covers_file, parse_pathspecs_block

REPO_ROOT = _harness.REPO_ROOT

# Module-level declarations of the files this guard reads. They are not
# decoration: `test_harness_checks_paths_coverage.py` collects module-level
# `REPO_ROOT / "…"` chains and fails when `harness-checks.yml` would not run for
# an edit to that file alone. Only the root manifest is visible to it, because
# that guard drops `codebase/**` as product paths. `TriggerCoverageTest` covers
# the app and package manifests.
ROOT_MANIFEST = REPO_ROOT / "package.json"
WORKSPACE_YAML = REPO_ROOT / "pnpm-workspace.yaml"
HARNESS_CHECKS = REPO_ROOT / ".github" / "workflows" / "harness-checks.yml"

_ROOT_MANIFEST_REL = ROOT_MANIFEST.relative_to(REPO_ROOT).as_posix()
DEP_SECTIONS = ("dependencies", "devDependencies", "optionalDependencies")
# Specs that are not registry versions: workspace links and local paths.
NON_REGISTRY = ("workspace:", "link:", "file:", "portal:")
VERSION_LITERAL = re.compile(r"\d+\.\d+(\.\d+)?")


def _workspace_manifests(tracked: list[str], globs: list[str]) -> list[str]:
    """Repo-relative manifests of the root plus every tracked workspace member.

    Matches a manifest's directory against each glob with pnpm semantics, as the
    sibling guard does. ``**`` therefore works. A ``!`` negation is not
    supported: it matches nothing, so a negated member stays checked, which is
    the safe direction. Only tracked files count, so a manifest not yet
    ``git add``-ed is not seen until it is.
    """
    patterns = [_glob_to_regex(g.rstrip("/")) for g in globs]
    found = [_ROOT_MANIFEST_REL]
    for manifest in tracked:
        if manifest == _ROOT_MANIFEST_REL:
            continue
        if any(p.match(manifest.rsplit("/", 1)[0]) for p in patterns):
            found.append(manifest)
    return found


def _repo_manifests() -> list[str]:
    """Manifests of this checkout, read from `pnpm-workspace.yaml` and `git ls-files`."""
    globs = _parse_workspace_globs(WORKSPACE_YAML.read_text(encoding="utf-8"))
    return _workspace_manifests(_tracked_package_jsons(), globs)


def _pinned(manifest: dict) -> dict[str, str]:
    """Registry dependencies whose spec is not caret, as {name: spec}."""
    out: dict[str, str] = {}
    for section in DEP_SECTIONS:
        for name, spec in (manifest.get(section) or {}).items():
            if spec.startswith("^") or spec.startswith(NON_REGISTRY):
                continue
            out[name] = spec
    return out


def _names(reason: str, name: str) -> bool:
    """Does ``reason`` contain ``name`` as a whole token, not inside a longer name?"""
    # A package name continues through ASCII word characters, `-`, `.`, `/` and a
    # leading `@`. Anything else ends it: a space, `·`, `,`, `(`, a closing `.`
    # and a Korean particle written right after the name (`three는`).
    pattern = rf"(?<![\w@/.-]){re.escape(name)}(?![\w/-])"
    return re.search(pattern, reason, flags=re.ASCII) is not None


def _pin_problems(manifest: dict) -> list[str]:
    """Policy (b) violations of one manifest, as messages."""
    reason = manifest.get("//pin", "")
    if not isinstance(reason, str):
        return [f"`//pin` must be a string, got {type(reason).__name__}"]
    found: list[str] = []
    for name, spec in sorted(_pinned(manifest).items()):
        if not _names(reason, name):
            found.append(f"`{name}` is pinned as {spec!r} but `//pin` gives no reason for it")
    for m in VERSION_LITERAL.finditer(reason):
        found.append(
            f"`//pin` quotes the version {m.group(0)!r}; "
            "dependabot moves the spec and leaves the comment stale"
        )
    return found


def _load(manifest_rel: str) -> dict:
    return json.loads((REPO_ROOT / manifest_rel).read_text(encoding="utf-8"))


class ClassifierTest(unittest.TestCase):
    def test_caret_and_workspace_specs_are_not_pins(self):
        manifest = {"dependencies": {"a": "^1.2.3", "b": "workspace:*", "c": "file:../c"}}
        self.assertEqual(_pinned(manifest), {})

    def test_link_and_portal_specs_are_not_pins(self):
        manifest = {"dependencies": {"a": "link:../a", "b": "portal:../b"}}
        self.assertEqual(_pinned(manifest), {})

    def test_exact_and_tilde_specs_are_pins(self):
        manifest = {"dependencies": {"a": "1.2.3"}, "devDependencies": {"b": "~0.4.1"}}
        self.assertEqual(_pinned(manifest), {"a": "1.2.3", "b": "~0.4.1"})

    def test_optional_dependencies_are_scanned(self):
        manifest = {"optionalDependencies": {"a": "1.2.3"}}
        self.assertEqual(_pinned(manifest), {"a": "1.2.3"})

    def test_peer_dependencies_are_not_scanned(self):
        """A peer range is what a consumer may bring, not a version this repo pins."""
        manifest = {"peerDependencies": {"a": "1.2.3", "b": ">=18"}}
        self.assertEqual(_pinned(manifest), {})

    def test_pin_without_reason_is_reported(self):
        manifest = {"dependencies": {"a": "1.2.3"}}
        self.assertEqual(len(_pin_problems(manifest)), 1)

    def test_pin_named_in_reason_passes(self):
        manifest = {"//pin": "a = sanitize path", "dependencies": {"a": "1.2.3"}}
        self.assertEqual(_pin_problems(manifest), [])

    def test_dot_joined_names_in_reason_pass(self):
        """The real frontend reason writes `react·react-dom`."""
        manifest = {
            "//pin": "react·react-dom = monorepo alignment",
            "dependencies": {"react": "1.0.0", "react-dom": "1.0.0"},
        }
        self.assertEqual(_pin_problems(manifest), [])

    def test_name_before_closing_punctuation_passes(self):
        manifest = {"//pin": "alignment of three.", "dependencies": {"three": "~1.0.0"}}
        self.assertEqual(_pin_problems(manifest), [])

    def test_name_followed_by_a_korean_particle_passes(self):
        manifest = {"//pin": "three는 0.x 라서 고정한다", "dependencies": {"three": "~1.0.0"}}
        self.assertEqual(_pin_problems(manifest), [])

    def test_a_longer_name_does_not_name_the_shorter_one(self):
        """`react-dom` in the reason must not stand in for `react`."""
        manifest = {
            "//pin": "react-dom = alignment",
            "dependencies": {"react": "19.0.0", "react-dom": "19.0.0"},
        }
        found = _pin_problems(manifest)
        self.assertEqual(len(found), 1, found)
        self.assertIn("`react` is pinned", found[0])

    def test_marked_does_not_name_mark(self):
        manifest = {"//pin": "marked = sanitize path", "dependencies": {"mark": "1.0.0"}}
        self.assertEqual(len(_pin_problems(manifest)), 1)

    def test_a_scoped_name_does_not_name_its_bare_suffix(self):
        manifest = {
            "//pin": "@radix-ui/react-focus-scope = parent alignment",
            "dependencies": {"react": "19.0.0", "@radix-ui/react-focus-scope": "1.0.0"},
        }
        found = _pin_problems(manifest)
        self.assertEqual(len(found), 1, found)
        self.assertIn("`react` is pinned", found[0])

    def test_a_longer_suffix_does_not_name_the_scoped_name(self):
        manifest = {
            "//pin": "@radix-ui/react-focus-scope-extra = alignment",
            "dependencies": {"@radix-ui/react-focus-scope": "1.0.0"},
        }
        self.assertEqual(len(_pin_problems(manifest)), 1)

    def test_a_types_package_does_not_name_the_runtime_package(self):
        manifest = {"//pin": "@types/three = typings", "dependencies": {"three": "~0.1.0"}}
        self.assertEqual(len(_pin_problems(manifest)), 1)

    def test_version_in_reason_is_reported(self):
        manifest = {"//pin": "a = monorepo alignment (19.2.4)", "dependencies": {"a": "1.2.3"}}
        found = _pin_problems(manifest)
        self.assertEqual(len(found), 1, found)
        self.assertIn("'19.2.4'", found[0])

    def test_a_reason_that_is_not_a_string_fails_with_a_message(self):
        manifest = {"//pin": ["a = sanitize path"], "dependencies": {"a": "1.2.3"}}
        found = _pin_problems(manifest)
        self.assertEqual(len(found), 1, found)
        self.assertIn("must be a string", found[0])


class WorkspaceManifestsTest(unittest.TestCase):
    """The member list is derived from globs and tracked files, so pin its edges."""

    TRACKED = [
        "package.json",
        "codebase/backend/package.json",
        "codebase/packages/sdk/package.json",
        "codebase/packages/sdk/vendor/thing/package.json",
        ".claude/tools/mermaid-lint/package.json",
    ]

    def test_the_root_manifest_is_always_included(self):
        self.assertEqual(_workspace_manifests(self.TRACKED, []), ["package.json"])

    def test_a_literal_glob_selects_that_directory(self):
        found = _workspace_manifests(self.TRACKED, ["codebase/backend"])
        self.assertEqual(found, ["package.json", "codebase/backend/package.json"])

    def test_a_single_star_does_not_cross_a_slash(self):
        found = _workspace_manifests(self.TRACKED, ["codebase/packages/*"])
        self.assertIn("codebase/packages/sdk/package.json", found)
        self.assertNotIn("codebase/packages/sdk/vendor/thing/package.json", found)

    def test_a_double_star_reaches_nested_members(self):
        found = _workspace_manifests(self.TRACKED, ["codebase/packages/**"])
        self.assertIn("codebase/packages/sdk/vendor/thing/package.json", found)

    def test_a_trailing_slash_is_ignored(self):
        found = _workspace_manifests(self.TRACKED, ["codebase/backend/"])
        self.assertIn("codebase/backend/package.json", found)

    def test_a_tree_outside_every_glob_is_not_a_member(self):
        found = _workspace_manifests(self.TRACKED, ["codebase/backend", "codebase/packages/*"])
        self.assertNotIn(".claude/tools/mermaid-lint/package.json", found)

    def test_a_negated_glob_does_not_exclude_a_member(self):
        """`!` is unsupported. The member stays checked, which is the safe direction."""
        found = _workspace_manifests(self.TRACKED, ["codebase/packages/*", "!codebase/packages/sdk"])
        self.assertIn("codebase/packages/sdk/package.json", found)


class RealRepoTest(unittest.TestCase):
    def test_known_manifests_are_found(self):
        # Vacuity guard. A broken glob reader would pass every manifest by finding
        # none, and a partial match would drop one app without any count moving.
        found = set(_repo_manifests())
        for expected in (
            "package.json",
            "codebase/backend/package.json",
            "codebase/frontend/package.json",
            "codebase/channel-web-chat/package.json",
        ):
            self.assertIn(expected, found, f"workspace manifests found: {sorted(found)}")

    def test_known_pins_are_found(self):
        # Same guard for the pin classifier. These were pins on 2026-10-04. If one
        # is relaxed to caret on purpose, replace it with another real pin.
        names: set[str] = set()
        for rel in _repo_manifests():
            names |= set(_pinned(_load(rel)))
        for expected in ("dompurify", "three", "jsonwebtoken"):
            self.assertIn(expected, names, f"pinned names found: {sorted(names)}")

    def test_every_pin_has_a_reason(self):
        failures: list[str] = []
        for rel in _repo_manifests():
            for problem in _pin_problems(_load(rel)):
                failures.append(f"{rel}: {problem}")
        self.assertEqual(failures, [], "\n".join(failures))


class TriggerCoverageTest(unittest.TestCase):
    """`harness-checks.yml` must run for a PR that edits only a manifest.

    A pin without a reason is added by editing `package.json` alone, and so is
    deleting the `//pin` field. If no pathspec matches, the `unittest` job is a
    no-op for exactly that PR and this whole guard never runs. This repo has hit
    that class six times (`test_harness_checks_paths_coverage.py`).
    """

    @classmethod
    def setUpClass(cls):
        cls.filters = parse_pathspecs_block(HARNESS_CHECKS.read_text(encoding="utf-8"))

    def _uncovered(self, paths: list[str]) -> list[str]:
        return [p for p in paths if not any(filter_covers_file(f, p) for f in self.filters)]

    def test_pathspecs_cover_every_manifest_the_guard_reads(self):
        uncovered = self._uncovered(_repo_manifests())
        self.assertEqual(
            uncovered, [],
            "harness-checks.yml does not run for an edit to only these manifests, "
            "but test_package_pin_reasons.py reads each of them:\n  "
            + "\n  ".join(uncovered)
            + "\nAdd a covering entry to the `changes` job's `pathspecs:`.",
        )

    def test_pathspecs_cover_the_workspace_definition(self):
        """Changing which packages are members changes what this guard reads."""
        self.assertEqual(self._uncovered([WORKSPACE_YAML.name]), [])

    def test_the_check_is_not_vacuous(self):
        """The matcher rejects a path that no entry covers, and the list was read."""
        self.assertGreater(len(self.filters), 0)
        self.assertEqual(
            self._uncovered(["codebase/backend/src/main.ts"]),
            ["codebase/backend/src/main.ts"],
        )


if __name__ == "__main__":
    unittest.main()
