## 발견사항

### [WARNING] Access Token을 URL 쿼리 파라미터로 전달
- **위치**: `auth.controller.ts` — `oauthCallback()`, `spec/2-navigation/10-auth-flow.md §5.3`
- **상세**: 콜백 성공 시 `?token={accessToken}`으로 리다이렉트. Access Token이 브라우저 히스토리, 서버 액세스 로그, Referrer 헤더에 노출될 수 있음. 토큰 유효기간이 15분으로 짧지만 로그 보존 기간 내에서는 재사용 가능
- **제안**: 프론트엔드 `/callback` 페이지가 즉시 URL을 정리(`history.replaceState`)하는 로직이 반드시 구현되어야 하며, 이를 스펙에 강제 조건으로 명시할 것. 더 안전한 대안은 임시 세션 코드(일회성 단기 코드)를 URL에 담고, 프론트엔드가 이를 서버에 교환하는 패턴

### [WARNING] `generateTokens`를 `private` → `public`으로 변경
- **위치**: `auth.service.ts:296`
- **상세**: 내부 토큰 발급 로직이 외부 서비스(`AuthOauthService`)에 의해 직접 호출되도록 접근 제어가 완화됨. 향후 다른 서비스도 이 메서드를 임의로 호출할 수 있어 토큰 발급 경로가 분산될 위험
- **제안**: `AuthService`에 OAuth 전용 메서드(예: `loginWithOauth(user, rememberMe)`)를 추가해 `generateTokens`는 private으로 유지하고, `AuthOauthService`는 해당 퍼블릭 메서드만 호출하도록 리팩터링

### [WARNING] Provider 유효성 검증이 서비스 레이어에서만 수행됨
- **위치**: `auth.controller.ts` — `beginOauth()`, `oauthCallback()`
- **상세**: `@ApiParam({ enum: ['google', 'github'] })`은 Swagger 문서화용이며 실제 HTTP 요청을 필터링하지 않음. 유효하지 않은 provider(예: `facebook`, `../../etc`)로 요청 시 서비스 레이어까지 도달한 뒤 `BadRequestException` 발생
- **제안**: 컨트롤러 레벨에 `ParseEnumPipe` 또는 커스텀 파이프로 provider를 사전 검증하여 잘못된 파라미터를 HTTP 계층에서 차단

### [WARNING] 프론트엔드 기본 포트 불일치
- **위치**: `login-form.tsx:34`, `register-form.tsx:37`
- **상세**: `process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"` — 폴백 포트가 `3001`이나 백엔드 실행 포트는 `APP_PORT=3011`(example.env 기준). `NEXT_PUBLIC_API_URL` 환경 변수 미설정 시 개발 환경에서 OAuth 시작 요청이 잘못된 포트로 전송됨
- **제안**: 기본값을 `http://localhost:3011/api`로 수정하거나 frontend `.env` 파일에 `NEXT_PUBLIC_API_URL=http://localhost:3011/api` 명시

### [INFO] 신규 엔드포인트 추가 — 하위 호환성 영향 없음
- **위치**: `auth.controller.ts:330–417`
- **상세**: `GET /api/auth/oauth/:provider`, `GET /api/auth/oauth/:provider/callback` 은 기존 엔드포인트에 영향을 주지 않는 순수 추가. 기존 클라이언트에 breaking change 없음

### [INFO] 콜백 프론트엔드 경로 변경 (`/auth/callback` → `/callback`)
- **위치**: `spec/2-navigation/10-auth-flow.md §5.4`
- **상세**: 이번 구현이 OAuth 기능의 최초 구현(이전 버튼은 "미지원" 알림)이므로 실질적인 breaking change 아님. 향후 OAuth 관련 엔드포인트가 추가될 때 경로 일관성을 유지할 것

### [INFO] State 원자적 소비 패턴 — 올바른 구현
- **위치**: `auth-oauth.service.ts` — `handleCallback()`
- **상세**: `DELETE FROM auth_oauth_state WHERE state = $1 RETURNING *` 패턴으로 동시 콜백 중복 처리를 방지. CSRF/재사용 공격 방어에 적합

---

## 요약

이번 변경은 OAuth 소셜 로그인(Google/GitHub)을 새롭게 추가한 것으로 기존 API에 대한 breaking change는 없다. 보안 측면에서 Access Token을 URL 쿼리 파라미터로 전달하는 방식은 스펙에 명시된 설계이나, 프론트엔드의 즉각적인 URL 정리 로직과 결합되어야만 안전하게 동작하므로 해당 요건이 명시적으로 강제되어야 한다. `generateTokens`의 접근 제어 완화와 provider 검증 위치 문제는 내부 설계 일관성과 방어 심층성 관점에서 보완이 필요하다. 전반적으로 REST 규칙과 OAuth 표준 흐름(state CSRF 방어, 원자적 소비)은 올바르게 구현되었다.

## 위험도

**MEDIUM**