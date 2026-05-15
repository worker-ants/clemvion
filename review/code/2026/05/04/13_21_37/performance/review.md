### 발견사항

---

**[CRITICAL]** `@modelcontextprotocol/sdk` 번들에 서버 사이드 의존성 포함
- 위치: `backend/package-lock.json` — `node_modules/@modelcontextprotocol/sdk`
- 상세: 이 프로젝트는 MCP SDK 의 **클라이언트** 기능(`StreamableHTTPClientTransport`)만 사용하지만, SDK 패키지가 서버 사이드 의존성을 전부 끌고 들어온다 — `hono` + `@hono/node-server` (전용 웹 프레임워크), `express@5`, `express-rate-limit`, `jose` (JWT), `pkce-challenge` (OAuth PKCE), `zod-to-json-schema`. 이는 이미 NestJS + Express를 운용 중인 백엔드에서 불필요한 중복이다. 이 의존성들은 NestJS 앱 부팅 시 module-level 코드를 실행하고 메모리에 상주하므로, cold start 시간 증가(추정 50–150ms)와 프로세스 RSS 증가(추정 15–30MB)를 야기한다.
- 제안: SDK 의 client-only entrypoint(`@modelcontextprotocol/sdk/client/index.js`, `@modelcontextprotocol/sdk/client/streamableHttp.js`)만 임포트하는 현재 코드 자체는 올바르다. 다만 npm `package.json`의 `bundleDependencies` 구성이나 미래 major 버전에서 SDK 가 클라이언트/서버를 분리 패키징할 경우 전환을 고려한다. 단기적으로는 `backend/package.json` `overrides` 에 `"hono": false` 식의 stub 대신, SDK 이슈 트래커에서 tree-shaking 지원 여부를 확인하고 실제 번들 크기를 측정(`node -e "require('@modelcontextprotocol/sdk/client/index.js')"` + heapdump)해 실측치를 확보한다.

---

**[WARNING]** 세션 풀링 없음 — 워크플로 실행마다 TCP 핸드셰이크 + MCP `initialize` RPC 발생
- 위치: `mcp-client.service.ts:169` `connect()`, `mcp-test-connection.service.ts:57` `test()`
- 상세: 스펙("AI Agent 노드 실행 1회 = MCP 세션 1회")에 의도된 설계이나, 이 말은 "동일 실행 내 N개 `tools/call` = 1개 세션"임을 보장하는 것이지, cold connect 를 허용하는 것이다. 문제는 고빈도 워크플로(예: Webhook 트리거로 분당 수십 회)에서 매번 TCP→TLS→HTTP→MCP `initialize` 왕복이 발생한다는 점이다. `initialize` 왕복은 스펙 타임아웃 기준으로 최대 10초이며, 느린 외부 MCP 서버라면 전체 노드 실행 지연을 지배하게 된다.
- 제안: Stage 2 구현 시 `(integrationId)` 기준의 **idle connection pool** (최소 1개, 최대 `MCP_MAX_CONCURRENT_CONNECTIONS/server`) 도입을 검토한다. 스펙 §4.3이 명시한 `(integrationId, executionId)` 캐시는 현재 구현에 없으므로, 최소한 이 캐시부터 `McpClientService` 에 추가해야 같은 실행 내 `buildTools` 재호출 시 이중 `initialize`를 막을 수 있다.

---

**[WARNING]** `McpTestConnectionService.test()` 에 타임아웃 미적용 — 등록 UI hang 가능성
- 위치: `mcp-test-connection.service.ts:57–100`
- 상세: `connect()` 와 `listTools()` 가 모두 순차 `await` 이며, `McpClientService` 또는 SDK 내부에서 타임아웃을 강제하지 않으면 서비스가 응답 없는 MCP 서버에 스펙 §4.4의 기본 10s를 전부 기다린 뒤 사용자에게 결과를 돌려준다. 스펙에 타임아웃이 명시되어 있으나 현재 구현에서 SDK `Client` 생성 시 `requestInit.signal` 이나 `AbortController` 를 주입하지 않는다.
- 제안: `connect()` 내부에서 `AbortController` + `setTimeout` 으로 전체 세션 타임아웃을 강제하거나, `StreamableHTTPClientTransport` 의 `requestInit.signal` 옵션에 전달한다. `test()` 레벨에서 `Promise.race([this.client.connect(params), timeout(10_000)])` 형태로 감싸는 것도 대안.

---

**[WARNING]** `buildTools` 의 다중 서버 connect — Stage 2 에서 순차 실행 시 지연 누적 위험
- 위치: `mcp-client.service.ts` (현재 Stage 1), 스펙 `§6.1 buildTools`
- 상세: 스펙이 "`mcpServers` 순회 → 각 서버 connect/initialize → tools/resources/prompts list"로 기술하고 있어, 순진한 구현은 서버 N개를 순차적으로 연결한다. 서버 3개 × 평균 connect+list 2초 = `buildTools` 에서 6초 소요 후 첫 LLM 호출이 시작된다. 초당 여러 번 호출되는 워크플로에서는 치명적이다.
- 제안: Stage 2 구현 시 `Promise.all(config.mcpServers.map(srv => this.connectAndList(srv)))` 형태로 병렬화한다. 개별 실패는 `Promise.allSettled` 로 수집해 `mcpDiagnostics.errors` 에 기록하고 다른 서버는 계속 진행한다 — 스펙 §8.1 격리 원칙과도 일치.

---

**[INFO]** 등록 테스트 시 `listTools()` 추가 RPC 라운드트립
- 위치: `mcp-test-connection.service.ts:73–79`
- 상세: 연결 테스트가 `initialize` 성공 후 추가로 `listTools()` 를 호출한다. 이는 UI 미리보기(`toolCount`)를 위한 의도된 설계이나, 느린 MCP 서버에서 사용자가 체감하는 등록 지연이 2× 가 된다.
- 제안: `listTools()` 결과를 UI 미리보기의 "nice-to-have"로 처리하고, `initialize` 성공만으로 먼저 `success: true` 를 반환한 뒤 `toolCount` 를 별도 비동기 엔드포인트로 분리하는 방안을 검토한다. 현재 단일 엔드포인트로 묶는 것은 단순하지만 UX 지연 트레이드오프가 있다.

---

**[INFO]** `deleteHeaderCaseInsensitive` — 매 삭제마다 전체 키 순회
- 위치: `mcp-client.service.ts:237–244`
- 상세: 헤더 수가 일반적으로 < 20개이므로 실용적 문제는 없다. 다만 루프가 발견 후에도 계속 순회한다(`break` 없음). 동일 이름을 가진 중복 헤더가 여러 개 있을 경우 전부 삭제하려는 의도라면 현재 코드가 맞고, 첫 번째 하나만 삭제하려면 `break` 를 추가해야 한다.
- 제안: 의도를 명확히 하기 위해 `break` 추가 여부를 결정한다. HTTP 헤더는 단일 이름에 복수 값을 가질 수 있지만 `Record<string, string>` 구조에서는 이미 마지막 값만 남으므로 `break` 추가가 안전하다.

---

### 요약

이번 변경은 MCP 클라이언트 레이어를 NestJS 서비스로 올바르게 추상화했으나, 성능 관점의 핵심 위험은 두 가지다. 첫째, `@modelcontextprotocol/sdk` 가 서버 사이드 HTTP 프레임워크(hono, express)·인증(jose, pkce)을 통째로 의존성으로 끌고 오며, 이는 클라이언트 전용 사용처에서 불필요한 메모리·부팅 비용을 유발한다. 둘째, 세션 생명주기가 "실행 1회 = 연결 1회"로 설계되어 있어 고빈도 워크플로에서 cold connect 오버헤드가 누적되며, 타임아웃 미적용으로 UI hang 가능성이 존재한다. Stage 2에서 `mcpServers` 다중 연결을 병렬화하고 서비스 레벨 타임아웃을 주입하는 것이 필수적이다.

### 위험도

**MEDIUM**