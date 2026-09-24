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

K8S_MINIO = REPO_ROOT / "k8s" / "overlays" / "local" / "infra-minio.yaml"
POLICY = REPO_ROOT / "scripts" / "minio" / "avatars-public-read.json"

JOB = ("Job", "minio-create-bucket", "mc")
BUCKET_VAR = "${S3_BUCKET}"
# The quote group is captured (not just tolerated) so assertion 3 can reject it.
_HEREDOC = re.compile(r"<<-?[ \t]*(?P<q>['\"]?)EOF(?P=q)\n(?P<body>.*?)\nEOF\n", re.S)
_ARN_BUCKET = re.compile(r"arn:aws:s3:::([^/\"]+)/")


def job_script(text: str) -> str:
    """The single script argument of the Job's container — or an error naming it."""
    kind, name, container = JOB
    for doc in yaml.safe_load_all(text):
        if not isinstance(doc, dict) or doc.get("kind") != kind:
            continue
        if (doc.get("metadata") or {}).get("name") != name:
            continue
        pod = ((doc.get("spec") or {}).get("template") or {}).get("spec") or {}
        for c in pod.get("containers") or []:
            if isinstance(c, dict) and c.get("name") == container:
                args = c.get("args")
                if isinstance(args, list) and len(args) == 1 and isinstance(args[0], str):
                    return args[0]
    raise AssertionError(f"{kind}/{name} container {container!r}: single script arg not found")


def heredoc_policy(script: str) -> tuple[str, bool]:
    """(body, delimiter_quoted) of the first `<<EOF … EOF` heredoc."""
    m = _HEREDOC.search(script)
    if m is None:
        raise AssertionError("no <<EOF … EOF heredoc policy in the Job script")
    return m.group("body"), bool(m.group("q"))


def granted_actions(policy: dict) -> list[str]:
    """Every Action across statements — a bare string counts as one action."""
    actions: list[str] = []
    for st in policy.get("Statement", []):
        a = st.get("Action", [])
        actions.extend([a] if isinstance(a, str) else a)
    return actions


def _job_yaml(args: str) -> str:
    return (
        "kind: Job\nmetadata: {name: minio-create-bucket}\n"
        f"spec: {{template: {{spec: {{containers: [{{name: mc, args: {args}}}]}}}}}}\n"
    )


class ExtractorBoundaryTest(unittest.TestCase):
    def test_job_script_found(self):
        self.assertEqual(job_script(_job_yaml('["echo hi"]')), "echo hi")

    def test_job_script_missing_or_malformed_is_named(self):
        for label, text in (
            ("no Job", "kind: StatefulSet\nmetadata: {name: minio}\n"),
            ("two args", _job_yaml('["a", "b"]')),
            ("non-string arg", _job_yaml("[5]")),
            ("args not a list", _job_yaml("x")),
        ):
            with self.subTest(label):
                with self.assertRaisesRegex(AssertionError, "single script arg not found"):
                    job_script(text)

    def test_heredoc_body_and_quoting(self):
        for delim, quoted in (("EOF", False), ("'EOF'", True), ('"EOF"', True), ("-EOF", False)):
            with self.subTest(delim=delim):
                script = f"cat > /tmp/p.json <<{delim}\n{{\"a\": 1}}\nEOF\nnext\n"
                self.assertEqual(heredoc_policy(script), ('{"a": 1}', quoted))

    def test_missing_heredoc_is_named(self):
        with self.assertRaisesRegex(AssertionError, "no <<EOF"):
            heredoc_policy("mc mb x\n")

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
