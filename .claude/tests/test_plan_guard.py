"""Unit tests for the plan-coverage guard decision logic.

`plan_guard.evaluate_plan()` composes git-backed helpers plus two filesystem
readers (`_linked_plans`, `_all_checkboxes_done`); the decision-table tests patch
the git/discovery helpers (not git / the filesystem) so they stay hermetic and
assert the documented table:
  - block (untouched) only on (codebase changes) ∧ (≥1 linked in-progress plan)
    ∧ (NONE of those plans updated-in-place or moved to plan/complete/);
  - nudge (complete_but_in_progress) only when a linked plan is all-checked.
The path/parse helpers (`_normalize_worktree_value`, `_frontmatter_worktree`,
`_linked_plans`, `_plan_handled`, `_all_checkboxes_done`) get direct tests.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

import _harness  # noqa: F401  — side effect: puts .claude/hooks on sys.path
from _lib import plan_guard as pg


class EvaluatePlanDecisionTableTest(unittest.TestCase):
    def _evaluate(self, *, code_changes, linked_plans, plan_changes, all_done):
        def _branch_changes(_cwd, _base, prefix):
            return code_changes if prefix == pg.CODE_PREFIX else plan_changes

        with mock.patch.object(pg, "_repo_root", return_value="/r"), \
             mock.patch.object(pg, "_default_branch", return_value="main"), \
             mock.patch.object(pg, "_merge_base", return_value="abc123"), \
             mock.patch.object(pg, "_branch_changes", side_effect=_branch_changes), \
             mock.patch.object(pg, "_linked_plans", return_value=linked_plans), \
             mock.patch.object(pg, "_all_checkboxes_done", return_value=all_done):
            return pg.evaluate_plan("/fake/cwd")

    def test_no_codebase_changes_is_inert(self):
        d = self._evaluate(
            code_changes=[], linked_plans=["plan/in-progress/x.md"],
            plan_changes=[], all_done=False,
        )
        self.assertFalse(d.untouched)
        self.assertFalse(d.complete_but_in_progress)

    def test_no_linked_plan_is_inert(self):
        # codebase changed but no plan is linked → ad-hoc work, never blocked.
        d = self._evaluate(
            code_changes=["codebase/a.ts"], linked_plans=[],
            plan_changes=[], all_done=False,
        )
        self.assertFalse(d.untouched)

    def test_blocks_when_linked_plan_untouched(self):
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=[],          # plan not in the branch diff
            all_done=False,
        )
        self.assertTrue(d.untouched)
        self.assertEqual(d.plan_path, "plan/in-progress/x.md")
        self.assertIn("plan/in-progress/x.md", d.reason)

    def test_allows_when_linked_plan_updated_in_place(self):
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=["plan/in-progress/x.md"],  # exact path → updated
            all_done=False,
        )
        self.assertFalse(d.untouched)

    def test_allows_when_linked_plan_moved_to_complete(self):
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=["plan/complete/x.md"],  # moved to complete → satisfied
            all_done=True,
        )
        self.assertFalse(d.untouched)

    def test_unrelated_plan_change_does_not_satisfy(self):
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=["plan/in-progress/other.md"],  # a *different* plan
            all_done=False,
        )
        self.assertTrue(d.untouched)

    def test_same_basename_in_archive_does_not_satisfy(self):
        # A same-named file under plan/complete/archive/ is NOT a completion of
        # this plan — the old bare-basename match would have wrongly passed.
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=["plan/complete/archive/from-y/x.md"],
            all_done=False,
        )
        self.assertTrue(d.untouched)

    def test_multi_plan_any_one_touched_satisfies(self):
        # One worktree carrying several plans: updating ANY one passes the gate.
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/a.md", "plan/in-progress/b.md"],
            plan_changes=["plan/in-progress/b.md"],
            all_done=False,
        )
        self.assertFalse(d.untouched)

    def test_multi_plan_none_touched_blocks(self):
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/a.md", "plan/in-progress/b.md"],
            plan_changes=[],
            all_done=False,
        )
        self.assertTrue(d.untouched)
        self.assertIn("2개 중", d.reason)  # multi-plan hint in the message

    def test_complete_flag_set_when_all_checkboxes_done(self):
        # Even when blocked, the soft completion signal is surfaced.
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=[],
            all_done=True,
        )
        self.assertTrue(d.untouched)
        self.assertTrue(d.complete_but_in_progress)

    def test_complete_nudge_when_touched_and_done(self):
        d = self._evaluate(
            code_changes=["codebase/a.ts"],
            linked_plans=["plan/in-progress/x.md"],
            plan_changes=["plan/in-progress/x.md"],
            all_done=True,
        )
        self.assertFalse(d.untouched)
        self.assertTrue(d.complete_but_in_progress)

    def test_outside_git_repo_is_inert(self):
        with mock.patch.object(pg, "_repo_root", return_value=None):
            d = pg.evaluate_plan("/fake/cwd")
        self.assertFalse(d.untouched)
        self.assertFalse(d.complete_but_in_progress)


class PlanHandledTest(unittest.TestCase):
    def test_exact_path_update(self):
        self.assertTrue(pg._plan_handled("plan/in-progress/x.md", ["plan/in-progress/x.md"]))

    def test_move_to_complete(self):
        self.assertTrue(pg._plan_handled("plan/in-progress/x.md", ["plan/complete/x.md"]))
        self.assertTrue(pg._plan_handled("plan/in-progress/x.md", ["plan/complete/grp/x.md"]))

    def test_archive_excluded(self):
        self.assertFalse(
            pg._plan_handled("plan/in-progress/x.md", ["plan/complete/archive/from-y/x.md"])
        )

    def test_unrelated_basename_excluded(self):
        self.assertFalse(pg._plan_handled("plan/in-progress/x.md", ["plan/in-progress/y.md"]))
        self.assertFalse(pg._plan_handled("plan/in-progress/x.md", []))


class NormalizeWorktreeValueTest(unittest.TestCase):
    def test_bare_name(self):
        self.assertEqual(
            pg._normalize_worktree_value("fix-bg-context-followups"),
            "fix-bg-context-followups",
        )

    def test_name_with_slug(self):
        self.assertEqual(
            pg._normalize_worktree_value("agent-memory-model-select-83e703"),
            "agent-memory-model-select-83e703",
        )

    def test_path_with_branch_annotation(self):
        self.assertEqual(
            pg._normalize_worktree_value(
                ".claude/worktrees/audit-coverage-naming (branch claude/auth-config-audit)"
            ),
            "audit-coverage-naming",
        )

    def test_placeholder_is_none(self):
        for v in ("(unstarted)", "unstarted", "", "   ", "-", "TBD", "none"):
            self.assertIsNone(pg._normalize_worktree_value(v), v)


class FilesystemHelpersTest(unittest.TestCase):
    """`_frontmatter_worktree`, `_linked_plans`, `_all_checkboxes_done` over real files."""

    def _make_plan(self, root, name, *, worktree, body=""):
        d = os.path.join(root, "plan", "in-progress")
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name)
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"---\nworktree: {worktree}\nstatus: in-progress\n---\n{body}")
        return path

    def test_frontmatter_worktree_extracted(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = self._make_plan(tmp, "x.md", worktree="foo-123")
            self.assertEqual(pg._frontmatter_worktree(p), "foo-123")

    def test_frontmatter_no_frontmatter(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = os.path.join(tmp, "x.md")
            with open(p, "w") as f:
                f.write("no frontmatter here\n")
            self.assertIsNone(pg._frontmatter_worktree(p))

    def test_linked_plans_matches_branch_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._make_plan(tmp, "linked.md", worktree="my-task-abc")
            self._make_plan(tmp, "other.md", worktree="(unstarted)")
            with mock.patch.object(pg, "_current_branch", return_value="claude/my-task-abc"):
                rels = pg._linked_plans(tmp, "/cwd")
            self.assertEqual(rels, ["plan/in-progress/linked.md"])

    def test_linked_plans_returns_all_matches(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._make_plan(tmp, "a.md", worktree="shared-wt")
            self._make_plan(tmp, "b.md", worktree="shared-wt")
            with mock.patch.object(pg, "_current_branch", return_value="claude/shared-wt"):
                rels = pg._linked_plans(tmp, "/cwd")
            self.assertEqual(
                rels, ["plan/in-progress/a.md", "plan/in-progress/b.md"]
            )

    def test_linked_plans_empty_when_no_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._make_plan(tmp, "x.md", worktree="(unstarted)")
            with mock.patch.object(pg, "_current_branch", return_value="claude/nomatch-xyz"):
                self.assertEqual(pg._linked_plans(tmp, "/cwd"), [])

    def test_all_checkboxes_done_true(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = self._make_plan(
                tmp, "x.md", worktree="t",
                body="## tasks\n- [x] a\n- [X] b\n",
            )
            self.assertTrue(pg._all_checkboxes_done(tmp, os.path.relpath(p, tmp)))

    def test_all_checkboxes_done_false_with_open(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = self._make_plan(
                tmp, "x.md", worktree="t",
                body="## tasks\n- [x] a\n- [ ] b\n",
            )
            self.assertFalse(pg._all_checkboxes_done(tmp, os.path.relpath(p, tmp)))

    def test_all_checkboxes_done_false_when_none(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = self._make_plan(tmp, "x.md", worktree="t", body="no checkboxes\n")
            self.assertFalse(pg._all_checkboxes_done(tmp, os.path.relpath(p, tmp)))


class PorcelainPathSurvivesOnARealRepoTest(unittest.TestCase):
    """git 파싱 헬퍼를 **실제 저장소**로 구동한다.

    이 파일의 나머지는 `_branch_changes` 를 통째로 `mock.patch.object` 로 스텁하고 결정
    테이블만 본다. 그래서 `_run_git`/`_porcelain_path`/`_uncommitted_changes` 는 스위트 전체에서
    **한 번도 실행되지 않았고**, 그 사이에 실제 결함이 살아 있었다:

    `_run_git` 이 stdout 전체에 `.strip()` 을 걸었는데, plan 파일을 고치고 스테이지하지 않은
    상태 — 이 프로젝트에서 가장 흔한 형태 — 는 `" M plan/…"` 로 **선행 공백**이다. 그것이
    지워지면서 고정폭 파싱이 `"lan/in-progress/…"` 를 돌려줬고, plan 이 아무것과도 매칭되지
    않아 **갱신했는데도 "미갱신" 으로 push 가 차단**됐다. 이 모듈 docstring 이 "파싱 실패는
    항상 not blocked" 라고 약속하는데 정확히 그 반대였다.

    7R 이 자매 훅 `review_guard.py` 에서 같은 결함을 고쳤지만 여기로 오지 않았다 — 이 저장소가
    `report_paths`·`retry_state`·doc-sync 매트릭스에서 이미 기록해 온 손-동기 쌍 drift 다.
    그리고 그때 얻은 교훈("헬퍼가 아니라 실제 저장소로 구동하라")도 함께 전파되지 않았다.
    """

    def setUp(self):
        self.root = os.path.realpath(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self._git("init", "-b", "main")
        self._write("plan/in-progress/x.md", "---\nworktree: w\n---\n- [ ] a\n")
        self._git("add", "-A")
        self._git("commit", "-m", "base")

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

    def test_an_unstaged_plan_edit_keeps_its_full_path(self):
        """`" M plan/…"` — 선행 공백이 있는 형태이자 이 프로젝트의 기본 흐름."""
        self._write("plan/in-progress/x.md", "---\nworktree: w\n---\n- [x] a\n")
        changed = pg._uncommitted_changes(self.root, "plan/")
        self.assertIn("plan/in-progress/x.md", changed,
                      f"경로가 깎였다: {changed}")

    def test_a_staged_plan_edit_still_works(self):
        """`"M  plan/…"` — 선행 공백이 없다. 원래 맞았고, 수정이 깨지 않았는지 함께 본다."""
        self._write("plan/in-progress/x.md", "---\nworktree: w\n---\n- [x] a\n")
        self._git("add", "-A")
        self.assertIn("plan/in-progress/x.md",
                      pg._uncommitted_changes(self.root, "plan/"))

    def test_a_non_ascii_plan_path_survives_git_quoting(self):
        """git 은 비-ASCII 경로를 기본으로 C-quote 한다 — `review_guard` 와 같은 처방을
        여기에도 걸어 자매 훅이 다시 갈리지 않게 한다."""
        rel = "plan/in-progress/한글계획.md"
        self._write(rel, "---\nworktree: w\n---\n- [ ] a\n")
        self.assertIn(rel, pg._uncommitted_changes(self.root, "plan/"))


class GitProbesAreNotReDuplicatedTest(unittest.TestCase):
    """세 훅이 git 프로브를 **다시 손으로 복제하지 않는다** — 목록을 도출해서 본다.

    `review_guard`·`plan_guard`·`branch_guard` 는 같은 git 헬퍼를 각자 복사해 갖고 있었고,
    그 쌍이 세 라운드 연속 갈렸다: 7R 이 `_run_git` 의 `.strip()` 을 한쪽에서 고쳤고, 8R 이
    두 번째 사본에서 같은 줄을 찾았고(이번엔 fail-open 이 아니라 **거짓 차단**), 9R 이 세 번째를
    찾았다. 세 suite 모두 그 헬퍼들을 mock 으로 우회해 **한 번도 실행하지 않았기** 때문에
    아무도 못 잡았다.

    9R 이 다섯 개를 `_shared/git_probe.py` 로 옮겼는데, **10R 이 여섯 번째(`_current_branch`)를
    찾아냈다** — 통합도, 그것을 지키는 이 가드도 손으로 쓴 목록으로 돌아갔기 때문이다. 목록은
    빠뜨릴 수 있고 실제로 빠뜨렸다.

    그래서 이제 목록을 쓰지 않는다: 세 모듈의 AST 를 서로 비교해 **본문이 동일한 함수가 남아
    있으면 그 자체로 실패**시킨다. 무엇이 복제됐는지 사람이 미리 알 필요가 없다.
    """

    _MODULES = ("review_guard.py", "plan_guard.py", "branch_guard.py")

    @staticmethod
    def _bodies(src):
        import ast as _ast
        out = {}
        for n in _ast.walk(_ast.parse(src)):
            if isinstance(n, _ast.FunctionDef):
                body = [x for x in n.body
                        if not (isinstance(x, _ast.Expr)
                                and isinstance(x.value, _ast.Constant))]
                out[n.name] = _ast.dump(_ast.Module(body=body, type_ignores=[]))
        return out

    def test_no_identical_function_survives_in_two_guards(self):
        """도출된 불변식 — 어떤 함수 이름도 미리 적어두지 않는다."""
        import itertools
        srcs = {m: (_harness.HOOKS_DIR / "_lib" / m).read_text(encoding="utf-8")
                for m in self._MODULES}
        bodies = {m: self._bodies(s) for m, s in srcs.items()}
        dupes = []
        for a, b in itertools.combinations(self._MODULES, 2):
            for name in sorted(set(bodies[a]) & set(bodies[b])):
                if bodies[a][name] == bodies[b][name]:
                    dupes.append(f"{name} ({a} == {b})")
        self.assertEqual(
            dupes, [],
            "본문이 동일한 함수가 두 훅에 남아 있다 — `_shared/git_probe.py` 로 옮기고 "
            f"양쪽을 위임으로 바꿀 것: {dupes}",
        )

    def test_the_shared_probes_are_the_same_objects_everywhere(self):
        """도출로 잡히지 않는 반대 방향 — `_x = _git_probe._x` 뒤에 재정의가 오면 본문이
        서로 달라져 위 테스트는 통과한다. 실제로 같은 객체인지도 본다."""
        import sys as _sys
        from _lib import review_guard as rg  # noqa: PLC0415
        from _lib import branch_guard as bg  # noqa: PLC0415
        claude_dir = str(_harness.CLAUDE_DIR)
        if claude_dir not in _sys.path:
            _sys.path.insert(0, claude_dir)
        from _shared import git_probe as gp  # noqa: PLC0415

        exported = [n for n in dir(gp) if n.startswith("_") and callable(getattr(gp, n))
                    and not n.startswith("__")]
        self.assertGreaterEqual(len(exported), 6, f"공유 프로브가 너무 적다: {exported}")
        for mod, obj in (("review_guard", rg), ("plan_guard", pg), ("branch_guard", bg)):
            for name in exported:
                if not hasattr(obj, name):
                    continue  # 그 훅이 안 쓰는 프로브는 위임할 이유가 없다
                with self.subTest(module=mod, fn=name):
                    self.assertIs(
                        getattr(obj, name), getattr(gp, name),
                        f"{mod}.{name} 이 공유 구현이 아니다 — 로컬 재정의가 부활했다",
                    )


if __name__ == "__main__":
    unittest.main()
