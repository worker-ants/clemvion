## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** 프레젠테이션 레이어 → 인프라 레이어 직접 의존 — 레이어 책임 위반
- 위치: `auth-provider.tsx:7`, `auth-provider.tsx:26,54` — `import { setSessionRestoreInProgress } from "@/lib/api/client"`
- 상세: `AuthProvider`(프레젠테이션 레이어)가 API 클라이언트 내부 플래그 제어 함수(`setSessionRestoreInProgress`)를 직접 import하여 호출. 이는 프레젠테이션 레이어가 인프라 레이어의 동작 방식을 알고 제어하는 구조로, 레이어 추상화 원칙 위반. `AuthProvider`는 "세션을 복원한다"는 의도만 표현해야 하며, 인터셉터 리다이렉트 억제 여부는 알 필요가 없음.
- 제안: 세션 복원 흐름을 `authApi.restoreSession()` 또는 별도 `sessionService`로 위임. 내부적으로 `setSessionRestoreInProgress` 호출을 캡슐화하여 `AuthProvider`가 플래그 존재를 모르도록 분리.

---

**[WARNING]** `sessionRestoreInProgress` 플래그가 인터셉터 재진입을 부분적으로만 차단
- 위치: `client.ts:85` — `!sessionRestoreInProgress` 조건, `auth-provider.tsx:33` — `authApi.refresh()` 이후 `usersApi.getMe()` 호출
- 상세: `sessionRestoreInProgress=true`는 인터셉터의 `window.location.href` 리다이렉트만 억제하고, `doRefresh()` 실행 자체는 막지 않음. `restoreSession`에서 `authApi.refresh()` 성공 후 `usersApi.getMe()`가 401을 반환하면, 인터셉터가 `doRefresh()`를 다시 호출하여 이미 소비된 refresh cookie로 2차 refresh를 시도하는 이중 refresh 경로가 발생. Refresh token rotation 방식이라면 2차 refresh가 실패하고 의도치 않은 로그아웃으로 이어짐.
- 제안: 인터셉터 진입 조건에 `!sessionRestoreInProgress` 추가하여 세션 복원 중에는 401 auto-refresh 트리거 자체를 억제:
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress  // 세션 복원 중 interceptor 전면 억제
  )
  ```

---

**[WARNING]** `UnauthorizedException` 객체 전달 방식 — 응답 스키마 불일치
- 위치: `auth.controller.ts:83-88` — `throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: '...' })`
- 상세: NestJS `UnauthorizedException`에 객체를 전달하면 실제 응답이 `{ statusCode: 401, message: { code, message }, error: 'Unauthorized' }` 구조가 됨. `message` 필드가 문자열 대신 중첩 객체가 되어 프로젝트의 성공 응답 형식(`{ data: { ... } }`)과 불일치. 글로벌 예외 필터 없이는 에러 응답 스키마가 일관되지 않음.
- 제안: 프로젝트에 글로벌 예외 필터가 있다면 해당 필터가 이 구조를 처리하는지 검증. 없다면 `throw new UnauthorizedException('No refresh token provided')` 단순화 또는 프로젝트 에러 컨벤션을 통일하는 글로벌 필터 도입.

---

**[WARNING]** `restoreSession`에서 `setLoading(false)` 미호출 — 암묵적 상태 의존
- 위치: `auth-provider.tsx:26` — `setLoading(true)`, `finally` 블록
- 상세: `setLoading(true)` 호출 후 `finally`에서 `setLoading(false)`를 명시적으로 호출하지 않음. 로딩 상태 해제가 `setAuthenticated()`와 `logout()` 스토어 액션의 내부 구현에 암묵적으로 의존. SRP 관점에서 `restoreSession`이 로딩 상태를 시작했다면 종료 책임도 가져야 함. `setAuthenticated`나 `logout` 구현이 변경될 경우 로딩 스피너가 영구 표시되는 UX 버그로 이어질 수 있음.
- 제안: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리.

---

**[INFO]** `refreshPromise` 실패 시 N개 catch 블록 독립 실행 — 단일 실패 처리 원칙 위반
- 위치: `client.ts:73-86` — response interceptor catch block
- 상세: `doRefresh()` 실패 시 `refreshPromise`를 대기하던 N개 요청이 각각 독립적으로 catch 블록을 실행. `setAccessToken(null)`은 멱등적이나, `window.location.href = "/login"`이 N번 연속 실행됨. 단일 refresh 실패에 대한 사후 처리가 N번 중복되는 구조는 `refreshPromise` 도입 목적(중복 제거)과 불일치.
- 제안: 실패 처리를 `doRefresh()` 내부 또는 `.catch()` 체인에서 한 번만 실행:
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

**[INFO]** `client.ts` 단일 모듈 다중 책임 — SRP 경계 모호
- 위치: `client.ts` 전체
- 상세: 토큰 메모리 저장, 요청 인터셉터, 응답 인터셉터, refresh 중복 제거 오케스트레이션, 세션 복원 플래그 관리, 리다이렉트 실행까지 하나의 모듈에 집중. 각 관심사가 분리되지 않아 테스트에서 `vi.resetModules()` + dynamic import 패턴이 강제됨.
- 제안: 현재 규모에서는 허용 가능. 기능 확장 시 `token-store.ts`(메모리 상태), `auth-interceptor.ts`(인터셉터 로직) 분리 고려.

---

**[INFO]** `@IsOptional()` 데코레이터 순서 — class-validator 관례 불일치
- 위치: `refresh-token.dto.ts:3-5` — `@IsString()` → `@IsOptional()` 순서
- 상세: class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 "값 없음 시 검증 스킵" 동작이 명확하게 전달됨. 현재 순서(`@IsString()` 위에 `@IsOptional()` 아래)는 라이브러리 버전에 따라 의도와 다르게 동작할 수 있음.
- 제안: `@IsOptional()` → `@IsString()` 순서로 변경.

---

### 요약

이번 변경은 동시 refresh 중복 방지(`refreshPromise`), 세션 복원 중 이중 리다이렉트 억제(`sessionRestoreInProgress`), 쿠키 path 일관성(`clearCookie path: '/'`) 등 이전 리뷰 이슈를 대부분 올바르게 해결했으나, 아키텍처 관점의 핵심 문제가 두 가지 남아 있다. 첫째, `AuthProvider`(프레젠테이션 레이어)가 `setSessionRestoreInProgress`를 직접 호출하여 인프라 레이어 내부 동작을 제어하는 레이어 역전이 발생하고 있으며, 이 플래그가 리다이렉트만 억제하고 interceptor의 `doRefresh()` 재진입은 막지 못해 rotate 방식 refresh token에서 이중 refresh 경쟁 조건이 잠재함. 세션 복원 로직을 `authApi`나 `sessionService`로 캡슐화하면 레이어 경계와 플래그 타이밍 문제가 동시에 해소된다.

### 위험도

**MEDIUM**