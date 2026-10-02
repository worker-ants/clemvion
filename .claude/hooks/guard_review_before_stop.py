#!/usr/bin/env python3
"""은퇴한 Stop 훅의 빈 스텁 — 아무것도 하지 않고 exit 0 한다(턴 종료를 막지 않는다).

NERV 정본 전환 단계 3(NERV Task `CLE-T-FN2JWK`)에서 `plan/` 과 함께 이 훅의 마지막 기능(완료한 plan 을
`plan/complete/` 로 옮기라는 권유)을 걷었고 `settings.json` 의 `Stop` 배선도 뺐다. 리뷰 권유는 단계 2 에서
이미 걷었다. 남은 일(열린 클레임이 있으면 턴 종료를 한 번 막는다)은 NERV 플러그인의 Stop 훅이 한다.

파일을 남기는 이유: 훅 명령은 `$CLAUDE_PROJECT_DIR`(main 체크아웃)의 파일을 부르고, 세션은 시작할 때
읽은 settings 를 끝까지 쓴다. 이 변경이 머지되기 전에 시작한 세션은 main 을 pull 한 뒤에도 옛 배선으로
이 파일을 부른다. 파일이 없으면 `python3` 가 exit 2 로 끝나고, Stop 훅의 exit 2 는 턴 종료를 막는다.
그 세션은 끝낼 때마다 막힌다. 단계 5(NERV Task `CLE-T-7M4C4X`)에서 지운다.
"""

import sys

if __name__ == "__main__":
    try:
        sys.stdin.read()
    except Exception:  # noqa: BLE001 — 스텁은 어떤 입력에도 통과한다
        pass
    sys.exit(0)
