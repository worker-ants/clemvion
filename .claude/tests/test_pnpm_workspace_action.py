"""`.github/actions/pnpm-workspace/action.yml` — 9개 잡(5개 워크플로)이 공유하는 셋업 액션.

## 왜 이 파일이 있는가

추출 전에는 `pnpm install --frozen-lockfile --filter "<scope>"` 가 워크플로마다 **한 줄씩
직접** 적혀 있었다. 지금은 **CI 체크 워크플로가 그 한 줄을 공유**한다. 파급이 뒤집혔다:

- 종전: 한 워크플로의 install 줄이 망가지면 그 워크플로만 잘못된다.
- 지금: 이 줄이 망가지면 **9개 잡이 한꺼번에** 잘못된다 — 그리고 required check 후보가
  전부 그 안에 있다.

> **"저장소 전체에서 여기 하나뿐" 이 아니다.** 종전 문구가 그렇게 적었고, 그 프레이밍이
> 실제로 사고를 냈다 — `--strict-peer-dependencies` 를 도입할 때 이 한 곳만 고치고
> "전부 덮었다" 고 믿었는데, `pnpm install` 은 `.claude/test-stages.sh` 와 Dockerfile
> 3개에도 있고 그중 셋은 CI 에서 돈다(2026-08-10 requirement CRITICAL). 다섯 곳의
> 일치는 `test_install_gate_flags.py` 가 본다.

특히 `--frozen-lockfile` 은 `deps-guard-hardening` 이 required check 로 요구한 보장 그
자체다. 여기서 빠지면 매니페스트와 어긋난 lockfile 이 pnpm 에 의해 조용히 재생성되고, 9개
잡이 전부 초록으로 통과한다 — 이 저장소가 반복해 데인 "게이트가 조용히 안 도는"
실패다. 그래서 문자열 존재가 아니라 **실제 인자**로 고정한다.

## 실행 검증인 이유

`_changed-paths.yml` 에서 얻은 규칙이 그대로 적용된다 — **받는 쪽이 실제로 무엇을 봤는지로
검증하라.** YAML 에 `--filter "$FILTER"` 라고 적혀 있다는 것은 코드가 **있다**는 증거일 뿐
**동작한다**는 증거가 아니다. 인용을 빠뜨리거나 env 배선이 끊기면 pnpm 이 받는 인자가
달라지는데, 정적 grep 은 둘을 구분하지 못한다.

그래서 액션에 적힌 `run:` 블록을 꺼내 bash 로 돌리고, PATH 에 놓은 `pnpm` 스텁이 받은
`$@` 를 센다.

## 알려진 한계 (숨기지 않고 적는다)

`uses:` 스텝(`pnpm/action-setup`·`setup-node`)은 러너에서만 의미를 갖는 것이라 여기서
실행되지 않는다. 그 두 줄에 대해서는 **핀 값**(액션 버전·node 버전·캐시 키)만 정적으로
고정한다 — 추출이 툴체인을 조용히 바꾸지 않았다는 것까지가 이 파일이 말할 수 있는 전부다.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import tempfile
import unittest

import yaml

import _harness  # noqa: F401  — side effect: harness path setup

# `_harness.REPO_ROOT` 를 쓰는 것이 의도다. `test_harness_checks_paths_coverage.py` 의
# 추출기는 **그 이름에서 뻗은 모듈 레벨 체인만** 인식하므로, 로컬 `parents[2]` 별칭을 쓰면
# 이 파일이 지키는 액션이 "guarded file" 로 안 잡히고 harness-checks 등재가 손 유지로 남는다.
# 이 이름을 쓰는 순간 등재 누락이 그 가드에서 RED 가 된다.
REPO_ROOT = _harness.REPO_ROOT
ACTION = REPO_ROOT / ".github" / "actions" / "pnpm-workspace" / "action.yml"
WORKFLOWS = REPO_ROOT / ".github" / "workflows"

# 호출부가 이 액션을 부를 때 쓰는 경로. 워크플로 YAML 의 `uses:` 값과 정확히 같아야 한다.
USES_PATH = "./.github/actions/pnpm-workspace"

STUB = """#!/bin/bash
# 받은 인자를 그대로 보고한다 — 이것이 '받는 쪽 산출물' 이다.
echo "ARGC=$#"
for a in "$@"; do echo "ARG=$a"; done
"""


def action_doc() -> dict:
    return yaml.safe_load(ACTION.read_text(encoding="utf-8"))


def composite_steps() -> list[dict]:
    return action_doc()["runs"]["steps"]


def install_run_block() -> str:
    """`run:` 을 가진 유일한 스텝의 본문.

    두 개 이상이면 이 파일의 전제(설치 한 줄)가 깨진 것이므로 조용히 첫 번째를 고르지 않고
    실패한다 — 어느 것을 검증하는지 모호해지는 순간 이 스위트는 증거가 아니게 된다.
    """
    runs = [s for s in composite_steps() if "run" in s]
    assert len(runs) == 1, f"`run:` 스텝이 {len(runs)}개다 — 이 파일의 전제가 바뀌었다"
    return runs[0]["run"]


def run_install(filter_value: str) -> subprocess.CompletedProcess:
    """액션에 적힌 `run:` 블록을 실제 bash 로 돌린다.

    `pnpm` 은 PATH 로 해소되므로 임시 디렉터리에 스텁을 놓고 그 디렉터리를 PATH 앞에 붙인다.
    `FILTER` 는 액션의 `env:` 가 하는 일을 그대로 재현한다.
    """
    tmp = tempfile.mkdtemp()
    stub = pathlib.Path(tmp) / "pnpm"
    stub.write_text(STUB, encoding="utf-8")
    stub.chmod(0o755)
    return subprocess.run(
        ["bash", "-c", install_run_block()],
        cwd=tmp,
        capture_output=True,
        text=True,
        env={**os.environ, "PATH": f"{tmp}:{os.environ['PATH']}", "FILTER": filter_value},
    )


def argv(proc: subprocess.CompletedProcess) -> list[str]:
    return [l[len("ARG=") :] for l in proc.stdout.splitlines() if l.startswith("ARG=")]


class InstallCommandTest(unittest.TestCase):
    def test_pnpm_receives_both_gate_flags_and_the_filter(self):
        """**이 액션이 받는 인자**로 두 플래그를 확인한다 — 다섯 소재지 중 CI 잡이 공유하는 한 곳.

        저장소 전체의 유일한 소재지가 아니다(`pnpm install` 은 5곳에 있다). 다섯 곳의
        일치는 `test_install_gate_flags.py` 가 정적으로 대조한다 — 그 분업이 필요한 이유는
        이 테스트만 있던 시절 나머지 4곳이 무가드로 남아 실제 사고가 났기 때문이다.

        후자는 2026-08-10 추가. 미충족 peer 를 경고에서 실패로 올린다 — 그게 없어서
        `#1049` 가 `eslint-plugin-unicorn` 을 `eslint>=10.4` 요구 버전으로 올린 채
        9.39.4 설치본 위에 머지됐고, 사람이 로그를 읽다 발견했다.
        """
        proc = run_install("frontend...")
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertEqual(
            argv(proc),
            ["install", "--frozen-lockfile", "--strict-peer-dependencies",
             "--filter", "frontend..."],
            "pnpm 이 받은 인자가 기대와 다르다 — `--frozen-lockfile` 이 빠지면 매니페스트와 "
            "어긋난 lockfile 이, `--strict-peer-dependencies` 가 빠지면 미충족 peer 가 "
            "9개 잡에서 전부 조용히 통과한다",
        )

    def test_the_filter_arrives_as_one_argument(self):
        """인용이 빠지면 공백에서 갈려 스코프가 통째로 달라진다.

        지금 쓰는 스코프에는 공백이 없지만, **없다는 사실이 이 코드가 견딘다는 증거는
        아니다** — `_changed-paths.yml` 에서 같은 논리로 고정해 둔 것과 같은 자리다.
        """
        proc = run_install("scope with space...")
        self.assertEqual(argv(proc)[-1], "scope with space...")
        # 리터럴이어야 한다. `len(argv(proc))` 로 유도하면 argv 와 같은 stdout 에서
        # 나오므로 자기 자신과 비교하는 꼴이 되고, 인자가 갈려도 통과한다 — 이 단언의
        # 존재 이유가 바로 "필터가 한 인자로 도착했는가" 다.
        # install + --frozen-lockfile + --strict-peer-dependencies + --filter + <scope>
        self.assertIn("ARGC=5", proc.stdout, proc.stdout)

    def test_a_scoped_package_name_survives_intact(self):
        """실사용 형태 — `@workflow/…` 와 `...`(workspace 의존 포함)."""
        proc = run_install("@workflow/web-chat...")
        self.assertEqual(argv(proc)[-1], "@workflow/web-chat...")

    def test_the_filter_is_not_glob_expanded(self):
        """cwd 의 파일로 조기 확장되면 설치 스코프가 조용히 달라진다."""
        tmp_marker = "sentinel*"
        proc = run_install(tmp_marker)
        self.assertEqual(argv(proc)[-1], tmp_marker)


class WiringTest(unittest.TestCase):
    def test_filter_input_is_required(self):
        """optional 이면 호출부가 빠뜨려도 YAML 층에서 안 걸리고, 빈 `--filter` 로
        **워크스페이스 전체**가 설치된다 — 느려질 뿐 아니라 잡의 의도한 스코프가 사라진다."""
        inputs = action_doc().get("inputs") or {}
        self.assertIn("filter", inputs)
        self.assertTrue(inputs["filter"].get("required"), "`filter` 가 required 가 아니다")

    def test_run_block_never_interpolates_expressions(self):
        """`${{ }}` 를 `run:` 문자열에 직접 끼워 넣지 않는다 — 스크립트 인젝션 회피.

        값이 셸 **코드로** 읽히는 자리라 호출부가 넣은 문자열이 명령이 될 수 있다. `env:` 로
        넘기면 셸은 언제나 데이터로 본다. `_changed-paths.yml` 에 같은 단언이 있고, 공유
        지점이 하나 늘었으니 규율도 같이 따라온다.
        """
        self.assertNotIn(
            "${{",
            install_run_block(),
            "run: 본문에 표현식이 직접 삽입됐다 — env 경유로 바꿀 것",
        )

    def test_the_filter_reaches_the_step_through_env(self):
        step = next(s for s in composite_steps() if "run" in s)
        self.assertEqual(
            (step.get("env") or {}).get("FILTER"),
            "${{ inputs.filter }}",
            "설치 스텝이 `filter` 입력을 env 로 받지 않는다 — 그러면 위 인젝션 단언이 "
            "통과하면서도 스코프가 전달되지 않아 설치가 조용히 어긋난다",
        )

    def test_toolchain_pins_did_not_drift_in_the_extraction(self):
        """추출이 툴체인을 조용히 바꾸지 않았는지 — `uses:` 스텝은 여기서 실행할 수 없으므로
        핀 값만 정적으로 고정한다(모듈 docstring §알려진 한계).

        `startswith` 로 액션 이름만 확인하면 `@v7` → `@v6` 같은 버전 드리프트가 조용히
        통과한다 — docstring·README 가 약속한 "액션 버전 핀 고정"은 정확 문자열 비교여야
        지켜진다.
        """
        steps = composite_steps()
        node = next(s for s in steps if str(s.get("uses", "")).startswith("actions/setup-node"))
        self.assertEqual(
            node.get("uses"),
            "actions/setup-node@v7",
            "actions/setup-node 의 핀 버전이 드리프트했다",
        )
        self.assertEqual(node["with"]["node-version"], "24")
        self.assertEqual(node["with"]["cache"], "pnpm")
        self.assertEqual(
            node["with"]["cache-dependency-path"],
            "pnpm-lock.yaml",
            "캐시 키가 lockfile 이 아니면 install 결과가 stale 캐시로 갈릴 수 있다",
        )
        pnpm_setup = next(
            (s for s in steps if str(s.get("uses", "")).startswith("pnpm/action-setup@")),
            None,
        )
        self.assertIsNotNone(
            pnpm_setup,
            "pnpm 셋업 스텝이 사라졌다 — install 이 러너 기본 pnpm(또는 부재)으로 돈다",
        )
        self.assertEqual(
            pnpm_setup.get("uses"),
            "pnpm/action-setup@v6.0.9",
            "pnpm/action-setup 의 핀 버전이 드리프트했다",
        )

    def test_every_composite_run_step_declares_a_shell(self):
        """composite 의 `run:` 은 `shell:` 이 없으면 러너가 거부한다. 러너에서만 드러나는
        클래스라(로컬은 이 파일을 실행하지 않는다) 여기서 미리 잡는다."""
        for i, step in enumerate(composite_steps()):
            if "run" not in step:
                continue
            with self.subTest(step=i):
                self.assertIn("shell", step, f"step #{i} 에 `shell:` 이 없다")


class ConsumerBindingTest(unittest.TestCase):
    """호출부와의 결속 — 이 액션을 쓰는 워크플로가 실제로 갖춰야 하는 것들.

    추출이 **새로 만든** 의존이라 등재를 빠뜨리기 쉬운 자리다. `_changed-paths.yml` 이
    같은 이유로 pathspec 등재를 계약으로 요구하고 있고, 여기서 그것을 액션에 대해서도 건다.
    """

    def consumers(self):
        """`uses: ./.github/actions/pnpm-workspace` 를 부르는 (워크플로, 잡, 스텝) 목록."""
        found = []
        # `*.y*ml` + suffix 필터 — `test_workflow_yaml_structure.py::_workflow_files()`
        # 와 같은 규약이다. `*.yml` 만 보면 `.yaml` 로 쓴 워크플로의 소비처를 이 클래스만
        # 조용히 놓쳐, 게이팅·등재 단언이 그 워크플로에 대해 헛통과한다 (ai-review INFO 5).
        candidates = sorted(
            p for p in WORKFLOWS.glob("*.y*ml") if p.suffix in (".yml", ".yaml")
        )
        for path in candidates:
            doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for job_name, job in (doc.get("jobs") or {}).items():
                if not isinstance(job, dict):
                    continue
                for i, step in enumerate(job.get("steps") or []):
                    if isinstance(step, dict) and step.get("uses") == USES_PATH:
                        found.append((path.name, job_name, step))
        return found

    def test_there_are_consumers(self):
        """vacuity 방지 — 소비처가 0이면 아래 단언이 전부 헛통과한다. 9개 잡을 위해 만든
        액션이라 그 수가 줄면 추출의 전제부터 다시 봐야 한다."""
        self.assertGreaterEqual(
            len(self.consumers()), 9,
            "이 액션을 부르는 잡이 9개 미만이다 — 추출 근거(바이트 동일 8잡 + backend "
            "typecheck-ratchet 1잡)가 바뀌었다면 액션 자체의 존치 여부부터 재판정할 것",
        )

    def test_every_call_is_gated(self):
        """액션 호출은 스텝 하나라 게이팅도 한 줄이다 — 그 한 줄이 빠지면 무관한 PR 에서
        설치가 통째로 실행된다(종전 3스텝일 때와 같은 회귀, 자리만 줄었다)."""
        for name, job, step in self.consumers():
            with self.subTest(workflow=name, job=job):
                self.assertEqual(
                    step.get("if"),
                    "needs.changes.outputs.relevant != 'false'",
                    f"{name}:{job} 의 액션 호출이 skip-job 조건으로 게이팅되지 않았다",
                )

    def test_every_consumer_lists_the_action_in_its_pathspecs(self):
        """액션이 바뀌면 그것에 기대는 워크플로가 돌아야 한다.

        `scripts/ci-paths-changed.sh`·`_changed-paths.yml` 을 등재하도록 요구하는 것과
        **같은 계약**이고, 이 저장소가 여섯 번 겪은 커버리지 갭의 같은 클래스다.
        """
        import test_required_check_skip_jobs as skip_jobs

        for name in {n for n, _job, _s in self.consumers()}:
            with self.subTest(workflow=name):
                specs = skip_jobs.pathspecs_of(name)
                covered = ".github/actions/pnpm-workspace/action.yml" in specs or (
                    ".github/actions/**" in specs
                )
                self.assertTrue(
                    covered,
                    f"{name}: 판정 pathspec 에 공유 셋업 액션이 없다 — 액션만 고친 PR 에서 "
                    "이 워크플로가 안 돈다",
                )


if __name__ == "__main__":
    unittest.main()
