"""Black-box tests for `run-test-all.sh` — the 4-stage sequencer.

The tool exists because a pipe eats the exit code: `run-test.sh lint | tail -2`
is exit 0 even when lint failed. Two things must therefore hold, and the second
is the one that is easy to lose in a refactor:

  1. the first failing stage's exit code propagates **verbatim**, and
  2. the verdict is also on **stdout** — `| tail -1` must still tell the truth.

Same idiom as `test_run_test_watchdog.py`: a stub `test-stages.sh` injected via
`RUN_TEST_CONFIG`, cwd outside any git repo so logs land in the temp dir, and a
hard `timeout=` on every subprocess so a regression fails instead of hanging.
"""

from __future__ import annotations

import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

import _harness  # noqa: F401  — side effect: harness path setup / REPO_ROOT

RUN_ALL = _harness.REPO_ROOT / ".claude" / "tools" / "run-test-all.sh"

# `cmd_<stage>` per real stage name. Each stage's return code is a template slot,
# so `_config(unit=1)` makes exactly that stage fail and the rest pass.
STUB_TEMPLATE = textwrap.dedent(
    """\
    cmd_lint()  { echo "lint ran";  return %d; }
    cmd_unit()  { echo "unit ran";  return %d; }
    cmd_build() { echo "build ran"; return %d; }
    cmd_e2e()   { echo "e2e ran";   return %d; }
    """
)


class RunTestAllTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)

    def _config(self, lint=0, unit=0, build=0, e2e=0) -> Path:
        cfg = self.tmp / "test-stages.sh"
        cfg.write_text(STUB_TEMPLATE % (lint, unit, build, e2e), encoding="utf-8")
        return cfg

    def _run(self, *args: str, **rc: int) -> subprocess.CompletedProcess:
        return subprocess.run(
            [str(RUN_ALL), *args],
            cwd=self.tmp,
            env={
                "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
                "HOME": str(self.tmp),
                "RUN_TEST_CONFIG": str(self._config(**rc)),
            },
            capture_output=True,
            text=True,
            timeout=120,
        )

    # ── 전부 통과 ─────────────────────────────────────────────────────────
    def test_all_pass_runs_four_stages_in_order(self) -> None:
        p = self._run()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        out = p.stdout + p.stderr
        for stage in ("lint", "unit", "build", "e2e"):
            self.assertIn("stage=%s status=PASS" % stage, out)
        # 순서가 보장돼야 한다 — build 없이 e2e 를 돌리면 의미가 없다.
        order = [out.index("stage=%s status=PASS" % s) for s in ("lint", "unit", "build", "e2e")]
        self.assertEqual(order, sorted(order), "단계 순서가 lint→unit→build→e2e 가 아니다")
        self.assertIn("run-test-all: ALL PASS", p.stdout)

    # ── 첫 실패에서 멈추고 코드를 그대로 전파 ─────────────────────────────
    def test_stops_at_first_failure_and_skips_later_stages(self) -> None:
        p = self._run(unit=1)
        self.assertEqual(p.returncode, 1, p.stdout + p.stderr)
        out = p.stdout + p.stderr
        self.assertIn("stage=lint status=PASS", out)
        self.assertIn("stage=unit status=FAIL", out)
        # build/e2e 는 **돌지 않아야** 한다 — fail-fast 의 요점이고, 느린 단계를 아낀다.
        #
        # **`stage=` 마커로 단언한다.** 처음엔 stub 의 `echo "build ran"` 으로 썼는데
        # `run-test.sh` 가 단계 출력을 **로그 파일로** 보내고 stdout 에는 한 줄 status 만
        # 찍으므로, 그 문자열은 **무엇을 하든 stdout 에 없다** — 부정 단언이 항상 참이 된다
        # (형제 긍정 단언이 같은 문자열을 쓰다 실패해서 드러났다).
        self.assertNotIn("stage=build", out)
        self.assertNotIn("stage=e2e", out)

    def test_propagates_the_failing_stage_exit_code_verbatim(self) -> None:
        # 1 이 아닌 코드로 확인한다 — "비-0" 이 아니라 **그 값**이 전파돼야
        # 호출자가 timeout(124) 같은 사유를 구분할 수 있다.
        p = self._run(build=3)
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)

    # ── 핵심: 파이프로 읽어도 결과가 참이어야 한다 ────────────────────────
    def test_verdict_is_on_stdout_so_a_pipe_cannot_hide_failure(self) -> None:
        """이 도구의 존재 이유. 종료 코드만 고치면 호출자가 또 파이프를 붙인다."""
        p = self._run(e2e=1)
        self.assertEqual(p.returncode, 1)
        last = [l for l in p.stdout.splitlines() if l.strip()][-1]
        self.assertEqual(last, "run-test-all: FAILED stage=e2e exit=1")

        ok = self._run()
        last_ok = [l for l in ok.stdout.splitlines() if l.strip()][-1]
        self.assertTrue(last_ok.startswith("run-test-all: ALL PASS"), last_ok)

    # ── 오타를 돌리기 전에 거른다 ─────────────────────────────────────────
    def test_unknown_stage_is_rejected_before_running_anything(self) -> None:
        """`run-test.sh all` 오타가 `NOT_DEFINED`(exit 2) 를 냈는데 파이프에 먹혀
        "통과" 로 보였던 사고의 재발 방지. 여기서는 **한 단계도 돌기 전에** 거른다."""
        p = self._run("all")
        self.assertEqual(p.returncode, 2, p.stdout + p.stderr)
        # 한 단계도 돌지 않았다 — `run-test.sh` 의 status 줄이 하나도 없어야 한다.
        self.assertNotIn("status=", p.stdout + p.stderr)
        self.assertIn("unknown stage", p.stderr)
        last = [l for l in p.stdout.splitlines() if l.strip()][-1]
        self.assertIn("FAILED", last)

    def test_explicit_subset_runs_only_those_stages(self) -> None:
        p = self._run("lint", "unit")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        out = p.stdout + p.stderr
        self.assertIn("stage=lint status=PASS", out)
        self.assertIn("stage=unit status=PASS", out)
        self.assertNotIn("stage=build", out)
        self.assertNotIn("stage=e2e", out)
        self.assertIn("run-test-all: ALL PASS stages=lint unit", p.stdout)


if __name__ == "__main__":
    unittest.main()
