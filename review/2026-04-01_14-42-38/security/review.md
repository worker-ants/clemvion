### 발견사항

---

**[WARNING] Redirect URL 소비 지점 미검증 — Open Redirect 가능성**
- 위치: `auth-provider.tsx` — `router.replace(\`/login?redirect=${encodeURIComponent(redirect)}\`)`
- 상세: `pathname.startsWith("/")` 조건으로 내부 경로만 허용하려 하지만, `//evil.com` 형태의 프로토콜 상대 URL도 `/`로 시작하므로 이 검증을 통과합니다. `usePathname()`이 Next.js 내부 경로만 반환하므로 생성 지점은 안전하나, `redirect` 파라미터를 소비하는 로그인 페이지에서 `window.location.href = decodedRedirect` 패턴으로 사용할 경우 외부 도메인으로 리다이렉트될 수 있습니다.
- 제안: 로그인 성공 후 redirect 파라미터를 소비하는 지점에서 `URL` 객체로 파싱하여 `origin`이 현재 도메인과 동일한지 검증하거나, `new URL(redirect, window.location.origin).pathname`만 사용하도록 강제하세요.

---

**[WARNING] Refresh Token을 Request Body로 수락 — 로깅/캐싱 노출 위험**
- 위치: `auth.controller.ts:83-84` — `dto.refreshToken`, `refresh-token.dto.ts`
- 상세: Refresh Token이 HttpOnly 쿠키(기본 경로)와 Request Body(`dto.refreshToken`) 두 경로로 모두 수락됩니다. Body로 전송된 토큰은 서버 액세스 로그, 리버스 프록시 캐시, API 게이트웨이 로그에 기록될 가능성이 있어 HttpOnly 쿠키 방식이 제공하는 보안 격리가 무력화됩니다. 현재 `doRefresh()`는 빈 body `{}`를 전송하므로 클라이언트는 쿠키만 사용하지만, Body fallback이 존재하는 한 공격 경로로 활용될 수 있습니다.
- 제안: Body 방식 fallback 제거를 검토하세요. 쿠키가 없는 경우 `UnauthorizedException`을 반환하는 것으로 충분합니다. Body 수락이 필수라면 해당 엔드포인트의 액세스 로그에서 request body 기록을 비활성화하세요.

---

**[INFO] `refreshPromise` 공유로 인한 에러 전파 동작**
- 위치: `client.ts` — `doRefresh()` + `refreshPromise`
- 상세: 동시 401 발생 시 `refreshPromise`를 공유하여 중복 refresh를 방지하는 설계는 올바릅니다. 단, refresh가 실패할 경우 해당 Promise를 대기하던 **모든 요청**이 동일한 에러를 받습니다. `.finally(() => { refreshPromise = null; })`로 초기화되므로 다음 요청은 정상 작동합니다. 보안상 문제는 없으나, 실패 시 모든 대기 요청이 `setAccessToken(null)`을 여러 번 호출하지 않도록 catch 블록이 단일 실행임을 확인하세요.
- 제안: 현재 구현은 `newToken`이 null인 경우 `setAccessToken(null)`을 호출하지 않으므로 정상입니다. catch 블록의 `setAccessToken(null)`이 공유 Promise를 통해 단 한 번만 실행되도록 보장하는 현재 구조를 유지하세요.

---

**[INFO] `sessionRestoreInProgress` 플래그 — 모듈 수준 전역 상태**
- 위치: `client.ts` — `let sessionRestoreInProgress = false`
- 상세: 모듈 수준 변수이므로 동일 탭 내 싱글톤으로 동작합니다. 다중 `AuthProvider` 인스턴스가 동시에 실행되거나 `setSessionRestoreInProgress(true)` 호출 후 예외로 `setSessionRestoreInProgress(false)`가 호출되지 않으면 플래그가 영구적으로 `true`로 남아 인증 실패 시 로그인 페이지로의 리다이렉트가 억제될 수 있습니다.
- 제안: 현재 구현에서는 `finally` 블록에서 `setSessionRestoreInProgress(false)`를 호출하므로 정상적으로 처리됩니다. `AuthProvider`가 단일 인스턴스임을 보장하는 현재 구조(`initAttempted` ref)를 유지하세요.

---

**[INFO] `clearCookie` path 명시 — 보안 개선 확인**
- 위치: `auth.controller.ts:71` — `res.clearCookie('refreshToken', { path: '/' })`
- 상세: 쿠키 설정 시 `path: '/'`를 지정했으므로 삭제 시에도 동일한 `path`를 지정해야 올바르게 삭제됩니다. 이번 변경으로 이 불일치가 수정되었습니다. `setRefreshTokenCookie`에서도 `path: '/'`를 설정하고 있으므로 일관성이 유지됩니다.
- 제안: 현재 구현이 올바릅니다.

---

**[INFO] CSRF 보호 확인 필요**
- 위치: `auth.controller.ts` — `/auth/refresh`, `/auth/logout` (모두 `@Public()`)
- 상세: Refresh 및 Logout 엔드포인트가 HttpOnly 쿠키를 사용합니다. 쿠키 기반 인증은 CSRF 공격에 취약할 수 있습니다. `sameSite: 'lax'`로 설정되어 있어 대부분의 CSRF 벡터는 차단되지만, 같은 사이트에서의 폼 제출은 여전히 허용됩니다.
- 제안: `sameSite: 'lax'`는 현재 위협 모델에서 적절한 수준입니다. Production 환경에서 `secure: true`가 강제되는지 (`process.env.NODE_ENV === 'production'` 조건) 배포 환경을 확인하세요.

---

### 요약

이번 변경은 이전 리뷰에서 지적된 주요 보안 이슈(sessionStorage XSS 노출, 중복 refresh 경쟁 조건, 이중 리다이렉트)를 효과적으로 해결하였습니다. Access Token이 메모리 전용으로 유지되고, `refreshPromise`로 단일 refresh가 보장되며, `sessionRestoreInProgress` 플래그로 리다이렉트 충돌이 방지되는 구조는 보안 원칙에 부합합니다. 잔여 위험은 Refresh Token의 Body fallback 허용과 로그인 페이지에서 `redirect` 파라미터를 소비하는 지점의 Open Redirect 가능성입니다. 후자는 현재 파일 범위 밖에 있으나 반드시 확인이 필요합니다.

### 위험도

**LOW** — 이전 MEDIUM 위험도에서 핵심 이슈들이 해결되어 낮아졌으나, Body fallback 토큰 수락과 redirect 소비 지점 미확인으로 인해 NONE에는 미치지 않습니다.