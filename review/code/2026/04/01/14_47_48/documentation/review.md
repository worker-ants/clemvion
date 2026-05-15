### 발견사항

---

**[INFO]** `setSessionRestoreInProgress` 함수 JSDoc 없음
- 위치: `frontend/src/lib/api/client.ts` — `setSessionRestoreInProgress` 함수
- 상세: 함수명으로 "세션 복원 중임을 알린다"는 의도는 파악 가능하나, 실제로 이 플래그가 401 인터셉터의 `window.location.href` 리다이렉트를 억제한다는 부작용이 문서화되지 않음. `finally`에서 반드시 `false`로 리셋해야 한다는 계약도 불명확함
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

**[INFO]** `doRefresh` 함수 JSDoc 없음
- 위치: `frontend/src/lib/api/client.ts` — `doRefresh` 함수
- 상세: `refreshPromise` 공유 전략의 핵심 함수임에도 목적, HttpOnly 쿠키 의존성, `refreshPromise`와의 관계가 설명되지 않음
- 제안:
  ```ts
  /**
   * Performs a single token refresh via the HttpOnly refresh cookie.
   * Shared through refreshPromise to deduplicate concurrent 401 responses.
   */
  ```

---

**[INFO]** `setAccessToken` / `getAccessToken` JSDoc 없음
- 위치: `frontend/src/lib/api/client.ts` — 두 함수 선언부
- 상세: `setAccessToken(null)` 호출 시 토큰을 초기화한다는 동작이 문서화되지 않음. 이전 리뷰에서 제기된 사항이나 여전히 미반영
- 제안:
  ```ts
  /** Sets the in-memory access token. Pass null to clear (e.g., on logout). */
  export function setAccessToken(token: string | null) { ... }

  /** Returns the current in-memory access token, or null if not set. */
  export function getAccessToken(): string | null { ... }
  ```

---

**[INFO]** `RefreshTokenDto.refreshToken` optional 변경 이유 미문서화
- 위치: `backend/src/modules/auth/dto/refresh-token.dto.ts`
- 상세: `@IsOptional()`이 추가된 이유(HttpOnly 쿠키 우선, body는 폴백)가 DTO 내에 설명되지 않음. 데코레이터 순서도 class-validator 관례(`@IsOptional()` → `@IsString()`)와 역순
- 제안:
  ```ts
  export class RefreshTokenDto {
    /**
     * Optional — the controller prefers the HttpOnly cookie over this field.
     */
    @IsOptional()
    @IsString()
    refreshToken?: string;
  }
  ```

---

**[INFO]** `refresh` 엔드포인트 에러 응답 스펙 미문서화
- 위치: `backend/src/modules/auth/auth.controller.ts` — `refresh()` 핸들러
- 상세: 토큰 미제공 시 `401 TOKEN_INVALID`를 반환하는 신규 동작이 Swagger 데코레이터나 spec 문서 어디에도 명시되지 않음. 또한 `UnauthorizedException`에 객체를 전달하는 방식(`{ code, message }`)이 프로젝트 에러 응답 컨벤션과 일치하는지 불명확
- 제안: `@ApiUnauthorizedResponse({ description: 'No refresh token provided (TOKEN_INVALID)' })` 추가 또는 `spec/` 문서에 에러 코드 명세 보완

---

**[INFO]** `auth-provider.tsx` 인라인 주석 양호
- 위치: `frontend/src/components/auth/auth-provider.tsx:28`
- 상세: `// Restore session via HttpOnly cookie refresh` 주석이 적절히 추가되어 세션 복원 경로의 의도를 명확히 설명함. 이전 리뷰 지적 사항 반영

---

**[INFO]** `client.ts` 중복 refresh 방지 주석 양호
- 위치: `frontend/src/lib/api/client.ts` — response interceptor
- 상세: `// Deduplicate concurrent refresh calls` 주석이 `refreshPromise` 패턴의 의도를 명확히 전달함

---

### 요약

이번 변경은 이전 리뷰에서 지적된 핵심 이슈들(sessionStorage 보안, 동시성, 이중 리다이렉트)을 해결하면서 핵심 흐름에 대한 인라인 주석을 적절히 추가했습니다. 그러나 신규 공개 함수 `setSessionRestoreInProgress`와 내부 핵심 함수 `doRefresh`, 기존 `setAccessToken`/`getAccessToken`에 JSDoc이 여전히 없으며, 백엔드의 `refresh` 엔드포인트 에러 응답 스펙 변경(`TOKEN_INVALID`)이 어디에도 문서화되지 않은 점이 아쉽습니다. `RefreshTokenDto`의 optional 변경 이유도 DTO 내에 설명이 없어 컨텍스트 없이 코드를 보는 개발자에게 혼란을 줄 수 있습니다. README나 CHANGELOG 수준의 업데이트가 필요한 변경은 아니며, 전반적인 문서화 위험도는 낮습니다.

### 위험도

**LOW**