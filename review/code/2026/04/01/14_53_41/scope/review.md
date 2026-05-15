### 발견사항

- **[INFO]** 요청 인터셉터 `accessToken` 직접 참조 → `getAccessToken()` 호출
  - 위치: `client.ts` — request interceptor
  - 상세: `if (accessToken)` → `const token = getAccessToken(); if (token)` 변경. 기능적으로 동일하며, `getAccessToken()`이 공개 API임을 고려한 일관성 개선. `refreshPromise` 구현과 직접 연관은 없으나 모듈 내 일관성을 높이는 변경으로 스코프 이탈로 보기 어려움.

- **[INFO]** `client.ts` 주석 갱신
  - 위치: `client.ts:15` — `not localStorage` → `not localStorage/sessionStorage`
  - 상세: 이전 구현에서 sessionStorage가 사용되었다가 제거된 이력을 반영하는 주석 갱신. 현재 설계(메모리 전용)를 더 정확하게 기술하는 의도적 변경.

- **[INFO]** `doRefresh()` 함수 추출
  - 위치: `client.ts:43-50`
  - 상세: 독립적인 리팩토링처럼 보이나 `refreshPromise = doRefresh().finally(...)` 패턴을 위해 함수 참조가 반드시 필요한 변경. 기능 구현과 불가분한 관계.

- **[WARNING]** RESOLUTION.md 조치 내용과 실제 코드 불일치
  - 위치: `review/2026-04-01_12-44-24/RESOLUTION.md`
  - 상세: 두 항목이 실제 코드와 반대 방향으로 기재됨. (1) WARNING #1을 "사용자 요청으로 sessionStorage 유지"라고 기록했으나 `client.ts`에 sessionStorage 코드 없음. (2) WARNING #6을 "`isTokenExpired()` 함수 추가"로 기록했으나 `auth-provider.tsx`에 해당 함수 없음. 코드 이력 추적 신뢰성이 저하됨.
  - 제안: WARNING #1을 "sessionStorage 제거 — in-memory + HttpOnly cookie refresh 패턴으로 복귀"로, WARNING #6을 "미구현 — sessionStorage 제거로 3회 왕복 경로 자체가 소멸되어 불필요"로 수정.

---

### 요약

실제 코드 변경(auth.controller.ts, refresh-token.dto.ts, auth-provider.tsx, client.ts, 테스트 2개)은 이전 코드 리뷰에서 발견된 이슈(동시 refresh 중복 방지, 이중 리다이렉트 억제, DTO optional화, 백엔드 조기 검증) 해결이라는 단일 목적에 집중되어 있다. 인터셉터의 `getAccessToken()` 호출 전환, `doRefresh()` 추출, 주석 갱신은 외형상 리팩토링처럼 보이지만 모두 기능 구현의 필연적 부산물로 스코프 이탈에 해당하지 않는다. 유일한 스코프 문제는 코드가 아닌 RESOLUTION.md 문서로, sessionStorage 유지·`isTokenExpired()` 구현이라는 두 항목이 실제 코드와 상반되게 기재되어 이력 추적성을 저해한다.

### 위험도
**LOW** — 코드 변경 자체는 스코프 이탈 없음. RESOLUTION.md 문서 허위 기재가 유일한 이슈.