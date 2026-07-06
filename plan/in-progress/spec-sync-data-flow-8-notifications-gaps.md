---
worktree: notif-firing-pipeline-65d7e1
started: 2026-06-03
owner: developer
---

# data-flow/8-notifications — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 의
> to-be 설계를 "미구현 (Planned)" 로 분리하며 추적.
> 관련 spec: spec/data-flow/8-notifications.md

## 착수 (2026-07-06, developer) — PR 분할

전체 파이프라인을 3개 PR 로 슬라이스 (리뷰 가능 단위 유지). marketplace_update 는 마켓플레이스 backlog 차단이라 범위 밖.

- **PR1 (본 워크트리 `notif-firing-pipeline-65d7e1`)**: `NotificationsService.notify()` 단일 적재 표면 + `WebsocketService.emitNotificationEvent` → 모든 알림 write 에 `notification.new` WS emit(`notifications:<userId>` 채널). 기존 4개 호출자(background/alerts/integration ×2)의 `createMany` 도 emit 경유 → 실시간 전달 확보. (이메일·신규 발사 소스는 PR2/PR3.)
- **PR2 (후속)**: 알림 이메일 발송 경로(`MailService` type별 템플릿) + `email_sent_at` 라이프사이클(channel∈{email,both} 시 발송 후 setter).
- **PR3 (후속)**: 신규 발사 소스 3종 — `execution_failed`(ExecutionEngineService)·`schedule_failed`(ScheduleRunnerService)·`team_invite`(WorkspaceInvitationsService) 를 notify() 경유 발사.

## 미구현 항목
- [ ] `NotificationsService.notify({...})` 단일 적재 표면 — 현재는 호출자가 channel 을 계산해 `createMany(entries[])` 배치 INSERT 호출. preference 확인이 서비스 밖에 흩어져 있음.
- [ ] 알림 이메일 발송 경로 — `MailService` 에 알림 type 별 템플릿/발송 메서드 부재. 현재 verification / invitation / password-reset 만.
- [ ] `email_sent_at` setter — entity·DTO 에 컬럼만 존재, 채우는 코드(발송 라이프사이클) 전무.
- [ ] WebSocket `notification.new` emit — `WebsocketService` 에 emit 메서드 부재 (prefix `notifications:` 만 등록). follow-up phase (§4.6 의 `notification.read`/`notification.dismissed` 포함). **PR1 대상.** ⚠ 동일 gap 이 `plan/in-progress/spec-sync-websocket-protocol-gaps.md`(§4.4 `notification.new` emit)에도 등재 — PR1 완료 시 양쪽 동기 체크.
- [ ] type `execution_failed` 발사 — `ExecutionEngineService` 실행 실패 시 발사 미구현.
- [ ] type `schedule_failed` 발사 — `ScheduleRunnerService` 발사 미구현.
- [ ] type `marketplace_update` 발사 — 마켓플레이스 모듈 도입 시.
- [ ] type `team_invite` 발사 — `WorkspaceInvitationsService` 에서 `notification` row 적재 미구현.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/data-flow/data-flow__8-notifications.md 참조.
- ~~별도(코드 버그) 추적 필요: `AlertsEvaluatorService` 가 발사하는 `alert_<rule.type>` 동적 type 값이 V052 의 notification.type CHECK 제약 허용 목록에 없음~~ — ✅ **해소**: `V070__notification_type_alert_breach.sql` 가 `alert_failure_rate`/`alert_duration`/`alert_llm_cost` 를 CHECK 허용목록에 추가.
