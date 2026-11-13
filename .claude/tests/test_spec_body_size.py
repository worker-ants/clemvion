"""Tests for the spec body size limit — `.claude/hooks/guard_spec_body_size.py` and
`.claude/tools/nerv-mirror/size_check.py` (NERV Task `CLE-T-H8JK7M`).

고정하는 것:
- 훅: 본문이 20,000자를 넘는 초안 저장은 exit 2, 한도 이하 · 본문 없는 호출(되돌리기) · 카탈로그 사본
  (`CLE-C24-*` · `CLE-MKS-*`)은 exit 0. 글자수는 바이트가 아니라 코드 포인트다(한국어 20,000자는
  UTF-8 로 6만 바이트라 바이트로 세면 한국어 문서만 세 배 엄격해진다). `body_md` · `body_markdown`
  두 이름을 모두 보고 둘 다 오면 긴 쪽으로 본다. 우회는 `BYPASS_SPEC_SIZE_GUARD=1` 만. 모양이 틀린
  페이로드와 런타임 오류는 통과한다(fail-open).
- `settings.json` 이 NERV 초안 도구 두 이름에 훅을 걸고, 훅 파일이 없는 체크아웃에서 통과한다.
- 미러 검사: 기준선에 없는 초과 문서와 기준선보다 커진 문서는 실패, 한도 안에 든 기준선 항목은
  알림만. `--update-baseline` 은 줄이기만 한다. 미러 링크는 NERV 꼴로 되돌려 센다.
- 훅과 미러 검사의 한도 값이 같고, 실제 저장소 미러가 지금 검사를 통과한다.
- CI `spec-mirror-integrity` 잡이 미러 검사를 돌린다.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import _harness

HOOK = _harness.REPO_ROOT / ".claude" / "hooks" / "guard_spec_body_size.py"
SETTINGS = _harness.REPO_ROOT / ".claude" / "settings.json"
TOOL = _harness.REPO_ROOT / ".claude" / "tools" / "nerv-mirror" / "size_check.py"
WORKFLOW = _harness.REPO_ROOT / ".github" / "workflows" / "spec-link-checks.yml"

hook = _harness.load_module_by_path("guard_spec_body_size_under_test", HOOK)
size_check = _harness.load_module_by_path("size_check_under_test", TOOL)
spec_size = _harness.load_module_by_path(
    "spec_size_under_test", _harness.REPO_ROOT / ".claude" / "hooks" / "_lib" / "spec_size.py")

TOOL_NAME = "mcp__nerv__nerv_spec_draft_upsert"


def run_hook(payload, env_extra=None):
    env = {k: v for k, v in os.environ.items() if k != "BYPASS_SPEC_SIZE_GUARD"}
    env.update(env_extra or {})
    raw = payload if isinstance(payload, str) else json.dumps(payload)
    return subprocess.run([sys.executable, str(HOOK)], input=raw, text=True,
                          capture_output=True, env=env, timeout=30)


def draft(body, **extra):
    return {"tool_name": TOOL_NAME, "tool_input": {"spec_id": "CLE-API-CONV", "body_md": body, **extra}}


class HookTest(unittest.TestCase):
    def test_over_limit_blocks(self):
        r = run_hook(draft("가" * (hook.LIMIT + 1)))
        self.assertEqual(r.returncode, 2, r.stderr)
        self.assertIn("guard_spec_body_size", r.stderr)
        self.assertIn("CLE-API-CONV", r.stderr)

    def test_at_limit_passes(self):
        self.assertEqual(run_hook(draft("가" * hook.LIMIT)).returncode, 0)

    def test_counts_code_points_not_bytes(self):
        body = "가" * (hook.LIMIT // 2)  # 3 bytes each in UTF-8: 1.5x the limit in bytes
        self.assertGreater(len(body.encode()), hook.LIMIT)
        self.assertEqual(run_hook(draft(body)).returncode, 0)

    def test_body_markdown_field_and_longer_of_two(self):
        payload = {"tool_name": TOOL_NAME, "tool_input": {
            "key": "CLE-NEW-DOC", "body_markdown": "x" * (hook.LIMIT + 5), "body_md": "short"}}
        r = run_hook(payload)
        self.assertEqual(r.returncode, 2)
        self.assertIn("CLE-NEW-DOC", r.stderr)

    def test_no_body_passes(self):
        self.assertEqual(run_hook({"tool_name": TOOL_NAME, "tool_input": {
            "spec_id": "CLE-API-CONV", "revert_to_version": 3, "base_hash": "x"}}).returncode, 0)

    def test_catalog_copies_exempt(self):
        for key in ("CLE-C24-PRODUCT-PRODUCTS", "CLE-MKS-ORDER", "CLE-C24-CATALOG"):
            with self.subTest(key=key):
                payload = {"tool_name": TOOL_NAME, "tool_input": {"spec_id": key, "body_md": "x" * 50000}}
                self.assertEqual(run_hook(payload).returncode, 0)

    def test_catalog_lookalike_not_exempt(self):
        payload = {"tool_name": TOOL_NAME, "tool_input": {"spec_id": "CLE-C24X", "body_md": "x" * 50000}}
        self.assertEqual(run_hook(payload).returncode, 2)

    def test_nerv_owned_conventions_under_catalog_prefix_not_exempt(self):
        for key in ("CLE-C24-META", "CLE-C24-SCOPES", "CLE-MKS-META"):
            with self.subTest(key=key):
                payload = {"tool_name": TOOL_NAME, "tool_input": {"spec_id": key, "body_md": "x" * 50000}}
                self.assertEqual(run_hook(payload).returncode, 2)

    def test_bypass_only_on_one(self):
        big = draft("x" * (hook.LIMIT + 1))
        self.assertEqual(run_hook(big, {"BYPASS_SPEC_SIZE_GUARD": "1"}).returncode, 0)
        self.assertEqual(run_hook(big, {"BYPASS_SPEC_SIZE_GUARD": "true"}).returncode, 2)

    def test_malformed_payloads_pass(self):
        for raw in ("", "not json", "[]", json.dumps({"tool_input": "x"}),
                    json.dumps({"tool_input": {"body_md": 5}})):
            with self.subTest(raw=raw):
                self.assertEqual(run_hook(raw).returncode, 0)

    def test_runtime_error_fails_open(self):
        probe = (
            "import json, runpy, sys\n"
            "def boom(*a, **k): raise RuntimeError('probe')\n"
            "json.loads = boom\n"
            f"sys.argv = [{str(HOOK)!r}]\n"
            f"runpy.run_path({str(HOOK)!r}, run_name='__main__')\n"
        )
        r = subprocess.run([sys.executable, "-c", probe], input=json.dumps(draft("x")),
                           text=True, capture_output=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("probe", r.stderr)


class SettingsTest(unittest.TestCase):
    def _entry(self):
        data = json.loads(SETTINGS.read_text(encoding="utf-8"))
        for entry in data["hooks"]["PreToolUse"]:
            for h in entry["hooks"]:
                if "guard_spec_body_size.py" in h["command"]:
                    return entry, h["command"]
        self.fail("guard_spec_body_size.py 가 PreToolUse 에 등록되지 않았다")

    def test_registered_for_both_tool_names(self):
        entry, _ = self._entry()
        names = set(entry["matcher"].split("|"))
        self.assertEqual(names, {"mcp__nerv__nerv_spec_draft_upsert",
                                 "mcp__plugin_nerv_nerv__nerv_spec_draft_upsert"})

    def test_registered_command_passes_without_hook_file(self):
        _, command = self._entry()
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run(["bash", "-c", command], input=json.dumps(draft("x" * 30000)),
                               text=True, capture_output=True, timeout=30,
                               env={**os.environ, "CLAUDE_PROJECT_DIR": d})
        self.assertEqual(r.returncode, 0, r.stderr)


def mirror_file(key, body):
    return f'---\nid: "{key}"\n---\n{body}'


class SizeCheckTest(unittest.TestCase):
    L = size_check.LIMIT

    def test_limits_agree(self):
        self.assertEqual(size_check.LIMIT, hook.LIMIT)
        self.assertLess(spec_size.TARGET, spec_size.LIMIT)

    def test_load_baseline_rejects_limit_mismatch(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d, "b.json")
            p.write_text(json.dumps({"limit": self.L + 1, "docs": {}}), encoding="utf-8")
            with self.assertRaises(ValueError):
                size_check.load_baseline(p)

    def test_unknown_body_field_name_still_blocked(self):
        payload = {"tool_name": TOOL_NAME, "tool_input": {
            "spec_id": "CLE-API-CONV", "base_hash": "x", "content": "x" * (hook.LIMIT + 1)}}
        self.assertEqual(run_hook(payload).returncode, 2)

    def test_main_cli(self):
        with tempfile.TemporaryDirectory() as d:
            spec = Path(d, "spec", "CLE-T")
            spec.mkdir(parents=True)
            big = spec / "CLE-T-BIG.md"
            big.write_text(mirror_file("CLE-T-BIG", "x" * (self.L + 100)), encoding="utf-8")
            base = Path(d, "baseline.json")
            base.write_text(json.dumps({"limit": self.L, "docs": {
                "CLE-T-BIG": self.L + 100, "CLE-T-GONE": self.L + 1}}), encoding="utf-8")
            # 기준선과 같으면 통과
            self.assertEqual(size_check.main(["--root", d], baseline_path=base), 0)
            # 커지면 실패
            big.write_text(mirror_file("CLE-T-BIG", "x" * (self.L + 200)), encoding="utf-8")
            self.assertEqual(size_check.main(["--root", d], baseline_path=base), 1)
            # 줄면 --update-baseline 이 낮추고 사라진 항목을 지운다
            big.write_text(mirror_file("CLE-T-BIG", "x" * (self.L + 50)), encoding="utf-8")
            self.assertEqual(size_check.main(["--root", d, "--update-baseline"], baseline_path=base), 0)
            self.assertEqual(json.loads(base.read_text(encoding="utf-8"))["docs"], {"CLE-T-BIG": self.L + 50})

    def test_body_chars_undoes_mirror_links(self):
        nerv = "보기 [에러](CLE-API-ERRCODES#코드) 와 [규약](CLE-API-CONV)"
        mirror = "보기 [에러](../CLE-API/CLE-API-ERRCODES.md#코드) 와 [규약](CLE-API-CONV.md)"
        self.assertEqual(size_check.body_chars(mirror_file("CLE-X", mirror)), len(nerv))

    def test_judge(self):
        sizes = {"A": self.L + 1, "B": self.L + 10, "C": self.L + 50, "D": self.L, "E": 10}
        baseline = {"B": self.L + 10, "C": self.L + 20, "D": self.L + 99, "Z": self.L + 1}
        fails, notes = size_check.judge(sizes, baseline)
        self.assertEqual([f.split(":")[0] for f in fails], ["A", "C"])
        self.assertEqual(sorted(n.split(":")[0] for n in notes), ["D", "Z"])

    def test_update_only_shrinks(self):
        sizes = {"A": self.L + 1, "B": self.L + 5, "C": self.L + 50, "D": 3}
        baseline = {"B": self.L + 10, "C": self.L + 20, "D": self.L + 1}
        self.assertEqual(size_check.updated(sizes, baseline), {"B": self.L + 5, "C": self.L + 20})

    def test_baseline_entries_were_over_limit(self):
        for key, n in size_check.load_baseline().items():
            self.assertGreater(n, self.L, key)

    def test_real_mirror_passes(self):
        r = subprocess.run([sys.executable, str(TOOL)], text=True, capture_output=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_new_oversize_doc_fails(self):
        with tempfile.TemporaryDirectory() as d:
            spec = Path(d, "spec", "CLE-T")
            spec.mkdir(parents=True)
            (spec / "CLE-T-BIG.md").write_text(mirror_file("CLE-T-BIG", "x" * (self.L + 1)), encoding="utf-8")
            (spec / "CLE-T-OK.md").write_text(mirror_file("CLE-T-OK", "x" * 10), encoding="utf-8")
            sizes = size_check.measure(Path(d, "spec"))
        self.assertEqual(sizes, {"CLE-T-BIG": self.L + 1, "CLE-T-OK": 10})
        fails, _ = size_check.judge(sizes, {})
        self.assertEqual(len(fails), 1)


class WorkflowTest(unittest.TestCase):
    def test_ci_job_runs_size_check(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        job = text.split("spec-mirror-integrity:", 1)[1]
        self.assertIn("python3 .claude/tools/nerv-mirror/size_check.py", job)

    def _sparse_paths(self):
        job = WORKFLOW.read_text(encoding="utf-8").split("spec-mirror-integrity:", 1)[1]
        block = job.split("sparse-checkout: |", 1)[1]
        paths = []
        for line in block.splitlines()[1:]:
            if not line.startswith(" " * 12) or not line.strip():
                break
            paths.append(line.strip())
        return paths

    def test_size_check_runs_in_sparse_checkout(self):
        """CI 잡이 받는 경로만 있는 트리에서 size_check.py 가 import 오류 없이 돈다."""
        paths = self._sparse_paths()
        self.assertIn(".claude/tools/nerv-mirror", paths)
        with tempfile.TemporaryDirectory() as d:
            for rel in paths:
                if rel == "spec":
                    continue
                shutil.copytree(_harness.REPO_ROOT / rel, Path(d, rel),
                                ignore=shutil.ignore_patterns("__pycache__"))
            spec = Path(d, "spec", "CLE-T")
            spec.mkdir(parents=True)
            (spec / "CLE-T-OK.md").write_text(mirror_file("CLE-T-OK", "x" * 10), encoding="utf-8")
            r = subprocess.run([sys.executable, str(Path(d, ".claude/tools/nerv-mirror/size_check.py")),
                                "--root", d], text=True, capture_output=True, timeout=60)
        self.assertNotIn("ModuleNotFoundError", r.stderr)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
