### 발견사항

- **[INFO]** `client.ts` 주석 변경 (`not localStorage` → `not localStorage/sessionStorage`)
  - 위치: `client.ts:15`
  - 상세: 이전 리뷰 사이클에서 sessionStorage가 추가되었다가 제거된 이력을 반영하는 주석 갱신. 현재 설계 결정(메모리 전용)을 더 명확히 기술하므로 의도적이고 적절한 수정.
  - 제안: 없음

- **[INFO]** `doRefresh()` 함수 추출
  - 위치: `client.ts:43-50`
  - 상세: 독립적인 리팩토링처럼 보이지만 `refreshPromise = doRefresh().finally(...)` 패턴 구현을 위해 함수 참조가 반드시 필요. 기능 구현과 불가분한 변경.
  - 제안: 없음

- **[INFO]** 요청 인터셉터 `accessToken` 직접 참조 → `getAccessToken()` 호출
  - 위치: `client.ts:27-30`
  - 상세: `if (accessToken)` → `const token = getAccessToken(); if (token)` 변경. 기능적으로 동일하며 모듈 내 일관성을 높이는 수정. 스코프 이탈 아님.
  - 제안: 없음

- **[WARNING]** RESOLUTION.md — 실제 코드와 불일치하는 조치 기록
  - 위치: `review/2026-04-01_12-44-24/RESOLUTION.md`
  - 상세: RESOLUTION.md에 "WARNING #1: 사용자가 sessionStorage 사용을 요청하였으므로 유지"라고 기록되어 있으나 실제 `client.ts`에는 sessionStorage 코드가 전혀 없음. 또한 "WARNING #6: `isTokenExpired()` 함수 추가"라고 기록되어 있으나 `auth-provider.tsx`에 해당 함수가 존재하지 않음. 코드와 반대 방향의 문서가 작성되어 향후 추적 불가 상태를 만들 수 있음. 코드 자체는 올바르나 문서가 스코프를 벗어남.
  - 제안: RESOLUTION.md의 WARNING #1을 "sessionStorage 제거 — in-memory + HttpOnly cookie refresh 패턴으로 복귀"로, WARNING #6을 "미조치 — sessionStorage 제거로 3회 왕복 경로 자체가 소멸되어 불필요"로 수정.

- **[INFO]** `res.clearCookie('refreshToken', { path: '/' })` 추가
  - 위치: `auth.controller.ts:71`
  - 상세: 주 범위(refresh DTO optional화, 동시성, 리다이렉트 충돌)와 직접 연관은 없으나, 쿠키 설정 시 `path: '/'`를 사용하므로 삭제 시에도 동일 path가 필요한 실제 버그 수정. 인증 흐름 수정 범위에 자연스럽게 포함.
  - 제안: 없음

---

### 요약

변경된 파일 모두 이전 코드 리뷰(2026-04-01_12-44-24)에서 발견된 이슈 해결이라는 단일 목적에 집중되어 있다. `client.ts`의 `refreshPromise` 동시성 처리, `sessionRestoreInProgress` 플래그, `auth-provider.tsx`의 이중 리다이렉트 방지, 백엔드의 조기 토큰 검증은 모두 리뷰 지적 사항에 대한 직접적인 조치다. 불필요한 포맷팅 변경, 관련 없는 파일 수정, 요청하지 않은 기능 추가는 발견되지 않았다. 유일한 스코프 문제는 코드가 아닌 RESOLUTION.md 문서에 있으며, 실제 조치 내용(sessionStorage 제거, isTokenExpired 미구현)과 기록이 상반되게 작성되어 추적 신뢰성을 저하시킨다.

### 위험도
**LOW** — 코드 변경 자체는 스코프 이탈 없음. RESOLUTION.md 문서 허위 기재가 유일한 이슈.