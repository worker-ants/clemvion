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

import ast
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

        형제 테스트가 전부 `--root <tempdir>` 를 명시로 넘겨서, 스크립트가 자기 위치로부터
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
        with open(self.gate_module, "w", encoding="utf-8") as f:
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
    """스크립트의 **import 표면**과 명백한 재구현 신호를 좁게 유지한다.

    이 클래스는 한때 "이 스크립트 안에 두 번째 판정자가 없다" 를 증명한다고 주장했고, 네 세대에
    걸쳐 반증됐다 — 자기 docstring, 자기 안내 문구, `pathlib.rglob`, 2단 속성 체인, 지역 별칭,
    `getattr`, `__import__`, `os.popen`, 속성 재바인딩(`sys.exit = os.system`),
    `getattr(sys.modules['os'], …)`. 임의의 파이썬에서 그 부정을 정적으로 증명하는 것은 무한한
    표면이고, 매 라운드 새 우회가 나온 것이 증거다.

    **그 주장은 이제 `VerdictComesFromTheGateTest` 가 행위로 한다** — 종료 코드가 스텁 게이트
    판정의 순함수인지 네 조합으로 확인하므로, 숨은 두 번째 판정자가 결과를 바꾸면 어떤 방식이든
    거기서 어긋난다.

    여기 남은 것은 그보다 약하고 정직한 성질이다: 새 의존이 들어오면 알아차린다. 정적 검사로
    닫을 수 있는 만큼만 닫고, 못 닫는 부분은 위 행위 테스트에 맡긴다.
    """


    # 스크립트가 실제로 쓰는 전부. 열거를 뒤집은 이유는 아래 docstring 참조.
    _ALLOWED_IMPORTS = {"__future__", "argparse", "os", "sys", "review_guard"}
    _ALLOWED_CALLS = {
        "__doc__.split", "_load_gate", "main", "print", "type", "getattr", "list",
        "evaluate",                       # `_load_gate` 가 돌려준 게이트 함수
        "ap.add_argument", "ap.parse_args", "argparse.ArgumentParser",
        "os.path.abspath", "os.path.dirname", "os.path.join",
        "sys.exit", "sys.path.insert",
    }

    @staticmethod
    def _dotted(node):
        """`os.path.join` 같은 임의 길이 체인을 점 표기로. 못 풀면 None.

        1차 판은 `Attribute(value=Name)` 한 단계만 인식했다. 그래서 `os.path.isdir` 은
        **아예 기록되지 않았고** — 두 단계라서 — 금지 목록에도 안 걸렸다. 인식 못 한 형태를
        조용히 버리는 수집기는 그 자체가 구멍이다.
        """
        parts = []
        while isinstance(node, ast.Attribute):
            parts.append(node.attr)
            node = node.value
        if isinstance(node, ast.Name):
            parts.append(node.id)
            return ".".join(reversed(parts))
        return None

    def test_the_import_and_call_surface_stays_small(self):
        """import 도 **호출도** 허용 목록으로 유지한다.

        네 번 뚫렸다.
        1차 파일 전체 grep → 스크립트 docstring 이 설계 근거로 인용한 `review/code`.
        2차 docstring 제외 → 사용자 안내 **문구**("codebase/** 변경을 커버하는…").
        3차 연산 금지 목록 → `pathlib.rglob`, `from os import walk as _w`.
        4차 import 는 허용 목록으로 뒤집었지만 **호출 축은 여전히 금지 목록**이라 리뷰어가
            다섯 가지를 더 실증했다: 2단 체인(`os.path.isdir`), 지역 별칭(`walk = os.walk`),
            `getattr(os, "walk")()`, `__import__("os").walk()`, 그리고 애초에 목록에 없던
            `os.popen`/`os.system`.

        금지 목록은 우회를 상상하는 만큼만 강하고 상상은 늘 부족하다 — 같은 결론에 네 번째로
        도달했으므로 이번엔 두 축 모두 뒤집는다. 이 스크립트가 하는 일은 "인자를 읽고, 게이트를
        부르고, 출력한다" 뿐이라 목록이 짧고 안정적이다. 새 호출이 필요해지면 여기서 실패하고,
        그때 그것이 판정 재구현인지 사람이 판단한다.
        """
        tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))

        imported = set()
        alias_of = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported |= {a.name.split(".")[0] for a in node.names}
                for a in node.names:
                    alias_of[a.asname or a.name] = a.name
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
                for a in node.names:
                    alias_of[a.asname or a.name] = f"{node.module}.{a.name}"
        extra = imported - self._ALLOWED_IMPORTS
        self.assertEqual(extra, set(), f"허용되지 않은 import: {sorted(extra)}")
        self.assertIn("review_guard", imported, "게이트를 import 하지 않는다")

        # 지역 별칭(`walk = os.walk`)도 정본으로 되돌린다.
        for node in ast.walk(tree):
            if (isinstance(node, ast.Assign) and len(node.targets) == 1
                    and isinstance(node.targets[0], ast.Name)):
                src = self._dotted(node.value)
                if src:
                    alias_of.setdefault(node.targets[0].id, src)

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = self._dotted(node.func)
            self.assertIsNotNone(
                name,
                f"{node.lineno}행: 호출 형태를 해석할 수 없다 "
                f"({type(node.func).__name__}) — 해석 못 하는 호출은 검사도 못 한다",
            )
            head, _, rest = name.partition(".")
            resolved = f"{alias_of[head]}.{rest}" if head in alias_of and rest else \
                       alias_of.get(name, name)
            self.assertIn(
                resolved, self._ALLOWED_CALLS,
                f"{node.lineno}행: 허용되지 않은 호출 {resolved!r} — "
                "판정을 재구현하면 로컬/CI 가 갈린다",
            )

        # `getattr` 은 허용하지만(`getattr(decision, "notes", ())`), 모듈에서 속성을 꺼내는
        # 용도면 그것이 곧 `getattr(os, "walk")` 우회다.
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                    and node.func.id == "getattr" and node.args):
                first = node.args[0]
                if isinstance(first, ast.Name):
                    self.assertNotIn(
                        alias_of.get(first.id, first.id), imported,
                        f"{node.lineno}행: getattr 로 모듈 속성을 꺼낸다 — 우회다",
                    )

        # 속성을 **대입 대상**으로 쓰는 문장은 무조건 위반. `sys.exit = os.system` 한 줄이면
        # 새 import 도 새 호출 이름도 없이 동작이 통째로 바뀌는데, 위 허용 목록은 이름만 보므로
        # 전부 통과한다(3R 리뷰어가 실제 셸 실행까지 실증). 이 스크립트가 남의 속성에 대입할
        # 정당한 이유는 없으므로 형태 자체를 금지하는 편이 유한하고 완전하다.
        for node in ast.walk(tree):
            targets = []
            if isinstance(node, ast.Assign):
                targets = node.targets
            elif isinstance(node, (ast.AugAssign, ast.AnnAssign)):
                targets = [node.target]
            for t in targets:
                self.assertNotIsInstance(
                    t, ast.Attribute,
                    f"{node.lineno}행: 속성에 대입한다 — 재바인딩으로 동작을 바꾸는 형태다",
                )

        attrs = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
        self.assertIn("evaluate_review", attrs,
                      "review_guard.evaluate_review 를 가져오지 않는다")


class WorkflowWiringTest(unittest.TestCase):
    """워크플로의 배선을 **정확 일치**로 고정한다.

    패턴 매칭을 세 번 시도했고 세 번 다 뚫렸다.
      1R  substring        → `if:` 를 지우고 같은 문자열을 `env:` 에 남기면 통과.
      2R  구조 + 부분 정규식 → `(actor == 'dependabot[bot]') != false`(의미 정반대)가 통과.
      3R  앵커 없는 정규식   → `if: github.actor != 'dependabot[bot]' && false` 가 통과.
          그 한 줄이면 **백스톱이 모든 PR 에서 영구히 꺼지는데** 15개 테스트가 전부 GREEN 이었다.
          11명의 리뷰어가 각자 다른 최소 변경으로 같은 결론에 도달했다.

    문제는 매번 "이런 우회도 있네" 가 아니라 **접근이 틀렸다**는 것이었다. 임의의 표현식에서
    "의미가 보존되는가" 를 부분 일치로 판정하려는 것은 무한한 표면이고, 나는 그 표면을 세 번
    좇았다. 워크플로는 작고 안정적인 설정 파일이므로 **기대값 전체를 적어두는 편이 유한하고
    완전하다**: 어떤 변경이든 실패하고, 저자는 기대값을 의식적으로 갱신하면서 그 변경이 배선을
    깨는지 스스로 판단하게 된다. 우회할 패턴이 아예 없다.
    """

    # 기대되는 배선 전체. 바꾸려면 여기도 같이 바꿔야 하고, 그 순간이 "이게 게이트를 끄는
    # 변경인가" 를 판단할 자리다.
    EXPECTED_IF = "github.actor != 'dependabot[bot]'"
    EXPECTED_GATE_RUN = "python3 scripts/check-review-gate.py"
    EXPECTED_CONCURRENCY = {
        "group": "review-gate-${{ github.ref }}",
        "cancel-in-progress": True,
    }
    EXPECTED_PATHS = [
        "codebase/**",
        ".claude/hooks/_lib/review_guard.py",
        ".claude/hooks/_lib/branch_guard.py",
        ".claude/_shared/**",
        "scripts/check-review-gate.py",
        ".github/workflows/review-gate.yml",
    ]

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
        # YAML 1.1 에서 `on:` 은 불리언 True 로 파싱된다 — 모르면 KeyError 로 죽는다.
        self.on = self.doc.get("on", self.doc.get(True))
        self.job = self.doc["jobs"]["gate"]
        self.steps = self.job["steps"]

    def _gate_step_index(self):
        for idx, st in enumerate(self.steps):
            if isinstance(st.get("run"), str) and self.EXPECTED_GATE_RUN in st["run"]:
                return idx
        self.fail(f"게이트를 부르는 step 이 없다: {self.steps}")

    def test_the_gate_step_runs_exactly_the_expected_command(self):
        """`in` 이 아니라 `==`. `echo "…check-review-gate.py"` 나 주석 decoy 가 통과하던
        자리다. 명령이 정확히 그것이면 치환도, 플래그 조립도, 축약도 끼어들 수 없다."""
        idx = self._gate_step_index()
        self.assertEqual(self.steps[idx]["run"].strip(), self.EXPECTED_GATE_RUN)

    def test_the_gate_step_is_unconditional(self):
        """step 레벨 `if:` 하나면 그 step 만 조용히 건너뛴다. 관측 모드는 위반이어도 exit 0
        이라 GitHub 로그의 초록 체크로는 실행 여부가 구분되지 않는다."""
        self.assertNotIn("if", self.steps[self._gate_step_index()])

    def test_the_job_condition_is_exactly_the_bot_exemption(self):
        """전체 일치. `&& false` 를 덧붙이면 백스톱이 모든 PR 에서 영구히 꺼지는데, 앵커 없는
        정규식은 그것을 통과시켰다(3R, 리뷰어 실증)."""
        self.assertEqual(self.job.get("if", ""), self.EXPECTED_IF)

    def test_the_checkout_before_the_gate_fetches_full_history(self):
        """게이트 **직전**의 checkout 만 본다. "어느 하나라도" 로 보면 shallow 인 실효
        checkout 옆에 deep 인 decoy 를 두는 것으로 통과한다 — merge-base 가 없으면 게이트는
        조용히 fail-open 하고 워크플로는 초록이다."""
        gate = self._gate_step_index()
        before = [st for st in self.steps[:gate]
                  if isinstance(st.get("uses"), str)
                  and st["uses"].startswith("actions/checkout")]
        self.assertTrue(before, "게이트 앞에 checkout 이 없다")
        self.assertEqual(before[-1].get("with", {}).get("fetch-depth"), 0)

    def test_trigger_paths_are_exactly_the_expected_set(self):
        """`branch_guard.py` 가 여기 있는 이유: `review_guard._default_branch()` 가 그 모듈을
        import 한다. 1R 까지 빠져 있어 그 파일만 고친 PR 은 이 워크플로를 안 돌렸다."""
        self.assertEqual(self.on["pull_request"]["paths"], self.EXPECTED_PATHS)

    def test_concurrency_is_pinned(self):
        """`--enforce` 로 뒤집은 뒤에는, 차단해야 할 PR 이 무관한 실행에 의해 취소되는 것이
        곧 무음 통과다. 지금은 관측 모드라 비용만 문제지만 성질은 지금 고정한다."""
        self.assertEqual(self.doc.get("concurrency"), self.EXPECTED_CONCURRENCY)

    def test_it_is_still_observation_only(self):
        """`--enforce` 로 뒤집는 것은 워크플로 계약 변경이라 의도적 결정이어야 한다.

        위 정확 일치가 이미 이것을 함의하지만(명령이 정확히 그 문자열이면 플래그가 있을 수
        없다) 별도로 남긴다 — 켤 때 저자가 마주치는 이름이 `test_it_is_still_observation_only`
        여야 "지금 계약을 바꾸는 중" 임이 드러난다."""
        self.assertNotIn("--enforce", self.EXPECTED_GATE_RUN)
        self.assertEqual(self.steps[self._gate_step_index()]["run"].strip(),
                         self.EXPECTED_GATE_RUN)


class VerdictComesFromTheGateTest(unittest.TestCase):
    """판정자가 하나임을 **행위**로 고정한다 — 소스 모양이 아니라.

    `OneJudgeTest` 는 "이 스크립트 안에 두 번째 판정자가 없다" 를 정적으로 증명하려 했고, 네
    세대에 걸쳐 뚫렸다: 자기 docstring · 자기 안내 문구 · `pathlib.rglob` · 2단 속성 체인 ·
    지역 별칭 · `getattr` · `__import__` · `os.popen` · **속성 재바인딩**(`sys.exit = os.system`)
    · `getattr(sys.modules['os'], …)`. 임의의 파이썬에서 부정을 정적으로 증명하는 것은 무한한
    표면이고, 매 라운드 새 우회가 나온 것이 그 증거다.

    유한한 형태로 바꾼다: 게이트를 스텁으로 두고 **스크립트의 종료 코드가 (스텁 판정 × 플래그)
    의 순함수인지** 네 조합 전부에서 확인한다. 두 번째 판정자가 결과를 바꿀 수 있다면 어떤
    방식으로 숨어 있든 이 표에서 어긋난다 — 우회할 패턴이 없고, 검사 대상이 유한하다.

    `OneJudgeTest` 는 남기되 무엇을 증명하는지 낮춰 적었다(import 표면 + 명백한 재구현 신호).
    """

    _CASES = [(False, False, 0), (False, True, 0), (True, False, 0), (True, True, 1)]

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        os.makedirs(os.path.join(self.root, ".claude", "hooks", "_lib"))
        with open(os.path.join(self.root, ".claude", "hooks", "_lib",
                               "review_guard.py"), "w", encoding="utf-8") as f:
            f.write(
                "import os\n"
                "class _D:\n"
                "    push_blocks = False\n"
                "    notes = ()\n"
                "    reason = 'stub'\n"
                "    blocked = os.environ['STUB_BLOCKED'] == '1'\n"
                "def evaluate_review(cwd=None, *, in_flight_ok=False):\n"
                "    return _D()\n"
            )

    def test_exit_code_is_a_pure_function_of_the_gate_verdict(self):
        for blocked, enforce, expected in self._CASES:
            with self.subTest(blocked=blocked, enforce=enforce):
                argv = [sys.executable, str(SCRIPT), "--root", self.root]
                if enforce:
                    argv.append("--enforce")
                r = subprocess.run(
                    argv, capture_output=True, text=True, timeout=120,
                    env={**os.environ, "STUB_BLOCKED": "1" if blocked else "0"},
                )
                self.assertEqual(
                    r.returncode, expected,
                    f"게이트가 blocked={blocked} 라고 했는데 exit={r.returncode} "
                    f"(기대 {expected}) — 스크립트가 자기 판정을 갖고 있다\n{r.stdout}{r.stderr}",
                )
                self.assertIn("미커버" if blocked else "통과", r.stdout)


if __name__ == "__main__":
    unittest.main()
