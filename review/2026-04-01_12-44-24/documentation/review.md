### 발견사항

- **[INFO]** `getAccessToken()` 함수에 JSDoc 없음
  - 위치: `client.ts` — `getAccessToken` 함수
  - 상세: `sessionStorage` 폴백 동작이 추가되어 함수의 역할이 단순 반환에서 lazy 초기화로 변경되었지만, 문서가 없음
  - 제안:
    ```ts
    /**
     * Returns the current access token.
     * Falls back to sessionStorage if the in-memory token is null
     * (e.g., after a page refresh). Populates the in-memory cache on first call.
     */
    ```

- **[INFO]** `setAccessToken()` 함수에 JSDoc 없음
  - 위치: `client.ts` — `setAccessToken` 함수
  - 상세: `null` 전달 시 sessionStorage에서 항목을 제거하는 side effect가 있으나 문서화되지 않음
  - 제안:
    ```ts
    /**
     * Sets the access token in memory and sessionStorage.
     * Pass `null` to clear both (e.g., on logout).
     */
    ```

- **[INFO]** `auth-provider.tsx` 내 주석의 조건 설명 불완전
  - 위치: `auth-provider.tsx:35`
  - 상세: `// (if expired, the 401 interceptor will auto-refresh via cookie)` 주석이 "왜 `getAccessToken() ?? storedToken`을 사용하는가"를 설명하지 않음 — 인터셉터가 refresh 성공 후 `setAccessToken`을 호출하므로 최신 토큰을 재조회하는 이유를 명시하면 좋음
  - 제안: `// interceptor may have silently refreshed the token; re-read to get the latest value`

- **[INFO]** `TOKEN_KEY` 상수 문서화 없음
  - 위치: `client.ts:18`
  - 상세: 이 키가 sessionStorage에서 사용하는 키임을 명시하는 한 줄 주석이 없음. 테스트에서도 문자열 리터럴 `"accessToken"`을 직접 사용하고 있어 상수가 export되지 않는 문제와 함께 혼란을 줄 수 있음
  - 제안: `TOKEN_KEY`를 export하거나, 테스트에서 하드코딩 대신 동일 상수를 참조하도록 안내하는 주석 추가

- **[INFO]** 테스트 파일에 `vi` 전역 사용 — import 누락
  - 위치: `client.test.ts:11, 30`
  - 상세: `vi.resetModules()`를 사용하지만 `vi`를 import하지 않음 (vitest globals 설정에 의존). 문서화 관점에서 명시적 import가 없으면 설정 의존성이 불분명함
  - 제안: `import { describe, it, expect, beforeEach, vi } from "vitest";`

---

### 요약

이번 변경은 sessionStorage 기반 토큰 영속성 추가라는 의미있는 보안/UX 트레이드오프를 포함하고 있으나, 공개 API(`getAccessToken`, `setAccessToken`)에 JSDoc이 전혀 없어 동작의 side effect와 fallback 메커니즘이 코드를 처음 보는 개발자에게 불분명합니다. 인라인 주석은 적절하게 작성되어 있으며 README나 API 문서 수준의 업데이트가 필요한 변경은 아닙니다. 전반적으로 문서화 리스크는 낮으며, JSDoc 추가와 `vi` 명시적 import 수준의 개선이면 충분합니다.

### 위험도
LOW