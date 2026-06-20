# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 리팩터링으로 보안·기능 결함 없음. 모든 발견사항이 INFO 수준이며, SPEC-DRIFT 항목(spec 갱신 필요)과 코드 품질 소개선 후보로 구성됨.

## Critical 발견사항

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `data-flow/2-auth.md §1.2` 시퀀스가 여전히 `bcrypt.compare` 직접 호출로 기재됨 — 코드는 `comparePassword` 헬퍼로 추상화 완료 | `spec/data-flow/2-auth.md §1.2` | 코드 유지 + `bcrypt.compare` → `comparePassword(password, password_hash)` 로 spec 갱신 (`project-planner` 위임) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `data-flow/2-auth.md §1.2` 에 `webauthnRegenerateRecovery`의 `verifyPasswordForUser` 위임 경로·에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`) 미등재 | `spec/data-flow/2-auth.md §1.2` | 코드 유지 + 위임 경로 및 에러 코드 등재 (`project-planner` 위임) |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/1-auth.md §2.3` 에 `verifyReauth` 에러 코드(`PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_REQUIRED`/`REAUTH_NOT_AVAILABLE`) 미등재 | `spec/5-system/1-auth.md §2.3` | 코드 유지 + 에러 코드 표 등재 (`project-planner` 위임) |
| 4 | 보안 | `verifyPasswordForUser` early-exit 타이밍 사이드채널 (기존 known gap, JWT 인증 후 본인 계정만 조회라 실위험 ~0, plan defer 기록됨) | `auth.service.ts:65-70` | 별도 보안 작업에서 dummy bcrypt.compare 삽입 검토 (본 changeset 범위 밖) |
| 5 | 보안 | 비밀번호·TOTP 브루트포스 보호 부재 (기존 known gap, plan defer 기록됨, JWT 인증 후라 익명 공격 불가) | `webauthnRegenerateRecovery` + `verifyReauth` | 별도 보안 스프린트에서 NestJS Throttler 등 rate limiter 적용 |
| 6 | 유지보수성 | `resolveCurrentFamilyId` 파라미터 타입이 `string` 으로 선언되나 내부에 `if (!refreshToken) return null;` 가드 존재 → 타입과 로직 불일치 (호출부는 `string \| null` 전달) | `sessions.service.ts:849-858` | 파라미터 타입을 `string \| null` 로 수정하거나 호출부에서 null 체크 후 호출하도록 일관화 |
| 7 | 유지보수성 | `hashRaw` 함수가 spec 파일에 SHA-256 로직을 복제 — production 해시 알고리즘 변경 시 테스트도 함께 수정 필요 | `sessions.service.spec.ts:168-170` | 중장기적으로 `token-hash.util.ts` 추출로 테스트·production 공유 (본 changeset 범위 밖) |
| 8 | 문서화 | `revokeFamily` JSDoc 에 5번째 파라미터(`currentRefreshToken`) 설명은 서술형으로 있으나 `@param` 태그 미구조화 | `sessions.service.ts:642-647` | `@param currentRefreshToken - null이면 self-revoke 검사 생략` 형식의 @param 태그 추가 |
| 9 | 문서화 | `webauthnRegenerateRecovery` `@ApiUnauthorizedResponse` 가 리팩터 후 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 케이스를 모두 커버하는지 명시 부족 | `webauthn.controller.ts:1638-1660` | description 을 `'비밀번호 미설정(PASSWORD_REQUIRED), 불일치(PASSWORD_INVALID), 또는 토큰 만료'` 로 세분화 |
| 10 | 테스팅 | self-revoke reject 테스트에서 "early-exit" 의도를 `repo.update not called` 로 간접 단언 — `usersService.findById not called` 추가 시 더 명확 | `sessions.service.spec.ts:116-117` | `expect(usersService.findById).not.toHaveBeenCalled()` 추가 (INFO, 비차단) |
| 11 | 테스팅 | `webauthnRegenerateRecovery` 성공 케이스에서 `auditLogsService.record` 미호출 여부를 단언하지 않음 (현재 구현에 audit 없으므로 맞으나, 미래 회귀 방지 측면) | `webauthn.controller.spec.ts:952-982` | `expect(auditLogsService.record).not.toHaveBeenCalled()` 추가 |
| 12 | 범위 | `sessions.service.spec.ts` 에 plan 미명시 신규 테스트 2건(`self-revoke` 분기) 추가 — 이전 ai-review(C-3 §3 W#2/W#3) 보완이며 주석에 근거 명시됨 | `sessions.service.spec.ts:96-143` | plan "변경" 섹션 항목 3에 소급 기재 권장 (추적성 완성) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 타이밍 사이드채널·브루트포스 모두 기존 known gap(plan defer), 현 변경으로 위험 증가 없음 |
| requirement | LOW | 3건의 SPEC-DRIFT(spec 갱신 필요), `revokeFamily` owned 조회 `isRevoked` 필터 부재(idempotent, 비차단) |
| scope | NONE | plan 명시 변경과 99% 일치, 신규 테스트 2건만 미명시(의도적 보완) |
| side_effect | NONE | 의도치 않은 부작용 없음, 에러 응답 계약 보존 확인 |
| maintainability | NONE | `resolveCurrentFamilyId` 타입 불일치·`hashRaw` 복제 등 INFO, 전체 유지보수성 개선 방향 |
| testing | NONE | 테스트 품질 우수, self-revoke·webauthnRegenerateRecovery 케이스 신설 |
| documentation | LOW | JSDoc @param 미구조화·Swagger 설명 세분화 필요, spec 갱신 후속 작업 필요 |

## 발견 없는 에이전트

없음 (전 에이전트 발견사항 있으나 모두 INFO 수준)

## 권장 조치사항

1. **SPEC-DRIFT 3건을 `project-planner` 에 위임**: `data-flow/2-auth.md §1.2` (bcrypt.compare → comparePassword, verifyPasswordForUser 위임 경로), `spec/5-system/1-auth.md §2.3` (verifyReauth 에러 코드 표)
2. **`resolveCurrentFamilyId` 파라미터 타입 수정**: `string` → `string | null` 으로 타입과 런타임 가드 일치화
3. **`revokeFamily` JSDoc @param 태그 구조화**: `currentRefreshToken` 파라미터 설명을 @param 형식으로 추가
4. **`@ApiUnauthorizedResponse` 설명 세분화**: `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 두 케이스 명시
5. (선택) self-revoke reject 테스트에 `usersService.findById not called` 단언 추가
6. (선택) `webauthnRegenerateRecovery` 성공 테스트에 `auditLogsService.record not called` 단언 추가
7. (선택) plan "변경" 섹션에 `sessions.service.spec` 신규 테스트 2건 소급 기재

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행 (7명)**: security, requirement, scope, side_effect, maintainability, testing, documentation
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 강제 포함)
- **제외 (7명)**:

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단으로 생략 |
| architecture | 라우터 판단으로 생략 |
| dependency | 라우터 판단으로 생략 |
| database | 라우터 판단으로 생략 |
| concurrency | 라우터 판단으로 생략 |
| api_contract | 라우터 판단으로 생략 |
| user_guide_sync | 라우터 판단으로 생략 |
