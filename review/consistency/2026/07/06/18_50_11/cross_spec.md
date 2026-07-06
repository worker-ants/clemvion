# Cross-Spec 일관성 검토 — `spec/data-flow/8-notifications.md` (impl-done)

## 발견사항

- **[CRITICAL] target 문서가 서술하는 "WS emit 미구현"이 이미 구현된 코드·다른 spec 과 모순**
  - target 위치: `spec/data-flow/8-notifications.md` §Overview("WebSocket emit 도 미구현"), §1 시퀀스 다이어그램(`Note over Svc,WS: 미구현 (Planned)`), §1 단계표(`notification.new` WS emit | 미구현 (Planned)), §2.2(`본 emit 은 follow-up phase 작업 — 현재 WebsocketService 에 해당 메서드 미구현`)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4` ("**미구현 (Planned)**: … `notification.new` 를 emit 하는 backend 코드가 없다 (검색 결과 emit 경로 부재)") 및 실제 코드
  - 상세: `codebase/backend/src/modules/notifications/notifications.service.ts` 의 `emitNew()`(그 안에서 `this.getWebsocket().emitNotificationEvent(...)` 호출)와 `codebase/backend/src/modules/websocket/websocket.service.ts:613` 의 `emitNotificationEvent` 는 이미 구현되어 있고 `notify()`/`createMany()` 양쪽에서 호출된다. git log 상 이 구현은 `69d0f0a24 feat(notifications): notification.new WS emit + notify() 단일 적재 표면 (#836)` 로 **origin/main 에 이미 병합**되어 있다 (이번 PR 의 diff 대상이 아님). 즉 target 문서와 `6-websocket-protocol.md §4.4` 양쪽 모두 실제 코드보다 뒤처진 stale 서술을 유지 중이며, 두 문서가 서로 "미구현"이라고 교차 인용하며 강화하고 있어 다음 독자가 실제 구현 여부를 오판할 위험이 크다.
  - 제안: `8-notifications.md` §Overview/§1/§2.2 의 "WS emit 미구현 (Planned)" 서술을 제거하고 실제 `emitNew`/`emitNotificationEvent` 구현으로 갱신. 동시에 `spec/5-system/6-websocket-protocol.md §4.4` 의 "emit 경로 부재" 서술도 함께 갱신(및 `status: partial` 강등 사유였던 `notification.new` 항목 재검토)해야 두 문서가 다시 정합해진다. 단, 이는 본 PR(firing-sources)이 만든 회귀가 아니라 선행 PR #836 이후 두 문서가 함께 갱신되지 않은 결과이므로, planner 후속 스펙 동기화 작업으로 별도 처리 권장.

- **[CRITICAL] target 문서가 서술하는 "알림 이메일 발송 미구현"이 이미 구현된 코드와 모순**
  - target 위치: `spec/data-flow/8-notifications.md` §Overview("알림 이메일 발송 경로는 미구현 (Planned) … `email_sent_at` setter 도 코드에 없다"), §1 단계표(`이메일 발송 + email_sent_at UPDATE | 미구현 (Planned)`), §2.2(SMTP 행 "미구현 (Planned)"), §3("이메일 발송 라이프사이클은 … **미구현 (Planned)**"), Rationale("Email 실패는 warn 만, 재시도 없음 (Planned)" — "알림 이메일 발송 경로 자체가 현재 미구현 (Planned)")
  - 충돌 대상: 실제 코드 (`notifications.service.ts` `dispatchEmails`/`sendOneEmail`, `mail.service.ts:422 sendNotificationEmail`)
  - 상세: `sendOneEmail` 은 `mailService.sendNotificationEmail(...)` 호출 후 성공 시 `notificationRepository.update(row.id, { emailSentAt: new Date() })` 로 `email_sent_at` 을 실제로 채운다. `dispatchEmails` 는 `channel IN ('email','both')` 필터·per-row `allSettled`·N+1 회피용 `In(...)` 배치 조회까지 모두 구현되어 있다. git log 상 `550f971cf feat(notifications): 알림 이메일 발송 + email_sent_at 라이프사이클 (PR2) (#837)` 로 **origin/main 에 이미 병합**. Rationale 절의 "재시도 없음" 설계 의도 자체는 실제 구현(`sendOneEmail` catch 후 warn 만, 재시도 없음)과 일치하지만, "미구현 (Planned)" 딱지가 여전히 붙어 있어 이미 구현된 정책을 미래형으로 오기술한다.
  - 제안: 위와 동일하게 §Overview/§1/§2.2/§3/Rationale 의 "미구현 (Planned)" 딱지를 제거하고 실장 상태로 승격. 이 gap 은 diff 범위(firing-sources PR) 밖에서 이미 발생해 있던 것이므로, 이번 PR 로 새로 추가되는 `execution_failed`/`schedule_failed`/`team_invite` 서술과 함께 §1.1 표만 갱신하면 문서 나머지의 stale 상태가 더 두드러지는 상황이다.

- **[WARNING] target §1.1 표가 diff 로 구현된 `execution_failed`/`schedule_failed`/`team_invite` 발사를 여전히 "미구현 (Planned)"으로 표기**
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표의 `execution_failed`/`schedule_failed`/`team_invite` 행
  - 충돌 대상: 본 PR 의 diff 자체 (`execution-engine.service.ts::dispatchExecutionFailedNotification`, `schedule-runner.service.ts::dispatchScheduleFailedNotification`, `workspace-invitations.service.ts::dispatchTeamInviteNotification`)
  - 상세: 세 서비스 모두 diff 코드 주석에서 `spec/data-flow/8-notifications.md §1.1` 을 SoT 로 명시 인용하며 구현했으나, target 문서 §1.1 표는 여전히 "미구현 (Planned)" / "(현재 어떤 코드도 본 type 발사 안 함)" / "(현재 미발사)" / "(현재 본 type 의 notification row 미발사)" 로 남아 있다. 이는 target 자기 정합성 문제이자, 동일 문서가 스스로 인용하는 최신 구현과 어긋나는 self-reference 오류다 (cross-spec 관점에서는 §1.1 이 다른 영역 spec — `2-navigation/9-user-profile.md §5.1`, `2-navigation/4-integration.md §11.2` 패턴 — 과 맺는 "구현 상태" 정합성이 깨진 것으로도 나타난다: 후자들은 실제 코드와 일치하게 유지되는데 전자만 뒤처짐).
  - 제안: §1.1 표의 세 행을 "구현됨"으로 갱신하고 실제 소스(`ExecutionEngineService.dispatchExecutionFailedNotification` 등)·발사 조건(top-level only, owner+executor dedup, workflow.createdBy 없으면 skip 등)을 diff 내용대로 반영.

- **[INFO] `channel='both'` 하드코딩과 `9-user-profile.md §5.1` "사용자 변경 가능(O)" 표기의 잠재적 의미 차이**
  - target 위치: 없음(diff 코드 주석) — `execution-engine.service.ts`/`schedule-runner.service.ts` 의 `channel: 'both'` 하드코딩 주석("채널 on/off 토글 미구현이라 기본값 고정")
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §5.1` 표 — "워크플로우 실행 실패"/"스케줄 실행 실패" 행의 "사용자 변경 가능" 컬럼이 `O` 로 표시되지만 같은 섹션 상단 경고 문구가 "미구현 (Planned)" 임을 이미 명시하고 있어 실질 모순은 아니다. 다만 target 문서(`8-notifications.md`)가 이 사실(채널 고정)을 §1.1 신규 행에 명시하지 않아, 두 문서를 함께 읽지 않으면 "언제부터 토글이 가능한가"가 불분명하다.
  - 상세: `9-user-profile.md` 가 이미 "미구현 (Planned)" 경고로 커버하므로 CRITICAL/WARNING 은 아니나, `8-notifications.md §1.1` 신규 행에도 "채널 고정(`both`), 사용자 토글 미구현 — `9-user-profile.md §5.1` 참조" 한 줄을 추가하면 두 문서가 서로를 참조하며 정합 유지가 쉬워진다.
  - 제안: `8-notifications.md §1.1` 표의 `execution_failed`/`schedule_failed` 행에 채널 고정 근거·상호참조 추가.

## 검토 범위에서 배제/충돌 없음으로 확인된 항목

- **데이터 모델**: `Notification.type` enum (`1-data-model.md §2.19`) 에 `execution_failed`/`schedule_failed`/`team_invite` 가 이미 정의돼 있고, diff 는 새 값을 추가하지 않았다 — 데이터 모델 충돌 없음.
- **상태 전이**: `dispatchExecutionFailedNotification` 은 `runExecution` catch 블록에서 `ParkReleaseSignal`(return)·`ExecutionCancelledError`(cancelled, return) 분기를 모두 통과한 뒤 `savedExecution.status = FAILED` 확정 직후에만 호출된다. `5-system/4-execution-engine.md §7.5` 의 rehydration 실패 3케이스(`RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE`)는 별도 `markExecutionCancelled` 경로로 처리되어 `execution_failed` 알림을 오발사하지 않는다 — 상태 전이 충돌 없음.
- **모듈 의존성/순환**: `SchedulesModule`/`WorkspacesModule` 에 추가된 `NotificationsModule` import 는 `NotificationsModule` 이 `MailModule`+`TypeOrmModule.forFeature` 만 의존하므로 순환 없음 (코드 주석의 "순환 무관" 주장 검증됨). `ExecutionEngineModule` 도 이미 `NotificationsModule` 을 import.
- **RBAC/권한**: 이번 diff 는 권한 모델 변경 없음 (알림 발사는 서비스 내부 best-effort 부수효과).

## 요약

이번 diff(execution_failed/schedule_failed/team_invite 알림 발사 추가) 자체는 데이터 모델·상태 전이·모듈 의존성·RBAC 어느 관점에서도 다른 spec 영역과 직접 충돌하지 않는다. 그러나 target 문서 `spec/data-flow/8-notifications.md` 는 이번 PR 이전부터 이미 origin/main 에 병합된 두 개의 선행 기능(WS emit `#836`, 이메일 발송 `#837`)을 "미구현 (Planned)"으로 잘못 서술하고 있었고, 그 stale 서술이 `spec/5-system/6-websocket-protocol.md §4.4` 와 교차 인용되며 서로를 강화하고 있다. 이번 PR 은 그 위에 §1.1 표의 세 신규 type 행마저 실제로는 구현했음에도 "미구현" 그대로 남겨, target 문서의 self-consistency 가 더 악화됐다. 코드 품질·아키텍처 정합성은 양호하나 문서 상태 표기의 정확성이 두 파일에 걸쳐 크게 뒤처져 있어 이번 PR 병합 전(또는 즉각 후속으로) spec 갱신이 필요하다.

## 위험도

HIGH
