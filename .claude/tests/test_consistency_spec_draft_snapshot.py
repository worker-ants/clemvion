"""`--spec` 세션은 target draft 원본을 `_target/` 에 남겨야 한다.

**draft 는 임시 파일이 아니라 산출물이다.** `developer` 가 `spec/` 을 직접 못 고치는
CLAUDE.md 경계는 "planner 턴을 밟았다" 로만 정당화되고, `--spec` draft 가 그 유일한
증거다. 그런데 planner 턴 끝에 draft 를 지우는 일이 **두 턴 연속**(`#1242`·`#1243`)
벌어졌고, 머지된 뒤 main 이 **존재하지 않는 파일**을 6곳에서 인용하는 상태가 됐다
(ai-review `19_26_58` requirement W1 이 발견).

두 번 다 `_prompts/*.md` 코드펜스에서 원문을 떠서 복원했다. 그건 **부수 효과**다 —
프롬프트의 target 은 `budget_substitutions` 가 `truncate_file_bundle` 로 **자르고**,
포맷이 바뀌면 사라진다. 우연히 남던 것을 계약으로 바꾼 것이 `_preserve_spec_draft` 이고,
이 테스트가 그 계약을 고정한다.

**차단 가드가 아니다.** 이 저장소는 push 가드를 정밀화했다가 3라운드 회귀 끝에 철회한
이력이 있다(`#970` — "유한한 문제를 무한한 문제와 바꾸지 말 것"). 여기서 보장하는 것은
*증거 보존* 하나이고, draft 를 `plan/complete/` 로 옮기는 관례는 사람이 지킨다.

자매 테스트와 같이 실제 CLI 를 subprocess 로 구동한다.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

from _harness import REPO_ROOT

ORCH = (
    REPO_ROOT / ".claude" / "skills" / "consistency-checker" / "scripts"
    / "consistency_orchestrator.py"
)

# 실제 draft 처럼 보이되 이 테스트만 쓰는 이름. `plan/in-progress/` 에 둬야 하는 이유는
# orchestrator 가 target 을 저장소 상대경로로 읽기 때문이다.
DRAFT_REL = "plan/in-progress/spec-draft-__snapshot_selftest__.md"
DRAFT_BODY = (
    "---\n"
    "title: snapshot self-test draft\n"
    "worktree: selftest\n"
    "started: 2026-08-30\n"
    "owner: project-planner\n"
    "spec_impact:\n"
    "  - spec/conventions/raw-query-results.md\n"
    "---\n\n"
    "# 본문\n\n"
    "이 줄이 세션 사본에도 **그대로** 있어야 한다.\n"
)


def _run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(ORCH), *args],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )


def _session_dir(proc: subprocess.CompletedProcess) -> Path:
    return Path(proc.stdout.strip().split("\n")[-1])


class SpecDraftSnapshotTest(unittest.TestCase):
    def setUp(self) -> None:
        self.draft = REPO_ROOT / DRAFT_REL
        self.draft.write_text(DRAFT_BODY, encoding="utf-8")
        self.sessions: list[Path] = []

    def tearDown(self) -> None:
        self.draft.unlink(missing_ok=True)
        for session in self.sessions:
            if session.exists():
                shutil.rmtree(session, ignore_errors=True)

    def test_spec_session_preserves_the_draft_byte_for_byte(self):
        proc = _run("--spec", DRAFT_REL)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        session = _session_dir(proc)
        self.sessions.append(session)

        snapshot = session / "_target" / self.draft.name
        self.assertTrue(
            snapshot.exists(),
            "`--spec` 세션이 target draft 를 보존하지 않았다 — 이 사본이 없으면 planner 턴의 "
            "유일한 증거가 draft 삭제와 함께 사라진다",
        )
        # 잘린 프롬프트 사본이 아니라 **원본**이어야 한다.
        self.assertEqual(snapshot.read_text(encoding="utf-8"), DRAFT_BODY)

    def test_meta_points_at_the_snapshot(self):
        proc = _run("--spec", DRAFT_REL)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        session = _session_dir(proc)
        self.sessions.append(session)

        meta = json.loads((session / "meta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta.get("target_snapshot"), f"_target/{self.draft.name}")
        # 경로가 실제로 가리키는 곳에 파일이 있어야 한다 — 문자열만 맞고 파일이 없으면
        # 복원하려는 다음 사람에게는 없는 것과 같다.
        self.assertTrue((session / meta["target_snapshot"]).exists())

    def test_non_spec_modes_do_not_snapshot(self):
        """`--plan` 은 draft 가 아니라 진행 중 plan 을 본다 — 사본을 만들 이유가 없다.

        음성 케이스를 고정하지 않으면 "모든 모드가 target 을 복사한다" 로 넓어져도
        아무 테스트가 RED 를 내지 않는다.
        """
        proc = _run("--plan", DRAFT_REL)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        session = _session_dir(proc)
        self.sessions.append(session)

        self.assertFalse((session / "_target").exists())
        meta = json.loads((session / "meta.json").read_text(encoding="utf-8"))
        self.assertNotIn("target_snapshot", meta)


if __name__ == "__main__":
    unittest.main()
