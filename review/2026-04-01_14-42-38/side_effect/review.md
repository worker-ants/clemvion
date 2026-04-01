## 발견사항

### **[INFO]** `refreshPromise` 모듈 레벨 공유 상태 — 탭 격리 불필요 주의
- **위치**: `client.ts` — `let refreshPromise`
- **상세**: 모듈 싱글톤 변수로 선언되어 동일 탭 내 모든 요청이 공유함. 이는 의도된 설계이나, `doRefresh()` 내부에서 예외가 발생해도 `.finally()`로 `null` 초기화가 보장되므로 누수 없음. 정상 동작.
- **제안**: 없음

### **[INFO]** `sessionRestoreInProgress` 플래그 — 예외 시에도 해제 보장 여부
- **위치**: `auth-provider.tsx` — `finally { setSessionRestoreInProgress(false) }`
- **상세**: `finally` 블록에서 해제하므로 예외 경로에서도 플래그가 `true`로 고착되는 문제 없음. 정상 동작.
- **제안**: 없음

### **[WARNING]** `doRefresh()` 내 `apiClient.post` 호출이 response interceptor를 재진입
- **위치**: `client.ts` — `doRefresh()` 함수
- **상세**: `doRefresh()`는 `apiClient.post("/auth/refresh", {})`를 호출하는데, 이 요청 자체가 401을 반환하면 response interceptor가 다시 실행됨. interceptor 조건에 `!originalRequest.url?.includes("/auth/")` 가드가 있어 `/auth/refresh`는 재귀 진입을 막음. 단, `doRefresh()` 실패 시 `catch` 블록에서 `setAccessToken(null)` 후 `sessionRestoreInProgress`가 `false`인 경우에만 `window.location.href = "/login"` 리다이렉트가 발생함. `doRefresh()`가 `refreshPromise` 공유 Promise로 실행 중일 때 interceptor의 `catch`에서 강제 리다이렉트가 발생하면 `AuthProvider`의 `catch`와 **이중 실행** 가능성이 있음 — `sessionRestoreInProgress=true`이면 interceptor redirect는 억제되므로 세션 복원 중에는 안전하나, 세션 복원 완료 후 일반 API 요청에서 발생한 401은 interceptor redirect만 실행되어 정상임.
- **제안**: 현재 구현은 올바름. 단, `doRefresh()` 실패 경로에서 `refreshPromise = null` 초기화는 `.finally()`로 보장되므로 후속 요청이 새 refresh를 시도할 수 있음 — 이는 의도된 동작이나 로그아웃 후에도 재시도가 발생하지 않도록 `accessToken === null` 상태를 interceptor 진입 조건에 추가 고려.

### **[WARNING]** `RefreshTokenDto.refreshToken` 선택적 변경으로 인한 호출자 영향
- **위치**: `refresh-token.dto.ts` — `refreshToken?: string`
- **상세**: 기존 `refreshToken: string` (필수) → `refreshToken?: string` (선택)으로 변경됨. 백엔드에서 이 DTO를 사용하는 다른 코드가 `dto.refreshToken`을 non-null로 가정하면 타입 에러 또는 런타임 undefined 참조 발생 가능. `auth.controller.ts`에서 `dto.refreshToken`은 `|| dto.refreshToken` fallback으로만 사용되고, 앞에서 null check (`if (!token) throw`)가 있으므로 컨트롤러 레벨은 안전함.
- **제안**: DTO를 직접 사용하는 다른 서비스/컨트롤러가 없는지 확인 필요.

### **[INFO]** `res.clearCookie('refreshToken', { path: '/' })` — 쿠키 설정과 일관성
- **위치**: `auth.controller.ts:71`
- **상세**: `setRefreshTokenCookie()`에서 `path: '/'`로 쿠키를 설정하고 있으므로, `clearCookie`에도 동일한 `path`를 지정하는 것은 올바른 수정임. 이전에 `path` 없이 clear했을 경우 쿠키가 삭제되지 않는 버그가 있었음.
- **제안**: 없음

### **[INFO]** `setSessionRestoreInProgress`가 module-level mutable state를 노출
- **위치**: `client.ts` — `export function setSessionRestoreInProgress`
- **상세**: 모듈 외부에서 `sessionRestoreInProgress` 플래그를 직접 조작할 수 있음. `AuthProvider`가 `finally`에서 반드시 `false`로 되돌리므로 현재 사용처는 안전. 그러나 미래에 다른 소비자가 `true`로 설정한 채 방치하면 인터셉터 redirect가 영구 억제되는 숨겨진 버그 발생 가능.
- **제안**: 현재 사용 패턴에서는 문제없으나, 향후 사용처가 늘어날 경우 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화 고려.

---

### 요약

이번 변경은 이전 리뷰의 핵심 이슈(동시성, 이중 리다이렉트, sessionStorage 보안)를 올바르게 해결했다. `refreshPromise` 공유와 `sessionRestoreInProgress` 플래그는 `finally`로 정리가 보장되어 상태 누수 없음. 가장 주목할 부작용은 `doRefresh()` 실패 시 interceptor의 `catch` 블록이 `window.location.href` 리다이렉트를 실행할 수 있다는 점인데, `sessionRestoreInProgress` 플래그로 세션 복원 중에는 억제되어 현재 시나리오에서는 안전하다. `RefreshTokenDto` 선택적 변경은 컨트롤러 레벨에서 null check로 보완되어 있으나 DTO 다른 사용처 확인이 필요하다.

### 위험도
**LOW**