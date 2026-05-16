# Cafe24 Requirement Review (2026-05-16)

---

## Critical (spec 와 구현 명백한 불일치)

### [CRITICAL-1] 만료 스캐너가 Cafe24 `pending_install` 행을 expiry 알림 대상으로 포함 가능

- **위치**: `integration-expiry-scanner.service.ts` `run()` 메서드, 라인 282-285
- **spec 인용**: spec §11.1 "대상: Integration WHERE token_expires_at IS NOT NULL". spec §2.4 "Need attention 배너: `status IN (expired, error)` OR `token_expires_at <= now() + 7d`. `pending_install` 은 ... 배너에서 제외한다".
- **구현 동작**: `run()` 의 쿼리 조건은 `status: Not(In(['expired', 'error']))` AND `tokenExpiresAt: LessThanOrEqual(horizon)`. `pending_install` 은 status 필터에서 명시 제외되지 않으므로, 만약 `pending_install` 행이 `tokenExpiresAt` 를 가지면 (현재는 NULL — 완전 연결 전이므로 보통 NULL 이지만 재사용 분기에서 극히 드문 엣지가 있을 수 있음) 7d/3d/0d 알림이 발사된다.
- **현재 실제 위험도**: `pending_install` 의 `tokenExpiresAt` 은 정상 흐름에서 NULL 이므로 즉각 발화 가능성은 낮다. 그러나 **spec 가 명시한 필터(`status != 'pending_install'`)가 구현에 없다**는 점에서 spec 불일치.
- **제안**: `run()` 의 `where` 절에 `status: Not(In(['expired', 'error', 'pending_install']))` 추가. 또는 `classifyThreshold` 전에 `integration.status === 'pending_install'` 이면 skip.

---

### [CRITICAL-2] `connected → error(network) after 3 consecutive failures` 전이가 구현 없음

- **위치**: `cafe24-api.client.ts` 전체 + `cafe24.handler.ts` 전체
- **spec 인용**: spec §6 상태 전이 표 `connected → error(network) | 노드 실행 중 커넥션 실패가 3회 연속`
- **구현 동작**: `Cafe24ApiClient` 는 네트워크 오류 시 즉시 `Cafe24TransportFailedError` 를 throw 한다. 연속 실패 카운터가 없다. 핸들러도 transport 실패를 `CAFE24_TRANSPORT_FAILED` error 포트로 출력하고 status 변경을 하지 않는다.
- **분석**: 인증 실패(401/403)는 `markAuthFailed` 로 `error(auth_failed)` 전이가 구현돼 있다. rate-limit 소진은 error 포트로 출력만 한다. 그러나 "3회 연속 네트워크 실패 → `error(network)`" 전이는 코드 어디에도 존재하지 않는다. spec 의 상태 전이 표에 명확히 존재하는 분기다.
- **제안**: 연속 실패 카운터를 In-memory(per-integration) 또는 DB 필드로 관리하고 3회 연속 후 `markStatus('error', 'network')` 호출. 또는 spec 에서 이 전이를 명시적으로 "미구현 / 후속 plan" 으로 defer 처리하도록 spec 을 갱신.

---

### [CRITICAL-3] `missingScopes` 경고가 로그만 남기고 Integration status 를 `error(insufficient_scope)` 로 전이하지 않음

- **위치**: `integration-oauth.service.ts` 라인 969-975 (token exchange 후 missing scope 감지)
- **spec 인용**: spec §6 상태 전이 표 `connected → error(insufficient_scope) | 노드 실행 중 403 + 서비스별 missing_scope 시그널`. spec §9.4 응답 코드 `INSUFFICIENT_SCOPE (403) — 노드 실행 중 감지 시 Integration.status 도 갱신`
- **구현 동작**: `exchangeCodeForToken` 에서 `missingScopes.length > 0` 이면 `logger.warn` 만 하고 Integration status 나 statusReason 을 변경하지 않는다. 더 중요한 것은 **노드 실행 중 403 에서 `missing_scope` 시그널을 감지하는 코드가 없다**: `Cafe24ApiClient` 의 403 처리는 모두 `markAuthFailed(error, auth_failed)` 로 귀결되며, `insufficient_scope` 로 구분하는 로직이 없다.
- **제안**: Cafe24 403 응답 body 의 `error.code` 또는 `error.message` 에서 scope-관련 키워드(`insufficient_scope`, `INVALID_SCOPE`, `mall.read_` 등) 를 감지해 `markAuthFailed` 대신 별도 `markInsufficientScope` 호출로 분기. spec 이 정의한 `error(insufficient_scope)` status 전이를 구현.

---

## High (누락된 엣지케이스)

### [HIGH-1] `handleInstall` 의 `tryRecoverByMallId` 회복 흐름이 spec 에 없거나 보안 검토 부재

- **위치**: `integration-oauth.service.ts` 라인 1182-1207
- **spec 인용**: spec §9.8 "식별 전략: `install_token` 으로 단일 row 조회. 토큰 미존재 시 `404 CAFE24_INSTALL_INVALID_TOKEN`". spec §9.8 "옛 in-memory 100건 스캔 + trial HMAC 방식은 폐기".
- **구현 동작**: `installToken` 직접 매칭 실패 시 `tryRecoverByMallId` 를 호출해 mall_id 스캔 + trial HMAC 검증으로 회복을 시도한다. 코드 주석은 이것이 "stale URL" 대응이라고 설명하지만, spec 의 "폐기" 기술과 방향이 상충한다. spec ## Rationale "install_token mismatch 회복 흐름" 항이 있다고 코드가 시사하지만 실제 spec 본문에는 해당 Rationale 항목이 존재하지 않는다 (spec 을 확인한 범위 내에서).
- **문제**: (a) spec 에 명시되지 않은 회복 흐름이 production 코드에 존재한다. (b) `tryRecoverByMallId` 가 단일 HMAC 매칭 시 그 row 를 신뢰하는 흐름이므로, Cafe24 Developers 가 같은 mall_id 에 대해 여러 앱을 등록하는 비정상 환경에서 오매칭 가능성이 있다. (c) 회복 흐름이 활성화되는 조건과 그 보안 전제가 spec 에 문서화되어 있지 않다.
- **제안**: `tryRecoverByMallId` 존재 및 보안 전제를 spec §9.8 또는 ## Rationale 에 명시. 또는 회복 흐름을 제거하고 spec 대로 404 반환.

### [HIGH-2] `connected → expired` 전이가 스캐너에서 token refresh 실패를 반영하지 않음

- **위치**: `integration-expiry-scanner.service.ts` `run()`, `cafe24-api.client.ts` `refreshAccessToken()`
- **spec 인용**: spec §6 `connected → expired | 매일 스캐너 또는 노드 실행 중 토큰 갱신 실패 (refresh fail)`
- **구현 동작**: `refreshAccessToken` 이 401/403 로 실패하면 `markAuthFailed` 로 `error(auth_failed)` 로 전이한다. 그런데 spec 은 "갱신 실패 시 `expired`" 라고 표기하고, `error(auth_failed)` 와 구분한다. 스캐너의 `0d` 처리에서만 `status='expired'` 로 전이하며, refresh 실패 경로에서는 `expired` 대신 `error(auth_failed)` 가 나온다.
- **분석**: spec §10.5 "갱신 실패 시: 상태 `expired` + `integration_expired` 알림 생성"과 구현의 `markAuthFailed`(→ `error(auth_failed)`) 사이에 용어 혼재가 있다. 사용자는 `error(auth_failed)` 를 보게 되는데, spec §6 은 이 경우를 `expired` 로 정의한다. 실용적으로 두 상태가 유사하나, UI 배지·재인증 안내 문구가 달라진다.
- **제안**: spec §6 / §10.5 에서 refresh 실패 전이를 `error(auth_failed)` 로 통일하거나, 구현을 `expired` 로 변경하거나, 두 경로를 명확히 구분하여 spec 에 반영.

### [HIGH-3] `CAFE24_INSTALL_MISSING_PARAMS` 에러 코드가 spec 에 정의되어 있지 않음

- **위치**: `third-party-oauth.controller.ts` 라인 101-105
- **spec 인용**: spec §9.4 공통 응답 포맷 에러 코드 목록 — `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `CAFE24_INSTALL_REPLAY` 만 명시. `CAFE24_INSTALL_MISSING_PARAMS` 는 없음.
- **구현 동작**: `mall_id`, `timestamp`, `hmac` 누락 시 `CAFE24_INSTALL_MISSING_PARAMS (400)` 을 반환한다.
- **제안**: spec §9.4 에 `CAFE24_INSTALL_MISSING_PARAMS (400)` 을 추가하거나, 구현에서 `CAFE24_INSTALL_REPLAY` 또는 `CAFE24_INSTALL_INVALID_HMAC` 로 병합 (단, 의미 구분을 위해 spec 추가가 바람직).

### [HIGH-4] PR #56 의 `REFRESH_PROACTIVE_THRESHOLD_DAYS` (10일) 이 spec 에 미명시

- **위치**: `cafe24-token-refresh.constants.ts` (import 됨), `integration-expiry-scanner.service.ts` 라인 178-179
- **spec 인용**: spec §11 / data-flow/integration.md — `cafe24-background-refresh` 잡 존재는 언급되나, 10일 임계치가 spec 에 명시된 위치를 찾을 수 없다.
- **구현 동작**: `REFRESH_PROACTIVE_THRESHOLD_DAYS` (10일) 로 `lastRotatedAt < now - 10d` 인 연결된 Cafe24 통합을 배경 갱신 대상으로 선정한다. 코드 주석은 "refresh_token 14일 유효 - 4일 마진" 근거를 설명하나 spec 문서에는 이 정책이 부재하다.
- **제안**: spec §11 또는 data-flow/integration.md 에 "Cafe24 background refresh 10일 임계" 및 근거(14d TTL - 4d 마진)를 명시.

### [HIGH-5] `createPrivatePendingIntegration` 의 중복 체크가 `public` app 이미 연결된 동일 mall 을 허용

- **위치**: `integration-oauth.service.ts` 라인 1016-1031
- **spec 인용**: spec §9.2 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409) — 동일 (workspaceId, mall_id) 에 이미 cafe24 Integration (app_type 무관 — public/private 모두) 이 존재`.
- **구현 동작**: `sameMall` 필터가 `row.credentials?.app_type === 'private'` 조건을 AND 로 포함한다 (라인 1022). `app_type='public'` 으로 이미 연결된 동일 mall_id 에 대해 Private 앱 begin 을 시도하면 중복 감지가 실패하고 새 `pending_install` 행이 삽입된다. V046 partial UNIQUE index 가 최종 방어선이 되지만, index 제약 조건이 `app_type` 까지 커버하는지 확인 필요. spec 은 "app_type 무관" 으로 명시한다.
- **제안**: `sameMall` 필터에서 `app_type` 조건 제거. 모든 `serviceType='cafe24'` + 같은 `mall_id` 행을 alreadyConnected 대상으로 포함.

---

## Medium (개선 권고)

### [MEDIUM-1] MCP provider 에서 error 포트 출력 시 `output.response` 보존 없음 (spec 5.3.1 불일치)

- **위치**: `cafe24-mcp-tool-provider.ts` `execute()` 라인 303-366
- **spec 인용**: spec §5.3.1 "4xx/5xx 의 경우 서버가 돌려준 응답 body 는 `output.response` 에 보존 (디버깅)".
- **구현 동작**: MCP 경로에서 HTTP 4xx/5xx 응답(status >= 400 but not thrown as error)은 `content: JSON.stringify({ status, response: result.body })` 로 body 가 포함되나, `Cafe24AuthFailedError`(401/403) 처럼 throw 경로로 나온 에러는 `classifyError` 가 `{ code, message }` 만 반환하고 `responseBody` 를 포함하지 않는다.
- **분석**: 노드 핸들러에서는 `mapClientErrorToOutput` 이 `Cafe24AuthFailedError.responseBody` 를 전달하는 반면, MCP 경로는 body 정보를 유실한다. 디버깅 UX 차이.
- **제안**: `classifyError` 에 `responseBody?: unknown` 를 추가하고, `Cafe24AuthFailedError` 케이스에서 `err.responseBody` 를 포함해 content JSON 에 `response` 키로 전달.

### [MEDIUM-2] `buildRequestParts` 에서 path placeholder 미치환 시 silently 부정확한 URL 생성

- **위치**: `cafe24.handler.ts` `buildRequestParts()` 라인 275-315
- **spec 인용**: spec §5.8 pre-flight throw 목록에 "path placeholder 미치환" 이 명시되어 있지 않음.
- **구현 동작**: `path = 'products/{product_no}'` 인데 `fields.product_no` 가 누락되면(requiredFields 에 없는 경우) `{product_no}` 가 URL 에 그대로 남아 Cafe24 에 `https://.../products/{product_no}` 로 요청이 간다. Cafe24 가 404 또는 4XX 를 반환하고 `CAFE24_404` / `CAFE24_4XX` 에러 포트로 라우팅된다.
- **분석**: `requiredFields` 에 path parameter 를 포함해야 하는 메타데이터 규약으로 완화되나, 메타데이터 오류 시 명확한 에러가 아닌 silent 오동작.
- **제안**: `buildRequestParts` 후 path 에 `{...}` 가 남아있으면 `CAFE24_UNKNOWN_OPERATION` 또는 새 코드 `CAFE24_UNRESOLVED_PATH_PARAM` 으로 throw.

### [MEDIUM-3] `Cafe24Handler.validate()` 에서 `operation` 존재 여부 미검증

- **위치**: `cafe24.handler.ts` `validate()` 라인 66-89
- **spec 인용**: spec §5.8 "warningRule (캔버스 배지)" 항목에 `resource` 검증은 validate 에서 하도록 명시. `operation` 검증은 `handler.execute` 로 명시됨.
- **구현 동작**: `validate()` 에서 `operation` 이 존재하는지 메타데이터 조회를 하지 않는다. `resource` 의 enum 범위 검증은 있으나 `(resource, operation)` 쌍의 유효성은 execute 진입 후에야 알 수 있다.
- **분석**: spec 이 `handler.validate` 를 이렇게 설계한 의도가 있으므로 Critical 은 아니지만, 캔버스 배지가 잘못된 operation 선택에 즉시 경고를 못 주는 UX 차이가 있다.
- **제안**: spec 과 일치하도록 현재 동작 유지 또는 `validate` 에서 메타데이터 lookup 추가 시 spec §5.8 를 함께 갱신.

### [MEDIUM-4] `markIntegrationCallbackError` 가 `statusReason` 을 snake_case 아닌 원본 에러 코드 lowercase 로 저장

- **위치**: `integration-oauth.service.ts` `markIntegrationCallbackError()` 라인 724
- **spec 인용**: spec §6 `status_reason` 값: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` (모두 snake_case 명시).
- **구현 동작**: `integration.statusReason = errorCode.toLowerCase()`. `OAUTH_TOKEN_EXCHANGE_FAILED` → `oauth_token_exchange_failed` 는 일치. 그러나 `CAFE24_INSTALL_FAILED`, `OAUTH_CALLBACK_FAILED` 같은 fallback 코드가 errorCode 로 들어오면 spec 에 없는 `statusReason` 값이 저장될 수 있다.
- **제안**: `statusReason` 허용 값을 union type 으로 고정하고, 알 수 없는 코드는 `'unknown_error'` fallback 으로 처리.

### [MEDIUM-5] 만료 알림 메시지가 spec §11.2 표와 일치하지 않음

- **위치**: `integration-expiry-scanner.service.ts` `messageFor()` 라인 418-424
- **spec 인용**: spec §11.2 알림 메시지 "당일: `"<name>" has expired. Reauthorize to continue.`" (끝이 마침표).
- **구현 동작**: `"${name} has expired. Reauthorize to continue using it."` — "using it." 이 추가되어 있다. 사소하지만 spec 과 다름.
- **제안**: spec 문구와 통일하거나, spec 을 현재 구현 문구로 갱신.

### [MEDIUM-6] `OAUTH_STUB_MODE` 처리 — production guard 가 에러 처리를 건너뜀

- **위치**: `integration-oauth.service.ts` `exchangeCodeForToken()` 라인 820-827
- **구현 동작**: `OAUTH_STUB_MODE=true` + `NODE_ENV=production` 이면 `logger.error` 만 남기고 **stub 모드를 활성화하지 않고 계속 진행한다**. 이것은 올바른 동작이다. 그러나 `logger.error` 후 실제 exchange 가 이루어지므로, 잘못된 환경 설정이 조용히 무시되는 구조다.
- **제안**: production 에서 `OAUTH_STUB_MODE=true` 시 `logger.error` 에 더해 알림/메트릭 발사를 고려. 현재 구현은 기능적으로는 안전하지만, 설정 오류 탐지가 어렵다.

### [MEDIUM-7] `sanitizeSid` 가 UUID dash 를 `_` 로 치환 — 충돌 가능성

- **위치**: `cafe24-mcp-tool-provider.ts` 라인 571-573
- **spec 인용**: spec §8.1 도구 이름 매핑 `mcp_<int8자>__<operation_id>`.
- **구현 동작**: `integrationId.slice(0, 8).replace(/[^a-z0-9]/gi, '_')`. UUID 앞 8자는 hex digit 이므로 실제로는 alphanumeric 만 나오지만, `replace` 가 대소문자를 `_` 로 치환하지 않으므로 대문자 hex (A-F) 가 그대로 남는다. MCP Client 레이어가 이를 올바르게 처리하는지 별도 검증 필요.
- **분석**: spec 은 sid 형식에 대해 "int8자" 라고 표기하나 실제 sanitize 함수는 대소문자 허용. McpToolProvider 의 `sidFor` 와 동일 로직인지 cross-check 권장.

---

## Spec 갱신 권고 (구현이 spec 보다 ahead)

### [SPEC-1] `tryRecoverByMallId` 회복 흐름 — spec 에 없음

구현에 존재하나 spec §9.8 에 명시되지 않은 `install_token mismatch recovery` 흐름. 코드 주석이 "spec/2-navigation/4-integration.md ## Rationale `Cafe24 install_token mismatch 회복 흐름`" 을 참조하나, 해당 Rationale 항목을 spec 에서 확인할 수 없었다. spec 에 추가 또는 코드 주석에서 참조 제거 필요.

### [SPEC-2] BullMQ `cafe24-background-refresh` 잡 및 10일 임계치 — spec §11 에 미명시

`REFRESH_PROACTIVE_THRESHOLD_DAYS = 10` 상수와 `JOB_CAFE24_BACKGROUND_REFRESH` 잡이 구현에 존재하나 spec §11.1 의 스캐너 잡 목록 (`connected-expiry` / `pending-install-ttl` / `usage-log-prune`) 에 누락됨. 실제로는 4개 잡이 운영 중이다. spec §11 및 data-flow/integration.md §1.4 갱신 권고.

### [SPEC-3] PR #56 의 큐 기반 Cafe24 refresh — spec §9.6 trade-off 해소 여부

spec §9.6 Rationale 는 "Redis 기반 분산 mutex 도입은 별도 spec 으로" 라고 미결 사항으로 남겼다. PR #56 에서 BullMQ 큐 기반 `jobId` dedup 으로 클러스터 전체 직렬화가 실제 구현됐으므로, spec §9.6 을 "BullMQ 큐 jobId dedup 으로 해소됨 — Redis mutex 별도 도입 불필요" 로 갱신 권고.

### [SPEC-4] `CAFE24_INSTALL_MISSING_PARAMS` 에러 코드 — spec §9.4 에 부재

[HIGH-3] 참조.

---

## 종합 의견

Cafe24 통합의 핵심 흐름 — OAuth 인증, token 갱신, rate limit 처리, install_token 기반 Private 앱 흐름, MCP bridge — 은 전반적으로 spec 을 충실히 따른다. 특히 `Cafe24ApiClient` 의 레이어 분리(mutex, backoff, atomic refresh), `handleInstall` 의 status 분기, `Cafe24McpToolProvider` 의 scope 기반 사전 필터링은 spec 의도를 잘 구현했다.

그러나 다음 세 가지 요구사항 불이행이 발견되었다. (1) `error(network)` 상태 전이가 완전히 누락됐다. spec 은 3회 연속 네트워크 실패 시 이 상태로 전이하도록 명시하지만 구현에 카운터도 전이 코드도 없다. (2) `error(insufficient_scope)` 전이가 누락됐다. 401/403 은 모두 `auth_failed` 로 일괄 처리되며, scope 부족을 별도로 식별하지 않는다. (3) 만료 스캐너가 `pending_install` 을 명시적으로 제외하지 않아 spec 과 불일치한다.

추가로 `createPrivatePendingIntegration` 의 중복 방지가 spec 이 정의한 "app_type 무관" 조건을 구현하지 않아 public + private 혼재 시나리오에서 중복 행이 생길 수 있다. 10일 배경 갱신 임계치와 install_token mismatch 회복 흐름은 구현이 spec 보다 ahead 인 케이스로, spec 갱신이 필요하다.

---

## 위험도

**HIGH**
