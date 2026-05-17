---
worktree: TBD
started: 2026-05-17
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

두 spec 이 어긋난 표기를 유지 중이며, 코드 진실은 `backend/src/modules/websocket/websocket.service.ts` 확인 필요.

## 본 작업과 분리한 근거

dismiss endpoint (`POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`) 는 동기 HTTP REST 만 사용하고 WebSocket emit 을 하지 않는다. spec/data-flow/8-notifications.md §4.6 에 "follow-up phase 에서 multi-device 동기화용 `notification.read` / `notification.dismissed` emit 검토" 로 분리되어 있다. WebSocket 이벤트명·채널명 정합성 검토는 그 follow-up phase 의 일이며, dismiss 작업 자체의 동작·테스트는 두 spec 의 표기와 무관하다.

## 작업 범위

- [ ] 새 worktree 생성 (`notification-websocket-name-sync-<slug>`)
- [ ] `backend/src/modules/websocket/websocket.service.ts` 의 실제 emit 코드 확인 — 이벤트명·채널명 진실 식별
- [ ] frontend WebSocket 클라이언트 (`frontend/src/hooks/use*.ts` 등) 의 subscribe 표기도 확인
- [ ] `spec/data-flow/8-notifications.md` 와 `spec/5-system/6-websocket-protocol.md §4.4` 를 코드 진실 기준으로 일치시킨다
- [ ] 두 spec 모두 같은 구분자 (콜론 또는 점) 와 같은 채널 prefix 로 통일
- [ ] follow-up 으로 `notification.read` / `notification.dismissed` (또는 콜론 표기) 신설 검토를 본 작업 안에서 함께 결정해 spec 에 명시
- [ ] consistency-check --spec 후 PR

## 의존성

- `notification-actions-8806b6` (dismiss endpoint 구현) 의 PR merge 이후 시작 권장 — 그 PR 의 spec 변경 (§4.6 follow-up 명시) 을 base 로 작업하므로.
