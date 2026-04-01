### 발견사항

---

**[WARNING]** RESOLUTION.md — WARNING #6 조치 내용과 실제 코드 불일치
- **위치**: `review/2026-04-01_12-44-24/RESOLUTION.md` — "WARNING #6 성능 조치: `isTokenExpired()` 함수 추가"
- **상세**: RESOLUTION.md는 JWT `exp` 클레임 기반 `isTokenExpired()` 함수를 추가하여 불필요한 `getMe()` 왕복을 제거했다고 기록하고 있으나, 실제 `auth-provider.tsx`에는 해당 함수가 존재하지 않는다. 코드에는 단순히 `authApi.refresh()` → `usersApi.getMe()` 2회 경로만 있다. 조치 문서와 실제 구현이 불일치한다.
- **제안**: RESOLUTION.md에서 WARNING #6 항목을 "미조치" 또는 "불필요 — 현재 흐름은 2회 왕복으로 기존 대비 동일 수준"으로 수정하거나, 실제 `isTokenExpired()` 구현을 추가할 것.

---

**[WARNING]** RESOLUTION.md — WARNING #1 조치 내용과 실제 코드 불일치
- **위치**: `review/2026-04-01_12-44-24/RESOLUTION.md` — "WARNING #1: 사용자가 명시적으로 sessionStorage 사용을 요청한 기능이므로 유지"
- **상세**: RESOLUTION.md는 sessionStorage를 유지했다고 기록하지만, 실제 `client.ts`에는 sessionStorage 관련 코드가 전혀 없다. 현재 구현은 순수 in-memory 저장 방식이다. RESOLUTION.md의 조치 기록이 실제 코드와 반대 방향으로 기술되어 있어 추적 불가 상태다.
- **제안**: RESOLUTION.md의 WARNING #1 항목을 "sessionStorage 제거 — in-memory + HttpOnly cookie refresh 패턴으로 복귀"로 수정할 것.

---

**[WARNING]** `auth-provider.tsx` — `finally` 블록에서 `setLoading(false)` 미호출
- **위치**: `auth-provider.tsx` `restoreSession` 함수 finally 블록
- **상세**: `setLoading(true)`로 시작하지만 `finally` 블록에서 `setSessionRestoreInProgress(false)`만 호출하고 `setLoading(false)`를 호출하지 않는다. 로딩 상태 해제는 `setAuthenticated()`와 `logout()` 내부 구현에 암묵적으로 의존한다. 만약 이들 함수가 `isLoading`을 리셋하지 않으면 로딩 스피너가 무기한 표시된다.
- **제안**: `finally { setSessionRestoreInProgress(false); setLoading(false); }`로 명시적 처리하거나, `setAuthenticated`/`logout` 스토어 액션에서 반드시 `isLoading: false`를 설정함을 주석으로 보장할 것.

---

**[INFO]** `RefreshTokenDto` — `@IsString()`과 `@IsOptional()` 순서
- **위치**: `backend/src/modules/auth/dto/refresh-token.dto.ts`
- **상세**: `@IsString()`이 `@IsOptional()` 위에 선언되어 있다. class-validator에서 `@IsOptional()`은 값이 없을 때 다른 검증자를 건너뛰도록 하는데, 선언 순서가 역순이면 라이브러리 버전에 따라 검증 동작이 의도와 달라질 수 있다.
- **제안**: `@IsOptional()` → `@IsString()` 순서로 변경하는 것이 class-validator 관례에 부합한다.

---

**[INFO]** `auth-provider.tsx` — `logout()` catch 경로에서 이미 `/login`인 경우 리다이렉트 미실행
- **위치**: `auth-provider.tsx` catch 블록 — `if (!pathname.startsWith("/login"))`
- **상세**: 이미 `/login` 페이지에 있을 때 refresh 실패 시 리다이렉트를 건너뛰는 것은 의도적 처리다. 그러나 `/login` 외의 공개 경로(예: `/register`, `/forgot-password`)에서 실패 시에도 리다이렉트가 발생하여 불필요한 UX 혼란이 생길 수 있다.
- **제안**: 공개 경로 목록을 배열로 관리하거나, `@Public()` 경로 패턴을 프론트엔드에서도 일관되게 적용할 것.

---

**[INFO]** `auth.controller.ts` — `UnauthorizedException` 에러 코드와 스펙 정합성 확인 필요
- **위치**: `auth.controller.ts:88` — `code: 'TOKEN_INVALID'`
- **상세**: refresh 엔드포인트에서 토큰 미제공 시 `TOKEN_INVALID` 코드를 반환하도록 추가되었다. 프론트엔드 `client.ts`의 인터셉터는 401 응답을 받으면 refresh를 재시도하는데, refresh 엔드포인트 자체가 401을 반환하면 `/auth/` URL 포함 조건(`!originalRequest.url?.includes("/auth/")`)으로 인해 재시도를 건너뛰므로 무한 루프는 없다. 동작은 올바르나, 스펙 문서에 이 에러 코드가 정의되어 있는지 확인이 필요하다.
- **제안**: `spec/` 문서에 `TOKEN_INVALID` 에러 코드가 명시되어 있는지 검토할 것.

---

### 요약

이번 변경의 핵심 기능 구현 — sessionStorage 제거로 인한 보안 강화, 동시 refresh 중복 호출 방지(`refreshPromise`), 이중 리다이렉트 억제(`sessionRestoreInProgress`) — 은 모두 올바르게 구현되어 있다. 그러나 RESOLUTION.md가 실제 코드와 두 가지 중요한 측면에서 불일치한다: sessionStorage를 "유지"했다고 기록했지만 실제로는 제거했고, `isTokenExpired()` 구현을 "추가"했다고 기록했지만 실제로는 코드에 없다. 이는 코드 리뷰 이력의 신뢰성을 저하시키며, 추후 작업 시 오판의 원인이 될 수 있다. 또한 `setLoading(false)`가 `finally` 블록에 없어 로딩 상태 관리가 스토어 구현에 암묵적으로 의존하는 점은 잠재적 UX 버그로 이어질 수 있다.

### 위험도

**LOW** — 기능 동작은 올바르나, RESOLUTION.md 허위 기재와 `setLoading` 암묵적 의존이 문제.