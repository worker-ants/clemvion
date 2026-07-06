### 발견사항

- **[CRITICAL] `execution_failed` / `schedule_failed` 알림 채널이 `2-navigation/9-user-profile.md §5.1` 의 기본 채널 정의와 모순**
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 (target 문서 자체는 아직 미갱신 — 구현 diff 상 `ExecutionEngineService.dispatchExecutionFailedNotification` / `ScheduleRunnerService.dispatchScheduleFailedNotification`)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §5.1 "알림 유형별 채널" 표 — "워크플로우 실행 실패" · "스케줄 실행 실패" 행이 **기본 채널 = "인앱 + 이메일"**, "사용자 변경 가능 = O" 로 명시하고, 주석에서 "채널별 on/off 는 미구현(Planned)이라 **현재는 표의 기본 채널로 고정 발송된다**" 라고 못박음. 즉 §5.1 은 "toggle 기능이 없는 지금 단계에서는 이 두 type 이 `channel='both'` 로 고정 발사돼야 한다" 는 규범이다.
  - 상세: 실제 구현(diff)은 두 type 모두 `channel: 'in_app'` 하드코딩이다 (`execution-engine.service.ts:4461`, `schedule-runner.service.ts:234`). `integration_expired`/`integration_action_required` 는 `prefs.integrationExpiryEmail` 을 읽어 `in_app`/`both` 를 실제로 계산하는 반면, 이번 PR3 두 type 은 그런 계산 없이 in_app 고정이라 §5.1 이 규정한 "기본값 = 인앱+이메일" 을 충족하지 못한다. `team_invite` 는 `channel: 'both'` 로 §5.1("팀 초대: 인앱+이메일, 항상 발송")과 정합 — 3종 중 2종만 어긋난다.
  - 제안: 두 갈래 중 하나를 planner 가 명시 결정: (a) 코드를 `channel: 'both'` 로 맞춘다 (이메일 발송 인프라는 PR2 로 이미 존재하므로 즉시 가능) — 이 경우 spec-update 플랜(`plan/in-progress/spec-update-notifications-firing.md`)에 "channel=both 로 발사" 문구를 flip 목록에 추가. 또는 (b) §5.1 표를 "현재는 in_app 고정, 이메일은 후속" 으로 하향 정정. **developer 구현이 이미 §5.1 대비 규범 위반 상태로 머지 대기 중**이므로 spec-update 플랜에 이 항목이 반드시 포함돼야 한다 (현재 플랜 체크리스트엔 channel 불일치 항목이 없음 — 누락).

- **[WARNING] `spec/data-flow/8-notifications.md` §1.1 "미구현 (Planned)" 배지가 구현 diff 로 stale**
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표의 `execution_failed`·`schedule_failed`·`team_invite` 3행("미구현 (Planned)" 표기 + "현재 어떤 코드도 본 type 발사 안 함" 각주)
  - 충돌 대상: 본 diff (`execution-engine.service.ts`, `schedule-runner.service.ts`, `workspace-invitations.service.ts`) 가 세 type 모두 실제로 발사 코드를 추가
  - 상세: spec 본문 텍스트("현재 어떤 코드도 본 type 발사 안 함")가 이제 사실과 다르다. 다만 이는 이미 `plan/in-progress/spec-update-notifications-firing.md` (planner 소유, unstarted) 로 추적 중이며 developer 는 spec read-only 라 의도된 지연이다 — CRITICAL 로 격상하지 않음.
  - 제안: 위 CRITICAL 항목의 channel 불일치 결정과 함께 같은 spec-update 플랜에서 일괄 flip. `/consistency-check --spec` 통과 후 status 승격.

- **[INFO] `resource_type='execution'` 키공간이 `background_failed` 의 NodeExecution fallback 과 공유됨 — 문서화 필요**
  - target 위치: `execution-engine.service.ts` `dispatchExecutionFailedNotification` (`resourceType: 'execution', resourceId: execution.id`)
  - 충돌 대상: `spec/data-flow/8-notifications.md` §2.1 "리소스 attribution 조회" 행 — `background-runs.service.ts` 가 `findByResource('background_run', …)` 스코프로만 소비한다고 명시하나, `background_failed` 의 옛 NodeExecution fallback 도 `resource_type='execution'` 을 쓸 수 있어 향후 `findByResource('execution', …)` 도입 시 두 계열(신규 `execution_failed`, 구 `background_failed` fallback)이 같은 키를 공유하게 된다.
  - 상세: 코드 주석(`execution-engine.service.ts` JSDoc)에 이미 이 사실이 명시돼 있고, 현재 소비처가 `background_run` 스코프로 한정돼 실질적 충돌은 없음 — 데이터 모델 파괴적 충돌은 아니다. spec-update 플랜(`spec-update-notifications-firing.md`)의 "resource_type 공유 주의" 체크박스가 이미 이 각주를 §2.1 에 반영하기로 계획되어 있음(중복 확인, 별도 조치 불요).
  - 제안: 위 spec-update 플랜 처리 시 함께 반영. 별도 대응 불필요.

- **[INFO] `Notification.type` enum·V070 CHECK 제약과의 정합은 이상 없음**
  - target 위치: 코드가 사용하는 `execution_failed` / `schedule_failed` / `team_invite` 리터럴
  - 충돌 대상: `spec/1-data-model.md §2.19` Notification.type enum, `spec/data-flow/8-notifications.md §1.1` 목록
  - 상세: 세 값 모두 두 spec 문서(data-model 열거형, notifications §1.1 표)에 이미 존재하는 명명이라 신규 요구사항 ID/enum 충돌은 없음. DB 마이그레이션도 불요(코드 주석·plan 모두 확인).
  - 제안: 조치 불요.

### 요약
가장 중대한 발견은 신규 `execution_failed`/`schedule_failed` 알림이 `channel: 'in_app'` 으로 하드코딩되어, 이미 존재하는 `spec/2-navigation/9-user-profile.md §5.1` 의 "기본 채널 = 인앱+이메일(고정 발송)" 규범과 정면으로 어긋난다는 점이다 — `team_invite` 는 `both` 로 정합하지만 두 실패 알림 type 은 그렇지 않다. 이 외에는 target 문서(`8-notifications.md`) 자체의 "미구현(Planned)" 배지가 구현으로 인해 stale 해진 것과 `resource_type` 키공간 공유 각주 반영 정도이며, 둘 다 이미 planner 소유의 `spec-update-notifications-firing.md` 플랜으로 추적되고 있다. 다만 그 플랜의 체크리스트에는 channel 불일치 항목이 빠져 있어 반드시 추가돼야 한다. 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 관점에서는 다른 충돌이 발견되지 않았다.

### 위험도
MEDIUM
