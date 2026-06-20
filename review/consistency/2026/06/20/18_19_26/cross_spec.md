# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/1-auth.md` (구현 완료 후 검토, diff-base=origin/main)
검토 시각: 2026-06-20

---

## 발견사항

### [INFO] data-flow/2-auth.md §1.2 시퀀스 다이어그램이 `bcrypt.compare` 직접 호출로 기술됨

- **target 위치**: 구현 변경 — `sessions.service.ts` 및 `webauthn.controller.ts` 에서 `bcrypt.compare` 를 제거하고 `comparePassword` 헬퍼 / `AuthService.verifyPasswordForUser` 로 교체.
- **충돌 대상**: `spec/data-flow/2-auth.md` §1.2 로그인 시퀀스 다이어그램 73행 — `Svc->>Svc: bcrypt.compare(password, password_hash)`, §1.1 회원가입 다이어그램 43행 — `validatePasswordStrength + bcrypt.hash(password)`.
- **상세**: 구현은 `comparePassword` (`bcrypt.compare` 래퍼) 와 `hashPassword` (`bcrypt.hash` 래퍼) 를 `password.util.ts` 단일 진입점으로 통합했다. data-flow spec 의 다이어그램은 여전히 원시 `bcrypt.*` 심볼을 노출하고 있어 신규 개발자가 코드베이스를 보고 spec 과 비교할 때 기술 구현과 다이어그램이 일치하지 않는다는 혼선이 생길 수 있다. 기능 동작·에러 코드·흐름 자체는 변경 없으므로 모순은 아니나, 정확성 측면의 동기화가 필요하다.
- **제안**: `spec/data-flow/2-auth.md` §1.2 (로그인 시퀀스) 와 §1.1 (회원가입 시퀀스) 의 `bcrypt.compare` / `bcrypt.hash` 심볼을 각각 `comparePassword(password, password_hash)` / `hashPassword(password)` 로 갱신하거나, 주석으로 `(password.util 래퍼 경유)` 를 명기한다.

---

### [INFO] `spec/5-system/1-auth.md` §1.1 및 Rationale 에 `bcrypt` 직접 언급 2건 존재

- **target 위치**: 구현 변경 전반 — `comparePassword` 헬퍼 통일.
- **충돌 대상**: `spec/5-system/1-auth.md` §1.1 행 "비밀번호 저장: bcrypt (cost factor ≥ 12)" / Rationale 618행 "변경 직전 `currentPassword` bcrypt 검증으로 본인 확인".
- **상세**: 두 언급 모두 알고리즘 수준(bcrypt, cost factor) 을 서술하는 것으로, 헬퍼 함수 도입과 의미 모순은 없다. 그러나 `spec/1-data-model.md` §2.1 User 테이블 역시 `password_hash` 를 "bcrypt" 로 기술하고 있어 알고리즘 명세는 spec 전반에서 일관적이다. 구현 변경이 bcrypt 알고리즘 자체를 바꾼 것이 아니므로 spec 수정이 필수는 아니나, 헬퍼 추상화 레이어 도입의 이유(bcrypt → argon2id 등 향후 교체 용이성)를 Rationale 에 부가하면 유용하다.
- **제안**: 필수 변경 아님. 필요 시 `spec/5-system/1-auth.md` §1.1 비밀번호 저장 행에 `(password.util.ts 의 hashPassword/comparePassword 경유)` 주석 추가.

---

### [INFO] `spec/data-flow/2-auth.md` §1.5 self-revoke 차단 서술이 `currentRefreshToken` 파라미터 추가를 반영하지 않음

- **target 위치**: 구현 변경 — `sessions.service.ts::revokeFamily` 5번째 인자 `currentRefreshToken: string | null` 추가, self-revoke 방지 분기 활성화.
- **충돌 대상**: `spec/data-flow/2-auth.md` §1.5 세션 revoke 시퀀스 다이어그램 (194행) 및 주석 (201~203행) — `CANNOT_REVOKE_CURRENT_SESSION` 이 이미 언급되어 있으나 동작 방식이 "refreshToken 쿠키와 매칭되는 family" 수준으로만 서술. 5번째 인자의 존재 및 해시 비교 흐름이 미기술.
- **상세**: spec 은 self-revoke 차단을 결과 기준으로만 서술하고 있어 구현 상세(caller 가 raw refresh token 을 전달하고 service 가 sha-256 해시로 현재 family 를 식별)가 누락되어 있다. 기존 서술이 틀린 것은 아니나, 해당 분기가 "dead-path 였음"을 수정한 이번 변경을 반영하면 data-flow 정확성이 높아진다.
- **제안**: `spec/data-flow/2-auth.md` §1.5 의 self-revoke 주석에 `currentRefreshToken` 파라미터 흐름(`sha256(token) 으로 family 비교`) 을 한 문장 보강. 필수 차단 등급은 아님.

---

## 요약

이번 변경 (`revokeFamily` 5번째 파라미터 추가로 self-revoke dead-path 수정, `bcrypt.compare` → `comparePassword` 헬퍼 통일, `WebAuthnController` 의 raw bcrypt/UsersService 직접 호출 → `AuthService.verifyPasswordForUser` 위임)은 `spec/5-system/1-auth.md` 가 정의하는 세션 revoke 정책(self-revoke 차단 `CANNOT_REVOKE_CURRENT_SESSION`, 비밀번호 재확인 레이어 정렬) 과 에러 코드 계약(`PASSWORD_REQUIRED` / `PASSWORD_INVALID` 401)을 그대로 보존하며, RBAC·데이터 모델·상태 전이·요구사항 ID 충돌은 발견되지 않았다. 발견된 3건은 모두 INFO — data-flow 다이어그램의 bcrypt 심볼 표기와 self-revoke 분기 서술이 구현 세부 변경을 아직 반영하지 않은 동기화 권장 사항이며, 기능적 모순이나 CRITICAL/WARNING 수준의 충돌은 없다.

## 위험도

NONE
