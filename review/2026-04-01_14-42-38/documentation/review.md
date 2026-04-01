### 발견사항

---

**[INFO]** `setSessionRestoreInProgress` 함수에 JSDoc 없음
- 위치: `client.ts` — `setSessionRestoreInProgress` 함수
- 상세: 왜 이 플래그가 필요한지(인터셉터의 `window.location.href` 리다이렉트 억제 목적), 어디서 호출되어야 하는지 문서화되지 않음. 함수명만으로는 "세션 복원 중임을 알린다"는 의도까지 파악 가능하나, "언제 `false`로 리셋해야 하는가"가 불명확함
- 제안:
  ```ts
  /**
   * Signals whether a session restore is in progress.
   * While true, the 401 response interceptor suppresses its automatic
   * redirect to /login, allowing AuthProvider to handle navigation instead.
   * Must be reset to false in a finally block after session restore completes.
   */
  ```

---

**[INFO]** `doRefresh` 함수에 JSDoc 없음
- 위치: `client.ts` — `doRefresh` 함수
- 상세: 모듈 내부 함수이나 인터셉터의 중복 호출 방지 전략과 연계되는 핵심 함수임. `refreshPromise`와의 관계, HttpOnly 쿠키 의존성이 주석으로 설명되지 않음
- 제안:
  ```ts
  /**
   * Performs a single token refresh via the HttpOnly refresh cookie.
   * Called through the shared refreshPromise to deduplicate concurrent 401 responses.
   */
  ```

---

**[INFO]** `setAccessToken` / `getAccessToken` JSDoc 없음
- 위치: `client.ts` — 두 함수 선언부
- 상세: 이전 리뷰에서 제기된 사항으로, sessionStorage 관련 side effect는 제거되었으나 JSDoc은 여전히 없음. `setAccessToken(null)` 호출 시 동작(토큰 초기화)이 문서화되지 않음
- 제안:
  ```ts
  /** Sets the in-memory access token. Pass null to clear (e.g., on logout). */
  
  /** Returns the current in-memory access token, or null if not set. */
  ```

---

**[INFO]** `auth.controller.ts` 엔드포인트에 Swagger 데코레이터 없음
- 위치: `auth.controller.ts` — 모든 `@Post` 핸들러
- 상세: `@ApiOperation`, `@ApiResponse` 등 NestJS Swagger 데코레이터가 없어 자동 API 문서가 생성되지 않음. 특히 이번 변경으로 `refresh` 엔드포인트가 토큰 없을 시 `401 TOKEN_INVALID`를 반환하게 되었으나 이 응답 스펙이 어디에도 문서화되지 않음
- 제안: `@ApiUnauthorizedResponse({ description: 'No refresh token provided' })` 추가 또는 별도 API 문서에 에러 코드 명세 보완

---

**[INFO]** `RefreshTokenDto`의 optional 변경 이유 미문서화
- 위치: `refresh-token.dto.ts`
- 상세: `refreshToken`이 optional이 된 이유(HttpOnly 쿠키 우선, body는 폴백)가 DTO 내에 설명되지 않음. 이 DTO만 보면 필드가 왜 선택적인지 알 수 없음
- 제안:
  ```ts
  /**
   * Refresh token passed in the request body.
   * Optional — the controller prefers the HttpOnly cookie over this field.
   */
  ```

---

**[INFO]** `setRefreshTokenCookie`의 매직 넘버 미문서화
- 위치: `auth.controller.ts:130-131` — `maxAge` 계산
- 상세: `30 * 24 * 60 * 60 * 1000`(30일)과 `7 * 24 * 60 * 60 * 1000`(7일)이 상수나 주석 없이 인라인으로 사용됨. `rememberMe` 여부에 따른 정책 의도가 불명확
- 제안: 상수 추출 또는 한 줄 주석 추가: `// 30 days for rememberMe, 7 days for session-only`

---

### 요약

이번 변경은 이전 리뷰에서 지적된 sessionStorage 관련 문서화 이슈를 해결하면서 인라인 주석(`// Restore session via HttpOnly cookie refresh`, `// Deduplicate concurrent refresh calls`)을 적절히 추가하여 복잡한 흐름을 설명하고 있습니다. 그러나 `client.ts`의 신규 공개 함수(`setSessionRestoreInProgress`)와 기존 함수(`setAccessToken`, `getAccessToken`)에 JSDoc이 없고, 백엔드 컨트롤러의 API 응답 스펙 변경(401 `TOKEN_INVALID` 추가)이 어디에도 문서화되지 않은 점이 아쉽습니다. README나 CHANGELOG 수준의 업데이트가 필요한 변경은 아니며, 전반적인 문서화 위험도는 낮습니다.

### 위험도

**LOW**