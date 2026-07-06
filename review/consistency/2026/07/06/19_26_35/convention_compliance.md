# 정식 규약 준수 검토 — spec/data-flow/8-notifications.md

검토 모드: --impl-done, diff-base=origin/main, code_areas=execution-engine/schedules/workspaces notification 발사 경로

## 발견사항

- **[INFO]** `team_invite` 알림의 `resourceType`/`resourceId` 가 딥링크에서 실사용되지 않음
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행 (및 대응 코드 `workspace-invitations.service.ts` `dispatchTeamInviteNotification`)
  - 위반 규약: 명시적 위반은 아님. 관련 규약은 `spec/2-navigation/_layout.md §3.1` 딥링크 매핑 표 — `team_invite` → `/profile` (id 불요) 로 명시.
  - 상세: 코드는 `resourceType: 'workspace_invitation'`, `resourceId: saved.id` 를 채워 발사하지만, `codebase/frontend/src/lib/notifications/href.ts` 의 `team_invite` 분기는 `resourceId` 와 무관하게 무조건 `/profile` 로 라우팅한다. 즉 이 필드들은 현재 UI 소비 경로에서 죽은 값이다. `execution_failed`/`schedule_failed` 가 "resource_id=workflow.id 여야 딥링크가 정합" 이라는 강한 계약(§1.1 명시, href.ts 주석)을 갖는 것과 대비되면 혼동 소지가 있다.
  - 제안: 규약 위반은 아니므로 조치 불필요. 다만 `team_invite` 행에 "resourceId 는 현재 라우팅에 미사용, 감사/추적 목적으로만 채움" 같은 1줄 주석을 §1.1 표 또는 각주에 추가하면 향후 리더가 `execution_failed`/`schedule_failed` 와 동일한 딥링크 의존이 있다고 오해하는 것을 방지할 수 있다 (선택적 INFO).

- **[INFO]** notify()/createMany() 시그니처 표기가 diagram 에서 snake_case, 실제 TS 시그니처는 camelCase
  - target 위치: `spec/data-flow/8-notifications.md` §1 mermaid 시퀀스 다이어그램의 `notify()/createMany([{workspaceId, ... resource_type?, resource_id?, ...}])` 표기
  - 위반 규약: 없음 (conventions 문서에 이 표기를 규율하는 항목 없음). 참고로 실제 `NotificationsService.notify`/`createMany` 시그니처(`notifications.service.ts`)는 `resourceType?`/`resourceId?` camelCase.
  - 상세: 다이어그램 한 줄 안에 camelCase 필드(`workspaceId`, `userId`, `type`, `title`, `message`, `channel`)와 snake_case 필드(`resource_type?`, `resource_id?`)가 혼재한다. 이 부분은 본 PR(diff) 이 건드린 범위가 아니라 기존 spec 서술이며, 오늘 diff 는 이 표기를 변경하지 않았다.
  - 제안: 본 PR 스코프 밖이므로 이번 검토에서는 차단 사유 아님. 후속 spec 정리 시 `resourceType?`/`resourceId?` 로 통일 권장.

- **[INFO]** `execution_failed`/`schedule_failed`/`team_invite` type 값 표기 형식 확인 결과 — 정합
  - target 위치: `spec/data-flow/8-notifications.md` §1.1
  - 확인: `spec/conventions/audit-actions.md` 의 `<resource>.<verb>` dot-notation 은 **감사 로그(`AuditLog.action`) 전용** 명명 규약이며, `notification.type` 컬럼에는 적용 범위가 아니다. `spec/1-data-model.md` §Notification 엔티티의 `type` enum 정의(`execution_failed / background_failed / schedule_failed / integration_expired / integration_action_required / marketplace_update / team_invite`)가 이미 snake_case 단일 토큰 명명을 쓰고 있고, 이번 diff 가 추가한 `execution_failed`/`schedule_failed`/`team_invite` 발사 로직은 기존 enum 값을 그대로 재사용한 것이라 새로운 명명 결정이 아니다. **CRITICAL/WARNING 없음.**

- **[INFO]** `resourceType: 'workflow'` / `resourceType: 'workspace_invitation'` 문자열이 DB 테이블명과 일치 — 정합
  - target 위치: `spec/data-flow/8-notifications.md` §1.1, §2.1 (`resource_type` 컬럼 설명: "workflow, integration 등")
  - 확인: `workspace_invitation` 은 실제 테이블명(`spec/data-flow/12-workspace.md` 다수 참조)과 동일 토큰이며, 기존 `resource_type` 값 예시("workflow, integration")의 패턴(테이블명 그대로 사용)을 그대로 따른다. 명명 규약 위반 없음.

- **[INFO]** channel='both' 하드코딩과 §5.1 표의 정합
  - target 위치: diff 3곳 (`dispatchExecutionFailedNotification`, `dispatchScheduleFailedNotification`, `dispatchTeamInviteNotification`) 및 target spec §1.1
  - 확인: `spec/2-navigation/9-user-profile.md §5.1` 표가 "워크플로우 실행 실패"/"스케줄 실행 실패"/"팀 초대" 모두 기본 채널 "인앱 + 이메일"(=`both`)로 명시하며, "팀 초대"는 "사용자 변경 불가(항상 발송)"로 명시 — 코드의 `channel: 'both'` 고정과 완전히 정합한다. 위반 없음.

## 요약

`spec/data-flow/8-notifications.md` 는 이번 diff(`execution_failed`/`schedule_failed`/`team_invite` 발사 구현)와 관련해 검토한 5개 관점(명명·출력 포맷·문서 구조·API 문서·금지 항목) 전 영역에서 정식 규약 위반이 발견되지 않았다. `notification.type` 명명은 `audit-actions.md` 의 dot-notation 규약 적용 대상이 아니며(그 규약은 감사 로그 전용), `spec/1-data-model.md` 의 기존 enum 값을 그대로 재사용한 것이라 신규 명명 결정도 아니다. `resourceType`/`channel` 값은 `spec/2-navigation/_layout.md §3.1` 딥링크 계약, `spec/2-navigation/9-user-profile.md §5.1` 채널 기본값과 모두 정합한다. 문서 구조(Overview/본문/Rationale)도 형식을 유지하고 있으며, `spec/data-flow/**` 는 `spec-impl-evidence.md` 에 의해 frontmatter 의무 대상에서 명시적으로 제외되어 있어 frontmatter 부재도 규약 위반이 아니다. `team_invite` 의 `resourceId` 가 현재 UI 딥링크에서 미사용(무시)이라는 점만 INFO 로 기록했으나 이는 규약 위반이 아니라 문서 가독성 제안 수준이다.

## 위험도

NONE
