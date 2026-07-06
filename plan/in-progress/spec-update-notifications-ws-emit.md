---
worktree: (unstarted)
started: 2026-07-06
owner: planner
---

# spec-update — notification.new WS emit 구현 반영 (Planned → 구현됨)

> 출처: 알림 파이프라인 PR1 (`notif-firing-pipeline-65d7e1`) — `NotificationsService.notify()` 단일 적재 표면 + `WebsocketService.emitNotificationEvent()` 로 `notification.new` WS emit 구현. developer 는 spec read-only 라 아래 배지 flip 을 planner 에게 위임한다 (SPEC-DRIFT reflux, `/consistency-check --impl-done` 2026-07-06 15_24_54 WARNING #1·#3).
> **착수 전 `/consistency-check --spec` 이 문서 통과 의무.**

## 배경

PR1 이 다음을 실제 구현했다 (코드 실재):
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `NotificationEventType.NOTIFICATION_NEW` + `emitNotificationEvent(userId, payload)` (payload = `{ id, type, title, message, resourceType, resourceId }`, best-effort broadcast).
- `codebase/backend/src/modules/notifications/notifications.service.ts` — `notify()` 단일 적재 표면 + `createMany()` 저장 후 per-row emit (`emitNew`).

따라서 아래 spec 서술이 stale("미구현/Planned/emit 코드 없음")다. **flip 대상은 오직 `notification.new` WS emit + `notify()` 표면**이며, 아래는 **Planned 유지**(PR2/PR3 미구현): 알림 이메일 발송·`email_sent_at` setter·발사 소스 3종(`execution_failed`/`schedule_failed`/`team_invite`)·§4.6 `notification.read`/`notification.dismissed`.

## flip 대상 (planner 편집)

### `spec/data-flow/8-notifications.md`
- [ ] Overview "구현 현황 주의" (≈L14-18): "WebSocket emit 도 미구현 (아래)." 제거 → 구현됨. "단일 `notify()` 표면은 미구현 (Planned)" → `notify()` 도입됨(단, 기존 호출자는 여전히 `createMany` 배치 경유 — 두 표면 병존)으로 정정.
- [ ] 코드 진입점 목록 (≈L21): `websocket.service.ts — notification.new emit (미구현 Planned…)` → 구현됨(`emitNotificationEvent`).
- [ ] §1 다이어그램 Note "미구현 (Planned)" WS emit 단계 (≈L48-49) + 단계표 "notification.new WS emit | 미구현 (Planned)" (≈L59) → 구현됨.
- [ ] §1 표 "WebSocket 채널 … notification.new emit" (≈L45): "follow-up phase 작업 — 현재 WebsocketService 에 해당 메서드 미구현" → 구현됨.
- [ ] §2.2 (≈L99): "notification.new WS emit … 현재 WebsocketService 에 해당 메서드 미구현" → 구현됨(emit 은 best-effort, `notifications:<userId>`).
- [ ] Rationale "WebSocket emit 표기" (≈L331): "코드 측은 현재 emit 미구현(emitNotificationEvent 부재)" → 구현됨.
- [ ] (유지) 이메일 발송·`email_sent_at`·발사 소스 3종 관련 "미구현 (Planned)" 은 그대로.

### `spec/5-system/6-websocket-protocol.md`
- [ ] §4.4 (≈L147-149, 그리고 중복 블록 ≈L745-751): "notification.new emit 하는 backend 코드가 없다 / _(계획·미구현)_" → 구현됨. payload shape 은 `{ id, type, title, message, resourceType, resourceId }` 유지(코드가 정확히 이 shape — timestamp 등 확장 없음).
- [ ] §3.3 authorizer 표 (≈L104) + Rationale (≈L373): "emit 은 미구현(Planned)이나 …선제 배치" → emit 구현됨으로 정정(authorizer 는 그대로).
- [ ] Rationale status 강등 문단 (≈L284): "notification.new emit … 코드에 실재 부재" 목록에서 notification.new 제거(나머지 auth.refresh·rate-limit 등은 여전히 부재 → status `partial` 유지).

## 완료 조건
- 위 두 spec 배지 flip + `/consistency-check --spec` BLOCK:NO.
- 두 tracker plan(`spec-sync-data-flow-8-notifications-gaps.md`·`spec-sync-websocket-protocol-gaps.md`)의 `notification.new` emit 체크박스는 PR1 코드 PR 에서 이미 `[x]` 처리됨 — 본 plan 은 spec 본문 배지만 담당.
