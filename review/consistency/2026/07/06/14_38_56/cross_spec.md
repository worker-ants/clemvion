### 발견사항

- **[INFO]** WS emit 도입 시 `notifications:` authorizer 사전 배치 전제와 정합 확인 필요 (실질 충돌 아님)
  - target 위치: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` PR1 항목 (`WebsocketService.emitNotificationEvent`)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §3.3 Rationale ("`notifications:` — emit 미구현인데도 authorizer 선제 배치")
  - 상세: 실제 충돌은 없음 — 오히려 §3.3 Rationale 이 정확히 예견한 "emit 이 후행 phase 에서 도입되는" 시점이 본 PR1 이다. `channelAuthorizers` 에 `notifications:{userId}` JWT `sub` 일치 검증이 이미 등록돼 있으므로(코드 확인: `codebase/backend/src/modules/websocket/websocket.gateway.ts`) PR1 구현 시 그 가드가 실제로 걸리는지(인가 없이 접근 불가한지) 통합 테스트로 확인만 하면 된다.
  - 제안: impl-prep 단계에서 `WebsocketService.emitNotificationEvent` 구현 후 §4.4 "미구현 (Planned)" 배지를 걷어내는 spec 후속 갱신을 developer 완료 후 project-planner 에게 위임할 것 (구현 완료 시 `implemented` 로 status 승격 + `spec/5-system/6-websocket-protocol.md` §4.4 표기 정합).

- **[INFO]** PR1 완료 시 `spec/data-flow/8-notifications.md` 여러 "미구현 (Planned)" 배지 갱신 필요 (사전 알림)
  - target 위치: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` PR1 범위
  - 충돌 대상: `spec/data-flow/8-notifications.md` Overview / §1 다이어그램·표 / §2.2
  - 상세: PR1 이 `notify()` 단일 표면과 WS emit 을 구현하면 현재 "구현 현황 주의" 단락과 §1 표의 "미구현 (Planned)" 두 항목(단일 `notify()` 표면, WS emit)이 stale 해진다. 충돌이라기보다 예정된 후속 작업이지만, developer 는 `spec/` read-only 라 impl-done 시 문서를 직접 못 고치므로 project-planner 위임이 필요함을 미리 상기.
  - 제안: PR1 코드 PR 병합 후 반드시 project-planner 세션으로 `spec/data-flow/8-notifications.md` §Overview/§1/§2.2 의 Planned 배지를 걷어내고, plan 파일의 "미구현 항목" 체크박스 중 해당 2개(`notify()`, WS emit)를 완료 처리할 것. `email_sent_at`/이메일 발송(PR2), 신규 발사 소스 3종(PR3)은 여전히 미완이므로 그대로 잔존.

- **[INFO]** PR3 로 defer 되는 `team_invite` 발사와 초대 RBAC 스펙 간 정합은 현시점 영향 없음
  - target 위치: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` PR3 항목
  - 충돌 대상: 워크스페이스 초대 관련 스펙 (`spec/2-navigation/9-user-profile.md` 등)
  - 상세: 본 PR(PR1) 범위 밖이며 코드 변경도 없어 현재 크로스스펙 충돌 없음. PR3 착수 시 "해당 이메일이 이미 가입자인 경우에만 in-app+이메일 발사" 조건이 초대 플로우 문서와 상충하지 않는지 그 시점에 재검토 필요.

### 요약

이번 target(PR1: `NotificationsService.notify()` 단일 적재 표면 + `WebsocketService.emitNotificationEvent` WS emit)은 `spec/data-flow/8-notifications.md` 자체를 수정하지 않고, 이미 그 문서가 "to-be 설계"로 명시해 둔 두 개의 "미구현 (Planned)" 항목(단일 notify() 표면, `notification.new` WS emit)을 그대로 구현하는 작업이다. 데이터 모델(Notification 엔티티, `dismissed_at`/`is_read` 상태 전이), API 계약(dismiss/mark-all-read endpoint), WebSocket 채널(`notifications:{userId}`, `notification.new` 이벤트명, authorizer 사전 배치)까지 모두 `spec/5-system/6-websocket-protocol.md` · `spec/1-data-model.md` · `spec/data-flow/8-notifications.md` 세 문서 간에 이미 정합적으로 기술돼 있으며, 4개 기존 호출자(`background-execution.processor`, `alerts-evaluator.service`, `integration-expiry-scanner.service`, `integration-action-required-notifier.service`)의 `createMany` 사용도 코드와 spec 이 일치함을 확인했다. EIA 의 "Outbound Notification"(Trigger.notification_health/notification_secret_v2)은 이름은 유사하지만 spec 이 이미 명시적으로 완전히 별개 네임스페이스로 분리해 두었고 이번 변경과 무관하다. 실질적 CRITICAL/WARNING 급 모순은 발견되지 않았으며, 유일한 후속 주의사항은 PR1 완료 후 spec 문서의 "미구현 (Planned)" 배지 및 plan 체크박스를 project-planner/developer 가 갱신해야 한다는 절차적 사항(INFO)뿐이다.

### 위험도
NONE
