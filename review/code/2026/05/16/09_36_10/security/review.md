# Cafe24 Security Review (2026-05-16)

## Critical (즉시 수정 필요)

### [C-1] private app client_secret 이 provider_meta JSONB (state row) 에 평문 보관됨

- **위치**: `integration-oauth.service.ts:1260-1265` (handleInstall 내 stateRecord 생성)
- **상세**:
  `handleInstall` 이 OAuthState row 를 생성할 때 `providerMeta` 에 `client_secret` 을 포함한다. `integration_oauth_state` 엔티티의 `provider_meta` 컬럼에 `encryptedJsonTransformer` 가 적용되었는지 확인이 필요하다. `Integration.credentials` 에는 transformer 가 있으나(`integration.entity.ts:47-50`), `IntegrationOAuthState.providerMeta` 컬럼에 동일 transformer 가 적용되지 않았다면 client_secret 이 DB 에 평문 저장된다. 또한 state 는 10분 TTL 이 있어 짧지만, DB 레벨 dump, 감사 로그, replication stream 에서 노출된다. `createPrivatePendingIntegration` 경로(`integration-oauth.service.ts:989-1132`)에서 Integration.credentials 에도 `client_secret` 을 저장하는데 이쪽은 transformer 가 적용되어 있어 보호된다.
- **재현 가능 시나리오**: DB admin 이 `integration_oauth_state` 테이블을 SELECT 하거나, WAL/replication stream 을 보면 state 유효 시간(10분) 내 client_secret 평문 열람 가능.
- **권장 fix**: `IntegrationOAuthState.providerMeta` 컬럼에 `encryptedJsonTransformer` 를 적용한다. 또는 state row 저장 전에 `client_secret` 을 providerMeta 에서 제거하고, handleInstall 이 이미 Integration row(암호화된 credentials) 에서 client_secret 을 읽을 수 있으므로 state row 에 중복 저장할 필요가 없다. 선호 방향: state row providerMeta 에서 client_secret 을 삭제하고, handleCallback 이 Integration row 를 직접 재조회해 client_secret 을 획득하도록 리팩토링.

---

### [C-2] `SECRET_LEAK_PATTERNS` 마스킹이 `client_secret` 키를 누락함 (대·소문자 포함)

- **위치**: `integration-oauth.service.ts:176-183` (`SECRET_LEAK_PATTERNS`)
- **상세**:
  현재 패턴 목록:
  ```
  /\b(client_secret|access_token|refresh_token|id_token|api_key|password|passwd|pwd)\s*[=:]\s*[^\s&'"]+/gi
  ```
  이 regex 는 `client_secret=abc123` 형태를 잡는다. 그러나 Cafe24 가 토큰 교환 실패 응답에서 JSON body 로 에러를 돌려줄 때 (`{"error":"invalid_client","error_description":"invalid client_secret"}`) `sanitizeLastErrorMessage` 가 `error_description` 의 문자열을 그대로 통과시킨다. `secret` 단독 키워드, `client-secret` (하이픈), Bearer 뒤 공백 없이 붙은 케이스도 미처리. 더 위험한 것은, `refreshAccessToken` 에서 오류 발생 시 `new Error(`Cafe24 token refresh failed (${response.status}): ${JSON.stringify(body)}`)` 를 throw 하는데(`cafe24-api.client.ts:453-455`), 이 메시지가 `sanitizeLastErrorMessage` 를 거치지 않고 `lastError` 에 기록될 수 있다.
- **재현 가능 시나리오**: Cafe24 token endpoint 가 잘못된 client_secret 에 대해 `{"error_description": "invalid client_secret: sk-xxxx..."}` 를 반환하면, `handleCallback` 의 예외 처리 경로를 통해 Integration row 의 `last_error.message` 에 secret 의 일부가 저장될 수 있다.
- **권장 fix**: (1) `SECRET_LEAK_PATTERNS` 에 `\bsecret\b`, `client-secret` 패턴 추가. (2) `cafe24-api.client.ts:453` 의 raw error message 를 `lastError` 에 기록하는 경로에도 `sanitizeLastErrorMessage` 적용. (3) `markAuthFailed` 에서 기록하는 `lastError.message` 도 동일 sanitizer 통과 확인.

---

## High (이번 sprint 안에)

### [H-1] `verifyHmacWithMessage` 에서 길이 다를 때 `timingSafeEqual` 예외를 catch → false 반환하나, 길이가 같은 유사 토큰이 timing oracle 노출 가능

- **위치**: `integration-oauth.service.ts:1520-1533`
- **상세**:
  현재 구현:
  ```ts
  const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
  } catch {
    return false;
  }
  ```
  `timingSafeEqual` 은 길이가 다르면 예외를 던지고 catch 로 `false` 반환한다. 이 동작 자체는 정확하다. 그러나 `receivedHmac` 은 URL-decoded query 파라미터로 받는데, Cafe24 HMAC 은 Base64(+padding) 이므로 `=` 로 끝나거나 `+`, `/` 를 포함할 수 있다. URLSearchParams 가 이를 자동 디코드하므로 실제로는 문제없지만, `buildHmacMessage` 가 rawQuery 에서 `hmac` 파라미터를 제거한 후 나머지를 `encodeURIComponent(v)` 로 재인코딩(`integration-oauth.service.ts:1514-1517`)하는 방식이 Cafe24 공식 알고리즘(key alphabetical sort + percent-encode each value) 과 완전히 일치하는지 검증 필요. 구체적으로 Cafe24 공식 샘플의 Java 코드가 `URLEncoder.encode(value, "UTF-8")` 를 사용하는데, 공백을 `+` 로 인코딩한다. `encodeURIComponent` 는 `%20` 으로 인코딩한다. `user_name` 파라미터에 공백이 포함된 경우 HMAC 불일치 발생 가능 (기능 버그이기도 하지만, 우회 시나리오는 공격자가 공백 포함 값으로 HMAC bypass 시도는 불가능하므로 보안적으로는 오탐 없음 — 단 정상 요청이 거부될 수 있음).
- **재현 가능 시나리오**: Cafe24 관리자 이름(`user_name`)에 공백이 포함된 경우 합법적인 "테스트 실행" 요청이 HMAC 검증 실패로 거부될 수 있다. 이는 서비스 무결성 문제이기도 하다.
- **권장 fix**: `buildHmacMessage` 의 인코딩을 Cafe24 공식 Java 샘플의 `URLEncoder.encode(value, "UTF-8")` (공백 → `+`) 와 정확히 일치하도록 재검토. 단위 테스트에 공백 포함 케이스를 추가.

---

### [H-2] `tryRecoverByMallId` 에서 전체 workspace 에 걸쳐 O(N) Integration 로드 후 HMAC trial 수행 — DoS amplification 가능

- **위치**: `integration-oauth.service.ts:1311-1362`
- **상세**:
  `tryRecoverByMallId` 는 `mall_id` 로 모든 `cafe24` Integration 을 로드(`find` without `workspaceId` 필터)한다:
  ```ts
  const sameMall = await this.integrationRepository.find({
    where: { mallId: query.mall_id, serviceType: 'cafe24' },
  });
  ```
  `workspaceId` 필터가 없어 **모든 테넌트**에서 같은 `mall_id` 를 가진 행 전체를 로드한다. 공격자가 흔한 mall_id 를 추측하고 무효 install_token 으로 반복 요청을 보내면, 각 요청마다 DB full-scan + 다수 HMAC 연산이 발생한다. Throttle 은 IP 기반 `30 req/min` 이 있으나 분산 IP 공격에는 취약.
  추가로 이 로그 출력에서 candidateIntegration 목록의 `id`, `status`, `tokenPrefix` 가 노출되는데(`integration-oauth.service.ts:1329-1338`), 공격자가 `mall_id` 와 stale token 을 알면 타 workspace 의 Integration ID(UUID)를 추론할 수 있다.
- **재현 가능 시나리오**: 공격자가 인기 있는 mall_id (예: `test`) 로 무효 install_token 을 반복 호출하면 DB 전체 스캔 + HMAC 연산이 반복됨. 또는 warn log 의 `id` 필드로 다른 workspace 의 Integration UUID 누출 가능.
- **권장 fix**: (1) 회복 흐름 자체를 제거하거나 완전히 비활성화하는 방향 검토 (install_token 을 persistent 로 유지하면 stale URL 이 거의 발생하지 않으므로 회복 흐름의 가치가 낮음). (2) 유지한다면 `workspaceId` 필터를 추가하되, workspaceId 를 알 수 없는 상황에서는 install_token 에서 workspace를 먼저 특정하는 방법을 설계. (3) warn 로그에서 Integration ID, tokenPrefix 를 제거하거나 운영자 전용 로그 레벨로 격리.

---

### [H-3] open redirect — `FRONTEND_URL` / `APP_URL` 의 origin 검증 부재

- **위치**: `integration-oauth.service.ts:1241-1249` (post-install navigation 분기), `third-party-oauth.controller.ts:192-199` (targetOrigin)
- **상세**:
  `handleInstall` 에서 post-install navigation 시 redirect 대상:
  ```ts
  const frontendBaseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  return `${trimmed}/integrations/${target.id}`;
  ```
  환경변수를 신뢰하므로 코드 자체는 안전하나, 배포 환경에서 `FRONTEND_URL` 에 임의 URL(예: 오타, 외부 도메인)이 설정되면 redirect 가 외부 도메인으로 향한다. 더 직접적으로, `oauthCallback` 컨트롤러에서:
  ```ts
  const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL;
  ```
  이 값이 `renderCallbackHtml` 의 `postMessage` targetOrigin 으로 사용된다. 만약 `FRONTEND_URL` 이 `*` 이거나 공격자가 제어하는 도메인으로 잘못 설정되면 `postMessage` 가 모든 origin 에게 OAuth 결과(previewToken 포함)를 전달한다.
- **재현 가능 시나리오**: `FRONTEND_URL=*` 또는 외부 도메인으로 설정된 배포 환경에서 postMessage 를 통해 previewToken 이 악성 페이지에 노출.
- **권장 fix**: 시작 시 `FRONTEND_URL` 이 `https://` 로 시작하는 허용된 도메인인지 validation. `renderCallbackHtml` 에 targetOrigin 이 `*` 또는 `http://` (프로덕션) 일 때 경고 출력. env validation 모듈에 allowlist 체크 추가.

---

### [H-4] `refreshAccessToken` 에서 non-2xx 오류 시 error body 가 sanitize 없이 로그에 500자까지 기록됨

- **위치**: `cafe24-api.client.ts:441-455`
- **상세**:
  ```ts
  const bodyForLog = typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500);
  this.logger.warn(`Cafe24 token refresh ${response.status} mall=${creds.mall_id}: ${bodyForLog}`);
  ```
  Cafe24 token endpoint 가 오류 응답에 client_secret 이나 token 일부를 echo 하는 경우 (비정상적이지만 방어 필요), 운영 로그에 평문 기록. 아래 `executeWithRateLimit` 의 401/403 처리도 동일 패턴 (`cafe24-api.client.ts:621-628`).
- **권장 fix**: 로그 출력 전 `sanitizeLastErrorMessage` 에 해당하는 패턴 적용. `SECRET_LEAK_PATTERNS` 를 공유 유틸리티로 추출해 재사용.

---

### [H-5] `normalizeRawPreviewRow` 에서 legacy 미암호화 경로 (`enc:` prefix 없는 plaintext JSON) 가 조용히 파싱됨

- **위치**: `integration-oauth.service.ts:265-269`
- **상세**:
  ```ts
  } else if (typeof credentialsRaw === 'string') {
    // legacy 미암호화 경로 (없어야 하지만 방어적)
    try {
      credentials = JSON.parse(credentialsRaw) as Record<string, unknown>;
    } catch {
      credentials = { __invalid: true };
    }
  }
  ```
  이 경로는 "없어야 한다"고 주석에 명시되어 있으나, 실제로 진입 시 암호화되지 않은 credentials 가 그대로 사용된다. 공격자가 DB 에 직접 접근해 `enc:` prefix 없이 JSON 을 삽입하면 decryption 을 우회한다. 더 구체적으로, preview row 자체가 `encryptedJsonTransformer` 를 bypass 하는 raw DELETE…RETURNING 경로로 생성되는 만큼, 이 fallback 이 실제로 작동할 수 있다.
- **재현 가능 시나리오**: DB 쓰기 권한이 있는 내부자가 암호화되지 않은 credentials 를 삽입하면 애플리케이션이 이를 검증 없이 사용.
- **권장 fix**: legacy 경로에서 로그 경고를 발생시키고 `{ __invalid: true }` 로 처리 (현재의 조용한 통과 대신). 또는 해당 분기 자체를 제거하고 `enc:` prefix 없는 경우를 항상 invalid 처리.

---

## Medium

### [M-1] SSRF — `mall_id` 로 구성된 URL 에 추가 경로 검증 부재

- **위치**: `integration-oauth.service.ts:49-54`, `cafe24-api.client.ts:645-661`
- **상세**:
  `mall_id` 는 `/^[a-z0-9-]{3,50}$/` 로 검증되어 SSRF 경로 인젝션을 잘 차단하고 있다 (알파벳 소문자, 숫자, 하이픈만 허용). 그러나 `buildUrl` 에서 `cleanPath = path.replace(/^\//, '')` 로 leading slash 만 제거하고 path에 `../` 같은 traversal 이 포함될 경우의 방어가 없다. `path` 는 metadata 테이블에서 오므로 사용자가 직접 제어할 수 없어 실제 위험은 낮다. 그러나 메타데이터 오염 시나리오(dependency tampering 등)에서 URL traversal 이 가능.
- **권장 fix**: `buildUrl` 에서 최종 URL 의 `hostname` 이 `*.cafe24api.com` 인지 확인하는 assertion 추가 (현재 `new URL(...)` 을 사용하므로 `url.hostname.endsWith('.cafe24api.com')` 체크 1줄 추가로 충분).

---

### [M-2] `installToken` 이 application log 에 prefix(앞 6자)로 노출됨 — brute-force surface

- **위치**: `integration-oauth.service.ts:1329`, `1352`
- **상세**:
  회복 흐름에서 `url_token_prefix` (앞 6자) 와 `db_token_prefix` (앞 6자) 가 warn/log 로 기록된다. 22자 base64url token 의 앞 6자를 알면 가능한 공간이 36자리(62^16 → 62^16 에서 62^10 으로 감소). 직접 공격 가능성은 낮으나, log aggregator 접근 권한 보유자가 brute-force 범위를 좁힐 수 있다.
- **권장 fix**: 로그에서 token prefix 를 완전히 제거하거나, 운영 용도라면 Integration ID(UUID) 만으로 진단에 충분하므로 token 관련 필드 제거.

---

### [M-3] `handleInstall` 의 timestamp 검증이 단조증가(monotonic) 보장 없음 — replay 재전송 가능성

- **위치**: `integration-oauth.service.ts:1150-1158`
- **상세**:
  현재 timestamp ±5분 윈도우만 체크하며 이미 사용된 timestamp 를 캐시하거나 nonce를 추적하지 않는다. 공격자가 10분 내에 동일한 `timestamp + hmac` 를 반복 전송하면 HMAC 이 유효한 한 모두 통과된다. Cafe24 의 timestamp 는 Unix 초 단위이며, 동일 요청이 10분 안에 재전송되면 replay 가 성공한다. 주 영향은 OAuth state 생성이 반복되고 사용자에게 authorize URL 이 여러 번 반환됨 — 직접적 권한 탈취보다는 남용 가능성.
- **권장 fix**: 사용된 `timestamp:hmac` 조합을 Redis 에 10분 TTL 로 저장해 replay 차단. 또는 이 이슈의 영향이 OAuth state 중복 생성에 그침을 문서화하고 허용 위험으로 수용 (Cafe24 는 state TTL 내 중복 사용 방지를 자체 보장하지 않음).

---

### [M-4] `consumePreviewToken` 이 workspaceId/userId 검증 실패 시 토큰을 이미 소비한 후 403 반환

- **위치**: `integration-oauth.service.ts:773-779`
- **상세**:
  DELETE … RETURNING 으로 토큰을 소비한 뒤 ownership 검증을 수행한다:
  ```ts
  const queryResult = await this.dataSource.query('DELETE FROM ... WHERE preview_token = $1 RETURNING *', [previewToken]);
  // ...
  if (preview.workspaceId !== workspaceId || preview.userId !== userId) {
    throw new BadRequestException({ code: 'OAUTH_PREVIEW_OWNERSHIP', ... });
  }
  ```
  소유자가 아닌 사람이 올바른 preview_token 을 추측·탈취해 요청하면 토큰이 소비되어 정상 소유자가 더 이상 사용 불가 (DoS). 반면 `OAUTH_PREVIEW_OWNERSHIP` 에러 자체는 토큰 존재 여부를 노출하지 않으므로 enumeration 위험은 제한적이다.
- **권장 fix**: DELETE 쿼리에 `AND workspace_id = $2 AND user_id = $3` 조건을 추가해 ownership 검증을 DB 레벨로 이동. 소유자 불일치 시 deleted row 가 0 건이 되어 `OAUTH_PREVIEW_INVALID` 로 처리.

---

### [M-5] XSS — `renderCallbackHtml` 에서 `input.error` 가 `htmlEscape` 되나, `provider` 필드는 ALLOWED_OAUTH_PROVIDERS 필터 이전 경로에서 HTML 로 직접 삽입될 수 있음

- **위치**: `oauth-callback.template.ts:78-81`, `third-party-oauth.controller.ts:201-214`
- **상세**:
  컨트롤러에서 provider 가 allowlist 에 없으면 직접 `renderCallbackHtml({ status: 'error', provider, error: '...' }, targetOrigin)` 을 호출한다. `renderCallbackHtml` 의 body 생성:
  ```ts
  const body = input.status === 'success' ? '...' : 'OAuth failed: ' + htmlEscape(input.error);
  ```
  `input.error` 는 escape 되지만 `input.provider` 는 `payload` 객체에 포함되어 `jsonForScript` 를 통해 직렬화된다. `jsonForScript` 는 `<`, `>`, `&`, `'`, `"` 를 `\uXXXX` 이스케이프하므로 script context 탈출 방지는 된다. 그러나 JSON 직렬화된 payload 가 `JSON.parse()` 후 `postMessage` 로 전달되는 구조는 안전하다. 이 항목은 현재 구현 기준으로 false-positive 에 가깝지만, 미래 템플릿 수정 시 html body 에 `input.provider` 를 직접 삽입하면 XSS 가 될 수 있다.
- **권장 fix**: `renderCallbackHtml` 함수 서명에서 `provider` 를 body 텍스트로 렌더링할 경우 반드시 `htmlEscape` 를 거치도록 주석 강화. 현재 `body` 문자열에는 `provider` 가 포함되지 않으므로 즉시 위험은 없음.

---

### [M-6] `sanitizeSid` 가 8자로 잘라서 UUID collision 공간이 좁음 — 도구 이름 충돌

- **위치**: `cafe24-mcp-tool-provider.ts:571-573`
- **상세**:
  ```ts
  export function sanitizeSid(integrationId: string): string {
    return integrationId.slice(0, 8).replace(/[^a-z0-9]/gi, '_');
  }
  ```
  UUID v4 의 앞 8자는 하이픈 포함 `xxxxxxxx` 형식으로 총 8자. 두 Integration 의 UUID 앞 8자가 같으면 같은 sid 를 공유해 도구 이름이 충돌하고, 한 사용자의 AI Agent 가 다른 Integration 의 도구를 호출할 수 있다. UUID 충돌 확률은 낮지만(Birthday problem, 수천 개 이상에서 실용적 위험 시작) SaaS 규모에서는 발생 가능.
- **권장 fix**: `integrationId.replace(/-/g, '').slice(0, 16)` 처럼 하이픈 제거 후 더 긴 prefix 사용, 또는 UUID 전체의 CRC32 hex 같은 결정적 hash 사용. `McpToolProvider.sidFor` 와 동일한 규칙을 공유해야 하므로 두 곳을 함께 변경.

---

## Low / 개선 권고

### [L-1] `lastError` 컬럼에 `encryptedJsonTransformer` 적용 — 과도한 암호화 vs. 진단 가치 트레이드오프

- **위치**: `integration.entity.ts:111-117`
- **상세**:
  `last_error` JSONB 컬럼에도 `encryptedJsonTransformer` 가 적용되어 있다. 이는 운영자가 DB 에서 직접 에러를 조회하거나 분석할 때 불편하다. 에러 메시지는 이미 `sanitizeLastErrorMessage` 로 마스킹되므로 추가 암호화의 보안 이득이 크지 않다. 한편 마스킹이 불완전할 경우(C-2)의 방어 계층으로 기능하므로 C-2 가 해결되기 전까지는 현재 설정을 유지한다.
- **권장 fix**: C-2 해결 후 운영 편의와 보안을 재검토해 필요 시 제거.

---

### [L-2] rate limit throttle 이 IP 기반 — 공유 IP 환경에서 오탐 가능

- **위치**: `third-party-oauth.controller.ts:52`, `168`
- **상세**:
  `@Throttle({ default: { limit: 30, ttl: 60_000 } })` 는 IP 기반이다. Cafe24 Developers 의 "테스트 실행" 이 Cafe24 사내 proxy/NAT 를 통해 발생하면 많은 사용자가 같은 IP 를 공유해 정상 요청이 throttle 에 걸릴 수 있다.
- **권장 fix**: `install_token` 기반 throttle (동일 토큰 30 req/min) 을 IP 기반과 병행 적용. `X-Forwarded-For` 와 `CF-Connecting-IP` 처리 여부 확인.

---

### [L-3] `OAUTH_STUB_MODE=true` 가 `NODE_ENV=production` 에서 단순 경고로만 처리됨

- **위치**: `integration-oauth.service.ts:815-827`
- **상세**:
  ```ts
  if (process.env.OAUTH_STUB_MODE === 'true' && process.env.NODE_ENV === 'production') {
    this.logger.error('OAUTH_STUB_MODE is set in production — ignoring.');
  }
  ```
  경고 후 계속 진행하지 않고 실제 OAuth 교환을 수행하는 것은 올바른 동작이나, `NODE_ENV !== 'production'` (예: `staging`) 환경에서 `OAUTH_STUB_MODE=true` 이면 stub token 이 실제 사용자에게 반환된다. staging 에 실제 사용자 데이터가 있다면 stub 토큰으로 Integration 이 '연결됨' 상태가 되어 오해를 유발.
- **권장 fix**: `OAUTH_STUB_MODE` 가 허용되는 환경을 `NODE_ENV=test || NODE_ENV=development` 로 명시적으로 제한. `staging` 또는 그 외 환경에서는 경고를 error로 격상하고 throw.

---

### [L-4] `markAuthFailed` 에서 `integrationRepository.update` 가 `workspaceId` 없이 ID 만으로 업데이트

- **위치**: `cafe24-api.client.ts:522-539`
- **상세**:
  ```ts
  await this.integrationRepository.update(integration.id, {
    status: 'error', statusReason: 'auth_failed', lastError: { ... }
  });
  ```
  `workspaceId` 조건 없이 ID 만으로 update 한다. 코드 내에서 `integration` 객체는 이미 workspaceId 필터를 거쳐 로드된 것이므로 실제로는 안전하다. 그러나 다른 컨텍스트에서 이 메서드가 재사용되면 workspaceId 교차 오염 가능성. 방어적 코딩 관점에서 개선 가능.
- **권장 fix**: `this.integrationRepository.update({ id: integration.id, workspaceId: integration.workspaceId }, { ... })` 형태로 변경.

---

### [L-5] `handleCallbackWithErrorCapture` 에서 `readErrorMessage` 가 provider 오류 메시지를 sanitize 없이 `markIntegrationCallbackError` 에 전달

- **위치**: `integration-oauth.service.ts:671-683`
- **상세**:
  ```ts
  const message = readErrorMessage(err);
  await this.markIntegrationCallbackError(ctx.integrationId, ctx.workspaceId, errorCode, message);
  ```
  `markIntegrationCallbackError` 내부에서 `sanitizeLastErrorMessage(errorMessage)` 를 적용하므로 실질적으로 보호된다. 다만 호출 체인에서 sanitize 위치가 너무 늦고, `readErrorMessage` 자체가 provider 응답의 `r.response?.message` 를 그대로 반환한다. 현재 구조는 동작하나 체인 가시성이 낮다.
- **권장 fix**: `readErrorMessage` 반환값에 즉시 sanitize 적용하거나, `markIntegrationCallbackError` 호출부에 주석으로 "sanitize는 수신 함수에서 수행됨" 명시.

---

## 확인했지만 안전한 항목 (false-positive 방지)

1. **SQL 인젝션**: `DELETE FROM integration_oauth_state WHERE state = $1` 등 모든 raw SQL 이 parameterized query 사용. TypeORM ORM 경로도 동일. 인젝션 없음.

2. **HMAC timing-safe 비교**: `timingSafeEqual` 사용으로 timing-side-channel 방지 확인. 길이 불일치 시 catch → false 반환도 올바름.

3. **state 원자 소비**: DELETE … RETURNING 으로 state row 를 원자적으로 소비해 replay attack 차단. PostgreSQL 트랜잭션 시맨틱 상 단일 winner 보장.

4. **preview_token 원자 소비**: 동일 패턴 적용. `tmp_` prefix 로 구분 가능하며 16바이트 랜덤(128-bit) 엔트로피 충분.

5. **install_token 엔트로피**: `randomBytes(16).toString('base64url')` → 128-bit 엔트로피. 22자 base64url. INSTALL_TOKEN_PATTERN 으로 형식 검증.

6. **OAuth state 엔트로피**: `randomBytes(24).toString('hex')` → 192-bit. CSRF 방어에 충분.

7. **XSS in HTML templates**: `htmlEscape` + `jsonForScript` 모두 `<`, `>`, `&`, `'`, `"` 를 이스케이프. inline CSS only. 외부 스크립트/리소스 없음.

8. **mall_id SSRF 방어**: `/^[a-z0-9-]{3,50}$/` 정규식이 protocol-relative (`//`), path traversal (`../`), port (`:`) 등을 모두 차단.

9. **Provider 화이트리스트**: `ALLOWED_OAUTH_PROVIDERS = ['google', 'github', 'cafe24']` 외 provider 는 즉시 거부.

10. **크로스 워크스페이스 격리**: `handleCallback` 에서 Integration 조회 시 `workspaceId` 를 state row 에서 읽어 필터(`where: { id, workspaceId }`). workspaceId 는 사용자가 직접 제공하지 않고 server-side state 에서 결정.

11. **BullMQ jobId 중복 방지**: `jobId = integrationId` 로 동일 Integration 의 동시 refresh 를 클러스터 수준에서 직렬화. 토큰 rotation 경쟁 조건 방지 확인.

12. **credentials JSONB 암호화**: `Integration.credentials` 컬럼에 `encryptedJsonTransformer` 적용. raw SQL 경로(DELETE … RETURNING)에서 `normalizeRawStateRow`/`normalizeRawPreviewRow` 가 명시적 `decryptJson` 호출로 보상.

13. **scope 기반 AI Agent 도구 필터링**: `extractGrantedScopes` 로 실제 부여된 scope 만 도구로 노출. 403 발생 방지 + 불필요한 auth_failed 상태 전이 방지.

---

## 종합 의견

Cafe24 통합의 전반적인 보안 설계는 견고하다. timingSafeEqual HMAC, atomic DELETE…RETURNING state/preview 소비, workspaceId 기반 크로스 테넌트 격리, credentials JSONB 암호화, 엔트로피가 충분한 임시 토큰 발급 등 핵심 보안 메커니즘이 올바르게 구현되어 있다. 그러나 즉시 수정이 필요한 두 가지 Critical 항목이 있다. C-1(private app client_secret 이 OAuth state row 에 잠재적으로 평문 저장)은 DB 덤프/replication 경로에서 client_secret 이 노출될 수 있으며, C-2(SECRET_LEAK_PATTERNS 의 마스킹 누락 + refreshAccessToken 에서 raw error 가 lastError 에 기록되는 경로)는 운영 DB 에 token/secret 조각이 잔류할 수 있다. High 항목으로는 tryRecoverByMallId 의 workspaceId 미필터링(H-2)이 타 테넌트 Integration ID 누출과 DB DoS 증폭 위험을 가지며, open redirect 방어 부재(H-3)와 운영 로그의 비위생화(H-4)도 이번 sprint 내 해결을 권장한다.
