## 동시성 코드 리뷰

### 발견사항

---

**[INFO]** `refreshPromise` 공유 구현 — 올바름
- 위치: `client.ts` — `refreshPromise`, `doRefresh()`
- 상세: JavaScript 단일 스레드 이벤트 루프 특성상 `if (!refreshPromise)` 체크와 할당 사이에 다른 코드가 개입할 수 없습니다. 따라서 `refreshPromise` 의 check-and-set 패턴은 실질적으로 원자적이며, 동시 401 발생 시 단일 refresh 요청만 실행되는 의도가 정확히 구현되었습니다. `.finally()`로 Promise를 정리하는 방식도 올바릅니다.

---

**[WARNING]** refresh 실패 시 다중 `setAccessToken(null)` 호출 및 중복 redirect
- 위치: `client.ts` — response interceptor catch block
- 상세: `doRefresh()`가 reject될 경우, 동시에 `refreshPromise`를 awaiting하던 N개의 요청이 모두 catch block으로 진입합니다. 각 catch는 독립적으로 `setAccessToken(null)`을 호출합니다. `setAccessToken(null)` 자체는 멱등적(idempotent)이라 결과는 동일하지만, `sessionRestoreInProgress`가 `false`인 상황이라면 N개의 요청이 모두 `window.location.href = "/login"` 을 연속 실행합니다. 브라우저는 마지막 할당값으로 이동하므로 동작에 문제는 없지만, N번의 불필요한 상태 변이가 발생합니다.
- 제안: refresh 실패 처리를 `doRefresh()` 내부로 통합하거나, 별도 `onRefreshFailure` 콜백을 한 번만 실행하는 패턴 적용. 현재 구조에서 최소한의 개선은 `refreshPromise` catch에서 redirect를 한 번만 실행하도록 `doRefresh`의 catch 내에서 처리하는 것:
  ```typescript
  refreshPromise = doRefresh()
    .catch((e) => {
      setAccessToken(null);
      if (typeof window !== "undefined" && !sessionRestoreInProgress) {
        window.location.href = "/login";
      }
      throw e; // re-throw so individual requests get rejection
    })
    .finally(() => { refreshPromise = null; });
  ```

---

**[WARNING]** `restoreSession`과 interceptor 간 이중 refresh 가능성
- 위치: `auth-provider.tsx` — `restoreSession()`, `client.ts` — response interceptor
- 상세: `restoreSession()`이 `authApi.refresh()`로 새 access token을 획득한 직후 `usersApi.getMe()`를 호출합니다. 이 `getMe()` 호출이 서버 측 이유(race, token propagation 지연 등)로 401을 반환하면, interceptor가 `sessionRestoreInProgress === true`를 확인하여 redirect는 억제하지만, `doRefresh()`를 **다시 실행**합니다. 방금 소비된 refresh cookie로 2번째 refresh가 시도되는 상황입니다. Refresh token이 rotate 방식이라면 이전에 발급된 refresh token이 이미 무효화되어 2번째 refresh가 실패하고, 결과적으로 `restoreSession`의 catch block이 `logout()`을 호출합니다.
- 제안: `usersApi.getMe()` URL도 interceptor 제외 목록에 추가하거나, `sessionRestoreInProgress` 플래그를 refresh 요청뿐 아니라 모든 401 auto-refresh 트리거를 억제하도록 확장:
  ```typescript
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress  // 세션 복원 중 interceptor refresh 전면 억제
  ) {
  ```

---

**[INFO]** `sessionRestoreInProgress` 플래그 타이밍 — 올바름
- 위치: `auth-provider.tsx` — `restoreSession()`, `client.ts` — `setSessionRestoreInProgress`
- 상세: `setSessionRestoreInProgress(true)` 호출이 `authApi.refresh()` 이전에, `setSessionRestoreInProgress(false)` 호출이 `finally` 블록에 위치하여 예외 발생 시에도 플래그가 반드시 해제됩니다. 타이밍 설계가 올바릅니다.

---

**[INFO]** `initAttempted` ref를 통한 `restoreSession` 중복 실행 방지 — 올바름
- 위치: `auth-provider.tsx` — `const initAttempted = useRef(false)`
- 상세: React 컴포넌트 re-render 시 useEffect의 의존성 배열에 의한 재실행을 `initAttempted.current` ref로 차단하는 방식은 올바릅니다. ref는 re-render 간 값을 유지하므로 의도대로 동작합니다.

---

### 요약

이번 변경에서 핵심 동시성 이슈였던 **중복 refresh 호출 문제**(`refreshPromise` 공유)와 **이중 redirect 충돌**(`sessionRestoreInProgress` 플래그)이 JavaScript 이벤트 루프의 단일 스레드 특성을 올바르게 활용하여 구현되었습니다. 다만 refresh 실패 시 N개의 대기 요청이 각각 독립적으로 catch block을 실행하여 `setAccessToken(null)` 및 redirect를 중복 호출하는 문제가 남아 있으며, 더 중요한 잠재 버그는 `restoreSession`의 `getMe()` 호출이 401을 반환할 경우 interceptor가 이미 소비된 refresh cookie로 재시도를 유발하는 이중 refresh 경로입니다.

### 위험도
**LOW**