### 발견사항

- **[INFO]** `team_invite` 이메일 2통 side-effect 는 OPEN 으로 별도 추적 중 — Rationale 미기재 자체는 문제 아님
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행 ("⚠ 초대 링크 이메일과 별개라 기존 가입자는 이메일 2통 — UX 재검토 대기")
  - 과거 결정 출처: 없음 (신규 발견된 side-effect, 기각된 대안 아님)
  - 상세: `WorkspaceInvitationsService.dispatchTeamInviteNotification` 이 기존 가입자에게 `channel='both'` 알림을 발사하면서, 기존 초대 링크 이메일(`dispatchEmail`)과 별개로 이메일이 2통 발송된다. `spec/2-navigation/9-user-profile.md §5.1` 은 "팀 초대 = 인앱+이메일, 사용자 변경 불가(항상 발송)" 이므로 코드는 그 spec 문구를 문자 그대로 구현한 것이고, 이는 "새 Rationale 없는 결정 번복"이 아니라 **아직 결론 나지 않은 신규 트레이드오프**다. `plan/in-progress/spec-update-notifications-firing.md` 가 이를 미해결 체크박스로 명시 추적 중이며 planner 결정을 기다리는 중이다.
  - 제안: 현재 상태(추적 문서에 OPEN 명시)로 충분하다. 다만 이 항목이 장기간 미결로 남으면 §5.1 표의 "팀 초대: 사용자 변경 불가(항상 발송)" 자체를 재검토 대상에 포함할지 plan 에 명시하는 것을 권장.

- **[INFO]** `resource_type='execution'` 키공간을 `background_failed` 옛 fallback 과 공유 — 이미 문서화된 의도적 결정
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `execution_failed` 행 및 §2.1 `notification` 리소스 attribution 조회 행
  - 과거 결정 출처: 해당 없음(신규 설계 결정) — 다만 `background-runs.service.ts:398-399` 주석 및 본 target 문서 §1.1/§2.1 이 상호 참조로 일관 기록.
  - 상세: `dispatchExecutionFailedNotification` 이 `resourceType='execution'`/`resourceId=executionId` 를 쓰는데, 이는 `background_failed` 의 옛 NodeExecution fallback 이 쓰던 것과 동일 키 공간이다. 코드·spec·plan(`spec-sync-data-flow-8-notifications-gaps.md` "resource_type 공유 주의") 세 곳 모두에서 이 중첩을 명시적으로 인지하고, 현재 유일한 소비처(`background-runs.service.findByResource`)가 `background_run` 스코프로 한정되어 실질 충돌이 없음을 확인해 두었다.
  - 제안: 현행 문서화 수준으로 충분. 향후 `execution` 스코프의 `findByResource` 소비처가 추가될 때 이 각주를 다시 확인하도록 재차 상기만 하면 됨(이미 §2.1에 각주 존재).

### 요약

target(`spec/data-flow/8-notifications.md`)과 관련 구현(execution_failed/schedule_failed/team_invite 발사)은 기존 Rationale 이 명시한 원칙들 — best-effort 알림 발사(실패가 원 흐름을 되돌리면 안 됨, "Email 실패는 warn 만" Rationale과 동일 패턴), `user.notification_preferences` 부재 시 채널 하드코딩(§5.1 "미구현 (Planned)" 상태와 정합), `resource_type` 공유에 대한 명시적 각주 — 을 그대로 계승하고 있으며, 기각된 대안을 재도입하거나 합의 원칙을 우회하는 지점은 발견되지 않았다. 채널 정책(channel='both')도 `spec/2-navigation/9-user-profile.md §5.1` 이 이미 선언한 기본값과 정확히 일치해, 과거 결정을 뒤집은 것이 아니라 그 결정을 코드로 실현한 것이다. 유일하게 남은 이슈는 `team_invite` 의 이메일 2통 side-effect인데, 이는 새로 발견된 트레이드오프로서 plan 문서에 OPEN 으로 명시 추적되고 있어 "무근거 번복"에 해당하지 않는다.

### 위험도
NONE
