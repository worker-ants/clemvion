---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# data-flow/8-notifications — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 의
> to-be 설계를 "미구현 (Planned)" 로 분리하며 추적.
> 관련 spec: spec/data-flow/8-notifications.md

## 미구현 항목
- [ ] `NotificationsService.notify({...})` 단일 적재 표면 — 현재는 호출자가 channel 을 계산해 `createMany(entries[])` 배치 INSERT 호출. preference 확인이 서비스 밖에 흩어져 있음.
- [ ] 알림 이메일 발송 경로 — `MailService` 에 알림 type 별 템플릿/발송 메서드 부재. 현재 verification / invitation / password-reset 만.
- [ ] `email_sent_at` setter — entity·DTO 에 컬럼만 존재, 채우는 코드(발송 라이프사이클) 전무.
- [ ] WebSocket `notification.new` emit — `WebsocketService` 에 emit 메서드 부재 (prefix `notifications:` 만 등록). follow-up phase (§4.6 의 `notification.read`/`notification.dismissed` 포함).
- [ ] type `execution_failed` 발사 — `ExecutionEngineService` 실행 실패 시 발사 미구현.
- [ ] type `schedule_failed` 발사 — `ScheduleRunnerService` 발사 미구현.
- [ ] type `marketplace_update` 발사 — 마켓플레이스 모듈 도입 시.
- [ ] type `team_invite` 발사 — `WorkspaceInvitationsService` 에서 `notification` row 적재 미구현.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/data-flow/data-flow__8-notifications.md 참조.
- 별도(코드 버그) 추적 필요: `AlertsEvaluatorService` 가 발사하는 `alert_<rule.type>` 동적 type 값이 V052 의 notification.type CHECK 제약 허용 목록에 없음 — 런타임 INSERT 제약 위반 가능. 본 spec 범위 밖(코드/마이그레이션 정합) 으로 developer 추적 대상.
