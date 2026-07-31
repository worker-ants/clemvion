"""`scripts/check-override-floors.py` — override 바닥 침식 검출 가드.

이 가드는 `pnpm audit` 의 **부분집합**이다: audit 이 보고한 취약점 중 override 로 이미
관리 중인 패키지만 좁혀 fail 시킨다(조치 가능성이 다르므로 — 전자는 판단 필요, 후자는
값만 올리면 됨).

여기서 고정하는 것은 네 축이다.

  1. **override 키 → 패키지명 추출** — `pkg` · `a>b` · `a>b>c` · `pkg@range` 가 섞이고 scope
     패키지(`@scope/name`)가 체인 어디에든 올 수 있다. 개발 중 **세 번** 틀렸고 셋 다 증상이
     같았다 — 매칭이 0건이 되어 **가드가 조용히 통과**한다:
       - `>` 를 먼저 자르면 `undici@>=7.0.0` 의 `>=` 를 부모 구분자로 오인 → `js-yaml` 스코프
         override 2건이 통째로 매칭에서 빠졌다.
       - 레인지를 먼저 떼면 scope 패키지의 선두 `@` 를 버전 구분자로 물어 `@babel/core@>=7`
         이 `=7.0.0` 이 됐다.
       - `@` 이전 구간에서만 `>` 를 찾으면 `a>@scope/b>c` 의 마지막 `>` 를 못 본다.
     추출이 틀리면 가드가 아무것도 안 잡으므로 이 축이 가장 중요하다.

  2. **분류 동작** — advisory 의 패키지가 override 대상이면 fail, 아니면 통과(그건 audit 잡
     담당). 실제 스크립트를 서브프로세스로 돌려 exit code 로 확인한다.

  3. **`ignoreCves` 억제분의 경로 baseline** — 수용된 CVE 는 `advisories` 에서 통째로 사라져
     축 2 로는 절대 안 잡힌다(실측: 취약 버전이 실제 설치됐는데 가드가 OK 를 냈다 — 이 가드가
     막으려던 바로 그 조용한 통과였다). `actions[]` 에 남는 경로를 baseline 과 대조해
     **경로가 늘면** fail 시킨다.

  4. **fail-closed** — audit 을 *실행하지 못한 것*은 "취약점 0건" 이 아니다. audit 은 취약점이
     있으면 비-0 으로 끝나 returncode 로 성공을 못 가리므로 출력 형태로 판정하는데, 그 판정이
     느슨하면 레지스트리 타임아웃·401 오류 페이로드가 초록불이 된다(축 1~3 을 다 통과한 채로).
     빈 출력 / 파싱 불가 / `actions` 키 없는 JSON 세 형태를 exit 2 로 고정한다.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path

from _harness import REPO_ROOT

SCRIPT = REPO_ROOT / "scripts" / "check-override-floors.py"

# 두 클래스가 공유하는 픽스처 — 한쪽만 고쳐 다른 쪽이 조용히 낡는 것을 막는다.
MANAGED_OVERRIDES = "overrides:\n  liquidjs: ^10.27.1\n  next>postcss: ^8.5.18\n"


# 스텁 `pnpm` 은 **고정 소스**다. payload 를 소스에 f-string 으로 박아 넣던 옛 방식은
# `json.dumps` 가 내는 `true`/`false`/`null` 이 파이썬 소스에서 이름으로 해석돼 NameError 가
# 나는 형태였다(현 픽스처엔 불리언이 없어 잠복 상태였다). 경로만 환경변수로 넘긴다 —
# 저장소의 다른 스텁(`test_mermaid_lint_ready.py` 의 `_NODE_STUB`)과 같은 관례.
_PNPM_STUB = """\
#!/usr/bin/env python3
import os, sys
# 실제 `pnpm audit --json` 과 같은 형태 — run_audit() 이 `actions` 키 존재로 정상 응답을
# 판정하므로(fail-closed) 스텁도 갖춰야 한다. 내용은 STUB_AUDIT_PAYLOAD 파일에서 읽는다.
sys.stdout.write(open(os.environ["STUB_AUDIT_PAYLOAD"], encoding="utf-8").read())
"""


def _stage_script(tmp: Path) -> Path:
    """tmp 안에 스크립트 사본을 배치하고 그 경로를 돌려준다."""
    (tmp / "scripts").mkdir(exist_ok=True)
    dest = tmp / "scripts" / "check-override-floors.py"
    dest.write_text(SCRIPT.read_text(encoding="utf-8"), encoding="utf-8")
    return dest


def run_with_stub_audit(
    advisories: dict, overrides: str, actions: list | None = None,
    raw_stdout: str | None = None,
) -> subprocess.CompletedProcess:
    """`pnpm audit` 을 스텁으로 갈아끼워 스크립트를 돌린다.

    실제 레지스트리에 의존하면 테스트가 네트워크·CVE 공시 상태에 흔들린다. PATH 앞에
    가짜 `pnpm` 을 두어 원하는 advisory 를 주입한다.

    `raw_stdout` 을 주면 정상 형태 대신 그 문자열을 그대로 뱉는다 — fail-closed 분기용.
    """
    import tempfile
    import os

    payload = raw_stdout if raw_stdout is not None else json.dumps({
        "actions": actions or [],
        "advisories": advisories,
        "muted": [],
        "metadata": {"vulnerabilities": {}, "totalDependencies": 0},
    })

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "pnpm-workspace.yaml").write_text(overrides, encoding="utf-8")
        script = _stage_script(tmp)
        payload_file = tmp / "audit.json"
        payload_file.write_text(payload, encoding="utf-8")
        bindir = tmp / "bin"
        bindir.mkdir()
        fake = bindir / "pnpm"
        fake.write_text(_PNPM_STUB, encoding="utf-8")
        fake.chmod(0o755)
        env = dict(
            os.environ,
            PATH=f"{bindir}:{os.environ['PATH']}",
            STUB_AUDIT_PAYLOAD=str(payload_file),
        )
        return subprocess.run(
            [sys.executable, str(script)],
            capture_output=True,
            text=True,
            env=env,
        )


def _load_module():
    spec = importlib.util.spec_from_file_location("check_override_floors", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class OverrideTargetExtractionTest(unittest.TestCase):
    """축 1 — 키에서 패키지명 뽑기. 실측으로 **세 번** 틀렸던 자리다."""

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

    def test_multi_level_chain_resolves_to_the_leaf(self):
        """pnpm 은 `a>b>c` 다단계 경로를 허용한다 — 제약 대상은 **마지막** 항이다.

        첫 `>` 로 자르면 `'b>c'` 라는 존재하지 않는 패키지명이 나와 advisory 와 절대
        매칭되지 않는다: 즉 그 override 는 가드에서 조용히 빠진다(축 1 이 틀리면 아무것도
        안 잡힌다는 바로 그 실패). 레인지가 붙어도 마찬가지여야 한다.
        """
        self.assertEqual(self.mod.override_target("a>b>c"), "c")
        self.assertEqual(
            self.mod.override_target("next>webpack>terser@>=5.0.0"), "terser"
        )
        # 다단계 + scope 리프 + scope 부모 — 선두 `@` 는 이름의 일부로 살아남아야 한다.
        self.assertEqual(
            self.mod.override_target("@nestjs/cli>webpack>@types/node"), "@types/node"
        )

    def test_scope_package_in_the_middle_of_a_chain(self):
        """체인 **중간**이 scope 패키지인 형태 — 위 버그의 형제다.

        `@` 이전 구간에서만 `>` 를 찾던 구현은 `a>@scope/b>c` 에서 첫 `@`(= `@scope` 의 것)
        앞까지만 보므로 마지막 `>` 를 놓치고 `'@scope/b>c'` 를 돌려줬다. 존재하지 않는
        패키지명이라 advisory 와 영영 안 맞는다 — 축 1 의 실패는 늘 "조용한 통과" 로 나온다.
        레인지가 **부모에** 붙은 형태도 같은 규칙으로 갈려야 한다.
        """
        self.assertEqual(self.mod.override_target("a>@scope/b>c"), "c")
        self.assertEqual(self.mod.override_target("a>@scope/b"), "@scope/b")
        self.assertEqual(self.mod.override_target("parent@1.0.0>child"), "child")
        self.assertEqual(self.mod.override_target("parent@>=1.0.0>child"), "child")
        # 2차 리뷰가 실패를 재현한 정확한 조합 — 중간 scope + 리프의 scope+레인지.
        self.assertEqual(
            self.mod.override_target("a>@scope/b>@scope/c@>=1.0.0"), "@scope/c"
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

    OVERRIDES = MANAGED_OVERRIDES

    def test_no_advisories_passes(self):
        r = run_with_stub_audit({}, self.OVERRIDES)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("취약 재유입 0건", r.stdout)

    def test_advisory_on_managed_package_fails(self):
        """override 대상이 취약 → 바닥 침식이므로 fail."""
        r = run_with_stub_audit(
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
        r = run_with_stub_audit(
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
        r = run_with_stub_audit(
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


    def test_advisory_without_github_id_falls_back_to_numeric_id(self):
        """`github_advisory_id` 없이 `id`(정수)만 오는 advisory 도 식별자를 잃지 않는다.

        모든 픽스처가 `github_advisory_id` 를 갖고 있어 폴백 경로가 통째로 미검증이었다.
        폴백을 지우면 보고에 advisory 대신 맵 키(`"1"`)가 찍힌다 — mutation 으로 확인.

        **`str()` 캐스팅 자체는 여기서 못 잡는다**: int 도 f-string 에서 같은 문자열이 되어
        관측 차이가 없다. 그 캐스팅은 선언 타입(`dict[str, str]`) 정합을 위한 것이지 동작
        보호가 아니다 — 이 테스트가 고정하는 것은 폴백의 존재다.
        """
        r = run_with_stub_audit(
            {"1": {"module_name": "liquidjs", "id": 1102341,
                   "patched_versions": ">=10.27.1"}},
            self.OVERRIDES,
        )
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("1102341", r.stderr)


class CombinedReportTest(unittest.TestCase):
    """두 실패가 동시에 있으면 **둘 다** 보고한다.

    widened 에서 조기 return 하던 구현은 같은 실행의 eroded 를 숨겼다 — 고치고 다시 돌리는
    왕복이 생긴다. 조기 return 을 되살리는 mutation 이 기존 테스트를 전부 통과시킨다는 것을
    리뷰어가 실측했으므로(= 그 수정이 무검증이었다) 여기서 고정한다.
    """

    OVERRIDES = (
        'overrides:\n  liquidjs: ^10.27.1\n  "brace-expansion@<2.0.0": ^1.1.16\n'
    )

    def test_widened_and_eroded_are_both_reported(self):
        r = run_with_stub_audit(
            advisories={"1": {"module_name": "liquidjs",
                              "github_advisory_id": "GHSA-eroded",
                              "patched_versions": ">=10.27.1"}},
            overrides=self.OVERRIDES,
            actions=[{"action": "review", "module": "brace-expansion",
                      "resolves": [{"id": 1, "path": "some>new>path>brace-expansion"}]}],
        )
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("수용 범위 밖", r.stderr)          # widened 블록
        self.assertIn("바닥이 낡아", r.stderr)            # eroded 블록
        self.assertIn("GHSA-eroded", r.stderr)


class SchemaDriftTest(unittest.TestCase):
    """audit 결과의 **하위 필드**가 바뀌면 "취약 0건" 이 아니라 판단 불가다.

    `run_audit()` 은 최상위 `actions` 키만 본다. 그 아래 이름이 pnpm 상향으로 바뀌면
    `.get()` 이 전부 None 을 돌려주고 분류 결과가 빈 dict 가 된다 — 정상 통과와 구별되지
    않는 형태로. 스텁이 전부 손으로 만든 JSON 이라 실물 필드명 변화는 여기서만 잡힌다.
    """

    OVERRIDES = "overrides:\n  liquidjs: ^10.27.1\n"

    def test_advisories_without_module_name_is_undecidable(self):
        r = run_with_stub_audit(
            {"1": {"moduleName": "liquidjs", "ghsa": "GHSA-x"}},  # camelCase 로 개명
            self.OVERRIDES,
        )
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("스키마", r.stderr)

    def test_actions_without_module_is_undecidable(self):
        r = run_with_stub_audit(
            advisories={}, overrides=self.OVERRIDES,
            actions=[{"action": "review", "pkg": "brace-expansion"}],  # module → pkg
        )
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("스키마", r.stderr)

    def test_genuinely_empty_audit_still_passes(self):
        """빈 결과는 드리프트가 아니다 — 여기서 fail 하면 정상 상태가 상시 빨간불이 된다."""
        r = run_with_stub_audit({}, self.OVERRIDES, actions=[])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


class SuppressedPathBaselineTest(unittest.TestCase):
    """축 3 — `ignoreCves` 로 억제된 건은 경로 집합으로 판정한다.

    `advisories` 가 비어도 `actions[]` 에는 남으므로, 수용 시점 경로(baseline)를 넘어서면
    "수용 범위 밖 재유입" 으로 fail 시킨다.
    """

    OVERRIDES = 'overrides:\n  "brace-expansion@<2.0.0": ^1.1.16\n'
    KNOWN = "codebase__backend>@eslint/eslintrc>minimatch>brace-expansion"
    NEW = "codebase__backend>jest>@jest/core>@jest/reporters>glob>minimatch>brace-expansion"

    def _run(self, paths):
        return run_with_stub_audit(
            advisories={}, overrides=self.OVERRIDES,
            actions=[{"action": "review", "module": "brace-expansion",
                      "resolves": [{"id": 1124334, "path": p} for p in paths]}],
        )

    def test_baseline_path_only_passes(self):
        """수용된 그 경로만 있으면 통과 — 아니면 정상 상태에서 매번 빨간불이 된다."""
        r = self._run([self.KNOWN])
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_widened_path_fails(self):
        """경로가 늘면 수용 범위 밖이므로 fail."""
        r = self._run([self.KNOWN, self.NEW])
        self.assertEqual(r.returncode, 1)
        self.assertIn("수용 범위 밖", r.stderr)
        self.assertIn(self.NEW, r.stderr)
        self.assertNotIn(f"    - {self.KNOWN}", r.stderr)


class FailClosedTest(unittest.TestCase):
    """audit 을 **실행하지 못한 것**과 "취약점 0건" 을 구분한다.

    구분하지 못하면 레지스트리 타임아웃·인증 오류가 초록불이 되어, 이 가드가 막으려는
    조용한 통과를 가드 자신이 재현한다. 세 형태 모두 exit 2 (실패 1 과도 구분: 취약 발견이
    아니라 판단 불가라는 뜻)여야 한다.
    """

    OVERRIDES = "overrides:\n  liquidjs: ^10.27.1\n"

    def _run_raw(self, raw):
        return run_with_stub_audit(
            advisories={}, overrides=self.OVERRIDES, raw_stdout=raw
        )

    def test_empty_stdout_is_undecidable(self):
        r = self._run_raw("")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotIn("취약 재유입 0건", r.stdout)

    def test_unparseable_output_is_undecidable(self):
        r = self._run_raw("ERR_PNPM_AUDIT_FAILED  registry unreachable\n")
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)

    def test_error_payload_without_actions_is_undecidable(self):
        """유효한 JSON 이지만 audit 결과가 아닌 오류 페이로드 — 가장 속기 쉬운 형태."""
        r = self._run_raw(json.dumps({"error": {"code": "ERR_PNPM_AUDIT", "message": "401"}}))
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("actions", r.stderr)

    def test_missing_workspace_file_is_undecidable(self):
        """override 목록을 못 읽으면 "대상 0건" 이 아니라 판단 불가다.

        빈 목록으로 진행하면 어떤 advisory 도 override 대상에 안 걸려 **항상 OK** 가 된다 —
        위 세 형태와 정확히 같은 조용한 통과다. exit 2 로 갈라야 한다.
        """
        import os
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / "scripts").mkdir()
            script = tmp / "scripts" / "check-override-floors.py"
            script.write_text(SCRIPT.read_text(encoding="utf-8"), encoding="utf-8")
            # pnpm-workspace.yaml 을 일부러 두지 않는다.
            r = subprocess.run(
                [sys.executable, str(script)],
                capture_output=True, text=True, env=dict(os.environ),
            )
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("pnpm-workspace.yaml", r.stderr)


class MultipleMatchTest(unittest.TestCase):
    """발단 시나리오 — 여러 advisory 중 **일부만** override 대상(#1038: 17건 중 4건)."""

    OVERRIDES = MANAGED_OVERRIDES

    def test_reports_only_managed_among_many(self):
        r = run_with_stub_audit(
            advisories={
                "1": {"module_name": "liquidjs", "github_advisory_id": "GHSA-a", "patched_versions": ">=10.27.1"},
                "2": {"module_name": "postcss", "github_advisory_id": "GHSA-b", "patched_versions": ">=8.5.18"},
                "3": {"module_name": "unmanaged-one", "github_advisory_id": "GHSA-c", "patched_versions": ">=1.0.0"},
                "4": {"module_name": "unmanaged-two", "github_advisory_id": "GHSA-d", "patched_versions": ">=2.0.0"},
            },
            overrides=self.OVERRIDES,
        )
        self.assertEqual(r.returncode, 1)
        self.assertIn("liquidjs", r.stderr)
        self.assertIn("postcss", r.stderr)
        self.assertNotIn("unmanaged-one", r.stderr)
        self.assertNotIn("unmanaged-two", r.stderr)


if __name__ == "__main__":
    unittest.main()
