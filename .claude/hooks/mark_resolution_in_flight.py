#!/usr/bin/env python3
"""은퇴한 훅의 빈 스텁 — 아무것도 하지 않고 exit 0 한다.

NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)에서 resolution 마커 훅 두 개
(`mark_resolution_in_flight.py` · `clear_resolution_in_flight.py`)와 `settings.json` 배선을 걷었다.
리뷰 게이트가 NERV 라운드로 판정하므로 "resolution 진행 중" 마커가 필요 없다.

파일을 남기는 이유: 훅 명령은 `$CLAUDE_PROJECT_DIR`(main 체크아웃)의 파일을 부르고, 세션은 시작할 때
읽은 settings 를 끝까지 쓴다. 이 변경이 머지되기 전에 시작한 세션은 main 을 pull 한 뒤에도 옛 배선으로
이 파일을 부른다. 파일이 없으면 `python3` 가 exit 2 로 끝나고, PreToolUse 의 exit 2 는 차단이라 그
세션의 모든 Agent 호출이 막힌다. 단계 3(NERV Task `CLE-T-FN2JWK`)에서 지운다.
"""

import sys

if __name__ == "__main__":
    try:
        sys.stdin.read()
    except Exception:  # noqa: BLE001 — 스텁은 어떤 입력에도 통과한다
        pass
    sys.exit(0)
