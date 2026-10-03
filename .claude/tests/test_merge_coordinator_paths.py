"""merge-coordinator 오케스트레이터의 경로 분류와 스펙 미러 겹침 절.

분석기 프롬프트에 그대로 들어가는 표면이다. NERV 정본 전환 4e 에서 `plan` 그룹을 걷고(`plan/` 은 단계 3 에서
없어졌다) 겹침 절을 스펙 미러 기준으로 바꿨다. 오케스트레이터는 `skills/_lib` 를 들이므로 하위 프로세스에서
부른다(`_lib` 이름이 훅 패키지와 겹친다).
"""

from __future__ import annotations

import unittest

import _harness

ORCH = _harness.CLAUDE_DIR / "skills" / "merge-coordinator" / "scripts" / "merge_coordinator_orchestrator.py"


def run(snippet, arg=None):
    return _harness.run_in_orchestrator(_harness.orchestrator_preamble(ORCH), snippet, arg)


class CategorisePathsTest(unittest.TestCase):
    def test_groups_and_where_a_stray_plan_path_lands(self):
        got = run("emit(orch.categorise_paths(ARG, ROOT))",
                  ["spec/CLE-A/CLE-A-B.md", "plan/in-progress/x.md", ".claude/hooks/h.py",
                   "codebase/backend/a.ts", "README.md"])
        self.assertNotIn("plan", got)
        self.assertEqual(got["spec"], ["spec/CLE-A/CLE-A-B.md"])
        self.assertEqual(got[".claude"], [".claude/hooks/h.py"])
        self.assertEqual(got["codebase"], ["codebase/backend/a.ts"])
        self.assertEqual(got["other"], ["plan/in-progress/x.md", "README.md"])


class SpecOverlapSectionTest(unittest.TestCase):
    def _section(self, touched):
        return run(
            """
            orch.branch_touched_files = lambda base, name: ARG[name]
            emit(orch.spec_overlap_section([{"name": n} for n in ARG], "origin/main"))
            """,
            touched,
        )

    def test_two_branches_on_one_mirror_file_are_marked(self):
        text = self._section({"a": ["spec/CLE-A/CLE-A-B.md", "codebase/x.ts"],
                              "b": ["spec/CLE-A/CLE-A-B.md"], "c": ["spec/CLE-C.md"]})
        self.assertIn("## spec/ 미러 변경", text)
        self.assertIn("- `spec/CLE-A/CLE-A-B.md` ← `a`, `b` ⚠️ overlap", text)
        self.assertIn("- `spec/CLE-C.md` ← `c`", text)
        self.assertNotIn("CLE-C.md` ← `c` ⚠️", text)
        self.assertNotIn("codebase/x.ts", text)

    def test_no_spec_change_says_none(self):
        self.assertIn("(없음)", self._section({"a": ["codebase/x.ts"]}))


if __name__ == "__main__":
    unittest.main()
