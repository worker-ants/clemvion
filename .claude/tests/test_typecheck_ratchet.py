"""타입체크 ratchet(backend·frontend)의 판정을 고정한다.

## 이 가드가 지키는 것

두 패키지 모두 **테스트 코드가 어떤 게이트에서도 타입체크되지 않는다**:

- backend — `nest build` 는 `tsconfig.build.json` 이라 `test/`·`**/*spec.ts` 를 exclude 하고
  jest 는 타입을 strip 한다.
- frontend — `tsconfig.json` **자신이** `src/test/**`·`*.test.ts(x)`·`**/__tests__/**` 를
  exclude 하고 `vitest run` 은 타입을 strip 한다.

ratchet 이 그 사각의 유일한 관측 지점이므로, **ratchet 자신이 조용히 통과하기 시작하면 사각이
그대로 돌아온다.** 그래서 "통과" 로 흘러갈 수 있는 경로를 우선 고정한다:

- baseline 이 없거나 형태가 깨졌을 때 **exit 2(판단 불가)** — 0건과 구별되지 않는 성공으로
  흘리면 가드가 사라진 것과 같다.
- 진단이 **줄었을 때도 실패** — 낮추지 않은 baseline 은 그 차이만큼 새 오류를 조용히
  받아들인다. "좋은 변화니까 통과" 로 두면 게이트가 시간이 지나며 헐거워진다.
- 스캔 대상이 **비지 않는다** — 설정이 조용히 좁아지면 baseline 이 0 으로 수렴해 무엇도
  걸리지 않는다.

`run_tsc` 는 실제 `npx tsc`(로컬 실측 backend ~60s / frontend ~40s)를 부르므로 판정
테스트에서는 주입으로 대체한다 — 여기서 검증하려는 것은 tsc 가 아니라 **대조 규칙**이다.

## 왜 한 파일이 두 패키지를 덮나

판정 규칙은 `scripts/_typecheck_ratchet.py` 하나에 있고 패키지별 엔트리포인트는 설정만 담는다.
사본을 만들면 규칙이 갈리는데 **틀리는 방향이 조용한 통과**라 특히 나쁘다 — 이 저장소는 같은
클래스(`plan_guard.py` ↔ `plan-stale-audit.sh`)로 이미 세 번 데였다.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _harness import REPO_ROOT

SCRIPTS = REPO_ROOT / "scripts"
CORE_PATH = SCRIPTS / "_typecheck_ratchet.py"


def load_module(path: Path, name: str):
    """경로로 모듈을 적재한다.

    `sys.modules` 에 **먼저 등록**하는 것은 필수다 — `@dataclass` 가 문자열 어노테이션을
    풀 때 `sys.modules[cls.__module__]` 을 찾으므로, 등록 없이 `exec_module` 하면
    `AttributeError: 'NoneType' object has no attribute '__dict__'` 로 죽는다.
    """
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# **엔트리포인트가 쓰는 것과 같은 이름**으로 적재한다. 다른 이름을 주면 `sys.modules` 에
# 두 벌이 생겨 `CORE.RatchetConfig` 와 엔트리포인트의 `CONFIG` 가 **다른 클래스**가 되고,
# `mock.patch.object(CORE, "run_tsc", …)` 도 실제 실행 경로를 못 건드린다 — 테스트가 통과해도
# 실제 배선은 무증거로 남는다(리뷰 testing WARNING). 아래 `EntrypointWiringTest` 가 고정한다.
CORE = load_module(CORE_PATH, "_typecheck_ratchet")

ENTRYPOINTS = {
    "backend": SCRIPTS / "check-backend-typecheck-ratchet.py",
    "frontend": SCRIPTS / "check-frontend-typecheck-ratchet.py",
}

CONFIGS = {
    label: load_module(path, f"ratchet_entry_{label}").CONFIG
    for label, path in ENTRYPOINTS.items()
}

# baseline 에 들어와도 되는 것은 **테스트 파일뿐**이다. 패키지마다 테스트 파일의 형태가
# 다르므로 규칙도 갈라 적는다 — 각 패키지 tsconfig 의 exclude 목록과 짝을 이룬다.
TEST_FILE_RULES = {
    "backend": re.compile(r"\.spec\.tsx?$"),
    # frontend 는 `tsconfig.json` 의 exclude 목록과 **1:1** 로 맞춘다 — 한 패턴이라도
    # 빠지면 그 형태의 테스트 파일이 "프로덕션" 으로 오분류돼 아래 단언이 거짓 실패한다.
    # (초판은 `*.spec.ts(x)` 를 빠뜨렸다 — 이 PR 이 스스로 경고하는 "규칙이 갈린다" 의 축소판.)
    "frontend": re.compile(r"(?:^|/)__tests__/|\.(?:test|spec)\.tsx?$|(?:^|/)src/test/"),
}

# `tsconfig.json` 의 exclude 글롭 ↔ 그 글롭이 겨냥하는 대표 경로. 위 정규식이 **전부**
# 덮는지 아래 테스트가 전수로 확인한다 — 키워드를 넓히는 대신 열거해서 0 으로 만든다.
FRONTEND_EXCLUDE_SAMPLES = {
    "src/test/**": "src/test/setup.ts",
    "src/**/*.test.ts": "src/lib/a.test.ts",
    "src/**/*.test.tsx": "src/components/a.test.tsx",
    "src/**/*.spec.ts": "src/lib/a.spec.ts",
    "src/**/*.spec.tsx": "src/components/a.spec.tsx",
    "src/**/__tests__/**": "src/lib/__tests__/a.ts",
}

SAMPLE = """src/modules/a/a.spec.ts(12,34): error TS2554: Expected 8 arguments, but got 7.
src/modules/a/a.spec.ts(40,3): error TS2339: Property 'x' does not exist on type '{}'.
  타입 상세가 이어지는 들여쓴 줄 — 진단이 아니다.
src/modules/b/b.spec.ts(7,1): error TS2304: Cannot find name 'Foo'.
Found 3 errors in 2 files.
"""


def fake_config(baseline: Path) -> object:
    """판정 테스트용 최소 설정 — 실제 패키지를 건드리지 않는다."""
    return CORE.RatchetConfig(
        label="fake",
        package_dir=Path("/nonexistent"),
        tsconfig="tsconfig.json",
        baseline=baseline,
        script="scripts/fake.py",
        blind_spot="테스트용",
    )


class ParseTest(unittest.TestCase):
    def test_counts_diagnostics_per_file(self):
        self.assertEqual(
            CORE.count_by_file(SAMPLE),
            {"src/modules/a/a.spec.ts": 2, "src/modules/b/b.spec.ts": 1},
        )

    def test_ignores_continuation_and_summary_lines(self):
        """들여쓴 상세 줄·`Found N errors` 요약을 진단으로 세면 수치가 부풀어 baseline 이
        실제보다 높아지고, 그 차이만큼 새 오류가 조용히 통과한다."""
        self.assertEqual(sum(CORE.count_by_file(SAMPLE).values()), 3)

    def test_empty_output_is_clean_not_an_error(self):
        # 진단이 하나도 없으면 tsc 는 아무것도 출력하지 않는다.
        self.assertEqual(CORE.count_by_file(""), {})

    def test_paths_containing_parentheses_are_counted(self):
        """Next.js App Router 의 **route group** 경로에는 리터럴 `(` 가 들어간다.

        종전 패턴은 파일 부분을 `[^(]*` 로 잡아 첫 여는 괄호에서 끊었고, 그래서
        `src/app/(main)/…` 아래 진단이 **한 건도 세어지지 않았다** — 이 저장소가 실제로 쓰는
        구조라 그 트리 전체가 게이트의 사각이었다(리뷰 requirement CRITICAL, 실측 51 vs 52).

        게이트가 조용히 통과하기 시작하는 형태라, 실제로 숨어 있던 그 경로를 픽스처로 고정한다.
        """
        line = (
            "src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx"
            "(44,3): error TS2322: Type 'X' is not assignable"
        )
        self.assertEqual(
            CORE.count_by_file(line),
            {"src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx": 1},
        )

    def test_indented_continuation_with_a_position_is_still_ignored(self):
        """탐욕도를 낮추면서 **들여쓴 상세 줄**까지 잡지 않는지 — 반대 방향 대조군.

        상세 줄이 우연히 `(1,1): error TS…` 형태를 담을 수 있는데, 그것을 진단으로 세면
        baseline 이 부풀고 그 차이만큼 새 오류가 조용히 통과한다.
        """
        self.assertEqual(CORE.count_by_file("  상세가 이어지는 줄(1,1): error TS1: x"), {})


class VerdictTest(unittest.TestCase):
    """baseline 대조 규칙. `main()` 을 실제로 돌려 exit code 를 본다."""

    def run_main(self, counts: dict[str, int], baseline: dict[str, int]) -> int:
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        tmp.write_text(json.dumps({"total": sum(baseline.values()), "files": baseline}), "utf-8")
        fake_output = "\n".join(
            f"{f}({i + 1},1): error TS9999: x" for f, n in counts.items() for i in range(n)
        )
        with mock.patch.object(CORE, "run_tsc", lambda cfg: fake_output):
            return CORE.main(fake_config(tmp), [])

    def test_equal_passes(self):
        self.assertEqual(self.run_main({"a.spec.ts": 2}, {"a.spec.ts": 2}), 0)

    def test_increase_fails(self):
        self.assertEqual(self.run_main({"a.spec.ts": 3}, {"a.spec.ts": 2}), 1)

    def test_new_file_fails(self):
        """baseline 에 없던 파일이 진단을 내면 새 오류다 — `.get(f, 0)` 이 0 을 주므로
        증가로 잡혀야 한다."""
        self.assertEqual(self.run_main({"new.spec.ts": 1}, {"a.spec.ts": 2}), 1)

    def test_decrease_also_fails(self):
        """줄어든 것도 실패다 — 낮추지 않은 baseline 은 차이만큼 새 오류를 조용히 받아들인다."""
        self.assertEqual(self.run_main({"a.spec.ts": 1}, {"a.spec.ts": 2}), 1)

    def test_file_dropping_to_zero_fails(self):
        # 파일이 통째로 clean 해지면 `counts` 에서 사라진다 — 감소 판정이 그것도 봐야 한다.
        self.assertEqual(self.run_main({}, {"a.spec.ts": 2}), 1)

    def test_clean_tree_with_clean_baseline_passes(self):
        self.assertEqual(self.run_main({}, {}), 0)


class FailClosedTest(unittest.TestCase):
    """"판단 불가" 가 성공으로 흘러가지 않는지. 전부 exit 2 여야 한다."""

    def call_load(self, write) -> int:
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        write(tmp)
        with self.assertRaises(SystemExit) as ctx:
            CORE.load_baseline(fake_config(tmp))
        return ctx.exception.code

    def test_missing_baseline_is_undecidable(self):
        self.assertEqual(self.call_load(lambda p: None), 2)

    def test_unparseable_baseline_is_undecidable(self):
        self.assertEqual(self.call_load(lambda p: p.write_text("{not json", "utf-8")), 2)

    def test_files_not_a_mapping_is_undecidable(self):
        self.assertEqual(
            self.call_load(lambda p: p.write_text(json.dumps({"files": []}), "utf-8")), 2
        )

    def test_non_integer_counts_are_undecidable(self):
        self.assertEqual(
            self.call_load(
                lambda p: p.write_text(json.dumps({"files": {"a.ts": "2"}}), "utf-8")
            ),
            2,
        )


class RunTscFailClosedTest(unittest.TestCase):
    """`run_tsc()` 자체의 fail-closed 분기.

    `VerdictTest` 는 `run_tsc` 를 통째로 주입으로 대체하므로 이 세 분기를 **한 번도
    실행하지 않는다** — 모듈 docstring 이 보장하는 불변식의 절반이 무증거로 남는다.
    여기서 `subprocess.run` 만 바꿔 실제 함수를 태운다.
    """

    def expect_exit_2(self, **run_kwargs) -> int:
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        with mock.patch.object(CORE.subprocess, "run", **run_kwargs):
            with self.assertRaises(SystemExit) as ctx:
                CORE.run_tsc(fake_config(tmp))
        return ctx.exception.code

    def test_timeout_is_undecidable(self):
        self.assertEqual(
            self.expect_exit_2(
                side_effect=CORE.subprocess.TimeoutExpired(cmd="tsc", timeout=1)
            ),
            2,
        )

    def test_missing_executable_is_undecidable(self):
        # `npx` 가 없거나 실행할 수 없는 경우. 잡지 않으면 traceback + exit 1 이 되는데
        # 이 스크립트 어휘에서 1 은 "baseline 위반" 이라 실행 실패가 정상 발견과 같은 코드가 된다.
        self.assertEqual(self.expect_exit_2(side_effect=OSError("no npx")), 2)

    def test_nonzero_exit_with_empty_stdout_is_undecidable(self):
        """tsc 가 비-0 인데 stdout 이 비었으면 진단이 아니라 설정/실행 오류다 —
        빈 출력을 "진단 0건" 으로 읽으면 baseline 전체가 감소로 보여 판정이 뒤집힌다."""
        proc = mock.Mock(returncode=2, stdout="", stderr="error TS5023: Unknown option")
        self.assertEqual(self.expect_exit_2(return_value=proc), 2)

    def test_clean_run_returns_empty_output(self):
        # 진단이 없으면 tsc 는 exit 0 + 빈 stdout 이다. 이건 정상이라 throw 하면 안 된다 —
        # 위 분기와 **같은 입력(빈 stdout)** 이라 returncode 로만 갈린다.
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        proc = mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(CORE.subprocess, "run", return_value=proc):
            self.assertEqual(CORE.run_tsc(fake_config(tmp)), "")

    def test_tsc_is_invoked_with_the_configured_tsconfig(self):
        """엔트리포인트의 `tsconfig` 설정이 실제 명령에 실린다.

        frontend 는 전용 `tsconfig.typecheck.json` 을 써야 테스트가 프로그램에 들어간다 —
        이 인자가 조용히 `tsconfig.json` 으로 돌아가면 스캔 대상이 통째로 빠지는데
        **진단 0건은 성공처럼 보인다.**
        """
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        proc = mock.Mock(returncode=0, stdout="", stderr="")
        cfg = CORE.RatchetConfig(
            label="fake",
            package_dir=Path("/nonexistent"),
            tsconfig="tsconfig.typecheck.json",
            baseline=tmp,
            script="scripts/fake.py",
            blind_spot="테스트용",
        )
        with mock.patch.object(CORE.subprocess, "run", return_value=proc) as run:
            CORE.run_tsc(cfg)
        self.assertEqual(run.call_args.args[0][-1], "tsconfig.typecheck.json")


class UpdateBaselineTest(unittest.TestCase):
    """`--update` 정상 경로.

    baseline 을 낮추는 유일한 수단이라, 이 경로가 깨지면 "줄었는데 못 낮춘다" 로 게이트가
    영구 red 가 되고, 결국 사람이 baseline 을 손으로 편집하게 된다 — 그러면 `total` 과
    파일별 합이 어긋나는 등 형태가 조용히 깨진다.
    """

    def test_update_writes_current_counts_and_round_trips(self):
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        output = (
            "a.spec.ts(1,1): error TS1: x\na.spec.ts(2,1): error TS1: x\n"
            "b.spec.ts(1,1): error TS1: x\n"
        )
        with mock.patch.object(CORE, "run_tsc", lambda cfg: output):
            self.assertEqual(CORE.main(fake_config(tmp), ["--update"]), 0)

        data = json.loads(tmp.read_text(encoding="utf-8"))
        self.assertEqual(data["files"], {"a.spec.ts": 2, "b.spec.ts": 1})
        self.assertEqual(data["total"], 3, "`total` 이 파일별 합과 일치해야 한다")
        self.assertEqual(
            list(data["files"]), sorted(data["files"]), "정렬돼야 diff 가 안정적이다"
        )

        # 방금 쓴 baseline 으로 곧바로 검사하면 통과해야 한다 — 그렇지 않으면
        # `--update` 후에도 CI 가 빨간불이라 낮추는 경로가 사실상 없는 것이다.
        with mock.patch.object(CORE, "run_tsc", lambda cfg: output):
            self.assertEqual(CORE.main(fake_config(tmp), []), 0)

    def test_update_on_a_clean_tree_writes_an_empty_map(self):
        # 언젠가 잔여가 0 이 되는 경우. 빈 `files` 로도 round-trip 이 되어야 한다.
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        with mock.patch.object(CORE, "run_tsc", lambda cfg: ""):
            self.assertEqual(CORE.main(fake_config(tmp), ["--update"]), 0)
        data = json.loads(tmp.read_text(encoding="utf-8"))
        self.assertEqual(data["files"], {})
        self.assertEqual(data["total"], 0)


class PerPackageShapeTest(unittest.TestCase):
    """두 패키지 각각의 엔트리포인트·커밋된 baseline. subTest 로 **둘 다** 돈다."""

    def test_entrypoints_exist_and_are_executable(self):
        for label, path in ENTRYPOINTS.items():
            with self.subTest(package=label):
                self.assertTrue(path.is_file(), f"{path} 부재")
                self.assertTrue(path.stat().st_mode & 0o111, "실행 권한 없음")

    def test_configs_point_at_real_paths(self):
        for label, cfg in CONFIGS.items():
            with self.subTest(package=label):
                self.assertEqual(cfg.label, label)
                self.assertTrue(cfg.package_dir.is_dir(), f"{cfg.package_dir} 부재")
                self.assertTrue(
                    (cfg.package_dir / cfg.tsconfig).is_file(),
                    f"{cfg.package_dir / cfg.tsconfig} 부재 — tsc 가 즉시 실패한다",
                )
                self.assertTrue(cfg.baseline.is_file(), f"{cfg.baseline} 부재")

    def test_committed_baselines_are_wellformed(self):
        """CI 가 읽는 실제 baseline 이다 — 형태가 깨지면 잡이 exit 2 로 죽는다."""
        for label, cfg in CONFIGS.items():
            with self.subTest(package=label):
                data = json.loads(cfg.baseline.read_text(encoding="utf-8"))
                self.assertIsInstance(data.get("files"), dict)
                self.assertTrue(
                    data["files"], "baseline 이 비었다 — 대조 대상이 0건이 된다"
                )
                self.assertTrue(all(isinstance(v, int) for v in data["files"].values()))
                self.assertEqual(
                    data["total"],
                    sum(data["files"].values()),
                    "`total` 이 파일별 합과 다르다 — 손으로 편집된 흔적",
                )

    def test_baselines_only_list_test_files(self):
        """착수 시점 실측은 두 패키지 모두 진단이 **전부 테스트 파일**이었다
        (backend 209건/40파일 2026-08-09 · frontend 52건/15파일 2026-09-02).

        프로덕션 파일이 baseline 에 들어오는 것은 "빌드가 통과하는데 전체 체크는 실패" 라는
        뜻이라 수용이 아니라 조사 대상이다.
        """
        for label, cfg in CONFIGS.items():
            with self.subTest(package=label):
                rule = TEST_FILE_RULES[label]
                data = json.loads(cfg.baseline.read_text(encoding="utf-8"))
                production = [f for f in data["files"] if not rule.search(f)]
                self.assertEqual(
                    production,
                    [],
                    "프로덕션 파일이 타입 진단을 내고 있다 — baseline 에 수용하지 말고 조사할 것",
                )


class EntrypointWiringTest(unittest.TestCase):
    """**실제 엔트리포인트의 `CONFIG` 가 실제 `main` 을 통과하는가.**

    다른 테스트는 전부 합성 `fake_config` 를 쓴다 — 대조 규칙을 보는 데는 그것이 맞지만,
    그러면 "엔트리포인트가 코어와 제대로 배선돼 있는가" 는 **한 번도 실행되지 않는다.**
    초판이 정확히 그 상태였다: 테스트가 코어를 `typecheck_ratchet_core` 라는 다른 이름으로
    적재해 `sys.modules` 에 두 벌이 생겼고, `CONFIG` 는 **다른 클래스**의 인스턴스였으며
    `mock.patch.object(CORE, …)` 는 실제 경로를 못 건드렸다(리뷰 testing WARNING).
    """

    def test_configs_are_instances_of_the_core_dataclass(self):
        """두 벌 적재를 직접 잡는다 — 이름이 갈리면 `isinstance` 가 곧바로 거짓이 된다."""
        for label, cfg in CONFIGS.items():
            with self.subTest(package=label):
                self.assertIsInstance(cfg, CORE.RatchetConfig)

    def test_committed_baseline_round_trips_through_real_main(self):
        """커밋된 baseline 과 **정확히 같은** 진단을 주입하면 실제 `main` 이 0 이어야 한다.

        합성 config 가 아니라 엔트리포인트가 실제로 들고 있는 `CONFIG` 를 태운다 — 경로·
        tsconfig·baseline 이 서로 안 맞으면 여기서 드러난다. tsc 는 주입으로 대체하므로
        느리지 않다.
        """
        for label, cfg in CONFIGS.items():
            with self.subTest(package=label):
                data = json.loads(cfg.baseline.read_text(encoding="utf-8"))
                fake = "\n".join(
                    f"{f}({i + 1},1): error TS9999: x"
                    for f, n in data["files"].items()
                    for i in range(n)
                )
                with mock.patch.object(CORE, "run_tsc", lambda c: fake):
                    self.assertEqual(CORE.main(cfg, []), 0)


class FrontendExcludeCoverageTest(unittest.TestCase):
    """`TEST_FILE_RULES["frontend"]` 가 tsconfig 의 exclude 목록을 **전부** 덮는가.

    한 패턴이라도 빠지면 그 형태의 테스트 파일이 baseline 에 들어왔을 때 "프로덕션 파일" 로
    오분류돼 `test_baselines_only_list_test_files` 가 거짓 실패한다. 초판은 `*.spec.ts(x)` 를
    빠뜨렸다 — 이 PR 이 스스로 경고하는 "같은 규칙의 사본이 갈린다" 의 축소판이다.

    키워드를 넓히는 대신 **tsconfig 의 글롭을 전수 열거**해 0 으로 만든다.
    """

    def test_rule_covers_every_exclude_glob(self):
        rule = TEST_FILE_RULES["frontend"]
        for glob, sample in FRONTEND_EXCLUDE_SAMPLES.items():
            with self.subTest(glob=glob):
                self.assertRegex(
                    sample,
                    rule,
                    f"exclude 글롭 {glob!r} 이 겨냥하는 {sample!r} 를 규칙이 못 잡는다",
                )

    def test_sample_set_matches_the_real_tsconfig(self):
        """전제 테스트 — 위 표본이 **실제 tsconfig 의 exclude 목록**과 같은 집합인가.

        표본이 낡으면 위 테스트는 통과하면서도 새로 추가된 exclude 를 못 본다. 입력 집합
        자체가 커버리지라 줄이는 편집이 조용히 통과하는 자리다.
        """
        cfg = CONFIGS["frontend"]
        base = json.loads(
            (cfg.package_dir / "tsconfig.json").read_text(encoding="utf-8")
        )
        excludes = [g for g in base["exclude"] if g != "node_modules"]
        self.assertEqual(
            sorted(excludes),
            sorted(FRONTEND_EXCLUDE_SAMPLES),
            "tsconfig 의 exclude 목록이 바뀌었다 — 표본과 규칙을 함께 갱신할 것",
        )

    def test_production_paths_are_not_matched(self):
        """대조군 — 규칙이 너무 넓어지면 프로덕션 오류가 baseline 에 조용히 수용된다."""
        rule = TEST_FILE_RULES["frontend"]
        for path in ("src/lib/docs/registry.ts", "src/components/button.tsx", "src/app/page.tsx"):
            with self.subTest(path=path):
                self.assertNotRegex(path, rule)


class AmbientDeclarationIsAModuleTest(unittest.TestCase):
    """`vitest-matchers.d.ts` 가 **모듈 파일**인가 — 이번 사고의 핵심 불변식.

    `declare module "vitest"` 는 파일이 모듈일 때만 **augmentation** 이고, global script
    문맥에서는 vitest 의 실제 타입을 통째로 덮는 **shadowing** 이다. 그 상태가 얼마나
    오래갔는지 아무도 몰랐던 이유는 이 파일이 어떤 게이트에도 안 걸렸기 때문이다.

    ratchet 이 이제 그것을 잡지만 40초짜리 tsc 를 돌려야 한다. top-level `import`/`export`
    한 줄이 사라지는 것이 정확히 그 사고의 재발 조건이므로, **밀리초 안에 도는 가드**를
    따로 둔다(리뷰 testing INFO).
    """

    def test_vitest_matchers_has_a_top_level_import_or_export(self):
        path = (
            CONFIGS["frontend"].package_dir / "src" / "test" / "vitest-matchers.d.ts"
        )
        self.assertTrue(path.is_file(), f"{path} 부재")
        lines = path.read_text(encoding="utf-8").splitlines()
        top_level = [
            l for l in lines if l.startswith("import ") or l.startswith("export ")
        ]
        self.assertTrue(
            top_level,
            f"{path.name} 에 top-level `import`/`export` 가 없다 — 이 파일은 global script 가 "
            "되고 `declare module \"vitest\"` 는 augmentation 이 아니라 **shadowing** 이 된다 "
            "(2026-09-02 실측: 그 상태에서 TS2305 1,256건).",
        )


class FrontendTypecheckConfigTest(unittest.TestCase):
    """frontend 전용 config 가 **테스트를 실제로 포함**하는지.

    backend 는 `tsconfig.json` 이 이미 테스트를 포함하지만 frontend 는 그 파일이 테스트를
    exclude 한다. 그래서 전용 config 가 필요하고, 그 config 의 `exclude` 가 조용히 원본을
    물려받으면 **스캔 대상이 0 이 되면서 진단도 0 이 된다** — 성공처럼 보이는 실패다.
    """

    def config_path(self) -> Path:
        cfg = CONFIGS["frontend"]
        return cfg.package_dir / cfg.tsconfig

    def test_exclude_is_redeclared_to_node_modules_only(self):
        raw = json.loads(self.config_path().read_text(encoding="utf-8"))
        self.assertEqual(
            raw.get("exclude"),
            ["node_modules"],
            "`extends` 는 `exclude` 를 병합하지 않고 교체한다 — 여기서 재선언하지 않으면 "
            "원본의 테스트 exclude 가 그대로 살아 스캔 대상이 사라진다",
        )

    def test_incremental_is_disabled(self):
        """`.tsbuildinfo` 캐시가 남으면 같은 입력이 다른 수치를 낸다 — 실제로 이 config 를
        만들기 전 임시 config 로 재던 중 그 일이 났다. ratchet 은 정확 대조라 그 차이가 곧
        오판이다."""
        raw = json.loads(self.config_path().read_text(encoding="utf-8"))
        self.assertIs(raw.get("compilerOptions", {}).get("incremental"), False)

    def test_baseline_contains_files_the_base_config_excludes(self):
        """전제 테스트 — baseline 이 **base config 가 제외하는 파일**을 담고 있어야 한다.

        담고 있지 않다면 이 ratchet 은 `tsconfig.json` 과 같은 것을 보고 있다는 뜻이고,
        그러면 이 게이트가 존재할 이유가 없다.
        """
        cfg = CONFIGS["frontend"]
        data = json.loads(cfg.baseline.read_text(encoding="utf-8"))
        rule = TEST_FILE_RULES["frontend"]
        covered = [f for f in data["files"] if rule.search(f)]
        self.assertTrue(
            covered,
            "baseline 에 테스트 파일이 하나도 없다 — 전용 config 가 base 와 같은 집합을 보고 있다",
        )


if __name__ == "__main__":
    unittest.main()
