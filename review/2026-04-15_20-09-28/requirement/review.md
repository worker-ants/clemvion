## 발견사항

### [CRITICAL] 프론트엔드 `/callback` 페이지 미구현
- **위치**: 전체 diff
- **상세**: 스펙 §5.3은 `{frontend_url}/callback?success=true&token={accessToken}` 리다이렉트를 정의하며 §5.4에서 `/callback` 페이지가 `setAccessToken(token)` → URL 정리 → `/dashboard` 리다이렉트를 수행해야 한다고 명시. 그러나 `frontend/src/app/callback/` 또는 `frontend/src/app/(auth)/callback/` 페이지가 이번 diff에 없음. 백엔드는 완성됐으나 OAuth 플로우의 최종 단계가 없어 사용자가 토큰 파라미터를 가진 빈 페이지에 머뭄.
- **제안**: `frontend/src/app/callback/page.tsx` 생성 — `useSearchParams`로 `token`/`error` 파싱, `setAccessToken()` + 프로필 조회 + `/dashboard` 리다이렉트 구현

---

### [CRITICAL] `resolveUser` 내 트랜잭션 원자성 깨짐
- **위치**: `auth-oauth.service.ts` → `resolveUser` 메서드
- **상세**: 신규 사용자 생성 시 `usersService.create()`는 주입된 `Repository<User>`를 직접 사용하고, `manager`는 `createPersonalWorkspace`에만 전달됨. `createPersonalWorkspace` 실패 시 user 행은 남고 워크스페이스는 미생성 → 고아 사용자 발생. 이메일 회원가입의 `verifyEmail`은 동일 패턴에서 `manager.getRepository(User)`를 사용해 올바르게 처리하고 있음.
- **제안**: `usersService.create`가 `EntityManager`를 선택적으로 받도록 오버로드하거나, `resolveUser` 내부에서 직접 `manager.getRepository(User).save(...)` 사용

---

### [WARNING] Stub 모드에서 `CLIENT_ID` 환경변수 필수 요구 — 개발환경 불일치
- **위치**: `auth-oauth.service.ts:beginAuth`
- **상세**: `beginAuth`는 stub 모드 여부와 무관하게 `requireEnv('GOOGLE_CLIENT_ID')`를 호출. `example.env`에서 `GOOGLE_CLIENT_ID=` (빈 값)인 상태로 stub mode로 실행하면 `beginAuth`에서 `InternalServerErrorException` 발생. `exchangeCodeForToken`/`fetchProfile`은 stub 분기로 credentials 없이도 동작하는데 `beginAuth`만 예외.
- **제안**: stub 모드에서는 client_id에 placeholder('stub-client') 사용하거나, `requireEnv` 대신 `process.env[key] ?? 'stub-client'` 패턴 적용

---

### [WARNING] 스펙 §7.1 라우트 가드와 콜백 경로 불일치
- **위치**: `spec/2-navigation/10-auth-flow.md` §7.1
- **상세**: 스펙의 에러/성공 리다이렉트는 `/callback`으로 업데이트됐으나, 라우트 가드 테이블은 여전히 `/auth/callback`을 비인증 허용으로 표기. 현재 가드 규칙("그 외 모든 라우트 → 인증 필요")이 `/callback`에 적용되면 OAuth 콜백 처리 전에 `/login`으로 튕겨나가 OAuth 플로우 전체가 깨짐.
- **제안**: 스펙 §7.1 라우트 가드 테이블 업데이트 + 프론트엔드 미들웨어에서 `/callback` 경로를 명시적으로 공개 경로로 등록

---

### [WARNING] 프론트엔드 기본 포트 불일치 (3001 vs 3011)
- **위치**: `login-form.tsx:34`, `register-form.tsx:37`
- **상세**: `API_BASE_URL` fallback이 `http://localhost:3001/api`이나, `example.env`의 `APP_PORT=3011`. `NEXT_PUBLIC_API_URL` 환경변수 미설정 시 OAuth 시작 요청이 틀린 포트로 전송됨.
- **제안**: fallback 값을 `http://localhost:3011/api`로 수정하거나, `frontend/.env` 파일에 `NEXT_PUBLIC_API_URL=http://localhost:3011/api` 기본값 문서화

---

### [WARNING] 컨트롤러 테스트에 OAuth 엔드포인트 커버리지 없음
- **위치**: `auth.controller.spec.ts`
- **상세**: `beginOauth`와 `oauthCallback` 두 엔드포인트가 추가됐으나 컨트롤러 spec에는 테스트 없음. 특히 `oauthCallback`의 에러 분기(`providerError` 있을 때, `code`/`state` 없을 때, `mapOauthError` 각 케이스)가 검증되지 않음. `auth-oauth.service.spec.ts`가 서비스 레이어를 커버하지만 컨트롤러의 리다이렉트 로직은 별도 테스트 필요.
- **제안**: `beginOauth` (정상 리다이렉트), `oauthCallback` (성공/providerError/code 없음/서비스 예외) 케이스 추가

---

### [INFO] Access Token URL 파라미터 노출 (스펙 승인된 패턴)
- **위치**: `auth.controller.ts:oauthCallback`, `spec §5.3`
- **상세**: 스펙이 명시적으로 이 패턴을 정의하고 "클라이언트가 즉시 메모리에 저장 후 URL 정리"를 요구함. 브라우저 히스토리/서버 로그에 토큰이 남을 수 있는 보안 trade-off가 존재하나 스펙 결정사항.
- **제안**: `/callback` 페이지 구현 시 `router.replace('/dashboard')` 또는 `window.history.replaceState` 사용하여 URL에서 즉시 토큰 제거 필수

---

### [INFO] `auth.service.ts` 내 DEBUG console.log 잔류
- **위치**: `auth.service.ts` (diff 외, 기존 코드)
- **상세**: `console.log('[DEBUG refresh]', ...)` 주석 "DEBUG: Remove after verifying refresh works"가 존재. 이번 diff 범위 외이지만 프로덕션 배포 전 제거 필요.

---

## 요약

OAuth 소셜 로그인의 백엔드 구현(서비스, 컨트롤러, 엔티티, 마이그레이션)은 스펙 §5의 플로우를 충실히 구현했으나, **프론트엔드 `/callback` 페이지 미구현**이 가장 심각한 문제로 전체 OAuth 플로우의 마지막 단계가 누락됨. 추가로 신규 사용자 생성 트랜잭션의 원자성 깨짐은 고아 사용자 데이터를 생성할 수 있는 데이터 정합성 이슈이며, stub 모드의 환경변수 처리 불일치와 라우트 가드 미매칭은 개발/운영 환경 모두에서 OAuth 플로우를 중단시킬 수 있는 실제 장애 시나리오임.

## 위험도

**HIGH**