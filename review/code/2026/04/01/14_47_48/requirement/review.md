### 발견사항

---

**[WARNING]** `restoreSession` 내 `setLoading(false)` 암묵적 의존
- **위치**: `auth-provider.tsx` — `restoreSession()` finally 블록
- **상세**: `setLoading(true)`로 시작하지만 `finally`에서 `setLoading(false)`를 호출하지 않음. 로딩 상태 해제가 `setAuthenticated()`와 `logout()` 내부 구현에 암묵적으로 의존. 두 함수 중 하나라도 `isLoading: false`를 설정하지 않으면 로딩 스피너가 무기한 표시됨.
- **제안**: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리하거나, 스토어 액션이 반드시 로딩 해제를 보장함을 주석으로 명시.

---

**[WARNING]** `sessionRestoreInProgress=true`일 때 interceptor가 refresh를 억제하지 않음
- **위치**: `client.ts` — response interceptor 조건문
- **상세**: `sessionRestoreInProgress` 플래그는 `window.location.href` 리다이렉트만 억제하고, interceptor의 refresh 시도 자체는 막지 않음. `restoreSession`이 `authApi.refresh()` 성공 후 `usersApi.getMe()`를 호출할 때 서버가 401을 반환하면, interceptor가 이미 소비된 refresh cookie로 `doRefresh()`를 재실행함. rotate 방식의 refresh token이라면 2번째 refresh가 실패하고 결국 `logout()`이 호출됨.
- **제안**: interceptor 조건에 `!sessionRestoreInProgress` 추가:
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress
  )
  ```

---

**[WARNING]** RESOLUTION.md와 실제 코드 불일치 — 두 항목
- **위치**: `review/2026-04-01_12-44-24/RESOLUTION.md`
- **상세**: 
  1. **WARNING #1**: "sessionStorage 유지"로 기록했으나 실제 `client.ts`에는 sessionStorage 없음 — in-memory로 복귀된 상태.
  2. **WARNING #6**: "`isTokenExpired()` 함수 추가"로 기록했으나 `auth-provider.tsx`에 해당 함수 없음.
  코드 리뷰 이력의 신뢰성이 저하되며, 추후 작업 시 오판의 원인이 됨.
- **제안**: RESOLUTION.md 수정:
  - WARNING #1: "sessionStorage 제거 — in-memory + HttpOnly cookie refresh 패턴으로 복귀"
  - WARNING #6: "미구현 — 현재 흐름은 항상 `refresh → getMe` 2회 왕복으로 기존 대비 동일 수준"

---

**[WARNING]** 백엔드 변경에 대한 테스트 완전 누락
- **위치**: `auth.controller.ts:83-89`, `refresh-token.dto.ts`
- **상세**: 두 가지 신규 동작이 전혀 테스트되지 않음:
  1. 토큰 미제공 시 `UnauthorizedException(TOKEN_INVALID)` 반환 로직
  2. `@IsOptional()` 추가로 인한 빈 body 유효성 검증 통과 동작
- **제안**:
  ```ts
  // controller test
  it("returns 401 TOKEN_INVALID when no token provided", ...)
  
  // DTO test
  it("passes validation when refreshToken is omitted", async () => {
    const dto = plainToClass(RefreshTokenDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  ```

---

**[WARNING]** `@IsOptional()` 데코레이터 순서 — class-validator 관례 위반
- **위치**: `refresh-token.dto.ts:3-5`
- **상세**: `@IsString()`이 `@IsOptional()` 위에 선언됨. class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 값이 없을 때 이후 검증자(`@IsString()`)를 올바르게 건너뜀. 라이브러리 버전에 따라 동작이 달라질 수 있음.
- **제안**:
  ```ts
  @IsOptional()
  @IsString()
  refreshToken?: string;
  ```

---

**[WARNING]** `UnauthorizedException` 응답 구조 — 프로젝트 에러 포맷 불일치 가능성
- **위치**: `auth.controller.ts:83-87`
- **상세**: `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`는 NestJS 기본 처리 시 `{ statusCode: 401, message: { code: ..., message: ... }, error: 'Unauthorized' }` 중첩 구조를 생성함. 글로벌 예외 필터 존재 여부에 따라 실제 응답이 달라지므로, 클라이언트의 에러 처리 코드와 정합성 검증이 필요함.
- **제안**: 글로벌 예외 필터 구현 확인. 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화하거나 필터 도입.

---

**[INFO]** `setSessionRestoreInProgress` 테스트 — 호출 검증 부재
- **위치**: `auth-provider.test.tsx`
- **상세**: `setSessionRestoreInProgress`가 mock만 되어 있고 `true` → `finally`에서 `false`로 복귀하는 생명주기 검증이 없음. 구현이 변경되어도 테스트가 통과하는 구조.
- **제안**:
  ```tsx
  expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true);
  expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(2, false);
  ```

---

**[INFO]** `doRefresh()` 내 빈 body 직렬화
- **위치**: `client.ts:44` — `apiClient.post("/auth/refresh", {})`
- **상세**: `RefreshTokenDto.refreshToken`이 optional이므로 body 없이도 동작. 실질적 영향은 무시 가능하나 불필요한 직렬화 발생.
- **제안**: `apiClient.post("/auth/refresh")` 또는 `apiClient.post("/auth/refresh", undefined)`.

---

### 요약

핵심 기능 구현(동시 refresh 중복 방지, 이중 리다이렉트 억제, sessionStorage 제거)은 올바르게 구현되었으나, 세 가지 요구사항 수준의 미비점이 존재한다. 첫째, `restoreSession`의 `setLoading(false)`가 `finally`에 없어 로딩 상태 관리가 스토어 내부 구현에 암묵적으로 의존한다. 둘째, `sessionRestoreInProgress` 플래그가 리다이렉트만 억제하고 interceptor의 refresh 재시도는 막지 않아 rotate 방식 refresh token 환경에서 세션 복원 중 `getMe()` 401 응답 시 의도치 않은 로그아웃이 발생할 수 있다. 셋째, 백엔드 신규 동작(`TOKEN_INVALID`, DTO optional)에 대한 테스트가 전혀 없으며, RESOLUTION.md가 실제 코드와 두 항목에서 상반된 내용을 기재하고 있어 이력 추적성이 훼손된다.

### 위험도
**MEDIUM**