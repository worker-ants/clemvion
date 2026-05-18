---
worktree: notification-websocket-name-sync-1a2b3c
started: 2026-05-17
completed: 2026-05-18
owner: project-planner
---

# Follow-up: Notification WebSocket 이벤트명·채널명 정합성

## 배경

`notification-actions-8806b6` worktree 의 dismiss endpoint 구현 직전 `consistency-check --impl-prep spec/data-flow/` 세션 `review/consistency/2026/05/17/16_22_22/SUMMARY.md` 의 Critical 2건:

- **C-1**: WebSocket 이벤트 이름 불일치
  - `spec/data-flow/8-notifications.md` (코드 주석·다이어그램·매핑 표): `notification:new` (콜론 구분자)
  - `spec/5-system/6-websocket-protocol.md §4.4`: `notification.new` (점 구분자)
- **C-2**: WebSocket 채널명 불일치
  - `8-notifications.md`: room `user:<userId>`
  - `6-websocket-protocol.md §4.4`: 채널 `notifications:{userId}`

두 spec 이 어긋난 표기를 유지 중이며, 코드 진실은 `codebase/backend/src/modules/websocket/websocket.service.ts` 확인 필요.

## 본 작업과 분리한 근거

dismiss endpoint (`POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`) 는 동기 HTTP REST 만 사용하고 WebSocket emit 을 하지 않는다. spec/data-flow/8-notifications.md §4.6 에 "follow-up phase 에서 multi-device 동기화용 `notification.read` / `notification.dismissed` emit 검토" 로 분리되어 있다. WebSocket 이벤트명·채널명 정합성 검토는 그 follow-up phase 의 일이며, dismiss 작업 자체의 동작·테스트는 두 spec 의 표기와 무관하다.

## 작업 범위

- [x] 새 worktree 생성 (`notification-websocket-name-sync-1a2b3c`)
- [x] `codebase/backend/src/modules/websocket/websocket.service.ts` 의 실제 emit 코드 확인 — **결과: emit 자체가 아직 미구현**. `WebsocketService` 에 `emitNotificationEvent` 메서드 부재. `NotificationsService` 도 `WebsocketService` 를 import 하지 않는다. 단 `WebsocketGateway.VALID_CHANNEL_PREFIXES` 에는 `'notifications:'` prefix 가 이미 등록되어 있어 채널 예약은 끝난 상태.
- [x] frontend WebSocket 클라이언트의 subscribe 표기 확인 — **결과: notification 채널 subscribe 코드도 없다**. `codebase/frontend/src/` 에 `notification:new` / `notification.new` 핸들러 부재.
- [x] `spec/data-flow/8-notifications.md` 와 `spec/5-system/6-websocket-protocol.md §4.4` 를 일치시킨다 — `8-notifications.md` 의 §1 다이어그램·§2.2 표·§Overview 코드 진입점을 `notification.new` (점 표기) + `notifications:<userId>` 채널로 정정. `6-websocket-protocol.md §4.4` 가 권위 (변경 불필요).
- [x] 두 spec 모두 같은 구분자 (점) 와 같은 채널 prefix (`notifications:`) 로 통일.
- [x] follow-up `notification.read` / `notification.dismissed` 신설 검토 — `8-notifications.md §4.6` 가 이미 점 표기로 명시 중. 본 개정으로 §1·§2.2 와 표기 일관성 확보. 추가 결정 불필요.
- [x] consistency-check --spec 후 PR.

## 결과 요약

- 코드 측은 변경 없음 — emit 미구현 상태 자체는 별도 follow-up phase 의 작업으로 그대로 둠 (본 plan 의 범위는 spec 정합성).
- `8-notifications.md` Rationale 에 "WebSocket emit 표기 정정 — `notification.new` + `notifications:<userId>` (2026-05-18)" 항 추가, `review/consistency/2026/05/17/16_22_22/SUMMARY.md` 의 C-1·C-2 해소를 명시.

## 의존성

- `notification-actions-8806b6` (dismiss endpoint 구현) 의 PR merge 이후 시작. dismiss endpoint 가 main 에 merge 완료된 상태에서 본 작업 진행 (2026-05-18).
