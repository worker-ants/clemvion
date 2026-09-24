"""Guard: the six MinIO-family image references agree, and each is pinned.

Why this exists — 2026-09-25. The object store's image string is written by
hand in SIX places across three files that cannot share a variable (compose and
kustomize have no common substitution):

  docker-compose.yml       services.minio · services.createbuckets
  docker-compose.e2e.yml   services.minio · services.createbuckets
  k8s/overlays/local/infra-minio.yaml
                           StatefulSet `minio` container `minio`
                           Job `minio-create-bucket` container `mc`

Partial updates are not hypothetical. `#1325` (Docker Hub → quay.io) fixed the
two compose files and missed both k8s places; review caught it. `#1392`
(quay.io → `pgsty/silo`) then put ONE `name:tag@digest` string in all six and
pinned the k8s pair that had been `:latest`. Nothing checked that they stay one
string — reported by `/ai-review` `review/code/2026/09/24/23_33_07` INFO 3.

The files are read with a YAML PARSER, not a regex over `image:` lines: YAML has
a real grammar and a canonical parser, and PyYAML is the one dependency the
harness CI installs (`harness-checks.yml` header). Each assertion names one
regression shape so a failure says which:

  1. the DECLARED place list stays at six — shrinking it (dropping a place
     from `COMPOSE_SERVICES` / `K8S_PLACES`) would make "all agree" easier to
     pass. A place missing from a FILE (renamed service or container) is
     caught earlier: the extractors raise `PlaceNotFound` naming it, so every
     assertion below fails with that name instead of "zero images all agree"
     passing;
  2. the six values are identical;
  3. each is pinned by tag AND digest, and the tag is not `latest` (W-59, and
     Docker Hub tags are mutable);
  4. none is a `-distroless` tag — the compose healthchecks run `curl` inside
     the image, and the distroless variant has none (`#1392`, measured).

Trigger: the three paths below are module-level constants, so
`test_harness_checks_paths_coverage.py` requires each in `harness-checks.yml`'s
pathspecs. Without them a compose-only PR would skip this suite — the
"a guard's data does not trigger the guard" class `#1390` closed for the docs
guards.

Scope is the places that exist TODAY. A new manifest that runs the object store
(`plan/in-progress/self-hosting-deployment.md` plans a production compose file
and a Helm chart) must be added to the place lists below AND to the pathspecs —
this guard cannot discover a file it was never told about.
"""
from __future__ import annotations

import re
import unittest

import yaml

from _harness import REPO_ROOT

DEV_COMPOSE = REPO_ROOT / "docker-compose.yml"
E2E_COMPOSE = REPO_ROOT / "docker-compose.e2e.yml"
K8S_MINIO = REPO_ROOT / "k8s" / "overlays" / "local" / "infra-minio.yaml"

# (kind, metadata.name, container name) for the k8s documents.
K8S_PLACES = (
    ("StatefulSet", "minio", "minio"),
    ("Job", "minio-create-bucket", "mc"),
)
COMPOSE_SERVICES = ("minio", "createbuckets")

# name:tag@sha256:<64 hex>. The name excludes ':' and '@', so a digest-only
# reference (name@sha256:…) has no tag and does not satisfy "tag AND digest".
_PINNED = re.compile(r"^[^:@\s]+:(?P<tag>[^@\s]+)@sha256:[0-9a-f]{64}$")


class PlaceNotFound(AssertionError):
    """A declared image place is missing — named, so the failure says where."""


def compose_images(label: str, text: str) -> dict[str, str]:
    doc = yaml.safe_load(text) or {}
    services = doc.get("services") or {}
    found: dict[str, str] = {}
    for svc in COMPOSE_SERVICES:
        image = (services.get(svc) or {}).get("image")
        if not isinstance(image, str) or not image:
            raise PlaceNotFound(f"{label}: services.{svc}.image not found")
        found[f"{label} services.{svc}"] = image
    return found


def k8s_images(label: str, text: str) -> dict[str, str]:
    docs = [d for d in yaml.safe_load_all(text) if isinstance(d, dict)]
    found: dict[str, str] = {}
    for kind, name, container in K8S_PLACES:
        matches = [
            d for d in docs
            if d.get("kind") == kind and (d.get("metadata") or {}).get("name") == name
        ]
        if len(matches) != 1:
            raise PlaceNotFound(f"{label}: expected one {kind}/{name}, found {len(matches)}")
        containers = (
            ((matches[0].get("spec") or {}).get("template") or {}).get("spec") or {}
        ).get("containers") or []
        images = [c.get("image") for c in containers if c.get("name") == container]
        if len(images) != 1 or not isinstance(images[0], str) or not images[0]:
            raise PlaceNotFound(f"{label}: {kind}/{name} container {container!r} image not found")
        found[f"{label} {kind}/{name}:{container}"] = images[0]
    return found


def all_images() -> dict[str, str]:
    images: dict[str, str] = {}
    images.update(compose_images("docker-compose.yml", DEV_COMPOSE.read_text(encoding="utf-8")))
    images.update(compose_images("docker-compose.e2e.yml", E2E_COMPOSE.read_text(encoding="utf-8")))
    images.update(k8s_images("k8s/overlays/local/infra-minio.yaml", K8S_MINIO.read_text(encoding="utf-8")))
    return images


def _render(images: dict[str, str]) -> str:
    return "\n".join(f"  {place}: {image}" for place, image in sorted(images.items()))


class ExtractorBoundaryTest(unittest.TestCase):
    """Pin the extractors on injected text before trusting them on real files."""

    def test_compose_missing_service_is_named(self):
        text = "services:\n  minio:\n    image: a:1@sha256:" + "0" * 64 + "\n"
        with self.assertRaisesRegex(PlaceNotFound, r"services\.createbuckets\.image"):
            compose_images("x.yml", text)

    def test_k8s_missing_container_is_named(self):
        text = (
            "kind: StatefulSet\nmetadata: {name: minio}\n"
            "spec: {template: {spec: {containers: [{name: minio, image: a}]}}}\n---\n"
            "kind: Job\nmetadata: {name: minio-create-bucket}\n"
            "spec: {template: {spec: {containers: [{name: other, image: a}]}}}\n"
        )
        with self.assertRaisesRegex(PlaceNotFound, r"Job/minio-create-bucket container 'mc'"):
            k8s_images("k.yaml", text)

    def test_pinned_pattern_edges(self):
        digest = "@sha256:" + "a" * 64
        self.assertTrue(_PINNED.match("pgsty/silo:RELEASE.2026-09-16T00-00-00Z" + digest))
        self.assertIsNone(_PINNED.match("pgsty/silo:RELEASE.2026-09-16T00-00-00Z"))  # no digest
        self.assertIsNone(_PINNED.match("pgsty/silo" + digest))  # digest only, no tag
        self.assertIsNone(_PINNED.match("pgsty/silo:x@sha256:" + "a" * 63))  # short digest


class MinioImageParityTest(unittest.TestCase):
    def setUp(self):
        self.images = all_images()

    def test_all_six_places_found(self):
        self.assertEqual(len(self.images), 6, _render(self.images))

    def test_all_places_use_one_image(self):
        distinct = set(self.images.values())
        self.assertEqual(
            len(distinct), 1,
            "MinIO-family image differs between places — update all six together:\n"
            + _render(self.images),
        )

    def test_each_is_pinned_by_tag_and_digest(self):
        for place, image in self.images.items():
            with self.subTest(place=place):
                m = _PINNED.match(image)
                self.assertIsNotNone(m, f"{place}: not name:tag@sha256:<64hex> — {image}")
                self.assertNotEqual(m.group("tag"), "latest", f"{place}: tag is latest — {image}")

    def test_no_distroless_variant(self):
        for place, image in self.images.items():
            with self.subTest(place=place):
                self.assertNotIn(
                    "distroless", image,
                    f"{place}: distroless has no curl; the compose healthchecks need it — {image}",
                )


if __name__ == "__main__":
    unittest.main()
