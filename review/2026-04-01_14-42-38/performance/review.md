## 리뷰 결과 — Performance

---

### 발견사항

- **[INFO]** `doRefresh()`에서 불필요한 빈 body 직렬화
  - 위치: `client.ts` — `doRefresh()` 함수
  - 상세: `apiClient.post("/auth/refresh", {})` 호출 시 빈 객체를 body로 직렬화하여 전송. `RefreshTokenDto.refreshToken`이 optional로 변경되었으므로 body 없이도 동작하나, 매 refresh 호출마다 `{}` 직렬화 + Content-Type 헤더 처리 오버헤드가 발생함. 실질적 영향은 무시 가능한 수준.
  - 제안: `apiClient.post("/auth/refresh")` 또는 `apiClient.post("/auth/refresh", undefined)`로 변경하여 불필요한 body 전송 제거.

- **[INFO]** 요청 인터셉터에서 직접 변수 접근 대신 함수 호출
  - 위치: `client.ts` — request interceptor
  - 상세: 변경 전 `if (accessToken)` 직접 변수 접근에서 `const token = getAccessToken(); if (token)` 함수 호출로 변경됨. 매 API 요청마다 함수 호출 오버헤드가 추가되나 단순 getter이므로 JIT 최적화로 실질 영향 없음.
  - 제안: 현재 구조 유지. 가독성·일관성 측면에서 함수 호출이 더 적절함.

---

### 긍정적 성능 변화

- **`refreshPromise` 중복 제거**: 동시 401 발생 시 N번의 refresh 요청이 1번으로 감소. 토큰 만료 시점에 병렬 요청이 많을수록 효과가 큼. (WARNING → 해결)

- **백엔드 fast-fail 추가**: `auth.controller.ts`의 `if (!token)` 조기 반환으로 토큰 없는 refresh 요청 시 `authService.refresh()` 호출(DB 조회) 없이 즉시 응답. 불필요한 서비스 레이어 진입 제거.

- **세션 복원 경로 단순화**: 이전 sessionStorage 경로 제거로 `restoreSession`이 항상 `refresh → getMe` 2회 왕복으로 고정. 이전 코드의 만료 토큰 경로(3회 왕복) 문제가 자연스럽게 해소됨.

---

### 요약

이번 변경은 성능 관점에서 전반적으로 개선된 방향이다. `refreshPromise` 도입으로 동시 401 상황에서의 중복 refresh 요청이 제거되었고, 백엔드의 early validation이 불필요한 서비스 레이어 진입을 막는다. sessionStorage 제거로 인해 이전 리뷰에서 지적된 3회 왕복 문제와 매 요청마다 `typeof window` 체크 문제가 모두 해소되었다. 남은 이슈는 `doRefresh()`의 빈 body 직렬화 정도로 실질적 영향은 없다.

### 위험도

**LOW**