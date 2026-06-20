# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] [SPEC-DRIFT] data-flow/2-auth.md §1.2 — bcrypt.compare 직접 참조 vs comparePassword 추상화
- 위치: `spec/data-flow/2-auth.md §1.2` mermaid 시퀀스 (line 73: `Svc->>Svc: bcrypt.compare(password, password_hash)`)
- 상세: spec 다이어그램이 여전히 `bcrypt.compare` 를 직접 기재하고 있으나, 코드는 `comparePassword` 헬퍼(`codebase/backend/src/common/utils/password.util.ts`)로 추상화됐다. 구현이 의도적으로 개선된 것이며 코드가 옳다.
- 제안: 코드 유지 + spec 반영 — `data-flow/2-auth.md §1.2` 시퀀스의 `bcrypt.compare` 를 `comparePassword(password, password_hash)` 로 갱신. `project-planner` 위임.

---

### [INFO] [SPEC-DRIFT] data-flow/2-auth.md §1.2 — verifyPasswordForUser 위임 경로 미등재
- 위치: `spec/data-flow/2-auth.md §1.2` 및 코드 진입점 목록 (overview 섹션)
- 상세: `webauthn.controller.ts` `webauthnRegenerateRecovery` 의 비밀번호 재확인이 이제 `AuthService.verifyPasswordForUser` 로 위임되는데, spec §1.2 의 data-flow 시퀀스·개요에는 이 위임 경로·에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)가 등재돼 있지 않다. 코드의 리팩토링이 의도적이며 플랜 문서(`plan/in-progress/refactor-auth-reverify-unify.md`)에도 명시돼 있다.
- 제안: 코드 유지 + spec 반영 — `data-flow/2-auth.md §1.2` 에 `verifyPasswordForUser` 헬퍼·위임 경로 및 에러 코드 등재. `project-planner` 위임.

---

### [INFO] [SPEC-DRIFT] spec/5-system/1-auth.md §2.3 — verifyReauth 에러 코드 spec 미등재
- 위치: `spec/5-system/1-auth.md §2.3` 세션 정책 표 "강제 종료 재인증" 행
- 상세: spec 은 재인증 수단(비밀번호·2FA)을 서술하나, `verifyReauth` 가 던지는 에러 코드(`PASSWORD_INVALID` / `TOTP_INVALID` / `REAUTH_REQUIRED` / `REAUTH_NOT_AVAILABLE`)가 본문 테이블에 등재돼 있지 않다. 코드 동작은 spec 의도와 일치하며 에러 코드 추가가 의도적 정교화에 해당한다.
- 제안: 코드 유지 + spec 반영 — `spec/5-system/1-auth.md §2.3` 에 에러 코드 표 등재. `project-planner` 위임.

---

### [INFO] revokeFamily의 owned 조회 — is_revoked 필터 부재
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts` line 81-83 (`revokeFamily`)
- 상세: `findOne({ where: { userId, familyId } })` 에 `isRevoked: false` 필터가 없어, 이미 revoke 된 family 를 대상으로 재요청하면 404 대신 200 성공(re-revoke) 이 된다. 기능적으로 idempotent 이므로 심각한 결함은 아니나, 이미 만료/revoke 된 세션을 "존재하지 않는 세션" 으로 처리하지 않아 사용자에게 오해를 줄 수 있다. 단, `listActiveSessions` 에서는 활성 세션만 표시되므로 이미 revoke 된 family 는 UI 에 노출되지 않아 실질적 문제가 발생하기 어렵다. spec(`data-flow/2-auth.md §1.5`)도 이를 명시하지 않으므로 spec 공백(INFO) 으로 분류한다.
- 제안: 선택적 개선 — `{ where: { userId, familyId, isRevoked: false } }` 로 좁히거나 현행 idempotent 동작을 의도로 주석 명시. 비차단.

---

### [INFO] self-revoke 분기 — owned findOne 이 revoke 된 토큰도 매칭함에 따른 검사 순서
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts` line 92-101 (self-revoke guard)
- 상세: `resolveCurrentFamilyId` 는 `isRevoked: false` 인 토큰만 조회(line 281)하는 반면, owned 조회(line 81)에는 `isRevoked` 필터가 없다. 이미 로그아웃된 세션은 `resolveCurrentFamilyId` 가 null 을 반환해 self-revoke 차단이 발동하지 않고 가드를 통과할 수 있다. 그러나 로그아웃 된 세션의 쿠키는 클라이언트에서 이미 삭제돼 있고, 관련 테스트(`revokes a non-current family even when a current refresh token is present`)가 정상 동작을 커버한다. 실질적 보안 문제가 되려면 만료된 쿠키를 의도적으로 재전송해야 하고, `resolveCurrentFamilyId` 에서 `isRevoked: false` 가 이를 차단한다. INFO 수준으로 분류.
- 제안: 현행 유지 또는 owned 조회에 `isRevoked: false` 추가로 일관성 확보. 비차단.

---

### [INFO] `webauthnRegenerateRecovery` 테스트 — audit log 기록 여부 미검증
- 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` `webauthnRegenerateRecovery` describe 블록
- 상세: 새로 추가된 `webauthnRegenerateRecovery` 테스트는 `authService.verifyPasswordForUser` 위임과 `webauthnService.regenerateRecoveryCodes` 호출, 반환값을 검증한다. `webauthnRegenerateRecovery` 는 spec(`spec/5-system/1-auth.md §4.1`) 상 감사 대상(`user.2fa_enabled`/`user.2fa_disabled`) 이 아니라 복구 코드 재발급이므로 audit log 검증 부재는 정상이다. 단, 미래에 audit 추가 시 테스트 보강 필요.
- 제안: 현행 유지. 비차단.

---

## 요약

변경의 핵심 목적(raw bcrypt 직접 사용 → `comparePassword`/`verifyPasswordForUser` 단일 진실화)은 모든 파일에서 완전히 구현됐다. `sessions.service.ts` 는 `bcrypt.compare` → `comparePassword` 교체로 동작을 보존하면서 추상화 레이어를 맞췄고, `webauthn.controller.ts` 는 13줄의 인라인 검증 블록을 `AuthService.verifyPasswordForUser` 단일 호출로 대체해 레이어 정렬을 달성했다. `sessions.service.spec.ts` 의 `currentRefreshToken` 5번째 인자 추가(기존 `undefined` dead-path → `null` 명시)와 self-revoke 분기 커버리지 2개 테스트 신설은 앞선 ai-review 지적(C-3 §3 W#2/W#3) 을 정확히 이행했다. `webauthn.controller.spec.ts` 는 `UsersService` 의존 제거 및 `authService.verifyPasswordForUser` mock 기반 신규 테스트 2개를 일관되게 추가했다. 기능 완전성·에러 경로·반환값 측면에서 누락이 없으며, TODO/FIXME 미완성 마커도 없다. 발견된 항목은 전부 spec 갱신 대상 SPEC-DRIFT(INFO) 또는 owned 쿼리 `isRevoked` 필터 부재(INFO·idempotent 범위)로, 기능 구현 자체의 결함이 아니다.

## 위험도

LOW
