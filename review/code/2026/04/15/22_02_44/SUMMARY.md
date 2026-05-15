# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 기능 구현은 충실하나, OAUTH_STUB_MODE 프로덕션 우회 위험과 Access Token URL 노출 등 보안 이슈 존재

## Critical 발견사항

없음

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `OAUTH_STUB_MODE=true` 프로덕션 설정 시 OAuth 인증 완전 우회 — stub 모드에서 임의 이메일로 계정 생성 가능 | `auth-oauth.service.ts` — `getEnabledProviders`, `exchangeCodeForToken`, `fetchProfile` | 앱 부트스트랩 시 `NODE_ENV=production && OAUTH_STUB_MODE=true`이면 즉시 서버 중단 가드 추가 |
| 2 | 보안 | Access Token이 URL 쿼리 파라미터로 전달 — 브라우저 히스토리, 서버 로그, CDN 로그에 기록될 수 있음 | `auth.controller.ts` — `oauthCallback()` | 단기 일회용 교환 코드(exchange code) 방식으로 변경하여 토큰을 URL에서 분리 |
| 3 | 보안 | `GET /api/auth/oauth/providers` 공개 엔드포인트가 서버 OAuth 설정 정보를 CDN 캐싱 허용(`public, max-age=300`)으로 노출 | `auth.controller.ts` — `getOauthProviders()` | `Cache-Control: private` 또는 빌드 타임 환경변수 방식 검토 |
| 4 | 아키텍처 | `OAuthProvider` 타입이 세 파일에 중복 정의 — provider 추가 시 불일치 위험 | `auth-providers.ts:9`, `login-form.tsx:35`, `register-form.tsx:38` | `auth-providers.ts`에서 export 후 두 폼 컴포넌트에서 `import type { OAuthProvider }`로 재사용 |
| 5 | 유지보수성 | `LoginForm`/`RegisterForm` SSO UI 렌더링 로직이 픽셀 단위로 동일하게 복제됨 | `login-form.tsx:159–204`, `register-form.tsx:198–243` | `OAuthButtons` 공통 컴포넌트로 분리하여 두 폼에서 공유 |
| 6 | 아키텍처 | `Cache-Control` 헤더를 `res.setHeader()`로 직접 조작 — NestJS 응답 추상화 우회 | `auth.controller.ts:376` | `@Header('Cache-Control', 'public, max-age=300')` 데코레이터로 대체, `res` 파라미터 제거 가능 |
| 7 | 아키텍처 | `getEnabledProviders`가 주입된 `ConfigService`를 우회하여 `process.env`를 직접 읽음 | `auth-oauth.service.ts:80-87` | `ConfigService.get<string>(...)`으로 통일하거나 최소한 신규 메서드에서 일관성 유지 |
| 8 | 환경변수 | 서버 컴포넌트에서 `NEXT_PUBLIC_API_URL` 사용 — k8s/컨테이너 환경에서 서버→서버 통신에 외부 URL 경유, 라우팅 장애 가능 | `auth-providers.ts:11` | 서버 전용 `INTERNAL_API_URL`(또는 `API_URL`) 환경변수 추가, `INTERNAL_API_URL ?? NEXT_PUBLIC_API_URL` 순으로 fallback |
| 9 | 동시성 | 동일 이메일 신규 OAuth 사용자 동시 생성 시 유니크 제약 위반으로 500 응답 | `auth-oauth.service.ts` — `resolveUser()` | catch 블록에서 unique violation 감지 후 기존 사용자 조회 반환으로 재시도 처리 |
| 10 | 데이터베이스 | `auth_oauth_state.state` 컬럼 인덱스 누락 가능성 — OAuth 콜백 경로에서 풀스캔 발생 | `auth-oauth.service.ts` — `handleCallback` | `CREATE UNIQUE INDEX ON auth_oauth_state(state)` 추가 |
| 11 | 테스트 | `getEnabledProviders` 빈 배열 케이스에서 `Cache-Control` 헤더 설정 검증 누락 | `auth.controller.spec.ts:108` | 빈 배열 테스트에 `expect(mockRes.setHeader).toHaveBeenCalledWith(...)` 추가 |
| 12 | 문서화 | `API_BASE_URL` 상수가 세 파일에 중복 선언 — 서버 컴포넌트 전용임에도 분리 근거 미표기 | `auth-providers.ts:11`, `login-form.tsx:36`, `register-form.tsx:38` | 공통 상수 파일로 통합하거나 분리 의도를 주석으로 명시 |
| 13 | 코드 품질 | `RegisterForm` 함수 시그니처에 불필요한 `= {}` 기본값 — `LoginForm`과 불일치 | `register-form.tsx:63` | `= {}` 제거하여 `LoginForm`과 동일한 패턴으로 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `fetchEnabledOauthProviders` 단위 테스트 부재 — 정상 응답, non-OK 응답, 네트워크 예외, 누락 필드 등 미검증 | `frontend/src/lib/api/auth-providers.ts` | `auth-providers.test.ts` 생성하여 주요 경로 커버 |
| 2 | 테스트 | `LoginForm`/`RegisterForm`의 `enabledProviders` prop에 따른 UI 분기 로직 컴포넌트 테스트 부재 | `login-form.tsx`, `register-form.tsx` | RTL 기반 테스트로 빈 배열/일부/전체 provider 케이스 검증 |
| 3 | 테스트 | `getEnabledProviders` 테스트에서 `process.env` 직접 변조 후 `afterEach` 미복원 — 테스트 순서 변경 시 취약 | `auth-oauth.service.spec.ts:137-159` | `afterEach`에서 env 명시적 복원 또는 `jest.replaceProperty(process, 'env', ...)` 패턴 사용 |
| 4 | 테스트 | `process.env = originalEnv` 재할당 방식이 불완전할 수 있음 — Node.js 특수 객체 특성 | `auth-oauth.service.spec.ts` — `afterAll` | 개별 키 복원 패턴(`process.env.KEY = originalEnv.KEY`)으로 변경 |
| 5 | 성능 | `getEnabledProviders()`가 매 호출마다 `process.env`를 재조회 | `auth-oauth.service.ts:80-86` | 생성자에서 활성 provider 목록을 한 번 계산하여 인스턴스 변수로 캐시 |
| 6 | 성능 | SSR Cold-start마다 백엔드 내부 HTTP 왕복 발생 — provider 목록은 사실상 정적 데이터 | `auth-providers.ts:15-25` | `revalidate: 3600`으로 늘리거나 Next.js ISR tags를 활용한 배포 시 명시적 revalidate 고려 |
| 7 | 아키텍처 | `auth_oauth_state.state` → `oauth/:provider` 라우트 순서 의존성 — 현재는 올바른 순서이나 명시적 주석 부재 | `auth.controller.ts` | 순서 의존성을 주석으로 명시하여 향후 리팩토링 시 안전 보장 |
| 8 | 동시성 | `void this.purgeExpired()` 미await 호출로 동시 요청 시 불필요한 병렬 purge 쿼리 발생 | `auth-oauth.service.ts` — `beginAuth()` | 현재는 허용 가능한 트레이드오프; 향후 `@nestjs/schedule` 스케줄러 활용 고려 |
| 9 | 데이터베이스 | `auth_oauth_state.expires_at` 인덱스 누락 가능성 — cleanup 쿼리 효율 저하 | `auth-oauth.service.ts` — `purgeExpired` | `expires_at` 컬럼 인덱스 추가 |
| 10 | 데이터베이스 | `resolveUser` 조건부 UPDATE가 트랜잭션 외부 실행 — 동시 provider 바인딩 race 결과가 비결정적 | `auth-oauth.service.ts` — `resolveUser` | 의도된 동작임을 코드 주석으로 명시 (last-write-wins) |
| 11 | 캐싱 | `max-age=300`과 `revalidate: 300`이 backend/frontend에 하드코딩 — TTL 변경 시 두 곳 수정 필요 | `auth.controller.ts:374`, `auth-providers.ts:19` | 상수 선언(`PROVIDERS_CACHE_TTL_SEC = 300`)으로 의도 명시 |
| 12 | 문서화 | `LoginFormProps.enabledProviders` prop에 JSDoc 없음 — 빈 배열 안전 기본값 의도 미표기 | `login-form.tsx:38`, `register-form.tsx:43` | 간단한 JSDoc 추가 권장 (필수 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | 서버 컴포넌트의 `NEXT_PUBLIC_API_URL` 프로덕션 라우팅 장애 가능성, `OAuthProvider` 타입 중복 |
| security | MEDIUM | `OAUTH_STUB_MODE` 프로덕션 우회, Access Token URL 노출, 공개 캐싱 정보 노출 |
| concurrency | LOW | 신규 사용자 동시 생성 시 unique 제약 위반 500 오류 미처리 |
| database | LOW | `auth_oauth_state.state` 인덱스 누락 가능성, `expires_at` 인덱스 누락 |
| maintainability | LOW | `OAuthProvider` 타입 3중 중복, SSO UI 로직 복제, env 직접 접근 일관성 |
| architecture | LOW | `process.env` vs `ConfigService` 혼용, `OAuthProvider` 타입 중복, `Cache-Control` 명령형 처리 |
| testing | LOW | 프론트엔드 테스트 부재(`auth-providers.ts`, 폼 컴포넌트), env 격리 취약 |
| side_effect | LOW | `process.env` 불완전 복원, 라우트 순서 의존성 |
| performance | LOW | Cold-start 네트워크 왕복, `process.env` 반복 접근, 테스트 env 격리 |
| documentation | LOW | `API_BASE_URL` 중복 선언 의도 미표기 |
| api_contract | LOW | 서버 컴포넌트의 `NEXT_PUBLIC_API_URL` 사용 |
| scope | LOW | `= {}` 불필요한 기본값, `process.env` vs `ConfigService` |
| dependency | LOW | `OAuthProvider` 타입·`API_BASE_URL` 중복, `process.env` 직접 접근 |

## 발견 없는 에이전트

없음 (전 에이전트가 발견사항 보고)

## 권장 조치사항

1. **[보안] `OAUTH_STUB_MODE` 프로덕션 가드 추가** — 앱 부트스트랩에서 `NODE_ENV=production && OAUTH_STUB_MODE=true` 조합 감지 시 즉시 서버 중단
2. **[보안] Access Token URL 전달 방식 개선** — 일회용 단기 교환 코드 방식으로 전환하여 로그 기반 토큰 유출 차단
3. **[환경변수] 서버 컴포넌트용 내부 API URL 분리** — `INTERNAL_API_URL` 환경변수 추가, `auth-providers.ts`에서 fallback 처리
4. **[동시성] `resolveUser` 신규 사용자 동시 생성 예외 처리** — unique violation 감지 후 기존 사용자 반환으로 500 오류 방어
5. **[타입] `OAuthProvider` 타입 단일화** — `auth-providers.ts` export를 단일 소스로 사용, 두 폼 컴포넌트에서 import
6. **[테스트] 프론트엔드 테스트 추가** — `auth-providers.ts` 단위 테스트 및 폼 컴포넌트 UI 분기 테스트 작성
7. **[데이터베이스] `auth_oauth_state.state` 유니크 인덱스 추가** — OAuth 콜백 경로 성능 보장
8. **[아키텍처] `Cache-Control` 헤더를 `@Header()` 데코레이터로 전환** — `res` 파라미터 제거로 테스트 단순화
9. **[코드 품질] `RegisterForm` `= {}` 제거 및 SSO UI 로직 `OAuthButtons` 컴포넌트로 분리** — 두 폼 간 일관성 및 유지보수성 확보
10. **[테스트] `getEnabledProviders` 테스트 env 격리 강화** — `afterEach`에서 명시적 복원 또는 `jest.replaceProperty` 패턴 적용