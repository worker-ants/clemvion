# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 세션 복원 중 이중 refresh 경로, 인터셉터 부분 억제, 로딩 상태 암묵적 의존 등 엣지 케이스에서 의도치 않은 로그아웃/무한 스피너를 유발할 수 있는 구조적 결함 존재

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Concurrency / Requirement / Side Effect | `sessionRestoreInProgress`가 리다이렉트만 억제하고 interceptor의 `doRefresh()` 재진입을 막지 않음 — `getMe()` 401 시 이미 소비된 refresh token으로 2차 refresh 시도 → rotate 방식에서 의도치 않은 로그아웃 유발 | `client.ts` response interceptor 조건문, `auth-provider.tsx:34` | 인터셉터 진입 조건에 `!sessionRestoreInProgress` 추가하여 세션 복원 중 401 auto-refresh 전면 억제 |
| 2 | Architecture / Side Effect / Concurrency | `refreshPromise` 실패 시 대기 중이던 N개 요청이 각각 독립적으로 catch block 진입 → `setAccessToken(null)` 및 `window.location.href = "/login"` N회 중복 실행 | `client.ts` response interceptor catch block | 실패 처리를 `doRefresh().catch()` 내부로 통합하여 1회만 실행 |
| 3 | Architecture / Requirement / Side Effect | `restoreSession` finally 블록에서 `setLoading(false)` 미호출 — 로딩 상태 해제가 `setAuthenticated()` / `logout()` 내부 구현에 암묵적 의존, 스토어 변경 시 무한 스피너 위험 | `auth-provider.tsx` `restoreSession()` finally 블록 | `finally { setSessionRestoreInProgress(false); setLoading(false); }` 로 명시적 처리 |
| 4 | Testing | `setSessionRestoreInProgress` 생명주기 검증 부재 — mock만 설정, `true` 설정 후 finally에서 `false` 해제 여부 미검증 (플래그 고착 시 redirect 영구 억제) | `auth-provider.test.tsx` 전체 | `expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true); expect(...).toHaveBeenNthCalledWith(2, false);` 추가 |
| 5 | Testing | `refreshPromise` 중복 방지 로직 미검증 — 동시 401 발생 시 `/auth/refresh` 1회만 호출되는지, `.finally()`로 null 초기화되는지 테스트 없음 | `client.test.ts` 전체 | axios mock adapter를 이용한 인터셉터 레벨 동시성 테스트 추가 |
| 6 | Testing | 백엔드 변경사항 테스트 완전 누락 — `TOKEN_INVALID` 반환 로직, `clearCookie` path 수정 모두 미검증 | `auth.controller.ts:83-89`, `auth.controller.ts:71` | `it("returns 401 TOKEN_INVALID when no token")` / `it("clears refreshToken cookie with correct path")` 추가 |
| 7 | Testing / Requirement | `RefreshTokenDto` optional 변경 검증 누락 — 빈 body 전송 시 validation 통과 여부, 에러 코드 400→401 변경 미검증 | `refresh-token.dto.ts` | `plainToClass` + `validate()` 기반 DTO 단위 테스트 추가 |
| 8 | API Contract / Architecture | `UnauthorizedException({ code, message })` 객체 전달로 응답 `message` 필드가 중첩 객체가 됨 — 프로젝트 에러 응답 컨벤션(`{ data: {...} }`)과 불일치, 클라이언트 에러 핸들러 오동작 가능 | `auth.controller.ts:83-88` | 글로벌 예외 필터 유무 확인 후 없다면 `throw new UnauthorizedException('No refresh token provided')` 단순화 또는 필터 도입 |
| 9 | API Contract | `refreshToken` required→optional 변경으로 동일 입력("토큰 없음")에 대한 HTTP 에러 코드 400→401 변경 (behavioral breaking change) | `refresh-token.dto.ts` + `auth.controller.ts:83-87` | API 문서에 에러 코드 변경 명시, 기존 클라이언트 400 분기 처리 마이그레이션 확인 |
| 10 | Dependency / Requirement / Security | `@IsOptional()` / `@IsString()` 데코레이터 순서 역전 — class-validator 관례 위반, 라이브러리 버전에 따라 `undefined` 값에 `@IsString()` 검증이 먼저 실행되어 예상치 못한 400 에러 가능 | `refresh-token.dto.ts:3-5` | `@IsOptional()` → `@IsString()` 순서로 변경 |
| 11 | Scope / Requirement | RESOLUTION.md 내용이 실제 코드와 불일치 — WARNING #1: "sessionStorage 유지"로 기록했으나 실제 코드에는 sessionStorage 없음. WARNING #6: "`isTokenExpired()` 추가"로 기록했으나 함수 미존재 | `review/2026-04-01_12-44-24/RESOLUTION.md` | WARNING #1: "sessionStorage 제거 — in-memory + HttpOnly cookie refresh 패턴으로 복귀"로, WARNING #6: "미조치 — sessionStorage 제거로 해당 경로 소멸"로 수정 |
| 12 | Security | Refresh Token Body fallback 유지 — Body 전달 토큰은 서버 액세스 로그·리버스 프록시 로그에 기록될 수 있어 HttpOnly 쿠키 보안 격리 무력화 | `auth.controller.ts:83-84` (`dto.refreshToken` fallback) | Body fallback 제거 검토. 쿠키 없으면 즉시 401 반환으로 충분 |
| 13 | Security | Open Redirect — `redirect` 파라미터 소비 지점 미검증. `//evil.com`은 `/`로 시작하므로 현재 `pathname.startsWith("/")` 검증 통과, 로그인 성공 후 소비 지점에서 외부 도메인 리다이렉트 가능 | `auth-provider.tsx` `router.replace(\`/login?redirect=...\`)` 소비 지점 | 소비 지점에서 `redirect?.startsWith("/") && !redirect.startsWith("//")` 검증 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `isAuthenticated=true`일 때 세션 복원 skip 검증 없음 | `auth-provider.tsx:21` | `useAuthStore.setState({ isAuthenticated: true })` 후 `authApi.refresh` 미호출 검증 테스트 추가 |
| 2 | Testing | `initAttempted` ref 중복 방지 검증 없음 — re-render 시 `restoreSession` 1회만 호출되는지 미검증 | `auth-provider.tsx:22-23` | rerender 후 `authApi.refresh` 1회 호출 검증 추가 |
| 3 | Testing | 성공 케이스에서 `setAccessToken("refreshed-token")` 호출 검증 부재 | `auth-provider.test.tsx:60-71` | `expect(setAccessToken).toHaveBeenCalledWith("refreshed-token")` 추가 |
| 4 | Documentation | `setSessionRestoreInProgress`, `doRefresh`, `setAccessToken`/`getAccessToken` JSDoc 없음 — redirect 억제 부작용, finally 리셋 계약 등 비명시적 | `client.ts` 각 함수 선언부 | 각 함수에 목적·부작용·계약 명시하는 JSDoc 추가 |
| 5 | Documentation | `RefreshTokenDto.refreshToken` optional 변경 이유 미문서화, 데코레이터 순서 관례 불일치도 미반영 | `refresh-token.dto.ts` | `/** Optional — controller prefers HttpOnly cookie */` 주석 추가 |
| 6 | Documentation | `refresh` 엔드포인트 `TOKEN_INVALID` 신규 에러 응답이 Swagger / spec 문서 어디에도 미명시 | `auth.controller.ts` `refresh()` 핸들러 | `@ApiUnauthorizedResponse(...)` 또는 spec 문서에 에러 코드 명세 추가 |
| 7 | Architecture | `AuthProvider`(프레젠테이션 레이어)가 `setSessionRestoreInProgress` 직접 import — 인프라 레이어 내부 상태 제어, 레이어 경계 위반 | `auth-provider.tsx:7`, `auth-provider.tsx:26,54` | `authApi.restoreSession()` 또는 `sessionService`로 캡슐화하여 `AuthProvider`가 플래그 존재를 모르도록 분리 |
| 8 | Maintainability | `auth.controller.ts`에서 쿠키 타입 캐스팅 패턴 중복 (`logout`/`refresh` 두 곳) | `auth.controller.ts:65`, `auth.controller.ts:83` | `private getRefreshTokenFromCookie(req)` 헬퍼로 추출 |
| 9 | Maintainability | `setSessionRestoreInProgress`와 인터셉터 간 암묵적 결합 — 함수명만으로 redirect 억제 부작용 불명확 | `client.ts:37-39` | 함수 선언부에 `// Suppresses interceptor redirect during session restore` 인라인 주석 |
| 10 | Performance | `doRefresh()`에서 불필요한 빈 body 직렬화 | `client.ts:44` (`apiClient.post("/auth/refresh", {})`) | `apiClient.post("/auth/refresh")` 또는 `undefined` 전달 |
| 11 | Performance | `typeof window !== "undefined"` 체크가 모든 401 응답에서 반복 실행 (`"use client"` 환경에서 dead code) | `client.ts` response interceptor | 모듈 레벨 `const isBrowser = typeof window !== "undefined"` 상수로 추출 |
| 12 | Security | `sessionRestoreInProgress` export로 외부에서 자유롭게 조작 가능 — 미래 소비자가 `true` 고착 시 redirect 영구 억제 | `client.ts:37-39` | 사용처 증가 시 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화 |
| 13 | Security | `clearCookie` path 수정 — 올바른 보안 개선 (이전에는 path 불일치로 logout 후 refresh token 쿠키 잔존) | `auth.controller.ts:71` | 없음 (올바른 수정 확인) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Architecture | MEDIUM | 레이어 경계 위반 + `sessionRestoreInProgress` 부분 억제로 이중 refresh 경로 |
| Requirement | MEDIUM | `setLoading(false)` 암묵적 의존, interceptor 재진입 미차단, RESOLUTION.md 불일치 |
| Testing | MEDIUM | 핵심 로직(플래그 생명주기, 동시성, 백엔드 변경) 테스트 전무 |
| Security | LOW | Body fallback 로그 노출, Open Redirect 소비 지점 미검증, 데코레이터 순서 |
| Side Effect | LOW | N중 catch 중복 실행, 로딩 상태 암묵적 의존, UnauthorizedException 응답 타입 변경 |
| Concurrency | LOW | refreshPromise 실패 시 N중 redirect, getMe() 401→이중 refresh 경로 |
| API Contract | LOW | 에러 코드 400→401 breaking change, UnauthorizedException 응답 구조 불일치 |
| Documentation | LOW | 신규 함수 JSDoc 누락, 에러 응답 스펙 미문서화 |
| Performance | LOW | 빈 body 직렬화, `typeof window` 반복 체크 |
| Maintainability | LOW | 쿠키 캐스팅 중복, 암묵적 결합, 모듈 레벨 상태 집중 |
| Scope | LOW | RESOLUTION.md 문서 허위 기재 (코드 자체는 스코프 이탈 없음) |
| Dependency | NONE | 새로운 외부 의존성 없음, 데코레이터 순서 관례 불일치만 존재 |
| Database | NONE | 데이터베이스 관련 변경 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 변경사항이 DB 레이어와 무관 |

---

## 권장 조치사항

1. **[CRITICAL 선행 조치] `sessionRestoreInProgress` 인터셉터 전면 억제** — `!sessionRestoreInProgress` 조건을 interceptor 401 처리 진입부에 추가하여 세션 복원 중 `doRefresh()` 재진입 차단. rotate 방식 refresh token 환경에서 의도치 않은 로그아웃 방지.

2. **`restoreSession` finally에 `setLoading(false)` 추가** — `finally { setSessionRestoreInProgress(false); setLoading(false); }` 로 명시적 처리하여 스토어 내부 구현 변경 시 무한 스피너 위험 제거.

3. **`@IsOptional()` / `@IsString()` 데코레이터 순서 수정** — `refresh-token.dto.ts`에서 `@IsOptional()` → `@IsString()` 순서로 변경. class-validator 관례 준수 및 버전별 동작 불일치 방지.

4. **`UnauthorizedException` 응답 형식 정리** — 글로벌 예외 필터 유무 확인 후, 없다면 `throw new UnauthorizedException('No refresh token provided')` 단순화. 프로젝트 에러 응답 컨벤션과 일치시켜 클라이언트 에러 핸들러 오동작 방지.

5. **테스트 보완 (3건 우선)** — (a) `setSessionRestoreInProgress` 생명주기(`true`→`false`) 검증, (b) `refreshPromise` 동시성 중복 방지 검증, (c) 백엔드 `TOKEN_INVALID` 응답 및 `clearCookie` path 검증.

6. **`refreshPromise` 실패 처리 통합** — `.catch()` 내부로 `setAccessToken(null)` + redirect 이전하여 N중 중복 실행 제거.

7. **RESOLUTION.md 수정** — WARNING #1("sessionStorage 유지" → "sessionStorage 제거"), WARNING #6("`isTokenExpired()` 추가" → "미조치") 수정하여 이력 추적성 복원.

8. **Open Redirect 소비 지점 검증 추가** — 로그인 성공 후 `redirect` 파라미터 처리 시 `startsWith("/") && !startsWith("//")` 명시적 검증.

9. **Refresh Token Body fallback 제거 검토** — 쿠키 우선 정책이 확정됐다면 `dto.refreshToken` fallback 제거하여 서버 로그를 통한 토큰 노출 경로 차단.

10. **`RefreshTokenDto` 및 신규 함수 문서화** — optional 변경 이유 주석 추가, `setSessionRestoreInProgress`/`doRefresh` JSDoc 작성(특히 redirect 억제 부작용·finally 리셋 계약 명시).