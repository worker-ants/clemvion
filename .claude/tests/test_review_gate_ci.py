"""`scripts/check-review-gate.py` — 훅과 독립인 CI 백스톱.

이 층의 존재 이유는 로컬 훅의 push 탐지 정규식이 유일 판정자라는 것이다: 그 정규식이 push 를
놓치면 게이트가 조용히 skip 되고, 놓쳤다는 사실을 인지할 주체가 없다. 그래서 판정은 로컬과
**같은** `evaluate_review()` 를 쓰되, 트리거만 훅 밖(GitHub PR 이벤트)에 둔다.

여기서 고정하는 성질 넷:

1. **판정자가 하나다** — 스크립트가 자기 판정 로직을 새로 갖지 않는다. 두 번째 구현은 로컬과
   CI 판정이 갈리는 drift 이고, 이 저장소는 `report_paths` / `retry_state` 로 그 실패를 이미
   두 번 겪었다.
2. **관측 모드가 기본** — `--enforce` 없이는 위반이어도 exit 0. 로컬 훅은 미커밋 파일도 보지만
   CI 는 커밋된 것만 보는데, 이 저장소의 관행은 리뷰 산출물이 그 코드의 PR 에 커밋되지 않는
   것이다(435건 중 80건). 지금 켜면 "리뷰를 안 했다" 가 아니라 "산출물을 안 담았다" 를 막는다.
3. **fail-open** — 게이트를 못 불러오거나 게이트가 예외를 던져도 exit 0. 백스톱이 CI 를
   막아서는 안 된다. 이 층은 방어 심화이지 그 자체가 활성 게이트가 아니다.
4. **advisory 는 판정과 무관하게 나온다** — 차단 시에만 내면, 거부되는 그 세션이 바로 Critical
   을 하향한 세션일 때 그 사실이 드러나는 유일한 자리를 잃는다.

서브프로세스로 구동한다. 스크립트가 `sys.path` 에 `.claude/hooks/_lib` 를 얹는데, 그 이름은
`.claude/skills/_lib` 와 겹쳐 in-process import 가 스위트 전체를 오염시킨다 — 형제 suite 들이
문서화한 것과 같은 회피다.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: harness path setup

SCRIPT = _harness.REPO_ROOT / "scripts" / "check-review-gate.py"


class ReviewGateCliTest(unittest.TestCase):
    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        # 게이트 본체를 복사한다 — 심볼릭 링크가 아니라 복사여야 `_load_gate` 가
        # 계산하는 경로가 실제 CI 체크아웃과 같은 모양이 된다.
        os.makedirs(os.path.join(self.root, ".claude"))
        shutil.copytree(str(_harness.CLAUDE_DIR / "hooks"),
                        os.path.join(self.root, ".claude", "hooks"))
        shutil.copytree(str(_harness.CLAUDE_DIR / "_shared"),
                        os.path.join(self.root, ".claude", "_shared"))
        self._git("init", "-b", "main")
        self._git("commit", "--allow-empty", "-m", "base")

    def _git(self, *args):
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        subprocess.run(["git", *args], cwd=self.root, env=env, check=True,
                       capture_output=True, text=True)

    def _write(self, rel, body):
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)

    def _unreviewed_branch(self):
        self._git("checkout", "-b", "feature")
        self._write("codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git("add", "-A")
        self._git("commit", "-m", "feat")

    def _run(self, *extra):
        r = subprocess.run([sys.executable, str(SCRIPT), "--root", self.root, *extra],
                           capture_output=True, text=True, timeout=120)
        return r

    # -- 2. 관측 모드가 기본 --------------------------------------------------

    def test_unreviewed_branch_is_reported_but_not_failed_by_default(self):
        self._unreviewed_branch()
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertIn("미커버", r.stdout)
        self.assertIn("관측 모드", r.stdout)

    def test_enforce_turns_the_same_verdict_into_a_failure(self):
        """같은 저장소 상태, 플래그만 다르다 — 판정이 아니라 처분만 바뀐다는 것이 요점."""
        self._unreviewed_branch()
        observed, enforced = self._run(), self._run("--enforce")
        self.assertEqual(observed.returncode, 0)
        self.assertEqual(enforced.returncode, 1)
        self.assertIn("미커버", observed.stdout)
        self.assertIn("미커버", enforced.stdout)

    def test_a_clean_branch_passes_under_enforce(self):
        r = self._run("--enforce")
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertIn("통과", r.stdout)

    def test_a_resolved_review_lets_the_branch_through(self):
        """차단이 아니라 **통과**도 고정한다. 통과 경로가 없으면 이 스크립트는 늘 우는
        경고가 되고, 그건 이 저장소가 반복해서 실패로 분류해 온 형태다."""
        self._unreviewed_branch()
        self.assertEqual(self._run("--enforce").returncode, 1)
        session = "review/code/2099/01/01/00_00_00"
        self._write(f"{session}/SUMMARY.md", "## 전체 위험도\n\nNONE\n")
        self._write(f"{session}/RESOLUTION.md", "처분 완료\n")
        self._git("add", "-A")
        self._git("commit", "-m", "review")
        r = self._run("--enforce")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr[-2000:])

    # -- 3. fail-open ---------------------------------------------------------

    def test_a_missing_gate_module_does_not_fail_ci(self):
        """백스톱이 자기 부재로 CI 를 막으면 그건 방어가 아니라 새 장애다."""
        self._unreviewed_branch()
        os.remove(os.path.join(self.root, ".claude", "hooks", "_lib", "review_guard.py"))
        r = self._run("--enforce")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("불러오지 못했습니다", r.stderr)

    def test_a_gate_that_raises_does_not_fail_ci(self):
        self._unreviewed_branch()
        with open(os.path.join(self.root, ".claude", "hooks", "_lib", "review_guard.py"),
                  "w", encoding="utf-8") as f:
            # `push_blocks` 는 이 소비자가 읽지 않지만 실제 `ReviewDecision` 에는
            # 있다. 스텁이 진짜 인터페이스를 그대로 비추게 두는 편이,
            # 무엇을 빼도 되는지 매번 판단하는 것보다 싸다 (#1057 의 가드가 강제).
            f.write("class _R:\n"
                    "    push_blocks = False\n"
                    "def evaluate_review(cwd=None, *, in_flight_ok=False):\n"
                    "    raise RuntimeError('boom')\n")
        r = self._run("--enforce")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("예외를 던졌습니다", r.stderr)

    # -- 4. advisory 는 판정과 무관 -------------------------------------------

    def test_notes_are_printed_on_both_verdicts(self):
        """차단이든 통과든 나와야 한다. 차단 시에만 내면, 거부되는 그 세션이 바로 Critical 을
        하향한 세션일 때 그 사실이 드러나는 유일한 자리를 잃는다."""
        self._unreviewed_branch()
        stub = (
            "from dataclasses import dataclass\n"
            "import os\n"
            "@dataclass\n"
            "class _D:\n"
            "    blocked: bool\n"
            "    reason: str = 'stub'\n"
            "    @property\n"
            "    def push_blocks(self):\n"
            "        return self.blocked\n"
            "    @property\n"
            "    def notes(self):\n"
            "        return ('\u26a0\ufe0f  \uc138\uc158X: \ud558\ud5a5 \uac10\uc9c0',)\n"
            "def evaluate_review(cwd=None, *, in_flight_ok=False):\n"
            "    return _D(os.environ['FAKE_BLOCKED'] == '1')\n"
        )
        with open(os.path.join(self.root, ".claude", "hooks", "_lib", "review_guard.py"),
                  "w", encoding="utf-8") as f:
            f.write(stub)
        for blocked in ("1", "0"):
            with self.subTest(blocked=blocked):
                r = subprocess.run(
                    [sys.executable, str(SCRIPT), "--root", self.root],
                    capture_output=True, text=True, timeout=120,
                    env={**os.environ, "FAKE_BLOCKED": blocked},
                )
                self.assertEqual(r.returncode, 0)
                self.assertIn("하향 감지", r.stdout)


class OneJudgeTest(unittest.TestCase):
    """1. 판정 로직은 스크립트에 없다 — 게이트에 위임한다."""

    def test_the_script_performs_no_judgement_operations_of_its_own(self):
        """**연산**을 본다 — 단어가 아니라.

        두 번 고쳤다. 1차는 파일 전체를 grep 했고, 스크립트의 docstring 이 왜 이 설계인지
        설명하려 `review/code` 를 인용해서 실패했다. 2차는 docstring 을 걷어냈지만 이번엔
        사용자에게 무엇을 하라고 안내하는 **문구**("codebase/** 변경을 커버하는…")에 걸렸다.
        지키려는 성질은 "그 단어를 안 쓴다" 가 아니라 **"판정을 자기가 계산하지 않는다"** 이고,
        그건 문자열이 아니라 연산으로만 정확히 표현된다: 파일 트리를 걷지 않고, 리뷰 산출물을
        열지 않고, 정규식을 만들지 않고, git 을 부르지 않는다. 판정은 전부 게이트 몫이다.
        """
        import ast
        tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))

        called = set()
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            if isinstance(f, ast.Name):
                called.add(f.id)
            elif isinstance(f, ast.Attribute):
                base = f.value.id if isinstance(f.value, ast.Name) else ""
                called.add(f"{base}.{f.attr}" if base else f.attr)

        self.assertTrue(
            any("evaluate_review" in c for c in called) or "evaluate" in called,
            f"게이트를 호출하지 않는다: {sorted(called)}",
        )

        # 판정을 자기가 계산하면 반드시 나타나는 연산들.
        for banned in ("os.walk", "glob.glob", "glob.iglob", "re.compile",
                       "subprocess.run", "subprocess.check_output", "open"):
            self.assertNotIn(
                banned, called,
                f"{banned} 을 부른다 — 판정을 재구현하면 로컬/CI 판정이 갈린다",
            )

        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported |= {a.name.split(".")[0] for a in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        for banned in ("re", "glob", "subprocess"):
            self.assertNotIn(banned, imported,
                             f"{banned} 을 들이면 그 자체가 두 번째 판정자의 씨앗이다")
        self.assertIn("review_guard", imported, "게이트를 import 하지 않는다")


class WorkflowWiringTest(unittest.TestCase):
    """워크플로가 스크립트를 실제로 부르고, 봇을 면제하고, 히스토리를 가져오는가.

    셋 다 없으면 조용히 무해해진다 — `fetch-depth: 0` 이 없으면 merge-base 가 안 잡혀
    게이트가 fail-open 하고, 봇 면제가 없으면 이 워크플로는 dependabot 전용 알람이 된다
    (실측: 2026-08 의 미커버 9건 중 8건이 봇).
    """

    def setUp(self):
        self.text = (_harness.REPO_ROOT / ".github" / "workflows"
                     / "review-gate.yml").read_text(encoding="utf-8")
        # 주석을 걷어낸 판. 이 워크플로의 주석은 왜 관측 모드인지, 켤 때 무엇을 붙이는지를
        # 설명하느라 `--enforce` 를 인용한다 — 산문까지 보는 단언은 그 설명을 지우게 만든다.
        self.code = "\n".join(
            ln for ln in self.text.splitlines() if not ln.lstrip().startswith("#")
        )

    def test_it_runs_the_script(self):
        self.assertIn("scripts/check-review-gate.py", self.code)

    def test_it_exempts_dependabot(self):
        self.assertIn("dependabot[bot]", self.code)

    def test_it_fetches_full_history(self):
        self.assertIn("fetch-depth: 0", self.code)

    def test_it_triggers_on_the_gate_it_depends_on(self):
        """`codebase/**` 만 걸면 게이트 로직 자체를 고친 PR 에서 안 돈다 —
        `harness-checks.yml` 이 같은 실패 클래스를 여섯 번 겪고 세운 규칙."""
        for path in ("review_guard.py", ".claude/_shared/**",
                     "scripts/check-review-gate.py",
                     ".github/workflows/review-gate.yml"):
            self.assertIn(path, self.code)

    def test_it_is_still_observation_only(self):
        """`--enforce` 로 뒤집는 것은 워크플로 계약 변경이라 의도적 결정이어야 한다.
        이 단언은 그 전환이 조용히 일어나지 않게 한다 — 켤 때 이 테스트도 같이 바뀐다."""
        self.assertNotIn("--enforce", self.code)


if __name__ == "__main__":
    unittest.main()
