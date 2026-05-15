## 동시성 코드 리뷰

### 발견사항

---

**[INFO]** `refreshPromise` check-and-set 패턴 — 원자성 보장됨
- **위치**: `client.ts` — `if (!refreshPromise)` 블록
- **상세**: JavaScript 이벤트 루프는 단일 스레드이므로 `if (!refreshPromise)` 체크와 `refreshPromise = doRefresh()...` 할당 사이에 다른 코드가 개입할 수 없습니다. 동시 401 발생 시 단일 refresh 요청만 실행되는 의도가 이벤트 루프 특성상 원자적으로 보장됩니다. `.finally(() => { refreshPromise = null; })`로 정리되므로 Promise 누수도 없습니다.
- **제안**: 없음 (올바른 구현)

---

**[WARNING]** refresh 실패 시 N개의 대기 요청이 각각 독립적으로 catch block 진입
- **위치**: `client.ts` — response interceptor catch block
- **상세**: `doRefresh()`가 reject되면, `refreshPromise`를 공유하던 N개의 요청이 모두 개별 catch block으로 진입합니다. 각각 독립적으로 `setAccessToken(null)`과 `window.location.href = "/login"`을 실행합니다. `setAccessToken(null)`은 멱등적이므로 상태 문제는 없지만, `sessionRestoreInProgress === false`인 상황에서 N번의 `window.location.href` 할당이 연속 실행됩니다. 브라우저는 마지막 값으로 이동하므로 동작은 정상이지만 불필요한 반복 실행입니다.
- **제안**: redirect 처리를 `doRefresh()`의 `.catch()` 내부로 통합하여 단 한 번만 실행되도록 개선:
  ```typescript
  refreshPromise = doRefresh()
    .catch((e) => {
      setAccessToken(null);
      if (typeof window !== "undefined" && !sessionRestoreInProgress) {
        window.location.href = "/login";
      }
      throw e;
    })
    .finally(() => { refreshPromise = null; });
  ```

---

**[WARNING]** `restoreSession`의 `getMe()` 호출이 401 반환 시 interceptor가 이미 소비된 refresh token으로 재시도
- **위치**: `auth-provider.tsx` — `restoreSession()`, `client.ts` — response interceptor
- **상세**: `restoreSession()`이 `authApi.refresh()`로 새 access token을 획득한 직후 `usersApi.getMe()`를 호출합니다. 이 `getMe()` 호출이 서버 측 이유로 401을 반환하면, interceptor의 조건(`!originalRequest.url?.includes("/auth/")`)이 `getMe` URL에 대해 true이므로 `doRefresh()`를 **재실행**합니다. `sessionRestoreInProgress === true`이므로 redirect는 억제되지만 두 번째 refresh 시도는 막지 못합니다. Refresh token이 rotate 방식이라면 이미 소비된 token으로 재시도하여 실패하고, 결과적으로 `restoreSession`의 catch block이 `logout()`을 호출합니다.
- **제안**: `sessionRestoreInProgress` 플래그를 redirect 억제 외에 interceptor 자체의 401 처리 진입도 차단하도록 확장:
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
- **위치**: `auth-provider.tsx` — `restoreSession()` 내 `finally` 블록
- **상세**: `setSessionRestoreInProgress(true)`가 첫 비동기 호출(`authApi.refresh()`) 이전에 위치하고, `setSessionRestoreInProgress(false)`가 `finally` 블록에서 실행되므로 예외 경로에서도 플래그가 반드시 해제됩니다. 타이밍 설계가 올바릅니다.
- **제안**: 없음

---

**[INFO]** `initAttempted` ref를 통한 `restoreSession` 중복 실행 방지 — 올바름
- **위치**: `auth-provider.tsx` — `const initAttempted = useRef(false)`
- **상세**: React 컴포넌트 re-render 시 useEffect 재실행을 ref로 차단하는 방식은 올바릅니다. ref는 render 간 값을 유지하므로 의도대로 동작하며, 동시성 관점의 문제도 없습니다.
- **제안**: 없음

---

### 요약

이번 변경에서 핵심 동시성 이슈였던 **중복 refresh 호출 문제**는 `refreshPromise` 공유 패턴으로 JavaScript 이벤트 루프의 단일 스레드 특성을 올바르게 활용하여 구현되었습니다. `sessionRestoreInProgress` 플래그도 `finally` 블록에서 해제를 보장하여 상태 고착 위험이 없습니다. 그러나 두 가지 잔여 동시성 이슈가 남아 있습니다: refresh 실패 시 공유 Promise를 대기하던 N개의 요청이 각각 독립적으로 redirect를 실행하는 중복 실행 문제, 그리고 더 중요한 문제로 `restoreSession`의 `getMe()` 호출이 401을 받을 경우 interceptor가 이미 소비된 refresh cookie로 재시도를 유발하는 이중 refresh 경로입니다. 후자는 rotate 방식의 refresh token 환경에서 의도치 않은 로그아웃으로 이어질 수 있습니다.

### 위험도

**LOW**