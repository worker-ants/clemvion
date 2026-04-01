# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 핵심 동시성/보안 로직(`refreshPromise` 실패 경로, `sessionRestoreInProgress` interceptor 재진입 미차단)과 테스트 누락이 복합적으로 존재하며, 일부 WARNING은 프로덕션 버그로 이어질 수 있음

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/부작용/아키텍처 | `refreshPromise` 실패 시 N개 catch 블록이 독립 실행되어 `window.location.href = "/login"`이 N번 호출됨. 성공 경로만 중복 제거되고 실패 경로는 미처리 | `client.ts` — response interceptor catch block | 실패 처리를 `doRefresh().catch()` 체인으로 이전: `refreshPromise = doRefresh().catch(e => { setAccessToken(null); if (!sessionRestoreInProgress) window.location.href="/login"; throw e; }).finally(() => { refreshPromise = null; })` |
| 2 | 동시성/보안/아키텍처 | `sessionRestoreInProgress` 플래그가 `window.location.href` 리다이렉트만 억제하고 interceptor의 `doRefresh()` 재진입 자체를 차단하지 않음. rotate 방식 refresh token 환경에서 `getMe()` 401 시 이미 소비된 cookie로 2차 refresh 시도 → 의도치 않은 로그아웃 발생 | `client.ts:85`, `auth-provider.tsx:33-34` | interceptor 진입 조건에 `&& !sessionRestoreInProgress` 추가 |
| 3 | 부작용/유지보수성 | `restoreSession`에서 `setLoading(true)`로 시작하지만 `finally`에서 `setLoading(false)` 미호출. 로딩 해제가 `setAuthenticated()`/`logout()` 내부 구현에 암묵적으로 의존 — 스토어 변경 시 로딩 스피너 무기한 표시 | `auth-provider.tsx:26`, `finally` 블록 | `finally { setSessionRestoreInProgress(false); setLoading(false); }` |
| 4 | API 계약/아키텍처 | `UnauthorizedException({ code, message })` 객체 전달 시 NestJS 기본 직렬화로 `message` 필드가 중첩 객체가 됨. 클라이언트 에러 핸들러가 `message`를 문자열로 처리할 경우 파싱 실패 | `auth.controller.ts:83-88` | 글로벌 예외 필터 유무 확인 후, 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화 |
| 5 | 테스트 | `setSessionRestoreInProgress` 생명주기 검증 부재 — mock만 설정되고 `true` 설정 → `finally`에서 `false` 해제 순서 미검증. 플래그 고착 시 인터셉터 redirect 영구 억제 | `auth-provider.test.tsx` 전체 | `expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true)`, `toHaveBeenNthCalledWith(2, false)` 검증 추가 |
| 6 | 테스트 | `refreshPromise` 중복 방지 핵심 로직 테스트 완전 부재 — 동시 401 시 `/auth/refresh` 1회만 호출되는지, `.finally()`로 `null` 초기화 보장되는지 미검증 | `client.test.ts` 전체 | `vi.spyOn(apiClient, 'post')`로 동시 401 시뮬레이션 후 `toHaveBeenCalledTimes(1)` 검증 |
| 7 | 테스트 | 백엔드 신규 동작 테스트 완전 누락: (1) 토큰 미제공 시 `TOKEN_INVALID` 401, (2) `clearCookie path: '/'` 회귀 방지, (3) 빈 body 전송 시 validation 통과 (기존 400 → 201) | `auth.controller.ts:83-89`, `refresh-token.dto.ts` | `e2e` 또는 controller unit spec에 3가지 케이스 추가 |
| 8 | 테스트 | `doRefresh` 실패 시 interceptor 동작 미검증 — `setAccessToken(null)` 호출 여부, `sessionRestoreInProgress=true` 시 redirect 억제 여부 | `client.test.ts` | `window.location.href` 모킹 후 interceptor 통합 테스트 추가 |
| 9 | API 계약 | `refreshToken` required → optional 전환으로 "토큰 없음" 입력에 대한 에러 코드가 400 → 401로 변경되는 behavioral breaking change | `refresh-token.dto.ts` + `auth.controller.ts:83-87` | API 문서에 에러 코드 변경 명시 및 기존 클라이언트 에러 핸들러 분기 확인 |
| 10 | DTO 유효성 | `@IsString()` → `@IsOptional()` 데코레이터 선언 순서 오류 — 라이브러리 버전에 따라 `undefined` 입력 시 `@IsString()` 검증이 먼저 실행되어 의도치 않은 400 에러 발생 가능 | `refresh-token.dto.ts:3-5` | `@IsOptional()` → `@IsString()` 순서로 변경 |
| 11 | 문서/추적성 | RESOLUTION.md에 실제 코드와 반대 방향으로 기재 — WARNING #1: "sessionStorage 유지"(실제: 제거됨), WARNING #6: "`isTokenExpired()` 추가"(실제: 미구현) | `review/2026-04-01_12-44-24/RESOLUTION.md` | 실제 처리 내용으로 수정: "in-memory + HttpOnly cookie 패턴으로 복귀", "sessionStorage 제거로 3회 왕복 경로 소멸" |
| 12 | 보안 | Refresh Token을 HttpOnly 쿠키와 Request Body 두 경로로 모두 수락 — Body 전달 토큰이 서버 액세스 로그/프록시 캐시에 기록될 수 있음 | `auth.controller.ts:83-84` | Body fallback 제거 검토; 쿠키 미제공 시 즉시 `UnauthorizedException` 반환으로 충분 |
| 13 | 보안 | Open Redirect — `redirect` 파라미터 소비 지점에서 `//evil.com` 형태의 프로토콜 상대 URL 미차단 (`pathname.startsWith("/")` 검증은 생성 지점에만 존재) | `auth-provider.tsx` — `router.replace` 호출부 및 소비 지점 | 소비 지점에서 `redirect?.startsWith("/") && !redirect.startsWith("//")` 검증 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `setAccessToken` 호출 값 미검증 — 성공 케이스에서 `"refreshed-token"` 인수로 호출됐는지 미확인 | `auth-provider.test.tsx:60-71` | `expect(setAccessToken).toHaveBeenCalledWith("refreshed-token")` 추가 |
| 2 | 테스트 | `isAuthenticated=true` skip 경로 및 `initAttempted` ref 중복 방지 미검증 | `auth-provider.tsx:21-23` | 인증 상태 세팅 후 `authApi.refresh` 미호출 검증, re-render 후 1회 호출 검증 추가 |
| 3 | 아키텍처 | `AuthProvider`(프레젠테이션)가 `setSessionRestoreInProgress`(인프라)를 직접 import — 레이어 책임 역전 | `auth-provider.tsx:7` | `authApi.restoreSession()` 등으로 캡슐화하여 플래그 제어를 인프라 내부로 이전 (리팩토링 과제) |
| 4 | 유지보수성 | 쿠키 타입 캐스팅 `(req as unknown as { cookies: Record<string, string> }).cookies?.refreshToken` 중복 | `auth.controller.ts:65,83` | `private getRefreshTokenFromCookie()` 헬퍼 메서드 추출 |
| 5 | 문서화 | `setSessionRestoreInProgress`, `doRefresh`, `setAccessToken`, `getAccessToken`에 JSDoc 없음 | `client.ts` | 각 함수 선언부에 역할/사용 계약 명시 JSDoc 추가 |
| 6 | 문서화 | `refresh` 엔드포인트의 `TOKEN_INVALID` 에러 코드가 Swagger/spec 미반영 | `auth.controller.ts` | `@ApiUnauthorizedResponse` 추가 또는 `spec/` 문서 보완 |
| 7 | 문서화 | `RefreshTokenDto.refreshToken` optional 변경 이유(쿠키 우선, body 폴백) DTO 내 미문서화 | `refresh-token.dto.ts` | 필드에 JSDoc 주석 추가 |
| 8 | 성능 | `doRefresh()`에서 빈 body `{}` 불필요 직렬화 | `client.ts:44` | `apiClient.post("/auth/refresh")` 또는 `undefined` 전달 |
| 9 | 성능 | `typeof window !== "undefined"` 매 401 응답마다 반복 평가 | `client.ts` — response interceptor | 모듈 레벨 `const isBrowser = typeof window !== "undefined"` 상수로 추출 |
| 10 | 유지보수성 | `client.ts` 모듈 레벨 가변 상태 3개(`accessToken`, `refreshPromise`, `sessionRestoreInProgress`) 분산으로 테스트 격리에 `vi.resetModules()` + dynamic import 강제 | `client.ts:14,32,36` | 상태 증가 시 `__resetForTest()` export 또는 `TokenState` 객체 그룹화 고려 |
| 11 | 의존성 | `doRefresh()`가 동일 `apiClient`로 자기 참조 — `/auth/` 가드 변경 시 interceptor 순환 재진입 위험 | `client.ts:43-50` | 가드 조건에 "Guard against re-entry" 주석 추가, 장기적으로 refresh 전용 axios 인스턴스 분리 고려 |
| 12 | 보안 | `setSessionRestoreInProgress` 외부 노출 — 미래 소비자가 `true` 방치 시 인터셉터 redirect 영구 억제 | `client.ts:40-42` | 사용처 증가 시 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | MEDIUM | WARNING 4건 — 핵심 로직(refreshPromise, sessionRestoreInProgress, 백엔드 변경) 테스트 완전 누락 |
| Requirement | MEDIUM | WARNING 6건 — setLoading 미해제, sessionRestoreInProgress 재진입 미차단, RESOLUTION.md 오기재 |
| Architecture | MEDIUM | WARNING 5건 — 레이어 책임 역전, SRP 위반, refreshPromise 실패 경로, sessionRestoreInProgress 재진입 |
| Security | LOW | WARNING 5건 — Body fallback 로그 노출, Open Redirect 소비 지점 미검증, decorator 순서, sessionRestoreInProgress 재진입 |
| Side Effect | LOW | WARNING 5건 — refreshPromise 실패 N회 실행, setLoading 미해제, UnauthorizedException 구조 불일치 |
| Concurrency | LOW | WARNING 2건 — refreshPromise 실패 경로 N회 실행, sessionRestoreInProgress interceptor 재진입 |
| API Contract | LOW | WARNING 3건 — 에러 코드 400→401 breaking change, UnauthorizedException 구조 불일치, decorator 순서 |
| Maintainability | LOW | INFO 전건 — 쿠키 추출 중복, decorator 순서, setLoading 암묵적 의존 |
| Performance | LOW | INFO 전건 — 빈 body 직렬화, typeof window 반복 평가 (실질 영향 미미) |
| Documentation | LOW | INFO 전건 — JSDoc 누락, Swagger 미반영 |
| Scope | LOW | WARNING 1건 — RESOLUTION.md 오기재만 스코프 이슈 |
| Dependency | NONE | 새로운 외부 의존성 없음, decorator 순서 권장사항 |
| Database | NONE | DB 관련 변경 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 변경사항이 DB 레이어와 무관 (프론트엔드 인증 토큰 관리 + 백엔드 컨트롤러 검증 로직) |

---

## 권장 조치사항

1. **[즉시] `sessionRestoreInProgress` interceptor 재진입 차단** — `client.ts` response interceptor 진입 조건에 `!sessionRestoreInProgress` 추가. rotate 방식 refresh token 환경에서 프로덕션 세션 손실 버그 방지

2. **[즉시] `refreshPromise` 실패 경로 단일화** — `doRefresh().catch()` 체인으로 `setAccessToken(null)`과 `window.location.href` 이동을 통합, N번 중복 실행 제거

3. **[즉시] `@IsOptional()` / `@IsString()` 데코레이터 순서 수정** — `refresh-token.dto.ts`에서 `@IsOptional()`을 먼저 선언, class-validator 버전 불일치 대응

4. **[즉시] `finally` 블록에 `setLoading(false)` 명시** — `auth-provider.tsx` `restoreSession`의 암묵적 상태 의존 제거

5. **[즉시] `UnauthorizedException` 응답 구조 정리** — 글로벌 예외 필터 유무 확인 후 `throw new UnauthorizedException('No refresh token provided')`로 단순화 또는 필터에서 일관 처리

6. **[단기] 테스트 보완** — `setSessionRestoreInProgress` 생명주기(true→false), `refreshPromise` 중복 방지, 백엔드 `TOKEN_INVALID` 401, `clearCookie path` 회귀 방지, DTO optional 유효성 검증 테스트 추가

7. **[단기] RESOLUTION.md 수정** — WARNING #1("sessionStorage 유지" → "in-memory 복귀"), WARNING #6("`isTokenExpired()` 추가" → "경로 소멸로 불필요")

8. **[단기] Open Redirect 소비 지점 검증** — `redirect` 파라미터 소비 위치에서 `startsWith("/") && !startsWith("//")` 이중 검증 추가

9. **[단기] Refresh Token Body fallback 제거 검토** — 서버 로그/프록시 캐시를 통한 토큰 노출 경로 차단

10. **[중기] 레이어 책임 분리** — `setSessionRestoreInProgress` 호출을 `authApi` 또는 `sessionService`로 캡슐화하여 프레젠테이션 레이어의 인프라 직접 의존 해소