"""`_changed-paths.yml` 이 pathspec 을 **몇 개의 인자로** 넘기는지 실행으로 고정한다.

## 왜 실행 검증인가

`workflow_call` 의 `inputs` 는 스칼라만 받아서 pathspec 목록을 **여러 줄 문자열**로 넘긴다.
그걸 다시 배열로 되돌리는 자리가 이 패턴에서 가장 조용히 깨지기 쉽다:

- 따옴표 없이 `$PATHSPECS` 를 그대로 넘기면 셸에 따라 **전부가 한 덩어리 인자 1개**가 되거나
  글로브가 조기 확장된다.
- 그러면 `ci-paths-changed.sh` 는 "그런 경로 변경 없음" → `relevant=false` 로 판정하고,
  전환된 워크플로 전체의 **모든 검사가 조용히 no-op** 된다. required check 는 초록이다.

이 저장소는 같은 클래스를 이미 겪었다 — 인자 목록이 한 덩어리로 전달돼 "명시 파일" 절차가
전 라운드 무효였던 사고. 그때 얻은 규칙이 **"받는 쪽 산출물로 검증하라"** 이고, 여기서는
스텁 스크립트가 본 `$#` 가 그 산출물이다.

정적으로 `mapfile` 문자열이 있는지 보는 것으로는 부족하다 — 그건 코드가 **있다**는 증거일
뿐 **동작한다**는 증거가 아니다. 그래서 YAML 에 실제로 적힌 `run:` 블록을 꺼내 bash 로
돌리고, 스텁이 받은 인자를 센다.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import tempfile
import unittest

import yaml

REPO = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = REPO / ".github" / "workflows" / "_changed-paths.yml"

STUB = """#!/bin/bash
# 받은 인자를 그대로 보고한다 — 이것이 '받는 쪽 산출물' 이다.
echo "ARGC=$#"
for a in "$@"; do echo "ARG=$a"; done
"""


def detect_run_block() -> str:
    doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    steps = doc["jobs"]["detect"]["steps"]
    for step in steps:
        if step.get("id") == "detect":
            return step["run"]
    raise AssertionError("`id: detect` 스텝을 찾지 못했다")


def run_with(pathspecs: str) -> subprocess.CompletedProcess:
    """워크플로에 적힌 `run:` 블록을 실제 bash 로 돌린다.

    `scripts/ci-paths-changed.sh` 는 상대 경로로 불리므로, 임시 cwd 에 같은 경로의
    스텁을 놓아 **진짜 판정 로직 대신** 인자만 보고하게 한다.
    """
    tmp = tempfile.mkdtemp()
    scripts = pathlib.Path(tmp) / "scripts"
    scripts.mkdir()
    stub = scripts / "ci-paths-changed.sh"
    stub.write_text(STUB, encoding="utf-8")
    stub.chmod(0o755)
    return subprocess.run(
        ["bash", "-c", detect_run_block()],
        cwd=tmp,
        capture_output=True,
        text=True,
        env={**os.environ, "PATHSPECS": pathspecs},
    )


def argv(proc: subprocess.CompletedProcess) -> list[str]:
    return [l[len("ARG=") :] for l in proc.stdout.splitlines() if l.startswith("ARG=")]


class ArgumentSplittingTest(unittest.TestCase):
    def test_each_line_becomes_one_argument(self):
        proc = run_with("codebase/backend/**\npnpm-lock.yaml\nscripts/ci-paths-changed.sh\n")
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("ARGC=3", proc.stdout, "여러 줄이 인자 3개로 갈리지 않았다")
        self.assertEqual(
            argv(proc),
            ["codebase/backend/**", "pnpm-lock.yaml", "scripts/ci-paths-changed.sh"],
        )

    def test_globs_are_not_expanded_by_the_shell(self):
        """`**`·`*` 가 cwd 의 파일로 조기 확장되면 판정 대상이 통째로 달라진다.

        임시 cwd 에는 `scripts/ci-paths-changed.sh` 가 실재하므로, 확장이 일어나면
        `scripts/*` 가 그 파일 경로로 바뀌어 원래 의도한 pathspec 이 사라진다.
        """
        proc = run_with("scripts/*\ncodebase/**/package.json\n")
        self.assertEqual(argv(proc), ["scripts/*", "codebase/**/package.json"])

    def test_blank_lines_are_dropped(self):
        """빈 문자열 인자는 git pathspec 에서 **모든 경로**를 뜻해 판정을 항상 true 로
        만든다 — 게이팅이 사라진 것과 같다. 블록 스칼라는 끝에 개행이 남으므로 실제로
        도달 가능한 입력이다."""
        proc = run_with("a.yaml\n\n\nb.yaml\n")
        self.assertIn("ARGC=2", proc.stdout, proc.stdout)
        self.assertEqual(argv(proc), ["a.yaml", "b.yaml"])

    def test_whitespace_only_lines_are_dropped(self):
        proc = run_with("a.yaml\n   \nb.yaml\n")
        self.assertEqual(argv(proc), ["a.yaml", "b.yaml"])

    def test_comment_lines_are_dropped(self):
        """**블록 스칼라 안에는 YAML 주석이 없다** — `#` 줄도 전부 본문으로 건너온다.

        떼지 않으면 근거 주석이 pathspec 인자가 되어 목록이 실제보다 넓어 보이고, 가드
        (`pathspecs_of`)와 런타임이 서로 다른 목록을 보게 된다. 항목별 "왜 등재했는가" 를
        pathspec 바로 옆에 두려면 이 층이 떼는 수밖에 없다 — `harness-checks.yml` 의
        목록은 그 인접성이 여섯 번의 커버리지 갭에 대한 유일한 대응책이다.
        """
        proc = run_with("a.yaml\n# 왜 등재했는가\n  # 들여쓴 주석도 마찬가지\nb.yaml\n")
        self.assertIn("ARGC=2", proc.stdout, proc.stdout)
        self.assertEqual(argv(proc), ["a.yaml", "b.yaml"])

    def test_a_hash_that_is_not_line_initial_survives(self):
        """줄 **시작**의 `#` 만 주석이다. 경로 안의 `#` 를 떼면 그 pathspec 이 조용히
        다른 것이 되어, 주석 제거가 게이팅을 깎는 쪽으로 작동한다."""
        proc = run_with("dir/a#b.txt\n")
        self.assertEqual(argv(proc), ["dir/a#b.txt"])

    def test_a_list_of_only_comments_fails_closed(self):
        """주석만 남으면 판정 대상이 0개다 — 빈 입력과 같은 자리로 떨어져야 한다.
        조용히 통과하면 그 워크플로의 모든 검사가 영구히 no-op 된다."""
        proc = run_with("# 전부 주석\n#\n")
        self.assertNotEqual(proc.returncode, 0, proc.stdout)
        self.assertIn("비었다", proc.stdout + proc.stderr)

    def test_empty_input_fails_closed(self):
        """pathspec 이 하나도 없으면 판정 대상이 0개다 — 조용히 통과시키면 그 워크플로의
        모든 검사가 영구히 no-op 된다. 사유를 남기고 비-0 으로 끝나야 한다."""
        proc = run_with("\n  \n")
        self.assertNotEqual(proc.returncode, 0, proc.stdout)
        self.assertIn("비었다", proc.stdout + proc.stderr)

    def test_single_pathspec_still_works(self):
        proc = run_with("only-one.yaml\n")
        self.assertEqual(argv(proc), ["only-one.yaml"])

    def test_leading_and_trailing_whitespace_is_trimmed(self):
        """**테스트와 런타임이 같은 값을 봐야 한다.**

        가드(`test_required_check_skip_jobs.py::pathspecs_of`)는 YAML 을 읽을 때
        `line.strip()` 으로 정규화한다. 런타임이 안 떼면 `pathspecs:` 항목에 공백이 하나
        섞였을 때 **가드는 통과하는데 런타임에서는 그 pathspec 이 무력화**된다 — 정확히
        이 PR 이 막으려는 "초록인데 안 도는" 클래스다 (ai-review 19_26_54 WARNING).
        """
        proc = run_with("  a.yaml\nb.yaml  \n\t c.yaml \t\n")
        self.assertEqual(argv(proc), ["a.yaml", "b.yaml", "c.yaml"])

    def test_a_pathspec_containing_spaces_stays_one_argument(self):
        """워크플로 주석이 **이름으로 지목한** 파손 클래스다 — 고정해 둔다.

        인용 없이 넘기면 공백에서도 갈려 `path with space.yaml` 이 인자 3개가 되고,
        그중 어느 것도 실재하지 않아 판정이 `false` 로 떨어진다. 지금 저장소의 pathspec
        에는 공백이 없지만, 없다는 사실이 **이 코드가 견딘다는 증거는 아니다**
        (ai-review WARNING #3).
        """
        proc = run_with("path with space.yaml\nplain.yaml\n")
        self.assertEqual(argv(proc), ["path with space.yaml", "plain.yaml"])


class WiringTest(unittest.TestCase):
    def test_workflow_call_declares_the_pathspecs_input(self):
        doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        on = doc.get(True) if True in doc else doc.get("on")
        call = (on or {}).get("workflow_call") or {}
        self.assertIn("pathspecs", call.get("inputs") or {})
        self.assertTrue(
            call["inputs"]["pathspecs"].get("required"),
            "pathspecs 가 optional 이면 호출부가 빠뜨려도 YAML 단계에서 안 걸린다",
        )

    def test_sha_env_is_passed_through(self):
        """호출부가 아니라 이 파일이 SHA 를 읽는다 — 하나라도 빠지면 판정이 fail-safe
        (전부 실행)로 떨어져 게이팅이 조용히 사라진다."""
        doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        step = next(s for s in doc["jobs"]["detect"]["steps"] if s.get("id") == "detect")
        self.assertEqual(
            set(step["env"]) - {"PATHSPECS"},
            {"PR_BASE_SHA", "PR_HEAD_SHA", "PUSH_BEFORE_SHA", "PUSH_AFTER_SHA"},
        )

    def test_run_block_never_interpolates_expressions(self):
        """`${{ }}` 를 `run:` 문자열에 직접 끼워 넣지 않는다 — 스크립트 인젝션 회피.

        값이 셸 **코드로** 읽히는 자리라, 호출부가 넣은 문자열이 명령이 될 수 있다.
        `env:` 로 넘기면 셸은 그것을 언제나 데이터로 본다. 지금은 지켜지고 있지만
        `run:` 에 한 줄 끼워 넣기가 쉬운 자리라 단언으로 고정한다(ai-review WARNING #4).
        """
        self.assertNotIn(
            "${{",
            detect_run_block(),
            "run: 본문에 표현식이 직접 삽입됐다 — env 경유로 바꿀 것",
        )

    def test_checkout_uses_full_history(self):
        # 얕은 클론이면 merge-base 계산이 실패해 매번 fail-safe(전부 실행)가 된다.
        doc = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        checkout = doc["jobs"]["detect"]["steps"][0]
        self.assertEqual((checkout.get("with") or {}).get("fetch-depth"), 0)


if __name__ == "__main__":
    unittest.main()
