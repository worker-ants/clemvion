## 발견사항

---

### [CRITICAL] Access Token이 URL 파라미터로 전달됨
- **위치**: `auth.controller.ts` — `oauthCallback()`, 약 390번째 줄
- **상세**: `?success=true&token={accessToken}` 형태로 리다이렉트하면 토큰이 브라우저 히스토리, 서버 액세스 로그, Referer 헤더, proxy/CDN 로그에 기록됨. 특히 프론트엔드가 `/callback?token=...` URL을 즉시 정리하지 않으면 탭 공유·스크린샷 등으로 토큰이 노출 가능. 스펙에 명시된 설계이지만 OWASP A02(Cryptographic Failures) 범주에 해당.
- **제안**: 짧은 TTL(30초)의 일회용 코드를 DB에 저장하고 URL에는 그 코드만 전달. 프론트 `/callback`이 해당 코드로 서버 API를 호출해 실제 토큰을 교환하는 방식으로 전환. 또는 최소한 프론트엔드에서 `history.replaceState`로 URL 즉시 정리를 강제하고, Access Token 만료를 최단 시간(5분 이하)으로 설정.

---

### [CRITICAL] `generateTokens` 메서드가 private → public으로 변경됨
- **위치**: `auth.service.ts` — `generateTokens` 메서드
- **상세**: 토큰 발급이라는 핵심 보안 함수를 public으로 노출하면 모듈 내 어느 서비스에서도 호출 가능해짐. NestJS DI 컨테이너로 AuthService를 주입받는 코드는 모두 토큰을 임의로 발급할 수 있음. 추후 코드베이스 확장 시 의도치 않은 토큰 발급으로 이어질 수 있는 attack surface 확대.
- **제안**: `generateTokens`는 private으로 유지하고, OAuth 전용 패키지 메서드(`issueTokensForOauthUser(user, rememberMe)`)를 AuthService에 추가해 내부 로직을 캡슐화. 또는 AuthOauthService를 AuthService의 같은 파일/모듈 내부에서 처리해 패키지 가시성 문제를 회피.

---

### [CRITICAL] `OAUTH_STUB_MODE` 환경변수 직접 참조
- **위치**: `auth-oauth.service.ts` — `exchangeCodeForToken()`, `fetchProfile()` 내부
- **상세**: `process.env.OAUTH_STUB_MODE === 'true'` 조건이 참이면 실제 OAuth 제공자 검증 없이 합성 토큰을 발급함. 배포 시 이 변수가 실수로 `true`로 설정되거나, 환경변수 주입 취약점이 있을 경우 임의의 이메일로 인증을 우회할 수 있음. 현재 ConfigService를 통한 타입 안전 참조가 아니어서 실수 위험이 높음.
- **제안**: `process.env` 직접 참조 대신 `ConfigService`를 통해 `app.oauthStubMode` 등의 typed config key로 읽고, production 프로파일에서는 강제로 false가 되도록 설정 유효성 검증 추가. 또는 스텁 모드를 완전히 별도 모듈로 분리.

---

### [WARNING] DEBUG 로그에서 토큰 프리픽스 노출
- **위치**: `auth.service.ts` — `refresh()` 메서드, `console.log('[DEBUG refresh]', ...)` 라인
- **상세**: `tokenPrefix: refreshToken.substring(0, 8)`, `hashPrefix: tokenHash.substring(0, 16)`를 로그에 기록. 로그 집계 시스템에서 토큰 프리픽스 일치 공격(prefix matching) 가능성 있음. 주석에 `// DEBUG: Remove after verifying refresh works`라고 명시돼 있으나 현재 코드에 포함돼 있음.
- **제안**: 해당 `console.log` 즉시 제거. 운영 환경에서는 토큰의 어떤 부분도 로그에 기록하지 않음.

---

### [WARNING] `forgotPassword`에서 재설정 토큰 평문 로그 출력
- **위치**: `auth.service.ts` — `forgotPassword()` 메서드
- **상세**: `console.log(\`[DEV] Password reset token for ${email}: ${resetToken}\`)` 구문이 존재. 비밀번호 재설정 토큰이 로그에 평문으로 남으면 로그 접근 권한이 있는 내부자가 계정 탈취 가능. 또한 메일 전송 로직이 TODO로 미구현 상태(`// TODO: Send reset email`).
- **제안**: DEV 로그 즉시 제거. 메일 전송 구현 완료 전까지 기능을 비활성화하거나, 메일 미발송 상태를 명시적으로 예외 처리.

---

### [WARNING] OAuth `provider` 파라미터가 라우트 레벨에서 검증되지 않음
- **위치**: `auth.controller.ts` — `beginOauth()`, `oauthCallback()`
- **상세**: Swagger 문서에는 `enum: ['google', 'github']`로 표시되어 있으나 실제 HTTP 레벨에서는 임의 문자열이 통과 가능. 서비스 레이어의 `assertProvider()`에서 걸러지지만, 그 전에 `provider` 값이 로그 문자열 (`OAuth callback failed for ${provider}`)에 그대로 삽입됨. Log injection 가능성 있음.
- **제안**: `@Param('provider') provider: string`에 커스텀 파이프 또는 `ParseEnumPipe`를 적용하여 컨트롤러 진입 전에 검증. 로그 메시지에 신뢰할 수 없는 파라미터를 삽입할 때는 정규화 후 사용.

---

### [WARNING] OAuth PKCE(Proof Key for Code Exchange) 미구현
- **위치**: `auth-oauth.service.ts` — `beginAuth()`, `exchangeCodeForToken()`
- **상세**: 인가 코드 흐름에서 `code_challenge` / `code_verifier` 없이 `state` 파라미터만 사용. 서버-사이드 플로우이므로 client_secret이 보호하지만, 향후 모바일/SPA 확장 시 PKCE가 없으면 인가 코드 인터셉션 공격(Authorization Code Interception)에 취약. Google은 현재 PKCE를 권장.
- **제안**: `code_verifier`(랜덤 문자열, 43~128자)를 state와 함께 DB에 저장하고, 인가 URL에 `code_challenge=BASE64URL(SHA256(verifier))`를 포함. 토큰 교환 시 `code_verifier`를 함께 전송.

---

### [WARNING] State 만료 레코드 정리가 application-level에만 의존
- **위치**: `auth-oauth.service.ts` — `purgeExpired()`, `backend/migrations/V013__auth_oauth_state.sql`
- **상세**: 만료된 state 레코드를 `void this.purgeExpired()`로 비동기 정리하는데, 이는 `beginAuth` 호출 시에만 동작. 서버 재시작·낮은 트래픽 시에는 만료 레코드가 누적. DB 수준 TTL(PostgreSQL pg_cron, 파티셔닝 등) 또는 주기적 cleanup job이 없음.
- **제안**: NestJS 스케줄러(`@Cron`)로 주기적(예: 매 시간) 만료 레코드 정리 작업 추가. 또는 DB 파티셔닝/pg_partman을 통한 자동 만료 적용.

---

### [INFO] `example.env`의 개발용 기본값들
- **위치**: `backend/example.env` 전체
- **상세**: `JWT_SECRET=dev-jwt-secret-change-in-production`, `ENCRYPTION_KEY=0123456789abcdef...`, `DB_PASSWORD=workflow_dev` 등이 명시. example.env 자체는 문제 없으나, 실제 `.env`에 같은 값이 사용되는 경우를 방지하기 위한 배포 시 검증 로직이 없음.
- **제안**: 애플리케이션 시작 시 `NODE_ENV=production`이면 기본값 사용 여부를 검사하고 에러로 중단하는 startup validation 추가(예: ConfigService 기반 guard).

---

### [INFO] `frontendUrl` 설정값에 대한 검증 부재
- **위치**: `auth.controller.ts` — `oauthCallback()`, `frontendUrl` 변수
- **상세**: `configService.get<string>('app.frontendUrl') ?? 'http://localhost:3002'`로 fallback이 하드코딩됨. 설정 오류로 frontendUrl이 비어 있을 경우 localhost로 리다이렉트가 발생하여 운영 환경에서 silent failure 가능.
- **제안**: startup validation에서 production 환경의 `frontendUrl` 필수 설정 강제. fallback 기본값 제거.

---

## 요약

이번 변경사항은 OAuth 소셜 로그인의 핵심 플로우를 구현하며 CSRF 방지를 위한 state 파라미터, atomic한 state 소비(DELETE ... RETURNING), 사용자 자동 생성/연결 등 전반적으로 설계가 탄탄합니다. 그러나 **Access Token이 URL 파라미터로 노출**되는 설계, **`generateTokens`의 public 노출**, **OAUTH_STUB_MODE의 process.env 직접 참조**는 프로덕션 환경에서 심각한 보안 위험을 초래할 수 있습니다. 또한 여러 곳에 남아 있는 DEBUG/DEV 콘솔 로그가 민감 정보를 로그에 기록하고 있어 조기에 제거가 필요합니다.

## 위험도

**HIGH**