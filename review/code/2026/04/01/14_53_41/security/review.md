### 발견사항

---

**[WARNING] Open Redirect — `redirect` 파라미터 소비 지점 미검증**
- 위치: `auth-provider.tsx` — `router.replace(\`/login?redirect=${encodeURIComponent(redirect)}\`)`
- 상세: `pathname.startsWith("/")` 검증은 `//evil.com`처럼 `/`로 시작하는 프로토콜 상대 URL을 차단하지 못함. `usePathname()`이 Next.js 내부 경로만 반환하므로 **생성 지점은 안전**하나, 로그인 성공 후 이 파라미터를 소비하는 지점(`router.push(redirect)` 또는 `window.location.href = redirect`)에서 별도 검증 없이 사용할 경우 외부 도메인 리다이렉트가 가능함.
- 제안: 소비 지점에서 아래와 같이 처리:
  ```ts
  const safeRedirect = redirect?.startsWith("/") && !redirect.startsWith("//")
    ? redirect : "/dashboard";
  ```

---

**[WARNING] Refresh Token Request Body 수락 — 로그/캐시 노출 위험**
- 위치: `auth.controller.ts:83-84` — `dto.refreshToken`, `refresh-token.dto.ts`
- 상세: Refresh Token이 HttpOnly 쿠키(기본)와 Request Body(`dto.refreshToken`) 두 경로로 모두 수락됨. Body로 전달된 토큰은 서버 액세스 로그, 리버스 프록시, API 게이트웨이 캐시에 기록될 수 있어 HttpOnly 쿠키의 보안 격리가 무력화됨. 현재 `doRefresh()`는 빈 body `{}`를 전송하므로 정상 경로는 안전하나, Body fallback 자체가 공격 경로로 활용 가능.
- 제안: Body fallback 제거 검토. 쿠키가 없으면 즉시 `UnauthorizedException` 반환으로 충분. 유지해야 한다면 해당 엔드포인트의 액세스 로그에서 request body 기록을 비활성화할 것.

---

**[WARNING] `@IsOptional()` / `@IsString()` 데코레이터 순서 오류**
- 위치: `refresh-token.dto.ts:3-5`
- 상세: `@IsString()`이 `@IsOptional()` 위에 선언됨. class-validator 관례상 `@IsOptional()`이 먼저 선언되어야 값이 없을 때 이후 검증자(`@IsString()`)를 올바르게 건너뜀. 라이브러리 버전에 따라 `undefined` 값에 대해 `@IsString()` 검증이 먼저 실행되어 의도치 않은 400 에러가 발생할 수 있음.
- 제안:
  ```ts
  @IsOptional()
  @IsString()
  refreshToken?: string;
  ```

---

**[WARNING] `sessionRestoreInProgress` 플래그가 interceptor의 `doRefresh()` 재진입을 막지 않음**
- 위치: `client.ts:85`, `auth-provider.tsx:33-34`
- 상세: 플래그는 `window.location.href` 리다이렉트만 억제하고, interceptor의 `doRefresh()` 실행 자체는 차단하지 않음. `restoreSession`이 `authApi.refresh()` 성공 후 `usersApi.getMe()` 호출 시 서버가 401을 반환하면, interceptor가 이미 소비된 refresh cookie로 `doRefresh()`를 재시도함. Rotate 방식 refresh token이라면 2차 refresh 실패 → 의도치 않은 로그아웃 발생.
- 제안: interceptor 진입 조건에 `!sessionRestoreInProgress` 추가:
  ```ts
  if (
    error.response?.status === 401 &&
    !originalRequest._retry &&
    !originalRequest.url?.includes("/auth/") &&
    !sessionRestoreInProgress  // 세션 복원 중 auto-refresh 전면 억제
  )
  ```

---

**[WARNING] `refreshPromise` 실패 시 N개 catch 블록 독립 실행**
- 위치: `client.ts` — response interceptor catch block
- 상세: `doRefresh()` 실패 시 `refreshPromise`를 대기하던 N개 요청이 각자 독립적으로 catch 블록에 진입. `setAccessToken(null)`은 멱등적이나, `sessionRestoreInProgress === false`인 상황에서 `window.location.href = "/login"`이 N번 연속 실행됨. 의도한 "중복 제거"와 불일치하는 동작.
- 제안: 실패 처리를 `doRefresh()` 체인으로 통합:
  ```ts
  refreshPromise = doRefresh()
    .catch((e) => {
      setAccessToken(null);
      if (typeof window !== "undefined" && !sessionRestoreInProgress) {
        window.location.href = "/login";
      }
      throw e;
    })
    .finally(() => { refreshPromise = null; });
  ```

---

**[INFO] `UnauthorizedException` 에러 코드 노출 및 응답 구조 불일치**
- 위치: `auth.controller.ts:85-88` — `{ code: 'TOKEN_INVALID', message: '...' }`
- 상세: NestJS `UnauthorizedException`에 객체 전달 시 실제 응답이 `{ statusCode: 401, message: { code: 'TOKEN_INVALID', ... }, error: 'Unauthorized' }` 구조가 됨. `message` 필드가 문자열이 아닌 중첩 객체가 되어 프로젝트 에러 응답 포맷과 불일치 가능. 글로벌 예외 필터 유무에 따라 달라짐.
- 제안: 글로벌 필터가 없다면 `throw new UnauthorizedException('No refresh token provided')`로 단순화.

---

**[INFO] `setSessionRestoreInProgress` — exported 가변 전역 상태**
- 위치: `client.ts:40-42`
- 상세: 모듈 외부에서 `sessionRestoreInProgress` 플래그를 자유롭게 조작 가능. `AuthProvider`가 `finally`에서 반드시 `false`로 리셋하므로 현재 사용은 안전하나, 미래 소비자가 `true`로 설정한 채 방치하면 인증 실패 시 로그인 리다이렉트가 영구 억제되는 보안 우회 경로가 생김.
- 제안: 사용처가 늘어나면 `withSessionRestore(fn)` 래퍼 패턴으로 캡슐화 고려.

---

**[INFO] `clearCookie` path 수정 — 보안 개선 확인 (긍정적)**
- 위치: `auth.controller.ts:71`
- 상세: 이전에는 `path` 미지정으로 로그아웃 후에도 refresh token 쿠키가 브라우저에 잔존하는 보안 버그가 있었음. 이번 수정으로 올바르게 삭제됨. 올바른 수정.

---

**[INFO] CSRF 보호 수준 확인 필요**
- 위치: `auth.controller.ts` — `/auth/refresh`, `/auth/logout`
- 상세: HttpOnly 쿠키 기반 인증은 CSRF에 취약할 수 있음. `sameSite: 'lax'` 설정 시 대부분의 CSRF 벡터가 방어되나, production 환경에서 `secure: true`가 강제되는지 배포 환경에서 반드시 확인 필요.

---

### 요약

이번 변경은 이전 리뷰에서 지적된 핵심 보안 이슈인 **sessionStorage XSS 노출**을 제거하고 in-memory 전용으로 복귀한 것이 가장 큰 보안 개선이다. `clearCookie`에 `path: '/'` 추가로 로그아웃 후 쿠키 잔존 버그도 수정되었다. 잔여 위험은 세 가지로 좁혀진다: (1) Refresh Token의 Request Body fallback이 유지되어 서버 로그를 통한 토큰 노출 경로가 존재하고, (2) `redirect` 파라미터 소비 지점의 Open Redirect 검증이 현재 코드 범위 밖에 있으며, (3) `@IsOptional()` 데코레이터 순서 오류가 class-validator 버전에 따라 예상치 못한 검증 동작을 유발할 수 있다. 또한 `sessionRestoreInProgress` 플래그가 리다이렉트만 억제하고 interceptor의 refresh 재시도는 허용하는 구조는 rotate 방식 refresh token 환경에서 잠재적 세션 손실을 유발할 수 있다.

### 위험도
**LOW** — 이전 MEDIUM에서 sessionStorage XSS 핵심 이슈가 해결되어 낮아졌으나, Body fallback 토큰 수락과 redirect 소비 지점 미확인, decorator 순서 오류로 인해 NONE에는 미치지 않는다.