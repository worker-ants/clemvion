### 발견사항

- **[INFO]** `restoreSession` 함수의 중복 코드 패턴
  - 위치: `auth-provider.tsx` L34-48
  - 상세: `usersApi.getMe()` 호출과 `user` 데이터 추출이 stored token 경로와 cookie refresh 경로 두 곳에 중복됨
  - 제안: `getMe()` 호출을 공통 헬퍼로 추출하거나, 두 경로를 통합하여 하나의 흐름으로 처리

- **[INFO]** `getAccessToken() ?? storedToken` 의도가 불명확
  - 위치: `auth-provider.tsx` L37
  - 상세: 401 인터셉터가 토큰을 갱신했을 가능성을 처리하는 의도인데, 주석이 있어도 `getAccessToken() ?? storedToken` 패턴이 처음 보는 사람에게는 직관적이지 않음. `storedToken`이 이미 `getAccessToken()`의 결과이기 때문에 둘 중 하나가 다른 값일 경우의 조건이 암묵적
  - 제안: `const finalToken = getAccessToken() ?? storedToken;` 변수를 미리 명명하고 주석에 "may have been updated by 401 interceptor" 문구를 명시

- **[INFO]** `TOKEN_KEY` 상수가 테스트에서 하드코딩됨
  - 위치: `client.test.ts` L15, L16, L25
  - 상세: `sessionStorage.getItem("accessToken")` 처럼 테스트에서 키 이름을 직접 문자열로 반복 사용. `TOKEN_KEY`가 export 되지 않아 테스트와 구현 간 결합도가 암묵적으로 생김
  - 제안: `TOKEN_KEY`를 `export const`로 노출하여 테스트에서 import해서 사용하거나, 현재처럼 블랙박스 테스트 관점을 유지한다면 허용 가능

- **[INFO]** `restoreSession`이 하나의 함수에서 너무 많은 역할 수행
  - 위치: `auth-provider.tsx` L26-60
  - 상세: 토큰 확인, 유저 프로필 조회, 인증 상태 설정, 리프레시 폴백, 에러 시 리다이렉트까지 약 35줄에 6가지 책임이 집중됨. 분기 로직이 추가될수록 복잡도 상승 위험 존재
  - 제안: `tryRestoreFromToken()`, `tryRestoreFromCookie()` 등 의도를 명확히 드러내는 함수로 분리 고려. 현재 규모에서는 허용 가능하나 추가 분기 시 반드시 분리 필요

- **[INFO]** `vi` 전역 사용 (미 import)
  - 위치: `client.test.ts` L12, L30
  - 상세: `vi.resetModules()`가 import 없이 전역으로 사용됨. vitest의 globals 설정에 의존하는 구조로, 설정 변경 시 묵시적으로 깨질 수 있음
  - 제안: `import { vi } from "vitest"` 명시적으로 추가하여 의존성을 선언적으로 관리

---

### 요약

전반적으로 코드 가독성은 양호하며 주석도 충분히 작성되어 있습니다. `sessionStorage` 기반 토큰 퍼시스턴스 추가는 명확한 목적을 가지고 일관되게 구현되었습니다. 다만 `restoreSession` 함수 내 `usersApi.getMe()` 중복 호출과 책임 집중은 기능 추가 시 유지보수 부담이 될 수 있으며, `TOKEN_KEY`의 미노출과 테스트 내 `vi` 미import는 소규모이지만 일관성 차원에서 개선 여지가 있습니다. 현재 규모에서 즉각적인 위험은 없으나, 인증 흐름이 복잡해지기 전에 `restoreSession`을 분리하는 것을 권장합니다.

### 위험도

LOW