### 발견사항

---

**[WARNING]** `restoreSession` — `setLoading(false)` finally 블록 미호출
- **위치**: `auth-provider.tsx` — `restoreSession()` finally 블록
- **상세**: `setLoading(true)` 호출 후 `finally`에서 `setSessionRestoreInProgress(false)`만 해제하고 `setLoading(false)`를 호출하지 않음. 로딩 상태 해제가 `setAuthenticated()`/`logout()` 내부 구현에 암묵적으로 의존. 두 함수 중 하나라도 `isLoading: false`를 설정하지 않으면 로딩 스피너 무기한 표시라는 UX 버그 발생.
- **제안**: `finally { setSessionRestoreInProgress(false); setLoading(false); }`

---

**[WARNING]** `sessionRestoreInProgress` 플래그가 interceptor의 refresh 재시도를 차단하지 않음
- **위치**: `client.ts` — response interceptor 진입 조건
- **상세**: 현재 플래그는 `window.location.href = "/login"` redirect만 억제하고, `doRefresh()` 실행 자체는 막지 않음. `restoreSession`이 `authApi.refresh()` 성공 후 `usersApi.getMe()`를 호출할 때 서버가 401 반환 시 interceptor가 이미 소비된 refresh cookie로 `doRefresh()`를 **재실행**함. Refresh token rotate 방식이면 2차 refresh 실패 → 의도치 않은 로그아웃 발생.
- **제안**: 
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress  // 세션 복원 중 auto-refresh 전체 억제
  )
  ```

---

**[WARNING]** `UnauthorizedException` 응답 구조 — 프로젝트 에러 포맷 불일치
- **위치**: `auth.controller.ts:83-88`
- **상세**: `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })` 전달 시 NestJS 기본 직렬화 결과: `{ statusCode: 401, message: { code: ..., message: ... }, error: 'Unauthorized' }`. `message` 필드가 문자열 대신 중첩 객체가 되어, 클라이언트 에러 핸들러가 `error.response.data.message`를 문자열로 처리할 경우 예상치 못한 동작 발생. 글로벌 예외 필터 존재 여부에 따라 동작이 달라짐.
- **제안**: 글로벌 필터가 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화.

---

**[WARNING]** `@IsOptional()` / `@IsString()` 데코레이터 선언 순서 오류
- **위치**: `refresh-token.dto.ts:3-5`
- **상세**: class-validator 관례상 `@IsOptional()`은 값 부재 시 이후 검증자를 건너뛰므로 `@IsString()` **위**에 선언되어야 함. 현재 순서는 `@IsString()` → `@IsOptional()`. 라이브러리 버전에 따라 `undefined` 값에 `@IsString()` 검증이 먼저 실행되어 예상치 못한 400 에러 발생 가능.
- **제안**:
  ```ts
  @IsOptional()
  @IsString()
  refreshToken?: string;
  ```

---

**[WARNING]** RESOLUTION.md — 실제 코드와 반대 방향 기재
- **위치**: `review/2026-04-01_12-44-24/RESOLUTION.md`
- **상세**:
  1. WARNING #1: "sessionStorage 유지"로 기록 — 실제 `client.ts`에는 sessionStorage 없음 (in-memory로 복귀)
  2. WARNING #6: "`isTokenExpired()` 함수 추가"로 기록 — `auth-provider.tsx`에 해당 함수 없음
  코드 이력의 신뢰성 훼손, 추후 작업 시 오판 원인.
- **제안**: WARNING #1 → "sessionStorage 제거, in-memory + HttpOnly cookie 패턴 복귀", WARNING #6 → "미구현 — sessionStorage 제거로 3회 왕복 경로 자체 소멸"

---

**[WARNING]** 백엔드 신규 동작 테스트 완전 누락
- **위치**: `auth.controller.ts:83-89`, `refresh-token.dto.ts`
- **상세**: 두 가지 신규 동작이 테스트 없음: (1) 토큰 미제공 시 `TOKEN_INVALID` 401 반환, (2) `@IsOptional()` 적용으로 빈 body 유효성 검증 통과. `clearCookie` path 버그 수정도 회귀 방지 테스트 없음.
- **제안**:
  ```ts
  it("returns 401 TOKEN_INVALID when no token in cookie or body", ...);
  it("passes validation with missing refreshToken", async () => {
    const dto = plainToClass(RefreshTokenDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  ```

---

**[WARNING]** `setSessionRestoreInProgress` 생명주기 테스트 없음
- **위치**: `auth-provider.test.tsx`
- **상세**: `setSessionRestoreInProgress`가 mock만 되고 `true` → `finally`에서 `false` 복귀하는 생명주기 검증 없음. 구현이 변경되어도 테스트 통과. 플래그 고착 시 인터셉터 redirect 영구 억제.
- **제안**:
  ```tsx
  expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true);
  expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(2, false);
  ```

---

**[INFO]** refresh 실패 시 N개 catch 블록 독립 실행
- **위치**: `client.ts` — response interceptor catch block
- **상세**: `refreshPromise` 실패 시 대기 중인 N개 요청이 각각 독립적으로 catch 진입. `setAccessToken(null)`은 멱등적이나, `window.location.href = "/login"`이 N번 실행됨. 브라우저는 최종값으로만 이동하므로 기능 동작에는 문제없으나 `refreshPromise` 도입 취지(중복 제거)와 불일치.
- **제안**: 실패 처리를 `doRefresh().catch()` 체인으로 이동하여 1회만 실행.

---

**[INFO]** Refresh Token Body fallback — 로그/캐시 노출 경로
- **위치**: `auth.controller.ts:83-84`
- **상세**: Refresh Token을 HttpOnly 쿠키와 Request Body 두 경로로 수락. 현재 `doRefresh()`는 빈 body를 전송하므로 정상 경로는 안전하나, Body fallback이 존재하는 한 서버 로그·프록시 캐시 노출 경로로 활용 가능.
- **제안**: Body fallback 제거 검토.

---

### 요약

핵심 기능 구현(동시 refresh 중복 방지, 세션 복원 중 이중 리다이렉트 억제, 쿠키 path 일관성)은 방향이 올바르나, 요구사항 완전성 관점에서 세 가지 미비점이 존재한다. 첫째, `setLoading(false)`가 `finally`에 없어 로딩 상태 해제가 스토어 내부 구현에 암묵적으로 의존한다. 둘째, `sessionRestoreInProgress` 플래그가 리다이렉트만 억제하고 interceptor의 refresh 재시도를 막지 않아 rotate 방식 refresh token 환경에서 `getMe()` 401 시 의도치 않은 로그아웃이 발생할 수 있다. 셋째, 백엔드 신규 검증 로직(`TOKEN_INVALID`, DTO optional)에 대응하는 테스트가 전혀 없으며 RESOLUTION.md가 실제 코드와 반대 방향으로 기재되어 이력 추적성이 훼손된다.

### 위험도
**MEDIUM**