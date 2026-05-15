# Code Review 통합 보고서

## 전체 위험도
**HIGH** — SSRF 방어 미구현(Critical)과 `previewTest` 응답 계약 불이행(Critical)이 즉각 조치가 필요하며, 복수 에이전트가 공통 지적한 WARNING 항목들이 Stage 2 진입 전 해소되어야 한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Side Effect | **SSRF 방어 미구현** — `requireHttpsUrl()`이 `https://` scheme만 강제하고 RFC 1918·link-local·cloud metadata endpoint(`169.254.169.254`, `metadata.google.internal` 등)를 차단하지 않음. 스펙 §3.2는 "Spec API §SSRF 가이드와 동일하게 적용"을 명시하나 코드에 전혀 반영되지 않아 workspace 멤버가 내부 네트워크를 탐색 가능 | `mcp-client.service.ts:requireHttpsUrl()` | hostname 파싱 후 RFC 1918·loopback·link-local·cloud metadata IP 차단 로직 추가. DNS rebinding 방어를 위해 connect 직전 resolved IP 재검증 레이어 추가 권장 |
| 2 | API Contract / Requirement | **`previewTest` 응답에서 capability 데이터 손실** — `adaptMcpTestResult()`가 `McpTestConnectionService.test()`의 `capabilities`, `serverInfo`, `preview` 필드를 모두 버리고 `{ success, message }`만 반환. 스펙 §9가 요구하는 등록 UI의 capability 미리보기 데이터가 클라이언트에 도달하지 않음. 코드 주석 스스로도 gap을 인정함 | `integrations.service.ts:adaptMcpTestResult()` | `previewTest` 반환 타입에 `capabilities?`, `serverInfo?`, `preview?` 필드 추가 또는 MCP 전용 엔드포인트(`POST /integrations/mcp/preview-test`) 신설 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **`defaultHeaders` 헤더 인젝션** — `credentials.default_headers`를 검증 없이 직접 spread. CRLF 시퀀스 포함 시 HTTP response splitting 가능. `Host`, `Content-Length` 등 예약 헤더도 덮어쓸 수 있음 | `mcp-client.service.ts:buildHeaders()` | 헤더 이름/값 CRLF 제거, 예약 헤더 차단, 허용 패턴 화이트리스트 적용 |
| 2 | Security | **SDK 원시 에러 메시지 클라이언트 노출** — `MCP_CONNECT_FAILED` 시 `err.message`(예: `ECONNREFUSED 10.0.0.1:8080`)가 그대로 API 응답에 포함되어 내부 IP·경로·서비스 버전 노출 가능 | `mcp-test-connection.service.ts:classifyConnectError()`, `integrations.service.ts:adaptMcpTestResult()` | 에러 코드와 generic 사용자 메시지만 반환, 상세 원인은 서버 로그에만 기록 |
| 3 | Security | **MCP 응답 크기 제한 미구현** — 스펙 §8.1이 100KB/1MB 상한을 명시하나, `callTool`·`readResource`·`getPrompt` 응답에 크기 검사가 없어 악성 MCP 서버의 수백 MB 응답으로 Node.js 메모리 고갈 가능 | `mcp-client.service.ts:SessionImpl` 전체 | 응답 반환 전 JSON 직렬화 크기 측정 후 상한 초과 시 truncate 및 `MCP_RESPONSE_TOO_LARGE` 마커 추가 |
| 4 | Security | **`previewTest` rate limit 부재** — MCP 연결 테스트가 외부 TCP 연결을 여는 고비용 작업임에도 호출 빈도 제한 없음. SSRF와 결합 시 내부 네트워크 스캐닝 악용 가능 | `integrations.service.ts:dispatchTest()`, `mcp-test-connection.service.ts` | per-user rate limit(예: 분당 10회) 적용, NestJS Throttler 컨트롤러 레벨 확인 |
| 5 | Architecture / API Contract | **`MCP_INITIALIZE_FAILED` dead code** — `McpFailureCode` 타입과 스펙 §8.2에 선언되었으나 `classifyConnectError()`에서 실제로 생성되는 경로 없음. initialize 실패가 `MCP_CONNECT_FAILED`로 흡수되어 스펙-구현 불일치 발생 | `mcp-test-connection.service.ts:McpFailureCode`, `classifyConnectError()` | SDK initialize 실패를 별도 예외로 구분하거나, 타입에서 `MCP_INITIALIZE_FAILED` 제거 후 스펙 §8.2 수정 |
| 6 | Architecture / Security / Requirement | **`McpConnectParams` 타입-런타임 계약 불일치** — `bearer_token`의 `token?`, `api_key`의 `headerName?`·`value?`가 optional 선언이나 런타임에 없으면 `MccpAuthError` throw. 타입만 보고 호출 시 컴파일 타임 보호 없음 | `mcp-client.service.ts:McpConnectParams` (L12–28) | `token: string`, `headerName: string`, `value: string`으로 필수화, 테스트에서 누락 케이스 시뮬레이션은 `as any` 명시 사용 |
| 7 | Concurrency / Maintainability | **세션 정리가 `try...finally` 없이 수동 분기** — `session.close()`가 성공·실패 각 경로에 중복 존재. 이후 `await` 추가 시 세션 누수 위험. 스펙 주석("always closed")과 구조적 불일치 | `mcp-test-connection.service.ts:test()` | 내부 로직 전체를 단일 `try...finally` 블록으로 감싸 `session.close()`를 항상 단일 경로로 실행 |
| 8 | Concurrency | **`MCP_MAX_CONCURRENT_CONNECTIONS` 미구현** — 스펙 §4.3이 워크스페이스 단위 동시 connect 상한(기본 20)을 명시하나 semaphore·counter 구현 없음. 고부하 시 외부 MCP 서버에 무제한 연결 발생 가능 | `mcp-client.service.ts:connect()` | `p-limit`(이미 `package.json`에 존재) 기반 `connectionLimiter` 추가, 환경변수 `MCP_MAX_CONCURRENT_CONNECTIONS`로 제어 |
| 9 | Performance | **`McpTestConnectionService.test()` 타임아웃 미적용** — `AbortController`·`signal` 없이 순차 `await`만 존재. 응답 없는 MCP 서버 대상 시 스펙 §4.4 기본 10초를 모두 소비하여 등록 UI hang 가능 | `mcp-test-connection.service.ts:57–100` | `StreamableHTTPClientTransport`의 `requestInit.signal`에 `AbortController` 주입 또는 `Promise.race([connect, timeout(10_000)])` 적용 |
| 10 | Performance / Dependency / Side Effect | **MCP SDK가 서버 사이드 의존성 대량 견인** — 클라이언트 transport만 사용하나 `hono`, `@hono/node-server`, `express@5`, `express-rate-limit`, `jose`, `pkce-challenge` 등이 production deps로 설치되어 컨테이너 이미지 크기·공급망 공격 표면 증가(추정 15–30MB RSS 증가) | `package-lock.json`, `node_modules/@modelcontextprotocol/sdk` | 단기: CI에 `docker image size` 게이트 추가 모니터링. 장기: SDK의 client-only 경량 패키징 출시 시 전환 검토 |
| 11 | Maintainability | **`service-registry.ts` MCP 공통 필드 3중 복제** — `url` 필드(6개 속성)와 `default_headers`가 `bearer_token`·`api_key`·`none` 3개 변형에 완전히 동일하게 복제. 변경 시 3곳 모두 수정 필요 | `service-registry.ts` MCP 항목 | `const MCP_URL_FIELD = { ... }` 공통 상수로 추출 후 각 변형에서 spread 재사용 |
| 12 | Architecture | **`dispatchTest`의 OCP 위반** — `if (serviceType === 'mcp')` 분기가 서비스 타입 추가 시마다 확장되는 구조 | `integrations.service.ts:dispatchTest()` | Phase C 착수 전 `Map<serviceType, TransportTester>` 레지스트리 패턴으로 리팩토링 |
| 13 | Database | **`auth_type: 'none'` 추가 시 마이그레이션 누락 가능성** — 컬럼이 PostgreSQL native ENUM으로 선언된 경우 `ALTER TYPE ... ADD VALUE 'none'` 마이그레이션 필요. 이번 diff에 엔티티 파일 미포함으로 실제 저장 방식 확인 불가 | `integration.entity.ts` (diff 미포함) | `auth_type` 컬럼 선언 방식 확인 후 native enum이면 마이그레이션 파일 커밋 |
| 14 | Testing | **`listResources`·`listPrompts` 프록시 테스트 누락** — `McpSession` 인터페이스에 선언·`SessionImpl`에 구현되었으나 테스트 없음. Stage 2 `McpToolProvider.buildTools` 구현 시 회귀 위험 | `mcp-client.service.spec.ts` | `listResources`·`listPrompts` 각각이 내부 `Client` 동명 메서드로 위임되는지 검증 테스트 2개 추가 |
| 15 | Testing | **`api_key` 인증 필드 누락 테스트 없음** — `bearer_token`의 `token` 누락 `McpAuthError`는 검증되나, `api_key`에서 `headerName`·`value` 누락 경로 미검증 | `mcp-client.service.spec.ts` | `api_key` 불완전 credentials로 `MccpAuthError` 발생하는 테스트 추가 |
| 16 | Testing | **`adaptMcpTestResult` 폴백 경로 미검증** — `result.code` 누락 시 `MCP_CONNECT_FAILED`로 폴백하는 로직 테스트 없음 | `integrations.service.spec.ts` | `code` 없는 실패 결과로 `[MCP_CONNECT_FAILED]` 메시지 생성 테스트 추가 |
| 17 | Documentation | **신규 환경변수 문서화 누락** — `MCP_MAX_CONCURRENT_CONNECTIONS`, `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS`가 스펙에만 명세되고 `.env.example`·README에 미추가 | `.env.example` | 4개 환경변수 항목 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | **스펙 오타: `includeprompts`** — `spec/5-system/11-mcp-client.md §5.6`에 소문자로 기재, `spec/4-nodes/3-ai-nodes.md`의 `includePrompts`(camelCase)와 불일치 | `spec/5-system/11-mcp-client.md §5.6` | `includeprompts` → `includePrompts` 수정 |
| 2 | Scope | **Stage 2 구현 상세가 Stage 1 스펙에 현재 시제로 기술** — `McpToolProvider.buildTools/execute` 흐름 등 미구현 동작이 확정적으로 서술되어 현재 상태 오독 가능성 | `spec/4-nodes/3-ai-nodes.md` | 미구현 절에 `> (Stage 2에서 구현 예정)` 마커 추가 |
| 3 | Architecture | **`toMcpConnectParams`가 `IntegrationsService`에 내재** — Integration credentials(snake_case) → `McpConnectParams`(camelCase) 변환이 두 도메인 지식을 혼재시킴 | `integrations.service.ts:toMcpConnectParams` | `McpCredentialAdapter` 분리 또는 `McpTestConnectionService`에 오버로드 추가 고려 |
| 4 | Concurrency | **`(integrationId, executionId)` 세션 캐시 미구현** — Stage 2 `buildTools`+`execute`가 각각 `connect()`를 호출하면 동일 실행 내 중복 세션 발생 가능 | `mcp-client.service.ts` | Stage 2 `McpToolProvider` 구현 시 `Map<string, McpSession>` 캐시를 executor context에 바인딩 |
| 5 | Performance | **Stage 2 `buildTools` 다중 서버 병렬화 필요** — 스펙의 `mcpServers` 순회를 순차 구현 시 N개 서버 × connect+list 시간이 누적 | 미구현 Stage 2 | `Promise.allSettled(config.mcpServers.map(srv => this.connectAndList(srv)))` 패턴으로 병렬화 |
| 6 | Maintainability | **`session` 변수 타입 불필요하게 장황** — `Awaited<ReturnType<McpClientService['connect']>>` 대신 `McpSession`으로 충분 | `mcp-test-connection.service.ts:49` | `let session: McpSession \| null = null`으로 단순화 |
| 7 | Maintainability | **`?? undefined` 무의미한 표현** — `as ... \| undefined`로 이미 undefined 가능한 값에 `?? undefined` 부가 | `integrations.service.ts:toMcpConnectParams()` | `?? undefined` 제거 |
| 8 | Maintainability | **클라이언트 버전 하드코딩** — `'0.1.0'`이 `package.json` 실제 버전과 drift 가능 | `mcp-client.service.ts:169–172` | `package.json`에서 버전 주입 또는 앱 수준 상수로 단일 출처화 |
| 9 | Requirement | **`McpModule`이 `IntegrationsModule`에만 등록** — Stage 2에서 AI Agent 핸들러가 다른 모듈 경계에 있을 경우 주입 오류 발생 가능 | `mcp.module.ts`, `integrations.module.ts` | Stage 2 시작 전 `McpModule` 소비 경로 설계 또는 `AppModule`에 직접 포함 검토 |
| 10 | Documentation | **"Phase C" 내부 용어 미정의 주석** — 코드베이스 어디에도 정의 없는 내부 로드맵 용어 사용 | `integrations.service.ts:dispatchTest()` 주석 | "향후 transport 레벨 테스트 단계" 또는 spec 문서 링크로 교체 |
| 11 | Documentation | **`mcp.module.ts` JSDoc의 존재하지 않는 경로 forward-reference** — Stage 2 미래 경로를 구체적으로 명기하여 stale documentation 위험 | `mcp.module.ts` 모듈 JSDoc | 구체 경로 대신 "Stage 2: McpToolProvider — AI Agent 핸들러 모듈에 추가 예정" 수준의 추상 표현으로 변경 |
| 12 | Dependency | **`@modelcontextprotocol/sdk` `^1.29.0` caret 범위** — MCP 스펙이 활발히 진화 중이므로 minor 버전 자동 수용 시 silent breaking 가능성 | `package.json` | CI에 `npm outdated` 또는 Dependabot 설정, SDK 업그레이드 시 전체 테스트 통과 여부 필수 확인 |
| 13 | Database | **`credentials.cached_capabilities` JSONB 기존 필드 내 추가** — 스키마 마이그레이션 불필요하나 실행 시점 재조회 우선 정책이 코드 레벨에서도 일관되게 구현되어야 함 | `spec/5-system/11-mcp-client.md §3.3` | Stage 2 구현 시 `cached_capabilities` 쓰기 전 실행 시점 capabilities 우선 조회 guard 명시 |
| 14 | Testing | **`close()` 실패 시 경고 로그 경로 미검증** — 에러 억제 정책 명시적 검증 테스트 없음 | `mcp-client.service.spec.ts` | `client.close()` 예외 발생 시 `logger.warn` 호출·예외 억제 동작 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **HIGH** | SSRF 방어 미구현(Critical), 헤더 인젝션, 에러 메시지 노출, 응답 크기 미제한 |
| Requirement | **HIGH** | `previewTest` capability 데이터 손실(Critical), `MCP_INITIALIZE_FAILED` 미생성, URL HTTPS 구조적 검증 누락 |
| API Contract | **MEDIUM** | `previewTest` 스펙 불이행(Critical), 에러 코드 메시지 임베딩, SSRF |
| Performance | **MEDIUM** | SDK 서버 사이드 의존성 번들, 타임아웃 미적용, 세션 풀링 없음 |
| Maintainability | **MEDIUM** | `McpConnectParams` 타입-런타임 불일치, `MCP_INITIALIZE_FAILED` dead code, 필드 3중 복제 |
| Side Effect | **MEDIUM** | SSRF 방어 미구현, Express v5 트랜지티브 의존성, `MCP_INITIALIZE_FAILED` vocabulary 불일치 |
| Architecture | **LOW** | `adaptMcpTestResult` capability 손실, `dispatchTest` OCP 위반, `McpConnectParams` optional 필드 |
| Concurrency | **LOW** | `try...finally` 미적용, `MCP_MAX_CONCURRENT_CONNECTIONS` 미구현 |
| Testing | **LOW** | `listResources`/`listPrompts` 프록시 미검증, `api_key` 인증 실패 경로 미검증 |
| Database | **LOW** | `auth_type: 'none'` 마이그레이션 가능성, `cached_capabilities` JSONB 정책 |
| Dependency | **LOW** | SDK 서버 사이드 의존성, `jose` JWT 이중화, caret 버전 범위 위험 |
| Documentation | **LOW** | `includeprompts` 오타, `MCP_INITIALIZE_FAILED` 미사용 주석 미비, 환경변수 문서화 누락 |
| Scope | **LOW** | Stage 2 스펙이 Stage 1 PR에 현재 시제 포함, `package-lock.json` 부산물 |

---

## 발견 없는 에이전트
없음 — 13개 에이전트 모두 최소 1개 이상의 발견사항을 보고함.

---

## 권장 조치사항

1. **[즉시] SSRF 방어 구현** — `requireHttpsUrl()`에 RFC 1918·loopback·link-local·cloud metadata endpoint 차단 로직 추가. 스펙이 명시한 보안 요구사항이 코드에 반영되지 않은 상태로 배포 불가
2. **[즉시] `previewTest` 응답 계약 이행** — `capabilities`, `serverInfo`, `preview` 필드를 응답에 포함하거나 MCP 전용 preview 엔드포인트 신설. 현재 구조로는 등록 UI capability 미리보기 기능 구현 불가
3. **[Stage 2 전] `MCP_INITIALIZE_FAILED` dead code 정리** — 타입에서 제거하거나 실제 생성 경로 구현. 스펙 §8.2와의 불일치 해소
4. **[Stage 2 전] `McpConnectParams` 필수 필드 타입 수정** — `token`, `headerName`, `value`를 required로 변경해 컴파일 타임 보호 확보
5. **[Stage 2 전] 세션 정리 `try...finally`로 리팩토링** — `MCP_MAX_CONCURRENT_CONNECTIONS` semaphore 구현과 함께 리소스 누수 방지
6. **[Stage 2 전] `McpTestConnectionService.test()` 타임아웃 주입** — `AbortController` 기반 타임아웃으로 UI hang 방지
7. **[단기] `defaultHeaders` 헤더 인젝션 방어** — CRLF 제거 및 예약 헤더 차단 로직 추가
8. **[단기] SDK 에러 메시지 sanitize** — 내부 IP·경로가 포함된 원시 에러 메시지를 generic 메시지로 대체, 상세 원인은 로그에만 기록
9. **[단기] `.env.example` 환경변수 4종 추가** — `MCP_MAX_CONCURRENT_CONNECTIONS`, `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS`
10. **[단기] 스펙 오타 수정** — `spec/5-system/11-mcp-client.md §5.6`의 `includeprompts` → `includePrompts`
11. **[선택] `service-registry.ts` MCP 공통 필드 상수 추출** — 3중 복제 해소로 향후 변경 비용 절감
12. **[Stage 2 계획 시] `McpModule` 소비 경로 설계** — AI Agent 핸들러 모듈 경계에서의 DI 오류 방지를 위한 아키텍처 결정