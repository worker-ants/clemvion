### 발견사항

- **[INFO]** `res.clearCookie('refreshToken', { path: '/' })` 추가
  - 위치: `auth.controller.ts:70`
  - 상세: 이번 리뷰의 주요 범위(refresh 토큰 optional화, 동시성 처리, 리다이렉트 충돌 방지)와 직접 연관은 없으나, refresh 토큰이 `path: '/'`로 설정되어 있는데 clearCookie에 동일 path가 없으면 쿠키가 삭제되지 않는 실제 버그 수정임. 인증 흐름 수정 범위에 자연스럽게 포함되는 사항.
  - 제안: 없음 (필수 수정으로 판단)

- **[INFO]** `doRefresh()` 함수 추출
  - 위치: `client.ts:42-50`
  - 상세: `refreshPromise` 패턴 구현을 위한 필수 분리. 독립적인 리팩토링처럼 보이지만, Promise를 저장하기 위해서는 함수 참조가 필요하므로 기능 구현과 불가분한 변경임.
  - 제안: 없음 (필수 변경)

- **[INFO]** 요청 인터셉터에서 `accessToken` 직접 참조 → `getAccessToken()` 호출로 변경
  - 위치: `client.ts:27-30`
  - 상세: `if (accessToken)` → `const token = getAccessToken(); if (token)` 변경은 외형상 리팩토링처럼 보이나, `getAccessToken()`이 공개 API이므로 내부 변수를 직접 참조하던 것을 일관성 있게 수정한 것. 기능 변경 없음.
  - 제안: 없음

- **[INFO]** `client.ts` 주석 변경 (`not localStorage` → `not localStorage/sessionStorage`)
  - 위치: `client.ts:15`
  - 상세: sessionStorage가 이전 버전에서 추가되었다가 이번에 제거되었음을 반영하는 주석 갱신. 의미 있는 변경.
  - 제안: 없음

---

### 요약

변경된 7개 파일 모두 이번 코드 리뷰 이슈 해결이라는 단일 목적에 집중되어 있습니다. `auth.controller.ts`의 `clearCookie` path 수정은 주 범위와 약간 결이 다르지만, refresh 쿠키 관리의 실제 버그를 수정하는 것으로 관련 범위 내에 해당합니다. `doRefresh()` 추출과 요청 인터셉터 변경은 `refreshPromise` 구현의 필연적 부산물입니다. 불필요한 포맷팅 변경, 관련 없는 파일 수정, 요청하지 않은 기능 추가는 발견되지 않았습니다.

### 위험도
**NONE**