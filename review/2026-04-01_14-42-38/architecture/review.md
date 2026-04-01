## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** `client.ts`의 단일 책임 원칙(SRP) 위반 — 다중 책임 집중
- 위치: `frontend/src/lib/api/client.ts` 전체
- 상세: `client.ts`가 현재 담당하는 책임이 ① HTTP 클라이언트 설정, ② 인메모리 토큰 관리, ③ 요청 인터셉터, ④ 응답 인터셉터 + 401 처리, ⑤ refresh 중복 방지(`refreshPromise`), ⑥ 세션 복원 상태 관리(`sessionRestoreInProgress`), ⑦ 로그인 페이지 리다이렉트로 7가지에 달함. API 인프라 모듈이 UI 리다이렉트 로직과 세션 복원 상태를 직접 보유하는 것은 레이어 분리 원칙 위반임.
- 제안: 토큰 관리를 `tokenStore.ts`로, 세션 복원 플래그와 리다이렉트 로직을 별도 `sessionManager.ts`로 분리. `client.ts`는 순수 HTTP 인프라 역할만 수행.

---

**[WARNING]** `AuthProvider`(Presentation Layer)가 API 인프라 내부 상태를 직접 제어
- 위치: `auth-provider.tsx:8` — `import { setAccessToken, setSessionRestoreInProgress } from "@/lib/api/client"`
- 상세: 프레젠테이션 레이어가 인프라 레이어의 내부 플래그(`sessionRestoreInProgress`)를 직접 set/unset하는 것은 레이어 경계 역전임. `AuthProvider`가 API 클라이언트의 내부 동작 방식(인터셉터가 세션 복원 중 리다이렉트를 억제해야 한다는 사실)을 알아야 하는 구조는 강한 결합(tight coupling)을 유발하고, 인터셉터 동작 변경 시 `AuthProvider`도 반드시 수정되어야 하는 암묵적 계약이 생김.
- 제안: `authApi.restoreSession()` 형태로 세션 복원 로직을 API 서비스 레이어에 캡슐화하고, 플래그 관리는 해당 함수 내부에서 처리. `AuthProvider`는 결과(성공/실패)만 수신.

---

**[WARNING]** `doRefresh()`가 `apiClient`를 재귀적으로 호출 — 인터셉터 재진입 위험
- 위치: `client.ts:49-56` — `doRefresh()` 내 `apiClient.post("/auth/refresh", {})`
- 상세: `doRefresh()`는 동일 `apiClient` 인스턴스로 `/auth/refresh`를 호출함. 이 요청도 응답 인터셉터를 거치는데, `/auth/`를 포함한 URL은 `_retry` 조건에서 걸러지나(`!originalRequest.url?.includes("/auth/")`), `doRefresh` 실패 시 오류가 인터셉터 내부 `catch`로 전파되어 `setAccessToken(null)` + 리다이렉트가 발생함. 이 플로우는 `doRefresh` 내부 오류와 외부 인터셉터 오류 처리가 혼재되어 책임 경계가 불명확함.
- 제안: refresh 전용 axios 인스턴스(`refreshClient`)를 분리하거나, `doRefresh`가 던지는 예외를 인터셉터에서 명시적으로 구분 처리.

---

**[INFO]** `refreshPromise` 공유 상태 — 모듈 레벨 가변 전역 변수
- 위치: `client.ts:37` — `let refreshPromise: Promise<string | null> | null = null`
- 상세: `refreshPromise`와 `sessionRestoreInProgress`가 모듈 레벨 가변 변수로 존재함. 단일 SPA 인스턴스에서는 문제없으나, 테스트 격리와 SSR(Next.js server action) 환경에서 모듈 상태가 공유될 경우 예측 불가능한 동작이 발생할 수 있음. 현재 테스트에서 `vi.resetModules()`를 사용하는 이유이기도 함.
- 제안: 상태를 클래스 또는 팩토리 함수로 캡슐화하여 테스트 시 독립적인 인스턴스 생성이 가능하도록 설계. 단기적으로는 `__resetForTesting()` export 함수로 충분.

---

**[INFO]** `RefreshTokenDto`의 선택적 필드와 컨트롤러 검증 책임 분산
- 위치: `backend/src/modules/auth/dto/refresh-token.dto.ts`, `auth.controller.ts:83-88`
- 상세: `refreshToken`이 DTO에서 `@IsOptional()`로 선언되어 있고, 실제 필수 검증은 컨트롤러 레이어에서 수행됨(`if (!token) throw new UnauthorizedException`). DTO의 역할은 입력 유효성 검증이고 컨트롤러는 비즈니스 흐름 제어여야 하는데, 검증 책임이 두 레이어에 분산됨. cookie 우선 → body 폴백이라는 비즈니스 규칙이 컨트롤러에 직접 노출되어 있음.
- 제안: 이 정도 규모에서는 현재 구조가 허용 가능. 단, 비즈니스 규칙(cookie 우선 전략)을 서비스 레이어로 이동시키는 것이 장기적으로 테스트 가능성을 높임.

---

**[INFO]** `setLoading(false)` 호출이 `finally`로 보장되지 않음
- 위치: `auth-provider.tsx:26-56` — `restoreSession()` 함수 구조
- 상세: `setLoading(true)`는 `restoreSession` 진입 시 호출되고 `setSessionRestoreInProgress(false)`는 `finally`에서 처리되나, `setLoading(false)`는 `setAuthenticated()` 또는 `logout()` 내부에 의존함. `setAuthenticated`가 `isLoading`을 리셋하지 않는다면 `catch` 경로에서 `logout()` 호출 후 로딩 상태가 유지될 수 있음. `finally`에서 `setLoading(false)`를 명시적으로 호출하는 것이 더 방어적인 설계임.

---

### 요약

이번 변경은 이전 리뷰에서 지적된 sessionStorage 보안 이슈, 동시 refresh 중복 호출, 이중 리다이렉트 충돌을 모두 올바르게 해결했다. 백엔드 변경(refresh 엔드포인트 조기 검증, cookie path 명시)은 깔끔하고 책임이 명확하다. 그러나 프론트엔드 아키텍처에서는 `client.ts`가 HTTP 인프라 역할을 넘어 세션 상태 관리와 리다이렉트 로직을 동시에 보유하면서 SRP를 위반하고 있으며, 프레젠테이션 레이어(`AuthProvider`)가 API 인프라 내부 플래그를 직접 제어하는 레이어 경계 역전이 남아 있다. 기능은 정상 동작하나, 인증 로직이 복잡해질수록 이 결합 구조가 유지보수 부담으로 누적될 것이므로 `sessionService` 추상화로 세션 복원 로직을 캡슐화하는 중기적 리팩토링을 권장한다.

### 위험도
**MEDIUM**