### 발견사항

- **[WARNING]** `getAccessToken()` 재호출의 불필요한 복잡성
  - 위치: `auth-provider.tsx:37` — `setAuthenticated(getAccessToken() ?? storedToken, user)`
  - 상세: `storedToken`이 이미 `getAccessToken()`의 반환값으로 설정되었고, 이후 `usersApi.getMe()` 호출 중 401 인터셉터가 토큰을 갱신할 수 있다는 가정 하에 재호출하는 의도이나, 인터셉터가 `setAccessToken`을 내부적으로 호출하므로 `getAccessToken()`은 항상 최신 값을 반환함. 의도는 맞으나 코드가 명확하지 않아 유지보수 혼란 가능성 있음.
  - 제안: 변수명으로 의도를 명확히 표현 — `const finalToken = getAccessToken() ?? storedToken;`으로 분리 후 사용

- **[WARNING]** `sessionStorage` 보안 취약성 — XSS 노출
  - 위치: `client.ts:22-29`
  - 상세: 주석은 "not localStorage for security"를 제거하고 `sessionStorage`로 이동했으나, `sessionStorage`도 XSS 공격에 동일하게 노출됨. 기존 메모리 저장 방식의 보안 근거(XSS로부터 보호)가 무력화됨. 접근 토큰을 sessionStorage에 저장하는 것은 OWASP 권고사항에 반함.
  - 제안: 보안 요구사항 재검토 필요. 페이지 새로고침 후 복원이 필요하다면 HttpOnly 쿠키를 통한 서버 측 토큰 처리가 적합. 현재 구조(refresh cookie)가 이미 존재하므로, 메모리 저장 + cookie refresh 패턴을 유지하는 것이 더 안전함.

- **[WARNING]** 세션 복원 시 이중 `getMe()` 호출 가능성
  - 위치: `auth-provider.tsx:30-47`
  - 상세: `storedToken`이 존재하고 `getMe()` 호출이 실패하면(네트워크 오류 등), 401 인터셉터가 refresh를 시도한 후 원래 요청을 재시도함. 이 경우 `user`가 정상적으로 반환되어도 `storedToken` 분기에서 처리되어 `catch` 블록으로 넘어가지 않음. 그러나 `getMe()`가 인터셉터 retry 이후에도 실패하면 `catch`로 넘어가 `logout()`이 호출됨 — 이 흐름은 올바름. 단, `storedToken`이 만료되었으나 refresh cookie도 만료된 경우 인터셉터의 `/auth/refresh` 실패 후 `window.location.href = "/login"`이 호출되어 `auth-provider`의 `catch` 블록과 중복 리다이렉트 발생 가능성 있음.
  - 제안: 인터셉터의 리다이렉트와 `auth-provider`의 `router.replace` 간 충돌 방지 로직 추가 또는 인터셉터에서 세션 복원 중임을 알리는 플래그 사용.

- **[INFO]** 테스트에서 `vi` 미임포트
  - 위치: `client.test.ts:11` — `vi.resetModules()`
  - 상세: `vi`가 `import { describe, it, expect, beforeEach } from "vitest"`에 포함되지 않음. Vitest의 globals 설정이 활성화되어 있다면 동작하지만, 명시적 임포트가 없어 환경 의존성이 생김.
  - 제안: `import { describe, it, expect, beforeEach, vi } from "vitest";`로 명시적 임포트 추가.

- **[INFO]** 토큰 키 상수(`TOKEN_KEY`)의 중복 참조 위험
  - 위치: `client.ts:17` vs `client.test.ts:20` — `sessionStorage.getItem("accessToken")`
  - 상세: 테스트에서 토큰 키 문자열 `"accessToken"`을 하드코딩하여 `TOKEN_KEY` 상수 변경 시 테스트가 깨질 수 있음.
  - 제안: `TOKEN_KEY`를 export하거나 테스트에서 상수를 공유하여 DRY 원칙 적용.

---

### 요약

이번 변경은 페이지 새로고침 후 세션 복원 문제를 해결하기 위해 `sessionStorage`를 도입한 것으로, 기능적 의도는 명확하고 구현 흐름도 전반적으로 올바름. 그러나 원래 메모리 저장 방식이 채택된 핵심 이유(XSS 보안)를 훼손하며, refresh cookie 기반 아키텍처가 이미 존재하는 상황에서 sessionStorage 도입의 실질적 이점 대비 보안 비용이 높음. 또한 401 인터셉터와 auth-provider 간의 이중 리다이렉트 충돌 가능성과 테스트의 `vi` 미임포트 이슈는 수정이 필요함.

---

### 위험도

**MEDIUM** — 기능은 동작하나 보안 설계 원칙 위반 및 엣지 케이스 충돌 가능성 존재.