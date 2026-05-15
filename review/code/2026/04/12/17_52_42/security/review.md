### 발견사항

---

**[WARNING] OAuth 콜백 HTML에 XSS 잠재 위험**
- 위치: `integrations.controller.ts` — `renderCallbackHtml()` 함수
- 상세: `input.error` 문자열이 HTML에 직접 삽입됩니다. `<` 문자는 `\u003c`로 이스케이프하지만, `>`, `"`, `'`, `&`는 처리하지 않습니다. `input.provider`도 마찬가지입니다.
  ```ts
  // 문제: input.error와 input.provider가 HTML에 raw 삽입됨
  <p>${input.status === 'success' ? 'Connected...' : 'OAuth failed: ' + input.error}</p>
  ```
- 제안: `<p>` 태그 내 텍스트도 HTML 엔티티로 이스케이프하거나, `textContent` 방식으로 JS에서만 처리할 것
  ```ts
  function htmlEscape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  ```

---

**[WARNING] OAuth 콜백이 `@Public()` — CSRF 및 state 검증에 전적으로 의존**
- 위치: `integrations.controller.ts` — `oauthCallback()`
- 상세: `@Public()` 데코레이터로 JWT 인증이 생략됩니다. state 검증을 DB에서 수행하고 있어 기본적으로 안전하지만, `state` 파라미터가 `undefined`일 때 서비스 레이어에서 BadRequestException이 발생하는 것에 의존합니다. Provider 파라미터(`@Param('provider')`)는 화이트리스트 검증 없이 DB 조회에 사용됩니다.
- 제안: provider 값을 알려진 목록으로 검증
  ```ts
  const ALLOWED_PROVIDERS = new Set(['slack', 'google', 'github']);
  if (!ALLOWED_PROVIDERS.has(provider)) throw new BadRequestException('Unknown provider');
  ```

---

**[WARNING] `postMessage` 대상 origin 고정 — popup이 다른 도메인일 경우 우회 가능**
- 위치: `integrations.controller.ts` — `renderCallbackHtml()`의 `<script>` 블록
- 상세: `window.opener.postMessage(${json}, window.location.origin)` — 콜백 페이지의 origin이 `APP_URL`과 다를 경우(프록시, CDN 등), opener가 다른 origin일 수 있습니다. 수신 측(`new/page.tsx`)에서 `event.origin !== window.location.origin`으로 검증하고 있어 수신 단은 안전합니다.
- 제안: `APP_URL` 환경변수를 서버 렌더링 시 `<meta>` 태그로 주입하여 postMessage target을 명시적으로 고정

---

**[WARNING] 자격증명 credential이 JSONB로 저장 — DB 수준 암호화 없음**
- 위치: `integration.entity.ts`, `integration-oauth-preview.entity.ts`, 마이그레이션 파일들
- 상세: `access_token`, `refresh_token`, `password` 등 시크릿이 JSONB 컬럼에 평문 저장됩니다. DB가 탈취되면 모든 자격증명이 노출됩니다.
- 제안: 저장 전 애플리케이션 레벨 암호화(AES-256-GCM + 환경변수 키) 또는 HashiCorp Vault/AWS KMS 연동 검토

---

**[WARNING] OAuth 토큰 교환이 스텁(stub) 구현**
- 위치: `integration-oauth.service.ts` — `handleCallback()` 내 `syntheticCredentials`
- 상세: 실제 provider token endpoint 호출 없이 `stub-{random}`으로 가짜 토큰을 생성합니다. 이 상태로 프로덕션에 배포되면 저장된 credentials는 모두 무효하고, 실제 API 호출 시 401이 반환됩니다. 보안 위험이라기보다 데이터 무결성 위험이지만, 스텁 코드가 실수로 릴리즈될 경우 access_token이 DB에 의미없는 값으로 저장됩니다.
- 제안: 코드 주석에 명확히 표시되어 있으나(`// Phase C: token exchange is stubbed`), 프로덕션 빌드에서 스텁이 활성화되지 않도록 feature flag 또는 환경 체크 추가

---

**[WARNING] `ActivityQueryDto`의 `limit`/`days` 범위 검증 없음**
- 위치: `integrations.controller.ts` — `activity()`, `dto/integration.dto.ts`
- 상세: `limit`과 `days`가 string으로 받아 `Number()`로 변환되며, `Number.isFinite()` 체크가 있지만 최대값 제한이 없습니다. `limit=100000&days=3650` 같은 요청으로 DB에 과도한 부하를 줄 수 있습니다.
- 제안: DTO에 `@Max()`, `@Min()` 데코레이터 추가
  ```ts
  @IsOptional() @IsNumberString() @Max(100) limit?: string;
  @IsOptional() @IsNumberString() @Max(90) days?: string;
  ```

---

**[WARNING] `previewTest` 엔드포인트 — 인증은 되어 있으나 rate limit 없음**
- 위치: `integrations.controller.ts` — `previewTest()`
- 상세: `POST /integrations/preview-test`는 임의의 serviceType/authType/credentials를 받아 외부 서비스 연결 테스트를 수행합니다. 인증된 사용자가 이를 반복 호출하여 내부 네트워크 스캔(SSRF 포함)에 악용할 수 있습니다.
- 제안: `serviceType`을 SERVICE_REGISTRY 화이트리스트로 검증하고, rate limiting 미들웨어 적용

---

**[INFO] `OAuthBeginDto.scopes`에 개별 scope 값 길이/형식 검증 없음**
- 위치: `dto/integration.dto.ts` — `OAuthBeginDto`
- 상세: `@IsString({ each: true })`만 있고 각 scope 값의 최대 길이나 허용 문자 검증이 없습니다. 긴 문자열이나 특수문자가 OAuth URL에 주입될 수 있습니다.
- 제안: `@MaxLength(128, { each: true })` 추가

---

**[INFO] `maskCredentials`에서 스텁 토큰도 마스킹됨 — 디버깅 어려움**
- 위치: `services/service-registry.ts` — `maskCredentials()`
- 상세: 동작은 올바르나, 스텁 credentials도 `********`로 마스킹되어 개발 중 스텁/실제 토큰 구분이 불가능합니다. (INFO 레벨)

---

**[INFO] `integration_oauth_state` 만료 레코드 삭제가 `begin()` 호출 시에만 실행**
- 위치: `integration-oauth.service.ts` — `purgeExpired()`
- 상세: `begin()` 내에서만 `purgeExpired()`가 호출됩니다. `begin()`이 드물게 호출되는 경우 만료된 state/preview 레코드가 장기간 DB에 잔류합니다. 보안 위협은 낮지만 만료된 레코드가 DB 스토리지를 점유합니다.
- 제안: 별도 스케줄러(expiry-scanner와 유사하게)에서 주기적으로 정리

---

**[INFO] `integration-expiry-scanner.service.ts` — status `Not('error')` 쿼리가 `expired` 상태도 포함**
- 위치: `integration-expiry-scanner.service.ts` — `run()` 내 `integrationRepository.find()`
- 상세: 이미 `expired`인 통합도 스캔 대상에 포함되어 `tokenExpiresAt`이 갱신되지 않으면 매번 스캔됩니다. `dispatchRepository.insert`의 unique 제약이 중복 알림을 막지만, 불필요한 DB 조회가 발생합니다.
- 제안: `where: { status: Not(In(['error', 'expired'])) }` 또는 `0d` threshold dispatch 기록으로 이미 처리된 건 skip

---

### 요약

전반적으로 인증·인가 구조는 잘 설계되어 있습니다. JWT 기반 인증, workspace 격리, role 기반 org-scope 접근 제어, timing-safe 비교(`crypto.timingSafeEqual`)가 적절히 적용되었습니다. 주요 위험은 OAuth 콜백 HTML의 XSS 가능성(미이스케이프 에러 메시지), provider 화이트리스트 검증 누락, 그리고 자격증명의 평문 JSONB 저장입니다. 또한 현재 OAuth 토큰 교환이 스텁으로 구현되어 있어 실제 토큰이 저장되지 않는 점은 프로덕션 배포 전 반드시 해결이 필요합니다. `previewTest` 엔드포인트는 SSRF 벡터가 될 수 있으므로 서비스 타입 화이트리스트와 rate limit 적용을 권장합니다.

### 위험도

**MEDIUM**