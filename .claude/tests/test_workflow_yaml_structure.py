"""Guard: every `.github/workflows/*.yml` is structurally valid.

Why this exists — 2026-08-01. A PR added a `pip install` step to the
`harness-checks` unittest job and landed it **between the `name:` and `run:` of
the step below it**. YAML's answer to a duplicate key is not an error: the later
value silently wins. So the mapping parsed as

    {"name": "Run harness unit tests"}                  # no run/uses at all
    {"name": "Install PyYAML", "run": "python3 -m unittest ..."}   # pip install GONE

The install command vanished, and the step above became schema-invalid (a step
must have exactly one of `run`/`uses`). Nothing local catches this: the file is
never executed on a developer machine, `yaml.safe_load` accepts it, and the
whole suite stayed green. It surfaces only on GitHub Actions — after merge.

Two invariants, both cheap:

  1. **no duplicate keys** in any mapping. `yaml.safe_load` will not tell you,
     so this walks the parse tree with a loader that records collisions instead
     of dropping them.
  2. **every step has exactly one of `run`/`uses`**. Zero means the step was
     structurally absorbed into a neighbour (the failure above); two means the
     opposite mistake.

`DetectorTest` feeds the 2026-08-01 text itself to both checks. Without it,
a detector that silently stopped detecting would leave every other test in this
file passing — the exact shape of failure it is here to prevent.
"""

from __future__ import annotations

import unittest
from pathlib import Path

import yaml

from _harness import REPO_ROOT

WORKFLOW_DIR = REPO_ROOT / ".github" / "workflows"

# The step as it was actually committed on 2026-08-01, before the fix.
BROKEN_SAMPLE = """\
jobs:
  unittest:
    steps:
      - name: Run harness unit tests
      - name: Install PyYAML
        run: pip install "pyyaml>=6,<7"
        run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'
"""


def _duplicate_keys(text: str) -> list[str]:
    """Every mapping key that appears more than once, as `line N: key`.

    `yaml.safe_load` keeps the last value and reports nothing, so the collision
    has to be observed during construction rather than after it.
    """
    found: list[str] = []

    class _Loader(yaml.SafeLoader):
        pass

    def _mapping(loader, node, deep=False):
        seen = set()
        for key_node, _ in node.value:
            key = loader.construct_object(key_node, deep=deep)
            if key in seen:
                found.append(f"line {key_node.start_mark.line + 1}: {key!r}")
            seen.add(key)
        return yaml.SafeLoader.construct_mapping(loader, node, deep=deep)

    _Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)
    yaml.load(text, Loader=_Loader)
    return found


def _steps(doc: dict):
    """`(job_name, index, step)` for every step in the document."""
    for job_name, job in (doc.get("jobs") or {}).items():
        for i, step in enumerate(job.get("steps") or []):
            yield job_name, i, step


def _workflow_files() -> list[Path]:
    return sorted(
        p for p in WORKFLOW_DIR.glob("*.y*ml") if p.suffix in (".yml", ".yaml")
    )


class WorkflowStructureTest(unittest.TestCase):
    def setUp(self):
        self.files = _workflow_files()
        # A glob that quietly matches nothing would make every assertion below
        # vacuous — the suite would stay green with the directory deleted.
        self.assertTrue(self.files, f"no workflow files found under {WORKFLOW_DIR}")

    def test_no_duplicate_keys(self):
        for path in self.files:
            with self.subTest(workflow=path.name):
                dupes = _duplicate_keys(path.read_text(encoding="utf-8"))
                self.assertEqual(
                    dupes, [],
                    f"{path.name} has duplicate mapping keys. YAML keeps the LAST "
                    "value and drops the earlier one silently, so whatever the "
                    "first one said never runs. Usually this means a step was "
                    "inserted between a neighbour's `name:` and `run:`.",
                )

    def test_every_step_has_exactly_one_of_run_or_uses(self):
        for path in self.files:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for job, i, step in _steps(doc):
                with self.subTest(workflow=path.name, job=job, step=i):
                    present = [k for k in ("run", "uses") if k in step]
                    self.assertEqual(
                        len(present), 1,
                        f"{path.name} job `{job}` step #{i} "
                        f"({step.get('name', '<unnamed>')!r}) has {present or 'neither'} "
                        "— a step needs exactly one of `run`/`uses`. Zero usually "
                        "means an adjacent step swallowed its body.",
                    )


class DetectorTest(unittest.TestCase):
    """The checks above are only worth their green if they can go red."""

    def test_duplicate_key_detector_catches_the_2026_08_01_shape(self):
        dupes = _duplicate_keys(BROKEN_SAMPLE)
        self.assertTrue(dupes, "duplicate `run:` went unnoticed")
        self.assertIn("run", dupes[0])

    def test_safe_load_alone_would_have_missed_it(self):
        """Pins WHY the custom loader exists, not just that it works."""
        doc = yaml.safe_load(BROKEN_SAMPLE)
        step = doc["jobs"]["unittest"]["steps"][1]
        self.assertNotIn("pip install", step["run"])  # the later value won

    def test_run_or_uses_check_catches_the_2026_08_01_shape(self):
        doc = yaml.safe_load(BROKEN_SAMPLE)
        offenders = [
            (i, step) for _, i, step in _steps(doc)
            if len([k for k in ("run", "uses") if k in step]) != 1
        ]
        self.assertEqual([i for i, _ in offenders], [0])

    def test_clean_workflow_passes_both_checks(self):
        """A false positive here would red-light the repo permanently."""
        clean = (
            "jobs:\n  j:\n    steps:\n"
            "      - uses: actions/checkout@v7\n"
            "      - name: x\n        run: echo hi\n"
        )
        self.assertEqual(_duplicate_keys(clean), [])
        doc = yaml.safe_load(clean)
        for _, _, step in _steps(doc):
            self.assertEqual(len([k for k in ("run", "uses") if k in step]), 1)


if __name__ == "__main__":
    unittest.main()
