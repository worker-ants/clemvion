## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** 프레젠테이션 레이어 → 인프라 레이어 직접 의존 — 레이어 책임 역전
- 위치: `auth-provider.tsx:7` — `import { setAccessToken, setSessionRestoreInProgress } from "@/lib/api/client"`
- 상세: `AuthProvider`(프레젠테이션 레이어)가 HTTP 인프라 모듈(`client.ts`)의 내부 상태 플래그를 직접 import하여 제어한다. 프레젠테이션 레이어는 "세션 복원" 의도만 표현해야 하며, 401 인터셉터의 리다이렉트 억제 메커니즘을 알고 직접 조작하는 것은 강한 결합(tight coupling)이다. 인터셉터 동작이 변경되면 `AuthProvider`도 반드시 수정되어야 하는 암묵적 계약이 생긴다.
- 제안: `authApi.restoreSession()` 또는 별도 `sessionService`로 세션 복원 로직을 캡슐화하고, `setSessionRestoreInProgress` 호출을 해당 함수 내부로 이전. `AuthProvider`는 성공/실패 결과만 수신.

---

**[WARNING]** `sessionRestoreInProgress`가 리다이렉트만 억제하고 interceptor refresh 재진입은 허용
- 위치: `client.ts:85` — `!sessionRestoreInProgress` 조건, `auth-provider.tsx:33-34` — `authApi.refresh()` 이후 `usersApi.getMe()` 호출
- 상세: `restoreSession`이 `authApi.refresh()`로 새 access token을 획득한 후 `usersApi.getMe()`를 호출할 때 서버가 401을 반환하면, 인터셉터는 리다이렉트는 억제하지만 `doRefresh()`를 **다시 실행**한다. Refresh token이 rotate 방식이라면 이미 소비된 쿠키로 2차 refresh가 실패하고 의도치 않은 로그아웃이 발생한다.
- 제안: 인터셉터 진입 조건에 `!sessionRestoreInProgress` 추가하여 세션 복원 중에는 auto-refresh 트리거 자체를 억제:
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress  // 세션 복원 중 interceptor refresh 전면 억제
  )
  ```

---

**[WARNING]** `client.ts` 단일 책임 원칙(SRP) 위반 — 7가지 책임 집중
- 위치: `frontend/src/lib/api/client.ts` 전체
- 상세: ① HTTP 클라이언트 설정, ② 인메모리 토큰 관리, ③ 요청 인터셉터, ④ 응답 인터셉터 + 401 처리, ⑤ refresh 중복 방지(`refreshPromise`), ⑥ 세션 복원 상태 관리(`sessionRestoreInProgress`), ⑦ 로그인 페이지 리다이렉트까지 하나의 모듈에 집중되어 있다. API 인프라 모듈이 UI 리다이렉트 로직과 세션 복원 플래그를 직접 보유하는 것은 레이어 분리 원칙에 위배된다.
- 제안: 단기적으로는 허용 가능. 기능 확장 시 토큰 관리를 `token-store.ts`로, 인터셉터 로직을 `auth-interceptor.ts`로 분리 고려.

---

**[WARNING]** `refreshPromise` 실패 시 N개 catch 블록 독립 실행 — 단일 실패 처리 원칙 위반
- 위치: `client.ts:73-86` — response interceptor catch block
- 상세: `doRefresh()` 실패 시 `refreshPromise`를 대기하던 N개 요청이 각각 독립적으로 catch 블록에 진입하여 `setAccessToken(null)`과 `window.location.href = "/login"`을 N번 연속 실행한다. `refreshPromise` 도입 목적(중복 제거)과 실패 처리가 불일치한다.
- 제안:
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

**[WARNING]** `restoreSession` finally 블록에서 `setLoading(false)` 미호출 — 암묵적 상태 의존
- 위치: `auth-provider.tsx:26,52` — `setLoading(true)` 시작, finally 블록
- 상세: `setLoading(true)`로 진입하지만 `finally`에서 `setSessionRestoreInProgress(false)`만 호출하고 `setLoading(false)`가 없다. 로딩 상태 해제가 `setAuthenticated()`와 `logout()` 내부 구현에 암묵적으로 의존한다. 로딩 상태를 시작한 함수가 종료 책임도 가져야 한다는 SRP 관점에서 위반이다.
- 제안: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리.

---

**[WARNING]** `UnauthorizedException`에 객체 전달 — 응답 스키마 불일치
- 위치: `auth.controller.ts:83-88` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- 상세: NestJS 기본 직렬화 시 실제 응답은 `{ statusCode: 401, message: { code: 'TOKEN_INVALID', message: '...' }, error: 'Unauthorized' }` 구조가 된다. `message` 필드가 문자열이 아닌 중첩 객체가 되어 프로젝트의 성공 응답 형식(`{ data: { ... } }`)과 다른 인증 에러들의 형식과 불일치한다. 글로벌 예외 필터 유무에 따라 실제 응답이 달라진다.
- 제안: 프로젝트에 글로벌 예외 필터가 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화하거나, 에러 응답 컨벤션을 글로벌 필터에서 일관 처리.

---

**[INFO]** `doRefresh()`가 동일 `apiClient` 인스턴스로 자기 참조 — 잠재적 인터셉터 재진입
- 위치: `client.ts:43-50` — `doRefresh()` 내 `apiClient.post("/auth/refresh", {})`
- 상세: `doRefresh()`가 동일 `apiClient`를 사용하므로 이론적으로 `interceptor → doRefresh() → apiClient → interceptor` 경로가 존재한다. `!originalRequest.url?.includes("/auth/")` 가드로 현재는 안전하지만, 가드 조건이 변경되면 순환이 발생한다.
- 제안: 가드 조건에 의도를 명시하는 주석 추가. 장기적으로는 refresh 전용 axios 인스턴스(`refreshClient`) 분리 고려.

---

**[INFO]** `@IsOptional()` / `@IsString()` 데코레이터 선언 순서 — class-validator 관례 불일치
- 위치: `refresh-token.dto.ts:3-5`
- 상세: `@IsString()`이 `@IsOptional()` 위에 선언되어 있다. class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 값이 없을 때 이후 검증자를 건너뛰는 동작이 명확하다. 라이브러리 버전에 따라 동작이 달라질 수 있다.
- 제안: `@IsOptional()` → `@IsString()` 순서로 변경.

---

**[INFO]** `refreshPromise`, `sessionRestoreInProgress` 모듈 레벨 가변 전역 상태
- 위치: `client.ts:32,36` — `let refreshPromise`, `let sessionRestoreInProgress`
- 상세: 모듈 레벨 가변 상태가 3개(`accessToken`, `refreshPromise`, `sessionRestoreInProgress`)로 늘어났다. 테스트에서 `vi.resetModules()` + dynamic import 패턴을 강제하는 구조적 원인이다. 단일 SPA에서는 문제없으나 테스트 격리 비용이 크다.
- 제안: 현재 규모에서는 허용 가능. 상태가 더 늘어나면 `TokenState` 객체로 그룹화하거나 `__resetForTest()` export 함수 추가 고려.

---

**[INFO]** `restoreSession` 함수 복합 책임 — 약 30줄에 6가지 관심사 집중
- 위치: `auth-provider.tsx:26-56`
- 상세: 로딩 상태 관리, 세션 복원 플래그, API 호출, 인증 상태 설정, 에러 처리, 리다이렉트까지 한 함수에 집중되어 있다. 현재는 단일 경로(cookie refresh)로 단순화되어 있으나, 복원 경로 추가 시 즉시 복잡도 임계점에 도달한다.
- 제안: 현재 규모에서는 허용 가능. 경로 추가 시 `tryRestoreFromCookie()` 분리 필요.

---

### 요약

이번 변경은 이전 리뷰에서 지적된 sessionStorage XSS, 동시 refresh 중복 호출, 이중 리다이렉트 충돌을 올바르게 해결했으나, 프레젠테이션 레이어(`AuthProvider`)가 API 인프라 레이어의 내부 플래그(`setSessionRestoreInProgress`)를 직접 제어하는 레이어 책임 역전이 핵심 아키텍처 문제로 남아 있다. 더불어 해당 플래그가 interceptor의 리다이렉트만 억제하고 `doRefresh()` 재진입은 허용하여 rotate 방식 refresh token 환경에서 이중 refresh 경쟁 조건이 잠재하며, refresh 실패 시 N개 catch 블록이 독립 실행되는 구조는 `refreshPromise` 도입 취지와 불일치한다. `setLoading(false)`의 암묵적 의존과 `UnauthorizedException` 응답 구조 불일치도 수정이 필요하다. 세션 복원 로직을 `sessionService` 또는 `authApi`로 캡슐화하면 레이어 경계, 플래그 관리, interceptor 재진입 문제가 동시에 해소된다.

### 위험도
**MEDIUM**