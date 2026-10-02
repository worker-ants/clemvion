"""은퇴한 훅의 빈 스텁 — NERV 정본 전환 단계 3(NERV Task `CLE-T-FN2JWK`).

`guard_review_before_stop.py`(Stop) 의 배선은 걷었지만 파일은 단계 5(NERV Task `CLE-T-7M4C4X`)까지
남긴다. 머지 전에 시작한 세션이 옛 settings 로 이 파일을 부르는데, 파일이 없으면 `python3` 가 exit 2 로
끝나 그 세션의 턴 종료가 매번 막힌다. 고정하는 것: 스텁은 어떤 입력에도 출력 없이 exit 0 이고(턴 종료를
막지 않는다), `settings.json` 은 더 이상 스텁을 부르지 않는다.

단계 2 의 resolution 마커 스텁 두 개(`mark_resolution_in_flight.py` · `clear_resolution_in_flight.py`)는
단계 3 에서 지웠다(단계 2 머지 전에 시작한 세션이 남아 있지 않음을 사람이 확인했다).
"""

from __future__ import annotations

import subprocess
import sys
import unittest

import _harness

STUBS = ("guard_review_before_stop.py",)
REMOVED = ("mark_resolution_in_flight.py", "clear_resolution_in_flight.py")


class RetiredHookStubTest(unittest.TestCase):
    def test_each_stub_passes_silently_on_any_input(self):
        for name in STUBS:
            for payload in ("", "{}", '{"session_id": "s", "stop_hook_active": false}', "not json"):
                with self.subTest(stub=name, payload=payload[:20]):
                    r = subprocess.run([sys.executable, str(_harness.HOOKS_DIR / name)], input=payload,
                                       capture_output=True, text=True, timeout=30)
                    self.assertEqual(r.returncode, 0, r.stderr)
                    self.assertEqual((r.stdout, r.stderr), ("", ""))

    def test_settings_no_longer_wire_the_stubs(self):
        settings = (_harness.CLAUDE_DIR / "settings.json").read_text(encoding="utf-8")
        for name in STUBS + REMOVED:
            self.assertNotIn(name, settings)

    def test_removed_stubs_are_gone(self):
        for name in REMOVED:
            self.assertFalse((_harness.HOOKS_DIR / name).exists(), name)


if __name__ == "__main__":
    unittest.main()
