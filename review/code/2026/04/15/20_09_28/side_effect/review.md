## 발견사항

### [CRITICAL] Access Token을 URL 쿼리 파라미터로 전달
- **위치**: `auth.controller.ts` — `oauthCallback()`, `auth-oauth.service.ts` 스펙 연동
- **상세**: `?token={accessToken}` 형태로 JWT를 URL에 노출. 브라우저 히스토리, 서버 액세스 로그, Referer 헤더, 분석 도구 등에 토큰이 남음. 짧은 만료 시간(15분)이 일부 완화하지만, 로그 기반 공격 벡터는 유효함.
- **제안**: 콜백 후 백채널(HttpOnly 쿠키 또는 단기 서버사이드 세션 코드 교환)을 사용하거나, 최소한 프론트엔드 `/callback` 페이지에서 `replaceState`로 URL을 즉시 정리하는 것을 명시적으로 강제해야 함.

---

### [WARNING] `generateTokens` 가시성 `private → public` 변경
- **위치**: `auth.service.ts:296`
- **상세**: `AuthOauthService`가 호출하기 위해 의도적으로 공개했지만, 이제 `AuthModule`에 접근 가능한 모든 코드가 인증 검증 없이 임의의 사용자에 대해 토큰을 직접 발급할 수 있음. 공개 API 표면 확장이 의도치 않은 오용으로 이어질 수 있음.
- **제안**: `internal` 접근 패턴으로 제한하거나, 동일 모듈 내에서만 호출 가능하도록 명확한 주석을 추가. 또는 `AuthOauthService`를 `AuthService` 내부로 통합하여 공개 표면을 최소화.

---

### [WARNING] `resolveUser`의 트랜잭션 불일치
- **위치**: `auth-oauth.service.ts` — `resolveUser()`
- **상세**: 신규 사용자 생성은 `dataSource.transaction()`으로 감싸지만, 기존 이메일 사용자의 OAuth 연결(`usersService.update`)은 트랜잭션 밖에서 실행됨. `update()` 성공 후 `generateTokens()` 실패 시 사용자의 `oauthProvider`/`oauthProviderId`가 연결된 채 토큰 없이 남는 불일치 상태 발생 가능.
- **제안**: 이메일 기반 사용자 업데이트 경로도 트랜잭션으로 감싸거나, `generateTokens` 실패를 허용 가능한 부분 실패로 설계에 반영.

---

### [WARNING] `process.env` 직접 접근 — ConfigService 우회
- **위치**: `auth-oauth.service.ts` — `exchangeCodeForToken()`, `fetchProfile()`, `requireEnv()`, `redirectUri()`
- **상세**: `OAUTH_STUB_MODE`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `APP_URL`을 `process.env`에서 직접 읽음. ConfigService를 통하지 않아 중앙화된 설정 검증 및 테스트 모킹을 우회함. 특히 테스트에서 `process.env.OAUTH_STUB_MODE = 'true'`를 직접 변조하는 패턴(`auth-oauth.service.spec.ts:37`)은 테스트 간 오염 위험이 있음 (`afterEach`에서 복원하지 않음).
- **제안**: ConfigService의 `get()`을 통해 환경 변수를 읽도록 통일하거나, 최소한 테스트 후 `process.env` 상태를 `afterEach`에서 복원.

---

### [WARNING] 프론트엔드 기본 포트 불일치
- **위치**: `login-form.tsx:34`, `register-form.tsx:37`
- **상세**: `API_BASE_URL` 기본값이 `http://localhost:3001/api`이지만, `example.env`의 `APP_PORT=3011`. 환경 변수 미설정 시 잘못된 엔드포인트로 요청됨.
- **제안**: 기본값을 `http://localhost:3011/api`로 수정하거나, `NEXT_PUBLIC_API_URL` 미설정 시 명시적 에러를 발생시키도록 처리.

---

### [INFO] `@Res()` without `passthrough: true` — 인터셉터 우회
- **위치**: `auth.controller.ts` — `beginOauth()`, `oauthCallback()`
- **상세**: 리다이렉트 목적으로 의도적이나, `TransformInterceptor`와 `LoggingInterceptor` 등 앱 전역 인터셉터가 이 두 엔드포인트의 응답을 처리하지 못함. 로깅 누락 가능성.
- **제안**: 현재 설계는 적합하나, 로깅 커버리지 공백을 인지하고 있을 것.

---

### [INFO] `void this.purgeExpired()` — 오류 전파 억제
- **위치**: `auth-oauth.service.ts` — `beginAuth()`
- **상세**: `purgeExpired` 내부에 `try/catch`가 있어 실질적으로 안전하지만, `void` 키워드로 promise rejection을 무시하는 패턴은 향후 내부 구현 변경 시 무음 실패로 이어질 수 있음.
- **제안**: 현재는 허용 가능. 주석으로 의도를 명시.

---

### [INFO] `AuthOauthService` 미내보내기
- **위치**: `auth.module.ts`
- **상세**: `AuthOauthService`가 `exports` 배열에 없음. 현재는 문제없으나, 다른 모듈에서 OAuth 시작이 필요한 경우 재설계 필요.
- **제안**: 의도적 설계라면 주석으로 명시.

---

## 요약

이번 변경은 OAuth 소셜 로그인 플로우를 신규 구현한 것으로, 전반적인 아키텍처 설계(상태 원자적 소비, CSRF 방지용 state 파라미터, stub 모드 지원)는 건전하다. 그러나 **Access Token을 URL 쿼리 파라미터로 전달하는 패턴**이 가장 심각한 보안 부작용이며, 프론트엔드의 URL 즉시 정리 여부와 무관하게 서버 로그에 토큰이 기록된다. 추가로 `generateTokens`의 가시성 확장, 부분 트랜잭션 불일치, `process.env` 직접 접근으로 인한 테스트 오염 가능성이 누적되면 의도치 않은 상태 변경 위험이 높아진다. 특히 기본 포트 불일치는 개발 환경에서 즉시 문제가 될 수 있다.

## 위험도

**HIGH**