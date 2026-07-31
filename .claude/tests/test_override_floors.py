"""`scripts/check-override-floors.py` — override 바닥 침식 검출 가드.

이 가드는 `pnpm audit` 의 **부분집합**이다: audit 이 보고한 취약점 중 override 로 이미
관리 중인 패키지만 좁혀 fail 시킨다(조치 가능성이 다르므로 — 전자는 판단 필요, 후자는
값만 올리면 됨).

여기서 고정하는 것은 두 축이다.

  1. **override 키 → 패키지명 추출** — 세 형태(`pkg`, `parent>child`, `pkg@range`)가 섞이고
     scope 패키지(`@scope/name`)까지 온다. 개발 중 실측으로 두 번 틀렸다:
       - `>` 를 먼저 자르면 `undici@>=7.0.0` 의 `>=` 를 부모 구분자로 오인 → `js-yaml` 스코프
         override 2건이 통째로 매칭에서 빠져 **가드가 조용히 통과**했다.
       - 레인지를 먼저 떼면 scope 패키지의 선두 `@` 를 버전 구분자로 물어 `@babel/core@>=7`
         이 `=7.0.0` 이 됐다.
     추출이 틀리면 가드가 아무것도 안 잡으므로 이 축이 가장 중요하다.

  2. **분류 동작** — advisory 의 패키지가 override 대상이면 fail, 아니면 통과(그건 audit 잡
     담당). 실제 스크립트를 서브프로세스로 돌려 exit code 로 확인한다.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import textwrap
import unittest
from pathlib import Path

from _harness import REPO_ROOT

SCRIPT = REPO_ROOT / "scripts" / "check-override-floors.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("check_override_floors", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class OverrideTargetExtractionTest(unittest.TestCase):
    """축 1 — 키에서 패키지명 뽑기. 실측으로 두 번 틀렸던 자리다."""

    def setUp(self):
        self.mod = _load_module()

    def test_plain_name(self):
        self.assertEqual(self.mod.override_target("lodash"), "lodash")

    def test_parent_child_path(self):
        self.assertEqual(self.mod.override_target("next>postcss"), "postcss")

    def test_version_range_suffix_is_not_a_parent_path(self):
        # 회귀: `>` 를 먼저 자르면 `>=` 에 걸려 `=7.0.0 <7.28.0` 이 나왔다.
        self.assertEqual(
            self.mod.override_target("undici@>=7.0.0 <7.28.0"), "undici"
        )
        self.assertEqual(self.mod.override_target("js-yaml@>=4.0.0 <4.3.0"), "js-yaml")
        self.assertEqual(
            self.mod.override_target("brace-expansion@>=2.0.0 <3.0.0"), "brace-expansion"
        )

    def test_scope_package_leading_at_is_part_of_name(self):
        self.assertEqual(self.mod.override_target("@grpc/grpc-js"), "@grpc/grpc-js")
        self.assertEqual(
            self.mod.override_target("@hono/node-server"), "@hono/node-server"
        )

    def test_scope_package_with_range(self):
        # 회귀: 레인지를 먼저 떼면 선두 `@` 를 물어 `=7.0.0` 이 나왔다.
        self.assertEqual(self.mod.override_target("@babel/core@>=7.0.0"), "@babel/core")

    def test_parent_path_to_scope_child(self):
        self.assertEqual(
            self.mod.override_target("next>@types/react"), "@types/react"
        )

    def test_real_workspace_yaml_covers_scoped_range_keys(self):
        """실제 pnpm-workspace.yaml 에서 스코프 레인지 키가 누락되지 않는다."""
        targets = self.mod.load_override_targets(REPO_ROOT / "pnpm-workspace.yaml")
        # 이 둘은 버전-레인지로 스코프된 다중 키를 갖는다 — 추출이 틀리면 0건이 된다.
        self.assertGreaterEqual(len(targets.get("js-yaml", [])), 2)
        self.assertGreaterEqual(len(targets.get("brace-expansion", [])), 2)
        # scope 패키지가 이름 그대로 살아있어야 한다.
        self.assertIn("@grpc/grpc-js", targets)


class ClassificationTest(unittest.TestCase):
    """축 2 — advisory 를 override 대상 여부로 갈라 exit code 를 낸다."""

    def _run_with_stub_audit(self, advisories: dict, overrides: str) -> subprocess.CompletedProcess:
        """`pnpm audit` 을 스텁으로 갈아끼워 스크립트를 돌린다.

        실제 레지스트리에 의존하면 테스트가 네트워크·CVE 공시 상태에 흔들린다. PATH 앞에
        가짜 `pnpm` 을 두어 원하는 advisory 를 주입한다.
        """
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / "pnpm-workspace.yaml").write_text(overrides, encoding="utf-8")
            (tmp / "scripts").mkdir()
            (tmp / "scripts" / "check-override-floors.py").write_text(
                SCRIPT.read_text(encoding="utf-8"), encoding="utf-8"
            )
            bindir = tmp / "bin"
            bindir.mkdir()
            fake = bindir / "pnpm"
            fake.write_text(
                textwrap.dedent(
                    f"""\
                    #!/usr/bin/env python3
                    import json, sys
                    print(json.dumps({{"advisories": {json.dumps(advisories)}}}))
                    """
                ),
                encoding="utf-8",
            )
            fake.chmod(0o755)
            env = dict(os.environ, PATH=f"{bindir}:{os.environ['PATH']}")
            return subprocess.run(
                [sys.executable, str(tmp / "scripts" / "check-override-floors.py")],
                capture_output=True,
                text=True,
                env=env,
            )

    OVERRIDES = "overrides:\n  liquidjs: ^10.27.1\n  next>postcss: ^8.5.18\n"

    def test_no_advisories_passes(self):
        r = self._run_with_stub_audit({}, self.OVERRIDES)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("취약 재유입 0건", r.stdout)

    def test_advisory_on_managed_package_fails(self):
        """override 대상이 취약 → 바닥 침식이므로 fail."""
        r = self._run_with_stub_audit(
            {
                "1": {
                    "module_name": "liquidjs",
                    "github_advisory_id": "GHSA-test",
                    "patched_versions": ">=10.27.1",
                }
            },
            self.OVERRIDES,
        )
        self.assertEqual(r.returncode, 1)
        self.assertIn("liquidjs", r.stderr)
        self.assertIn(">=10.27.1", r.stderr)

    def test_advisory_on_unmanaged_package_passes(self):
        """override 없는 패키지는 audit 잡 담당 — 본 가드는 통과시킨다."""
        r = self._run_with_stub_audit(
            {
                "1": {
                    "module_name": "some-unmanaged-pkg",
                    "github_advisory_id": "GHSA-other",
                    "patched_versions": ">=9.9.9",
                }
            },
            self.OVERRIDES,
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_parent_scoped_override_is_matched_by_child_name(self):
        """`next>postcss` override 는 advisory 의 `postcss` 와 매칭돼야 한다."""
        r = self._run_with_stub_audit(
            {
                "1": {
                    "module_name": "postcss",
                    "github_advisory_id": "GHSA-postcss",
                    "patched_versions": ">=8.5.18",
                }
            },
            self.OVERRIDES,
        )
        self.assertEqual(r.returncode, 1)
        self.assertIn("next>postcss", r.stderr)


if __name__ == "__main__":
    unittest.main()
