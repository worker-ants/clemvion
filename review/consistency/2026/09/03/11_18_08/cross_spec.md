# Cross-Spec 일관성 검토 — `spec/5-system/`(change-password 실패 코드 형제 정렬)

## 검토 대상 요약

`POST /users/me/change-password` 의 현재-비밀번호 재확인 실패 코드를 단일 `INVALID_PASSWORD`(OAuth-only 미설정과 불일치를 구분 못 함)에서, 형제 흐름(`AuthService.verifyPasswordForUser`, `SessionsService.verifyReauth`)과 동일한 `PASSWORD_REQUIRED`(401, 미설정)/`PASSWORD_INVALID`(401, 불일치) 2종으로 분리했다. `INVALID_PASSWORD` 문자열은 `login_history.failure_reason` 감사값(로그인 실패, `AuthService.login`)으로만 남는다.

- 코드: `codebase/backend/src/common/utils/password.util.ts`(`PASSWORD_VERIFY_CODES` 신설) · `auth.service.ts` · `sessions.service.ts` · `users/users.service.ts`
- spec: `spec/5-system/1-auth.md`(§2.3 note ×2, §5 note, Rationale 2.3.C) · `spec/5-system/3-error-handling.md`(§1.2 표에서 `INVALID_PASSWORD` 행 제거, §1.2.1 표·헤더 갱신) · `spec/conventions/error-codes.md`(§3 historical-artifact 행 제거 → §5 rename 이력에 등급 B 행 신설) · `spec/2-navigation/9-user-profile.md`(§1/§2.1/§2.2 OAuth-only 안내 note)
- 관련 plan: `plan/complete/auth-change-password-oauth-only-code-split.md`, `plan/complete/spec-draft-change-password-code-alignment.md`

## 발견사항

교차 검증 결과 CRITICAL/WARNING 급 모순은 발견되지 않았다. 확인한 항목:

1. **`INVALID_PASSWORD` 잔존 참조 전수 확인** — `spec/` 전체를 grep 한 결과 남은 4곳(`1-data-model.md:710`, `3-error-handling.md` 2곳, `conventions/error-codes.md` 2곳, `data-flow/2-auth.md:76`)은 전부 **로그인 실패 감사값**(`login_history.failure_reason`) 레이어에 대한 서술이며, 각 서술이 "이는 wire 코드가 아니라 감사값" 이라고 명시적으로 구분하고 있어 모순 없음.
2. **wire 코드 명명 충돌** — `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 문자열을 코드베이스·spec 전체에서 grep 했을 때, `1-auth.md`/`3-error-handling.md`/`error-codes.md`/`9-user-profile.md`/테스트 파일 외 다른 도메인(webhook·EIA·KB/Graph RAG·node `ErrorCode` enum 등)에서 동명 재정의가 없음 — 근접 명명 4종(`INVALID_PASSWORD`≠`PASSWORD_INVALID`≠`PASSWORD_REQUIRED`≠`REAUTH_REQUIRED`) 구분도 각 문서에서 일관되게 유지.
3. **`error-codes.md` §3 ↔ §5 정합** — §3 historical-artifact 레지스트리에서 `INVALID_PASSWORD` 행이 제거되고 §5 rename 이력에 등급 B(`INVALID_PASSWORD`→`PASSWORD_REQUIRED`/`PASSWORD_INVALID`) 행이 신설됐다. §5 상단 "현재 B 등급 행은 2건" 카운터도 이 신설을 반영해 갱신됨 — 카운터와 실제 행 수가 일치.
4. **plan 링크 정합** — `error-codes.md:175` 의 plan 링크가 `../../plan/complete/auth-change-password-oauth-only-code-split.md` 로 갱신되어 있고, `git status` 상 해당 plan 파일이 실제로 `plan/complete/` 로 이동한 상태와 일치.
5. **프론트엔드 계약 영향 부재** — `codebase/frontend/src` 전체에서 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD` 코드값으로 분기하는 지점이 없음(전수 grep 0건) — spec 이 주장하는 "wire breaking 이나 자사 클라이언트 영향 없음" 진술과 실측이 일치. change-password 페이지는 서버 `message` 를 그대로 노출하는 방식이라 코드값 변경에 영향받지 않음.
6. **사용자 문서(mdx) 정합** — `password-and-sessions.mdx`/`.en.mdx` 가 "OAuth-only 계정도 forgot-password → reset-password 로 비밀번호를 추가할 수 있다" 로 갱신되어 `1-auth.md §1.1.A`·`9-user-profile.md §2.2` 서술과 일치. e2e(`users-change-password.e2e-spec.ts`)·unit(`sessions.service.spec.ts`) 신규 테스트도 리터럴 값(`'PASSWORD_REQUIRED'`/`'PASSWORD_INVALID'`)으로 코드값을 직접 단언해 spec 서술과 실제 wire 응답이 일치함을 확인.
7. **RBAC·상태 전이·계층 책임** — 본 변경은 에러 코드 분리에 한정되며 RBAC 매트릭스(§3), `user.password_changed` 감사 워크스페이스 귀속 규칙(§4.1.B), 세션 revoke/재발급 정책(Rationale 2.3.C)을 변경하지 않았고 해당 절 서술과도 충돌 없음.

INFO 급으로 남길 만한 사항도 없다 — 근접 명명 리스크가 이미 각 문서에서 명시적으로 각주 처리되어 있고, 은퇴 이력·등급 B 인수 근거·잔존 감사값 레이어 구분이 `1-auth.md`/`3-error-handling.md`/`error-codes.md` 세 문서에서 표현만 다를 뿐 동일한 사실을 서술하고 있어 추가 동기화가 필요하지 않다.

## 요약

이번 변경은 `POST /users/me/change-password` 실패 코드를 형제 흐름과 정렬하는 좁은 범위의 수정이며, spec 저자가 이미 영향 범위(§1.2 카탈로그, §1.2.1 공용 등재, error-codes.md §3/§5, user-profile.md 안내 문구, mdx 사용자 문서, e2e/unit 테스트)를 스스로 전수 갱신해 두었다. `spec/` 전체·`codebase/frontend`·`codebase/backend` 대상 grep 으로 재검증한 결과 잔존 `INVALID_PASSWORD` 참조는 모두 의도된 별개 레이어(로그인 감사값)이고, 신규 코드값의 명명 충돌·plan 링크 broken-reference·프론트엔드 wire 계약 파손도 발견되지 않았다. Cross-Spec 관점에서 이 target 은 다른 영역과 모순 없이 정합적이다.

## 위험도

NONE
