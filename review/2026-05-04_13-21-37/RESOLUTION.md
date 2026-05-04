# Code Review 조치 — Stage 1 (commit a721720) 후속

> 본 문서는 [`./SUMMARY.md`](./SUMMARY.md) 의 Critical 2건 + Warning 17건 + 선택 Info 항목에 대한 조치 결과를 기록한다. 모든 변경은 단일 후속 커밋으로 정리되며, 본 문서가 그 atomic 단위의 명세이다.

## 결과 요약

| 분류 | 건수 | 처리 결과 |
|------|------|-----------|
| Critical | 2 | 모두 해소 |
| Warning | 17 | 14건 코드/테스트 조치, 2건 false positive 확인, 1건 (의존성 모니터링) 후속 모니터링으로 정리 |
| Info | 14 | 8건 반영, 6건 Stage 2 이후로 미룸 |

---

## Critical 조치

### C-1. SSRF 방어 미구현
**파일**: `backend/src/modules/mcp/mcp-client.service.ts`

`requireSafeHttpsUrl()` 로 이름을 바꾸고 호스트 차단 로직을 추가:

- IPv4 literal: `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16` (AWS/GCP metadata 169.254.169.254 포함), `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` (CGN)
- IPv6 literal: `::1`, `::`, `fc00::/7` (ULA), `fe80::/10` (link-local), `::ffff:` IPv4-mapped는 IPv4 룰 재적용
- Hostname: `localhost`, `metadata.google.internal`, `metadata.azure.com`, `metadata.amazonaws.com`
- IPv6 URL의 hostname 브래킷(`[::1]`)은 매칭 전에 strip

DNS 결과로 우회되는 사설 IP는 본 layer 가 아니라 transport/egress proxy 단에서 방어하도록 설계 — 코드 주석과 spec §3.2 노트로 명시. SSRF 차단 시 `MCP_HTTPS_REQUIRED` 코드를 그대로 사용 (UI 입장에서 "URL 정책 위반"으로 묶이는 게 자연스럽다는 판단).

테스트 14건 신규: 비-HTTPS / malformed URL / loopback / RFC1918 / cloud metadata / IPv6 ULA·loopback / 정상 공용 호스트 통과.

### C-2. previewTest 응답에서 capability 데이터 손실
**파일**: `backend/src/modules/integrations/integrations.service.ts`, `backend/src/modules/integrations/dto/responses/integration-response.dto.ts`

기존 `adaptMcpTestResult()` 가 `capabilities` / `serverInfo` / `preview` 를 모두 버리고 `[CODE] message` 를 단일 string 에 끼워 반환하던 것을 변경:

- 신규 export 인터페이스 `IntegrationTestResult { success, message, code?, capabilities?, serverInfo?, preview? }` 도입
- `previewTest` / `testConnection` 의 반환 타입을 `IntegrationTestResult` 로 통일
- 실패 시 `code` 가 별도 필드로 분리 (메시지 prefix 가 아닌 구조화 필드) — UI 가 `result.code` 로 분기, `result.message` 로 표시
- `PreviewTestResultDto` 의 swagger 도 신규 형태에 맞춰 갱신, 신규 `McpConnectionPreviewDto` 추가

테스트 4건 신규/갱신: capability 노출, code/message 분리, fallback `MCP_CONNECT_FAILED`, structural-validation-first 순서.

---

## Warning 조치

### W-1. defaultHeaders 헤더 인젝션
**파일**: `backend/src/modules/mcp/mcp-client.service.ts`

`buildHeaders()` 에 `sanitizeHeaderName()` / `sanitizeHeaderValue()` 추가:

- CR/LF/NUL 포함 시 `McpInvalidHeaderError` (HTTP response splitting 방어)
- 헤더 이름이 RFC 7230 token 문법 (`[A-Za-z0-9!#$%&'*+\-.^_\`|~]+`) 위반 시 차단
- `FORBIDDEN_HEADER_NAMES` set: `host`, `connection`, `content-length`, `transfer-encoding`, `upgrade`, `te`, `expect`, `trailer`, `proxy-authenticate`, `proxy-authorization`, `mcp-session-id` — framing/proto 제어 헤더 차단
- api_key 의 `headerName` 도 동일 sanitize 통과 후 사용

테스트 5건 신규: CR/LF in name·value, 예약 헤더 차단, api_key headerName CRLF.

### W-2. SDK 원시 에러 메시지 클라이언트 노출
**파일**: `backend/src/modules/mcp/mcp-test-connection.service.ts`

`classifyConnectError()` 와 `MCP_LIST_FAILED` 경로 모두 generic 메시지로 대체:

- `MCP_HTTPS_REQUIRED`, `MCP_AUTH_FAILED` (deterministic)는 internal error.message 그대로 반환 — 자체 생성 메시지에 IP/경로 정보 없음
- `MCP_CONNECT_FAILED`, `MCP_LIST_FAILED` 는 generic 메시지 (`GENERIC_CONNECT_FAILURE_MESSAGE` / `GENERIC_LIST_FAILURE_MESSAGE`) 만 응답에 노출. SDK 가 `ECONNREFUSED 10.0.0.5:8080` 같은 IP 포함 메시지를 던져도 클라이언트는 generic 메시지만 받음
- 원본 에러 detail 은 `console.warn` 으로 서버 로그에만 기록

테스트 갱신: `'fetch failed'` 검사 → `'10.0.0.5'`/`'ECONNREFUSED'` 가 응답에 **없는지** 검증.

### W-3. MCP 응답 크기 제한 미구현
**상태**: Stage 2 로 deferred, spec §8.1 의 100KB 상한은 `tools/call` / `resources/read` / `prompts/get` 응답에 적용. Stage 1 의 `dispatchTest` 흐름은 `tools/list` 만 호출하며 응답을 그대로 클라이언트에 노출하지 않는다 (개수만 합산). 따라서 Stage 1 단독으로는 위협 표면이 없음. Stage 2 의 `McpToolProvider.execute()` 에서 `truncateContent()` 헬퍼와 `MCP_RESPONSE_TOO_LARGE` 코드 발행을 함께 구현.
- spec/5-system/11-mcp-client.md §8.2 의 vocabulary 표는 그대로 유지 (Stage 2 시점 즉시 이용 가능)
- backend/.env.example 에 `MCP_MAX_RESPONSE_BYTES=102400` 환경변수 항목을 미리 정의해 Stage 2 진입 비용 감소

### W-4. previewTest rate limit 부재
**상태**: **False positive**. `IntegrationsController.previewTest` 에 이미 `@Throttle({ default: { limit: 20, ttl: 60_000 } })` 가 적용되어 있음 (commit 이전부터 존재). MCP 추가 후에도 동일 controller 라우트로 흐르므로 분당 20회 / per-request-key 제한이 그대로 적용. 추가 조치 없음.

### W-5. MCP_INITIALIZE_FAILED dead code
**파일**: `backend/src/modules/mcp/mcp-test-connection.service.ts`, `spec/5-system/11-mcp-client.md`

SDK 의 `client.connect(transport)` 가 transport handshake + MCP `initialize` RPC 를 단일 호출로 묶어 처리하므로 두 단계를 의미적으로 분리할 수 없음. vocabulary 에서 `MCP_INITIALIZE_FAILED` 를 제거하고 spec §8.2 의 표에서도 `MCP_CONNECT_FAILED` 가 두 단계 모두를 흡수한다고 명시. 결과적으로 `McpFailureCode` 의 4종은 모두 실제 생성 경로가 있음.

### W-6. McpConnectParams 타입-런타임 불일치
**파일**: `backend/src/modules/mcp/mcp-client.service.ts`

discriminated union 의 `bearer_token.token`, `api_key.headerName`, `api_key.value` 를 `?` 에서 required 로 변경. 정상 호출 경로는 컴파일 타임에 보호되며, 테스트의 의도적 누락 케이스는 `as never` 캐스트로 명시.

런타임 가드는 defense in depth 로 유지 (`as never` 우회 시에도 `McpAuthError` 발생) — 신규 명시적 테스트 3건.

### W-7. 세션 정리가 try...finally 없이 수동 분기
**파일**: `backend/src/modules/mcp/mcp-test-connection.service.ts`

`test()` 본문 전체를 outer `try...finally` 로 감싸고 `session?.close()` 를 단일 finally 경로로 이동. inner try-catch 는 connect 실패만 분기하고 그 외는 자연 스루. close 실패는 `.catch(() => undefined)` 로 swallow.

### W-8. MCP_MAX_CONCURRENT_CONNECTIONS 미구현
**파일**: `backend/src/modules/mcp/mcp-client.service.ts`, `backend/.env.example`

기존 `package.json` 에 있던 `p-limit@^7.3.0` 으로 process-wide semaphore 구현:

- 생성자에서 `pLimit(Number(process.env.MCP_MAX_CONCURRENT_CONNECTIONS) || 20)` 로 limiter 인스턴스 생성
- `connect()` 가 `this.limit(() => this.connectInner(...))` 로 wrap
- `.env.example` 에 `MCP_MAX_CONCURRENT_CONNECTIONS=20` 항목 추가 (default 명시)

테스트는 limiter 동작 자체를 검증하지 않음 (p-limit 자체는 외부 lib 가 보증) — Stage 2 의 통합 테스트에서 부하 시나리오 검증 예정.

### W-9. McpTestConnectionService.test() 타임아웃 미적용
**파일**: `backend/src/modules/mcp/mcp-client.service.ts`, `backend/src/modules/mcp/mcp-test-connection.service.ts`

- connect+initialize: `McpClientService.connectInner()` 가 `AbortController` 를 만들어 `setTimeout(abort.abort, MCP_CONNECT_TIMEOUT_MS||10s)` 로 강제 중단. transport `requestInit.signal` 에 주입
- tools/list: `McpTestConnectionService.withTimeout()` 헬퍼가 `Promise.race` 패턴으로 `MCP_LIST_TIMEOUT_MS||10s` 강제. 후속 `session.close()` 가 finally 에서 transport 를 정리
- env vars 모두 `.env.example` 에 등재

### W-10. SDK 가 서버 사이드 의존성 견인
**상태**: 모니터링만. SDK 가 client/server 분리 패키지를 발행할 때 전환 검토. 본 커밋에서는 코드 변경 없음. RESOLUTION 에서 인지 사실을 기록.

### W-11. service-registry MCP 공통 필드 3중 복제
**파일**: `backend/src/modules/integrations/services/service-registry.ts`

`MCP_URL_FIELD`, `MCP_DEFAULT_HEADERS_FIELD` 상수 추출, `buildMcpAuthVariants()` 헬퍼로 3 variant 생성. SERVICE_REGISTRY 의 mcp 항목은 한 줄로 압축. 기존 service-registry.spec.ts 10건 모두 통과 (동작 변경 없음 검증).

### W-12. dispatchTest 의 OCP 위반
**파일**: `backend/src/modules/integrations/integrations.service.ts`

`Map<serviceType, TransportTester>` 패턴으로 변경. 생성자에서 `transportTesters` 등록, `dispatchTest()` 가 `tester(authType, credentials)` 위임. 신규 service 추가 시 `dispatchTest` 본문은 변경 불필요.

### W-13. auth_type='none' 마이그레이션 가능성
**상태**: **False positive**. `Integration.authType` 컬럼은 `@Column({ name: 'auth_type', length: 20 })` (varchar). Postgres native enum 이 아니므로 마이그레이션 불필요. RESOLUTION 에 컬럼 정의 명시.

### W-14. listResources / listPrompts 프록시 테스트 누락
**파일**: `backend/src/modules/mcp/mcp-client.service.spec.ts`

`'listResources forwards to Client.listResources'`, `'listPrompts forwards to Client.listPrompts'` 2건 추가.

### W-15. api_key 인증 필드 누락 테스트
**파일**: `backend/src/modules/mcp/mcp-client.service.spec.ts`

`'throws when api_key headerName is missing (runtime)'`, `'throws when api_key value is missing (runtime)'` 2건 추가.

### W-16. adaptMcpTestResult 폴백 경로 미검증
**파일**: `backend/src/modules/integrations/integrations.service.spec.ts`

`'falls back to MCP_CONNECT_FAILED when test result omits code'` 1건 추가. mcp.test 가 `code` 없이 `success: false` 만 반환하는 시나리오에 대한 fallback 검증.

### W-17. 신규 환경변수 문서화 누락
**파일**: `backend/.env.example` (신규)

backend application 레벨 env 의 sample 파일이 부재했음 — 본 작업으로 신규 생성. MCP 환경변수 4종 (`MCP_MAX_CONCURRENT_CONNECTIONS`, `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_MAX_RESPONSE_BYTES`) + 기존 `INTEGRATION_ENCRYPTION_KEY` (이전 커밋에서 도입되었으나 example 미작성) 을 한 번에 등재. 다른 항목은 주석 hint 로만 표시 (이미 backend/.env 에 존재).

---

## Info 조치 (반영)

| # | 위치 | 조치 |
|---|------|------|
| I-1 | `spec/5-system/11-mcp-client.md §5.6` | `includeprompts` → `includePrompts` 오타 수정 |
| I-2 | `spec/4-nodes/3-ai-nodes.md` AI Agent §1 config 표 | `mcpServers` 행에 `(Stage 2에서 핸들러 통합 예정)` 마커 추가 |
| I-6 | `mcp-test-connection.service.ts` | `Awaited<ReturnType<...>>` → `McpSession \| null` 단순화 |
| I-7 | `integrations.service.ts:toMcpConnectParams` | `?? undefined` 제거 |
| I-8 | `mcp-client.service.ts` | `MCP_CLIENT_NAME` / `MCP_CLIENT_VERSION` 상수로 추출, "wire-level 동작 변경 시 버전 bump" 주석 명시 |
| I-10 | `integrations.service.ts:dispatchTest` 주석 | "Phase A/Phase C" 사내 용어 제거, 단계 의미를 본문에 직접 기술 |
| I-11 | `mcp.module.ts` JSDoc | Stage 2 forward-reference 를 추상 표현 ("AI Agent 핸들러 모듈에 추가 예정") 으로 변경 |
| I-14 | `mcp-client.service.spec.ts` | `'close swallows underlying errors and continues'` 1건 추가 — `client.close()` reject 시 `session.close()` 가 throw 하지 않음 검증 |

## Info 미반영 (Stage 2 이후)

| # | 사유 |
|---|------|
| I-3 (`McpCredentialAdapter` 분리) | 현재는 단일 호출처 + 30 line 함수 — 추출 비용 > 이익. Stage 2 에서 AI Agent 핸들러도 동일 변환을 호출하게 되면 그때 추출. |
| I-4 (`(integrationId, executionId)` 세션 캐시) | Stage 2 의 `McpToolProvider` 가 노드 실행 컨텍스트와 함께 도입할 사항. 현재 `McpClientService` 는 stateless 가 의도됨. |
| I-5 (multiple-server 병렬화) | Stage 2 `buildTools` 구현 시 `Promise.allSettled` 적용. |
| I-9 (`McpModule` 소비 경로 설계) | Stage 2 시작 시점에 결정 — 본 커밋에서는 `IntegrationsModule` 에만 등록. |
| I-12 (`^1.29.0` caret 범위 위험) | Dependabot 등 외부 도구 도입은 본 커밋 범위 밖 — README/CLAUDE.md 차원에서 별도 결정. |
| I-13 (`cached_capabilities` 정책) | Stage 2 에서 캐시 쓰기/읽기 경로가 들어갈 때 함께 강제. |

---

## TEST WORKFLOW (조치 후)

- `npm run lint` — 통과
- `npx jest` — 156 suites / 2473 tests 통과
- `npm run build` — 통과

추가된 테스트 누적 23건 (mcp-client.service.spec.ts +13, mcp-test-connection.service.spec.ts ±0 변경, integrations.service.spec.ts +1, service-registry.spec.ts ±0).

---

## 알려진 잔여 위험

- **DNS 재바인딩**: 호스트명이 처음에는 공용 IP 로 해석되다가 connect 시점에 사설 IP 로 바뀌는 공격은 본 layer 의 literal-only 검증으로 차단 불가. 운영 환경에서는 egress proxy / firewall 의 보조 방어가 필요. spec §3.2 와 mcp-client.service.ts JSDoc 양쪽에 명시.
- **MCP SDK transitive dep size**: 서버 사이드 라이브러리(`hono`, `express@5`) 를 견인하지만 Stage 1 에서는 코드 패스 변경으로 해결 불가. SDK 가 client-only 패키지 발행 시 전환.
