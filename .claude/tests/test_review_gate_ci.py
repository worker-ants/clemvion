"""`scripts/check-review-gate.py` — 훅과 독립인 CI 백스톱.

이 층의 존재 이유는 로컬 훅의 push 탐지 정규식이 유일 판정자라는 것이다: 그 정규식이 push 를
놓치면 게이트가 조용히 skip 되고, 놓쳤다는 사실을 인지할 주체가 없다. 그래서 판정은 로컬과
**같은** `evaluate_review()` 를 쓰되, 트리거만 훅 밖(GitHub PR 이벤트)에 둔다.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)부터 그 판정은 저장소 `review/**` 파일이 아니라
NERV 리뷰 라운드(N1)를 읽는다. 테스트는 loopback 가짜 서버(`_harness.FakeNervServer`)를
`NERV_SERVER` 로 넘겨 실물 클라이언트(curl)까지 돌린다. 네트워크는 쓰지 않는다.

여기서 고정하는 성질:

1. **판정자가 하나다** — 스크립트가 자기 판정 로직을 새로 갖지 않는다. 두 번째 구현은 로컬과
   CI 판정이 갈리는 drift 이고, 이 저장소는 `report_paths` / `retry_state` 로 그 실패를 이미
   두 번 겪었다.
2. **`--enforce` 가 기본이다 (2026-08-07 전환)** — 위반이면 exit 1.
3. **판정 불가는 둘로 나뉜다** — 게이트를 못 불러오거나 NERV 가 응답하지 않으면 exit 0
   (fail-open: 막는 것은 판정된 위반이지 판정기의 고장이 아니다). 설정 문제(토큰 · 서버 주소
   없음, 401 · 403 · 404)는 `--enforce` 에서 exit 1 — secret 이 빠진 백스톱은 초록인 채로
   영원히 꺼진다.
4. **advisory 는 판정과 무관하게 나온다**.
5. **산출물 파일은 판정 근거가 아니다** — PR 에 커밋한 가짜 `SUMMARY.md`/`RESOLUTION.md` 로
   통과하던 우회(옛 리뷰 정리 `legacy-triage` 라운드 1)가 닫혔다.

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

# 부모 환경에서 넘어오면 안 되는 이름. 개발자 셸에는 실제 NERV 토큰이 있다 — 테스트가 그대로
# 물려받으면 실서버에 요청이 나간다.
_NERV_ENV = ("NERV_SERVER", "NERV_TOKEN", "NERV_PROJECT")


def _clean_env(extra=None):
    env = {k: v for k, v in os.environ.items() if k not in _NERV_ENV}
    env.update(extra or {})
    return env


def _copy_gate(root):
    """게이트 본체와 그것이 import 하는 것을 임시 저장소로 복사한다(CI 체크아웃과 같은 모양)."""
    os.makedirs(os.path.join(root, ".claude", "tools"), exist_ok=True)
    shutil.copytree(str(_harness.CLAUDE_DIR / "hooks"), os.path.join(root, ".claude", "hooks"))
    shutil.copytree(str(_harness.CLAUDE_DIR / "_shared"), os.path.join(root, ".claude", "_shared"))
    shutil.copytree(str(_harness.CLAUDE_DIR / "tools" / "nerv-mirror"),
                    os.path.join(root, ".claude", "tools", "nerv-mirror"))


class ReviewGateCliTest(unittest.TestCase):
    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        _copy_gate(self.root)
        self.gate_module = os.path.join(
            self.root, ".claude", "hooks", "_lib", "review_guard.py")
        self._git("init", "-b", "main")
        # 게이트 사본을 main 에 커밋한다. 브랜치에서 처음 커밋하면 main 으로 체크아웃할 때
        # 게이트가 작업 트리에서 사라져 "불러오지 못함"(fail-open)으로 통과한다 — 실제로 그랬다.
        self._git("add", "-A")
        self._git("commit", "-m", "base")
        self._git("update-ref", "refs/remotes/origin/main", "HEAD")

    def _git(self, *args):
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        # `-C` + ceiling: 이 픽스처 계열이 실제로 공유 `.git/config` 를 오염시킨 적이 있다
        # (워크트리 다섯 개가 그 config 를 공유해 다른 세션의 fetch 까지 깨졌다). git 이
        # 상위로 저장소를 찾아 올라가지 못하게 막고, cwd 를 명시로 고정한다.
        root = os.path.realpath(self.root)
        env["GIT_CEILING_DIRECTORIES"] = root
        r = subprocess.run(["git", "-C", root, *args], env=env, check=True,
                           capture_output=True, text=True)
        return r.stdout.strip()

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
        return self._git("rev-parse", "HEAD")

    def _run(self, *extra, server=None, env=None):
        """`server` 가 있으면 그 주소와 토큰을 넘긴다. 없으면 NERV 설정 없이 돈다."""
        nerv = {"NERV_SERVER": server.url, "NERV_TOKEN": "ci-token"} if server else {}
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--root", self.root, *extra],
            capture_output=True, text=True, timeout=120,
            env=_clean_env({**nerv, **(env or {})}),
        )

    # -- 2. 관측 · enforce ---------------------------------------------------

    def test_unreviewed_branch_is_reported_but_not_failed_by_default(self):
        self._unreviewed_branch()
        with _harness.FakeNervServer() as server:
            r = self._run(server=server)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertIn("미커버", r.stdout)
        self.assertIn("관측 모드", r.stdout)

    def test_enforce_turns_the_same_verdict_into_a_failure(self):
        """같은 저장소 상태, 플래그만 다르다 — 판정이 아니라 처분만 바뀐다는 것이 요점."""
        self._unreviewed_branch()
        with _harness.FakeNervServer() as server:
            observed, enforced = self._run(server=server), self._run("--enforce", server=server)
        self.assertEqual(observed.returncode, 0)
        self.assertEqual(enforced.returncode, 1)
        self.assertIn("미커버", observed.stdout)
        self.assertIn("미커버", enforced.stdout)

    def test_a_clean_branch_passes_under_enforce_without_asking_nerv(self):
        with _harness.FakeNervServer() as server:
            r = self._run("--enforce", server=server)
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertIn("통과", r.stdout)
        self.assertEqual(server.requests, [])

    def test_a_passed_round_lets_the_branch_through(self):
        """차단이 아니라 **통과**도 고정한다. 통과 경로가 없으면 이 스크립트는 늘 우는
        경고가 되고, 그건 이 저장소가 반복해서 실패로 분류해 온 형태다."""
        head = self._unreviewed_branch()
        item = {"kind": "code", "state": "passed", "round_no": 1, "head_sha": head,
                "findings": []}
        with _harness.FakeNervServer(item) as server:
            r = self._run("--enforce", server=server)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr[-2000:])
        self.assertIn("통과", r.stdout)
        path, auth = server.requests[0]
        self.assertIn("branch=feature", path)
        self.assertEqual(auth, "Bearer ci-token")

    def test_branch_head_and_base_arguments_reach_the_gate(self):
        """CI 는 merge 커밋이 아니라 PR head 를 판정한다 — 인자가 그대로 쓰여야 한다."""
        head = self._unreviewed_branch()
        self._git("checkout", "--detach", "main")
        item = {"kind": "code", "state": "passed", "round_no": 1, "head_sha": head,
                "findings": []}
        with _harness.FakeNervServer(item) as server:
            r = self._run("--enforce", "--branch", "pr-branch", "--head", head,
                          "--base", "origin/main", server=server)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr[-2000:])
        self.assertIn("통과", r.stdout, "fail-open 으로 0 이 나온 것이 아니어야 한다")
        self.assertIn("branch=pr-branch", server.requests[0][0])

    def test_a_non_default_base_is_used(self):
        """적층 PR — 기준이 main 이 아니면 그 기준과의 차이만 본다(`--base` 를 무시하면 main 기준으로 막힌다)."""
        self._git("checkout", "-b", "release")
        self._write("codebase/backend/src/r.ts", "export const r = 1;\n")
        self._git("add", "-A")
        self._git("commit", "-m", "release")
        self._git("update-ref", "refs/remotes/origin/release", "HEAD")
        self._git("checkout", "-b", "pr-branch")
        with _harness.FakeNervServer() as server:
            r = self._run("--enforce", "--branch", "pr-branch", "--head", "HEAD", "--base", "origin/release",
                          server=server)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr[-2000:])
        self.assertIn("변경이 없다", r.stdout)
        self.assertEqual(server.requests, [])

    def test_the_default_root_resolves_to_this_repository(self):
        """`--root` 없이 도는 경로 — CI 가 매번 쓰는 바로 그 경로다.

        형제 테스트가 전부 `--root <tempdir>` 를 넘겨서, 스크립트가 자기 위치로부터 저장소 루트를
        계산하는 두 단계 상위 가정은 한 번도 실행되지 않았다. 그 가정이 깨지면 게이트를 못
        불러와 **fail-open** 하고, CI 는 계속 초록인데 백스톱만 영구히 죽는다. NERV 설정은
        주지 않는다.

        기준을 HEAD 로 준다. PR CI 의 체크아웃은 `origin/main` 도 로컬 `main` 도 없는 detached 위상이라
        기본 기준을 고르면 "기준 브랜치를 찾지 못했다"(fail-open)로 끝나 이 테스트가 그 위상에서만
        RED 가 된다(2026-10-01 리뷰 재현). 기준이 HEAD 면 변경이 없어 늘 "통과" 다.
        """
        r = subprocess.run([sys.executable, str(SCRIPT), "--branch", "x", "--head", "HEAD", "--base", "HEAD"],
                           capture_output=True, text=True, timeout=120,
                           cwd=str(_harness.REPO_ROOT), env=_clean_env())
        self.assertEqual(r.returncode, 0, r.stderr[-2000:])
        self.assertNotIn("불러오지 못했습니다", r.stdout + r.stderr,
                         "기본 루트 산정이 깨져 백스톱이 조용히 무력화됐다")
        self.assertNotIn("::warning::", r.stdout, f"판정을 내지 못했다: {r.stdout!r}")
        self.assertIn("통과", r.stdout, f"판정을 내지 못했다: {r.stdout!r} {r.stderr[-500:]!r}")

    # -- 3. 판정 불가 ---------------------------------------------------------

    def test_missing_configuration_fails_only_under_enforce(self):
        """secret 이 빠진 백스톱은 모든 PR 을 그냥 통과시킨다. 그 상태는 실패로 알린다."""
        self._unreviewed_branch()
        observed, enforced = self._run(), self._run("--enforce")
        self.assertEqual(observed.returncode, 0)
        self.assertEqual(enforced.returncode, 1, enforced.stdout)
        self.assertIn("설정 문제", enforced.stdout)
        self.assertIn("NERV_CI_TOKEN", enforced.stdout)

    def test_a_rejected_token_is_misconfiguration(self):
        self._unreviewed_branch()
        with _harness.FakeNervServer(status=401, raw=b"{}") as server:
            r = self._run("--enforce", server=server)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("설정 문제", r.stdout)

    def test_an_unreachable_server_fails_open(self):
        self._unreviewed_branch()
        with _harness.FakeNervServer() as server:
            pass  # 닫힌 포트 — 연결이 거부된다
        r = self._run("--enforce", server=server)
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("::warning::review-gate: 판정하지 못했습니다", r.stdout)

    def test_a_server_error_fails_open(self):
        self._unreviewed_branch()
        with _harness.FakeNervServer(status=503, raw=b"busy") as server:
            r = self._run("--enforce", server=server)
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("::warning::review-gate: 판정하지 못했습니다", r.stdout)

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
                    "class GateMisconfigured(Exception):\n"
                    "    pass\n"
                    "def evaluate_review(cwd=None, **_kw):\n"
                    "    raise RuntimeError('boom')\n")
        r = self._run("--enforce")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("::warning::review-gate: 판정하지 못했습니다", r.stdout)

    # -- 4. advisory 는 판정과 무관 -------------------------------------------

    def test_notes_are_printed_on_both_verdicts(self):
        """차단이든 통과든 나와야 한다."""
        self._unreviewed_branch()
        stub = (
            "from dataclasses import dataclass\n"
            "import os\n"
            "class GateMisconfigured(Exception):\n"
            "    pass\n"
            "@dataclass\n"
            "class _D:\n"
            "    blocked: bool\n"
            "    reason: str = 'stub'\n"
            "    @property\n"
            "    def push_blocks(self):\n"
            "        return self.blocked\n"
            "    @property\n"
            "    def notes(self):\n"
            "        return ('참고: 발견 99건 중 일부만',)\n"
            "def evaluate_review(cwd=None, **_kw):\n"
            "    return _D(os.environ['FAKE_BLOCKED'] == '1')\n"
        )
        with open(self.gate_module, "w", encoding="utf-8") as f:
            f.write(stub)
        for blocked in ("1", "0"):
            with self.subTest(blocked=blocked):
                r = self._run(env={"FAKE_BLOCKED": blocked})
                self.assertEqual(r.returncode, 0)
                self.assertIn("발견 99건", r.stdout)

    # -- 5. 산출물 파일은 근거가 아니다 ---------------------------------------

    def test_a_committed_summary_and_resolution_do_not_open_the_gate(self):
        """옛 게이트는 PR 에 커밋한 몇 줄짜리 SUMMARY.md · RESOLUTION.md 로 통과했다
        (`legacy-triage` 라운드 1 warning). 지금은 NERV 라운드만 본다."""
        self._unreviewed_branch()
        session = "review/code/2099/01/01/00_00_00"
        self._write(f"{session}/SUMMARY.md", "## 전체 위험도\n\nNONE\n")
        self._write(f"{session}/RESOLUTION.md", "처분 완료\n")
        self._git("add", "-A")
        self._git("commit", "-m", "forged review")
        with _harness.FakeNervServer() as server:
            r = self._run("--enforce", server=server)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("미커버", r.stdout)

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


GATE_RUN = ('python3 scripts/check-review-gate.py --enforce --branch "$HEAD_REF" '
            '--head "$HEAD_SHA" --base "origin/$BASE_REF"')


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
                    ".claude/tools/nerv-mirror/pull.py",
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
                    {"uses": "actions/checkout@v7",
                     "with": {"fetch-depth": 0,
                              "ref": "${{ github.event.pull_request.head.sha }}"}},
                    {"uses": "actions/setup-python@v7",
                     "with": {"python-version": "3.x"}},
                    {"name": "Fetch base ref",
                     "env": {"BASE_REF": "${{ github.base_ref }}"},
                     "run": 'git fetch --no-tags origin "$BASE_REF"'},
                    {"name": "Review coverage backstop",
                     "env": {"NERV_SERVER": "${{ vars.NERV_SERVER }}",
                             "NERV_TOKEN": "${{ secrets.NERV_CI_TOKEN }}",
                             "HEAD_REF": "${{ github.head_ref }}",
                             "HEAD_SHA": "${{ github.event.pull_request.head.sha }}",
                             "BASE_REF": "${{ github.base_ref }}"},
                     "run": GATE_RUN},
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
        self.assertEqual(gate[0]["run"], GATE_RUN)
        # 판정 근거가 NERV 라운드다. 토큰이 secret 에서 오고 PR head 를 판정해야 한다.
        self.assertEqual(gate[0]["env"]["NERV_TOKEN"], "${{ secrets.NERV_CI_TOKEN }}")
        self.assertIn("--head", gate[0]["run"])
        self.assertIn("--branch", gate[0]["run"])

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
        self.assertEqual(checkout[0]["with"]["ref"], "${{ github.event.pull_request.head.sha }}",
                         "merge 커밋을 판정하면 라운드 이후 커밋에 기준 브랜치 커밋이 섞인다")
        self.assertLess(steps.index(checkout[0]), steps.index(gate[0]))

        # 2026-08-07 관측 모드 → enforce. 종전 단언은 `assertNotIn` 이었다("켤 때는 이
        # 단언도 함께 바꾼다"). 방향을 뒤집어 **꺼지는 쪽**을 막는다 — 켜 둔 게이트가
        # 조용히 관측 모드로 되돌아가면 아무도 눈치채지 못하고, 그게 이 층이 12라운드에
        # 걸쳐 막아 온 실패 형태 그 자체다.
        self.assertIn("--enforce", gate[0]["run"],
                      "enforce 계약 — 관측 모드로 되돌리려면 이 단언부터 바꿔야 한다")


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
                "class GateMisconfigured(Exception):\n"
                "    pass\n"
                "class _D:\n"
                "    push_blocks = False\n"
                "    notes = ()\n"
                "    reason = 'stub'\n"
                "    blocked = os.environ['STUB_BLOCKED'] == '1'\n"
                "def evaluate_review(cwd=None, **_kw):\n"
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

    금지가 아니라 **등재제**다 — 게이트의 정당한 환경 사용은 NERV 접속 정보뿐이다
    (`NERV_SERVER` · `NERV_TOKEN` · `NERV_PROJECT`, 단계 2 부터). 로컬은 settings 의 env, CI 는
    워크플로 secret 이 같은 이름으로 채우므로 "CI 에서만 다른 값" 이 아니다. 새 환경 접근이
    생기면 여기서 마주치고, 등재하는 순간이 "이게 CI 에서만 다르게 굴게 만드는가" 를 판단할 자리다.
    """

    # (파일, 읽는 환경변수) — 이 목록 밖의 접근은 실패한다.
    _ALLOWED = {
        # 게이트가 전송과 환경 해석을 위임하는 클라이언트 모듈. 게이트는 `_shared/nerv_read.py` 를
        # 거쳐 `load_env` 를 부른다(미러 도구 CLI · 리뷰 인계 도구와 같은 함수).
        ("pull.py", "NERV_SERVER"),
        ("pull.py", "NERV_TOKEN"),
        ("pull.py", "NERV_PROJECT"),
    }
    # `hooks/_lib` 의 `*_guard.py`(plan 게이트 `plan_guard.py` 는 전환 단계 3 에서 `plan/` 과 함께 걷었다)
    # + 게이트가 **위임하는** `_shared` 전부. 9R 리뷰어가 `report_paths.py`/
    # `block_integrity.py` 에 `GITHUB_JOB == "gate"` 분기를 심어 127개 테스트가 전부 통과하는
    # 것을 실증했다 — 실제 판정(Gate1 커버리지, Gate2 하향 감지)이 그 두 함수로 내려가는데
    # 스캔 대상에 없었다. 목록을 손으로 유지하지 않고 디렉터리에서 도출한다.
    _SCANNED_LIB = tuple(sorted(
        p.name for p in (_harness.HOOKS_DIR / "_lib").glob("*_guard.py")))

    def test_no_unregistered_environment_reads_in_the_gate(self):
        seen = set()
        self.assertIn("review_guard.py", self._SCANNED_LIB, "the gate module was not found")
        targets = [_harness.HOOKS_DIR / "_lib" / n for n in self._SCANNED_LIB]
        targets += sorted((_harness.CLAUDE_DIR / "_shared").glob("*.py"))
        targets.append(_harness.CLAUDE_DIR / "tools" / "nerv-mirror" / "pull.py")
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
        _copy_gate(self.root)
        self._git("init", "-b", "main")
        self._git("commit", "--allow-empty", "-m", "base")
        self._git("update-ref", "refs/remotes/origin/main", "HEAD")
        self._git("checkout", "-b", "feature")
        self.server = _harness.FakeNervServer().__enter__()
        self.addCleanup(self.server.__exit__, None, None, None)
        self._write("codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git("add", "-A")
        self._git("commit", "-m", "feat")

    def _git(self, *args):
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        # `-C` + ceiling: 이 픽스처 계열이 실제로 공유 `.git/config` 를 오염시킨 적이 있다
        # (워크트리 다섯 개가 그 config 를 공유해 다른 세션의 fetch 까지 깨졌다). git 이
        # 상위로 저장소를 찾아 올라가지 못하게 막고, cwd 를 명시로 고정한다.
        root = os.path.realpath(self.root)
        env["GIT_CEILING_DIRECTORIES"] = root
        subprocess.run(["git", "-C", root, *args], env=env, check=True,
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
               "LANG": "C.UTF-8", "NERV_SERVER": self.server.url, "NERV_TOKEN": "t",
               **extra_env}
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


class ReviewArtifactsStayLocalTest(unittest.TestCase):
    """단계 2 부터 오케스트레이터 산출물은 `.review/` 에 쓰고 커밋하지 않는다.

    전에는 정반대 성질을 지켰다 — CI 가 커밋된 `review/**` 위에서만 판정할 수 있었으므로 산출물이
    추적되지 않으면 백스톱이 아무 리뷰도 못 봤다. 지금 판정 근거는 NERV 라운드이고, 산출물을
    커밋하면 저장소만 무거워진다(`review/` 는 23,492 파일까지 쌓였다). 옛 `review/` 는 단계 3 에서
    지웠다.
    """

    def test_local_review_artifacts_are_ignored(self):
        import subprocess as _sp
        for rel in (".review/code/2099/01/01/00_00_00/SUMMARY.md",
                    ".review/consistency/2099/01/01/00_00_00/cross_spec.md",
                    ".review/merge/2099/01/01/00_00_00/meta.json",
                    ".review/spec-coverage/2099/01/01/00_00_00/SUMMARY.md"):
            with self.subTest(path=rel):
                r = _sp.run(["git", "check-ignore", "-q", rel],
                            cwd=str(_harness.REPO_ROOT),
                            capture_output=True, text=True, timeout=60)
                self.assertEqual(r.returncode, 0, f"{rel} 가 무시되지 않는다 — 커밋에 섞인다")

    def test_every_orchestrator_writes_under_the_ignored_root(self):
        """기본 출력 경로가 `.review/` 아래여야 한다. 하나라도 `review/` 에 쓰면 편집 가드
        (`guard_nerv_owned_paths.py`)가 서브에이전트의 리포트 쓰기를 막는다."""
        sources = {
            "code-review-agents/scripts/code_review_orchestrator.py": '"./.review/code"',
            "consistency-checker/scripts/consistency_orchestrator.py": '"./.review/consistency"',
            "merge-coordinator/scripts/merge_coordinator_orchestrator.py": '"./.review/merge"',
            "spec-coverage/scripts/spec_coverage_orchestrator.py": 'root / ".review" / "spec-coverage"',
        }
        for rel, needle in sources.items():
            with self.subTest(file=rel):
                text = (_harness.CLAUDE_DIR / "skills" / rel).read_text(encoding="utf-8")
                self.assertIn(needle, text)

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
