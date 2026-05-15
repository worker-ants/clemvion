### 발견사항

---

**[WARNING]** `setSessionRestoreInProgress` 호출 검증 부재
- 위치: `auth-provider.test.tsx` 전체
- 상세: `setSessionRestoreInProgress`가 mock되어 있으나 실제로 `true` → `finally`에서 `false`로 리셋되는지 검증하는 assertion이 없음. 세션 복원 실패 케이스에서도 `finally`가 실행되어 플래그가 해제되는지 확인하지 않음.
- 제안:
  ```tsx
  import { setSessionRestoreInProgress } from "@/lib/api/client";
  
  it("resets sessionRestoreInProgress in finally", async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(new Error("fail"));
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(1, true);
    expect(setSessionRestoreInProgress).toHaveBeenNthCalledWith(2, false);
  });
  ```

---

**[WARNING]** `refreshPromise` 중복 호출 방지 로직 테스트 누락
- 위치: `client.ts` — `doRefresh`, `refreshPromise` 공유 로직
- 상세: 동시 401 발생 시 단일 refresh만 실행되는 핵심 동시성 로직이 전혀 테스트되지 않음. `refreshPromise` 공유 및 `.finally()` 정리 동작이 검증되지 않아 회귀 위험 존재.
- 제안: interceptor 레벨 테스트 추가 필요:
  ```ts
  it("deduplicates concurrent refresh calls", async () => {
    // axios mock으로 동시 401 시뮬레이션 후
    // /auth/refresh가 1회만 호출됨을 검증
  });
  ```

---

**[WARNING]** Backend `refresh` 엔드포인트 변경에 대한 테스트 부재
- 위치: `auth.controller.ts:83-89`
- 상세: 토큰 없이 refresh 요청 시 `UnauthorizedException(TOKEN_INVALID)` 반환하는 신규 로직에 대한 테스트가 없음. `clearCookie` path 옵션 추가도 미검증.
- 제안: controller 또는 e2e 테스트에 추가:
  ```ts
  it("returns 401 TOKEN_INVALID when no token provided", async () => {
    // cookie 없고 body도 없는 요청 → 401 + code: TOKEN_INVALID
  });
  ```

---

**[WARNING]** `RefreshTokenDto` optional 변경 테스트 누락
- 위치: `refresh-token.dto.ts`
- 상세: `refreshToken`이 `@IsOptional()`로 변경되었으나 DTO validation 동작 테스트가 없음. 빈 body 전송 시 validation 통과 여부가 미검증.
- 제안: DTO unit test 또는 e2e에서 검증:
  ```ts
  it("validates RefreshTokenDto with missing refreshToken", async () => {
    const dto = plainToClass(RefreshTokenDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0); // optional이므로 에러 없어야 함
  });
  ```

---

**[INFO]** `initAttempted.current` 중복 초기화 방지 테스트 없음
- 위치: `auth-provider.tsx:22-23`
- 상세: `useRef`로 중복 실행을 막는 로직이 있으나 re-render 시 `restoreSession`이 한 번만 호출되는지 검증하지 않음.
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

**[INFO]** `isAuthenticated=true` 상태에서 restoreSession skip 검증 없음
- 위치: `auth-provider.tsx:21`
- 상세: `isAuthenticated`가 이미 true일 때 `restoreSession`을 건너뛰는 경로의 테스트가 없음.
- 제안:
  ```tsx
  it("skips session restore when already authenticated", () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false });
    render(<AuthProvider><div data-testid="c">X</div></AuthProvider>);
    expect(authApi.refresh).not.toHaveBeenCalled();
  });
  ```

---

**[INFO]** `client.test.ts`에서 `sessionRestoreInProgress` setter 미테스트
- 위치: `frontend/src/lib/api/__tests__/client.test.ts`
- 상세: `setSessionRestoreInProgress` 함수가 export되어 있으나 해당 setter의 동작(인터셉터 redirect 억제)을 검증하는 테스트 없음.

---

**[INFO]** `doRefresh` 실패 시 `setAccessToken(null)` 호출 검증 부재
- 위치: `client.ts` response interceptor catch 블록
- 상세: refresh 실패 시 토큰이 null로 클리어되는지, `sessionRestoreInProgress=true`일 때 `window.location.href` redirect가 억제되는지 테스트 없음.

---

### 요약

현재 `auth-provider.test.tsx`와 `client.test.ts`는 기본적인 happy path와 failure path를 커버하고 있으나, 이번 변경의 핵심인 `sessionRestoreInProgress` 플래그 생명주기, `refreshPromise` 중복 방지 로직, Backend의 토큰 없는 refresh 요청 처리(`TOKEN_INVALID`)에 대한 테스트가 완전히 누락되어 있다. 특히 `setSessionRestoreInProgress`는 mock만 되어 있고 실제 호출 검증이 없어 구현이 변경되어도 테스트가 통과할 수 있는 구조다. Backend 변경(`auth.controller.ts`, `refresh-token.dto.ts`)은 대응하는 신규 테스트가 전혀 없는 상태다.

### 위험도

**MEDIUM**