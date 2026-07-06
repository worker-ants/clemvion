### 발견사항

- **[WARNING]** 구현 완료(PR1)에도 plan 체크박스·상호 참조 항목이 미갱신
  - target 위치: `spec/data-flow/8-notifications.md` (Overview 주의문·§1 다이어그램/표·§2.2), `spec/5-system/6-websocket-protocol.md §4.4`
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` — "WebSocket `notification.new` emit" 미구현 항목(체크 안 됨, **PR1 대상**으로 명시), 및 상호참조된 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` §4.4 항목(역시 체크 안 됨)
  - 상세: 이번 diff(`02c9a0827`·`2039e341d`·`a20d4b8a5`)가 `NotificationsService.notify()` 단일 적재 표면 + `WebsocketService.emitNotificationEvent()`(`notifications:<userId>` 채널 `notification.new` emit) + 기존 4개 `createMany` 호출자(background/alerts/integration×2)의 emit 경유를 실제로 구현했다(코드 확인: `notifications.service.ts` `notify`/`createMany`/`emitNew`, `websocket.service.ts` `emitNotificationEvent`, 관련 유닛 테스트 다수). 그런데 (1) `spec-sync-data-flow-8-notifications-gaps.md` 의 해당 체크박스는 여전히 `[ ]`이고, (2) 상호참조 대상인 `spec-sync-websocket-protocol-gaps.md` §4.4 항목도 `[ ]`인 채로 남아 있으며, (3) `spec/data-flow/8-notifications.md`·`spec/5-system/6-websocket-protocol.md §4.4` 본문은 여전히 "WS emit 미구현 (Planned)", "emit 하는 backend 코드가 없다"라고 서술한다. **정작 이 PR 자체가 plan 에 "PR1 완료 시 양쪽 동기 체크" 라고 스스로 명시한 후속 작업**인데 그 동기화가 수행되지 않았다 — plan 이 예고한 후속 항목이 구현 커밋 시점에 누락된 사례.
  - 제안: 본 PR 범위에서 (a) `spec/data-flow/8-notifications.md` 의 WS emit 관련 "미구현 (Planned)" 서술을 "구현됨"으로 갱신(단, 발사 소스 3종(`execution_failed`/`schedule_failed`/`team_invite`)과 이메일 경로는 PR2/PR3 대상이므로 그 부분은 Planned 유지), (b) `spec/5-system/6-websocket-protocol.md §4.4` 의 "계획·미구현" 마킹 제거 또는 정합화, (c) 두 plan 파일의 해당 체크박스를 `[x]`로 정정하고 완료 커밋을 링크. spec 본문 갱신은 `developer` 가 아니라 `project-planner` 소관이므로, 본 PR 이 spec 을 직접 갱신하지 않는다면 최소한 두 plan 파일에 "구현 완료(코드), spec 문서 갱신은 후속 planner 작업으로 남음"이라는 명시적 상태 갱신이 필요하다.

- **[INFO]** `notify()` 단일 적재 표면은 아직 무호출(dead surface) — 의도된 범위이나 plan 서술과 재확인 권장
  - target 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` `notify()`
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` "착수 — PR 분할" 절 (PR3: 신규 발사 소스 3종을 `notify()` 경유로 발사)
  - 상세: 코드 검색 결과 `notificationsService.notify(`를 호출하는 곳이 없다 (기존 4개 호출자는 여전히 `createMany`만 사용). Plan 서술("PR1 = notify() 표면 + emitNotificationEvent, PR3 = 신규 발사 소스가 notify() 경유")과 일치하는 의도된 상태로 보이나, 현재로선 `notify()`가 프로덕션 경로에서 전혀 도달 불가능한 코드라는 점을 다음 PR(PR3) 착수자가 인지하도록 plan 에 명시해 두면 좋다(현재도 암묵적으로 유추 가능하나 명시적 언급 없음).
  - 제안: `spec-sync-data-flow-8-notifications-gaps.md` PR3 항목에 "PR1 시점 `notify()` 는 무호출 상태 — PR3 착수 시 우선 실사용처 연결 확인" 한 줄 추가 권장 (필수는 아님, WARNING 아님).

### 요약

이번 PR(PR1)은 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 가 스스로 정의한 3-PR 슬라이스 계획을 정확히 따라 WS emit 인프라를 구현했고, 코드·테스트 측면에서 plan 의 미해결 결정과 충돌하는 바는 없다. 다만 그 plan 문서와 상호참조 대상인 `spec-sync-websocket-protocol-gaps.md` 양쪽 모두가 "PR1 완료 시 동기 체크"를 명시적 후속 조건으로 걸어뒀음에도 이번 커밋에서 체크박스 갱신·spec 본문(`8-notifications.md`, `6-websocket-protocol.md §4.4`)의 "미구현 (Planned)" 마킹 해소가 이뤄지지 않았다. 코드는 완료됐으나 plan/spec 문서가 그 사실을 반영하지 못해 다음 세션(또는 PR2/PR3 진입자)이 stale 정보를 근거로 작업할 위험이 있다.

### 위험도
MEDIUM
