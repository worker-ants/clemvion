### 발견사항

- **[WARNING]** 401 자동 갱신 인터셉터의 동시 요청 경쟁 조건
  - 위치: `client.ts` — response interceptor (`originalRequest._retry` 로직)
  - 상세: 여러 API 요청이 동시에 in-flight 상태일 때 모두 401을 받으면, 각 요청의 error handler가 독립적으로 `/auth/refresh`를 호출합니다. Refresh token이 단일 사용(single-use) 방식이라면, 첫 번째 호출만 성공하고 나머지는 실패하여 의도치 않은 강제 로그아웃이 발생할 수 있습니다. `_retry` 플래그는 동일 요청의 재시도 루프만 방지할 뿐, 병렬 요청 간의 중복 refresh는 방지하지 못합니다.
  - 제안: 진행 중인 refresh 요청을 추적하는 Promise를 모듈 레벨에서 공유하여, 동시 401 발생 시 모든 대기 요청이 단일 refresh 완료를 기다리도록 처리합니다.
  ```typescript
  let refreshPromise: Promise<string> | null = null;

  // 인터셉터 내부에서
  if (!refreshPromise) {
    refreshPromise = apiClient.post("/auth/refresh", {})
      .then(({ data }) => {
        const token = data.data?.accessToken;
        setAccessToken(token);
        return token;
      })
      .finally(() => { refreshPromise = null; });
  }
  const newToken = await refreshPromise;
  ```

- **[WARNING]** `restoreSession` 내 토큰 읽기와 사용 사이의 비원자성
  - 위치: `auth-provider.tsx` lines 28–38
  - 상세: `storedToken = getAccessToken()` 이후 `await usersApi.getMe()`를 기다리는 동안, 401 인터셉터가 토큰을 갱신할 수 있습니다. 이후 `setAuthenticated(getAccessToken() ?? storedToken, user)`는 의도적으로 최신 토큰을 사용하려 하지만, `getMe()` 응답의 `user`는 갱신된 토큰이 아닌 원래 토큰으로 인증된 응답임을 혼동할 여지가 있습니다. 실제로는 동일 사용자이므로 문제가 없지만, 코드의 의도가 모호합니다.
  - 제안: `await` 완료 후 명시적으로 최신 토큰을 사용하도록 변수명을 정리하거나 주석으로 의도를 명확히 기술합니다.

- **[INFO]** `getAccessToken()`의 암묵적 상태 변이(side effect)
  - 위치: `client.ts` `getAccessToken()` 함수
  - 상세: getter 함수가 `sessionStorage`에서 읽어 모듈 레벨 변수 `accessToken`을 변이시킵니다. JavaScript는 단일 스레드이므로 진정한 경쟁 조건은 아니지만, 순수 getter가 아닌 점은 코드 추론을 어렵게 만들고, 테스트에서 `vi.resetModules()`로 모듈을 재가져오는 복잡한 방식을 요구하는 원인이 됩니다.
  - 제안: 초기화 로직을 별도의 `initToken()` 함수로 분리하거나, `setAccessToken`이 호출될 때만 상태를 변경하도록 제한합니다.

- **[INFO]** 테스트 파일에서 `vi` 미임포트
  - 위치: `client.test.ts` — `vi.resetModules()` 사용
  - 상세: `vi`가 `vitest`에서 명시적으로 import되지 않았습니다(`import { describe, it, expect, beforeEach } from "vitest"`). Vitest 환경에서는 전역으로 노출될 수 있으나, 명시적 import가 코드 일관성 측면에서 권장됩니다.
  - 제안: `import { describe, it, expect, beforeEach, vi } from "vitest";`

---

### 요약

변경된 코드는 JavaScript 단일 스레드 환경에서 대부분 안전하게 동작합니다. 그러나 **기존부터 존재하는 401 자동 갱신 인터셉터에서 동시 요청이 모두 실패할 경우 중복 refresh 호출**이 발생할 수 있으며, 이는 서버의 refresh token 정책(단일 사용 여부)에 따라 실제 사용자 로그아웃으로 이어지는 잠재적 버그입니다. 이번 변경 자체는 토큰 복원 경로를 추가한 것으로 직접적인 동시성 문제를 새로 도입하지는 않으나, `getAccessToken()`의 side effect를 가진 설계와 결합되어 코드 추론 복잡도를 높입니다.

### 위험도
**MEDIUM**