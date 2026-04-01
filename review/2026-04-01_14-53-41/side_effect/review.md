## 발견사항

---

### **[WARNING]** `refreshPromise` 실패 시 N개 catch 블록 독립 실행 — 중복 상태 변이
- **위치**: `client.ts` — response interceptor catch block
- **상세**: `doRefresh()` 실패 시 `refreshPromise`를 `await`하던 N개 요청이 각각 독립적으로 catch 블록으로 진입. `setAccessToken(null)`은 멱등적이나, `sessionRestoreInProgress === false`인 일반 API 요청 환경에서 `window.location.href = "/login"`이 N번 연속 실행됨. `refreshPromise` 도입 목적(중복 제거)이 성공 경로만 단일화하고 실패 경로는 단일화하지 못함.
- **제안**:
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

### **[WARNING]** `restoreSession` finally에서 `setLoading(false)` 미호출 — 로딩 상태 암묵적 의존
- **위치**: `auth-provider.tsx:26` — `setLoading(true)`, finally block
- **상세**: `setLoading(true)`로 시작하지만 `finally { setSessionRestoreInProgress(false) }`에서 `setLoading(false)`를 호출하지 않음. 로딩 상태 해제가 `setAuthenticated()`/`logout()` 내부 구현에 암묵적으로 의존. 두 함수 중 하나라도 `isLoading: false`를 설정하지 않으면 로딩 스피너가 무기한 표시되는 부작용 발생. 이전 리뷰(side_effect WARNING #3)에서도 지적된 사항이나 미조치.
- **제안**: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리.

---

### **[WARNING]** `UnauthorizedException` 객체 전달로 응답 `message` 타입 변경 — 클라이언트 파싱 파괴
- **위치**: `auth.controller.ts:83-88` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- **상세**: NestJS 기본 직렬화 시 `message` 필드가 문자열이 아닌 중첩 객체 `{ code, message }`가 됨. 실제 응답: `{ statusCode: 401, message: { code: 'TOKEN_INVALID', message: '...' }, error: 'Unauthorized' }`. 프론트엔드 인터셉터나 에러 핸들러가 `error.response.data.message`를 문자열로 처리할 경우 예상치 못한 파싱 실패 발생. 글로벌 예외 필터 유무에 따라 실제 응답 구조가 달라짐.
- **제안**: 글로벌 예외 필터 확인 후, 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화.

---

### **[WARNING]** `sessionRestoreInProgress=true`일 때 interceptor가 `doRefresh()` 재진입 허용 — 이중 refresh 위험
- **위치**: `client.ts:85`, `auth-provider.tsx:34`
- **상세**: 플래그가 `window.location.href` 리다이렉트만 억제하고 interceptor의 `doRefresh()` 실행 자체는 막지 않음. `restoreSession`이 `authApi.refresh()` 성공 후 `usersApi.getMe()`가 서버 측 이유로 401을 반환하면, interceptor가 이미 소비된 refresh cookie로 `doRefresh()`를 다시 실행. rotate 방식 refresh token이라면 2차 refresh가 실패하고 의도치 않은 `logout()` 호출.
- **제안**: interceptor 조건에 `!sessionRestoreInProgress` 추가하여 세션 복원 중 401 auto-refresh 트리거 자체 억제:
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress
  )
  ```

---

### **[WARNING]** `RefreshTokenDto.refreshToken` 시그니처 변경 — 호출자 타입 파괴 가능성
- **위치**: `refresh-token.dto.ts` — `refreshToken?: string`
- **상세**: `string` (필수) → `string | undefined` (선택)으로 타입이 넓어짐. `auth.controller.ts`는 null check 후 `|| dto.refreshToken` fallback으로 사용하므로 안전. 그러나 codebase 내 다른 서비스/컨트롤러가 `dto.refreshToken`을 non-null로 가정하면 컴파일 경고 없이 `undefined` 런타임 버그 발생 가능.
- **제안**: `RefreshTokenDto` 사용처 전수 확인 필요.

---

### **[INFO]** `@IsString()` / `@IsOptional()` 데코레이터 순서 — class-validator 관례 위반
- **위치**: `refresh-token.dto.ts:3-5`
- **상세**: `@IsString()`이 `@IsOptional()` 위에 선언됨. class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 값이 없을 때 이후 검증자를 건너뜀. 라이브러리 버전에 따라 `undefined` 입력에 `@IsString()` 검증이 먼저 실행되어 예상치 못한 400 에러 발생 가능.
- **제안**: `@IsOptional()` → `@IsString()` 순서로 변경.

---

### **[INFO]** `setSessionRestoreInProgress` 외부 노출 — 플래그 고착 위험
- **위치**: `client.ts:40-42` — `export function setSessionRestoreInProgress`
- **상세**: 모듈 외부에서 플래그를 자유롭게 조작 가능. 현재 `AuthProvider`가 `finally`에서 반드시 `false`로 리셋하므로 안전하나, 미래 소비자가 `true`로 설정한 채 방치하면 인터셉터 redirect가 영구 억제되는 숨겨진 보안 우회 경로 생성.
- **제안**: 향후 사용처가 늘어나면 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화 고려.

---

### **[INFO]** `res.clearCookie` path 옵션 추가 — 긍정적 부작용 수정
- **위치**: `auth.controller.ts:71`
- **상세**: 쿠키 설정 시 `path: '/'`를 사용하므로 삭제 시에도 동일 path가 필요. 이번 수정 이전에는 path 불일치로 로그아웃 후에도 refresh token 쿠키가 브라우저에 잔존하는 실제 버그가 있었음. 올바른 수정.

---

### **[INFO]** `doRefresh()` 내 빈 body 직렬화 — 불필요한 Content-Type 헤더
- **위치**: `client.ts:44` — `apiClient.post("/auth/refresh", {})`
- **상세**: `refreshToken`이 optional이므로 body 없이도 유효. 매 refresh 호출마다 `{}` 직렬화 + `Content-Type: application/json` 헤더가 불필요하게 전송됨. 실질적 영향은 미미.
- **제안**: `apiClient.post("/auth/refresh")` 또는 `apiClient.post("/auth/refresh", undefined)`.

---

## 요약

이번 변경의 부작용 핵심 위험은 세 가지다. 첫째, `refreshPromise` 공유로 성공 경로의 중복은 제거됐으나 실패 경로에서 N개 catch 블록이 독립 실행되어 `window.location.href` 할당이 중복 발생한다. 둘째, `restoreSession`이 `setLoading(true)`로 시작했으나 `finally`에서 `setLoading(false)`를 호출하지 않아 스토어 내부 구현에 암묵적으로 의존한다. 셋째, `sessionRestoreInProgress` 플래그가 리다이렉트만 억제하고 interceptor의 `doRefresh()` 재진입은 허용하여, rotate 방식 refresh token 환경의 세션 복원 중 `getMe()` 401 응답 시 이미 소비된 토큰으로 재시도가 발생한다. `UnauthorizedException`에 객체를 전달하는 방식도 응답 `message` 필드의 타입을 문자열에서 중첩 객체로 변경하여 클라이언트 에러 핸들러에 파괴적 부작용을 줄 수 있다.

## 위험도

**LOW**