## 리뷰 결과 — Performance

---

### 발견사항

- **[INFO]** `doRefresh()`에서 불필요한 빈 body 직렬화
  - 위치: `client.ts` — `doRefresh()` 함수
  - 상세: `apiClient.post("/auth/refresh", {})` 호출 시 빈 객체를 JSON으로 직렬화하여 전송. `RefreshTokenDto.refreshToken`이 optional로 변경되었으므로 body 없이도 유효하나, 매 refresh 호출마다 `{}` 직렬화 + `Content-Type: application/json` 헤더 처리 오버헤드가 발생.
  - 제안: `apiClient.post("/auth/refresh")` 또는 `apiClient.post("/auth/refresh", undefined)`로 변경하여 불필요한 body 전송 제거. 단, 실질적 영향은 무시 가능한 수준.

- **[INFO]** 요청 인터셉터에서 직접 변수 접근 대신 함수 호출
  - 위치: `client.ts` — request interceptor
  - 상세: 변경 전 `if (accessToken)` 직접 변수 접근에서 `const token = getAccessToken(); if (token)` 함수 호출로 변경됨. 매 API 요청마다 함수 호출 프레임 생성 오버헤드가 추가되나 단순 getter이므로 JIT 최적화로 실질 영향 없음.
  - 제안: 현재 구조 유지. 가독성·일관성 측면에서 함수 호출이 더 적절함.

- **[INFO]** `sessionRestoreInProgress` 플래그 체크가 모든 401 응답에서 실행
  - 위치: `client.ts` — response interceptor catch 블록
  - 상세: `if (typeof window !== "undefined" && !sessionRestoreInProgress)` 조건이 401 실패 응답마다 평가됨. boolean 읽기 연산은 O(1)이므로 실질적 영향 없음. 단, `typeof window` 체크는 `"use client"` 지시어가 있어 hydration 이후 항상 `true`이므로 dead code에 해당함.
  - 제안: `const isBrowser = typeof window !== "undefined"` 모듈 레벨 상수로 한 번만 평가하여 가독성과 일관성 개선. 실질적 성능 차이는 없음.

---

### 긍정적 성능 변화

- **`refreshPromise` 중복 제거**: 동시 401 발생 시 N번의 `/auth/refresh` 요청이 1번으로 감소. `.finally()`로 Promise가 확실히 정리되어 후속 요청도 정상 처리. 토큰 만료 시점에 병렬 API 요청이 많을수록 효과가 클수록 큼.

- **백엔드 fast-fail 추가**: `auth.controller.ts`의 `if (!token)` 조기 반환으로 토큰 없는 refresh 요청이 `authService.refresh()` 호출(DB 조회 포함) 없이 즉시 401 반환. 불필요한 서비스 레이어 진입 제거.

- **세션 복원 경로 단순화**: HttpOnly 쿠키 기반 단일 경로로 `refresh → getMe` 2회 왕복으로 고정. 이전 `sessionStorage` 경로 존재 시 만료 토큰 케이스에서 발생하던 `getMe → 401 → refresh → getMe (retry)` 3회 왕복 문제가 자연스럽게 해소됨.

---

### 요약

이번 변경은 성능 관점에서 명확한 개선 방향이다. `refreshPromise` 도입으로 동시 401 상황의 중복 refresh 요청이 제거되었고, 백엔드 early validation이 불필요한 DB 접근을 막는다. `sessionStorage` 제거로 이전 리뷰에서 지적된 3회 왕복 문제와 `typeof window` 반복 체크 이슈가 모두 해소되었다. 잔여 이슈는 `doRefresh()`의 빈 body 직렬화와 `typeof window` 모듈 레벨 상수화 미적용 정도로, 모두 실질적 영향이 미미한 수준이다.

### 위험도

**LOW**