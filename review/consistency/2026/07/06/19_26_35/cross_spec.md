### 발견사항

- **[INFO]** "owner" 용어 중의성 (workflow.createdBy vs WorkspaceMember.role='owner')
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `execution_failed`/`schedule_failed` 행 ("수신자: 워크플로우 owner + 실행자"), 코드 주석(`execution-engine.service.ts` `dispatchExecutionFailedNotification`, `schedule-runner.service.ts` `dispatchScheduleFailedNotification`)
  - 충돌 대상: `spec/1-data-model.md` §2.3 `WorkspaceMember.role` enum(`owner / admin / editor / viewer`) — "owner" 는 이미 워크스페이스 RBAC 역할명으로 점유
  - 상세: 새 알림 로직이 "워크플로우 owner" 라고 부르는 대상은 실제로는 `Workflow.created_by`(생성자 FK)이며, 워크스페이스 RBAC role `owner` 와는 무관한 별개 개념이다. 두 "owner" 가 같은 문서/코드베이스에서 다른 의미로 쓰이면서 명명이 겹쳐 향후 RBAC 문서와 교차 참조 시 혼동 소지가 있다(실제 로직 오류는 없음 — `WorkflowRepository.findOne().createdBy` 를 그대로 사용해 정확히 동작).
  - 제안: 코드 변경은 불필요. spec 표현을 "워크플로우 생성자(`created_by`)" 등으로 명시하거나, 최소한 첫 등장 시 "(created_by, RBAC role 과 무관)" 각주를 추가해 향후 독자의 혼동을 예방 권장(비차단).

### 요약

`spec/data-flow/8-notifications.md` 가 새로 문서화한 `execution_failed`/`schedule_failed`/`team_invite` 발사 로직은 데이터 모델(`1-data-model.md §2.19` Notification.type enum, `Execution.executed_by`/`parent_execution_id`, `Workflow.created_by`), DB 제약(V070 CHECK 화이트리스트에 세 타입 모두 이미 포함), 딥링크 계약(`2-navigation/_layout.md §3.1` href.ts 매핑 — `execution_failed`·`schedule_failed` → `/workflows/<resource_id>`, resource_id=workflow id), 채널 기본값(`2-navigation/9-user-profile.md §5.1` "워크플로우 실행 실패"/"스케줄 실행 실패" = 인앱+이메일 = `channel='both'`)과 전부 정합한다. `team_invite` 의 기존 가입자 이메일 중복 발송 이슈는 target 문서 스스로 "UX 재검토 대기(`spec-update-notifications-firing.md`)" 로 명시 추적 중이며 별도 plan 에 위임돼 있어 cross-spec 모순이 아니다. RBAC(초대 Admin+ 권한)·상태 전이(§3~§4 dismiss/read)·요구사항 ID 체계와도 충돌이 발견되지 않았다. 유일한 지적 사항은 "owner" 라는 어휘가 `WorkspaceMember.role='owner'` 와 `Workflow.created_by` 두 곳에 느슨하게 겹쳐 쓰이는 INFO 수준 명명 이슈뿐이다.

### 위험도

NONE
