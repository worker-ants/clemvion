"""은퇴한 resolution 마커 훅의 빈 스텁 — NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`).

배선은 걷었지만 파일은 단계 3 까지 남긴다. 머지 전에 시작한 세션이 옛 settings 로 이 파일을 부르는데,
파일이 없으면 `python3` 가 exit 2 로 끝나 PreToolUse(Agent) 가 모든 Agent 호출을 막는다. 고정하는 것:
스텁은 어떤 입력에도 출력 없이 exit 0 이고, `settings.json` 은 더 이상 스텁을 부르지 않는다.
"""

from __future__ import annotations

import subprocess
import sys
import unittest

import _harness

STUBS = ("mark_resolution_in_flight.py", "clear_resolution_in_flight.py")


class RetiredHookStubTest(unittest.TestCase):
    def test_each_stub_passes_silently_on_any_input(self):
        for name in STUBS:
            for payload in ("", "{}", '{"tool_name": "Agent", "tool_input": {"subagent_type": "resolution-applier"}}',
                            "not json"):
                with self.subTest(stub=name, payload=payload[:20]):
                    r = subprocess.run([sys.executable, str(_harness.HOOKS_DIR / name)], input=payload,
                                       capture_output=True, text=True, timeout=30)
                    self.assertEqual(r.returncode, 0, r.stderr)
                    self.assertEqual((r.stdout, r.stderr), ("", ""))

    def test_settings_no_longer_wire_the_stubs(self):
        settings = (_harness.CLAUDE_DIR / "settings.json").read_text(encoding="utf-8")
        for name in STUBS:
            self.assertNotIn(name, settings)


if __name__ == "__main__":
    unittest.main()
