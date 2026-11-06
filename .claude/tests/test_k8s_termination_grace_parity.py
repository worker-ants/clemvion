"""Guard: the backend pod's `terminationGracePeriodSeconds` follows `SIGTERM_GRACE_MS`.

Why this exists — CLE-T-XB6J60 (2026-11-06). On SIGTERM the backend refuses new
executions and waits up to `SIGTERM_GRACE_MS` for in-flight node executions,
then marks what is left `failed` + `SERVER_INTERRUPTED` (CLE-EXEC-RECOVERY
「안전 종료」). Kubernetes sends SIGKILL once `terminationGracePeriodSeconds`
has passed. The manifests set neither value, so both were 30 seconds and the
pod could be killed before the backend finished marking the interrupted rows.
CLE-EXEC-RECOVERY's environment table fixes the relation:

    terminationGracePeriodSeconds = ceil(SIGTERM_GRACE_MS / 1000) + 5

The two values live in different files (`k8s/base/configmap.yaml` and
`k8s/base/backend-deployment.yaml`) and an overlay may patch either one alone.
Nothing fails at runtime when they drift — the pod just gets SIGKILL early — so
this test is the only place the drift is visible.

What it checks, read with a YAML parser:

  1. the base ConfigMap `backend-config` declares `SIGTERM_GRACE_MS` as a
     positive integer string;
  2. the base Deployment `backend` sets `terminationGracePeriodSeconds` by the
     formula above;
  3. for every overlay under `k8s/overlays/`, the EFFECTIVE pair (overlay value
     if the overlay sets one, else the base value) still follows the formula.

Scope of (3) — narrower than "any kustomize overlay". It understands the patch
forms this repository uses today: a YAML file in the overlay directory that is
itself a `ConfigMap backend-config` or `Deployment backend` (strategic merge),
and inline `patches[].patch` strings in `kustomization.yaml` that are either a
strategic-merge document or a JSON6902 op list whose `target` names the
resource. A form it does not understand (a `configMapGenerator` literal, a
remote base, a component) is not parsed. To keep that from passing silently, an
overlay whose non-comment lines mention either key but yields no parsed value
for it fails with "unrecognized form".
"""
from __future__ import annotations

import math
import unittest

import yaml

from _harness import REPO_ROOT

BACKEND_DEPLOYMENT = REPO_ROOT / "k8s" / "base" / "backend-deployment.yaml"
BASE_CONFIGMAP = REPO_ROOT / "k8s" / "base" / "configmap.yaml"
OVERLAYS_DIR = REPO_ROOT / "k8s" / "overlays"

GRACE_KEY = "SIGTERM_GRACE_MS"
TERMINATION_KEY = "terminationGracePeriodSeconds"
DRAIN_MARGIN_SECONDS = 5

CONFIGMAP = ("ConfigMap", "backend-config")
DEPLOYMENT = ("Deployment", "backend")
GRACE_OP_PATH = f"/data/{GRACE_KEY}"
TERMINATION_OP_PATH = f"/spec/template/spec/{TERMINATION_KEY}"


class ManifestShapeError(AssertionError):
    """A value is missing or malformed — named, so the failure says where."""


def expected_termination_seconds(grace_ms: int) -> int:
    return math.ceil(grace_ms / 1000) + DRAIN_MARGIN_SECONDS


def _dig(obj: object, *keys: str) -> dict:
    node = obj
    for key in keys:
        node = node.get(key) if isinstance(node, dict) else None
    return node if isinstance(node, dict) else {}


def _identity(doc: dict) -> tuple[object, object]:
    return doc.get("kind"), _dig(doc, "metadata").get("name")


def parse_grace_ms(value: object, where: str) -> int:
    """ConfigMap data values are strings. Accept only a plain positive integer
    string — `"30_000"`, `"30s"` or a YAML int would be read differently by the
    backend's `Number(...)` or rejected by the API server."""
    if not isinstance(value, str) or not value.isdigit() or int(value) <= 0:
        raise ManifestShapeError(f"{where}: {GRACE_KEY} must be a positive integer string, got {value!r}")
    return int(value)


def parse_termination_seconds(value: object, where: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ManifestShapeError(f"{where}: {TERMINATION_KEY} must be a positive integer, got {value!r}")
    return value


def values_from_document(doc: object) -> tuple[object | None, object | None]:
    """(grace, termination) set by one strategic-merge style document."""
    if not isinstance(doc, dict):
        return None, None
    ident = _identity(doc)
    grace = _dig(doc, "data").get(GRACE_KEY) if ident == CONFIGMAP else None
    termination = (
        _dig(doc, "spec", "template", "spec").get(TERMINATION_KEY) if ident == DEPLOYMENT else None
    )
    return grace, termination


def values_from_json6902(ops: list, target: dict) -> tuple[object | None, object | None]:
    ident = (target.get("kind"), target.get("name"))
    grace = termination = None
    for op in ops:
        if not isinstance(op, dict) or op.get("op") not in ("add", "replace"):
            continue
        if ident == CONFIGMAP and op.get("path") == GRACE_OP_PATH:
            grace = op.get("value")
        if ident == DEPLOYMENT and op.get("path") == TERMINATION_OP_PATH:
            termination = op.get("value")
    return grace, termination


def overlay_values(files: dict[str, str]) -> tuple[object | None, object | None]:
    """(grace, termination) an overlay sets, or None where it sets nothing.

    `files` maps a file name in the overlay directory to its text."""
    grace = termination = None

    def take(pair: tuple[object | None, object | None]) -> None:
        nonlocal grace, termination
        if pair[0] is not None:
            grace = pair[0]
        if pair[1] is not None:
            termination = pair[1]

    for name, text in sorted(files.items()):
        docs = list(yaml.safe_load_all(text))
        if name == "kustomization.yaml":
            for kustomization in docs:
                patches = kustomization.get("patches") if isinstance(kustomization, dict) else None
                for entry in patches or []:
                    if not isinstance(entry, dict) or not isinstance(entry.get("patch"), str):
                        continue
                    patch = yaml.safe_load(entry["patch"])
                    if isinstance(patch, list):
                        take(values_from_json6902(patch, _dig(entry, "target")))
                    else:
                        take(values_from_document(patch))
            continue
        for doc in docs:
            take(values_from_document(doc))
    return grace, termination


def mentions(files: dict[str, str], key: str) -> bool:
    return any(
        key in line
        for text in files.values()
        for line in text.splitlines()
        if not line.lstrip().startswith("#")
    )


def base_values() -> tuple[int, int]:
    grace = termination = None
    for doc in yaml.safe_load_all(BASE_CONFIGMAP.read_text(encoding="utf-8")):
        g, _ = values_from_document(doc)
        grace = g if g is not None else grace
    for doc in yaml.safe_load_all(BACKEND_DEPLOYMENT.read_text(encoding="utf-8")):
        _, t = values_from_document(doc)
        termination = t if t is not None else termination
    if grace is None:
        raise ManifestShapeError(f"k8s/base/configmap.yaml: ConfigMap backend-config has no {GRACE_KEY}")
    if termination is None:
        raise ManifestShapeError(f"k8s/base/backend-deployment.yaml: Deployment backend has no {TERMINATION_KEY}")
    return (
        parse_grace_ms(grace, "k8s/base/configmap.yaml"),
        parse_termination_seconds(termination, "k8s/base/backend-deployment.yaml"),
    )


def overlay_files() -> dict[str, dict[str, str]]:
    found: dict[str, dict[str, str]] = {}
    for directory in sorted(p for p in OVERLAYS_DIR.iterdir() if p.is_dir()):
        found[directory.name] = {
            f.name: f.read_text(encoding="utf-8")
            for f in sorted([*directory.glob("*.yaml"), *directory.glob("*.yml")])
        }
    return found


class ExtractorBoundaryTest(unittest.TestCase):
    """Pin the extractors on injected text before trusting them on real files."""

    def test_formula(self):
        self.assertEqual(expected_termination_seconds(30000), 35)
        self.assertEqual(expected_termination_seconds(30001), 36)
        self.assertEqual(expected_termination_seconds(1), 6)

    def test_grace_must_be_positive_integer_string(self):
        for bad in (30000, "30_000", "30s", "", "0", None):
            with self.subTest(bad=bad), self.assertRaises(ManifestShapeError):
                parse_grace_ms(bad, "x")
        self.assertEqual(parse_grace_ms("45000", "x"), 45000)

    def test_termination_must_be_positive_integer(self):
        for bad in ("35", 0, -1, True, None, 35.0):
            with self.subTest(bad=bad), self.assertRaises(ManifestShapeError):
                parse_termination_seconds(bad, "x")

    def test_strategic_merge_file(self):
        text = (
            "apiVersion: v1\nkind: ConfigMap\nmetadata: {name: backend-config}\n"
            f"data: {{{GRACE_KEY}: '60000'}}\n---\n"
            "apiVersion: apps/v1\nkind: Deployment\nmetadata: {name: backend}\n"
            f"spec: {{template: {{spec: {{{TERMINATION_KEY}: 65}}}}}}\n"
        )
        self.assertEqual(overlay_values({"patch.yaml": text}), ("60000", 65))

    def test_other_resource_is_ignored(self):
        text = f"kind: ConfigMap\nmetadata: {{name: frontend-config}}\ndata: {{{GRACE_KEY}: '1'}}\n"
        self.assertEqual(overlay_values({"patch.yaml": text}), (None, None))

    def test_inline_json6902_needs_matching_target(self):
        kustomization = (
            "patches:\n"
            "  - patch: |\n"
            f"      - op: replace\n        path: {GRACE_OP_PATH}\n        value: '60000'\n"
            "    target: {kind: ConfigMap, name: backend-config}\n"
            "  - patch: |\n"
            f"      - op: add\n        path: {TERMINATION_OP_PATH}\n        value: 65\n"
            "    target: {kind: Deployment, name: backend}\n"
            "  - patch: |\n"
            f"      - op: replace\n        path: {GRACE_OP_PATH}\n        value: '1'\n"
            "    target: {kind: ConfigMap, name: frontend-config}\n"
        )
        self.assertEqual(overlay_values({"kustomization.yaml": kustomization}), ("60000", 65))

    def test_inline_strategic_merge(self):
        kustomization = (
            "patches:\n"
            "  - patch: |\n"
            "      kind: ConfigMap\n      metadata: {name: backend-config}\n"
            f"      data: {{{GRACE_KEY}: '60000'}}\n"
        )
        self.assertEqual(overlay_values({"kustomization.yaml": kustomization}), ("60000", None))

    def test_mentions_skips_comment_lines(self):
        self.assertFalse(mentions({"a.yaml": f"# {GRACE_KEY} is set in base\n"}, GRACE_KEY))
        self.assertTrue(mentions({"a.yaml": f"  - {GRACE_KEY}=60000\n"}, GRACE_KEY))


class TerminationGraceParityTest(unittest.TestCase):

    def test_base_pair_follows_formula(self):
        grace_ms, termination = base_values()
        self.assertEqual(
            termination,
            expected_termination_seconds(grace_ms),
            f"k8s/base: {TERMINATION_KEY}={termination} but {GRACE_KEY}={grace_ms} "
            f"needs ceil({grace_ms}/1000)+{DRAIN_MARGIN_SECONDS}",
        )

    def test_overlay_list_is_not_empty(self):
        # An empty list would make the per-overlay loop below pass vacuously.
        self.assertGreaterEqual(len(overlay_files()), 3)

    def test_each_overlay_effective_pair_follows_formula(self):
        base_grace, base_termination = base_values()
        for overlay, files in overlay_files().items():
            with self.subTest(overlay=overlay):
                grace, termination = overlay_values(files)
                for key, value in ((GRACE_KEY, grace), (TERMINATION_KEY, termination)):
                    if value is None and mentions(files, key):
                        self.fail(f"k8s/overlays/{overlay}: mentions {key} in an unrecognized form")
                grace_ms = (
                    base_grace if grace is None else parse_grace_ms(grace, f"k8s/overlays/{overlay}")
                )
                seconds = (
                    base_termination
                    if termination is None
                    else parse_termination_seconds(termination, f"k8s/overlays/{overlay}")
                )
                self.assertEqual(
                    seconds,
                    expected_termination_seconds(grace_ms),
                    f"k8s/overlays/{overlay}: effective {TERMINATION_KEY}={seconds} but "
                    f"{GRACE_KEY}={grace_ms} needs ceil({grace_ms}/1000)+{DRAIN_MARGIN_SECONDS}. "
                    "Patch both values together.",
                )


if __name__ == "__main__":
    unittest.main()
