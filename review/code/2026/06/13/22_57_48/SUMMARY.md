# Code Review 통합 보고서

## 전체 위험도
**LOW** — refactor 04 후속(A-1 세션회전 · B-1 user.* 감사 ipAddress · B-2 changePassword SRP · C auth-context DRY/e2e). Critical 없음. 테스트 격리·순서 불변식 보강 권장 3건 + 응답 계약 breaking(내부 소비자 전파 완료) 1건.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `rotateSessionAfterPasswordChange` 단위 테스트가 revoke→issue **순서 불변식**을 검증하지 않음. 순서가 뒤집히면(발급 후 전체 revoke) 방금 발급한 새 family 까지 revoke 되는 옵션 B 보안 핵심 회귀를 잡지 못함. | `auth.service.spec.ts` (구현 `auth.service.ts` rotateSessionAfterPasswordChange) | `revokeAllFamilies` 와 `generateTokens`(또는 `jwtService.sign`) 호출 순서를 `invocationCallOrder` 로 단언. (통합 관점은 e2e refresh active=1 단언이 이미 커버) |
| 2 | Testing | 컨트롤러 spec 의 IP 단언이 `TRUST_CF_CONNECTING_IP` env **부재에 암묵 의존**, reset 가드 없음. 동일 Jest 워커에서 해당 env leak 시 `extractClientIp` 가 `cf-connecting-ip` 우선해 IP 단언이 깨질 수 있음. | `auth.controller.spec.ts`, `webauthn.controller.spec.ts`, `users.controller.spec.ts` | 각 `describe`/`beforeEach` 에 `delete process.env.TRUST_CF_CONNECTING_IP` 추가(`auth-context.spec.ts` 와 동일), 또는 IP 정확성 단언은 단위 테스트에 위임하고 컨트롤러는 `expect.any(String)` 으로 완화 |
| 3 | Testing | e2e 두 번째 테스트(wrong password 401)가 첫 테스트의 부수효과(전 세션 revoke + 비밀번호 변경)에 **암묵 종속**. 인증 실패 401 vs 비밀번호 불일치 401 구분 불가. | `test/users-change-password.e2e-spec.ts` | 401 단언에 응답 본문 `code === 'INVALID_PASSWORD'` 를 함께 단언해 인증 실패와 구분. 가능하면 독립 사용자로 분리 |
| 4 | API Contract | `POST /users/me/change-password` 응답 스키마 **breaking change** — `{ data: { success: true } }` → `{ data: { accessToken } }` (필드 제거). | `user-response.dto.ts` `PasswordChangeResultDto`, `users.controller.ts` `changePassword` | frontend 외 소비자(외부 통합/모바일) 부재 확인. 없으면 현 변경으로 충분(유일 소비자 frontend·테스트·Swagger 모두 동반 갱신 확인됨 → 실질 위험 낮음) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 비밀번호 변경 시 전 family revoke + 현재 디바이스 재발급(옵션 B) — OWASP 세션관리 권고 부합, 인증/인가·bcrypt·OAuth-only 차단·쿠키 보안속성 모두 보존 | `auth.service.ts` `rotateSessionAfterPasswordChange`, `sessions.service.ts` `revokeAllFamilies` | 없음(보안 강화) |
| 2 | Security | 감사 ipAddress 가 `extractClientIp` 신뢰 게이트 통과 — 위변조 `CF-Connecting-IP` 기본 불신(fail-safe), DRY 통합으로 drift 위험 감소 | 전 컨트롤러 `extractClientIp(req)` + `authContextFromRequest` | 없음 |
| 3 | Architecture/Maintainability | `AuthModule ↔ UsersModule` 순환을 `forwardRef` 로 정공법 해소, 3지점 근거 주석 충실. 다만 forwardRef 양방향 결합 증가는 구조적 부채 | `auth.module.ts`, `users.module.ts`, `users.controller.ts` 생성자 | (선택) 후속으로 `PasswordChangedEvent` 도메인 이벤트 발행으로 디커플링 고려. 현 범위 과한 추상화 — 경계 관리만 |
| 4 | Architecture/Maintainability | `changePassword` 도메인 로직 controller→service 이전(SRP 강화), `authContextFromRequest` 단일 util DRY 통합 | `users.service.ts`, `auth/utils/auth-context.ts` | 없음(개선) |
| 5 | Maintainability | `BCRYPT_ROUNDS = 12` 가 `auth.service.ts`·`users.service.ts` 양쪽 중복 정의 | `users.service.ts`, `auth.service.ts` | (범위 밖) 향후 `common/utils/password.util` 공용 위치로 단일화 고려 |
| 6 | Database/Concurrency | 비밀번호 변경 flow 가 단일 트랜잭션 아님(passwordHash update → revoke → login_history → 신규 token → audit 독립 커밋). 부분 실패는 fail-safe 방향(추가 revoke=로그아웃) | `users.controller.ts` `changePassword`, `auth.service.ts` `rotateSessionAfterPasswordChange` | 필수 아님. 강한 원자성 원하면 revoke+reissue 를 `dataSource.transaction` 으로 묶는 것 후속 고려 |
| 7 | Database/Concurrency | `revokeAllFamilies` bulk UPDATE 는 `idx_refresh_token_user` 로 적절히 가지치기, DB 단일 원자 연산이라 TOCTOU 무해, await 누락/floating promise 없음 | `sessions.service.ts` | 없음 |
| 8 | Scope | 무관한 plan 파일 `execution-engine-typed-errors.md`(A-2 backlog 등록)가 동일 spec 커밋에 동봉. 코드/spec 영향 없는 순수 등록 문서 | `plan/in-progress/execution-engine-typed-errors.md` | 무해(차단 아님). 엄밀히는 별도 커밋 권장이나 사용자 분리 결정의 기록이라 현행 허용 |
| 9 | Documentation | JSDoc·Swagger·spec·인라인 주석 모두 동일 커밋 동기 갱신, stale 주석 없음 | `auth.service.ts`, `users.service.ts`, `user-response.dto.ts` 등 | 없음 |
| 10 | User Guide Sync | 비밀번호 변경 시 "타 기기 모두 로그아웃" UX 변화에 대한 user-guide 절 부재(전체 docs 0건 — stale 누락 아닌 신규 동작 문서 부재) | `codebase/frontend/src/content/docs/07-workspace-and-team/` | (권장, 필수 아님) "비밀번호 변경 시 다른 기기는 모두 로그아웃됩니다" 안내 추가 검토. i18n parity·error code 매핑 의무는 비해당 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 옵션 B 세션 무효화 OWASP 부합, 인증/인가·쿠키·인젝션 신규 표면 없음 |
| requirement | NONE | spec↔코드 line-level 동기, 시그니처/계약 전부 일치, SPEC-DRIFT 아님 |
| architecture | LOW | forwardRef 순환 정공법 해소(수용 가능한 구조 부채), SRP 개선 |
| scope | LOW | 범위 정합, 유일 이탈은 무관 plan 파일 동봉(무해) |
| side_effect | LOW | 응답 계약 변경 전 소비자 전파 확인, 시그니처 변경 NestJS 주입 한정 |
| maintainability | LOW | DRY/SRP 적극 개선, BCRYPT_ROUNDS 양쪽 중복(INFO) |
| testing | LOW | 커버리지 견고하나 순서 불변식·env 격리·e2e 종속 보강 3건(WARNING) |
| documentation | LOW | JSDoc/Swagger/spec 동기 완비, user-guide deferral 추적됨 |
| database | LOW | 스키마/마이그레이션 무변경, 비트랜잭션이나 fail-safe 방향 |
| concurrency | LOW | await 누락 없음, bulk revoke 원자적, 부분 실패 안전측 수렴 |
| api_contract | LOW | change-password 응답 breaking change(내부 소비자 전파 완료, WARNING) |
| user_guide_sync | LOW | semantic 회색 지대 1건(신규 동작 문서 부재), e2e 동반 충족 |

## 발견 없는 에이전트

없음(모든 reviewer 가 INFO 이상 발견을 보고했으나 security·requirement 는 위험도 NONE).

## 권장 조치사항
1. (Testing) `rotateSessionAfterPasswordChange` 의 revoke→issue 호출 순서 불변식을 `invocationCallOrder` 로 단언 추가 — 옵션 B 보안 핵심 회귀 방지 (WARNING #1).
2. (Testing) 3개 컨트롤러 spec 에 `TRUST_CF_CONNECTING_IP` env reset 가드 추가 또는 IP 단언 완화 — 테스트 격리 강화 (WARNING #2).
3. (Testing) e2e 두 번째 테스트 401 단언에 `code === 'INVALID_PASSWORD'` 추가 — 인증 실패와 구분 (WARNING #3).
4. (API Contract) frontend 외 change-password 소비자 부재 확인 — 없으면 추가 조치 불요 (WARNING #4).
5. (선택/후속) BCRYPT_ROUNDS 공용 util 단일화, 비밀번호 변경 user-guide 안내 1줄 추가, forwardRef 순환 경계 관리.

## 라우터 결정

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (12명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing
- **제외**: performance(핫패스·대량 데이터 없음), dependency(신규 외부 의존성 없음)
