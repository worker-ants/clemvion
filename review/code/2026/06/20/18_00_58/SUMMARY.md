# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 리팩터링으로 기능·보안·에러 계약이 유지되나, 테스트 커버리지 갭(self-revoke 분기 미검증) 및 타이밍 사이드채널 잠재 위험이 존재함

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `verifyPasswordForUser` 실패 시 타이밍 사이드채널 잠재 위험 — `!user \|\| !user.passwordHash` 조건에서 사용자 미존재 시 `comparePassword`를 호출하지 않고 즉시 throw하여 응답 시간으로 userId 존재 여부를 추측 가능. JWT 인증 후 호출 경로이므로 실제 위험도는 낮음. | `auth.service.ts` L65-70 | 완전한 방어 원할 시 미존재 사용자에 대해서도 dummy bcrypt 비교를 실행 후 throw하는 패턴 적용 가능. 현재는 낮은 우선순위. |
| 2 | Testing | `sessions.service.spec.ts`의 `revokeFamily` 테스트가 5번째 인자(`currentRefreshToken`) 없이 호출됨 — `undefined`로 평가되어 self-revoke 방지 분기가 dead code 상태임. TypeScript 컴파일은 통과하나 의도와 다른 테스트 경로가 고정됨. | `sessions.service.spec.ts` L141, L165, L172, L179, L193, L207 | `revokeFamily` 호출부 전체에 5번째 인자를 명시. `null` 전달로 "현재 세션 정보 없는" 시나리오, 특정 hash 값으로 self-revoke 시나리오를 구분 테스트. |
| 3 | Testing | `revokeFamily`의 self-revoke 방지 분기(`CANNOT_REVOKE_CURRENT_SESSION`)에 대한 테스트가 없음. 위의 인자 누락으로 분기 자체가 never 경로가 됨. | `sessions.service.spec.ts` — `revokeFamily` describe 블록 내 | (1) `currentRefreshToken`에 `familyId`와 일치하는 현재 토큰 제공 → `BadRequestException` expect; (2) 다른 family 토큰 → 정상 revoke 진행. 두 케이스 추가. |
| 4 | Side Effect | `webauthnRegenerateRecovery` 에러 메시지 간접 결합 — `AuthService.verifyPasswordForUser`의 메시지가 향후 변경되면 이 엔드포인트 에러 메시지도 묵시적으로 변경됨. 현재 테스트는 에러 타입만 검증하고 메시지를 단언하지 않아 메시지 드리프트를 잡지 못함. | `webauthn.controller.ts` L1119-1128 vs `auth.service.ts` L66-70 | `AuthService.verifyPasswordForUser` 메시지 변경 시 webauthn regenerate 계약도 영향받음을 주석이나 테스트에 명시. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/2-auth.md §1.2` 시퀀스에 `verifyPasswordForUser` 헬퍼 존재·위임 경로(disable2fa / webauthn regenerate)·에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)가 미등재. 코드는 합리적으로 개선됐으며 spec이 반영하지 못한 상태. | `spec/data-flow/2-auth.md` L73, `spec/5-system/1-auth.md` | [SPEC-DRIFT] 코드 유지. `project-planner`가 `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램 및 주석에 `verifyPasswordForUser` 헬퍼, 위임 경로, 에러 코드 등재. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `sessions.service.ts verifyReauth` 내부의 `PASSWORD_INVALID`(401), `TOTP_INVALID`(401), `REAUTH_REQUIRED`(400) 에러 코드가 spec 본문에 미등재. 구현은 plan과 정합하고 합리적임. | `spec/5-system/1-auth.md §2.3` 또는 `data-flow/2-auth.md §1.5` | [SPEC-DRIFT] 코드 유지. `project-planner`가 verifyReauth 에러 코드 테이블 추가. |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/2-auth.md §1.2` 다이어그램이 `bcrypt.compare` 직접 참조를 유지하고 있으나, 코드는 이미 `comparePassword` 헬퍼로 전환됨. | `spec/data-flow/2-auth.md` L73 | [SPEC-DRIFT] 코드 유지. spec 다이어그램을 `comparePassword(password, password_hash)` 또는 추상 표현으로 갱신. `project-planner` 처리. |
| 4 | Documentation | `verifyReauth` JSDoc의 "bcrypt 검증" 표현이 `comparePassword` 위임 후에도 유지됨. 헬퍼 추상화 이점을 JSDoc이 역행함. | `sessions.service.ts` L271-272 | `→ bcrypt 검증` → `→ comparePassword 헬퍼로 검증` 으로 수정. |
| 5 | Testing | `webauthn.controller.spec.ts`의 `webauthnRegenerateRecovery` 성공 케이스가 `webauthnService.regenerateRecoveryCodes` 호출 인자(`user.sub`)를 검증하지 않음. | `webauthn.controller.spec.ts` L663-671 | `expect(webauthnService.regenerateRecoveryCodes).toHaveBeenCalledWith('user-uuid')` 추가. |
| 6 | Testing | `revokeOtherFamilies`의 `loginHistory.record` 호출 검증 없음(revoked > 0 시). `revokeAllFamilies`에는 있는 검증이 누락됨. | `sessions.service.spec.ts` L212-256 | 성공 케이스에 `expect(loginHistory.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'session_revoked', familyId: null }))` 추가. |
| 7 | Testing | `sessions.service.spec.ts`의 `revokeFamily` 테스트가 `bcrypt.hash`를 직접 사용하며 `comparePassword`로 전환된 코드 정신과 불일치. | `sessions.service.spec.ts` L9, L133 | (선택) `bcrypt.hash(...)` → `hashPassword(...)` (from `password.util`)로 교체. |
| 8 | Maintainability | 테스트 `it` 블록 설명이 한국어·영어 혼용. 기존 테스트는 영문, 신규 `webauthnRegenerateRecovery` 블록은 한국어로 작성됨. | `webauthn.controller.spec.ts` 전체 | 파일 내 기존 패턴(영문) 또는 프로젝트 컨벤션에 맞춰 통일. |
| 9 | Maintainability | `resolveCurrentFamilyId` 파라미터 타입이 `string`이지만 런타임 방어 가드(`if (!refreshToken)`)가 중복 존재. | `sessions.service.ts` L329-332 | 타입을 `string \| null`로 바꾸거나, 가드를 제거하고 caller에서 null 체크 후 호출하도록 정리. |
| 10 | Security | `webauthnRegenerateRecovery` — rate limiting/brute-force 보호 부재. plan 파일에 후속 작업으로 명시됨. 이번 범위 밖. | `webauthn.controller.ts` L1119-1128 | 후속 별도 작업에서 rate limiting 구현 필요. 현재 변경에서는 블로킹 아님. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `verifyPasswordForUser` early-exit 타이밍 사이드채널 (JWT 인증 후 경로로 실제 위험 낮음) |
| architecture | NONE | SOLID 원칙 준수, 레이어 책임 정렬, 순환 의존 없음 |
| requirement | NONE | spec fidelity 충족, SPEC-DRIFT 3건 (코드 옳음·spec 갱신 필요) |
| scope | NONE | plan 명시 3가지 변경 항목과 정확히 대응, 범위 이탈 없음 |
| side_effect | LOW | 에러 메시지 간접 결합 (설계 의도 내 허용 결합) |
| maintainability | NONE | JSDoc "bcrypt 검증" 문구 구식화, 테스트 언어 혼용 (INFO 수준) |
| testing | LOW | `revokeFamily` 5번째 인자 누락으로 self-revoke 분기 dead code 상태 (기존 갭) |
| documentation | NONE | 발견사항 모두 INFO, plan 파일에 후속 위임 기록됨 |

## 발견 없는 에이전트

architecture, scope — 발견사항 없음 (전원 INFO 수준 긍정 평가)

## 권장 조치사항

1. **[WARNING #2, #3] `sessions.service.spec.ts` `revokeFamily` 5번째 인자 명시 및 self-revoke 분기 테스트 추가** — 기존 테스트 커버리지 갭. `currentRefreshToken` 인자를 명시하고, self-revoke 시나리오(BadRequestException) 및 타 family revoke 성공 케이스를 추가.
2. **[WARNING #1] `verifyPasswordForUser` 타이밍 사이드채널 개선 검토** — 필수는 아니나 방어 깊이를 높이려면 미존재 사용자에 대해 dummy bcrypt 비교 후 throw 패턴 적용.
3. **[WARNING #4] `verifyPasswordForUser` 에러 메시지 계약 테스트화** — `webauthn.controller.spec.ts`에서 에러 메시지 단언 추가하여 메시지 드리프트 방지.
4. **[INFO #1, #2, #3] SPEC-DRIFT 3건 — `project-planner` 위임** — `spec/data-flow/2-auth.md §1.2`에 `verifyPasswordForUser` 헬퍼·위임 경로·에러 코드 등재, `verifyReauth` 에러 코드 테이블 추가, `bcrypt.compare` 직접 참조 추상화. (plan 파일에 이미 후속으로 기록됨)
5. **[INFO #4] `verifyReauth` JSDoc "bcrypt 검증" → "comparePassword 헬퍼로 검증" 수정** — 헬퍼 추상화와 주석 정합성 확보.
6. **[INFO #5] `webauthnRegenerateRecovery` 성공 케이스에 `toHaveBeenCalledWith('user-uuid')` 추가** — 핵심 보안 위임 경로 인자 검증.

## 라우터 결정

**실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명 — 전원 router_safety 강제 포함)

**제외**: performance, dependency, database, concurrency, api_contract, user_guide_sync (6명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 이번 변경이 runtime 성능에 영향 없는 순수 리팩터링 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |
| api_contract | HTTP API 시그니처·응답 shape 변경 없음 (behavior-preserving) |
| user_guide_sync | 사용자 가이드 영향 없는 내부 리팩터링 |

**강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전체 실행 reviewer가 강제 포함 목록과 동일)
