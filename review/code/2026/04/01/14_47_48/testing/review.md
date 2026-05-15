### 발견사항

---

**[WARNING]** `setSessionRestoreInProgress` 생명주기 검증 부재
- 위치: `auth-provider.test.tsx` 전체
- 상세: `setSessionRestoreInProgress`가 mock되어 있으나 `true`로 설정되고 `finally`에서 반드시 `false`로 해제되는지 검증하는 assertion이 없음. 세션 복원 실패 케이스에서도 `finally`가 실행되어 플래그가 해제되는지 확인 불가. 이 플래그가 `true`로 고착되면 인터셉터 redirect가 영구 억제되는 심각한 버그가 발생하므로 반드시 테스트 필요.
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

**[WARNING]** `refreshPromise` 중복 호출 방지 로직 미검증
- 위치: `client.test.ts` 전체
- 상세: 이번 변경의 핵심 동시성 로직인 `refreshPromise` 공유 패턴에 대한 테스트가 없음. 동시 401 발생 시 `/auth/refresh`가 단 1회만 호출되는지, `.finally()`로 `refreshPromise`가 null로 초기화되어 다음 사이클이 새 refresh를 시도할 수 있는지 검증 불가. 회귀 발생 시 탐지 방법 없음.
- 제안: axios mock adapter를 사용한 인터셉터 레벨 테스트 추가 필요:
  ```ts
  it("deduplicates concurrent refresh calls", async () => {
    // 동시 401 응답 시뮬레이션 후 /auth/refresh 1회만 호출됨 검증
  });
  ```

---

**[WARNING]** 백엔드 `auth.controller.ts` 변경사항 테스트 없음
- 위치: `auth.controller.ts:83-89`, `auth.controller.ts:71`
- 상세: 두 가지 신규 로직이 테스트되지 않음: (1) 토큰 없는 refresh 요청 시 `UnauthorizedException({ code: 'TOKEN_INVALID' })` 반환, (2) `clearCookie('refreshToken', { path: '/' })` — path 없이 clear하면 쿠키가 삭제되지 않는 실제 버그를 수정한 것인데 회귀 방지 테스트 없음.
- 제안:
  ```ts
  it("returns 401 TOKEN_INVALID when no token in cookie or body", ...);
  it("clears refreshToken cookie with correct path on logout", ...);
  ```

---

**[WARNING]** `RefreshTokenDto` optional 변경 검증 누락
- 위치: `refresh-token.dto.ts`
- 상세: `refreshToken: string` (필수) → `refreshToken?: string` (선택)으로 변경되었으나 DTO validation 동작 변화가 테스트되지 않음. 빈 body 전송 시 validation 통과 여부, 이전 required 동작(400 Bad Request)에서 401로의 응답 코드 변경이 미검증.
- 제안:
  ```ts
  it("passes validation with missing refreshToken", async () => {
    const dto = plainToClass(RefreshTokenDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
  ```

---

**[WARNING]** `doRefresh` 실패 시 동작 미검증
- 위치: `client.ts` response interceptor catch 블록
- 상세: refresh 실패 시 `setAccessToken(null)` 호출 여부, `sessionRestoreInProgress=true`일 때 `window.location.href` redirect가 억제되는지 테스트 없음. `client.test.ts`가 토큰 관리 단위 테스트만 있고 인터셉터 동작 테스트가 전혀 없음.

---

**[INFO]** `isAuthenticated=true`에서 세션 복원 skip 검증 없음
- 위치: `auth-provider.tsx:21`
- 상세: `isAuthenticated || initAttempted.current` 조건의 `isAuthenticated=true` 분기가 테스트되지 않음.
- 제안:
  ```tsx
  it("skips session restore when already authenticated", () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false });
    render(<AuthProvider><div /></AuthProvider>);
    expect(authApi.refresh).not.toHaveBeenCalled();
  });
  ```

---

**[INFO]** `initAttempted` ref 중복 방지 검증 없음
- 위치: `auth-provider.tsx:22-23`
- 상세: re-render 시 `restoreSession`이 한 번만 호출되는지 검증하지 않음. `initAttempted.current` 로직이 올바르게 동작하는지 테스트 필요.
- 제안:
  ```tsx
  it("does not call refresh twice on re-render", async () => {
    const { rerender } = render(<AuthProvider><div /></AuthProvider>);
    rerender(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => {});
    expect(authApi.refresh).toHaveBeenCalledTimes(1);
  });
  ```

---

**[INFO]** `client.test.ts`의 `beforeEach` 모듈 재로드 패턴
- 위치: `client.test.ts:7-11`
- 상세: `vi.resetModules()` + dynamic import 패턴이 모듈 레벨 가변 상태(`accessToken`, `refreshPromise`, `sessionRestoreInProgress`) 초기화에 필요하나, 테스트마다 전체 모듈 재로드로 실행 시간이 선형 증가함. 현재 4개 테스트에서는 허용 가능하나, 인터셉터 테스트 추가 시 부담 증가.

---

**[INFO]** 성공 케이스에서 `setAccessToken` 호출 검증 부재
- 위치: `auth-provider.test.tsx:60-71`
- 상세: "restores session via cookie refresh" 테스트에서 `authApi.refresh` 호출 여부만 검증하고, `setAccessToken("refreshed-token")`이 실제로 호출되었는지 검증하지 않음. mock이 되어 있으므로 검증 추가가 용이함.

---

### 요약

현재 테스트는 `AuthProvider`의 happy/failure path와 `client.ts`의 토큰 관리 기본 동작을 커버하지만, 이번 변경의 핵심 로직인 `sessionRestoreInProgress` 플래그 생명주기, `refreshPromise` 중복 방지, 백엔드 `TOKEN_INVALID` 응답과 쿠키 삭제 버그 수정에 대한 테스트가 모두 누락되어 있다. 특히 `setSessionRestoreInProgress`는 mock만 설정되어 있고 실제 호출 순서와 횟수가 검증되지 않아 구현이 변경되어도 테스트가 그대로 통과할 수 있는 구조적 취약점이 있으며, 백엔드 변경사항은 대응 테스트가 전혀 없는 상태다.

### 위험도
**MEDIUM**