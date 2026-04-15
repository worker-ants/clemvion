### 발견사항

---

**[WARNING] `auth-oauth.service.ts` 공개 메서드에 JSDoc 누락**
- 위치: `auth-oauth.service.ts` — `beginAuth()`, `handleCallback()`, `isSupportedProvider()`
- 상세: 이 세 메서드는 외부에서 호출되는 공개 인터페이스이지만 JSDoc이 없습니다. 특히 `handleCallback()`은 stub 모드와 실제 모드가 공존하며 CSRF state 소비 등 복잡한 부작용이 있어 설명이 필요합니다.
- 제안:
  ```ts
  /**
   * OAuth 인증 플로우를 시작하고, CSRF 방지용 state를 DB에 저장한 뒤
   * 제공자 인증 페이지 URL을 반환합니다.
   * @param provider - 지원 제공자: 'google' | 'github'
   * @param params   - 로그인/회원가입 모드 및 rememberMe 여부
   */
  async beginAuth(...)
  ```

---

**[WARNING] `auth.service.ts` — `generateTokens()` 가시성 변경에 주석 없음**
- 위치: `auth.service.ts:296` — `private` → `async` (public)으로 변경
- 상세: `private`이었던 헬퍼가 `AuthOauthService`에서 호출하기 위해 public으로 변경되었지만, 이 의도를 설명하는 주석이 없습니다. 향후 유지보수자가 이 메서드를 다시 private으로 되돌릴 위험이 있습니다.
- 제안: 메서드 위에 의도를 명시:
  ```ts
  /**
   * @internal AuthOauthService에서 OAuth 로그인 완료 후 토큰 발급에도 사용됩니다.
   * AuthService 내부 헬퍼이지만 auth 모듈 내에서만 호출해야 합니다.
   */
  async generateTokens(...)
  ```

---

**[WARNING] `example.env` — `OAUTH_STUB_MODE`에 대한 프로덕션 전환 절차 문서 부재**
- 위치: `backend/example.env:63-70`
- 상세: `OAUTH_STUB_MODE=true`가 기본값인데, 프로덕션에서 false로 전환할 때 필요한 사전 조건(redirect URI 등록 등)이 추가된 주석에서 언급되지만 실제 단계별 절차가 없습니다. 설정 실수가 보안 취약점으로 이어질 수 있습니다.
- 제안:
  ```env
  # OAUTH_STUB_MODE=false 전환 체크리스트:
  #   1. 각 제공자 콘솔에서 아래 두 redirect URI를 모두 허용 등록
  #      - {APP_URL}/api/integrations/oauth/callback/:provider
  #      - {APP_URL}/api/auth/oauth/:provider/callback
  #   2. CLIENT_ID / CLIENT_SECRET 값 설정
  #   3. OAUTH_STUB_MODE=false 설정
  ```

---

**[INFO] `auth.controller.ts` — `mapOauthError()` 모듈 수준 함수에 주석 없음**
- 위치: `auth.controller.ts:431-453`
- 상세: 파일 맨 아래 module-level 함수로 배치되어 있어 클래스 메서드로 오인될 수 있고, 에러 코드와 사용자 노출 코드 간의 매핑 의도가 불분명합니다.
- 제안:
  ```ts
  /**
   * AuthOauthService가 던지는 BadRequestException의 내부 코드를
   * 프론트엔드 콜백 URL에 노출할 퍼블릭 에러 코드로 변환합니다.
   * 서버 내부 코드가 클라이언트에 직접 노출되지 않도록 합니다.
   */
  function mapOauthError(err: unknown): string { ... }
  ```

---

**[INFO] `spec/2-navigation/10-auth-flow.md` — URL 경로 변경(`/auth/callback` → `/callback`) 이유 미기술**
- 위치: `spec/2-navigation/10-auth-flow.md:288-305`
- 상세: 스펙 문서가 URL을 업데이트했지만, Access Token을 URL 파라미터로 전달하는 설계 결정의 보안 고려사항(짧은 만료 후 URL 정리 필요성, HTTPS 전제)이 스펙에 기술되어 있지 않습니다.
- 제안: 5.3 섹션에 보안 노트 추가:
  ```md
  > **보안 노트**: Access Token은 URL 파라미터로 전달되므로 클라이언트는
  > 토큰 수신 즉시 `history.replaceState()`로 URL에서 제거해야 합니다.
  > HTTPS 환경에서만 사용해야 합니다.
  ```

---

**[INFO] `migrations/V013__auth_oauth_state.sql` — 만료 레코드 정리 정책 미기술**
- 위치: `V013__auth_oauth_state.sql:9`
- 상세: `idx_auth_oauth_state_expires` 인덱스는 `purgeExpired()` 호출을 위해 존재하는데, 이 정리가 애플리케이션 레벨(다음 `beginAuth` 호출 시 fire-and-forget)에서만 수행된다는 점이 마이그레이션 파일에 언급되지 않습니다. DB 레벨 정리 작업(pg_cron 등)이 없음을 명시할 필요가 있습니다.
- 제안:
  ```sql
  -- 만료 레코드 정리: AuthOauthService.purgeExpired()가 beginAuth() 호출 시마다
  -- fire-and-forget으로 실행합니다. 별도 DB 스케줄러는 필요하지 않습니다.
  CREATE INDEX idx_auth_oauth_state_expires ON auth_oauth_state (expires_at);
  ```

---

**[INFO] `login-form.tsx` / `register-form.tsx` — `API_BASE_URL` 중복 정의**
- 위치: `login-form.tsx:34`, `register-form.tsx:37`
- 상세: 두 파일에 동일한 `API_BASE_URL` 상수가 중복 정의되어 있습니다. 문서화 관점에서 이 설정이 어디에서 관리되어야 하는지 주석 또는 공통 모듈 참조가 없어 혼선이 생길 수 있습니다.
- 제안: `@/lib/api/client.ts` 등 API 설정 공통 모듈에서 export하고 해당 경로 참조로 교체, 또는 최소한 주석으로 의도 명시.

---

### 요약

이번 변경은 OAuth 소셜 로그인 전체 플로우(state 생성, 콜백 처리, 사용자 생성/연결)를 구현한 상당한 규모의 기능 추가이며, 스펙 문서(`10-auth-flow.md`)와 환경변수 설명(`example.env`)은 대체로 잘 갱신되었습니다. 다만 핵심 서비스인 `AuthOauthService`의 공개 메서드에 JSDoc이 없고, `generateTokens()`의 가시성 변경 의도가 코드에 명시되지 않은 점, Access Token의 URL 파라미터 전달에 대한 보안 노트가 스펙에 누락된 점이 주요 미비 사항입니다. 프론트엔드의 `API_BASE_URL` 중복도 향후 유지보수성을 저하시킬 수 있습니다.

### 위험도
**LOW**