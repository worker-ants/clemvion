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
            "        return ('⚠️  세션X: 하향 감지',)\n"
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

        # 환경변수·raw argv 접근 금지. 5R 리뷰어 셋이 각각 다른 변형으로 실증했다 —
        # `os.environ["GITHUB_ACTOR"] == "trusted-release-bot"` 조기 return,
        # `REVIEW_GATE_SKIP` 조건부 override, actor 화이트리스트로 `blocked=False` 강제.
        # 전부 **비-Call 접근**(Subscript/Compare/IfExp)이라 호출 허용 목록을 그대로 통과했다.
        # 이 스크립트가 환경을 읽을 정당한 이유는 없다 — 입력은 argparse 가 전부다.
        _ENV_NAMES = ("environ", "getenv", "argv", "putenv", "environb")
        for node in ast.walk(tree):
            # `os.environ` 형태
            if isinstance(node, ast.Attribute) and node.attr in _ENV_NAMES:
                self.fail(f"{node.lineno}행: {node.attr!r} 에 접근한다 — "
                          "환경으로 판정을 갈아탈 수 있는 자리다")
            # `from os import environ as _E` 형태. 모듈(`os`)은 허용 목록에 있으므로 import
            # 검사를 그대로 통과한다 — 6R 리뷰어가 이 형태로 `_E["GITHUB_WORKFLOW"]` 비교를
            # 심어 review-gate job 위에서만 판정을 뒤집는 것을 실증했다.
            if isinstance(node, ast.ImportFrom):
                for a in node.names:
                    self.assertNotIn(
                        a.name, _ENV_NAMES,
                        f"{node.lineno}행: `from {node.module} import {a.name}` — "
                        "이름을 바꿔 들여와도 환경 접근이다",
                    )

        attrs = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
        self.assertIn("evaluate_review", attrs,
                      "review_guard.evaluate_review 를 가져오지 않는다")


class WorkflowWiringTest(unittest.TestCase):
    """워크플로 **문서 전체**를 기대값과 정확 일치로 고정한다.

    네 번 뚫렸고, 매번 같은 이유였다 — **부분에 대한 정확 일치는 여전히 부분 일치다.**

      1R  substring          → `if:` 를 지우고 같은 문자열을 `env:` 에 남기면 통과.
      2R  구조 + 부분 정규식   → `(actor == 'dependabot[bot]') != false`(의미 정반대)가 통과.
      3R  앵커 없는 정규식     → `if: … && false` 로 백스톱이 모든 PR 에서 영구히 꺼져도 통과.
      4R  **필드별 정확 일치** → 내가 고정한 필드만 안전했다. 리뷰어 9명 이상이 독립 재현:
          · `jobs.gate.continue-on-error: true` — step 에서만 막고 **job 은 안 막았다**.
            게이트가 exit 1 을 내도 job 이 성공으로 보고된다.
          · `on.pull_request.branches: ['없는-브랜치']` — `paths` 만 고정하고 형제 키는 열어뒀다.
            **enforce 여부와 무관하게 지금 당장** 이 워크플로가 영원히 트리거되지 않고,
            Actions 탭에 실행 기록조차 안 남아 감지되지 않는다.
          · `types: [closed]` — PR 이 닫힐 때만 돌아 리뷰가 필요한 시점엔 개입하지 못한다.
          · step 목록에 no-op 스텁 덮어쓰기/`$GITHUB_PATH` 하이재킹 스텝 삽입 — 개별 step 만
            보고 **목록 자체(개수·순서)** 는 안 봤다.

    매번 발견된 그 필드를 추가로 고정하는 것으로 대응했고, 매번 옆의 열린 필드로 다시 뚫렸다.
    열거로는 끝나지 않는다 — 파싱된 문서 **전체**를 하나의 기대값과 비교한다. 그러면 어디에
    무엇을 더하든 빼든 바꾸든 실패하고, 남는 열린 필드가 없다.

    (주석은 YAML 파싱에 안 남으므로 설명을 고치는 것은 자유롭다. 배선을 바꾸면 여기 기대값도
    같이 바꿔야 하고, 그 순간이 "이게 게이트를 끄는 변경인가" 를 판단할 자리다.)
    """

    # 파싱된 워크플로 전체. `on:` 은 YAML 1.1 에서 불리언 True 로 파싱된다.
    EXPECTED = {
        "name": "review-gate",
        True: {
            "pull_request": {
                "paths": [
                    "codebase/**",
                    ".claude/hooks/_lib/**",
                    ".claude/_shared/**",
                    "scripts/check-review-gate.py",
                    ".github/workflows/review-gate.yml",
                ]
            }
        },
        "concurrency": {
            "group": "review-gate-${{ github.ref }}",
            "cancel-in-progress": True,
        },
        "permissions": {"contents": "read"},
        "jobs": {
            "gate": {
                "runs-on": "ubuntu-latest",
                "timeout-minutes": 5,
                "if": "github.actor != 'dependabot[bot]'",
                "steps": [
                    {"uses": "actions/checkout@v7", "with": {"fetch-depth": 0}},
                    {"uses": "actions/setup-python@v7",
                     "with": {"python-version": "3.x"}},
                    {"name": "Fetch base ref",
                     "env": {"BASE_REF": "${{ github.base_ref }}"},
                     "run": 'git fetch --no-tags origin "$BASE_REF"'},
                    {"name": "Review coverage backstop",
                     "run": "python3 scripts/check-review-gate.py"},
                ],
            }
        },
    }

    @classmethod
    def setUpClass(cls):
        # fail-CLOSED. 초판은 `SkipTest` 였는데, 이 파일만 타겟 재실행하는 관행(실패 reviewer
        # 만 다시 돌린다)에서 PyYAML 이 없으면 아래 배선 불변식 전부가 무음 `OK` 로 통과한다.
        # 전체 스위트가 안전했던 것은 이 클래스의 설계가 아니라, 무관한 옆 파일이 우연히
        # fail-closed 인 덕이었다 — 문서화도 테스트도 안 된 결합이다.
        import yaml  # noqa: PLC0415 — 부재 시 ImportError 로 이 클래스를 죽이는 것이 의도
        cls._yaml = yaml

    def setUp(self):
        path = _harness.REPO_ROOT / ".github" / "workflows" / "review-gate.yml"
        self.doc = self._yaml.safe_load(path.read_text(encoding="utf-8"))

    def test_the_whole_workflow_matches_the_expected_wiring(self):
        """이 한 줄이 위 네 라운드의 우회를 전부 덮는다."""
        self.assertEqual(self.doc, self.EXPECTED)

    def test_the_expectation_still_describes_a_gate_that_runs(self):
        """기대값 자체가 무의미해지는 것을 막는다.

        위 단언은 "문서 == 기대값" 이므로, 기대값을 게이트가 꺼진 모양으로 함께 고쳐버리면
        여전히 통과한다. 사람이 그 편집을 의식적으로 하도록 강제할 수는 없지만, 최소한
        **기대값이 만족해야 할 성질**은 여기 적어둔다 — 둘 다 고치려면 이 목록도 마주쳐야 한다.
        """
        job = self.EXPECTED["jobs"]["gate"]
        steps = job["steps"]
        gate = [st for st in steps if st.get("run", "").startswith("python3 ")]
        self.assertEqual(len(gate), 1, "게이트를 부르는 step 이 정확히 하나가 아니다")
        self.assertEqual(gate[0]["run"], "python3 scripts/check-review-gate.py")

        # 실행을 막거나(if) 실패를 삼키거나(continue-on-error) 즉시 끝내는(timeout 0) 키는
        # job 에도 step 에도 없어야 한다. 4R 은 step 만 막혀 있어 job 레벨로 우회됐다.
        for scope, d in [("job", job)] + [(f"step[{i}]", st) for i, st in enumerate(steps)]:
            self.assertNotIn("continue-on-error", d, f"{scope} 가 실패를 삼킨다")
            if scope != "job":
                self.assertNotIn("if", d, f"{scope} 가 조건부라 건너뛸 수 있다")
        self.assertNotEqual(job.get("timeout-minutes"), 0)

        trigger = self.EXPECTED[True]["pull_request"]
        self.assertEqual(set(trigger), {"paths"},
                         "pull_request 에 paths 외 키가 있다 — 트리거 범위가 좁혀졌다")
        self.assertIn("codebase/**", trigger["paths"])

        checkout = [st for st in steps
                    if str(st.get("uses", "")).startswith("actions/checkout")]
        self.assertEqual(len(checkout), 1)
        self.assertEqual(checkout[0]["with"]["fetch-depth"], 0,
                         "shallow 체크아웃이면 merge-base 가 없어 게이트가 fail-open 한다")
        self.assertLess(steps.index(checkout[0]), steps.index(gate[0]))

        self.assertNotIn("--enforce", gate[0]["run"],
                         "관측 모드 계약 — 켤 때는 이 단언도 함께 바꾼다")


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

    # GH Actions 가 실제로 채우는 이름들 + 우회에 쓰일 법한 이름. 이 값들이 판정을 바꾸면
    # 아래 표가 어긋난다. 초판은 `{**os.environ, …}` 로 부모 환경을 통째로 상속해서, 환경을
    # 읽는 우회를 **테스트 자신이 재현할 수 없었다**.
    _HOSTILE_ENV = {
        # GH Actions 가 실제로 채우는 표준 컨텍스트 전부 — 이 중 무엇으로 갈라지든 표가
        # 어긋난다. 초판은 다섯 개뿐이었고 `GITHUB_WORKFLOW`/`GITHUB_JOB` 이 빠져 있어,
        # 리뷰어가 정확히 그 둘로 "review-gate job 위에서만 통과" 를 실증했다.
        "GITHUB_ACTIONS": "true",
        "GITHUB_ACTOR": "trusted-release-bot",
        "GITHUB_BASE_REF": "main",
        "GITHUB_EVENT_NAME": "pull_request",
        "GITHUB_HEAD_REF": "feature",
        "GITHUB_JOB": "gate",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_REPOSITORY": "worker-ants/clemvion",
        "GITHUB_RUN_ID": "1",
        "GITHUB_WORKFLOW": "review-gate",
        "CI": "true",
        # 우회에 쓰일 법한 이름들.
        "REVIEW_GATE_SKIP": "1",
        "REVIEW_GATE_ENFORCE": "1",
        "BYPASS_REVIEW_GUARD": "1",
    }

    def _exit_code(self, blocked, enforce, extra_env):
        argv = [sys.executable, str(SCRIPT), "--root", self.root]
        if enforce:
            argv.append("--enforce")
        env = {
            # 최소 실행 환경만 명시한다 — 부모 환경 상속 금지.
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("HOME", ""),
            "LANG": "C.UTF-8",
            "STUB_BLOCKED": "1" if blocked else "0",
            **extra_env,
        }
        return subprocess.run(argv, capture_output=True, text=True, timeout=120,
                              env=env)

    def test_exit_code_is_a_pure_function_of_the_gate_verdict(self):
        for label, extra in (("최소 환경", {}), ("적대적 환경", self._HOSTILE_ENV)):
            for blocked, enforce, expected in self._CASES:
                with self.subTest(env=label, blocked=blocked, enforce=enforce):
                    r = self._exit_code(blocked, enforce, extra)
                    self.assertEqual(
                        r.returncode, expected,
                        f"[{label}] 게이트가 blocked={blocked} 라고 했는데 "
                        f"exit={r.returncode} (기대 {expected})\n{r.stdout}{r.stderr}",
                    )
                    self.assertIn("미커버" if blocked else "통과", r.stdout)

class TheGateItselfDoesNotBranchOnCiEnvTest(unittest.TestCase):
    """판정자 **본체**도 환경으로 갈라지지 않는다.

    6R 까지 "판정자는 하나" 는 `check-review-gate.py` 한 파일만 지켰다. 그런데 실제 판정은
    `review_guard.evaluate_review()` 가 한다 — 거기에
    `if os.environ.get("GITHUB_JOB") == "gate": return ReviewDecision(False, …)` 세 줄이면
    **CI 에서만** 영구 통과된다. 리뷰어가 실증했고, 어느 가드도 그 파일을 보지 않았다:
    `OneJudgeTest` 는 스크립트만 스캔하고, 행위 테스트는 `review_guard.py` 를 스텁으로 통째로
    교체해 실물을 한 번도 실행하지 않는다.

    금지가 아니라 **등재제**다 — 게이트에는 정당한 환경 사용이 하나 있다
    (`CLAUDE_PROJECT_DIR`, 훅이 워크트리 루트를 알려주는 경로). 새 환경 접근이 생기면 여기서
    마주치고, 등재하는 순간이 "이게 CI 에서만 다르게 굴게 만드는가" 를 판단할 자리다.
    """

    # (파일, 읽는 환경변수) — 이 목록 밖의 접근은 실패한다.
    _ALLOWED = {
        ("review_guard.py", "CLAUDE_PROJECT_DIR"),
    }
    # `hooks/_lib` 셋 + 게이트가 **위임하는** `_shared` 전부. 9R 리뷰어가 `report_paths.py`/
    # `block_integrity.py` 에 `GITHUB_JOB == "gate"` 분기를 심어 127개 테스트가 전부 통과하는
    # 것을 실증했다 — 실제 판정(Gate1 커버리지, Gate2 하향 감지)이 그 두 함수로 내려가는데
    # 스캔 대상에 없었다. 목록을 손으로 유지하지 않고 디렉터리에서 도출한다.
    _SCANNED_LIB = ("review_guard.py", "branch_guard.py", "plan_guard.py")

    def test_no_unregistered_environment_reads_in_the_gate(self):
        seen = set()
        targets = [_harness.HOOKS_DIR / "_lib" / n for n in self._SCANNED_LIB]
        targets += sorted((_harness.CLAUDE_DIR / "_shared").glob("*.py"))
        for path in targets:
            name = path.name
            if not path.exists() or name == "__init__.py":
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                key_names = []
                # `os.environ.get("X")` / `os.environ["X"]` / `os.getenv("X")`
                if isinstance(node, ast.Call):
                    f = node.func
                    if isinstance(f, ast.Attribute) and f.attr in ("get", "getenv"):
                        base = f.value
                        is_env = (
                            (isinstance(base, ast.Attribute) and base.attr == "environ")
                            or (isinstance(base, ast.Name) and base.id == "os")
                        )
                        if is_env and node.args and isinstance(node.args[0], ast.Constant):
                            key_names.append(node.args[0].value)
                elif isinstance(node, ast.Subscript):
                    base = node.value
                    if isinstance(base, ast.Attribute) and base.attr == "environ":
                        sl = node.slice
                        if isinstance(sl, ast.Constant):
                            key_names.append(sl.value)
                for key in key_names:
                    seen.add((name, key))
                    with self.subTest(file=name, var=key):
                        self.assertIn(
                            (name, key), self._ALLOWED,
                            f"{name}:{node.lineno} 가 등재되지 않은 환경변수 {key!r} 를 "
                            "읽는다 — CI 에서만 다른 판정을 내는 자리가 된다",
                        )
        self.assertEqual(self._ALLOWED - seen, set(),
                         "`_ALLOWED` 에 더 이상 존재하지 않는 항목이 남아 있다")


class TheRealGateIgnoresTheEnvironmentTest(unittest.TestCase):
    """**실물** `evaluate_review()` 가 환경에 따라 다른 판정을 내지 않는다.

    7R 에서 정적 스캔이 또 뚫렸다 — 세 번째다.
      · `_SCANNED` 가 `_shared/report_paths.py`·`block_integrity.py` 를 안 봤다. 게이트가
        위임하는 그 파일에 `GITHUB_JOB == "gate"` 세 줄이면 강제 리뷰어가 리포트를 안 남긴
        세션이 CI 에서만 "완전 커버" 로 뒤집힌다(3명이 서로 다른 진입점으로 실증).
      · 스캔 대상 **안**에서도 `dict(os.environ.items()).get(...)`, `for k in os.environ`,
        동적 조립 키(`"GITHUB_" + "WORKFLOW"`)는 수집기가 인식하지 못한다.

    정적 열거는 문법의 수만큼 넓고, 이 브랜치에서 그 경주는 이미 네 번 졌다. 유한한 형태로
    바꾼다: **같은 저장소를 두 번 판정시켜 결과가 같은지 본다.** 한 번은 최소 환경, 한 번은
    GH Actions 컨텍스트를 가득 채운 환경. 어떤 파일에서 어떤 문법으로 환경을 읽든, 그것이
    판정을 바꾸면 여기서 어긋난다.

    스텁이 아니라 실물이다 — `VerdictComesFromTheGateTest` 는 `review_guard.py` 를 통째로
    교체하므로 게이트 본체도 `_shared` 도 한 번도 실행하지 않는다. 그 빈자리가 7R C1·C2 다.
    """

    _CI_ENV = {
        "GITHUB_ACTIONS": "true", "GITHUB_ACTOR": "trusted-release-bot",
        "GITHUB_BASE_REF": "main", "GITHUB_EVENT_NAME": "pull_request",
        "GITHUB_HEAD_REF": "feature", "GITHUB_JOB": "gate",
        "GITHUB_REF": "refs/heads/main", "GITHUB_REPOSITORY": "worker-ants/clemvion",
        "GITHUB_RUN_ID": "1", "GITHUB_WORKFLOW": "review-gate", "CI": "true",
        "REVIEW_GATE_SKIP": "1", "BYPASS_REVIEW_GUARD": "1",
    }

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        os.makedirs(os.path.join(self.root, ".claude"))
        shutil.copytree(str(_harness.CLAUDE_DIR / "hooks"),
                        os.path.join(self.root, ".claude", "hooks"))
        shutil.copytree(str(_harness.CLAUDE_DIR / "_shared"),
                        os.path.join(self.root, ".claude", "_shared"))
        self._git("init", "-b", "main")
        self._git("commit", "--allow-empty", "-m", "base")
        self._git("checkout", "-b", "feature")
        self._write("codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git("add", "-A")
        self._git("commit", "-m", "feat")

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

    def _verdict(self, extra_env):
        """실물 게이트를 서브프로세스에서 돌려 (blocked, reason) 를 받는다."""
        prog = (
            "import importlib.util,json,sys\n"
            f"sys.path.insert(0, {os.path.join(self.root, '.claude', 'hooks', '_lib')!r})\n"
            "import review_guard as rg\n"
            f"d = rg.evaluate_review({self.root!r})\n"
            'print(json.dumps({"blocked": bool(d.blocked), "reason": d.reason}))\n'
        )
        env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", ""),
               "LANG": "C.UTF-8", **extra_env}
        r = subprocess.run([sys.executable, "-c", prog], capture_output=True,
                           text=True, timeout=180, env=env, cwd=self.root)
        self.assertEqual(r.returncode, 0, r.stderr[-3000:])
        import json as _json
        return _json.loads(r.stdout.strip().splitlines()[-1])

    def test_the_verdict_is_identical_under_a_ci_environment(self):
        bare = self._verdict({})
        ci = self._verdict(self._CI_ENV)
        self.assertEqual(
            bare, ci,
            "환경에 따라 판정이 달라진다 — 게이트나 그것이 위임하는 코드 어딘가가 "
            "CI 컨텍스트를 읽고 있다",
        )

    def test_the_fixture_actually_produces_a_blocking_verdict(self):
        """비교가 무의미해지지 않게 — 둘 다 "통과" 면 어떤 우회도 표에 안 잡힌다."""
        self.assertTrue(self._verdict({})["blocked"],
                        "픽스처가 차단을 못 만든다 — 이 비교는 vacuous 하다")


class ReviewArtifactsStayTrackedTest(unittest.TestCase):
    """이 백스톱 전체가 서 있는 전제 — `review/**` 가 git 에 추적된다.

    CI 는 커밋된 것만 본다. 산출물이 추적되지 않으면 게이트는 아무 리뷰도 못 찾고, 관측 모드
    에서는 **모든 PR 이 "미커버"** 로 뜬다 — 늘 우는 경고가 되어 아무도 안 읽고, 백스톱은
    살아있는 채로 죽는다. `--enforce` 로 뒤집은 뒤라면 모든 PR 이 막힌다.

    실증: 산출물을 커밋한 저장소에서 `통과` 였던 것이, `.gitignore` 에 `review/` 한 줄을
    넣자 `미커버` + exit 1 로 뒤집혔다.

    티켓의 원래 전제("산출물은 gitignored 라 PR 에 없다")는 착수 전 실측으로 반증됐고 — 실제로는
    `origin/main` 이 `review/code` 아래 8,851개를 추적한다 — 그 반증이 이 층 전체를 가능하게
    했다. 그런데 그 사실을 지키는 것이 아무것도 없었다. 다섯 라운드 동안 우회는 매번 한 층
    밖으로 이동했고, 이건 그 바깥이다.
    """

    def test_gitignore_does_not_exclude_review_artifacts(self):
        """`_prompts/` 만 제외한다 — 그것이 현재 규약이고, 나머지는 남아야 한다."""
        import subprocess as _sp
        probes = {
            "review/code/2099/01/01/00_00_00/SUMMARY.md": False,
            "review/code/2099/01/01/00_00_00/RESOLUTION.md": False,
            "review/code/2099/01/01/00_00_00/meta.json": False,
            "review/consistency/2099/01/01/00_00_00/SUMMARY.md": False,
            # 유일한 의도적 제외 — 프롬프트는 review/ 부피의 ~70% 이고 판정에 안 쓰인다.
            "review/code/2099/01/01/00_00_00/_prompts/security.md": True,
        }
        for rel, should_be_ignored in probes.items():
            with self.subTest(path=rel):
                r = _sp.run(["git", "check-ignore", "-q", rel],
                            cwd=str(_harness.REPO_ROOT),
                            capture_output=True, text=True, timeout=60)
                ignored = r.returncode == 0
                self.assertEqual(
                    ignored, should_be_ignored,
                    f"{rel} 의 gitignore 상태가 기대와 다르다 — "
                    "산출물이 추적되지 않으면 CI 게이트는 아무 리뷰도 못 본다"
                    if not should_be_ignored else
                    f"{rel} 는 제외 대상인데 추적된다",
                )

    def test_the_committed_tree_actually_carries_review_artifacts(self):
        """규칙만이 아니라 **사실**도 본다. `.gitignore` 가 깨끗해도 아무도 커밋하지 않으면
        CI 는 여전히 아무것도 못 본다 — 그 경우 이 백스톱은 조용히 무의미해진다."""
        import subprocess as _sp
        r = _sp.run(["git", "ls-files", "--", "review/code"],
                    cwd=str(_harness.REPO_ROOT), capture_output=True, text=True,
                    timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        tracked = [ln for ln in r.stdout.splitlines() if ln.endswith("SUMMARY.md")]
        self.assertGreater(
            len(tracked), 100,
            f"추적되는 리뷰 SUMMARY 가 {len(tracked)}개뿐이다 — "
            "CI 백스톱은 커밋된 산출물 위에서만 판정할 수 있다",
        )


class PyYamlPinsAgreeTest(unittest.TestCase):
    """세 곳에 손으로 적힌 `pyyaml` pin 이 서로 같아야 한다.

    이 저장소는 "손-동기 쌍은 드리프트한다" 를 스스로 여러 번 기록해 두었는데(`report_paths`,
    `retry_state`, doc-sync 매트릭스) 이 pin 쌍은 아직 묶여 있지 않았다. 갈리면 harness 스위트가
    한 버전으로 통과하고 보안 가드가 다른 버전으로 도는 상태가 조용히 생긴다.

    단일 진실화(`constraints.txt`)가 더 낫지만 그건 세 워크플로의 설치 방식을 바꾸는 일이라
    범위 밖이다. 최소한 갈렸다는 사실은 여기서 드러난다.
    """

    def test_every_workflow_pins_the_same_version(self):
        import re as _re
        # 큰따옴표·홑따옴표·무인용을 모두 인식한다. 초판은 큰따옴표만 봐서, 형태를 바꾼
        # pin 은 "다르다" 로 실패하는 게 아니라 **아예 안 잡혀 조용히 통과**했다.
        pat = _re.compile(r"""pip\s+install\s+["']?(pyyaml[^"'\s]*)["']?""", _re.I)
        pins, files_with_yaml = {}, set()
        for path in sorted((_harness.REPO_ROOT / ".github" / "workflows").glob("*.yml")):
            text = path.read_text(encoding="utf-8")
            if _re.search(r"pyyaml", text, _re.I):
                files_with_yaml.add(path.name)
            for m in pat.finditer(text):
                pins.setdefault(m.group(1), []).append(path.name)
        self.assertTrue(pins, "pyyaml 설치 스텝을 못 찾았다 — 이 가드가 stale 하다")
        # 언급된 파일과 pin 이 잡힌 파일이 어긋나면, 인식 못 한 형태가 있다는 뜻이다.
        self.assertEqual(
            files_with_yaml, {n for names in pins.values() for n in names},
            "pyyaml 을 언급하지만 pin 을 못 읽은 워크플로가 있다 — 정규식이 그 형태를 모른다",
        )
        self.assertEqual(len(pins), 1, f"pyyaml pin 이 갈렸다: {pins}")


if __name__ == "__main__":
    unittest.main()
