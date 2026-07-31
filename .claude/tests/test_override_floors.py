"""`scripts/check-override-floors.py` — override 바닥 침식 검출 가드.

이 가드는 `pnpm audit` 의 **부분집합**이다: audit 이 보고한 취약점 중 override 로 이미
관리 중인 패키지만 좁혀 fail 시킨다(조치 가능성이 다르므로 — 전자는 판단 필요, 후자는
값만 올리면 됨).

여기서 고정하는 것은 세 축이다.

(한때 넷이었다. `auditConfig.ignoreCves` 로 억제된 CVE 를 `actions[]` 잔여 경로로 추적하는 축이
있었으나 2026-08-01 실측으로 **철회**했다 — `brace-expansion@2.1.4`(취약)를 lockfile 에 실제로
고정한 상태에서 `--audit-level=low` 로 돌려도 `ignoreCves` 유무와 무관하게 0건이었다. 발동할
재료가 없는 축이라, 검증할 수 없는 코드가 "지킨다" 고 주장하게 두는 대신 지웠다.)

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

  3. **fail-closed** — audit 을 *실행하지 못한 것*은 "취약점 0건" 이 아니다. audit 은 취약점이
     있으면 비-0 으로 끝나 returncode 로 성공을 못 가리므로 출력 형태로 판정하는데, 그 판정이
     느슨하면 레지스트리 타임아웃·401 오류 페이로드가 초록불이 된다(축 1~3 을 다 통과한 채로).
     `_undecidable()` 로 exit 2 를 내는 지점은 **열**이다. audit 쪽 여섯 — 실행 실패(`pnpm`
     부재) / 타임아웃 / 빈 출력 / JSON 파싱 불가 / `actions` 키 없는 JSON(= 오류 페이로드
     판별) / `advisories` 하위 필드 드리프트. 설정 쪽 넷 — 워크스페이스 파일 부재 /
     읽기·YAML 파싱 불가 / `overrides` 가 매핑이 아님(키 부재·오타·값 없음·문자열·리스트를 한
     조건으로) / 추출 대상에 공백이 남음(체인 분할 실패 = 유령 대상). 개수는
     `FailClosedSiteCountTest` 가 소스와 **README 양쪽**에 대조해 강제한다 — 라운드마다 지점이
     늘 때도, 이번처럼 줄 때도 빠짐없이 빨간불을 내 문서 동반 갱신을 강제했다.

     반대로 **returncode 는 판정에 쓰지 않는다**: audit 은 취약점을 찾으면 비-0 으로 끝나므로
     성공 신호가 못 된다. `ReturncodeInvariantTest` 가 스텁을 exit 1 로 돌려 그 불변식을 고정한다.

  `SchemaDriftTest` 는 축이 아니라 **회귀 고정**이다 — `advisories` 하위 필드가 개명돼도
  "취약 0건" 으로 흘러가지 않는지 본다.
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
# 자신이 실행됐다는 마커. 이게 없으면 PATH 에서 **진짜** pnpm 이 뽑힌 것이고, 그러면 단언은
# 스텁 payload 가 아니라 실제 레지스트리 응답을 보게 된다 — 조용히 틀린 테스트다.
open(os.environ["STUB_RAN_MARKER"], "w").close()
# 실제 `pnpm audit --json` 과 같은 형태 — run_audit() 이 `actions` 키 존재로 정상 응답을
# 판정하므로(fail-closed) 스텁도 갖춰야 한다. 내용은 STUB_AUDIT_PAYLOAD 파일에서 읽는다.
sys.stdout.write(open(os.environ["STUB_AUDIT_PAYLOAD"], encoding="utf-8").read())
# 진짜 pnpm audit 은 취약점을 찾으면 비-0 으로 끝난다. 스텁이 늘 0 으로 끝나면
# "returncode 로 판단하지 않는다" 는 불변식이 통째로 미검증으로 남는다.
sys.exit(int(os.environ.get("STUB_AUDIT_EXIT", "0")))
"""


class StubNotUsed(AssertionError):
    """PATH 앞에 둔 스텁 대신 다른 `pnpm` 이 실행됐다."""


def _stage_script(tmp: Path) -> Path:
    """tmp 안에 스크립트 사본을 배치하고 그 경로를 돌려준다."""
    (tmp / "scripts").mkdir(exist_ok=True)
    dest = tmp / "scripts" / "check-override-floors.py"
    dest.write_text(SCRIPT.read_text(encoding="utf-8"), encoding="utf-8")
    return dest


def run_with_stub_audit(
    advisories: dict, overrides: str, actions: list | None = None,
    raw_stdout: str | None = None, stub_exit: int = 0,
    expect_stub_ran: bool = True,
) -> subprocess.CompletedProcess:
    """`pnpm audit` 을 스텁으로 갈아끼워 스크립트를 돌린다.

    실제 레지스트리에 의존하면 테스트가 네트워크·CVE 공시 상태에 흔들린다. PATH 앞에
    가짜 `pnpm` 을 두어 원하는 advisory 를 주입한다.

    `raw_stdout` 을 주면 정상 형태 대신 그 문자열을 그대로 뱉는다 — fail-closed 분기용.
    `stub_exit` 는 스텁의 종료 코드 — 실제 audit 은 취약점을 찾으면 비-0 으로 끝난다.
    `expect_stub_ran=False` 는 스크립트가 audit 전에 끝나는 경로(설정 fail-closed)용.

    **스텁이 실제로 실행됐는지 확인한다.** 리뷰가 50회 중 1회 exit 0(스텁이 돌았다면 나올 수
    없는 값)을 관측했다 — PATH 에서 진짜 `pnpm` 이 뽑히면 단언이 스텁 payload 가 아니라 실제
    레지스트리 응답을 보게 되고, 그건 조용히 틀린 테스트다. 두 겹으로 막는다:
      1. 스텁을 **원자적으로** 자리에 놓는다(임시 이름에 쓰고 chmod 한 뒤 rename). `execvp` 는
         PATH 항목이 EACCES 면 **다음 항목으로 넘어가므로**, 파일이 실행 불가 상태로 잠깐이라도
         보이면 진짜 pnpm 이 뽑힌다. rename 은 원자적이라 그 창이 없다.
      2. 스텁이 마커를 남기고, 없으면 `StubNotUsed` 로 즉시 실패시킨다 — 재발해도 조용하지 않다.
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
        # 실행 비트를 세운 뒤 **rename 으로** 자리에 놓는다 — `bin/pnpm` 이 실행 불가 상태로
        # 보이는 창이 없어야 execvp 가 다음 PATH 항목으로 새지 않는다.
        staged = bindir / ".pnpm.staged"
        staged.write_text(_PNPM_STUB, encoding="utf-8")
        staged.chmod(0o755)
        fake = bindir / "pnpm"
        os.replace(staged, fake)
        marker = tmp / "stub-ran"
        env = dict(
            os.environ,
            PATH=f"{bindir}:{os.environ['PATH']}",
            STUB_AUDIT_PAYLOAD=str(payload_file),
            STUB_AUDIT_EXIT=str(stub_exit),
            STUB_RAN_MARKER=str(marker),
        )
        proc = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True,
            text=True,
            env=env,
        )
        if expect_stub_ran and not marker.exists():
            raise StubNotUsed(
                "PATH 앞의 스텁이 실행되지 않았다 — 이 실행의 단언은 스텁 payload 가 아니라 "
                f"다른 `pnpm` 의 출력을 본 것이다.\n  exit={proc.returncode}\n"
                f"  stdout={proc.stdout[:500]}\n  stderr={proc.stderr[:500]}"
            )
        return proc


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

    def test_whitespace_in_extracted_target_is_undecidable(self):
        """`"next > postcss"` 처럼 사람이 넣은 공백은 유령 대상을 만든다.

        구분자 판정이 `>` **앞 글자**로 이뤄지므로 앞에 공백이 있으면 체인으로 안 갈린다
        (레인지의 `|| >3` 을 보호하려는 규칙의 반대편 부작용). 그러면 `'next > postcss'` 가
        그대로 대상이 되는데 npm 패키지명에 공백은 못 들어가므로 어떤 advisory 와도 매칭되지
        않는다 — 축 1 실패의 4번째 형제이고, 증상은 늘 같은 **조용한 통과**다.
        """
        for bad in ("next > postcss", "next >postcss", "a > b > c"):
            with self.subTest(key=bad):
                with self.assertRaises(SystemExit) as ctx:
                    self.mod.override_target(bad)
                self.assertEqual(ctx.exception.code, 2)
        # 공백이 **뒤에만** 있는 형태는 정상 분할된다 — 과잉 차단이 아님을 함께 고정.
        self.assertEqual(self.mod.override_target("next> postcss"), "postcss")

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

    def test_genuinely_empty_audit_still_passes(self):
        """빈 결과는 드리프트가 아니다 — 여기서 fail 하면 정상 상태가 상시 빨간불이 된다."""
        r = run_with_stub_audit({}, self.OVERRIDES, actions=[])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


class ReturncodeInvariantTest(unittest.TestCase):
    """audit 의 종료 코드는 성공 신호가 아니다 — 취약점을 찾으면 비-0 이다.

    스텁이 늘 exit 0 이던 동안 이 불변식은 통째로 미검증이었다: `proc.returncode != 0` 이면
    판단 불가로 돌리는 뮤턴트를 넣어도 28건이 전부 GREEN 이었다(리뷰가 실측). 실제 pnpm 이면
    정상적인 취약점 보고가 모조리 "판단 불가" 로 오분류된다 — 이 가드가 막으려는 실패의
    거울상이다.
    """

    OVERRIDES = MANAGED_OVERRIDES
    VULNERABLE = {"1": {"module_name": "liquidjs", "github_advisory_id": "GHSA-rc",
                        "patched_versions": ">=10.27.1"}}

    def test_nonzero_exit_with_valid_json_is_still_classified(self):
        r = run_with_stub_audit(self.VULNERABLE, self.OVERRIDES, stub_exit=1)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)   # 침식 fail, 판단 불가 아님
        self.assertIn("바닥이 낡아", r.stderr)
        self.assertIn("GHSA-rc", r.stderr)

    def test_nonzero_exit_with_no_findings_still_passes(self):
        """비-0 인데 결과가 비어 있어도 통과 — returncode 를 안 본다는 뜻이 양방향이다."""
        r = run_with_stub_audit({}, self.OVERRIDES, stub_exit=1)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("취약 재유입 0건", r.stdout)


class MissingOverridesKeyTest(unittest.TestCase):
    """`overrides` 키가 통째로 없으면 "대상 0개" 가 아니라 판단 불가다.

    `.get("overrides") or {}` 는 오타(`override:`)나 키 삭제를 조용히 빈 dict 로 바꾸고,
    그러면 어떤 advisory 도 대상에 안 걸려 **항상 exit 0** 이 된다. 파일 부재는 이미 갈랐는데
    이 경로만 남아 있었다.
    """

    def test_missing_overrides_key_is_undecidable(self):
        r = run_with_stub_audit({}, "packages:\n  - codebase/*\n", expect_stub_ran=False)  # overrides 없음
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("overrides", r.stderr)

    def test_typo_key_is_undecidable(self):
        r = run_with_stub_audit({}, "override:\n  liquidjs: ^10.27.1\n", expect_stub_ran=False)  # 단수형 오타
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        # exit code 만 보면 다른 _undecidable 사유로 잘못 합쳐져도 통과한다.
        self.assertIn("overrides", r.stderr)

    def test_valueless_overrides_is_undecidable(self):
        """`overrides:` 뒤에 값이 없으면 `None` 이라 순회가 0회 — 키는 있지만 목록은 없다."""
        r = run_with_stub_audit({}, "overrides:\npackages:\n  - codebase/*\n", expect_stub_ran=False)
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("매핑이 아니다", r.stderr)

    def test_non_mapping_overrides_is_undecidable(self):
        """매핑이 아닌 truthy 값(문자열·리스트)은 순회해도 의미가 없다."""
        for bad in ('overrides: "liquidjs"\n', "overrides:\n  - liquidjs\n"):
            with self.subTest(overrides=bad):
                r = run_with_stub_audit({}, bad, expect_stub_ran=False)
                self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
                self.assertIn("매핑이 아니다", r.stderr)

    def test_present_but_empty_overrides_is_allowed(self):
        """빈 `overrides: {}` 는 의도일 수 있다 — 판정 기준은 매핑 여부지 비었는지가 아니다."""
        r = run_with_stub_audit({}, "overrides: {}\n")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_diagnostic_survives_mixed_type_top_level_keys(self):
        """진단 메시지 조립 자체가 죽으면 안 된다.

        PyYAML 1.1 리졸버는 `on`/`yes`/`no` 를 **불리언**으로 만든다. 그러면 최상위 키에 타입이
        섞이고, 진단에 쓰는 `sorted(data)` 가 `TypeError` 로 죽어 exit 1 + traceback 이 된다 —
        하필 그 코드가 이 스크립트에서 "침식 발견" 을 뜻한다. `key=str` 이 그걸 막는다.
        """
        r = run_with_stub_audit(
            {}, 'overrides: "liquidjs"\non: true\n', expect_stub_ran=False
        )
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr)

    def test_unparseable_yaml_is_undecidable_not_exit_1(self):
        """구문 오류 YAML 이 exit 1 로 죽으면 "침식 발견" 과 같은 코드가 된다.

        `yaml.safe_load` 예외를 안 잡으면 traceback + 기본 exit 1 이다 — exit code 만 보는
        자동화는 그걸 정상 발견 신호로 읽는다. JSON 쪽은 이미 갈랐는데 YAML 쪽만 비어 있었다.
        """
        r = run_with_stub_audit({}, "overrides:\n\tliquidjs: ^10.27.1\n", expect_stub_ran=False)  # 탭 들여쓰기
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertIn("YAML", r.stderr)
        self.assertNotIn("Traceback", r.stderr)


class WorkspaceReadFailureTest(unittest.TestCase):
    """읽기 자체가 실패해도 판단 불가다 — 파싱 실패와 같은 부류인데 분기가 달랐다.

    `except yaml.YAMLError` 만 잡던 시절로 되돌려도 41건이 전부 GREEN 이었다(리뷰 실측).
    그 상태에서 유효하지 않은 UTF-8 을 주면 traceback + exit 1 — 이 스크립트에서 1 은
    "침식 발견" 이라 실행 실패가 정상 발견 신호와 같은 코드가 된다.
    """

    def _probe(self, write):
        import tempfile

        mod = _load_module()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "pnpm-workspace.yaml"
            write(path)
            with self.assertRaises(SystemExit) as ctx:
                mod.load_override_targets(path)
        return ctx.exception.code

    def test_invalid_utf8_is_undecidable(self):
        self.assertEqual(
            self._probe(lambda p: p.write_bytes(b"overrides:\n  liquidjs: \xff\xfe\n")), 2
        )

    def test_unreadable_file_is_undecidable(self):
        """`main()` 의 존재 확인과 읽기 사이의 TOCTOU 창 — 디렉터리를 주면 `IsADirectoryError`."""
        self.assertEqual(self._probe(lambda p: p.mkdir()), 2)


class AuditTimeoutTest(unittest.TestCase):
    """레지스트리가 물렸을 때의 분기 — 서브프로세스로는 300초를 기다려야 해 in-process 로 본다.

    이 분기는 추가 당시 어떤 테스트도 태우지 않았다: `except subprocess.TimeoutExpired` 를
    `subprocess.run` 이 결코 던지지 않는 예외 타입으로 바꿔도 33건이 전부 GREEN 이었다(리뷰
    실측). 그러면 실제 hang 때 traceback + exit 1 로 죽어 "침식 발견" 과 구분되지 않는다.
    """

    def test_timeout_exits_2(self):
        import subprocess as sp
        from unittest import mock

        mod = _load_module()
        with mock.patch.object(
            mod.subprocess, "run",
            side_effect=sp.TimeoutExpired(cmd="pnpm", timeout=mod._AUDIT_TIMEOUT_SEC),
        ):
            with self.assertRaises(SystemExit) as ctx:
                mod.run_audit()
        self.assertEqual(ctx.exception.code, 2)

    def test_missing_pnpm_binary_exits_2(self):
        """PATH 에 `pnpm` 이 없으면 exit 1(= 침식 발견) 이 아니라 판단 불가여야 한다."""
        from unittest import mock

        mod = _load_module()
        with mock.patch.object(
            mod.subprocess, "run", side_effect=FileNotFoundError(2, "No such file", "pnpm")
        ):
            with self.assertRaises(SystemExit) as ctx:
                mod.run_audit()
        self.assertEqual(ctx.exception.code, 2)

    def test_timeout_is_actually_passed_to_subprocess(self):
        """`timeout=` 인자가 실제로 넘어가는지 — 없으면 위 분기는 영원히 안 탄다."""
        from unittest import mock

        mod = _load_module()
        with mock.patch.object(mod.subprocess, "run") as run:
            run.return_value = mock.Mock(
                stdout='{"actions": [], "advisories": {}}', stderr="", returncode=0
            )
            mod.run_audit()
        self.assertEqual(run.call_args.kwargs.get("timeout"), mod._AUDIT_TIMEOUT_SEC)


class FailClosedSiteCountTest(unittest.TestCase):
    """docstring 이 말하는 fail-closed 지점 수를 소스에서 세어 강제한다.

    이 파일과 `README.md` 는 리뷰에서 **세 번** "축 개수 / 실패 횟수 / 형태 수" 가 실제와
    어긋난다는 지적을 받았다. 카탈로그 가드는 행의 *존재*만 보고 *내용*은 안 보므로 이 drift 는
    자동으로 안 잡힌다 — 그래서 최소한 이 수치만은 코드에 결속한다. 분기를 늘리면 여기서
    빨간불이 나고, 그때 docstring 도 같이 고치게 된다.
    """

    EXPECTED_SITES = 10

    def test_docstring_count_matches_source(self):
        src = SCRIPT.read_text(encoding="utf-8")
        # 정의부(`def _undecidable(`)는 호출이 아니다.
        sites = src.count("_undecidable(") - src.count("def _undecidable(")
        self.assertEqual(
            sites, self.EXPECTED_SITES,
            f"`_undecidable()` 호출 지점이 {sites}곳인데 이 파일의 docstring 과 "
            f"`.claude/tests/README.md` 는 {self.EXPECTED_SITES}곳으로 서술한다 — "
            "분기를 늘렸으면 두 문서와 EXPECTED_SITES 를 함께 고칠 것.",
        )
        self.assertIn("**열**", __doc__, "docstring 의 개수 표기가 EXPECTED_SITES 와 어긋난다")

    def test_readme_count_matches_source(self):
        """README 도 **실제로** 대조한다.

        종전 assertion 메시지는 "README 는 N곳으로 서술한다" 고 말했지만 README 를 읽지
        않았다 — 값을 아무거나 바꿔도 전 스위트가 GREEN 이었다(리뷰가 뮤턴트로 반증). 지금까지
        수치가 맞았던 건 테스트 강제가 아니라 매 라운드 손으로 함께 고친 결과였다. 문서 drift 를
        코드에 결속하려고 만든 테스트가 정작 문서의 절반을 안 보고 있었던 셈이다.
        """
        readme = (REPO_ROOT / ".claude" / "tests" / "README.md").read_text(encoding="utf-8")
        row = next(
            (ln for ln in readme.splitlines() if ln.startswith("| `test_override_floors.py`")),
            None,
        )
        self.assertIsNotNone(row, "README 카탈로그에서 이 파일 행을 못 찾았다")
        # 영문 서수로 적는 관례 — 숫자가 아니라 단어라 grep 이 아니라 매핑이 필요하다.
        WORDS = {6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve"}
        expected = WORDS[self.EXPECTED_SITES]
        self.assertIn(
            f"**{expected}** sites exit 2", row,
            f"README 카탈로그 행이 fail-closed 지점을 {expected}({self.EXPECTED_SITES})곳으로 "
            "서술하지 않는다 — 소스와 함께 갱신할 것.",
        )


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
