### 발견사항

---

**[WARNING] Open Redirect — `redirect` 파라미터 소비 지점 미검증**
- 위치: `auth-provider.tsx` — `router.replace(\`/login?redirect=${encodeURIComponent(redirect)}\`)`
- 상세: `pathname.startsWith("/")` 조건이 있지만 `//evil.com`은 `/`로 시작하므로 이 검증을 통과합니다. `usePathname()`이 Next.js 내부 경로만 반환하므로 **생성 지점은 안전**하나, 로그인 성공 후 이 파라미터를 `window.location.href = decodedRedirect` 혹은 `router.push(decodedRedirect)` 형태로 소비하는 지점이 별도 검증 없이 사용할 경우 외부 도메인으로 리다이렉트됩니다.
- 제안: 로그인 성공 후 redirect 소비 지점에서 반드시 `new URL(redirect, window.location.origin).pathname`만 사용하거나, `/`로 시작하고 `//`로 시작하지 않는지 명시적으로 확인하세요:
  ```ts
  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//")
    ? redirect : "/dashboard";
  ```

---

**[WARNING] Refresh Token Request Body 수락 — 로그/캐시 노출 위험**
- 위치: `auth.controller.ts:83-84` — `dto.refreshToken`, `refresh-token.dto.ts`
- 상세: Refresh Token이 HttpOnly 쿠키(기본)와 Request Body(`dto.refreshToken`) 두 경로로 모두 수락됩니다. Body로 전달된 토큰은 서버 액세스 로그, 리버스 프록시 로그, API 게이트웨이 캐시에 기록될 수 있어 HttpOnly 쿠키가 제공하는 보안 격리가 무력화됩니다. `doRefresh()`는 현재 빈 body `{}`를 전송하므로 정상 경로는 안전하지만, Body fallback 자체가 공격 경로로 활용될 수 있습니다.
- 제안: Body fallback 제거를 검토하세요. 쿠키가 없으면 `UnauthorizedException`을 반환하는 것으로 충분합니다. Body 수락이 반드시 필요하다면 해당 엔드포인트의 액세스 로그에서 request body 기록을 비활성화하세요.

---

**[WARNING] `@IsOptional()` / `@IsString()` 데코레이터 순서**
- 위치: `refresh-token.dto.ts:3-5`
- 상세: class-validator 관례상 `@IsOptional()`은 값이 없을 때 이후 검증자를 건너뛰는 역할을 하므로, `@IsString()` **위**에 선언되어야 합니다. 현재는 `@IsString()` → `@IsOptional()` 순서로, 라이브러리 버전에 따라 `undefined` 값에 대해 `@IsString()` 검증이 먼저 실행되어 예상치 못한 400 에러가 발생할 수 있습니다.
- 제안:
  ```ts
  @IsOptional()
  @IsString()
  refreshToken?: string;
  ```

---

**[INFO] `UnauthorizedException` 내부 에러 코드 노출**
- 위치: `auth.controller.ts:85-88` — `{ code: 'TOKEN_INVALID', message: '...' }`
- 상세: NestJS `UnauthorizedException`에 객체를 전달하면 `{ statusCode: 401, message: { code: 'TOKEN_INVALID', ... }, error: 'Unauthorized' }` 구조로 응답됩니다. `TOKEN_INVALID` 에러 코드가 외부에 노출되면 공격자가 엔드포인트 상태를 열거할 수 있으며, 현재 프로젝트 에러 응답 형식(`{ data: {...} }` 래퍼)과 불일치할 수 있습니다. 글로벌 예외 필터 유무를 확인하세요.
- 제안: 글로벌 필터가 없다면 `throw new UnauthorizedException('No refresh token provided')` 단순화를 고려하거나, 프로젝트 에러 컨벤션에 맞게 필터에서 일관 처리하세요.

---

**[INFO] `sessionRestoreInProgress` 플래그 — 인터셉터 리다이렉트 영구 억제 가능성**
- 위치: `client.ts` — `let sessionRestoreInProgress = false`
- 상세: `finally` 블록에서 `false`로 리셋되므로 현재 구현은 안전합니다. 그러나 이 모듈 레벨 플래그가 `export`되어 있어 미래에 다른 소비자가 `true`로 설정한 채 방치하면 인증 실패 시 로그인 페이지 리다이렉트가 영구 억제되는 보안 우회 경로가 생깁니다.
- 제안: 현재 사용은 안전합니다. 향후 사용처가 늘어날 경우 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화하여 `true` 상태 고착을 방지하세요.

---

**[INFO] `clearCookie` path 수정 — 보안 개선 확인**
- 위치: `auth.controller.ts:71` — `res.clearCookie('refreshToken', { path: '/' })`
- 상세: 쿠키 설정 시 `path: '/'`를 사용하므로 삭제 시에도 동일한 `path`를 지정해야 실제 삭제됩니다. 이번 변경 이전에는 path 불일치로 인해 로그아웃 후에도 refresh token 쿠키가 브라우저에 잔존하는 보안 버그가 있었습니다. 올바른 수정입니다.

---

**[INFO] CSRF 보호 수준 확인**
- 위치: `auth.controller.ts` — `/auth/refresh`, `/auth/logout`
- 상세: HttpOnly 쿠키 기반 인증은 CSRF에 취약할 수 있습니다. `sameSite: 'lax'`로 설정 시 top-level navigation 이외의 cross-site 요청은 차단되어 대부분의 CSRF 벡터가 방어됩니다. 단, production 환경에서 `secure: true`가 강제되는지(`process.env.NODE_ENV === 'production'`) 배포 환경에서 반드시 확인하세요.

---

### 요약

이번 변경은 이전 리뷰에서 지적된 핵심 보안 이슈(sessionStorage XSS 노출, 동시 refresh 경쟁 조건, 이중 리다이렉트 충돌)를 효과적으로 해결하였으며, Access Token이 메모리 전용으로 유지되고 `refreshPromise`로 단일 refresh가 보장되는 구조는 보안 원칙에 부합합니다. 잔여 위험은 크게 세 가지입니다: (1) Refresh Token의 Body fallback이 유지되어 서버 로그 노출 경로가 존재하고, (2) `redirect` 파라미터 소비 지점(로그인 페이지)의 Open Redirect 검증이 현재 코드 범위 밖에 있으며, (3) `@IsOptional()` 데코레이터 순서 오류가 class-validator 버전에 따라 예상치 못한 검증 동작을 유발할 수 있습니다.

### 위험도

**LOW** — 이전 MEDIUM에서 핵심 보안 이슈들이 해결되어 낮아졌으나, Body fallback 토큰 수락과 redirect 소비 지점 미검증으로 인해 NONE에는 미치지 않습니다.