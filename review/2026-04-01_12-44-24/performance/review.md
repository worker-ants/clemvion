## 리뷰 결과 — Performance

---

### 발견사항

- **[WARNING]** `restoreSession`에서 token 존재 시 불필요한 네트워크 왕복 발생
  - 위치: `auth-provider.tsx` L31–37
  - 상세: `getAccessToken()`으로 메모리/sessionStorage에서 토큰을 읽은 뒤, 즉시 `usersApi.getMe()`를 호출하여 검증한다. 그러나 accessToken이 유효한 경우 이 경로는 정상 동작하지만, 만료된 경우 401 인터셉터가 `authApi.refresh()`를 호출하고, 다시 `getMe()`를 재시도한다. 즉 토큰 만료 시 실질적으로 `refresh → getMe → getMe (retry)` 3번의 왕복이 발생한다. 기존 코드(refresh → getMe, 2회)보다 느리다.
  - 제안: 토큰 만료 여부를 JWT payload의 `exp` 클레임으로 클라이언트 사이드에서 선검증하여, 만료 토큰이면 바로 refresh 경로로 분기한다. 아래 예시:
    ```ts
    function isTokenExpired(token: string): boolean {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp * 1000 < Date.now();
      } catch {
        return true;
      }
    }

    const storedToken = getAccessToken();
    if (storedToken && !isTokenExpired(storedToken)) {
      // 유효한 토큰 — getMe 1회만 호출
      ...
    }
    // 만료/없음 — refresh → getMe 2회
    ```

- **[WARNING]** `getAccessToken()` 호출이 매 요청 인터셉터마다 `sessionStorage.getItem` 조건 분기 수행
  - 위치: `client.ts` L27–31, request interceptor
  - 상세: 인메모리 `accessToken`이 초기화된 이후에는 `sessionStorage.getItem`을 호출하지 않지만, SSR 환경에서 `typeof window !== "undefined"` 체크가 매 요청마다 실행된다. Next.js App Router에서 클라이언트 컴포넌트는 hydration 이후 항상 `window`가 존재하므로, 이 분기는 실질적으로 dead code가 된다. 단, 파일 상단에 `"use client"` 지시어가 있으므로 SSR에서 이 모듈 자체가 실행되어야 하는지 재검토 필요.
  - 제안: `getAccessToken`에서 `window` 체크를 lazy initialization guard로 한 번만 수행하도록 하거나, 모듈 로드 시 `typeof window !== "undefined"`를 한 번 평가해 플래그로 저장한다:
    ```ts
    const isBrowser = typeof window !== "undefined";
    ```

- **[INFO]** `setAccessToken` 내 `sessionStorage.setItem`/`removeItem` 동기 I/O
  - 위치: `client.ts` L20–26
  - 상세: `sessionStorage` 조작은 동기 메인스레드 I/O다. 토큰 설정 빈도가 낮아(로그인, refresh 성공 시 1회) 실질적 병목은 아니지만, 대용량 토큰(e.g. JWT with large claims)이 들어올 경우 직렬화 비용이 발생할 수 있다.
  - 제안: 현재 사용 패턴에서는 무시 가능. 토큰 크기를 모니터링하는 정도로 충분.

- **[INFO]** 테스트에서 `vi.resetModules()` + dynamic `import`를 `beforeEach`마다 반복
  - 위치: `client.test.ts` L9–15
  - 상세: 각 테스트 전 모듈 전체를 재로드하므로 테스트 실행 시간이 선형적으로 증가한다. 테스트 수가 적어 현재는 문제없지만, 테스트가 늘어날 경우 병목이 된다.
  - 제안: 인메모리 토큰 초기화를 위해 모듈 재로드 대신, 모듈에 `__resetForTest`용 exported 함수를 추가하거나, `accessToken` 변수를 Vitest의 `vi.spyOn`/factory pattern으로 제어한다.

---

### 요약

변경사항의 핵심 성능 이슈는 **세션 복원 경로에서의 네트워크 왕복 증가**다. 유효한 토큰이 있을 때는 개선(getMe 1회)되지만, 만료 토큰이 있을 때는 기존보다 오히려 1회 더 왕복이 발생한다. 클라이언트 사이드 JWT 만료 사전검증을 추가하면 두 경로 모두 최적화된다. `getAccessToken`의 `typeof window` 체크와 `sessionStorage` 접근은 핫패스(매 API 요청)에 있으므로 `isBrowser` 상수로 추출하는 것이 바람직하다. 나머지 이슈는 경미하거나 무시 가능한 수준이다.

### 위험도

**MEDIUM**