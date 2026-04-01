### 발견사항

---

**[INFO]** `setSessionRestoreInProgress` 함수에 JSDoc 없음
- 위치: `client.ts` — `setSessionRestoreInProgress` 함수
- 상세: 함수명으로 의도 파악은 가능하나, 이 플래그가 401 인터셉터의 `window.location.href` 리다이렉트를 억제한다는 핵심 부작용이 문서화되지 않음. `finally`에서 반드시 `false`로 리셋해야 한다는 사용 계약도 불명확함.
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
- 상세: 모듈 내부 함수이나 `refreshPromise` 공유 전략의 핵심 실행 단위임. HttpOnly 쿠키 의존성과 `refreshPromise`와의 관계가 설명되지 않아 함수 선언만 보면 단순 API 호출처럼 보임.
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
- 상세: 이전 리뷰에서도 동일하게 지적된 사항으로 여전히 미반영. `setAccessToken(null)` 전달 시 동작(토큰 초기화)이 문서화되지 않음.
- 제안:
  ```ts
  /** Sets the in-memory access token. Pass null to clear (e.g., on logout). */
  export function setAccessToken(token: string | null) { ... }

  /** Returns the current in-memory access token, or null if not set. */
  export function getAccessToken(): string | null { ... }
  ```

---

**[INFO]** `RefreshTokenDto.refreshToken` optional 변경 이유 미문서화
- 위치: `refresh-token.dto.ts`
- 상세: `@IsOptional()`이 추가된 이유(HttpOnly 쿠키 우선, body는 폴백)가 DTO 내에 전혀 설명되지 않음. 코드만 보면 왜 선택적인지 알 수 없으며, 데코레이터 순서도 class-validator 관례(`@IsOptional()` → `@IsString()`)와 역순이라 혼란을 가중함.
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
- 위치: `auth.controller.ts` — `refresh()` 핸들러
- 상세: 토큰 미제공 시 `401 TOKEN_INVALID`를 반환하는 신규 동작이 Swagger 데코레이터나 spec 문서 어디에도 명시되지 않음. `UnauthorizedException`에 객체를 전달하는 방식(`{ code, message }`)이 프로젝트 에러 응답 컨벤션과 일치하는지도 불명확.
- 제안: `@ApiUnauthorizedResponse({ description: 'No refresh token provided (TOKEN_INVALID)' })` 추가 또는 `spec/` 문서에 에러 코드 명세 보완.

---

**[INFO]** 인라인 주석 추가 — 양호
- 위치: `auth-provider.tsx:28` — `// Restore session via HttpOnly cookie refresh`, `client.ts` — `// Deduplicate concurrent refresh calls`
- 상세: 복잡한 흐름의 의도를 잘 설명하는 주석이 적절히 추가됨. 이전 리뷰 지적 사항 반영.
- 제안: 없음

---

**[INFO]** `client.ts` 주석 갱신 — 양호
- 위치: `client.ts:15` — `not localStorage/sessionStorage`
- 상세: 이전 sessionStorage 도입·제거 이력을 반영하여 현재 설계 결정(메모리 전용)을 더 명확하게 기술. 의도적이고 적절한 수정.
- 제안: 없음

---

### 요약

이번 변경은 인라인 주석(`// Restore session via HttpOnly cookie refresh`, `// Deduplicate concurrent refresh calls`)을 적절히 추가하여 복잡한 흐름의 의도를 설명하고 있으며, 메모리 전용 저장을 명시하는 주석 갱신도 올바르다. 그러나 신규 공개 함수 `setSessionRestoreInProgress`와 내부 핵심 함수 `doRefresh`, 기존 `setAccessToken`/`getAccessToken`에 JSDoc이 없고, `refresh` 엔드포인트의 `TOKEN_INVALID` 에러 코드 변경이 Swagger나 spec 문서에 반영되지 않았으며, `RefreshTokenDto`의 optional 변경 이유도 DTO 내에 설명이 없다. README나 CHANGELOG 수준의 업데이트가 필요한 변경은 아니며, 전반적인 문서화 위험도는 낮다.

### 위험도
**LOW**