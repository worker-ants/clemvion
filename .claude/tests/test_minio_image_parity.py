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


def pin_violation(image: str) -> str | None:
    """Why `image` is not an acceptable pin, or None. A predicate (not inline
    asserts) so its rejections can be pinned on injected text — the real files
    all pass, so a check that only ever runs on them proves nothing."""
    m = _PINNED.match(image)
    if m is None:
        return "not name:tag@sha256:<64 hex>"
    if m.group("tag") == "latest":
        return "tag is latest"
    return None


def is_distroless(image: str) -> bool:
    return "distroless" in image


class PlaceNotFound(AssertionError):
    """A declared image place is missing — named, so the failure says where."""


def _mapping(value: object) -> dict:
    """`value` if it is a mapping, else an empty one — so a malformed shape (a
    list where a mapping belongs) surfaces as `PlaceNotFound` naming the place,
    not as a bare `AttributeError`."""
    return value if isinstance(value, dict) else {}


def compose_images(label: str, text: str) -> dict[str, str]:
    services = _mapping(_mapping(yaml.safe_load(text)).get("services"))
    found: dict[str, str] = {}
    for svc in COMPOSE_SERVICES:
        image = _mapping(services.get(svc)).get("image")
        if not isinstance(image, str) or not image:
            raise PlaceNotFound(f"{label}: services.{svc}.image not found")
        found[f"{label} services.{svc}"] = image
    return found


def k8s_images(label: str, text: str) -> dict[str, str]:
    """Exactly one resource per (kind, name), and exactly one container of the
    declared name in it: zero AND duplicates fail at BOTH levels by naming the
    place — a duplicate would leave it ambiguous which image runs."""
    docs = [d for d in yaml.safe_load_all(text) if isinstance(d, dict)]
    found: dict[str, str] = {}
    for kind, name, container in K8S_PLACES:
        matches = [
            d for d in docs
            if d.get("kind") == kind and _mapping(d.get("metadata")).get("name") == name
        ]
        if len(matches) != 1:
            raise PlaceNotFound(f"{label}: expected one {kind}/{name}, found {len(matches)}")
        pod_template = _mapping(_mapping(matches[0].get("spec")).get("template"))
        containers = _mapping(pod_template.get("spec")).get("containers") or []
        # Same "exactly one" rule one level in: a duplicate container name
        # would otherwise let a single image be picked silently.
        named = [c for c in containers if isinstance(c, dict) and c.get("name") == container]
        if len(named) != 1:
            raise PlaceNotFound(
                f"{label}: expected one container {container!r} in {kind}/{name}, found {len(named)}"
            )
        image = named[0].get("image")
        if not isinstance(image, str) or not image:
            raise PlaceNotFound(f"{label}: {kind}/{name} container {container!r} image not found")
        found[f"{label} {kind}/{name}:{container}"] = image
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

    @staticmethod
    def _k8s(job_containers: str) -> str:
        """A valid StatefulSet plus a Job whose `containers` list is given."""
        return (
            "kind: StatefulSet\nmetadata: {name: minio}\n"
            "spec: {template: {spec: {containers: [{name: minio, image: a}]}}}\n---\n"
            "kind: Job\nmetadata: {name: minio-create-bucket}\n"
            f"spec: {{template: {{spec: {{containers: {job_containers}}}}}}}\n"
        )

    def test_k8s_missing_container_is_named(self):
        with self.assertRaisesRegex(
            PlaceNotFound, r"expected one container 'mc' in Job/minio-create-bucket, found 0"
        ):
            k8s_images("k.yaml", self._k8s("[{name: other, image: a}]"))

    def test_k8s_duplicate_container_is_named(self):
        with self.assertRaisesRegex(
            PlaceNotFound, r"expected one container 'mc' in Job/minio-create-bucket, found 2"
        ):
            k8s_images("k.yaml", self._k8s("[{name: mc, image: a}, {name: mc, image: b}]"))

    def test_k8s_container_without_image_is_named(self):
        with self.assertRaisesRegex(
            PlaceNotFound, r"Job/minio-create-bucket container 'mc' image not found"
        ):
            k8s_images("k.yaml", self._k8s("[{name: mc}]"))

    def test_k8s_fixture_helper_is_valid(self):
        # Guards the helper itself: with a proper Job it must extract both places,
        # otherwise the three tests above could pass on a broken fixture.
        images = k8s_images("k.yaml", self._k8s("[{name: mc, image: a}]"))
        self.assertEqual(len(images), 2)

    def test_k8s_duplicate_resource_is_named(self):
        sts = (
            "kind: StatefulSet\nmetadata: {name: minio}\n"
            "spec: {template: {spec: {containers: [{name: minio, image: a}]}}}\n"
        )
        job = (
            "kind: Job\nmetadata: {name: minio-create-bucket}\n"
            "spec: {template: {spec: {containers: [{name: mc, image: a}]}}}\n"
        )
        with self.assertRaisesRegex(PlaceNotFound, r"expected one StatefulSet/minio, found 2"):
            k8s_images("k.yaml", sts + "---\n" + sts + "---\n" + job)

    def test_compose_malformed_service_is_named_not_attribute_error(self):
        # A sequence where the service mapping belongs — a YAML typo shape.
        text = "services:\n  minio:\n    - image: a\n  createbuckets:\n    image: a\n"
        with self.assertRaisesRegex(PlaceNotFound, r"services\.minio\.image"):
            compose_images("x.yml", text)

    def test_k8s_missing_resource_is_named(self):
        sts_only = (
            "kind: StatefulSet\nmetadata: {name: minio}\n"
            "spec: {template: {spec: {containers: [{name: minio, image: a}]}}}\n"
        )
        with self.assertRaisesRegex(PlaceNotFound, r"expected one Job/minio-create-bucket, found 0"):
            k8s_images("k.yaml", sts_only)

    def test_empty_image_string_is_named(self):
        with self.subTest(where="compose"):
            text = "services:\n  minio:\n    image: ''\n  createbuckets:\n    image: a\n"
            with self.assertRaisesRegex(PlaceNotFound, r"services\.minio\.image"):
                compose_images("x.yml", text)
        with self.subTest(where="k8s"):
            with self.assertRaisesRegex(PlaceNotFound, r"container 'mc' image not found"):
                k8s_images("k.yaml", self._k8s("[{name: mc, image: ''}]"))

    def test_pin_violation_edges(self):
        digest = "@sha256:" + "a" * 64
        self.assertIsNone(pin_violation("pgsty/silo:RELEASE.2026-09-16T00-00-00Z" + digest))
        for bad, why in (
            ("pgsty/silo:RELEASE.2026-09-16T00-00-00Z", "not name:tag"),  # no digest
            ("pgsty/silo" + digest, "not name:tag"),                       # digest only, no tag
            ("pgsty/silo:x@sha256:" + "a" * 63, "not name:tag"),           # short digest
            ("pgsty/silo:latest" + digest, "latest"),                      # pinned, but latest
        ):
            with self.subTest(image=bad):
                self.assertRegex(pin_violation(bad) or "", why)

    def test_distroless_is_detected(self):
        digest = "@sha256:" + "a" * 64
        self.assertTrue(is_distroless("pgsty/silo:RELEASE.2026-09-16T00-00-00Z-distroless" + digest))
        self.assertFalse(is_distroless("pgsty/silo:RELEASE.2026-09-16T00-00-00Z" + digest))


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
                why = pin_violation(image)
                self.assertIsNone(why, f"{place}: {why} — {image}")

    def test_no_distroless_variant(self):
        for place, image in self.images.items():
            with self.subTest(place=place):
                self.assertFalse(
                    is_distroless(image),
                    f"{place}: distroless has no curl; the compose healthchecks need it — {image}",
                )


if __name__ == "__main__":
    unittest.main()
