### 발견사항

---

**[WARNING] sessionStorage에 Access Token 저장**
- 위치: `client.ts` — `setAccessToken`, `getAccessToken`
- 상세: Access Token을 `sessionStorage`에 저장하는 방식은 동일 오리진의 모든 JavaScript 코드에서 접근 가능합니다. XSS 공격 성공 시 토큰 탈취가 가능합니다. 원래 코드의 메모리 전용 저장(`in-memory only`)은 XSS에 대한 방어 수단으로 의도된 것이었으나, 이번 변경으로 그 방어선이 약화되었습니다.
- 제안: sessionStorage 대신 HttpOnly 쿠키 기반 토큰 전달 방식 유지를 권장합니다. 새로고침 후 세션 복원이 필요하다면 `/auth/refresh` 엔드포인트(HttpOnly 쿠키)를 통해 복원하는 기존 fallback 경로가 더 안전합니다. 만약 sessionStorage 사용을 유지한다면, CSP(Content-Security-Policy) 헤더를 강화하여 XSS 위험을 최소화해야 합니다.

---

**[WARNING] Redirect URL 미검증 — Open Redirect 가능성**
- 위치: `auth-provider.tsx` — `router.replace(\`/login?redirect=${encodeURIComponent(redirect)}\`)`
- 상세: `pathname`이 `/`로 시작하는지 확인하는 조건이 있으나, 이를 통해 `redirect` 쿼리 파라미터로 `/`로 시작하는 내부 경로만 허용됩니다. 그러나 이 redirect 파라미터를 로그인 성공 후 실제로 사용하는 쪽(소비 코드)에서 `//evil.com` 형태의 프로토콜 상대 URL이나 기타 우회 패턴을 검증하지 않는다면 Open Redirect로 이어질 수 있습니다. 현재 파일에서는 생성만 하고 소비는 다른 곳에서 이루어지므로, 소비 지점의 검증이 중요합니다.
- 제안: redirect 파라미터 소비 지점에서 `URL` 객체로 파싱하여 `origin`이 동일한지 검증하거나, 단순히 경로(`pathname`)만 허용하는 allowlist 방식으로 처리하세요.

---

**[INFO] `getAccessToken() ?? storedToken` 패턴의 불필요한 복잡성**
- 위치: `auth-provider.tsx` — `setAuthenticated(getAccessToken() ?? storedToken, user)`
- 상세: `getAccessToken()`을 호출했을 때 이미 `storedToken`을 반환했을 것이므로(메모리에 아직 저장 전 상태), 이 표현식은 항상 `storedToken`과 동일하거나 인터셉터에 의해 갱신된 토큰을 반환합니다. 401 인터셉터가 자동으로 `setAccessToken`을 호출하므로 `getAccessToken()`이 갱신된 토큰을 반환할 수 있다는 의도는 이해되지만, 코드 가독성이 낮고 버그 발생 가능성이 있습니다.
- 제안: `usersApi.getMe()` 호출 후 `getAccessToken()`의 반환값을 변수에 저장하고, null 체크를 명시적으로 수행하여 코드의 의도를 명확히 하세요.

---

**[INFO] 테스트 파일에서 `vi` 전역 변수 미import**
- 위치: `client.test.ts` — `vi.resetModules()`
- 상세: `vi`가 `import`되지 않고 전역으로 사용되고 있습니다. Vitest 설정에서 `globals: true`를 사용하는 경우 문제없지만, 명시적 import 없이 전역 의존은 설정 변경 시 테스트 전체가 깨질 수 있습니다.
- 제안: `import { describe, it, expect, beforeEach, vi } from "vitest";`로 명시적으로 import하세요.

---

### 요약

이번 변경의 핵심 보안 관심사는 **Access Token 저장 위치가 메모리(in-memory)에서 sessionStorage로 확장된 것**입니다. 기존 메모리 전용 저장은 XSS 공격 시 스크립트가 토큰에 직접 접근할 수 없다는 장점이 있었으나, sessionStorage는 동일 오리진의 모든 JavaScript에서 접근 가능하여 XSS 취약점이 존재할 경우 토큰 탈취로 직결됩니다. 현재 아키텍처가 HttpOnly 쿠키 기반의 refresh token을 이미 갖추고 있으므로, 새로고침 후 복원은 기존 `/auth/refresh` fallback 경로로도 충분히 처리 가능합니다. sessionStorage 저장의 실질적 이점(약 1회의 API 호출 절감) 대비 보안 risk가 크므로, 재검토를 권장합니다.

### 위험도

**MEDIUM**