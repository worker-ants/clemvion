## 리뷰 결과 — Performance

---

### 발견사항

- **[INFO]** `doRefresh()`에서 불필요한 빈 body 직렬화
  - 위치: `client.ts` — `doRefresh()` 함수
  - 상세: `apiClient.post("/auth/refresh", {})` 호출 시 빈 객체를 JSON 직렬화하여 전송. `RefreshTokenDto.refreshToken`이 `@IsOptional()`로 변경되었으므로 body 없이도 유효하나, 매 refresh 호출마다 `{}` 직렬화 + `Content-Type: application/json` 헤더 처리 오버헤드가 발생함. 실질적 영향은 무시 가능.
  - 제안: `apiClient.post("/auth/refresh")` 또는 `apiClient.post("/auth/refresh", undefined)`로 변경.

- **[INFO]** 요청 인터셉터에서 직접 변수 접근 대신 함수 호출
  - 위치: `client.ts` — request interceptor
  - 상세: `if (accessToken)` 직접 변수 접근에서 `const token = getAccessToken(); if (token)` 함수 호출로 변경됨. 매 API 요청마다 함수 호출 프레임 생성 오버헤드가 추가되나 단순 getter이므로 JIT 최적화로 실질 영향 없음.
  - 제안: 현재 구조 유지. 가독성 측면에서 함수 호출이 더 적절함.

- **[INFO]** `typeof window !== "undefined"` 반복 평가
  - 위치: `client.ts` — response interceptor catch 블록
  - 상세: `"use client"` 지시어가 있어 hydration 이후 항상 `window`가 존재하므로 이 체크는 실질적 dead code. 401 실패 응답마다 불필요하게 평가됨.
  - 제안: `const isBrowser = typeof window !== "undefined"` 모듈 레벨 상수로 한 번만 평가. 실질적 성능 차이는 없으나 의미 명확화.

---

### 긍정적 성능 변화

- **`refreshPromise` 중복 제거**: 동시 401 발생 시 N번의 `/auth/refresh` 요청이 1번으로 감소. 토큰 만료 시점에 병렬 API 요청이 많을수록 효과가 큼. (이전 WARNING → 해결)

- **백엔드 fast-fail 추가**: `auth.controller.ts`의 `if (!token) throw new UnauthorizedException` 조기 반환으로 토큰 없는 refresh 요청이 `authService.refresh()` 호출(DB 조회 포함) 없이 즉시 응답.

- **세션 복원 경로 단순화**: `sessionRestoreInProgress` 플래그와 HttpOnly 쿠키 단일 경로로 `refresh → getMe` 2회 왕복 고정. 이전 sessionStorage 경로 존재 시 만료 토큰 케이스에서 발생하던 `getMe → 401 → refresh → getMe (retry)` 3회 왕복 문제 해소.

---

### 요약

이번 변경은 성능 관점에서 명확한 개선 방향이다. `refreshPromise` 도입으로 동시 401 상황의 중복 refresh 요청이 제거되었고, 백엔드 early validation이 불필요한 DB 접근을 차단한다. `sessionRestoreInProgress` 플래그로 세션 복원 경로가 단일화되어 이전 리뷰에서 지적된 3회 왕복 문제가 해소되었다. 잔여 이슈는 `doRefresh()`의 빈 body 직렬화와 `typeof window` 모듈 레벨 상수화 미적용 정도로, 모두 실질적 영향이 미미한 INFO 수준이다.

### 위험도

**LOW**