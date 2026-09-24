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

SHA256_HEX_LEN = 64

# [registry[:port]/]path/name:tag@sha256:<hex>. A tag can only follow the LAST
# path component, so earlier components may carry a ':' (a registry port) and
# the last may not. The first version split at the first ':' and read
# `registry:5000/x:latest` as tag "5000/x:latest" — missing `latest` entirely
# (`/ai-review` 00_56_30 W1). A digest-only reference (name@sha256:…) has no
# tag and fails. Lowercase hex only: the OCI image spec defines the sha256
# encoded portion as [a-f0-9]{64}. Matched with `fullmatch`, so a trailing
# newline cannot slip past a `$`.
_PINNED = re.compile(
    rf"(?:[^/@\s]+/)*[^/:@\s]+:(?P<tag>[^/:@\s]+)@sha256:[0-9a-f]{{{SHA256_HEX_LEN}}}"
)


def pin_violation(image: str) -> str | None:
    """Why `image` is not an acceptable pin, or None. A predicate (not inline
    asserts) so its rejections can be pinned on injected text — the real files
    all pass, so a check that only ever runs on them proves nothing."""
    m = _PINNED.fullmatch(image)
    if m is None:
        return "not name:tag@sha256:<64 hex>"
    if m.group("tag") == "latest":
        return "tag is latest"
    return None


def is_distroless(image: str) -> bool:
    return "distroless" in image


class PlaceNotFound(AssertionError):
    """A declared image place is missing — named, so the failure says where."""


# Each structural check lives in exactly ONE helper below, and each helper has
# its own boundary test. Four review rounds kept finding the same shape one
# place further in — resource-level duplicates, then container-level, then each
# `.get()` chain — because a copy of a check per place is a new untested branch
# per place. The extractors now only WIRE helpers; their own tests pin the wiring.

def _dig(obj: object, *keys: str) -> dict:
    """Walk mapping keys. Anything that is not a mapping on the way — a list
    where a mapping belongs, a scalar, a missing key — yields {}, so a malformed
    shape surfaces as `PlaceNotFound` naming the place, never `AttributeError`."""
    node = obj
    for key in keys:
        node = node.get(key) if isinstance(node, dict) else None
    return node if isinstance(node, dict) else {}


def _seq(value: object) -> list:
    """`value` if it is a list, else []. Same reason as `_dig`, for sequences."""
    return value if isinstance(value, list) else []


def _expect_one(items: list, label: str, what: str):
    """The single item, or `PlaceNotFound` for zero AND for duplicates — a
    duplicate would leave it ambiguous which image runs."""
    if len(items) != 1:
        raise PlaceNotFound(f"{label}: expected one {what}, found {len(items)}")
    return items[0]


def _image_value(value: object, place: str) -> str:
    """A non-empty string, or `PlaceNotFound`. `isinstance` rejects a truthy
    non-string (a number); the emptiness check rejects ''."""
    if not isinstance(value, str) or not value:
        raise PlaceNotFound(f"{place}: image not found")
    return value


def compose_images(label: str, text: str) -> dict[str, str]:
    services = _dig(yaml.safe_load(text), "services")
    found: dict[str, str] = {}
    for svc in COMPOSE_SERVICES:
        place = f"{label}: services.{svc}"
        found[place] = _image_value(_dig(services, svc).get("image"), place)
    return found


def k8s_images(label: str, text: str) -> dict[str, str]:
    """Exactly one resource per (kind, name), and exactly one container of the
    declared name in it — `_expect_one` at both levels."""
    docs = [d for d in yaml.safe_load_all(text) if isinstance(d, dict)]
    found: dict[str, str] = {}
    for kind, name, container in K8S_PLACES:
        resource = _expect_one(
            [d for d in docs if d.get("kind") == kind and _dig(d, "metadata").get("name") == name],
            label, f"{kind}/{name}",
        )
        containers = _seq(_dig(resource, "spec", "template", "spec").get("containers"))
        entry = _expect_one(
            [c for c in containers if isinstance(c, dict) and c.get("name") == container],
            label, f"container {container!r} in {kind}/{name}",
        )
        place = f"{label}: {kind}/{name} container {container!r}"
        found[place] = _image_value(entry.get("image"), place)
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
        text = "services:\n  minio:\n    image: a:1@sha256:" + "0" * SHA256_HEX_LEN + "\n"
        with self.assertRaisesRegex(PlaceNotFound, r"services\.createbuckets: image not found"):
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
            PlaceNotFound, r"Job/minio-create-bucket container 'mc': image not found"
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
        with self.assertRaisesRegex(PlaceNotFound, r"services\.minio: image not found"):
            compose_images("x.yml", text)

    def test_k8s_missing_resource_is_named(self):
        sts_only = (
            "kind: StatefulSet\nmetadata: {name: minio}\n"
            "spec: {template: {spec: {containers: [{name: minio, image: a}]}}}\n"
        )
        with self.assertRaisesRegex(PlaceNotFound, r"expected one Job/minio-create-bucket, found 0"):
            k8s_images("k.yaml", sts_only)

    def test_bad_image_value_is_named(self):
        # Two clauses guard the value: `not image` (empty) and `isinstance(str)`
        # (a truthy non-string such as a number). None is caught by both, so it
        # proves neither — each clause gets the value only IT rejects.
        for value in ("''", "5"):
            with self.subTest(where="compose", value=value):
                text = f"services:\n  minio:\n    image: {value}\n  createbuckets:\n    image: a\n"
                with self.assertRaisesRegex(PlaceNotFound, r"services\.minio: image not found"):
                    compose_images("x.yml", text)
            with self.subTest(where="k8s", value=value):
                with self.assertRaisesRegex(PlaceNotFound, r"container 'mc': image not found"):
                    k8s_images("k.yaml", self._k8s(f"[{{name: mc, image: {value}}}]"))

    def test_pin_violation_edges(self):
        digest = "@sha256:" + "a" * SHA256_HEX_LEN
        for good in (
            "pgsty/silo:RELEASE.2026-09-16T00-00-00Z" + digest,
            "registry.example:5000/pgsty/silo:RELEASE.2026-09-16T00-00-00Z" + digest,
        ):
            with self.subTest(good=good):
                self.assertIsNone(pin_violation(good))
        for bad, why in (
            ("pgsty/silo:RELEASE.2026-09-16T00-00-00Z", "not name:tag"),  # no digest
            ("pgsty/silo" + digest, "not name:tag"),                       # digest only, no tag
            ("registry.example:5000/pgsty/silo" + digest, "not name:tag"), # port is not a tag
            ("pgsty/silo:" + digest, "not name:tag"),                      # empty tag
            ("pgsty/silo:x@sha256:" + "a" * (SHA256_HEX_LEN - 1), "not name:tag"),  # short digest
            ("pgsty/silo:x@sha256:" + "A" * SHA256_HEX_LEN, "not name:tag"),        # uppercase hex
            ("pgsty/silo:x" + digest + "\n", "not name:tag"),              # trailing newline
            ("pgsty/silo:latest" + digest, "latest"),                      # pinned, but latest
            ("registry.example:5000/pgsty/silo:latest" + digest, "latest"),  # W1: port before latest
        ):
            with self.subTest(image=bad):
                self.assertRegex(pin_violation(bad) or "", why)

    def test_distroless_is_detected(self):
        digest = "@sha256:" + "a" * SHA256_HEX_LEN
        self.assertTrue(is_distroless("pgsty/silo:RELEASE.2026-09-16T00-00-00Z-distroless" + digest))
        self.assertFalse(is_distroless("pgsty/silo:RELEASE.2026-09-16T00-00-00Z" + digest))


class HelperBoundaryTest(unittest.TestCase):
    """Each structural check exists once, in a helper; pin each helper here."""

    def test_dig_yields_empty_mapping_on_any_non_mapping(self):
        self.assertEqual(_dig({"a": {"b": {"c": 1}}}, "a", "b"), {"c": 1})
        for obj, keys in (
            (None, ()),                 # not a mapping at the root
            ([1], ("a",)),              # a list where the root mapping belongs
            ({"a": [1]}, ("a", "b")),   # a list one level in
            ({"a": {"b": 5}}, ("a", "b")),  # a scalar at the leaf
            ({"a": {}}, ("a", "b")),    # missing key
        ):
            with self.subTest(obj=obj, keys=keys):
                self.assertEqual(_dig(obj, *keys), {})

    def test_seq_yields_empty_list_on_non_list(self):
        self.assertEqual(_seq([1]), [1])
        for value in (None, {"mc": {}}, "mc", 5):
            with self.subTest(value=value):
                self.assertEqual(_seq(value), [])

    def test_expect_one_rejects_zero_and_duplicates(self):
        self.assertEqual(_expect_one(["x"], "f", "thing"), "x")
        for items, n in (([], 0), (["x", "y"], 2)):
            with self.subTest(n=n):
                with self.assertRaisesRegex(PlaceNotFound, rf"f: expected one thing, found {n}"):
                    _expect_one(items, "f", "thing")

    def test_image_value_rejects_non_strings_and_empty(self):
        self.assertEqual(_image_value("a", "p"), "a")
        # None is rejected by BOTH clauses, so it proves neither — '' and 5 each
        # hit exactly one.
        for value in ("", 5, None):
            with self.subTest(value=value):
                with self.assertRaisesRegex(PlaceNotFound, r"p: image not found"):
                    _image_value(value, "p")

    def test_k8s_malformed_shapes_are_named_not_attribute_error(self):
        # Wiring: the extractor must route each lookup through `_dig`/`_seq`.
        job_ok = "kind: Job\nmetadata: {name: minio-create-bucket}\n" \
                 "spec: {template: {spec: {containers: [{name: mc, image: a}]}}}\n"
        for label, sts, expect in (
            ("metadata is a list", "kind: StatefulSet\nmetadata: [minio]\n",
             r"expected one StatefulSet/minio, found 0"),
            ("spec is a list", "kind: StatefulSet\nmetadata: {name: minio}\nspec: [x]\n",
             r"expected one container 'minio' in StatefulSet/minio, found 0"),
            ("containers is a mapping", "kind: StatefulSet\nmetadata: {name: minio}\n"
             "spec: {template: {spec: {containers: {minio: {image: a}}}}}\n",
             r"expected one container 'minio' in StatefulSet/minio, found 0"),
            # A mapping iterates its keys and yields no dicts even without `_seq`,
            # so it cannot tell whether `_seq` is wired; a scalar can (TypeError).
            ("containers is a scalar", "kind: StatefulSet\nmetadata: {name: minio}\n"
             "spec: {template: {spec: {containers: 5}}}\n",
             r"expected one container 'minio' in StatefulSet/minio, found 0"),
        ):
            with self.subTest(label):
                with self.assertRaisesRegex(PlaceNotFound, expect):
                    k8s_images("k.yaml", sts + "---\n" + job_ok)


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
