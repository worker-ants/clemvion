### 발견사항

---

**[WARNING]** `setSessionRestoreInProgress` 생명주기 검증 부재
- 위치: `auth-provider.test.tsx` 전체
- 상세: `setSessionRestoreInProgress`가 mock되어 있으나 `true` 설정 → `finally`에서 `false` 해제 순서 검증이 없음. 특히 refresh 실패 케이스에서 플래그가 반드시 해제되는지 미검증. 플래그가 `true`로 고착되면 인터셉터 redirect가 영구 억제되는 심각한 버그로 이어짐.
- 제안:
  ```tsx
  it("resets sessionRestoreInProgress in finally on failure", async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(new Error("fail"));
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true);
    expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(2, false);
  });
  ```

---

**[WARNING]** `refreshPromise` 중복 방지 로직 미검증
- 위치: `client.test.ts` 전체
- 상세: 이번 변경의 핵심 동시성 로직인 `refreshPromise` 공유 패턴 테스트가 전혀 없음. 동시 401 발생 시 `/auth/refresh`가 1회만 호출되는지, `.finally()`로 `refreshPromise = null` 초기화가 보장되는지 검증 불가. 회귀 발생 시 탐지 방법 없음.
- 제안: axios-mock-adapter 또는 `vi.spyOn(apiClient, 'post')`로 동시 401 시뮬레이션:
  ```ts
  it("deduplicates concurrent refresh calls", async () => {
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: { data: { accessToken: "new-token" } }
    });
    // 두 요청이 동시에 401 받는 상황 시뮬레이션
    // postSpy가 1회만 호출됨 검증
    expect(postSpy).toHaveBeenCalledTimes(1);
  });
  ```

---

**[WARNING]** 백엔드 변경사항 테스트 완전 누락
- 위치: `auth.controller.ts:83-89`, `auth.controller.ts:71`, `refresh-token.dto.ts`
- 상세: 세 가지 신규 동작이 모두 미검증:
  1. 토큰 미제공 시 `UnauthorizedException({ code: 'TOKEN_INVALID' })` 반환
  2. `clearCookie('refreshToken', { path: '/' })` — path 없이 clear하면 실제 쿠키 미삭제 버그를 수정한 것인데 회귀 방지 테스트 없음
  3. `@IsOptional()` 추가로 빈 body 전송 시 validation 통과 (기존 400 → 401 응답 코드 변경)
- 제안:
  ```ts
  // controller spec
  it("returns 401 TOKEN_INVALID when no token in cookie or body", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .expect(401);
    expect(response.body.message).toContain("TOKEN_INVALID");
  });
  
  // DTO spec
  it("passes validation when refreshToken is omitted", async () => {
    const dto = plainToClass(RefreshTokenDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  ```

---

**[WARNING]** `doRefresh` 실패 시 interceptor 동작 미검증
- 위치: `client.ts` response interceptor catch 블록
- 상세: refresh 실패 시 `setAccessToken(null)` 호출 여부, `sessionRestoreInProgress=true`일 때 `window.location.href` redirect 억제 여부가 전혀 테스트되지 않음. `client.test.ts`는 단순 토큰 getter/setter만 검증하고 인터셉터 동작은 완전 미검증 상태.
- 제안: `window.location.href` 모킹 후 interceptor 동작 통합 테스트 추가 필요.

---

**[INFO]** 성공 케이스에서 `setAccessToken` 호출 미검증
- 위치: `auth-provider.test.tsx:60-71`
- 상세: "restores session via cookie refresh" 테스트가 `authApi.refresh` 호출 여부와 content 렌더링만 검증. `setAccessToken("refreshed-token")`이 올바르게 호출되었는지 미검증.
- 제안: `expect(setAccessToken).toHaveBeenCalledWith("refreshed-token")` assertion 추가.

---

**[INFO]** `isAuthenticated=true` skip 경로 및 `initAttempted` ref 중복 방지 미검증
- 위치: `auth-provider.tsx:21-23`
- 상세: 이미 인증된 상태에서 세션 복원 skip 경로, re-render 시 `restoreSession` 중복 실행 방지 로직 테스트 없음.
- 제안:
  ```tsx
  it("skips session restore when already authenticated", () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false });
    render(<AuthProvider><div /></AuthProvider>);
    expect(authApi.refresh).not.toHaveBeenCalled();
  });
  
  it("does not call refresh twice on re-render", async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({ data: { data: { accessToken: "t" } } } as never);
    vi.mocked(usersApi.getMe).mockResolvedValue({ data: { data: mockUser } } as never);
    const { rerender } = render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(authApi.refresh).toHaveBeenCalledTimes(1));
    rerender(<AuthProvider><div /></AuthProvider>);
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });
  ```

---

**[INFO]** `@IsOptional()` / `@IsString()` 데코레이터 순서 오류
- 위치: `refresh-token.dto.ts:3-5`
- 상세: class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 값 부재 시 하위 검증자를 건너뜀. 현재 `@IsString()` → `@IsOptional()` 역순으로 라이브러리 버전에 따라 `undefined` 입력 시 예상치 못한 400 에러 발생 가능. DTO 테스트 없어 검증 불가 상태가 더 위험을 키움.
- 제안:
  ```ts
  @IsOptional()
  @IsString()
  refreshToken?: string;
  ```

---

### 요약

`auth-provider.test.tsx`와 `client.test.ts`는 기본 happy/failure path를 커버하고 `vi` import도 올바르게 처리되어 있으나, 이번 변경의 핵심 로직들(sessionRestoreInProgress 생명주기, refreshPromise 중복 방지, 백엔드 TOKEN_INVALID 처리, clearCookie path 수정, DTO optional 변경)에 대한 테스트가 모두 누락된 상태다. 특히 `setSessionRestoreInProgress`는 mock만 설정되어 호출 순서와 횟수가 검증되지 않아 구현이 변경되어도 테스트가 그대로 통과할 수 있는 구조적 취약점이 있으며, 백엔드 3개 변경사항(UnauthorizedException, clearCookie path, DTO optional)은 대응 테스트가 전혀 없는 상태로 회귀 위험이 높다.

### 위험도
**MEDIUM**