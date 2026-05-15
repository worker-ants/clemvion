# Code Review 통합 보고서

## 전체 위험도
**HIGH** — OAuth 인증 플로우 전반에 걸쳐 보안(토큰 URL 노출, stub 모드 우회), 데이터 정합성(트랜잭션 원자성 깨짐), 테스트 커버리지 미비, 프론트엔드 콜백 페이지 미구현 등 복합적 고위험 이슈 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | Access Token을 URL 쿼리 파라미터(`?token=...`)로 전달 — 브라우저 히스토리, 서버 액세스 로그, Referer 헤더에 토큰 기록됨 | `auth.controller.ts` — `oauthCallback()` | 단기 TTL 일회용 코드로 교환하는 패턴 도입, 또는 최소한 프론트엔드 `/callback`에서 `history.replaceState` 즉시 수행 강제 |
| 2 | 보안 | `OAUTH_STUB_MODE=true` 시 실제 OAuth 제공자 검증 없이 임의 이메일로 인증 우회 가능. `process.env` 직접 참조로 타입 안전 검증 없음 | `auth-oauth.service.ts` — `exchangeCodeForToken()`, `fetchProfile()` | `ConfigService`를 통한 타입 안전 참조로 변경, production 프로파일에서 강제 false 유효성 검증 추가 |
| 3 | 보안 | `generateTokens` `private → public` 변경으로 모듈 내 임의 서비스가 인증 검증 없이 토큰 발급 가능 | `auth.service.ts:296` | `generateTokens`는 private 유지 후 OAuth 전용 public 메서드(`issueTokensForOauthUser`) 추가, 또는 `TokenService`로 분리 |
| 4 | 데이터 정합성 | `resolveUser` 내 `usersService.create()`가 트랜잭션 `manager`를 사용하지 않아 워크스페이스 생성 실패 시 고아 사용자(orphaned user) 생성 가능 | `auth-oauth.service.ts` — `resolveUser()` | `manager.getRepository(User).save(...)` 직접 사용 또는 `UsersService.create`에 `EntityManager` 오버로드 추가 (`AuthService.verifyEmail`의 기존 패턴 참고) |
| 5 | 동시성 | `resolveUser`의 `findByOauth → findByEmail → create` 패턴이 트랜잭션 경계 밖에서 수행되어 동시 요청 시 중복 User/Workspace 레코드 생성 가능 (TOCTOU) | `auth-oauth.service.ts` — `resolveUser()` | `(oauth_provider, oauth_provider_id)` 복합 유니크 제약 + 충돌 예외 처리, 또는 `SERIALIZABLE` 격리 수준 트랜잭션 적용 |
| 6 | 요구사항 | 프론트엔드 `/callback` 페이지 미구현 — OAuth 플로우 마지막 단계(토큰 수신 → URL 정리 → `/dashboard` 리다이렉트) 누락 | `frontend/src/app/callback/` (미존재) | `frontend/src/app/callback/page.tsx` 생성: `token`/`error` 파싱, `setAccessToken()` + 프로필 조회 + `/dashboard` 리다이렉트 구현 |
| 7 | 테스트 | `AuthController`의 `beginOauth`, `oauthCallback` 엔드포인트 테스트 전무 | `auth.controller.spec.ts` | 정상 리다이렉트, `rememberMe`, 지원하지 않는 provider, `providerError`, 각 에러 코드별 리다이렉트 URL 검증 테스트 추가 |
| 8 | 테스트 | `mapOauthError` 함수 에러 코드 매핑 로직 미테스트 | `auth.controller.ts` 파일 하단 | 함수 export 후 단위 테스트 또는 `oauthCallback` 통합 테스트로 각 에러 코드 → URL 매핑 검증 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `console.log('[DEBUG refresh]')` 에서 토큰 프리픽스 노출 (주석: "Remove after verifying refresh works") | `auth.service.ts` — `refresh()` | 해당 `console.log` 즉시 제거 |
| 2 | 보안 | `forgotPassword`에서 재설정 토큰 평문 로그 출력 (`[DEV] Password reset token for ...`) + 메일 전송 미구현 | `auth.service.ts` — `forgotPassword()` | DEV 로그 즉시 제거, 메일 전송 구현 전 기능 비활성화 또는 명시적 예외 처리 |
| 3 | 보안 | `provider` 파라미터가 라우트 레벨에서 검증되지 않아 임의 문자열 통과 → 로그에 신뢰할 수 없는 파라미터 삽입(Log Injection) | `auth.controller.ts` — `beginOauth()`, `oauthCallback()` | `ParseEnumPipe` 또는 커스텀 파이프로 컨트롤러 레벨 검증 추가 |
| 4 | 동시성 | 이메일 기반 사용자의 OAuth 연결 시 `usersService.update` 후 `generateTokens` 실패 시 `oauthProvider` 연결된 채 토큰 없는 불일치 상태 | `auth-oauth.service.ts` — `resolveUser()` `byEmail` 분기 | 업데이트 경로도 트랜잭션으로 감싸거나, 조건부 업데이트 (`WHERE oauth_provider IS NULL`) 적용 |
| 5 | 동시성 | 동일 이메일에 서로 다른 provider가 동시 도달 시 `oauthProvider`/`oauthProviderId` last-write-wins 경쟁 | `auth-oauth.service.ts` — `resolveUser()` `byEmail` 분기 | `UPDATE ... WHERE oauth_provider IS NULL` 조건부 업데이트 또는 `@VersionColumn` optimistic locking 적용 |
| 6 | 성능 | `users` 테이블 `(oauth_provider, oauth_provider_id)` 복합 인덱스 누락 — `findByOauth` 호출 시 풀 스캔 | `users.service.ts` — `findByOauth()`, V013 마이그레이션 | 별도 마이그레이션으로 `CREATE INDEX idx_users_oauth ON users (oauth_provider, oauth_provider_id)` 추가 |
| 7 | 성능 | `purgeExpired()`가 매 `beginAuth` 호출마다 실행 — 고트래픽 시 INSERT/DELETE 경합 | `auth-oauth.service.ts` — `beginAuth()` | BullMQ cron job으로 분리하거나 샘플링(`Math.random() < 0.01`)으로 호출 빈도 제한 |
| 8 | API 계약 | 프론트엔드 `API_BASE_URL` 폴백 포트 불일치: `3001` vs `example.env`의 `APP_PORT=3011` | `login-form.tsx:34`, `register-form.tsx:37` | 폴백을 `http://localhost:3011/api`로 수정 또는 `frontend/.env`에 `NEXT_PUBLIC_API_URL` 명시 |
| 9 | 스펙 | 스펙 §7.1 라우트 가드 테이블이 `/callback`을 공개 경로로 미등록 — 미인증 사용자가 OAuth 콜백 후 `/login`으로 튕겨날 수 있음 | `spec/2-navigation/10-auth-flow.md §7.1` | 스펙 §7.1 업데이트 + 프론트엔드 미들웨어에 `/callback`을 명시적 공개 경로로 등록 |
| 10 | 아키텍처 | `fetchProfile` 내 프로바이더별 대형 if/else 분기 — 새 프로바이더 추가 시 메서드 직접 수정 필요 (OCP 위반) | `auth-oauth.service.ts` — `fetchProfile()` | 프로바이더별 Strategy 클래스 추출 및 `Map<AuthOAuthProvider, OAuthProviderStrategy>` 관리 |
| 11 | 아키텍처 | `ConfigService` vs `process.env` 혼용 — 테스트에서 `process.env.OAUTH_STUB_MODE` 직접 변조 후 `afterEach` 복원 없어 테스트 간 오염 위험 | `auth-oauth.service.ts`, `auth-oauth.service.spec.ts:37` | 모든 환경 변수를 `ConfigService`로 통일, 테스트는 `afterEach`에서 환경 복원 |
| 12 | 유지보수 | Stub 모드에서도 `requireEnv('GOOGLE_CLIENT_ID')` 호출 — 빈 값 설정 시 `InternalServerErrorException` 발생 | `auth-oauth.service.ts` — `beginAuth()` | stub 모드에서 placeholder(`'stub-client'`) 사용 또는 `process.env[key] ?? 'stub-client'` 패턴 적용 |
| 13 | 테스트 | `handleCallback`의 `rememberMe: true` 전파 미검증 — 모든 테스트가 `rememberMe: false` 고정 | `auth-oauth.service.spec.ts` | `rememberMe: true` 케이스 추가, `generateTokens` 호출 인자 검증 |
| 14 | 테스트 | `UsersService.findByOauth` 신규 메서드 테스트 누락 | `users.service.ts:20-27` | `users.service.spec.ts`에 매칭 성공/실패 케이스 단위 테스트 추가 |
| 15 | 테스트 | 프론트엔드 `startOauth` 함수(`window.location.href` 변경) 테스트 없음 | `login-form.tsx:54-57`, `register-form.tsx:37-39` | `jsdom` 환경에서 `window.location.href` 모킹 후 클릭 이벤트 검증 |
| 16 | 의존성 | `resolveUser` 트랜잭션 내 `usersService.create`가 해당 `EntityManager`를 사용하지 않아 트랜잭션 원자성 미보장 (dependency 관점) | `auth-oauth.service.ts:73-78` | `UsersService`에 `EntityManager`를 받는 오버로드 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수 | `API_BASE_URL` 상수 중복 선언 — 두 컴포넌트에 동일 상수 중복 | `login-form.tsx:34`, `register-form.tsx:36` | `@/lib/constants.ts` 또는 `@/lib/api/client.ts`로 추출 |
| 2 | 유지보수 | `startOauth` OAuth 리다이렉트 로직 중복 (`rememberMe` 처리 차이만 존재) | `login-form.tsx:54-56`, `register-form.tsx:38-40` | 공통 훅 `useOAuthRedirect(mode)` 또는 유틸 함수로 추출 |
| 3 | 유지보수 | `mapOauthError` 함수가 컨트롤러 클래스 외부 모듈 수준 함수로 선언 | `auth.controller.ts:431-453` | 클래스 내 `private mapOauthError(err: unknown): string`으로 이동 또는 `auth-oauth.errors.ts`로 분리 |
| 4 | 문서화 | `AuthOauthService` 공개 메서드(`beginAuth`, `handleCallback`, `isSupportedProvider`)에 JSDoc 누락 | `auth-oauth.service.ts` | 각 메서드에 파라미터·반환값·부작용 설명 JSDoc 추가 |
| 5 | 문서화 | `generateTokens`의 `private → public` 변경 의도를 설명하는 주석 없음 | `auth.service.ts:296` | `@internal` 주석 또는 호출 범위 명시 주석 추가 |
| 6 | 문서화 | `example.env`의 `OAUTH_STUB_MODE` 전환 시 단계별 체크리스트 없음 | `backend/example.env:63-70` | redirect URI 등록, CLIENT_ID/SECRET 설정 등 체크리스트 주석 추가 |
| 7 | 문서화 | 스펙에 Access Token URL 파라미터 전달의 보안 노트 (`history.replaceState` 강제, HTTPS 전제) 미기재 | `spec/2-navigation/10-auth-flow.md §5.3` | 보안 노트 섹션 추가 |
| 8 | 문서화 | 마이그레이션 파일에 만료 레코드 정리 정책(애플리케이션 레벨 fire-and-forget) 미기재 | `V013__auth_oauth_state.sql:9` | 인덱스 생성 구문 위에 정리 방식 설명 주석 추가 |
| 9 | 성능 | `configService.get('app.frontendUrl')` 매 요청마다 호출 — 생성자 캐싱 불일치 | `auth.controller.ts` — `oauthCallback()` | 생성자에서 `private readonly frontendUrl` 캐싱 |
| 10 | 성능 | `redirectUri()`, `requireEnv()` 동일 요청 내 중복 호출 | `auth-oauth.service.ts` — `beginAuth()`, `exchangeCodeForToken()` | 값을 인자로 전달하거나 내부 캐시 사용 |
| 11 | 보안 | PKCE(`code_challenge`/`code_verifier`) 미구현 — 서버사이드 플로우이므로 즉각적 위험은 아니나 Google 권장 | `auth-oauth.service.ts` — `beginAuth()`, `exchangeCodeForToken()` | `code_verifier`를 state와 함께 DB 저장 후 인가 URL에 `code_challenge` 포함 |
| 12 | 데이터베이스 | `state` 소비 시 `WHERE state = $1 AND expires_at > NOW()` 대신 삭제 후 만료 확인 — 만료된 state를 소비 후 에러 반환 | `auth-oauth.service.ts` — `handleCallback()` | `WHERE state = $1 AND expires_at > NOW()`로 변경하여 만료된 row 미소비 |
| 13 | 의존성 | Node.js 18+ 내장 `fetch` 사용 — `package.json`에 `engines` 필드 미명시 | `auth-oauth.service.ts` 전체 | `package.json`에 `"engines": { "node": ">=18" }` 명시 |
| 14 | 테스트 | `beginAuth` 저장 state 객체 내용(provider, mode, rememberMe, expiresAt) 미검증 | `auth-oauth.service.spec.ts` | `expect(stateRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}))` 검증 추가 |
| 15 | 테스트 | `purgeExpired` 내부 동작(`stateRepo.delete` 호출, 실패 시 경고 로그) 미검증 | `auth-oauth.service.spec.ts` | `purgeExpired` 단위 테스트 추가 |
| 16 | 설계 | `@Res()` without `passthrough: true` — `beginOauth`, `oauthCallback`에서 전역 인터셉터(로깅 등) 미동작 | `auth.controller.ts` | 의도적 설계라면 주석으로 명시, 로깅 커버리지 공백 인지 필요 |
| 17 | 설계 | `AuthOauthService`가 `exports` 배열에 미포함 | `auth.module.ts` | 의도적 설계라면 주석으로 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | **HIGH** | Access Token URL 노출, OAUTH_STUB_MODE 우회, generateTokens public 노출, DEBUG 토큰 로그 |
| testing | **HIGH** | OAuth 컨트롤러 엔드포인트 테스트 전무, mapOauthError 미테스트 |
| requirement | **HIGH** | 프론트엔드 /callback 페이지 미구현, 트랜잭션 원자성, 라우트 가드 불일치 |
| concurrency | **HIGH** | resolveUser TOCTOU 경쟁 조건 — 중복 User/Workspace 생성 가능 |
| side_effect | **HIGH** | Access Token URL 노출(로그 기록), 트랜잭션 불일치, process.env 테스트 오염 |
| database | **MEDIUM** | 트랜잭션 원자성 미보장, purgeExpired 누적, oauth 컬럼 마이그레이션 확인 필요 |
| performance | **MEDIUM** | purgeExpired 매 요청 실행, findByOauth 풀스캔, 토큰 발급 시 DB 호출 누적 |
| api_contract | **MEDIUM** | Access Token URL 노출, provider 검증 위치, 프론트엔드 기본 포트 불일치 |
| architecture | **MEDIUM** | 트랜잭션 원자성, OCP 위반(fetchProfile 분기), ConfigService 혼용 |
| dependency | **MEDIUM** | 트랜잭션 원자성(UsersService EntityManager 미전달) |
| maintainability | **LOW** | API_BASE_URL 중복, generateTokens 가시성 불명확, process.env 혼용 |
| documentation | **LOW** | 공개 메서드 JSDoc 누락, 변경 의도 주석 부재, 보안 노트 누락 |
| scope | **LOW** | /callback 페이지 미구현(미완성), generateTokens 가시성 부수효과 |

---

## 발견 없는 에이전트
없음 — 모든 13개 에이전트가 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시] 프론트엔드 `/callback` 페이지 구현** — OAuth 플로우 완성을 위한 필수 단계. `token` 파싱 → `setAccessToken()` → `history.replaceState` → `/dashboard` 리다이렉트. 스펙 §7.1 라우트 가드에 `/callback` 공개 경로 등록 병행

2. **[즉시] `resolveUser` 트랜잭션 원자성 복구** — `manager.getRepository(User).save(...)` 직접 사용으로 고아 사용자 생성 방지. `(oauth_provider, oauth_provider_id)` DB 복합 유니크 제약으로 TOCTOU 방어

3. **[즉시] DEBUG 로그 제거** — `auth.service.ts`의 `[DEBUG refresh]` 토큰 프리픽스 로그, `forgotPassword`의 평문 재설정 토큰 로그 즉시 제거

4. **[즉시] 프론트엔드 기본 포트 수정** — `login-form.tsx`, `register-form.tsx`의 `API_BASE_URL` 폴백을 `http://localhost:3011/api`로 수정

5. **[단기] `generateTokens` 접근 제어 재설계** — `private` 유지 후 `AuthService.issueTokensForOauthUser(user, rememberMe)` public 메서드 추가

6. **[단기] `OAUTH_STUB_MODE` ConfigService 통일** — `process.env` 직접 참조를 `ConfigService`로 전환, stub 모드에서 CLIENT_ID 검증 완화, 테스트의 `afterEach` 환경 복원 추가

7. **[단기] 컨트롤러 테스트 추가** — `beginOauth`, `oauthCallback` 전체 분기(성공, 각 에러 코드, `rememberMe`) 및 `mapOauthError` 에러 매핑 테스트

8. **[단기] `provider` 파라미터 컨트롤러 레벨 검증** — `ParseEnumPipe` 적용으로 Log Injection 및 서비스 레이어 도달 방지

9. **[단기] `users` 테이블 OAuth 복합 인덱스 마이그레이션** — `CREATE INDEX idx_users_oauth ON users (oauth_provider, oauth_provider_id)` 추가, `oauth_provider`/`oauth_provider_id` 컬럼 존재 여부 확인

10. **[중기] `purgeExpired` 스케줄러 분리** — `@Cron` 데코레이터 또는 BullMQ job으로 주기적 정리, `beginAuth`마다 실행되는 현행 구조 제거

11. **[중기] `API_BASE_URL` 공통 모듈 추출** — `@/lib/constants.ts`로 통합, `startOauth` 로직 공통 훅으로 추출

12. **[중기] `state` 소비 쿼리 개선** — `WHERE state = $1 AND expires_at > NOW()`로 변경하여 만료된 state 소비 방지