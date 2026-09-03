# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

대상 델타: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` (구현 diff: `changePassword` 실패 코드를 `INVALID_PASSWORD`(단일) → 형제 흐름과 동일한 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`(조건별 2종)로 정렬, #1268 후속 `PASSWORD_VERIFY_CODES` 상수 도입).

## 발견사항

없음. 아래는 확인한 교차-영역 지점과 실측 근거다.

- **에러 코드 wire 은퇴가 감사(audit) 레이어와 충돌하지 않는다**: `spec/5-system/3-error-handling.md`·`spec/5-system/1-auth.md`·`spec/conventions/error-codes.md`(§5 rename 이력, 등급 B)가 모두 "`INVALID_PASSWORD`는 wire 코드로는 은퇴했으나 `login_history.failure_reason` 감사값으로는 계속 발행된다"를 동일하게 서술한다. 실측(`grep -rn INVALID_PASSWORD codebase/`)으로도 남은 유일한 wire 발행처는 `auth.service.ts:348`(`AuthService.login` 실패 시 `failureReason: 'INVALID_PASSWORD'`)뿐이고, `changePassword` 경로에는 0건 — spec 서술과 코드가 일치한다. `spec/1-data-model.md:710`·`spec/data-flow/2-auth.md:76`(login_history 시퀀스)도 이 감사값을 그대로 유지해 레이어 구분이 깨지지 않는다.
- **API 계약(`POST /api/users/me/change-password`) 문서가 3곳에서 동일**: `spec/5-system/1-auth.md`(§2.3 note, L339)·`spec/5-system/3-error-handling.md`(§1.2.1 표, L14~15)·`spec/2-navigation/9-user-profile.md`(§2.2 보안 설정 표, L147)가 모두 `PASSWORD_REQUIRED`(401, OAuth-only)·`PASSWORD_INVALID`(401, 불일치)로 일치 서술한다. 코드 diff(`users.service.ts`)와도 정확히 매칭된다.
- **요구사항 ID(에러 코드) 재사용 충돌 없음**: `PASSWORD_REQUIRED`/`PASSWORD_INVALID`는 `AuthService.verifyPasswordForUser`(2FA 비활성화·WebAuthn 관리)·`UsersService.changePassword`가 "같은 의미"로 공유하도록 target 이 명시적으로 설계했고, `SessionsService.verifyReauth`의 `REAUTH_REQUIRED`(400, missing)는 status·발행 헬퍼가 달라 같은 표(§1.2.1) 안에서도 구분 서술돼 있다. 신규 코드가 다른 영역에서 다른 의미로 이미 쓰이고 있는 사례는 없다(신규 코드 자체가 없음 — 기존 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 재사용).
- **frontend 문서(mdx)·코드와의 정합**: `password-and-sessions.mdx`/`.en.mdx`가 "OAuth-only 계정은 비밀번호 추가 가능(forgot-password 경로)"로 갱신됐고, 이는 `1-auth.md §1.1.A`(이미 존재하던 SoT)와 일치한다. frontend 소스에서 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`/`INVALID_PASSWORD` 문자열 분기는 0건(서버 message 를 그대로 노출) — spec 의 "전수 grep 0건" 주장과 일치.
- **plan 참조**: `spec/conventions/error-codes.md` 표가 가리키는 `plan/in-progress/auth-change-password-oauth-only-code-split.md` 존재.

## 요약

이번 델타는 `changePassword` 실패 코드를 형제 흐름(`verifyPasswordForUser`)과 정렬시키고 `INVALID_PASSWORD`를 wire 코드에서 감사값 전용으로 은퇴시키는 좁은 범위의 변경이다. `1-auth.md`·`3-error-handling.md`·`conventions/error-codes.md`·`2-navigation/9-user-profile.md`·`1-data-model.md`·`data-flow/2-auth.md`·frontend 코드/문서 전 지점이 코드 diff 와 정확히 일치하도록 동시 갱신되어 있으며, "wire 은퇴 vs 감사값 존속"이라는 레이어 구분도 모든 참조처에서 일관되게 서술된다. Cross-spec 충돌(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 어느 관점에서도 모순을 찾지 못했다.

## 위험도

NONE
