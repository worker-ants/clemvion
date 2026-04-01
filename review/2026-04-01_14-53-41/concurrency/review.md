### 발견사항

---

**[INFO]** `refreshPromise` check-and-set — JavaScript 단일 스레드 특성상 원자적
- 위치: `client.ts` — `if (!refreshPromise)` + 할당
- 상세: `if (!refreshPromise) { refreshPromise = doRefresh()... }` 패턴은 두 문장 사이에 다른 코드가 개입할 수 없으므로 실질적으로 원자적입니다. 동시 401 발생 시 단일 refresh만 실행되는 의도가 올바르게 구현되었습니다. `.finally(() => { refreshPromise = null; })`로 정리도 보장됩니다.

---

**[WARNING]** refresh 실패 시 N개 catch 블록 독립 실행 — 중복 상태 변이
- 위치: `client.ts` — response interceptor catch block (L73-86 영역)
- 상세: `doRefresh()`가 reject되면 `refreshPromise`를 `await`하던 N개 요청이 각자 독립적으로 catch 블록에 진입합니다. `setAccessToken(null)`은 멱등적이지만, `sessionRestoreInProgress === false`인 일반 API 요청 시나리오에서는 `window.location.href = "/login"`이 N번 연속 실행됩니다. `refreshPromise` 도입 목적(중복 제거)과 불일치하는 구조입니다.
- 제안:
  ```ts
  refreshPromise = doRefresh()
    .catch((e) => {
      setAccessToken(null);
      if (typeof window !== "undefined" && !sessionRestoreInProgress) {
        window.location.href = "/login";
      }
      throw e; // 개별 요청에 rejection 전파
    })
    .finally(() => { refreshPromise = null; });
  ```

---

**[WARNING]** `sessionRestoreInProgress=true`가 interceptor의 `doRefresh()` 실행 자체를 막지 않음 — 이중 refresh 경로
- 위치: `client.ts` — response interceptor 조건문, `auth-provider.tsx` — `restoreSession`
- 상세: `restoreSession`에서 `authApi.refresh()` 성공 후 `usersApi.getMe()`를 호출할 때, 서버 측 이유로 `getMe()`가 401을 반환하면 interceptor가 실행됩니다. `sessionRestoreInProgress === true`이므로 `window.location.href` redirect는 억제되지만, `doRefresh()` 호출 자체는 막지 않습니다. Refresh token이 rotate 방식이라면 이미 소비된 refresh cookie로 2차 refresh가 시도되고 실패하여 의도치 않은 `logout()` 호출로 이어질 수 있습니다.
- 제안: interceptor 진입 조건에 `!sessionRestoreInProgress` 추가하여 세션 복원 중 401 auto-refresh 자체를 억제:
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress  // 세션 복원 중 interceptor refresh 전면 억제
  )
  ```

---

**[INFO]** `sessionRestoreInProgress` 플래그 타이밍 — 올바름
- 위치: `auth-provider.tsx` — `restoreSession()` 진입 직후, `finally` 블록
- 상세: `setSessionRestoreInProgress(true)`가 `authApi.refresh()` 호출 이전에 위치하고, `setSessionRestoreInProgress(false)`가 `finally`에 있어 예외 경로에서도 플래그가 반드시 해제됩니다. `initAttempted.current` ref로 `restoreSession` 중복 실행도 방지됩니다. 타이밍 설계가 올바릅니다.

---

### 요약

JavaScript 단일 스레드 이벤트 루프 특성상 `refreshPromise`의 check-and-set 패턴은 원자적으로 동작하며, 동시 401 발생 시 단일 refresh 요청만 실행되는 핵심 동시성 요구사항이 올바르게 구현되었습니다. `sessionRestoreInProgress` 플래그도 `finally`에서 해제가 보장되어 고착 위험이 없습니다. 다만 두 가지 잠재적 문제가 남아 있습니다: refresh 실패 시 N개 대기 요청이 각각 독립적으로 catch 블록을 실행하여 redirect가 N번 중복 호출되는 점, 그리고 더 중요하게는 `sessionRestoreInProgress` 플래그가 interceptor의 리다이렉트만 억제하고 `doRefresh()` 재진입은 막지 못해 rotating refresh token 환경에서 `getMe()` 401 응답 시 이중 refresh 경쟁 조건이 발생할 수 있다는 점입니다.

### 위험도
**LOW**