## 발견사항

---

### **[WARNING]** 공유 `refreshPromise` 실패 시 N개 catch 블록 독립 실행
- **위치**: `client.ts` — response interceptor catch block
- **상세**: `refreshPromise`를 공유하여 N개 요청이 `await refreshPromise`로 대기 중 refresh가 실패하면, N개 요청이 각자 독립적으로 catch 블록에 진입한다. `setAccessToken(null)`은 멱등적이라 결과는 동일하지만, `sessionRestoreInProgress === false`인 상황에서 `window.location.href = "/login"`도 N번 연속 실행된다. 브라우저는 최종값으로만 이동하므로 동작에는 문제없으나, 의도치 않은 중복 상태 변이가 발생한다.
- **제안**: refresh 실패 처리를 `doRefresh()` 내부로 통합하거나, 첫 실패에서만 실행되도록 `refreshPromise.catch()` 내부로 이전:
  ```ts
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

### **[WARNING]** `restoreSession` finally 블록에서 `setLoading(false)` 미호출
- **위치**: `auth-provider.tsx` — `restoreSession` finally block
- **상세**: `setLoading(true)`로 시작하지만 `finally`에서 `setSessionRestoreInProgress(false)`만 호출하고 `setLoading(false)`가 없다. 로딩 상태 해제가 `setAuthenticated()` 또는 `logout()` 내부 구현에 암묵적으로 의존한다. 스토어 액션이 `isLoading`을 리셋하지 않으면 로딩 스피너가 무기한 표시되는 부작용이 발생한다. (이전 리뷰의 side_effect WARNING #3에서 이미 지적된 사항이나 미조치 상태)
- **제안**: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리.

---

### **[WARNING]** `UnauthorizedException`에 객체 전달로 응답 `message` 타입 변경
- **위치**: `auth.controller.ts:83-88` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- **상세**: NestJS에서 `UnauthorizedException`에 객체를 전달하면 응답 `message` 필드가 문자열이 아닌 중첩 객체 `{ code: 'TOKEN_INVALID', message: '...' }`가 된다. 실제 응답: `{ statusCode: 401, message: { code: ..., message: ... }, error: 'Unauthorized' }`. 클라이언트 인터셉터나 에러 핸들러가 `error.response.data.message`를 문자열로 처리할 경우 예상치 못한 동작이 발생한다. 글로벌 예외 필터가 있다면 이 구조를 처리하는지 검증 필요.
- **제안**: `throw new UnauthorizedException('No refresh token provided')` 로 단순화하거나, 프로젝트 전역 에러 응답 컨벤션을 글로벌 필터에서 통일 처리.

---

### **[INFO]** `RefreshTokenDto.refreshToken` 시그니처 변경으로 호출자 영향
- **위치**: `refresh-token.dto.ts` — `refreshToken?: string`
- **상세**: `string` → `string | undefined`로 타입이 넓어졌다. 현재 `auth.controller.ts`는 `|| dto.refreshToken` fallback 앞에서 null check를 수행하므로 안전하다. 그러나 이 DTO를 직접 사용하는 다른 서비스/컨트롤러에서 `dto.refreshToken`을 non-null로 가정했다면 런타임에 `undefined` 참조 버그가 발생할 수 있다.
- **제안**: codebase에서 `RefreshTokenDto` 사용처를 전수 확인할 것.

---

### **[INFO]** `setSessionRestoreInProgress` — 외부 노출된 모듈 레벨 뮤터블 상태
- **위치**: `client.ts:37-39` — `export function setSessionRestoreInProgress`
- **상세**: 모듈 외부에서 `sessionRestoreInProgress` 플래그를 자유롭게 조작할 수 있다. 현재 `AuthProvider`가 `finally`에서 반드시 `false`로 리셋하므로 안전하지만, 미래에 다른 소비자가 `true`로 설정한 채 방치하면 인터셉터 redirect가 영구 억제되는 숨겨진 버그가 발생 가능하다.
- **제안**: 향후 사용처가 늘어나면 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화 고려.

---

### **[INFO]** `restoreSession` 중 `getMe()` 401 → 인터셉터가 refresh 재시도
- **위치**: `auth-provider.tsx:34`, `client.ts` response interceptor
- **상세**: `authApi.refresh()`로 새 토큰 획득 후 `usersApi.getMe()` 호출 시 서버 측 이유로 401이 반환되면, 인터셉터가 `sessionRestoreInProgress === true`이므로 redirect는 억제하지만 `doRefresh()`를 **다시 실행**한다. Refresh token이 rotate 방식이면 이미 소비된 토큰으로 두 번째 refresh가 실패하고 `restoreSession` catch에서 `logout()`이 호출된다. 정상 동작하나 의도하지 않은 refresh 재시도라는 부작용이 있다.
- **제안**: `sessionRestoreInProgress === true`일 때 `/auth/` 외 401도 interceptor refresh를 억제하는 조건 추가 고려:
  ```ts
  !sessionRestoreInProgress  // 세션 복원 중 전체 auto-refresh 억제
  ```

---

## 요약

이번 변경은 이전 리뷰에서 제기된 핵심 이슈(sessionStorage XSS, 동시 refresh 중복, 이중 redirect)를 올바르게 해결했다. 부작용 관점에서 주목할 사항은 세 가지다: (1) `refreshPromise` 공유 실패 시 N개 catch 블록이 각각 독립 실행되어 `setAccessToken(null)`과 redirect가 중복 호출되는 문제, (2) `restoreSession` finally에서 `setLoading(false)` 미호출로 인한 로딩 상태 암묵적 의존, (3) `UnauthorizedException`에 객체 전달로 인한 응답 `message` 타입 변경이 클라이언트 에러 핸들러에 미치는 영향. 나머지는 낮은 위험도의 설계 관찰 사항이다.

## 위험도

**LOW** — 기능 동작은 올바르나, refresh 실패 시 N중 중복 실행과 로딩 상태 암묵적 의존은 엣지 케이스에서 예상치 못한 부작용을 유발할 수 있다.