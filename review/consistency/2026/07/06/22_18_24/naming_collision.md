### 발견사항

없음.

target 변경 범위(`git diff origin/main -- spec/data-flow/`)는 `spec/data-flow/8-notifications.md` 단일 파일, 42줄 추가/1줄 수정에 국한된다. 실제 diff 내용을 확인한 결과:

- `team_invite` 알림의 `channel` 값을 `both` → `in_app` 로 정정(기존 enum 값 재사용, 신규 값 아님).
- 새 Rationale 서브섹션 `### team_invite 채널 — 이메일 중복 회피 (channel=`in_app`)` 추가 — 이는 신규 heading 이지만 식별자(요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키·파일 경로)가 아니라 문서 섹션 제목이며, `spec/2-navigation/9-user-profile.md:270` 에서 앵커 링크(`#team_invite-채널--이메일-중복-회피-channelin_app`)로 정확히 참조되어 충돌·중복 정의가 없음을 확인했다.
- 본문에서 언급되는 `dispatchTeamInviteNotification`, `sendWorkspaceInvitationEmail`, `sendNotificationEmail` 은 모두 기존 코드(`codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`, `codebase/backend/src/modules/mail/mail.service.ts`)와 기존 spec(`spec/data-flow/12-workspace.md:207`, `spec/2-navigation/9-user-profile.md:266`)에 이미 존재하는 식별자로, target 이 새로 도입한 이름이 아니다.
- 새 요구사항 ID, 새 DTO/엔티티/인터페이스명, 새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새 ENV var·config key, 새 spec 파일 경로는 이 diff 에 전혀 없다.

### 요약
이번 target 변경은 기존에 정의된 `team_invite` 알림의 채널 값 정정(`both`→`in_app`, 기존 enum 재사용)과 그 근거를 설명하는 Rationale 서술 추가에 그치며, 신규 식별자(요구사항 ID·엔티티·endpoint·이벤트·ENV/설정키·파일 경로)를 전혀 도입하지 않는다. 언급된 모든 메서드명·상수명은 기존 코드/spec 과 정확히 일치하고, 새로 추가된 문서 heading 도 다른 문서에서 앵커로 정확히 역참조되어 충돌 소지가 없다. 신규 식별자 충돌 관점에서 문제 없음.

### 위험도
NONE
