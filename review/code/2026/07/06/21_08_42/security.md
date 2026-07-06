# 보안(Security) 코드 리뷰

## 리뷰 대상
- `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts`
- `codebase/backend/src/modules/workspaces/workspace-invitations.service.spec.ts`
- `plan/complete/spec-update-notifications-firing.md`
- `review/consistency/2026/07/06/20_57_56/**` (checker 산출물, 코드 아님)
- `spec/2-navigation/9-user-profile.md`, `spec/data-flow/8-notifications.md` (spec 문서)

커밋 요지: 기존 가입자(비멤버)를 팀 워크스페이스에 초대할 때 발사되는 `team_invite` 알림 record 의
`channel` 값을 `'both'`(인앱+이메일)에서 `'in_app'`(벨만)으로 하향. 이메일 발송 책임을 초대 링크
이메일(`dispatchEmail`/`sendWorkspaceInvitationEmail`, 수락 토큰 포함) 단독으로 일원화해 중복
이메일 발송 UX 를 해소하는 목적. 실질 코드 diff 는 문자열 리터럴 1곳(`'both'` → `'in_app'`) +
주석/docstring, 테스트 단언 동기화, spec 문서 갱신뿐이다.

## 발견사항

- **[INFO]** 알림 이메일 채널 축소는 보안 취약점이 아니라 UX 결정
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts:1023` (`channel: 'in_app'`)
  - 상세: 변경 자체는 인가·인증·인젝션·시크릿 관리 로직에 영향을 주지 않는다. `dispatchTeamInviteNotification` 은 여전히 `existingUser.id` (자기 자신이 아닌 대상 사용자)에게만 알림을 적재하고, `notify()` 호출 실패는 `catch` 로 삼켜 초대 생성 트랜잭션에 영향을 주지 않는(best-effort) 기존 패턴을 그대로 유지한다.
  - 제안: 조치 불요.

- **[INFO]** 초대 흐름의 기존 보안 통제(변경되지 않음)가 여전히 유효함을 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` 전체
  - 상세: 이번 diff 로 인해 변경되지 않았으나 재확인한 항목들 — (1) `invite()` 진입 시 `assertAdmin` 으로 admin/owner 권한 검증(라인 896), (2) `generateToken()` 이 `crypto.randomBytes(48)` 로 CSPRNG 기반 64자 base64url 토큰 생성(예측 불가), (3) `accept()` 에서 `user.email.toLowerCase() !== invitation.email` 이메일 일치 강제, (4) 동시성 accept 는 `UPDATE ... WHERE accepted_at IS NULL` 원자적 가드로 이중 사용 방지, (5) TypeORM QueryBuilder 파라미터가 전부 named-parameter 바인딩(`where('id = :id AND accepted_at IS NULL', { id: invitationId })`)이라 SQL 인젝션 벡터 없음, (6) 에러 메시지가 스택트레이스나 내부 상세를 노출하지 않고 사용자 대상 한국어 메시지 + `code` 필드만 반환. 이번 변경 범위 밖이지만 회귀 없음을 확인.
  - 제안: 조치 불요 (참고용 확인).

- **[INFO]** 알림 이메일 자체는 여전히 `channel` 값에 따라 `sendNotificationEmail` 로 발송될 수 있음(다른 알림 타입에는 영향 없음)
  - 위치: `spec/data-flow/8-notifications.md` diff, `NotificationsService.notify()` (본 diff 범위 밖)
  - 상세: `team_invite` 만 `in_app` 으로 하향되고 `execution_failed`/`schedule_failed` 등 다른 알림 타입은 여전히 `channel: 'both'` 를 사용한다는 점이 spec 에 명시되어 있다. 이는 의도된 선택적 축소이며 다른 알림 경로의 이메일 발송 로직(그 자체의 시크릿/인젝션 이슈 유무)은 이번 diff 범위 밖이라 별도 검토 대상이 아니다.
  - 제안: 조치 불요.

## 요약
이번 변경은 `team_invite` 알림 record 의 `channel` 필드 값을 문자열 리터럴 수준에서 `'both'` → `'in_app'` 으로 바꾸는 단일 라인 변경이며, 동반된 diff 는 docstring/주석·테스트 단언·spec 문서 동기화뿐이다. 인증(`assertAdmin`), 토큰 생성(CSPRNG `randomBytes(48)`), 이메일 일치 검증, 동시성 가드(원자적 UPDATE), 파라미터 바인딩(SQL 인젝션 없음), 에러 메시지 노출 범위 등 기존 보안 통제 요소는 모두 그대로 유지되며 이번 변경으로 새로 도입되거나 약화된 인증/인가/인젝션/시크릿 관련 위험은 확인되지 않았다. 하드코딩된 시크릿, 안전하지 않은 암호화, 입력 검증 누락 등 OWASP Top 10 관점의 신규 이슈도 없다.

## 위험도
NONE
