"""은퇴한 훅은 배선도 파일도 남지 않는다.

훅을 은퇴시킬 때는 `settings.json` 의 배선을 먼저 걷고 파일은 빈 스텁으로 한동안 남긴다. 머지 전에
시작한 세션이 옛 settings 로 그 파일을 부르는데, 파일이 없으면 `python3` 가 exit 2 로 끝나 그 세션이
막히기 때문이다. 그런 세션이 남아 있지 않으면 스텁을 지운다.

- 단계 2 의 resolution 마커 스텁 두 개(`mark_resolution_in_flight.py` · `clear_resolution_in_flight.py`)는
  NERV 정본 전환 단계 3 에서 지웠다(단계 2 머지 전에 시작한 세션이 남아 있지 않음을 사람이 확인했다).
- Stop 훅 `guard_review_before_stop.py` 는 단계 3(NERV Task `CLE-T-FN2JWK`)에서 배선을 걷었고 단계 5
  (NERV Task `CLE-T-7M4C4X`)에서 스텁을 지웠다. 사용자가 이번에 지우기로 정했고(2026-10-03) 같은 날
  데스크톱 앱의 세션 목록에서 실행 중인 다른 세션이 없음을 확인했다. 멈춘 세션은 다시 열 때
  그때의 settings 를 읽는다.

새로 스텁을 남기는 훅이 생기면 그 스텁이 어떤 입력에도 출력 없이 exit 0 인지 보는 테스트를 이 파일에
다시 둔다.
"""

from __future__ import annotations

import unittest

import _harness

REMOVED = (
    "mark_resolution_in_flight.py",
    "clear_resolution_in_flight.py",
    "guard_review_before_stop.py",
)


class RetiredHookStubTest(unittest.TestCase):
    def test_settings_no_longer_wire_the_retired_hooks(self):
        settings = (_harness.CLAUDE_DIR / "settings.json").read_text(encoding="utf-8")
        for name in REMOVED:
            self.assertNotIn(name, settings)

    def test_removed_stubs_are_gone(self):
        for name in REMOVED:
            self.assertFalse((_harness.HOOKS_DIR / name).exists(), name)


if __name__ == "__main__":
    unittest.main()
