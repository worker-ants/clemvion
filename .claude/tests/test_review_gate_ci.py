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
        # 세 곳에서 되풀이하던 경로 — 한 번만 계산한다. 리터럴이 흩어져 있으면
        # "한 인스턴스만 고치고 나머지는 남기는" 실패가 쉬워진다.
        self.gate_module = os.path.join(
            self.root, ".claude", "hooks", "_lib", "review_guard.py")
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

    def _run(self, *extra, env=None):
        """`env` 를 받는 이유: 이게 없어서 notes 테스트가 같은 호출을 손으로 다시 타이핑한
        두 번째 `subprocess.run` 을 갖고 있었다 — timeout 이나 인자를 고칠 때 한쪽만 고치기
        딱 좋은 모양이다."""
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--root", self.root, *extra],
            capture_output=True, text=True, timeout=120,
            env={**os.environ, **(env or {})},
        )

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

    def test_an_unfinished_review_session_does_not_open_the_gate(self):
        """`meta.json` 만 있고 `SUMMARY.md` 는 아직 없는 세션 — 여전히 미커버여야 한다.

        `evaluate_review(in_flight_ok=True)` 는 "리뷰가 도는 중" 을 차단하지 않는 스위치이고,
        이 저장소는 그것이 **무조건** 적용돼 push 게이트가 TTL 내내 열린 사고를 겪고 opt-in 으로
        고쳤다. CI 호출부가 그 스위치를 켜는 회귀는 아무 테스트도 잡지 못했다 — 리뷰어가
        `evaluate(root, in_flight_ok=True)` 로 바꿔 통과로 뒤집히는 것을 실측했다.

        push 게이트와 같은 이유로 CI 도 켜면 안 된다: 진행 중인 리뷰는 커버리지가 아니다.
        """
        self._unreviewed_branch()
        session = "review/code/2099/01/01/00_00_00"
        self._write(f"{session}/meta.json", '{"agents": []}')
        self._git("add", "-A")
        self._git("commit", "-m", "review started")
        r = self._run("--enforce")
        self.assertEqual(r.returncode, 1,
                         "진행 중인 리뷰 세션이 게이트를 열었다 — in_flight_ok 회귀")
        self.assertIn("미커버", r.stdout)

    def test_the_default_root_resolves_to_this_repository(self):
        """`--root` 없이 도는 경로 — CI 가 매번 쓰는 바로 그 경로다.

        13개 테스트가 전부 `--root <tempdir>` 를 명시로 넘겨서, 스크립트가 자기 위치로부터
        저장소 루트를 계산하는 두 단계 상위 가정은 한 번도 실행되지 않았다. 그 가정이 깨지면
        (스크립트가 다른 깊이로 이동) 게이트를 못 불러와 **fail-open** 하고, 그건 관측 모드의
        정상 출력과 구분이 안 된다 — CI 는 계속 초록인데 백스톱만 영구히 죽는다.
        """
        r = subprocess.run([sys.executable, str(SCRIPT)],
                           capture_output=True, text=True, timeout=120,
                           cwd=str(_harness.REPO_ROOT))
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertNotIn("불러오지 못했습니다", r.stderr,
                         "기본 루트 산정이 깨져 백스톱이 조용히 무력화됐다")
        self.assertNotIn("예외를 던졌습니다", r.stderr)
        self.assertTrue(
            "통과" in r.stdout or "미커버" in r.stdout,
            f"판정을 내지 못했다: {r.stdout!r}",
        )

    # -- 3. fail-open ---------------------------------------------------------

    def test_a_missing_gate_module_does_not_fail_ci(self):
        """백스톱이 자기 부재로 CI 를 막으면 그건 방어가 아니라 새 장애다."""
        self._unreviewed_branch()
        os.remove(self.gate_module)
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
        with open(self.gate_module, "w", encoding="utf-8") as f:
            f.write(stub)
        for blocked in ("1", "0"):
            with self.subTest(blocked=blocked):
                r = self._run(env={"FAKE_BLOCKED": blocked})
                self.assertEqual(r.returncode, 0)
                self.assertIn("하향 감지", r.stdout)


class OneJudgeTest(unittest.TestCase):
    """1. 판정 로직은 스크립트에 없다 — 게이트에 위임한다."""

    # 스크립트가 실제로 쓰는 전부. 열거를 뒤집은 이유는 아래 docstring 참조.
    _ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}

    def test_the_script_performs_no_judgement_operations_of_its_own(self):
        """**허용 목록**으로 판정한다 — 금지 목록이 아니라.

        세 번 고쳤다.
        1차: 파일 전체 grep → 스크립트 docstring 이 왜 이 설계인지 설명하려 인용한
             `review/code` 에 걸렸다.
        2차: docstring 을 걷어냄 → 이번엔 사용자 안내 **문구**("codebase/** 변경을 커버하는…")
             에 걸렸다. 지키려는 성질은 "그 단어를 안 쓴다" 가 아니다.
        3차: 연산 기반 금지 목록 → 리뷰어가 두 우회를 실증했다.
             (a) `pathlib.Path(root).rglob(...)` — `pathlib` 이 목록에 없고, attribute 호출의
                 베이스가 `ast.Name` 이 아니면 접두어 없이 기록돼 매칭도 빗나간다.
             (b) `from os import walk as _w` — AST 는 로컬 이름만 남기므로 정본 모듈명과 안 맞는다.

        금지 목록은 우회를 상상하는 만큼만 강하고, 상상은 항상 부족하다. 이 스크립트가 하는
        일은 "인자를 읽고, 게이트를 부르고, 출력한다" 뿐이라 허용 목록이 짧고 안정적이다.
        새 import 가 필요해지면 여기서 실패하고, 그때 그것이 판정 재구현인지 판단하면 된다.
        """
        import ast
        tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))

        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported |= {a.name.split(".")[0] for a in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        extra = imported - self._ALLOWED_IMPORTS
        self.assertEqual(
            extra, set(),
            f"허용되지 않은 import: {sorted(extra)} — 판정을 재구현하면 로컬/CI 가 갈린다",
        )
        self.assertIn("review_guard", imported, "게이트를 import 하지 않는다")

        # 허용된 모듈로도 트리를 걸을 수는 있다(`os.walk`/`os.scandir`/`os.listdir`).
        # alias 를 정본 이름으로 되돌린 뒤 대조한다 — (b) 우회가 여기서 막힌다.
        alias_of = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    alias_of[a.asname or a.name] = a.name
            elif isinstance(node, ast.ImportFrom) and node.module:
                for a in node.names:
                    alias_of[a.asname or a.name] = f"{node.module}.{a.name}"
        called = set()
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            if isinstance(f, ast.Name):
                called.add(alias_of.get(f.id, f.id))
            elif isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name):
                base = alias_of.get(f.value.id, f.value.id)
                called.add(f"{base}.{f.attr}")
        for banned in ("os.walk", "os.scandir", "os.listdir", "open"):
            self.assertNotIn(
                banned, called,
                f"{banned} 을 부른다 — 리뷰 산출물을 스스로 읽으면 그것이 두 번째 판정자다",
            )
        # 호출은 지역 변수 경유(`evaluate = _load_gate(...)`)라 호출 이름으로는 안 잡힌다.
        # 잡아야 할 것은 "게이트 함수를 가져와서 쓴다" 는 사실이므로 속성 접근을 본다.
        attrs = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
        self.assertIn("evaluate_review", attrs,
                      "review_guard.evaluate_review 를 가져오지 않는다")


class WorkflowWiringTest(unittest.TestCase):
    """워크플로가 스크립트를 실제로 부르고, 봇을 면제하고, 히스토리를 가져오는가.

    셋 다 없으면 조용히 무해해진다 — `fetch-depth: 0` 이 없으면 merge-base 가 안 잡혀 게이트가
    fail-open 하고, 봇 면제가 없으면 이 워크플로는 dependabot 전용 알람이 된다(실측: 2026-08 의
    미커버 9건 중 8건이 봇).

    **구조로 판정한다 — substring 이 아니라.** 1차 판은 주석을 걷어낸 전문을 grep 했고, 리뷰어가
    두 가지로 우회를 실증했다: (a) `if:` 조건을 지우고 같은 문자열을 `env:` 에 남기면 봇 면제
    테스트가 통과하고, (b) `run:` 을 `true` 로 바꿔도 같은 경로가 `paths:` 에 있으므로 실행
    테스트가 통과한다. 문자열이 **어디에** 있는지가 배선의 전부인데 substring 은 그걸 못 본다.
    같은 파일의 `OneJudgeTest` 는 이미 "단어가 아니라 연산" 으로 재작성된 전례가 있는데 이
    클래스만 그 교훈이 안 닿아 있었다.

    PyYAML 을 쓴다 — `.claude/tests/README.md` 가 기록한 테스트 전용 예외이고,
    `test_workflow_yaml_structure.py` 가 이미 같은 이유로 쓴다(중복 키 검출은 stdlib 로 불가).
    """

    @classmethod
    def setUpClass(cls):
        try:
            import yaml  # noqa: PLC0415
        except ImportError:  # pragma: no cover
            raise unittest.SkipTest("PyYAML 없음 — CI 는 설치한다")
        cls._yaml = yaml

    def setUp(self):
        path = _harness.REPO_ROOT / ".github" / "workflows" / "review-gate.yml"
        self.doc = self._yaml.safe_load(path.read_text(encoding="utf-8"))
        self.text = path.read_text(encoding="utf-8")
        # YAML 1.1 에서 `on:` 은 불리언 True 로 파싱된다 — 이걸 모르면 KeyError 로 죽는다.
        self.on = self.doc.get("on", self.doc.get(True))
        self.job = self.doc["jobs"]["gate"]

    def _run_commands(self):
        return [st["run"] for st in self.job["steps"] if "run" in st]

    def test_a_step_actually_runs_the_script(self):
        """`paths:` 에 이름이 있는 것과 그것을 실행하는 것은 다른 사실이다."""
        self.assertTrue(
            any("scripts/check-review-gate.py" in c for c in self._run_commands()),
            f"어느 step 도 스크립트를 실행하지 않는다: {self._run_commands()}",
        )

    def test_the_job_condition_exempts_dependabot(self):
        """`if:` 그 자리여야 한다 — 같은 문자열이 `env:` 나 주석에 있는 것은 면제가 아니다."""
        cond = self.job.get("if", "")
        self.assertIn("dependabot[bot]", cond,
                      f"job 의 if 조건에 봇 면제가 없다: {cond!r}")
        self.assertIn("!=", cond, "면제는 부정 비교여야 한다 — 봇만 돌리면 정반대다")

    def test_checkout_fetches_full_history(self):
        """`with.fetch-depth: 0` 이 checkout step 에 붙어야 한다. 없으면 merge-base 가 없어
        게이트가 조용히 fail-open 한다 — 워크플로는 초록인 채 백스톱만 죽는다."""
        depths = [st.get("with", {}).get("fetch-depth")
                  for st in self.job["steps"]
                  if isinstance(st.get("uses"), str) and st["uses"].startswith("actions/checkout")]
        self.assertTrue(depths, "checkout step 이 없다")
        self.assertIn(0, depths, f"fetch-depth: 0 이 아니다: {depths}")

    def test_trigger_paths_cover_the_logic_it_depends_on(self):
        """`codebase/**` 만 걸면 게이트 로직 자체를 고친 PR 에서 안 돈다 —
        `harness-checks.yml` 이 같은 실패 클래스를 여섯 번 겪고 세운 규칙.

        `branch_guard.py` 가 목록에 있는 이유: `review_guard._default_branch()` 가 그 모듈의
        `_origin_default_branch` 를 import 한다. 리뷰어가 지적하기 전까지 빠져 있었고, 그
        파일만 고친 PR 은 이 워크플로를 트리거하지 않았다.
        """
        paths = self.on["pull_request"]["paths"]
        for required in ("codebase/**",
                         ".claude/hooks/_lib/review_guard.py",
                         ".claude/hooks/_lib/branch_guard.py",
                         ".claude/_shared/**",
                         "scripts/check-review-gate.py",
                         ".github/workflows/review-gate.yml"):
            self.assertIn(required, paths)

    def test_it_is_still_observation_only(self):
        """`--enforce` 로 뒤집는 것은 워크플로 계약 변경이라 의도적 결정이어야 한다. 이 단언은
        그 전환이 조용히 일어나지 않게 한다 — 켤 때 이 테스트도 같이 바뀐다.

        `run:` 명령만 본다. 주석은 켤 때 무엇을 붙이는지 설명하려 `--enforce` 를 인용한다."""
        for cmd in self._run_commands():
            self.assertNotIn("--enforce", cmd)


if __name__ == "__main__":
    unittest.main()
