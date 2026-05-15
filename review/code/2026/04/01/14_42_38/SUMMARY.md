# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 보안/동시성 이슈는 해결되었으나, 아키텍처 레이어 경계 위반·테스트 누락·RESOLUTION.md 허위 기재가 잔존

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | Open Redirect 가능성 — `//evil.com`처럼 `/`로 시작하는 프로토콜 상대 URL이 `pathname.startsWith("/")` 검증을 통과함 | `auth-provider.tsx` — redirect 파라미터 생성부 | 로그인 성공 후 redirect 소비 지점에서 `new URL(redirect, window.location.origin).pathname`만 사용하도록 강제 |
| 2 | Security | Refresh Token을 Request Body로도 수락 — 서버 액세스 로그·리버스 프록시 캐시에 토큰이 노출될 수 있어 HttpOnly 쿠키 격리 효과 무력화 | `auth.controller.ts:83-84`, `refresh-token.dto.ts` | Body fallback 제거 검토. 유지 시 해당 엔드포인트 액세스 로그에서 request body 기록 비활성화 |
| 3 | Architecture | `client.ts` SRP 위반 — HTTP 클라이언트·토큰 관리·인터셉터·refresh 중복 방지·세션 복원 상태·리다이렉트 7가지 책임 집중 | `frontend/src/lib/api/client.ts` 전체 | 토큰 관리를 `tokenStore.ts`로, 세션 복원 플래그·리다이렉트를 `sessionManager.ts`로 분리 |
| 4 | Architecture | `AuthProvider`(Presentation)가 API 인프라 내부 플래그(`sessionRestoreInProgress`)를 직접 제어 — 레이어 경계 역전 | `auth-provider.tsx:8` | `authApi.restoreSession()` 형태로 세션 복원 로직을 서비스 레이어에 캡슐화, `AuthProvider`는 결과만 수신 |
| 5 | Concurrency | refresh 실패 시 N개의 대기 요청이 각각 독립적으로 `setAccessToken(null)` 및 `window.location.href` redirect를 중복 실행 | `client.ts` — response interceptor catch block | refresh 실패 처리를 `doRefresh()` catch 내부로 통합하여 단일 실행 보장 후 re-throw |
| 6 | Concurrency | `restoreSession`의 `getMe()` 호출이 401 반환 시 인터셉터가 이미 소비된 refresh cookie로 재시도 유발 — rotate 방식이면 2번째 refresh 실패 | `auth-provider.tsx` — `usersApi.getMe()` 호출부, `client.ts` — interceptor | `sessionRestoreInProgress === true`일 때 인터셉터가 모든 401 auto-refresh를 억제하도록 조건 확장 |
| 7 | Testing | `sessionRestoreInProgress` 플래그 생명주기(`true` → finally에서 `false`) 검증 없음, 특히 실패 경로 미검증 | `auth-provider.test.tsx` 전체 | `setSessionRestoreInProgress`가 `nthCalledWith(1, true)`, `nthCalledWith(2, false)` 순으로 호출되는지 assertion 추가 |
| 8 | Testing | `refreshPromise` 중복 방지 핵심 동시성 로직 테스트 완전 누락 — 동시 401 발생 시 `/auth/refresh`가 1회만 호출됨을 검증하지 않음 | `frontend/src/lib/api/__tests__/client.test.ts` | 동시 401 시뮬레이션 후 `/auth/refresh` 호출 횟수 검증 테스트 추가 |
| 9 | Testing | Backend `auth.controller.ts` 변경(토큰 없을 시 `TOKEN_INVALID` 401, `clearCookie` path 추가)에 대한 테스트 전무 | `auth.controller.ts:83-89` | 컨트롤러 또는 e2e 테스트에 "cookie·body 모두 없는 요청 → 401 TOKEN_INVALID" 케이스 추가 |
| 10 | Testing | `RefreshTokenDto` optional 변경에 대한 DTO validation 동작 테스트 누락 | `refresh-token.dto.ts` | `plainToClass` + `validate()`로 빈 body 전송 시 validation 에러 없음을 검증 |
| 11 | API Contract | `refreshToken` required → optional 전환으로 동일 입력에 대한 응답 코드가 400 → 401로 변경 — 기존 클라이언트 에러 처리 분기 영향 | `refresh-token.dto.ts`, `auth.controller.ts` | 변경 의도는 타당. API 문서(Swagger) 반영 및 기존 클라이언트 마이그레이션 가이드 필요 |
| 12 | API Contract | `UnauthorizedException`에 객체를 전달 시 `message` 필드가 문자열이 아닌 객체로 중첩 — 프로젝트 에러 응답 스키마 불일치 가능성 | `auth.controller.ts:88` | 글로벌 예외 필터 동작 검증. 없다면 `throw new UnauthorizedException('No refresh token provided')` 형태로 단순화하거나 글로벌 필터 도입 |
| 13 | Requirements | RESOLUTION.md가 실제 구현과 불일치 — ①sessionStorage를 "유지"로 기록했지만 실제 제거됨, ②`isTokenExpired()` "추가"로 기록했지만 코드에 없음 | `review/2026-04-01_12-44-24/RESOLUTION.md` | RESOLUTION.md의 WARNING #1("sessionStorage 제거 — in-memory 방식으로 복귀"), WARNING #6("미조치 또는 불필요")으로 수정 |
| 14 | Requirements | `restoreSession` `finally` 블록에서 `setLoading(false)` 미호출 — 로딩 상태 해제가 `setAuthenticated()`/`logout()` 내부 구현에 암묵적으로 의존 | `auth-provider.tsx` — `restoreSession` finally 블록 | `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `initAttempted.current` 중복 초기화 방지(re-render 시 restoreSession 1회만 호출) 테스트 없음 | `auth-provider.tsx:22-23` | re-render 후 `authApi.refresh` 호출 횟수 = 1 검증 테스트 추가 |
| 2 | Testing | `isAuthenticated=true` 시 restoreSession skip 경로 테스트 없음 | `auth-provider.tsx:21` | 인증 상태 preset 후 `authApi.refresh` 미호출 검증 |
| 3 | Testing | `sessionRestoreInProgress=true`일 때 인터셉터 redirect 억제 동작 미검증 | `client.test.ts` | setter 동작 및 redirect 억제 케이스 테스트 추가 |
| 4 | Documentation | `setSessionRestoreInProgress`, `doRefresh`, `setAccessToken`, `getAccessToken` 함수에 JSDoc 없음 | `client.ts` | 함수별 용도·호출 조건·`null` 전달 시 동작 등 JSDoc 추가 |
| 5 | Documentation | `auth.controller.ts` 엔드포인트에 Swagger 데코레이터 없음 — 특히 신규 `401 TOKEN_INVALID` 응답 스펙 미문서화 | `auth.controller.ts` 전체 | `@ApiUnauthorizedResponse` 등 추가 또는 spec 문서에 에러 코드 명세 보완 |
| 6 | Documentation | `RefreshTokenDto.refreshToken` optional 이유(쿠키 우선·body 폴백) 미문서화 | `refresh-token.dto.ts` | 필드 위에 의도 설명 주석 추가 |
| 7 | Documentation | `setRefreshTokenCookie`의 30일/7일 매직 넘버 인라인 하드코딩 | `auth.controller.ts:127-128` | `REMEMBER_ME_COOKIE_MAX_AGE`, `DEFAULT_COOKIE_MAX_AGE` 상수로 추출 |
| 8 | Architecture | `doRefresh()`가 동일 `apiClient` 인스턴스 재귀 호출 — 인터셉터 재진입 경로에서 오류 처리 책임 경계 불명확 | `client.ts:49-56` | refresh 전용 axios 인스턴스(`refreshClient`) 분리 고려 |
| 9 | Architecture | `refreshPromise`·`sessionRestoreInProgress`·`accessToken` 모듈 레벨 가변 상태 — SSR 환경 공유 및 테스트 격리 문제 | `client.ts` 상단 | 클래스/팩토리 함수로 캡슐화 또는 단기적으로 `__resetForTesting()` export |
| 10 | Maintainability | 쿠키 타입 캐스팅 `(req as unknown as { cookies: … }).cookies?.refreshToken` 패턴이 `logout`, `refresh`에 중복 | `auth.controller.ts:65, 83` | `private getCookieToken(req): string \| undefined` 헬퍼 메서드로 추출 |
| 11 | Maintainability | `setSessionRestoreInProgress`와 인터셉터 redirect 억제 간 암묵적 결합 — 함수명만으로 부작용 불명확 | `client.ts:37-39, 85` | 함수 선언부에 `// Suppresses interceptor redirect during session restore` 주석 추가 |
| 12 | Maintainability | `client.test.ts`의 `vi.resetModules()` + dynamic import 패턴 — 테스트 증가 시 실행 시간 선형 증가 | `client.test.ts:7-11` | 테스트 수 증가 시 `client.ts`에 `__resetForTest()` export 방식으로 전환 |
| 13 | Requirements | `@IsString()` 이 `@IsOptional()` 위에 선언 — class-validator 관례와 역순 | `refresh-token.dto.ts` | `@IsOptional()` → `@IsString()` 순서로 변경 |
| 14 | Requirements | `/login` 외 공개 경로(`/register`, `/forgot-password`)에서 refresh 실패 시도 불필요한 리다이렉트 발생 가능 | `auth-provider.tsx` — catch 블록 | 공개 경로 목록을 배열로 관리하거나 공개 경로 패턴 일관 적용 |
| 15 | Performance | `doRefresh()`에서 불필요한 빈 객체 `{}` body 직렬화 | `client.ts` — `doRefresh()` | `apiClient.post("/auth/refresh")` 또는 `undefined` 전달로 변경 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Architecture | **MEDIUM** | SRP 위반, 레이어 경계 역전, `doRefresh` 재귀 호출 |
| Testing | **MEDIUM** | `sessionRestoreInProgress` 생명주기·`refreshPromise` 동시성·백엔드 변경 테스트 전무 |
| Concurrency | **LOW** | refresh 실패 시 N중 redirect, `getMe()` 401로 인한 이중 refresh 경로 |
| Security | **LOW** | Open Redirect 소비 지점 미확인, Body refresh token 로그 노출 |
| Side Effect | **LOW** | DTO optional 변경의 호출자 영향, `doRefresh` 인터셉터 재진입 |
| API Contract | **LOW** | 400→401 응답 코드 변경, UnauthorizedException 응답 구조 불일치 |
| Requirements | **LOW** | RESOLUTION.md 허위 기재, `setLoading(false)` 암묵적 의존 |
| Documentation | **LOW** | 신규 공개 함수 JSDoc 없음, Swagger 미반영 |
| Performance | **LOW** | 빈 body 직렬화 (실질 영향 미미) |
| Maintainability | **LOW** | 쿠키 캐스팅 중복, 암묵적 결합 관계 |
| Dependency | **NONE** | 신규 외부 의존성 없음, sessionStorage 제거 확인 |
| Scope | **NONE** | 모든 변경이 단일 목적 내 적절 |
| Database | **NONE** | 해당 없음 |

---

## 발견 없는 에이전트

- **Database** — 변경사항이 데이터베이스 레이어와 무관
- **Scope** — 불필요한 범위 이탈 없음, 모든 변경이 목적에 집중
- **Dependency** — 신규 외부 패키지 없음, sessionStorage 의존성 제거 확인

---

## 권장 조치사항

1. **(즉시)** `RESOLUTION.md` 허위 기재 수정 — WARNING #1(sessionStorage 유지→제거), WARNING #6(isTokenExpired 추가→미구현)을 실제 구현에 맞게 재작성
2. **(즉시)** `restoreSession` `finally` 블록에 `setLoading(false)` 명시적 추가 — 스토어 구현 암묵적 의존 제거
3. **(즉시)** `sessionRestoreInProgress=true` 시 인터셉터의 모든 401 auto-refresh 억제 — `getMe()` 401로 인한 이중 refresh 경로 차단
4. **(단기)** 누락 테스트 추가 — `sessionRestoreInProgress` 생명주기, `refreshPromise` 중복 방지, 백엔드 `TOKEN_INVALID` 401, `RefreshTokenDto` optional validation
5. **(단기)** refresh 실패 처리를 `doRefresh()` catch 내부로 통합 — N중 `setAccessToken(null)` 및 redirect 중복 실행 제거
6. **(단기)** Open Redirect 소비 지점 확인 및 `new URL(redirect, origin).pathname` 강제 검증 추가
7. **(단기)** Body refresh token 수락 제거 검토 또는 해당 엔드포인트 request body 로깅 비활성화
8. **(단기)** `UnauthorizedException` 응답 구조가 프로젝트 에러 컨벤션과 일치하는지 글로벌 예외 필터 동작 검증
9. **(중기)** `client.ts` SRP 분리 — 토큰 관리(`tokenStore.ts`)·세션 복원(`sessionManager.ts`) 분리, `AuthProvider`가 인프라 내부 플래그를 직접 제어하는 레이어 경계 역전 해소
10. **(중기)** 쿠키 타입 캐스팅 헬퍼 메서드 추출, 매직 넘버 상수화, 핵심 함수 JSDoc 추가