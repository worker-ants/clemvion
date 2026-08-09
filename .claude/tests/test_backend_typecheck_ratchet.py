"""`scripts/check-backend-typecheck-ratchet.py` 의 판정을 고정한다.

## 이 가드가 지키는 것

backend 의 `*.spec.ts` 는 **어떤 게이트에서도 타입체크되지 않는다** — `nest build` 는
`tsconfig.build.json` 이라 그 파일들을 exclude 하고, jest 는 타입을 strip 한다. ratchet 이
그 사각의 유일한 관측 지점이므로, ratchet 자신이 조용히 통과하기 시작하면 사각이 그대로
돌아온다.

그래서 **"통과" 로 흘러갈 수 있는 경로**를 우선 고정한다:

- baseline 이 없거나 형태가 깨졌을 때 **exit 2(판단 불가)** — 0건과 구별되지 않는 성공으로
  흘리면 가드가 사라진 것과 같다.
- 진단이 **줄었을 때도 실패** — 낮추지 않은 baseline 은 그 차이만큼 새 오류를 조용히
  받아들인다. "좋은 변화니까 통과" 로 두면 게이트가 시간이 지나며 헐거워진다.

`run_tsc` 는 실제 `npx tsc`(로컬 실측 ~60s)를 부르므로 판정 테스트에서는 주입으로
대체한다 — 여기서 검증하려는 것은 tsc 가 아니라 **대조 규칙**이다.
"""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _harness import REPO_ROOT

SCRIPT = REPO_ROOT / "scripts" / "check-backend-typecheck-ratchet.py"
BASELINE = REPO_ROOT / "scripts" / "backend-typecheck-baseline.json"


def load_module():
    spec = importlib.util.spec_from_file_location("check_backend_typecheck_ratchet", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


MOD = load_module()

SAMPLE = """src/modules/a/a.spec.ts(12,34): error TS2554: Expected 8 arguments, but got 7.
src/modules/a/a.spec.ts(40,3): error TS2339: Property 'x' does not exist on type '{}'.
  타입 상세가 이어지는 들여쓴 줄 — 진단이 아니다.
src/modules/b/b.spec.ts(7,1): error TS2304: Cannot find name 'Foo'.
Found 3 errors in 2 files.
"""


class ParseTest(unittest.TestCase):
    def test_counts_diagnostics_per_file(self):
        self.assertEqual(
            MOD.count_by_file(SAMPLE),
            {"src/modules/a/a.spec.ts": 2, "src/modules/b/b.spec.ts": 1},
        )

    def test_ignores_continuation_and_summary_lines(self):
        """들여쓴 상세 줄·`Found N errors` 요약을 진단으로 세면 수치가 부풀어 baseline 이
        실제보다 높아지고, 그 차이만큼 새 오류가 조용히 통과한다."""
        self.assertEqual(sum(MOD.count_by_file(SAMPLE).values()), 3)

    def test_empty_output_is_clean_not_an_error(self):
        # 진단이 하나도 없으면 tsc 는 아무것도 출력하지 않는다.
        self.assertEqual(MOD.count_by_file(""), {})


class VerdictTest(unittest.TestCase):
    """baseline 대조 규칙. `main()` 을 실제로 돌려 exit code 를 본다."""

    def run_main(self, counts: dict[str, int], baseline: dict[str, int]) -> int:
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        tmp.write_text(json.dumps({"total": sum(baseline.values()), "files": baseline}), "utf-8")
        fake_output = "\n".join(
            f"{f}({i + 1},1): error TS9999: x" for f, n in counts.items() for i in range(n)
        )
        with mock.patch.object(MOD, "BASELINE", tmp), mock.patch.object(
            MOD, "run_tsc", lambda: fake_output
        ), mock.patch("sys.argv", ["ratchet"]):
            return MOD.main()

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
        with mock.patch.object(MOD, "BASELINE", tmp):
            with self.assertRaises(SystemExit) as ctx:
                MOD.load_baseline()
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
    실행하지 않는다** — 모듈 docstring 이 보장하는 불변식의 절반이 무증거로 남는다
    (ai-review WARNING #2). 여기서 `subprocess.run` 만 바꿔 실제 함수를 태운다.
    """

    def expect_exit_2(self, **run_kwargs) -> int:
        with mock.patch.object(MOD.subprocess, "run", **run_kwargs):
            with self.assertRaises(SystemExit) as ctx:
                MOD.run_tsc()
        return ctx.exception.code

    def test_timeout_is_undecidable(self):
        self.assertEqual(
            self.expect_exit_2(
                side_effect=MOD.subprocess.TimeoutExpired(cmd="tsc", timeout=1)
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
        proc = mock.Mock(returncode=0, stdout="", stderr="")
        with mock.patch.object(MOD.subprocess, "run", return_value=proc):
            self.assertEqual(MOD.run_tsc(), "")


class UpdateBaselineTest(unittest.TestCase):
    """`--update` 정상 경로 (ai-review WARNING #3).

    baseline 을 낮추는 유일한 수단이라, 이 경로가 깨지면 "줄었는데 못 낮춘다" 로 게이트가
    영구 red 가 되고, 결국 사람이 baseline 을 손으로 편집하게 된다 — 그러면 `total` 과
    파일별 합이 어긋나는 등 형태가 조용히 깨진다.
    """

    def test_update_writes_current_counts_and_round_trips(self):
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        output = "a.spec.ts(1,1): error TS1: x\na.spec.ts(2,1): error TS1: x\nb.spec.ts(1,1): error TS1: x\n"
        with mock.patch.object(MOD, "BASELINE", tmp), mock.patch.object(
            MOD, "run_tsc", lambda: output
        ), mock.patch("sys.argv", ["ratchet", "--update"]):
            self.assertEqual(MOD.main(), 0)

        data = json.loads(tmp.read_text(encoding="utf-8"))
        self.assertEqual(data["files"], {"a.spec.ts": 2, "b.spec.ts": 1})
        self.assertEqual(data["total"], 3, "`total` 이 파일별 합과 일치해야 한다")
        self.assertEqual(
            list(data["files"]), sorted(data["files"]), "정렬돼야 diff 가 안정적이다"
        )

        # 방금 쓴 baseline 으로 곧바로 검사하면 통과해야 한다 — 그렇지 않으면
        # `--update` 후에도 CI 가 빨간불이라 낮추는 경로가 사실상 없는 것이다.
        with mock.patch.object(MOD, "BASELINE", tmp), mock.patch.object(
            MOD, "run_tsc", lambda: output
        ), mock.patch("sys.argv", ["ratchet"]):
            self.assertEqual(MOD.main(), 0)

    def test_update_on_a_clean_tree_writes_an_empty_map(self):
        # 언젠가 잔여가 0 이 되는 경우. 빈 `files` 로도 round-trip 이 되어야 한다.
        tmp = Path(tempfile.mkdtemp()) / "baseline.json"
        with mock.patch.object(MOD, "BASELINE", tmp), mock.patch.object(
            MOD, "run_tsc", lambda: ""
        ), mock.patch("sys.argv", ["ratchet", "--update"]):
            self.assertEqual(MOD.main(), 0)
        data = json.loads(tmp.read_text(encoding="utf-8"))
        self.assertEqual(data["files"], {})
        self.assertEqual(data["total"], 0)


class ShapeTest(unittest.TestCase):
    def test_script_exists_and_is_executable(self):
        self.assertTrue(SCRIPT.is_file(), f"{SCRIPT} 부재")
        self.assertTrue(SCRIPT.stat().st_mode & 0o111, "실행 권한 없음")

    def test_committed_baseline_is_wellformed(self):
        """CI 가 읽는 실제 baseline 이다 — 형태가 깨지면 잡이 exit 2 로 죽는다."""
        data = json.loads(BASELINE.read_text(encoding="utf-8"))
        self.assertIsInstance(data.get("files"), dict)
        self.assertTrue(data["files"], "baseline 이 비었다 — 대조 대상이 0건이 된다")
        self.assertTrue(all(isinstance(v, int) for v in data["files"].values()))
        self.assertEqual(data["total"], sum(data["files"].values()),
                         "`total` 이 파일별 합과 다르다 — 손으로 편집된 흔적")

    def test_baseline_only_lists_test_files(self):
        """착수 시점 실측: 진단 209건이 **전부** 테스트 파일이었고 프로덕션은 0건이었다.
        프로덕션 파일이 baseline 에 들어오는 것은 "빌드가 통과하는데 전체 체크는 실패" 라는
        뜻이라 수용이 아니라 조사 대상이다."""
        data = json.loads(BASELINE.read_text(encoding="utf-8"))
        production = [f for f in data["files"] if not f.endswith(".spec.ts")]
        self.assertEqual(
            production, [],
            "프로덕션 파일이 타입 진단을 내고 있다 — baseline 에 수용하지 말고 조사할 것",
        )


if __name__ == "__main__":
    unittest.main()
