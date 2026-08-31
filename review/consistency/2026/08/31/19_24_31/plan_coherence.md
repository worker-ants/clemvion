# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base origin/main)

## 검토 범위 요약

이번 델타는 `spec/5-system/` 내 2개 파일만 변경한다:

- `spec/5-system/6-websocket-protocol.md` — §4.3(KB 문서 이벤트)을 §4.4(대기 이벤트 상세) 앞으로
  재배치하고 §4.4~§4.6(알림/시스템/외부표면매핑)을 §4.5~§4.7로 순연. 헤딩 텍스트·내용은 변경 없음
  (순수 절 번호 재정렬).
- `spec/5-system/14-external-interaction-api.md` — §8.2 HMAC 화이트리스트를 `hmac-sha256` 단일에서
  `hmac-sha256`/`hmac-sha512` 둘로 정정 + 서명 스킴 버전(`v2=`) 축을 별도 문장으로 분리, §11의
  WS 앵커를 §4.6→§4.7로 갱신.

두 변경 모두 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 `[x]` 완료 항목으로
정확히 대응 기록돼 있고(라운드별 사후검증 포함), 그 plan 문서는 이 변경 배후에서 3라운드에 걸쳐
"인용 sweep이 매번 한 칸씩 좁았다"는 자기 반증을 거쳐 최종적으로 `websocket.service.ts` 등 코드
주석까지 §4.5로 동기화를 완료했다. 코드 diff(`chat-channel.dispatcher.*`, `websocket.service.*`,
`notifications-channel-authorizer.ts`, `websocket-events.types.ts`)는 전부 이 재배치·정정을
따라간 주석/문구 동기화이며 동작 변경은 없다.

## 발견사항

이번 델타 자체가 target–plan 충돌·선행 미해소·후속 누락 중 어느 것도 만들지 않는다는 것을
아래 세 축으로 실측 확인했다. 신규 CRITICAL/WARNING은 없다.

- **[INFO] `spec-sync-websocket-protocol-gaps.md`의 3개 미해결 결정은 target이 우회하지 않았다**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.6(시스템 이벤트) 테이블, Rationale
    "잔여(Planned, 실 기능 백로그)" 문단
  - 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` L23-81 — `auth.token_expired`
    (소켓 수명을 토큰 수명에 종속시킬지/disconnect 여부), `system.maintenance`(유지보수 선언
    주체 미정), server ping(4종 형제 항목처럼 won't-do로 종결할지) 세 항목이 "구현 아니라 결정
    선행" 으로 2026-08-31 실측 등재됨
  - 상세: target은 이 세 항목을 여전히 `_(계획·미구현)_` 로만 표기하고 어떤 결정도 선반영하지
    않았다(§4.6 테이블·Rationale 문구 diff 없음, 절 번호만 §4.5→§4.6으로 순연). 미해결 결정을
    일방적으로 내리는 CRITICAL 패턴은 없다.
  - 제안: 없음 — 그대로 유지. 세 항목의 실제 착수는 별도 planner 턴에서 §1.2/§4.6에 결정을
    명문화한 뒤 진행.

- **[INFO] `--spec` 게이트 스킵의 보상 그물이 이번 세션 자체다**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §8.2, `spec/5-system/6-websocket-protocol.md` §4 재배치
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md`의 "트랙 판정 (3R WARNING #1)" 블록
    — 이 두 spec 편집은 "자기-반증형 소정정" 5조건 중 (1)(2)(4)를 충족하지 못해 실질
    **planner 트랙 작업**이었으나, 세션 시작 시 사용자 승인 하에 `--spec` 사전 게이트 없이
    진행했고, 보상 조치로 "`--impl-done`을 이 spec 파일이 포함되는 scope로 반드시 돌린다"를
    명시
  - 상세: 지금 이 리뷰(`--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`)가 바로 그
    보상 그물이다. 새로운 미해소 사항이 아니라 plan이 스스로 예고한 절차가 정상 작동 중임을
    확인.
  - 제안: 없음 — 같은 라운드의 다른 checker(cross_spec/naming/convention 등)도 Critical 0으로
    수렴하면 이 보상 의무는 이 라운드로 종결된다.

- **[INFO] 재넘버링의 잔존 참조는 plan이 자체 3라운드 sweep으로 전량 정리, 재확인 결과 잔존 0**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.3~§4.7
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md`의 "네 번째 재발" 블록(1R 앵커링크만
    →2R 프로즈+같은줄 주어→3R 블록문맥±5줄→4R 전수 열거+주어 대조)
  - 상세: 독립적으로 `git -C <worktree> grep`으로 `#44-`/`#45-`/`#46-외부` 앵커 및 `WS §4.4`/`§4.5`
    bare 프로즈 인용을 spec/codebase/plan 전체에서 재확인했다. `#44-사용자-입력-대기…`(대기 상세,
    번호 불변) 인용은 전부 정확, `#45-알림-이벤트…`(신 번호) 인용도 전부 정확. 유일한 잔존
    "§4.6"은 `spec/data-flow/8-notifications.md:349`의 그 문서 **자체** §4.6("WebSocket 동기화
    follow-up")을 가리키는 것으로 WS 문서 재배치와 무관 — plan이 이미 별도 미조치 항목(`[ ]`)으로
    등재해 둔 pre-existing dead follow-up과 동일 지점.
  - 제안: 없음 — 후속 누락 없음. `8-notifications.md:349`의 dead follow-up과 `spec-links` 가드가
    앵커를 검사하지 않는 갭은 plan에 이미 `[ ]`로 등재돼 있어 별도 조치 불필요.

## 요약

이번 PR의 `spec/5-system/` 델타(§4 절 재배치 + EIA §8.2 HMAC 화이트리스트 정정)는 두 파일 모두
`pending_plans`로 연결된 `spec-sync-*-gaps.md` 트래커에 완료 항목(`[x]`)으로 정확히 반영돼 있고,
그 트래커가 남긴 3개의 미해결 결정(`auth.token_expired`/`system.maintenance`/server ping)을
target이 그대로 `_(계획·미구현)_`으로 유지해 우회하지 않았다. 절 번호 재배치로 인한 참조 drift는
plan 자체가 4라운드 재귀 sweep(앵커→프로즈→블록문맥→전수열거)으로 검증했고, 독립 재확인에서도
잔존 stale 참조가 없었다(유일 후보는 무관한 self-reference로 이미 별건 등재). `--spec` 사전 게이트
스킵은 plan이 스스로 "planner 트랙"으로 재분류하고 이번 `--impl-done` 라운드를 보상 조치로 명시해
뒀으므로, 이 라운드가 정상 완주하면 그 의무도 종결된다. Plan 정합성 관점에서 충돌·선행 미해소·
후속 누락 어느 것도 발견되지 않았다.

## 위험도

NONE
