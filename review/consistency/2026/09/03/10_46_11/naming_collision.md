# 신규 식별자 충돌 검토 — `spec/5-system/` (change-password 코드 정렬)

## 검토 대상 요약

이번 델타는 `UsersService.changePassword` 의 두 실패 분기(비밀번호 미설정/불일치)가 공유하던
`INVALID_PASSWORD` 를 폐기하고, 형제 흐름(`AuthService.verifyPasswordForUser`)이 이미 쓰던
`PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정렬한 작업이다. 신규 도입 식별자는 다음 셋뿐이다.

- TS 상수 `PASSWORD_VERIFY_CODES` (`codebase/backend/src/common/utils/password.util.ts`)
- 그 값 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 가 `UsersService.changePassword` 발행처로 **확장**(신규 코드 자체는 아님 — 기존 wire 코드의 발행처 추가)
- spec 문서 앵커 `1-auth.md §2.3.D`, `error-codes.md §5` 신규 행

## 확인한 사항 (충돌 없음 확정)

1. **요구사항 ID / 코드 충돌** — `PASSWORD_VERIFY_CODES.REQUIRED`(`'PASSWORD_REQUIRED'`)·`.INVALID`(`'PASSWORD_INVALID'`) 는 기존에 `AuthService.verifyPasswordForUser` 가 이미 발행하던 **동일 의미의 코드**를 그대로 재사용한 것이며, 새 의미를 얹지 않았다. `git grep` 실측: 두 코드의 발행처가 `verifyPasswordForUser`(auth.service.ts) + `verifyReauth`(sessions.service.ts, `.INVALID` 만) + `changePassword`(users.service.ts) 로 정확히 일치, 다른 의미로 쓰이는 곳 없음.
2. **폐기 후보 이름의 선제 충돌 회피 — target 이 스스로 잡아낸 사례**: 최초 검토안(B안)은 `PASSWORD_NOT_SET` 이라는 **새** 코드 신설이었다. 그런데 실측 결과 `'PASSWORD_NOT_SET'` 문자열이 이미 `codebase/backend/src/modules/auth/auth.service.ts:331` 에서 `login_history.failure_reason` 감사값으로 발행되고 있었다(로그인 실패 사유). target 은 이 충돌을 `plan/in-progress/auth-change-password-oauth-only-code-split.md` §"선택지"·`error-codes.md §3`(현재는 §5) 에서 명시적으로 이유로 들어 B안을 기각하고 D안(형제 코드 재사용, 신규 코드 0)을 채택했다 — 이번 리뷰 관점이 정확히 잡아야 했을 충돌을 target 문서 스스로 사전에 식별·회피한 사례다. 결과적으로 wire 코드와 audit 값 사이의 동명 충돌은 **재발하지 않았다**.
3. **`INVALID_PASSWORD` 은퇴 후 잔존 확인** — `git grep`으로 wire 코드(`code: 'INVALID_PASSWORD'`) 는 backend/frontend 전체에서 0건, `login_history.failure_reason` 감사값(`auth.service.ts:348`)으로만 1건 잔존. `spec/conventions/error-codes.md` §3(active 예외 레지스트리)에서는 해당 행이 제거됐고 §5(Rename 이력)에 등급 B 로 이관된 상태와 실제 코드가 일치.
4. **엔티티/타입명 충돌** — `PASSWORD_VERIFY_CODES` 는 backend 전역에서 유일한 이름(`MCP_ERROR_CODES`, `INTEGRATION_LOCALIZED_ERROR_CODES` 등 기존 `*_CODES` 상수와 이름·모듈 모두 겹치지 않음). 테스트 헬퍼 `oauthOnlyUser()`/`codeOf()` 는 `users.service.spec.ts` 로컬 스코프에 한정되며 동일 파일·인접 스펙에 동명 함수 없음.
5. **API endpoint 충돌** — 신규 endpoint 없음. 기존 `POST /api/users/me/change-password` 재사용, diff 도 새 route 추가 없이 서비스 로직만 변경.
6. **이벤트/메시지명 충돌** — 없음. webhook/queue/SSE 이벤트명 변경·신설 없음.
7. **환경변수·설정키 충돌** — 없음.
8. **파일 경로 충돌** — `git diff --diff-filter=A` 결과 신규 파일 0건(전부 기존 파일 수정). `plan/in-progress/auth-change-password-oauth-only-code-split.md` · `plan/in-progress/spec-draft-change-password-code-alignment.md` 두 plan 파일명도 `plan/` 트리 전체에서 유일하며 `plan/complete/` 에 동명 파일 없음.

## 요약

target 델타가 새로 도입하는 식별자는 `PASSWORD_VERIFY_CODES` 상수 하나뿐이고, 그 값(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)은 기존에 다른 흐름이 이미 쓰던 코드를 의미 그대로 재사용한 것이라 새 명명 충돌을 만들지 않는다. 오히려 target 은 최초 검토안이던 `PASSWORD_NOT_SET` 신설이 기존 `login_history.failure_reason` 감사값과 동명 충돌을 일으킬 것을 사전에 식별해 기각하고, wire 코드에서 은퇴하는 `INVALID_PASSWORD` 도 `error-codes.md` §3→§5 로 정확히 이관해 놓았다. API endpoint·이벤트명·환경변수·spec 파일 경로 어느 축에서도 신규 충돌은 발견되지 않았다.

## 위험도

NONE
