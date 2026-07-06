---
worktree: notif-firing-sources-547d5c
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
- **PR2 (본 워크트리 `notif-email-dispatch-9b0364`, 착수)**: 알림 이메일 발송 경로 + `email_sent_at` 라이프사이클. 설계: `MailService.sendNotificationEmail(to, {title, message, type})` **단일 범용 템플릿**(subject=title, body=message + 알림 페이지 CTA) — per-type 시각 템플릿은 downscope(대부분 title/message 로 type별 내용 이미 인코딩). `NotificationsService` 가 저장 후 `channel∈{email,both}` row 에 대해 User email(`In(userIds)` 배치 조회) 발송 → 성공 시 `email_sent_at=now` UPDATE. best-effort(warn only, 재시도 없음 — spec Rationale). MailModule 은 순환 무관이라 직접 import(PR1 WebsocketModule 과 달리), User 는 `forFeature([Notification, User])`.
- **PR3 (본 워크트리 `notif-firing-sources-547d5c`, 착수)**: 신규 발사 소스 3종. 모두 best-effort(발사 실패가 원 흐름 안 깨뜨림). 타입은 V070 CHECK 에 이미 존재(마이그레이션 불요).
  - `execution_failed` — `execution-engine.service.ts` runExecution FAILED 분기(EXECUTION_FAILED emit 직후). **`!parentExecutionId` 게이트**(top-level 만 — background body/sub-workflow 하위실행 제외해 `background_failed` 중복 발사 회피). workflow 로드→`createdBy`(owner)+`workspaceId`. 수신자=unique([owner, executedBy]). channel=`in_app`(background_failed 미러). resource=execution/executionId.
  - `schedule_failed` — `schedule-runner.service.ts` process() catch(rethrow 전). 이 catch 는 **enqueue/파라미터 해석 실패**(execution 자체 async 실패는 execution_failed 가 커버). workflow 로드→owner. 수신자=[owner]. channel=`in_app`. resource=schedule/scheduleId.
  - `team_invite` — `workspace-invitations.service.ts` invite() saved 후, **기존 가입자(비멤버)일 때만**. 수신자=existingUser.id. channel=`both`(spec 명시). resource=workspace_invitation/invitationId. ⚠ 기존 초대링크 이메일과 별도라 기존 가입자는 이메일 2통 — spec-literal 채택, planner 재검토(spec-update plan).
  - 각 서비스에 NotificationsService DI(+ workflow owner 조회용 repository). NotificationsModule 은 순환 무관(MailModule/forFeature 만 의존).

## 미구현 항목
- [x] `NotificationsService.notify({...})` 단일 적재 표면 — **PR1 완료** (`notify()` INSERT + `notification.new` emit). 기존 배치 호출자는 여전히 `createMany` 경유(두 표면 병존). preference/channel 계산은 현행 설계상 호출자 책임 유지(spec §1 표).
- [x] 알림 이메일 발송 경로 — **PR2 완료** (`MailService.sendNotificationEmail` 단일 범용 템플릿 + `NotificationsService.dispatchEmails` 가 `channel∈{email,both}` row 발송). type별 템플릿→단일 downscope, spec 정정은 `plan/in-progress/spec-update-notifications-email.md`(planner) 위임.
- [x] `email_sent_at` setter — **PR2 완료** (발송 성공 시 `notificationRepository.update(id,{emailSentAt})`, 실패 시 NULL 유지, best-effort).
- [x] WebSocket `notification.new` emit — **PR1 완료** (`WebsocketService.emitNotificationEvent` → `notifications:<userId>`, best-effort). §4.6 의 `notification.read`/`notification.dismissed` 멀티 디바이스 동기화는 별도 follow-up 으로 잔존. ⚠ 자매 plan `spec-sync-websocket-protocol-gaps.md` §4.4 항목도 동기 `[x]`. spec 본문 "Planned" 배지 flip 은 `plan/in-progress/spec-update-notifications-ws-emit.md`(planner) 위임.
- [x] type `execution_failed` 발사 — **PR3 완료** (`ExecutionEngineService.dispatchExecutionFailedNotification`, top-level 실행 FAILED 시 owner+executor). spec 배지 flip 은 `plan/in-progress/spec-update-notifications-firing.md`(planner) 위임.
- [x] type `schedule_failed` 발사 — **PR3 완료** (`ScheduleRunnerService.dispatchScheduleFailedNotification`, enqueue/파라미터 실패 시 owner).
- [ ] type `marketplace_update` 발사 — 마켓플레이스 모듈 도입 시. **마켓플레이스 backlog 차단 — 범위 밖(잔여).**
- [x] type `team_invite` 발사 — **PR3 완료** (`WorkspaceInvitationsService.dispatchTeamInviteNotification`, 기존 가입자(비멤버) 초대 시 channel=both).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/data-flow/data-flow__8-notifications.md 참조.
- ~~별도(코드 버그) 추적 필요: `AlertsEvaluatorService` 가 발사하는 `alert_<rule.type>` 동적 type 값이 V052 의 notification.type CHECK 제약 허용 목록에 없음~~ — ✅ **해소**: `V070__notification_type_alert_breach.sql` 가 `alert_failure_rate`/`alert_duration`/`alert_llm_cost` 를 CHECK 허용목록에 추가.
