# 요구사항(Requirement) Review — refactor-auth-reverify-unify

리뷰 대상: `sessions.service.ts`, `webauthn.controller.ts`, `webauthn.controller.spec.ts`, `plan/in-progress/refactor-auth-reverify-unify.md`

---

## 발견사항

### [INFO] spec 에 `verifyPasswordForUser` 흐름 미등재
- 위치: `spec/data-flow/2-auth.md §1.2` (로그인 시퀀스 다이어그램 line 73)
- 상세: spec 은 로그인 경로의 비밀번호 비교를 `bcrypt.compare(password, password_hash)` 로 직접 표기하고 있으며, `AuthService.verifyPasswordForUser` 헬퍼 존재나 그 오류 코드(`PASSWORD_REQUIRED` / `PASSWORD_INVALID`) 및 재사용 경로(disable2fa, webauthn regenerate)가 spec 에 기술되지 않았다. `plan/in-progress/refactor-auth-reverify-unify.md` 의 "범위 밖 / 후속" 항목에서도 `data-flow/2-auth §1.2 verifyPasswordForUser 흐름 + error-codes 등재`를 planner 위임 후속으로 명기하고 있다.
- 이 불일치 방향: 코드가 의도적으로 개선·추출한 헬퍼로서, spec 이 아직 이를 반영하지 못한 상태다. 구현을 되돌리는 것이 오답이다.
- 제안: [SPEC-DRIFT] 코드 유지. `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램 및 주석에 `verifyPasswordForUser` 헬퍼 존재, 위임 경로(disable2fa / webauthn regenerate), 오류 코드(`PASSWORD_REQUIRED` / `PASSWORD_INVALID`) 를 등재해야 한다. `project-planner` 가 처리.

---

### [INFO] `sessions.service.ts verifyReauth` — spec 에 에러코드 상세 미등재
- 위치: `sessions.service.ts` `verifyReauth` (lines 281-328)
- 상세: spec `data-flow/2-auth.md §1.5` 주석이 `CANNOT_REVOKE_CURRENT_SESSION`(400), `REAUTH_NOT_AVAILABLE`(403), `SESSION_NOT_FOUND`(404)를 명시하고 있으나, `verifyReauth` 내부의 `PASSWORD_INVALID`(401), `TOTP_INVALID`(401), `REAUTH_REQUIRED`(400) 에러 코드는 spec 본문에 명시되지 않았다. 코드 동작(다중요소 우선순위, 친근체 메시지)은 plan 문서("계약이 다름 — 친근체 메시지·REAUTH 다중요소·PASSWORD_REQUIRED 없음")와 정합하고 구현이 합리적이다.
- 제안: [SPEC-DRIFT] 코드 유지. `spec/5-system/1-auth.md §2.3` 또는 `data-flow/2-auth.md §1.5` 에 verifyReauth 에러 코드 테이블을 추가해야 한다. `project-planner` 가 처리.

---

### [INFO] `data-flow/2-auth.md §1.2` 시퀀스에 `bcrypt.compare` raw 참조 잔류
- 위치: `spec/data-flow/2-auth.md` line 73 `Svc->>Svc: bcrypt.compare(password, password_hash)`
- 상세: 코드는 이미 `comparePassword` 헬퍼(`password.util.ts`)로 통일됐으나, spec 다이어그램은 여전히 `bcrypt.compare` 를 직접 기재하고 있다. 기능 차이는 없지만(thin wrapper) spec 본문이 구현 내부 호출명을 직접 참조하는 낮은 레벨의 표현이 낡았다.
- 제안: [SPEC-DRIFT] 코드 유지. spec 다이어그램을 `comparePassword(password, password_hash)` 또는 추상 표현으로 갱신 권장. `project-planner` 가 처리.

---

## 기능 완전성 — 이상 없음

| 체크 포인트 | 결과 |
|---|---|
| `webauthn.controller.ts` — raw bcrypt / usersService 의존 제거 | 완료. 생성자에서 `usersService` 제거, `import * as bcrypt` 제거, `verifyPasswordForUser` 단일 호출로 대체. |
| `sessions.service.ts` — `bcrypt.compare` → `comparePassword` | 완료. 동일 의미론 유지, `bcrypt` import 제거. |
| 테스트 — `webauthnRegenerateRecovery` 신설 | 완료. 성공 경로(비밀번호 확인 → 재발급 결과 검증) + 실패 경로(UnauthorizedException throw + regenerate 미호출) 양쪽 커버. |
| 생성자 인자 정합 (spec.ts ↔ controller.ts) | 완료. `controller = new WebAuthnController(authService, webauthnService, configService, auditLogsService)` — usersService 제거로 4인자 정합. |

---

## 엣지 케이스 — 이상 없음

- `verifyPasswordForUser`: `!user || !user.passwordHash` 를 단일 가드로 처리하여 OAuth-only 계정과 미존재 사용자를 동일하게 `PASSWORD_REQUIRED`(401)로 차단. 정보 누출 없음.
- `sessions.service.ts verifyReauth`: `!hasPassword && !has2fa` → `REAUTH_NOT_AVAILABLE`(403), 자격증명 미입력 → `REAUTH_REQUIRED`(400) — 모든 진입 경로 커버됨.
- `resolveCurrentFamilyId`: `if (!refreshToken) return null` 가드로 빈 문자열 방어.
- `revokeFamily` / `revokeOtherFamilies`: self-revoke 차단, family 미존재 404, currentFamilyId 미식별 400 처리 완비.

---

## TODO/FIXME — 없음

변경 파일에 미완성 주석(TODO/FIXME/HACK/XXX) 없음.

---

## 의도와 구현 간 괴리 — 없음

- `verifyReauth` 주석(우선순위 1→2→3→4)과 실제 코드 분기(password 우선, 2fa 차순, 없으면 REAUTH_REQUIRED) 일치.
- `revokeAllFamilies` 주석 "비밀번호 변경 후 호출 / verifyReauth 없음 / login_history bulk familyId=null" 과 구현 정합.
- spec `§2.3` "비밀번호 변경 시 처리 — 모든 활성 family revoke" 와 `revokeAllFamilies` 동작 일치.

---

## 에러 시나리오 처리 — 이상 없음

- `webauthnRegenerateRecovery` 에서 `authService.verifyPasswordForUser` reject 시 에러 그대로 전파; `regenerateRecoveryCodes` 미호출. 테스트로 검증됨.
- 비밀번호 변경 외 경로(`revokeFamily`, `revokeOtherFamilies`)는 `verifyReauth` 내 TOTP / 비밀번호 두 경로 모두 throw-propagation 확인.

---

## 데이터 유효성 — 이상 없음

`comparePassword(plain, hash)` 는 내부에서 `bcrypt.compare` 를 호출하며 null hash 는 상류(caller) 가드에서 차단 후 전달되는 구조.

---

## 비즈니스 로직 — 이상 없음

- spec `§5` "POST /api/auth/2fa/webauthn/recovery-codes/regenerate — 비밀번호 재확인 + 기존 미사용 코드 폐기 후 10개 재발급": 코드가 `verifyPasswordForUser` → `regenerateRecoveryCodes` 순으로 정확히 구현.
- spec `data-flow/2-auth §1.2` "bcrypt=Service" 원칙(레이어 정렬): controller 에서 raw bcrypt 제거, Service 계층으로 위임 완료.

---

## 반환값 — 이상 없음

- `verifyReauth`: `void` 반환. 성공 시 `return;` 명시, 실패 시 모든 분기가 throw — 암묵 undefined 반환 없음.
- `webauthnRegenerateRecovery`: `{ data: { webauthnRecoveryCodes: codes } }` — spec `§5` 응답 shape 정합.
- `revokeAllFamilies` / `revokeOtherFamilies`: `{ revoked: number }` 반환.

---

## spec fidelity

| spec 포인터 | 코드 | 판정 |
|---|---|---|
| `spec/5-system/1-auth.md §5` — regenerate 엔드포인트: password 재확인 + 10개 재발급 | `verifyPasswordForUser` + `regenerateRecoveryCodes` | 일치 |
| `spec/data-flow/2-auth §1.5` 주석 — `CANNOT_REVOKE_CURRENT_SESSION`(400), `REAUTH_NOT_AVAILABLE`(403), `SESSION_NOT_FOUND`(404) | sessions.service 그대로 구현 | 일치 |
| `spec/5-system/1-auth §1.1` — `bcrypt cost ≥ 12`, `password.util.ts BCRYPT_ROUNDS=12` | `comparePassword` wrapper 가 동일 bcrypt 사용 | 일치 |
| `spec/5-system/1-auth §2.3` — "비밀번호 변경 시 모든 활성 family revoke + login_history session_revoked bulk familyId=null" | `revokeAllFamilies` 구현 정합 | 일치 |
| `spec/data-flow/2-auth §1.2` 시퀀스 `bcrypt.compare` 직접 참조 | `comparePassword` 헬퍼 전환 | SPEC-DRIFT (코드 옳음, spec 갱신 필요) |
| `verifyPasswordForUser` 헬퍼 및 에러코드 | spec 본문에 미등재 | SPEC-DRIFT (코드 옳음, spec 갱신 필요) |

---

## 요약

이번 변경은 `webauthn.controller.ts` 의 raw bcrypt / `usersService` 직접 의존을 제거하고 `AuthService.verifyPasswordForUser` 로 위임하는 레이어 정렬 리팩터링, 그리고 `sessions.service.ts` 의 `bcrypt.compare` 를 `comparePassword` 헬퍼로 교체하는 primitive 일치화다. 기능 동작·에러 코드·메시지·HTTP 상태는 이전과 동일하게 보존되며, spec 이 정의한 `§5` 엔드포인트 계약(`POST /api/auth/2fa/webauthn/recovery-codes/regenerate` — 비밀번호 재확인 + 재발급)과 `data-flow §1.5` 재인증 규칙을 충족한다. 발견된 불일치는 모두 **코드가 합리적으로 개선된 반면 spec 이 아직 반영하지 못한 SPEC-DRIFT** 이며, 코드 버그가 없다. 비즈니스 로직·에러 시나리오·엣지 케이스·반환값 모두 이상 없음.

---

## 위험도

NONE
