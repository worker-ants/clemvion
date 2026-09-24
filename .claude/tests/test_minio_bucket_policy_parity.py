"""Guard: the k8s bucket Job applies the SAME avatar BUCKET POLICY as the compose files.

Not to be confused with `test_minio_image_parity.py`, which checks the same Job
(and five other places) for the IMAGE reference. This file checks the POLICY the
Job applies; the two guard different axes of the same manifest.

Why this exists — 2026-09-25. Avatar images are served from a public URL, so the
bucket needs an anonymous-read policy on `avatars/*` — `scripts/minio/README.md`
calls it a deployment PREREQUISITE: without it uploads succeed and only the
images 403. Both compose files mount `scripts/minio/avatars-public-read.json`
and apply it with `mc anonymous set-json`. The k8s local overlay's Job
`minio-create-bucket` applied no policy at all.

It cannot mount that file: kustomize's `configMapGenerator` refuses files outside
the overlay root (`security; file … is not in or below …`, measured). A copy in
the overlay would hard-code the bucket name a second time, while the Job names
its bucket through `$S3_BUCKET`. So the Job writes the policy in a heredoc that
uses `${S3_BUCKET}` — and that makes the policy exist twice. This guard ties the
two together. Each assertion names one regression shape:

  1. the Job applies the policy with `set-json` to the same `$S3_BUCKET` it creates;
  2. the heredoc names its bucket through `${S3_BUCKET}`, not a literal;
  3. the heredoc delimiter is UNQUOTED — `<<'EOF'` stops the shell expanding
     `${S3_BUCKET}`. Measured against silo: the server rejects that policy
     (`bucket name does not match`) and the Job exits 1 — so the break is loud
     at deploy time, not silent; this check moves it to review time. (The first
     draft of this docstring claimed "applied without error"; measurement
     refuted it before it shipped.);
  4. with the bucket normalised, the heredoc policy equals the canonical JSON —
     editing either one alone turns this red;
  5. neither grants `s3:ListBucket` — the README measured the `set download`
     preset opening listing, after which the UUID in an avatar key is no secret;
  6. the script never uses that `anonymous set download` preset;
  7. the script starts with `set -e` — otherwise the Job's status is the LAST
     command's, and a failing `mb` before `set-json` would be masked.

The Job's behaviour against a real server (anonymous list 403, avatar GET 200,
other GET 403) was measured when this was written — see plan `k8s-avatar-policy`.
This file guards the text so that measurement stays true.
"""
from __future__ import annotations

import json
import re
import unittest

import yaml

from _harness import REPO_ROOT
# The "exactly one" and mapping-walk checks live ONCE, in the image guard — a
# copy here would be a new untested branch per copy (that guard's history is
# four review rounds of exactly that). Only helpers are imported, not TestCases,
# so pytest does not collect the sibling's tests twice.
from test_minio_image_parity import PlaceNotFound, _dig, _expect_one, _seq

K8S_MINIO = REPO_ROOT / "k8s" / "overlays" / "local" / "infra-minio.yaml"
POLICY = REPO_ROOT / "scripts" / "minio" / "avatars-public-read.json"

JOB = ("Job", "minio-create-bucket", "mc")
BUCKET_VAR = "${S3_BUCKET}"
# The quote group is captured (not just tolerated) so assertion 3 can reject it.
_HEREDOC = re.compile(r"<<-?[ \t]*(?P<q>['\"]?)EOF(?P=q)\n(?P<body>.*?)\nEOF\n", re.S)
_ARN_BUCKET = re.compile(r"arn:aws:s3:::([^/\"]+)/")


def job_script(text: str) -> str:
    """The Job container's single script argument. Zero or duplicate Jobs,
    containers or arguments each fail with `PlaceNotFound` naming which."""
    kind, name, container = JOB
    label = "k8s/overlays/local/infra-minio.yaml"
    docs = [d for d in yaml.safe_load_all(text) if isinstance(d, dict)]
    job = _expect_one(
        [d for d in docs if d.get("kind") == kind and _dig(d, "metadata").get("name") == name],
        label, f"{kind}/{name}",
    )
    pod = _dig(job, "spec", "template", "spec")
    entry = _expect_one(
        [c for c in _seq(pod.get("containers")) if isinstance(c, dict) and c.get("name") == container],
        label, f"container {container!r} in {kind}/{name}",
    )
    script = _expect_one(_seq(entry.get("args")), label, f"script argument of container {container!r}")
    if not isinstance(script, str) or not script:
        raise PlaceNotFound(f"{label}: script argument of container {container!r} is not a non-empty string")
    return script


def heredoc_policy(script: str) -> tuple[str, bool]:
    """(body, delimiter_quoted) of THE `<<EOF … EOF` heredoc — zero or two fail,
    since a second heredoc would leave it ambiguous which policy is applied."""
    m = _expect_one(list(_HEREDOC.finditer(script)), "Job script", "<<EOF heredoc")
    return m.group("body"), bool(m.group("q"))


def granted_actions(policy: dict) -> list[str]:
    """Every Action across statements — a bare string counts as one action."""
    actions: list[str] = []
    for st in policy.get("Statement", []):
        a = st.get("Action", [])
        actions.extend([a] if isinstance(a, str) else a)
    return actions


def _job_yaml(containers: str) -> str:
    """One Job document whose `containers` list is given verbatim."""
    return (
        "kind: Job\nmetadata: {name: minio-create-bucket}\n"
        f"spec: {{template: {{spec: {{containers: {containers}}}}}}}\n"
    )


def _mc(args: str) -> str:
    return _job_yaml(f"[{{name: mc, args: {args}}}]")


class ExtractorBoundaryTest(unittest.TestCase):
    """Each failure is named by its reason — `_expect_one` at every "exactly one"."""

    def test_job_script_found(self):
        self.assertEqual(job_script(_mc('["echo hi"]')), "echo hi")

    def test_job_script_failures_are_named_by_reason(self):
        for label, text, expect in (
            ("no Job", "kind: StatefulSet\nmetadata: {name: minio}\n",
             r"expected one Job/minio-create-bucket, found 0"),
            ("two Jobs", _mc('["a"]') + "---\n" + _mc('["a"]'),
             r"expected one Job/minio-create-bucket, found 2"),
            ("no mc container", _job_yaml('[{name: other, args: ["a"]}]'),
             r"expected one container 'mc' in Job/minio-create-bucket, found 0"),
            ("two mc containers", _job_yaml('[{name: mc, args: ["a"]}, {name: mc, args: ["b"]}]'),
             r"expected one container 'mc' in Job/minio-create-bucket, found 2"),
            ("no args", _job_yaml("[{name: mc}]"),
             r"expected one script argument of container 'mc', found 0"),
            ("args not a list", _mc("x"),
             r"expected one script argument of container 'mc', found 0"),
            ("two args", _mc('["a", "b"]'),
             r"expected one script argument of container 'mc', found 2"),
            ("non-string arg", _mc("[5]"), r"is not a non-empty string"),
            ("empty arg", _mc("['']"), r"is not a non-empty string"),
        ):
            with self.subTest(label):
                with self.assertRaisesRegex(PlaceNotFound, expect):
                    job_script(text)

    def test_heredoc_body_and_quoting(self):
        for delim, quoted in (("EOF", False), ("'EOF'", True), ('"EOF"', True), ("-EOF", False)):
            with self.subTest(delim=delim):
                script = f"cat > /tmp/p.json <<{delim}\n{{\"a\": 1}}\nEOF\nnext\n"
                self.assertEqual(heredoc_policy(script), ('{"a": 1}', quoted))

    def test_heredoc_zero_or_two_is_named(self):
        one = "cat > /tmp/p.json <<EOF\n{}\nEOF\n"
        for label, script, n in (("none", "mc mb x\n", 0), ("two", one + one, 2)):
            with self.subTest(label):
                with self.assertRaisesRegex(PlaceNotFound, rf"expected one <<EOF heredoc, found {n}"):
                    heredoc_policy(script)

    def test_granted_actions_counts_a_bare_string(self):
        policy = {"Statement": [{"Action": "s3:ListBucket"}, {"Action": ["s3:GetObject"]}]}
        self.assertEqual(granted_actions(policy), ["s3:ListBucket", "s3:GetObject"])


class BucketPolicyParityTest(unittest.TestCase):
    def setUp(self):
        self.script = job_script(K8S_MINIO.read_text(encoding="utf-8"))
        self.heredoc, self.quoted = heredoc_policy(self.script)
        self.canonical_text = POLICY.read_text(encoding="utf-8")
        self.canonical = json.loads(self.canonical_text)

    def test_policy_is_applied_to_the_created_bucket(self):
        self.assertRegex(self.script, r'mc mb [^\n]*local/"\$S3_BUCKET"')
        self.assertRegex(self.script, r'mc anonymous set-json \S+ local/"\$S3_BUCKET"')

    def test_heredoc_names_the_bucket_through_the_variable(self):
        buckets = set(_ARN_BUCKET.findall(self.heredoc))
        self.assertEqual(buckets, {BUCKET_VAR}, f"heredoc ARN buckets: {sorted(buckets)}")

    def test_heredoc_delimiter_is_unquoted(self):
        self.assertFalse(self.quoted, "<<'EOF' would leave ${S3_BUCKET} unexpanded")

    def test_heredoc_equals_canonical_policy(self):
        buckets = set(_ARN_BUCKET.findall(self.canonical_text))
        self.assertEqual(len(buckets), 1, f"canonical ARN buckets: {sorted(buckets)}")
        (bucket,) = buckets
        self.assertEqual(json.loads(self.heredoc.replace(BUCKET_VAR, bucket)), self.canonical)

    def test_no_list_bucket_anywhere(self):
        for label, policy in (("canonical", self.canonical),
                              ("k8s heredoc", json.loads(self.heredoc.replace(BUCKET_VAR, "b")))):
            with self.subTest(label):
                self.assertNotIn("s3:ListBucket", granted_actions(policy))

    def test_no_download_preset(self):
        self.assertNotRegex(self.script, r"anonymous\s+set\s+download")

    def test_script_fails_fast(self):
        self.assertEqual(self.script.splitlines()[0].strip(), "set -e")


if __name__ == "__main__":
    unittest.main()
