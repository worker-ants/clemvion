"""`--prepare` must produce exactly one session — a split batch reads as a clean review.

`--prepare` used to slice the changeset into `REVIEW_BATCH_SIZE` chunks and print
one session path per chunk. The loop and the contract line "stdout 마지막 줄(들) =
세션 디렉토리 (batch 별로 한 줄씩)" were introduced in the same commit, so the caller
was meant to fan out over *every* line. A later doc-compression commit
(`73dea0864`) dropped the "(들)" and the per-batch parenthetical while keeping the
env var, leaving `SKILL.md` saying "stdout 마지막 줄" — singular.

From then on every batch but the last was written to disk and never reviewed.

The silence is not merely a coverage hole; it **inverts the safety gate**.
`compute_forced_agents` derives the forced whitelist *from the changeset it is
given*, so a tail batch that happens to be docs-only forces far fewer reviewers.
`_verify_coverage` then checks that shrunken set and passes trivially — a dropped
batch reads as a clean review.

`ForcedSetShrinksWithTheChangesetTest` pins the amplification itself (the reason
a split is unsafe, independent of how many lines `--prepare` prints), so the two
halves of the defect cannot regress separately.

Fresh-interpreter convention as in `test_review_changeset_warning`: importing the
orchestrator in-process collides on the name `_lib`. Standalone runs pass and
`discover` fails, so this must not be "fixed" by running the file on its own.
"""

from __future__ import annotations

import os
import unittest

import _harness

REPO_ROOT = _harness.REPO_ROOT
ORCH = (
    REPO_ROOT / ".claude" / "skills" / "code-review-agents" / "scripts"
    / "code_review_orchestrator.py"
)

_PREAMBLE = _harness.orchestrator_preamble(ORCH, imports="contextlib, io")


def run_in_orchestrator(snippet: str, arg=None):
    return _harness.run_in_orchestrator(_PREAMBLE, snippet, arg)


def _infos(n, prefix="codebase/backend/src/mod", ext=".ts"):
    return [{"file_path": f"{prefix}{i}{ext}", "content": "x"} for i in range(n)]


class PrepareEmitsExactlyOneSessionTest(unittest.TestCase):
    """stdout must carry one session path no matter how large the changeset is."""

    def _stdout_lines(self, n_files, batch_size):
        out = run_in_orchestrator(
            """
            orch.load_config = lambda route_mode=None: dict(ARG["config"])
            orch.collect_change_infos = lambda a, c: ARG["infos"]
            seen = []
            def fake_prepare(infos, config):
                seen.append(len(infos))
                return "/tmp/session-%d" % len(seen)
            orch.prepare_session = fake_prepare
            sys.argv = ["orch", "--prepare"]
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
                try:
                    orch.main()
                except SystemExit:
                    pass
            emit({"stdout": buf.getvalue(), "batch_sizes": seen})
            """,
            {
                "infos": _infos(n_files),
                "config": {
                    "batch_size": batch_size,
                    "agents": [],
                    "agents_explicit": False,
                    "route_mode": "all",
                    "max_file_size": 51200,
                    "max_prompt_size": 131072,
                    "output_dir": "./review/code",
                    "skip_extensions": [],
                },
            },
        )
        return out

    def test_a_changeset_far_above_the_batch_size_still_prints_one_line(self):
        out = self._stdout_lines(n_files=137, batch_size=50)
        lines = [l for l in out["stdout"].splitlines() if l.strip()]
        self.assertEqual(
            len(lines), 1,
            f"--prepare must print exactly one session path; got {lines}",
        )

    def test_the_single_session_receives_every_file(self):
        out = self._stdout_lines(n_files=137, batch_size=50)
        self.assertEqual(
            out["batch_sizes"], [137],
            "prepare_session must be called once with the whole changeset — "
            "a partial call is exactly the defect (the rest goes unreviewed)",
        )

    def test_small_changesets_are_unaffected(self):
        out = self._stdout_lines(n_files=3, batch_size=50)
        lines = [l for l in out["stdout"].splitlines() if l.strip()]
        self.assertEqual(len(lines), 1)
        self.assertEqual(out["batch_sizes"], [3])

    def test_batch_size_zero_does_not_crash_or_split(self):
        out = self._stdout_lines(n_files=9, batch_size=0)
        self.assertEqual(out["batch_sizes"], [9])


class LargeChangesetIsAnnouncedTest(unittest.TestCase):
    """Dropping the split must not make the size silent — say it on stderr."""

    def _warn(self, n_files, batch_size):
        return run_in_orchestrator(
            """
            buf = io.StringIO()
            with contextlib.redirect_stderr(buf):
                orch._warn_large_changeset(ARG["infos"], ARG["batch_size"])
            emit(buf.getvalue())
            """,
            {"infos": _infos(n_files), "batch_size": batch_size},
        )

    def test_over_the_threshold_names_the_count_and_the_threshold(self):
        out = self._warn(137, 50)
        self.assertIn("137", out)
        self.assertIn("50", out)

    def test_it_says_a_single_session_is_intentional(self):
        out = self._warn(137, 50)
        self.assertIn("SINGLE", out.upper())

    def test_at_or_below_the_threshold_is_silent(self):
        self.assertEqual(self._warn(50, 50).strip(), "")
        self.assertEqual(self._warn(1, 50).strip(), "")

    def test_threshold_zero_disables_the_notice(self):
        self.assertEqual(self._warn(500, 0).strip(), "")


class ForcedSetShrinksWithTheChangesetTest(unittest.TestCase):
    """Why a split batch is unsafe — the forced whitelist is derived per changeset.

    This is the amplification, and it is the reason the fix had to remove the
    split rather than merely document it. Pinned separately so that restoring a
    split (for any reason) cannot quietly re-arm the false PASS.
    """

    ALL = [
        "security", "performance", "architecture", "requirement", "scope",
        "side_effect", "maintainability", "testing", "documentation",
        "dependency", "database", "concurrency", "api_contract",
        "user_guide_sync",
    ]

    def _forced(self, paths):
        """Resolve the forced set in the orchestrator's own interpreter.

        Importing `lib.router_safety` in-process is exactly the `_lib` collision
        this module's docstring warns about — `router_safety` does
        `from _lib import project_config`, and the hook suites have already put
        `.claude/hooks/_lib` on `sys.path` by the time `discover` reaches us. It
        passes standalone and errors under `discover`. (Measured: the first draft
        of this class did precisely that.) The orchestrator already imports the
        symbol, so go through the fresh interpreter like every other test here.
        """
        out = run_in_orchestrator(
            """
            agents, _ = orch.compute_forced_agents(ARG["paths"], ARG["all"], ARG["root"])
            emit(sorted(agents))
            """,
            {"paths": paths, "all": self.ALL, "root": str(REPO_ROOT)},
        )
        return set(out)

    def test_a_docs_only_tail_loses_the_source_reviewers(self):
        src = [f"codebase/backend/src/mod{i}.ts" for i in range(50)]
        docs = [f"spec/5-system/doc{i}.md" for i in range(10)]

        full = self._forced(src + docs)
        tail = self._forced(docs)

        lost = full - tail
        self.assertTrue(
            {"security", "testing", "scope", "maintainability", "side_effect"} <= lost,
            "the source-blanket rule must be what a docs-only tail loses — "
            f"full={sorted(full)} tail={sorted(tail)}",
        )

    def test_the_fixture_actually_discriminates(self):
        """Guard against a vacuous version of the test above.

        If the `.ts` half stopped forcing the source reviewers, `lost` would be
        empty and the assertion would still need to fail — but a future edit
        could weaken the fixture instead. Assert the premise directly.
        """
        src_only = self._forced([f"codebase/backend/src/mod{i}.ts" for i in range(3)])
        self.assertIn("security", src_only)
        self.assertIn("testing", src_only)


class DocsOnlyFramingIsCrossCheckedTest(unittest.TestCase):
    """"문서 전용" is derived from the changeset — so a wrong changeset launders itself.

    The router is handed the source/doc split as a *fact*. When changeset
    computation is wrong, that wrongness becomes a confident "소스 코드 변경 없음"
    and every source reviewer is deselected — one bad changeset reads as a clean
    review. Removing the batch split closed one cause; this closes the
    amplification, which is what makes any such cause catastrophic.
    """

    def _missing(self, changeset, branch_files, base="origin/main"):
        return run_in_orchestrator(
            """
            orch._default_branch_ref = lambda: ARG["base"]
            orch.get_git_branch_diff_files = lambda b: ARG["branch_files"]
            emit(orch._source_files_missing_from_changeset(ARG["changeset"]))
            """,
            {"changeset": changeset, "branch_files": branch_files, "base": base},
        )

    def test_source_in_the_branch_but_absent_from_the_changeset_is_reported(self):
        out = self._missing(
            changeset=["spec/a.md", "spec/b.md"],
            branch_files=["spec/a.md", "codebase/backend/src/svc.ts"],
        )
        self.assertEqual(out, ["codebase/backend/src/svc.ts"])

    def test_a_complete_changeset_reports_nothing(self):
        out = self._missing(
            changeset=["spec/a.md", "codebase/backend/src/svc.ts"],
            branch_files=["spec/a.md", "codebase/backend/src/svc.ts"],
        )
        self.assertEqual(out, [])

    def test_docs_only_branch_reports_nothing(self):
        out = self._missing(changeset=["spec/a.md"], branch_files=["spec/a.md", "spec/c.md"])
        self.assertEqual(out, [])

    def test_unresolvable_base_is_silent(self):
        self.assertEqual(self._missing(["spec/a.md"], ["codebase/x.ts"], base=""), [])

    def test_git_failure_is_absorbed_not_propagated(self):
        out = run_in_orchestrator(
            """
            orch._default_branch_ref = lambda: "origin/main"
            def boom(*a, **k):
                raise RuntimeError("git exploded")
            orch.get_git_branch_diff_files = boom
            emit(orch._source_files_missing_from_changeset(["spec/a.md"]))
            """
        )
        self.assertEqual(out, [])

    def test_the_router_prompt_refuses_the_docs_only_framing(self):
        """Call-site test — the helper being right is not the same as it being used."""
        out = run_in_orchestrator(
            """
            orch._default_branch_ref = lambda: "origin/main"
            orch.get_git_branch_diff_files = lambda b: ["codebase/backend/src/svc.ts"]
            body = orch.build_router_prompt_body(
                ARG["agents"], [], {},
                [orch.build_cli_change_info("spec/a.md", diff_content="x", file_content="x")],
                51200, 131072,
            )
            emit(body)
            """,
            {"agents": ["security", "documentation"]},
        )
        self.assertIn("codebase/backend/src/svc.ts", out)
        self.assertIn("changeset 이 그걸 놓쳤습니다", out)

    def test_the_router_prompt_stays_quiet_when_the_changeset_is_complete(self):
        out = run_in_orchestrator(
            """
            orch._default_branch_ref = lambda: "origin/main"
            orch.get_git_branch_diff_files = lambda b: ["spec/a.md"]
            body = orch.build_router_prompt_body(
                ARG["agents"], [], {},
                [orch.build_cli_change_info("spec/a.md", diff_content="x", file_content="x")],
                51200, 131072,
            )
            emit(body)
            """,
            {"agents": ["security", "documentation"]},
        )
        self.assertNotIn("changeset 이 그걸 놓쳤습니다", out)


if __name__ == "__main__":
    unittest.main()
