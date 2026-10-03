"""Every non-caret dependency in a workspace manifest has a written reason.

PROJECT.md §버전 핀 정책: (a) declarations default to caret, (b) an exact or
tilde pin needs a reason in the adjacent ``"//pin"`` field, (c) a pin without a
reason is relaxed to caret. Nothing enforced (b) or (c): on 2026-10-02 a full
sweep found three exact pins whose manifest gave no reason
(``jsonwebtoken`` · ``@radix-ui/react-focus-scope`` · ``eslint-config-next``),
and two ``"//pin"`` texts quoted versions that dependabot had already moved
(``three ~0.184.0`` · ``react 19.2.4``). NERV Task ``CLE-T-BZ0AK9``.

So this checks, for the root manifest and every package that
``pnpm-workspace.yaml`` lists:

* each dependency whose spec is not caret is named in that manifest's
  ``"//pin"``;
* ``"//pin"`` quotes no version numbers. Dependabot bumps the spec, not the
  comment, so a quoted version goes stale on the next update (the second
  finding above).
"""

from __future__ import annotations

import fnmatch
import json
import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DEP_SECTIONS = ("dependencies", "devDependencies", "optionalDependencies")
# Specs that are not registry versions: workspace links and local paths.
NON_REGISTRY = ("workspace:", "link:", "file:", "portal:")
VERSION_LITERAL = re.compile(r"\d+\.\d+(\.\d+)?")


def workspace_globs(text: str) -> list[str]:
    """The ``packages:`` list of pnpm-workspace.yaml (block list of quoted globs)."""
    globs: list[str] = []
    in_packages = False
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line.startswith((" ", "-")):
            in_packages = line.rstrip() == "packages:"
            continue
        if in_packages:
            m = re.match(r"\s*-\s*[\"']?([^\"'#]+?)[\"']?\s*(#.*)?$", line)
            if m:
                globs.append(m.group(1).strip())
    return globs


def manifest_paths(root: Path) -> list[Path]:
    paths = [root / "package.json"]
    for glob in workspace_globs((root / "pnpm-workspace.yaml").read_text()):
        if "*" in glob:
            parent = root / glob.split("*", 1)[0]
            for child in sorted(parent.iterdir()) if parent.is_dir() else []:
                rel = child.relative_to(root).as_posix()
                if fnmatch.fnmatch(rel, glob) and (child / "package.json").is_file():
                    paths.append(child / "package.json")
        elif (root / glob / "package.json").is_file():
            paths.append(root / glob / "package.json")
    return paths


def pinned(manifest: dict) -> dict[str, str]:
    """Registry dependencies whose spec is not caret, as {name: spec}."""
    out: dict[str, str] = {}
    for section in DEP_SECTIONS:
        for name, spec in (manifest.get(section) or {}).items():
            if spec.startswith("^") or spec.startswith(NON_REGISTRY):
                continue
            out[name] = spec
    return out


def problems(manifest: dict) -> list[str]:
    reason = manifest.get("//pin", "")
    found: list[str] = []
    for name, spec in sorted(pinned(manifest).items()):
        if name not in reason:
            found.append(f"`{name}` is pinned as {spec!r} but `//pin` gives no reason for it")
    for m in VERSION_LITERAL.finditer(reason):
        found.append(f"`//pin` quotes the version {m.group(0)!r}; dependabot moves the spec and leaves the comment stale")
    return found


class ClassifierTest(unittest.TestCase):
    def test_caret_and_workspace_specs_are_not_pins(self):
        manifest = {"dependencies": {"a": "^1.2.3", "b": "workspace:*", "c": "file:../c"}}
        self.assertEqual(pinned(manifest), {})

    def test_exact_and_tilde_specs_are_pins(self):
        manifest = {"dependencies": {"a": "1.2.3"}, "devDependencies": {"b": "~0.4.1"}}
        self.assertEqual(pinned(manifest), {"a": "1.2.3", "b": "~0.4.1"})

    def test_pin_without_reason_is_reported(self):
        manifest = {"dependencies": {"a": "1.2.3"}}
        self.assertEqual(len(problems(manifest)), 1)

    def test_pin_named_in_reason_passes(self):
        manifest = {"//pin": "a = sanitize path", "dependencies": {"a": "1.2.3"}}
        self.assertEqual(problems(manifest), [])

    def test_version_in_reason_is_reported(self):
        manifest = {"//pin": "a = monorepo alignment (19.2.4)", "dependencies": {"a": "1.2.3"}}
        self.assertEqual(len(problems(manifest)), 1)

    def test_workspace_globs_reads_block_list(self):
        text = '# c\npackages:\n  - "codebase/backend"\n  - "codebase/packages/*"\n\ninjectWorkspacePackages: true\n'
        self.assertEqual(workspace_globs(text), ["codebase/backend", "codebase/packages/*"])


class RealRepoTest(unittest.TestCase):
    def test_manifests_are_found(self):
        # Vacuity floor: a broken glob reader would pass every manifest by finding none.
        paths = manifest_paths(REPO_ROOT)
        self.assertGreaterEqual(len(paths), 6, paths)  # 2026-10-03: root + 3 apps + 8 packages

    def test_pins_are_found(self):
        total = sum(len(pinned(json.loads(p.read_text()))) for p in manifest_paths(REPO_ROOT))
        self.assertGreaterEqual(total, 5)  # 2026-10-03: 9 pins after this task

    def test_every_pin_has_a_reason(self):
        failures: list[str] = []
        for path in manifest_paths(REPO_ROOT):
            for problem in problems(json.loads(path.read_text())):
                failures.append(f"{path.relative_to(REPO_ROOT)}: {problem}")
        self.assertEqual(failures, [], "\n".join(failures))


if __name__ == "__main__":
    unittest.main()
