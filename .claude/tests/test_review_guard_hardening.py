"""리뷰 게이트 주변의 경화 테스트 — NERV 전환 단계 2 뒤에도 남는 것.

단계 2(NERV Task `CLE-T-4ABTG7`)에서 게이트가 `review/**` 파일 대신 NERV 라운드를 읽게 되며
파일 판정의 경화(세션 시각 · author date 시계 · 진행 중 리뷰 · resolution 마커 · 위험도 파싱)는
대상과 함께 사라졌다. 남는 것:

  - `_porcelain_path`         — rename/copy 파싱. 공유 `git_probe` 로 옮겨 갔다.
  - `actions/checkout` 위상   — CI 체크아웃에서 기본 브랜치를 네트워크 없이 찾고, 리뷰 없는
                                변경을 "변경 없음" 으로 읽지 않는다.
  - 임시 저장소 픽스처 규약   — 모든 테스트의 git 호출이 `-C` 와 ceiling 을 건다.
"""

from __future__ import annotations

import ast
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import review_guard as rg
from _shared import git_probe

TESTS_DIR = pathlib.Path(__file__).resolve().parent


class PorcelainPathTest(unittest.TestCase):
    def test_plain_modified(self):
        self.assertEqual(git_probe._porcelain_path(" M codebase/a.ts"), "codebase/a.ts")

    def test_added(self):
        self.assertEqual(git_probe._porcelain_path("?? codebase/new.ts"), "codebase/new.ts")

    def test_rename_takes_destination(self):
        self.assertEqual(
            git_probe._porcelain_path("R  codebase/old.ts -> codebase/new.ts"),
            "codebase/new.ts",
        )

    def test_copy_takes_destination(self):
        self.assertEqual(
            git_probe._porcelain_path("C  codebase/a.ts -> codebase/b.ts"),
            "codebase/b.ts",
        )

    def test_literal_arrow_in_filename_not_split(self):
        # A non-rename line whose filename legitimately contains "->" must NOT
        # be split — only R/C status codes carry the " -> " separator.
        self.assertEqual(
            git_probe._porcelain_path(" M codebase/a->b.ts"), "codebase/a->b.ts"
        )

    def test_too_short(self):
        self.assertEqual(git_probe._porcelain_path("M"), "")


class ActionsCheckoutTopologyTest(unittest.TestCase):
    """`actions/checkout` 이 만드는 저장소 모양에서 게이트가 실제로 판정한다.

    이 층은 CI 를 위해 만들어졌는데, **정작 CI 환경에서 아무것도 안 하고 있었다.**
    `actions/checkout` 은 `clone` 이 아니라 `init` + `remote add` + `fetch` 로 워크트리를
    만들고 `git remote set-head` 를 부르지 않는다. 그래서:

      · `refs/remotes/origin/HEAD` 가 없다 → `_origin_default_branch` 의 로컬 경로 실패
      · 로컬 `refs/heads/main` 도 없다(PR ref 만 fetch) → 옛 폴백도 빗나감
      · 남는 것은 **네트워크 호출**(`git remote show origin`)뿐이고, 그게 실패하면
        `_default_branch()` 가 None → base 없음 → 커밋 변경 목록이 빈 리스트 →
        **"codebase 변경 없음 — 허용"**

    격리 재현: 위 절차로 저장소를 만들고 origin 을 도달 불가로 둔 뒤, `codebase/` 파일을
    고치고 리뷰는 전혀 없는 상태에서 `--enforce` 가 `통과`(exit 0)를 냈다. 수정 후 같은
    저장소에서 `미커버`(exit 1). 네트워크 없이 `refs/remotes/origin/<name>` 만 보면 된다.
    """

    def setUp(self):
        self.tmp = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.origin = os.path.join(self.tmp, "origin.git")
        self.work = os.path.join(self.tmp, "work")
        self._git(self.tmp, "init", "--bare", "-b", "main", self.origin)
        seed = os.path.join(self.tmp, "seed")
        self._git(self.tmp, "init", "-b", "main", seed)
        self._write(seed, "codebase/backend/src/a.ts", "export const a = 1;\n")
        self._git(seed, "add", "-A")
        self._git(seed, "commit", "-m", "base")
        self._git(seed, "remote", "add", "origin", self.origin)
        self._git(seed, "push", "-q", "origin", "main")

        # `actions/checkout` 위상 — clone 이 아니다.
        os.makedirs(self.work)
        self._git(self.work, "init", "-b", "main", ".")
        self._git(self.work, "remote", "add", "origin", self.origin)
        self._git(self.work, "fetch", "-q", "--no-tags", "origin", "main")
        self._git(self.work, "checkout", "-q", "-b", "feature", "FETCH_HEAD")

    def _git(self, cwd, *args):
        """임시 트리 밖에서는 절대 돌지 않는다.

        이 픽스처가 실제로 **공유 `.git/config` 를 오염시켰다** — `remote add origin` 이
        워크트리 쪽에서 실행돼 `origin` URL 이 임시 경로로 덮였고, 이 저장소의 워크트리 다섯
        개가 같은 config 를 공유하므로 다른 세션의 `git fetch` 까지 함께 깨졌다. 조용히 성공한
        것이 최악이었다 — 다음 `git fetch` 가 실패할 때까지 아무 신호가 없었다.
        
        cwd 가 임시 루트 밖이면 여기서 죽는다. git 이 상위로 저장소를 찾아 올라가는 것도
        `GIT_CEILING_DIRECTORIES` 로 막는다.
        """
        resolved = os.path.realpath(cwd)
        root = os.path.realpath(self.tmp)
        assert resolved == root or resolved.startswith(root + os.sep), (
            f"임시 트리 밖에서 git 을 실행하려 한다: {resolved!r} (루트 {root!r})"
        )
        env = dict(os.environ)
        env["GIT_CONFIG_GLOBAL"] = os.devnull
        env["GIT_CONFIG_SYSTEM"] = os.devnull
        env["GIT_CEILING_DIRECTORIES"] = root
        env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = "t"
        env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = "t@t"
        subprocess.run(["git", "-C", resolved, *args], env=env, check=True,
                       capture_output=True, text=True)

    def _write(self, root, rel, body):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)

    def test_the_topology_really_lacks_both_local_refs(self):
        """전제 자체를 고정한다 — 이게 틀리면 아래 테스트는 아무것도 증명하지 않는다."""
        for ref in ("refs/remotes/origin/HEAD", "refs/heads/main"):
            with self.subTest(ref=ref):
                rc, _, _ = rg._run_git(["rev-parse", "--verify", ref], self.work)
                self.assertNotEqual(rc, 0, f"{ref} 가 있다 — 위상 재현이 틀렸다")
        rc, _, _ = rg._run_git(["rev-parse", "--verify", "refs/remotes/origin/main"],
                               self.work)
        self.assertEqual(rc, 0, "origin/main 조차 없다 — fetch 가 안 됐다")

    def test_the_default_branch_resolves_without_the_network(self):
        self._git(self.work, "remote", "set-url", "origin",
                  "https://invalid.invalid/nonexistent.git")
        self.assertEqual(rg._default_branch(self.work), "main",
                         "네트워크 없이 기본 브랜치를 못 찾는다 — 게이트가 무력화된다")

    def test_the_remote_tracking_ref_outranks_a_local_branch_of_another_name(self):
        """순서가 실제로 의미를 갖는 경우를 고정한다.

        주석이 "`origin/<name>` 을 먼저 보는 것은 그쪽이 DEFAULT 브랜치에 대한 더 강한
        주장이기 때문" 이라고 적었는데, 처음 쓴 테스트로는 순서를 뒤바꿔도 통과했다 — 주장만
        하고 검증하지 않은 상태였다. 로컬에 `main` 이 있고 origin 의 기본이 `master` 인
        저장소(포크에서 흔하다)면 둘이 갈린다.
        """
        # origin 쪽 기본 브랜치를 master 로 만든다.
        self._git(self.origin, "symbolic-ref", "HEAD", "refs/heads/master")
        seed2 = os.path.join(self.tmp, "seed2")
        self._git(self.tmp, "init", "-b", "master", seed2)
        self._write(seed2, "codebase/backend/src/b.ts", "export const b = 1;\n")
        self._git(seed2, "add", "-A")
        self._git(seed2, "commit", "-m", "master base")
        self._git(seed2, "remote", "add", "origin", self.origin)
        self._git(seed2, "push", "-q", "origin", "master")

        w2 = os.path.join(self.tmp, "work2")
        os.makedirs(w2)
        self._git(w2, "init", "-b", "main", ".")     # 로컬 브랜치 이름은 main
        self._git(w2, "remote", "add", "origin", self.origin)
        self._git(w2, "fetch", "-q", "--no-tags", "origin", "master")
        self._write(w2, "x.txt", "x\n")
        self._git(w2, "add", "-A")
        self._git(w2, "commit", "-m", "local main")   # refs/heads/main 이 생긴다
        self._git(w2, "remote", "set-url", "origin",
                  "https://invalid.invalid/nonexistent.git")

        for ref in ("refs/heads/main", "refs/remotes/origin/master"):
            rc, _, _ = rg._run_git(["rev-parse", "--verify", ref], w2)
            self.assertEqual(rc, 0, f"{ref} 가 없다 — 픽스처가 두 후보를 못 만들었다")
        self.assertEqual(
            rg._default_branch(w2), "master",
            "로컬 `main` 이 origin 의 기본 `master` 를 이겼다 — 순서가 뒤집혔다",
        )

    def test_an_unreviewed_change_is_not_reported_as_no_change(self):
        """가장 중요한 단언 — 이 층이 CI 에서 실제로 무언가를 하는가.

        NERV 는 이 브랜치에 라운드가 없다고 답한다(`uncovered`). 기준 브랜치를 못 찾아
        변경 목록이 비면 NERV 에 묻지도 않고 "변경 없음" 으로 통과한다 — 그게 옛 결함이다."""
        self._git(self.work, "remote", "set-url", "origin",
                  "https://invalid.invalid/nonexistent.git")
        self._write(self.work, "codebase/backend/src/a.ts", "export const a = 2;\n")
        self._git(self.work, "add", "-A")
        self._git(self.work, "commit", "-m", "feat")

        class Uncovered:
            project = "clemvion"
            calls = 0

            def get(self, path):
                Uncovered.calls += 1
                return 200, json.dumps({"items": [{"kind": "code", "state": "uncovered"}]}).encode()

        decision = rg.evaluate_review(self.work, client=Uncovered())
        self.assertTrue(
            decision.blocked,
            f"리뷰 없는 codebase 변경이 통과했다 — reason={decision.reason!r}",
        )
        self.assertNotIn("변경이 없다", decision.reason,
                         "변경을 아예 못 봤다 — base 해석 실패가 '변경 없음' 으로 읽혔다")
        self.assertEqual(Uncovered.calls, 1, "NERV 에 묻지 않았다")


class TempRepoFixturesGoThroughTheSharedHelperTest(unittest.TestCase):
    """임시 git 저장소를 만드는 픽스처는 `_harness.git_in` 을 거쳐야 한다.

    2026-08-06 사고: 한 픽스처가 `git remote add origin …` 을 임시 트리 **밖에서**
    실행해 워크트리 5개가 공유하는 `.git/config` 를 덮었다. 다른 세션의 `fetch` 가
    깨졌고 **아무 신호도 없었다**. 개별 픽스처를 손으로 경화하는 것으로는 다음에
    추가되는 픽스처를 막지 못한다 — 그래서 목록이 아니라 **도출**로 강제한다.

    허용되는 형태는 둘뿐이다:
      · `_harness.git_in(...)` — 임시 저장소. 헬퍼가 `-C`·ceiling·임시경로 단언을 건다.
      · `cwd=REPO_ROOT` 로의 직접 호출 — 이 체크아웃 자신의 이력을 읽는 테스트.
        그쪽엔 ceiling 이 무의미하므로 경화 대상이 아니다(아래 레지스트리).
    """

    # 실 저장소를 의도적으로 읽는 호출. 각 항목은 "왜 임시 저장소가 아닌가" 다.
    _REAL_REPO_READERS = {
        "test_dependabot_npm_coverage.py":
            "이 저장소의 추적 파일 목록을 읽어 dependabot 등록 불변식을 검사한다",
        "test_harness_checks_paths_coverage.py":
            "이 저장소의 실제 경로를 harness-checks paths 와 대조한다",
        "test_line_anchors.py":
            "실제 커밋 이력에서 diff/소스를 뽑아 gutter 번호를 검증한다",
        "test_install_gate_flags.py":
            "이 저장소의 추적 파일에서 `pnpm install` 실행 지점을 찾아 등재 목록과 대조한다 "
            "— 임시 저장소로는 '등재 안 된 지점이 생겼다' 를 물을 수 없다",
        "test_workflow_run_inputs_covered.py":
            "워크플로 `run:` 이 이름으로 부르는 파일이 **이 저장소에 실재하는지** 걸러 낸 뒤 "
            "그 워크플로의 pathspecs 와 대조한다 — 임시 저장소에는 그 워크플로도 그 스크립트도 "
            "없으므로 '등재가 빠졌다' 를 물을 대상 자체가 없다",
    }

    def _git_calls(self, tree):
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            f = node.func
            if not (isinstance(f, ast.Attribute) and f.attr == "run"
                    and isinstance(f.value, ast.Name) and f.value.id == "subprocess"):
                continue
            if not node.args:
                continue
            first = node.args[0]
            if isinstance(first, ast.List) and first.elts:
                head = first.elts[0]
                if isinstance(head, ast.Constant) and head.value == "git":
                    yield node

    def test_every_temp_repo_git_call_pins_dir_and_ceiling(self):
        """검사하는 것은 **속성**이지 메커니즘이 아니다.

        처음엔 "`_harness.git_in` 을 쓰는가" 로 짰는데, 이미 손으로 `git -C` + ceiling 을
        건 호출 10곳을 전부 위반으로 잡았다 — **고쳐야 할 것이 아니라 이미 옳은 것들**이다.
        그래서 판정을 두 성질로 바꾼다: 디렉터리가 argv 에 고정됐는가(`-C`), 그리고
        상향 탐색이 막혔는가(`GIT_CEILING_DIRECTORIES`). `git_in` 은 그 둘을 한 곳에
        모아 둔 구현일 뿐이고, 손으로 건 것도 같은 보증이면 통과시킨다.
        """
        offenders = []
        for path in sorted(TESTS_DIR.glob("test_*.py")):
            src = path.read_text(encoding="utf-8")
            lines = src.splitlines()
            tree = ast.parse(src)
            # 각 함수의 소스 범위 — ceiling 설정은 호출과 같은 함수 안에 있다.
            funcs = [(n.lineno, n.end_lineno) for n in ast.walk(tree)
                     if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            for call in self._git_calls(tree):
                cwd = next((k.value for k in call.keywords if k.arg == "cwd"), None)
                names = {n.id for n in ast.walk(cwd) if isinstance(n, ast.Name)} if cwd else set()
                if "REPO_ROOT" in names:
                    self.assertIn(
                        path.name, self._REAL_REPO_READERS,
                        f"{path.name}:{call.lineno} 이 REPO_ROOT 로 git 을 부르는데 "
                        "레지스트리에 없다 — 실 저장소를 읽는 이유를 등재할 것",
                    )
                    continue
                argv = call.args[0].elts
                pinned = any(isinstance(e, ast.Constant) and e.value == "-C" for e in argv)
                enclosing = [f for f in funcs if f[0] <= call.lineno <= f[1]]
                start, end = (min(f[0] for f in enclosing), max(f[1] for f in enclosing)) \
                    if enclosing else (call.lineno, call.lineno)
                ceiled = "GIT_CEILING_DIRECTORIES" in "\n".join(lines[start - 1:end])
                if not (pinned and ceiled):
                    offenders.append(
                        f"{path.name}:{call.lineno} "
                        f"(-C={'있음' if pinned else '없음'}, ceiling={'있음' if ceiled else '없음'})")
        self.assertEqual(
            offenders, [],
            "임시 저장소에 대한 git 호출은 디렉터리를 argv 에 고정(`-C`)하고 상향 탐색을 "
            "막아야(`GIT_CEILING_DIRECTORIES`) 한다. `_harness.git_in()` 이 둘을 함께 건다.\n  "
            + "\n  ".join(offenders),
        )

    def test_the_registry_has_no_dead_entries(self):
        # 레지스트리가 낡으면 "등재됐으니 괜찮다" 가 거짓이 된다.
        for name in self._REAL_REPO_READERS:
            self.assertTrue((TESTS_DIR / name).is_file(),
                            f"레지스트리의 {name} 이 존재하지 않는다")

    def test_the_former_ast_blind_spot_stays_closed(self):
        """AST 는 **문자열 안**의 픽스처를 보지 못한다 — 그 사각이 실제로 있었다.

        `test_consistency_context_budget.py` 는 fresh-interpreter 스니펫(문자열) 안에서
        임시 저장소를 만들었다. 위 도출 검사는 문자열을 호출로 파싱하지 않으므로 그
        raw `subprocess.run(["git", …])` 를 **조용히 통과시켰다**.

        §14 에서 preamble 을 공유로 추출하며 닫혔다 — 공유 preamble 이 `_harness` 를
        서브프로세스 경로에 실어 보내므로 스니펫도 `git_in` 을 쓸 수 있다. 사각이
        닫혔다는 사실 자체를 여기 고정한다: 문자열 안에 raw git 호출이 **다시 생기면**
        AST 가드는 여전히 못 보므로, 이 텍스트 검사가 유일한 방어다.
        """
        # 주석·docstring 안의 등장은 코드가 아니다. 이 가드 자신이 그 텍스트를 docstring
        # 과 탐지 코드에 담고 있어, 걸러내지 않으면 **자기 자신을 위반으로 잡는다**(실제로
        # 그랬다). `_harness.py` 는 헬퍼의 유일한 구현이라 별도로 허용한다.
        allowed_impl = {"_harness.py"}
        for path in sorted(TESTS_DIR.glob("*.py")):
            if path.name in allowed_impl:
                continue
            src = path.read_text(encoding="utf-8")
            tree = ast.parse(src)
            call_lines = {c.lineno for c in self._git_calls(tree)}
            doc_lines: set[int] = set()
            for node in ast.walk(tree):
                if (isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant)
                        and isinstance(node.value.value, str)):
                    doc_lines.update(range(node.lineno, node.end_lineno + 1))
            for n, line in enumerate(src.splitlines(), start=1):
                if 'subprocess.run(["git"' not in line:
                    continue
                if n in call_lines or n in doc_lines:
                    continue
                if line.lstrip().startswith("#") or "'subprocess.run" in line:
                    continue
                self.fail(
                    f"{path.name}:{n} 문자열 안에 raw git 호출이 있다. AST 가드가 보지 "
                    "못하는 자리다 — `_harness.git_in()` 을 쓸 것 (공유 preamble 이 "
                    "`_harness` 를 서브프로세스에 실어 보낸다)."
                )


if __name__ == "__main__":
    unittest.main()
