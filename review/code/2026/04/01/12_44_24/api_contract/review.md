### 발견사항

- **[WARNING]** sessionStorage를 통한 액세스 토큰 영속화 - 보안 회귀
  - 위치: `client.ts` - `setAccessToken`, `getAccessToken`
  - 상세: 기존 코드는 의도적으로 "in-memory only (not localStorage for security)"로 설계되었으나, 변경 후 `sessionStorage`에 저장됨. sessionStorage는 XSS 공격 시 `document.cookie`와 달리 `httpOnly` 보호를 받지 못하므로 토큰 탈취 가능성이 높아짐. 변경 전 코드 주석이 명시적으로 이 설계 결정을 문서화했음.
  - 제안: 페이지 새로고침 시 세션 복원이 필요하다면, cookie-based refresh 토큰 흐름(이미 구현됨)에 의존하는 것이 더 안전. sessionStorage 저장 대신 `auth-provider.tsx`의 fallback refresh 경로를 기본으로 사용하거나, 저장 위치를 명시적으로 보안 위험으로 문서화할 것.

- **[WARNING]** `auth-provider.tsx` - stored token 경로와 refresh 경로 간 토큰 동기화 불일치
  - 위치: `auth-provider.tsx:33` - `setAuthenticated(getAccessToken() ?? storedToken, user)`
  - 상세: `getMe()` 호출 도중 401 인터셉터가 자동 refresh를 수행할 경우 `getAccessToken()`이 새 토큰을 반환하므로 `storedToken`과 달라질 수 있음. 이 경우 `getAccessToken() ?? storedToken` 패턴은 올바르게 새 토큰을 사용하지만, 의도가 불명확하여 유지보수 시 혼란 유발 가능.
  - 제안: `const finalToken = getAccessToken() ?? storedToken;`으로 변수를 명시적으로 분리하여 의도를 명확히 할 것.

- **[INFO]** `auth-provider.tsx` - `getMe()` API 호출 결과에서 `user`가 falsy인 경우 처리 누락
  - 위치: `auth-provider.tsx:33-35`
  - 상세: stored token 경로에서 `user`가 없을 경우 `if (user)` 블록을 건너뛰고 fallback refresh를 수행함. 이 동작은 의도적이지만, `getMe()`가 200 OK를 반환하면서 `data.data`가 null인 경우 조용히 refresh를 재시도하게 되어 디버깅이 어려울 수 있음.
  - 제안: `user`가 없는 경우 명시적 로그를 추가하거나, API 계약상 `getMe()` 성공 시 항상 user 객체를 반환한다고 보장되면 `if (!user) throw new Error(...)` 처리를 추가.

- **[INFO]** 테스트에서 `vi`가 import되지 않음
  - 위치: `client.test.ts:14` - `vi.resetModules()`
  - 상세: `vi`가 `import { describe, it, expect, beforeEach } from "vitest"`에서 명시적으로 import되지 않음. vitest의 globals 설정에 의존하고 있으며, 설정이 변경되면 테스트 실패 가능.
  - 제안: `import { describe, it, expect, beforeEach, vi } from "vitest"`로 명시적 import 추가.

---

### 요약

이번 변경의 핵심은 페이지 새로고침 시 세션 복원을 위해 액세스 토큰을 `sessionStorage`에 저장하는 것인데, 이는 기존 in-memory 전용 설계의 보안 결정을 명시적으로 되돌리는 변경임. 이미 cookie 기반 refresh 토큰 흐름이 구현되어 있어 sessionStorage 없이도 세션 복원이 가능하므로, 보안 트레이드오프 대비 얻는 이점이 제한적임. API 계약 자체(엔드포인트, 요청/응답 구조)는 변경되지 않았으나, 인증 토큰의 저장 방식 변경은 보안 아키텍처에 영향을 주는 사항으로 팀 차원의 명시적 합의가 필요함.

### 위험도
**MEDIUM**