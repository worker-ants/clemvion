---
id: mcp-client
status: partial
code:
  - codebase/backend/src/modules/mcp/mcp-client.service.ts
  - codebase/backend/src/modules/mcp/mcp-test-connection.service.ts
  - codebase/backend/src/modules/mcp/mcp-error-codes.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts
pending_plans:
  - plan/in-progress/spec-sync-mcp-client-gaps.md
---

# Spec: MCP Client (Model Context Protocol)

> 관련 문서: [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec RAG 검색 §7 확장 포인트](./9-rag-search.md#7-확장-포인트--agenttoolprovider) · [Spec 통합 관리 §5.6 MCP Server](../2-navigation/4-integration.md#56-mcp-server) · [Spec Integration 공통 §1 Integration 참조](../4-nodes/4-integration/0-common.md#1-integration-참조) · [데이터 모델 - Integration §2.10](../1-data-model.md#210-integration)

---

## 1. 개요

AI Agent 노드가 외부 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버의 능력(Tools / Resources / Prompts)을 LLM 의 도구 호출 인터페이스로 노출해 활용할 수 있도록 하는 클라이언트 추상화 계층.

**위치**: AI Agent 노드 핸들러 내부의 `AgentToolProvider` 구현체(`McpToolProvider`)와, 그 하위에서 MCP 프로토콜 통신을 담당하는 `McpClientService` 모듈로 구성된다. 외부 프로토콜·인증·세션을 모두 캡슐화하여 AI Agent 핸들러는 KB 검색과 동일한 추상화로 MCP 도구를 다룬다.

**범위**:
- LLM 의 능동적 tool calling 으로만 호출 (KB 와 동일 — 핸들러가 prefill 하지 않음)
- 워크스페이스 공용 자원 (사용자 개인 MCP 서버는 본 spec 의 범위 밖)
- 외부 서버용 **Streamable HTTP (SSE)** transport (§2.1) + 내부 모듈용 **Internal Bridge** transport (§2.3). stdio·websocket 미지원

**MVP 미포함**:
- stdio MCP 서버 spawn (멀티테넌트 SaaS에서 프로세스·보안 격리 부담)
- MCP `prompts/get` 결과를 systemPrompt 슬롯에 정적으로 핀하는 UX
- MCP server-to-server proxy / 응답 캐싱 레이어
- MCP 서버 헬스체크의 자체 cron (만료 스캐너 §11.1 의 token_expires_at 흐름은 사용 안 함)

---

## 2. Transport

본 클라이언트는 두 종류의 transport 를 지원한다 — **외부 서버용 HTTP transport** 와 **내부 모듈용 Internal Bridge**. 두 transport 모두 AI Agent 핸들러의 `AgentToolProvider` 인터페이스 구현체 (외부는 `McpToolProvider`, 내부는 `Cafe24McpToolProvider`) 로 노출되어 AI Agent 핸들러가 차이를 신경 쓰지 않는다 — 외부 HTTP transport 만 그 하위에서 `McpClientService` 가 MCP 프로토콜 통신을 담당한다.

### 2.1 Streamable HTTP (외부 서버용)

`service_type='mcp'` Integration 에 적용. MCP 의 **Streamable HTTP** transport 만 지원한다.

| 항목 | 동작 |
|------|------|
| 엔드포인트 | Integration `credentials.url` 의 단일 URL — 클라이언트 → 서버는 `POST`, 서버 → 클라이언트는 `GET` + `text/event-stream` |
| 세션 | 서버가 `Mcp-Session-Id` 응답 헤더로 발급하면 이후 모든 요청에 동일 헤더로 echo. 발급되지 않으면 stateless 모드 |
| 프로토콜 버전 | 클라이언트 SDK 가 협상. 서버가 미지원 버전을 거부하면 `INTEGRATION_NOT_CONNECTED` 로 격하 |
| 인증 | HTTP 헤더 (§3.2 `auth_type` 별 매핑) |

### 2.2 stdio 미지원 사유

- 멀티테넌트 백엔드에서 사용자별 subprocess 를 spawn 하는 비용·보안 부담
- 임의 명령 실행 권한 노출 위험
- 워크스페이스 공용 모델과 부정합

향후 데스크톱 bridge agent 등을 통해 우회적으로 stdio 서버를 노출하는 방안은 별도 spec 으로 분리한다.

### 2.3 Internal Bridge (in-process)

**일부 first-party Integration 은 외부 MCP 서버 없이 backend in-process 모듈로 MCP 인터페이스를 노출한다.** 이는 같은 Integration 이 워크플로 노드와 AI Agent 양쪽에서 사용되는 케이스의 표준 패턴이다.

| 항목 | 동작 |
|------|------|
| 적용 service_type | 현재 `cafe24`, **`makeshop` (Planned — [Spec MakeShop 노드 §8](../4-nodes/4-integration/5-makeshop.md#8-ai-agent-노출-internal-mcp-bridge))** — 향후 first-party 통합(예: Shopify, Naver Smartstore)이 같은 패턴 사용 가능 |
| 구현 형태 | backend 모듈이 AI Agent 핸들러의 `AgentToolProvider` 인터페이스를 직접 구현 (예: `Cafe24McpToolProvider`, Planned `MakeshopMcpToolProvider`). HTTP fetch 가 아니라 직접 함수 호출 |
| connect / initialize | no-op — 메모리 안에서 즉시 사용 가능. `capabilities` / `serverInfo` 는 정적 상수 |
| 세션 | 노드 실행 단위 mutex 만 — `Mcp-Session-Id` 헤더 불필요 |
| 인증 | Integration 의 자체 인증 (예: Cafe24 OAuth) 을 그대로 활용. `credentials.url` / `auth_type` 표(§3.2) 는 적용되지 않음 |
| SSRF 검증 | 미적용 — 외부 fetch 가 없음. base URL 의 안전성 검증은 Integration 의 `service_type` 별 로직(예: Cafe24 의 `mall_id` 유효성)이 담당 |
| Rate Limit | Integration 의 자체 wrapper (예: Cafe24 의 `Cafe24ApiClient`) 가 처리. 동일 프로세스 인스턴스 내 mutex 로 노드 호출과 공유 |

**도구 노출**: §5 의 일반 모델을 그대로 적용. `Cafe24McpToolProvider.buildTools()` 는 Cafe24 메타데이터 테이블에서 자동 생성된 도구 목록 (`ToolDef[]`) 을 반환 ([Spec Cafe24 §8.1](../4-nodes/4-integration/4-cafe24.md#81-도구-이름-매핑) · [Cafe24 API Metadata 컨벤션](../conventions/cafe24-api-metadata.md)).

**capability 보고**: Internal Bridge 별로 capability 가 다를 수 있다 — Cafe24 는 `tools` 만 보고, `resources` / `prompts` 미보고. AI Agent 는 §5.1 노출 규칙에 따라 메타도구를 생성하지 않는다.

**에러 처리**: §8 의 에러 vocabulary 그대로 적용. Cafe24 의 경우 `tool_result.error` 의 `code` 는 Cafe24 노드 §6 의 vocabulary (`CAFE24_AUTH_FAILED` 등)를 그대로 사용하며, `mcpDiagnostics.errors` 에는 동일하게 누적된다.

> Internal Bridge 도 §8.4 의 인증 실패 자동 status 전환 정책을 따른다. 단, refresh_token 을 보유한 provider (예: cafe24) 의 401 은 [Spec Cafe24 §6.1](../4-nodes/4-integration/4-cafe24.md#61-인증-실패-자동-status-전환) 의 "refresh + 1회 재시도" 자가 회복 정책이 우선 적용되며, 재시도도 401 이면 그때 §8.4 와 같은 격하. 403 은 항상 §8.4 와 동일하게 즉시 격하.

> **Bridge 별 description suffix**: Internal Bridge 는 자신의 service_type 에 특화된 정보를 도구 description 에 자동 append 할 수 있다 — 예: Cafe24 는 도구 description 에 `(Cafe24 <method> <path>)` 한 줄과 `CAFE24_TIMEZONE_SUFFIX` (KST 명시) 를 부기하며, operation 메타데이터에 `constraints?` 가 있으면 그 사이에 constraint kind 별 한 줄씩 (예: `Constraint: at least one of …`) 도 함께 삽입된다. 조립 순서·각 kind 별 suffix 포맷의 정의는 [Cafe24 API Metadata §2 "constraints 의 의미"](../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식) + [§5.3 description 자동 suffix](../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-suffix) 두 SoT 가 한 묶음으로 정의한다. 외부 HTTP transport (§2.1) 는 MCP 서버가 자체적으로 보고한 description 을 그대로 사용한다.

---

## 3. Integration 모델

MCP 서버는 **신규 노드가 아니라** 기존 Integration 엔티티의 새 `service_type` 으로 등록된다 ([데이터 모델 §2.10](../1-data-model.md#210-integration)). 별도 테이블·컬럼은 추가하지 않는다.

### 3.1 service_type / auth_type

본 절(§3) 의 `service_type='mcp'` 와 `auth_type` / `credentials` 스키마는 **외부 HTTP transport (§2.1) 한정**이다. Internal Bridge (§2.3) 로 노출되는 service_type 은 자체 인증 모델을 사용한다.

| 필드 | 값 (외부 HTTP) |
|------|----|
| `Integration.service_type` | `mcp` |
| `Integration.auth_type` | `bearer_token` / `api_key` / `none` |
| `Integration.scope` | 기본 `organization` (개인 등록 미지원) |

**Internal Bridge 적용 service_type** (현재):

| service_type | Bridge 구현 | spec |
|---|---|---|
| `cafe24` | `Cafe24McpToolProvider` | [Spec Cafe24 §8 AI Agent 노출](../4-nodes/4-integration/4-cafe24.md#8-ai-agent-노출-internal-mcp-bridge) |

### 3.2 credentials JSONB 스키마

`auth_type` 에 따라 다음 필드를 갖는다 — 모든 비밀 필드는 [Integration §5.6](../2-navigation/4-integration.md#56-mcp-server) 의 정책으로 AES-256-GCM 암호화된다.

| `auth_type` | 필드 | 비밀 |
|-------------|------|------|
| 공통 | `url` (https URL, 필수) | × |
| 공통 | `default_headers` (Record<string,string>?) | × |
| `bearer_token` | `token` | 🔒 |
| `api_key` | `header_name` (e.g. `X-Api-Key`), `value` | `value` 만 🔒 |
| `none` | — | — |

> **본 §3.2 의 URL 검증 / SSRF 정책은 외부 HTTP transport (§2.1) 한정.** Internal Bridge (§2.3) 는 외부 fetch 가 없으므로 적용되지 않는다.
>
> `url` 은 **HTTPS 강제** (테스트 연결 시 `https://` 시작 검증, 미충족 시 `MCP_HTTPS_REQUIRED`). 호스트가 다음 중 하나에 해당하면 동일한 코드로 차단된다 (SSRF 방어):
>
> - loopback (`127.0.0.0/8`, `::1`) / link-local (`169.254.0.0/16`, `fe80::/10`)
> - RFC 1918 사설 대역 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
> - IPv6 unique-local (`fc00::/7`)
> - cloud metadata 호스트명 (`metadata.google.internal`, `metadata.azure.com` 등)
>
> 호스트명이 IP literal 이 아닐 경우 즉시 차단하지는 않지만 (DNS 결과를 기다리지 않음), connect 단계에서 SDK 가 시도하는 실제 fetch 가 사설망 IP로 해석되더라도 transport 가 동일 검증을 1회 더 수행한다. 본 룰은 [Spec API §SSRF 가이드](./2-api-convention.md) 의 일반화이며, MCP 등록 단계에서 일관 적용된다.
>
> **로컬 개발 escape hatch** — 환경변수 `MCP_ALLOW_INSECURE_URL=true` 가 설정되면:
>
> - `http://` URL 허용 (단 `file://` / `ws://` 등 다른 scheme 은 여전히 거부)
> - 위 SSRF 호스트 블록리스트 전체 우회 (loopback / RFC 1918 / cloud metadata 모두 등록 가능)
>
> 본 토글은 운영 환경에서 절대 활성화해서는 안 된다 — 워크스페이스 admin 이 등록한 URL 을 그대로 신뢰하게 되어 SSRF 방어 표면이 다시 열린다. 기본값 `false`. `codebase/backend/.env.example` 에 경고와 함께 명시.

### 3.3 capabilities 캐시 (선택 · 미구현 Planned)

> **구현 현황 (2026-06-03)**: `cached_capabilities` 캐시는 **미구현 (Planned)** — 코드베이스에 해당 심볼이 없다. 현재 노드 설정 UI 미리보기는 매번 live `initialize` 결과(§9 연결 테스트)를 사용한다. 추적: `plan/in-progress/spec-sync-mcp-client-gaps.md`.

`Integration.last_error` 와 별개로, 서버 등록 시 1회 `initialize` 응답의 `capabilities` 객체를 `credentials.cached_capabilities` (write-only로 처리하지 않음, 메타데이터) 에 저장해 노드 설정 UI 의 즉시 미리보기에 활용할 수 있다. **저장된 capabilities 는 hint 일 뿐, 실제 실행 시점에 다시 조회한 결과를 우선한다.**

> `cached_capabilities` 는 **외부 HTTP transport (§2.1) 전용**. Internal Bridge (§2.3) 는 capability 가 정적 상수이므로 캐시 불필요 (`Cafe24McpToolProvider` 는 `tools` capability 만 hardcoded 보고).

---

## 4. Connection Lifecycle

### 4.1 단위

**AI Agent 노드 실행 1회 = MCP 세션 1회**. 노드 실행 시작 시 `mcpServers` 에 등록된 각 Integration 에 대해 lazily connect 하고, 노드 실행 종료(또는 multi-turn `waiting_for_input` 진입) 시 close.

| 시점 | 동작 |
|------|------|
| AI Agent `execute` 진입 | `mcpServers` 목록만 조회 (connect 지연) |
| `buildTools` 첫 호출 | 각 서버에 대해 connect → `initialize` → capabilities 검사 → `tools/list` (+ resources/prompts capability 보고 시 each list) |
| LLM 이 `mcp_*` tool 호출 | 동일 세션에서 `tools/call` (또는 메타도구 §6) |
| 노드 종료 / `waiting_for_input` | 모든 세션 close. 재개(resume) 시 `mcpServers` config 로부터 결정론적으로 재연결 |
| Multi-turn 동일 노드의 turn N+1 | 동일 세션 유지 (waiting 진입하지 않은 인-메모리 turn 의 경우) |

### 4.2 재연결 / 재개

Multi-turn AI Agent 가 `waiting_for_input` 상태로 일시 중단되면 세션은 close 되며 사용자 메시지 수신 후 재개 시점에 동일한 `mcpServers` 로부터 새 세션을 만든다. 세션 ID 와 capability list 는 **재개 시 재조회**해도 안전한 설계이며, AI Agent 내부 상태(`messages` 등)는 영향받지 않는다.

### 4.3 동시성 / 풀링

같은 노드 실행 내에서 한 서버에 대한 connect 는 **1회**만 일어난다 (`(integrationId, executionId)` 캐시). 노드 간·실행 간 세션 공유는 하지 않는다 — 사용자 격리·세션 라이프사이클의 단순함을 위해 의도적으로 풀을 키우지 않는다.

워크스페이스 단위 동시 connect 수는 백엔드 환경 변수 `MCP_MAX_CONCURRENT_CONNECTIONS` (기본 20) 로 상한한다.

> **Internal Bridge (§2.3)**: connect / `initialize` / close 가 모두 no-op. `buildTools` 는 메모리에서 즉시 메타데이터 테이블 기반 도구 목록 생성. `tools/call` 은 직접 함수 호출. `(integrationId, executionId)` 캐시 규칙은 동일 적용 (Bridge 인스턴스가 같은 execution 내에서 1회 lazy init). `MCP_MAX_CONCURRENT_CONNECTIONS` 상한은 외부 HTTP transport 에만 카운트되며 Internal Bridge 는 별도 상한 없음.

### 4.4 타임아웃

| 단계 | 기본 타임아웃 |
|------|-------------|
| connect + initialize | 10s |
| `tools/list`, `resources/list`, `prompts/list` | 10s |
| `tools/call`, `resources/read`, `prompts/get` | 30s |

타임아웃은 환경 변수로 override 가능. 초과 시 §8 의 에러 처리에 따라 격리된다.

---

## 5. 도구 노출 모델

MCP 의 세 capability(Tools / Resources / Prompts) 를 모두 **LLM 의 도구 호출 인터페이스로 평탄화** 하여 노출한다. 이는 다음 이유로 일관성 있고 단순하다:

- LLM 이 능동적으로 호출 시점·인자를 결정 (KB 검색과 동일 모델)
- AI Agent 핸들러의 `AgentToolProvider` 추상화 그대로 재사용 가능
- 사용자 설정 UI 가 "MCP 서버 추가 + 도구 allowlist" 한 가지 흐름으로 끝남

향후 systemPrompt 에 prompt 를 정적으로 핀하거나 Resource 를 KB 와 같은 정적 컨텍스트 주입으로 다루는 변형은 별도 spec 으로 도입할 수 있다.

### 5.1 노출 규칙

서버가 `initialize` 응답에서 보고한 capability 에 따라 다음 도구가 자동 생성된다.

| MCP capability | 노출되는 LLM 도구 | 종류 |
|----------------|-----------------|------|
| `tools` (서버가 보고) | 각 tool 마다 1개 — `mcp_<sid>__<toolName>` | 일반 도구 |
| `resources` (서버가 보고) | `mcp_<sid>__list_resources`, `mcp_<sid>__read_resource` | 메타 도구 |
| `prompts` (서버가 보고) | `mcp_<sid>__list_prompts`, `mcp_<sid>__get_prompt` | 메타 도구 |

서버가 capability 를 보고하지 않으면 해당 분류의 도구는 **생성 자체를 생략**한다 (LLM 에 노출 안 됨).

### 5.2 도구 이름 규칙

모든 MCP 관련 도구는 `mcp_` prefix 를 갖는다 — AI Agent 의 기존 prefix(`tool_`, `kb_`, `cond_`) 와 충돌하지 않는다.

```
mcp_<sid>__<toolName>
mcp_<sid>__list_resources
mcp_<sid>__read_resource
mcp_<sid>__list_prompts
mcp_<sid>__get_prompt
```

| 토큰 | 정의 |
|------|------|
| `<sid>` | `Integration.id` (UUID) 의 앞 8자에서 비-`[a-z0-9]` 문자를 `_` 로 치환한 값. 워크스페이스 내 8자 충돌 시 12자로 확장 (`McpToolProvider` 가 등록 시점에 결정) |
| `<toolName>` | MCP 서버가 `tools/list` 로 보고한 원본 이름. LLM API 호환을 위해 `[^a-zA-Z0-9_]` 를 `_` 로 치환 (sanitize) |
| `__` | server ↔ tool 구분자. 단일 underscore 로는 sanitized tool name 과 분리 불가능하므로 double underscore 사용 |

**역파싱**: `McpToolProvider.matches(name)` 는 `name.startsWith('mcp_')` 만 검사하고, `execute` 단계에서 `__` 의 첫 발생 위치로 split 하여 `<sid>` 와 도구 식별자를 분리한다. 메타도구는 식별자가 예약어(`list_resources`, `read_resource`, `list_prompts`, `get_prompt`) 와 일치하는지로 분기.

### 5.3 Tools — 일반 도구

MCP `tools/list` 응답의 각 tool 을 `ToolDef` ([Spec LLM 클라이언트 §3.4](./7-llm-client.md#34-tooldef--toolcall)) 로 변환한다.

```json
{
  "name": "mcp_<sid>__<sanitized_toolName>",
  "description": "<MCP tool.description>\n\n(via MCP server: <integration.name>)",
  "parameters": <MCP tool.inputSchema>
}
```

- `inputSchema` 는 JSON Schema (MCP 표준) — 변환 없이 그대로 LLM 의 `parameters` 로 전달
- `description` 끝에 출처(서버 별칭) 를 자동 부기하여 LLM 이 같은 의미의 도구가 여러 서버에 있을 때 출처 인지 가능하게 함

#### 사용자 오버라이드 (선택)

AI Agent config 의 `mcpServers[].toolOverrides[]` ([Spec AI Agent §1 설정](../4-nodes/3-ai/1-ai-agent.md#1-설정-config)) 로 도구별 description 을 커스터마이즈할 수 있다. 이름은 변경 불가 — 호환성 유지 위함.

### 5.4 Resources — 메타 도구 2종

서버가 `resources` capability 를 보고할 때만 자동 추가.

```json
{
  "name": "mcp_<sid>__list_resources",
  "description": "List available resources on MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
    }
  }
}
```

```json
{
  "name": "mcp_<sid>__read_resource",
  "description": "Read a resource by URI from MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "uri": { "type": "string", "description": "Resource URI" }
    },
    "required": ["uri"]
  }
}
```

`tool_result` 는 MCP `Resource` / `ResourceContents` 객체를 JSON 직렬화하여 그대로 전달. 텍스트는 `content[].text`, 바이너리는 `content[].blob` (base64) — LLM 의 멀티모달 입력은 별도 노드(추후) 에서 활용.

### 5.5 Prompts — 메타 도구 2종

서버가 `prompts` capability 를 보고할 때만 자동 추가.

```json
{
  "name": "mcp_<sid>__list_prompts",
  "description": "List available prompt templates on MCP server \"<integration.name>\".",
  "parameters": {
    "type": "object",
    "properties": {
      "cursor": { "type": "string", "description": "Pagination cursor (optional)" }
    }
  }
}
```

```json
{
  "name": "mcp_<sid>__get_prompt",
  "description": "Render a prompt template from MCP server \"<integration.name>\". Returns a list of messages you should incorporate into your reasoning.",
  "parameters": {
    "type": "object",
    "properties": {
      "name":      { "type": "string" },
      "arguments": { "type": "object", "description": "Prompt arguments (server-defined)" }
    },
    "required": ["name"]
  }
}
```

`get_prompt` 의 `tool_result` 는 MCP `GetPromptResult.messages` 배열을 JSON 직렬화. LLM 은 이 메시지들을 자신의 reasoning 에 통합한다 (시스템 프롬프트 슬롯에 정적으로 주입하지 않음 — MVP).

### 5.6 도구 allowlist

AI Agent config (`mcpServers[].enabledTools`) 에서 일반 도구별로 화이트리스트를 적용할 수 있다.

| 값 | 의미 |
|----|------|
| `['*']` 또는 미설정 | 서버가 노출하는 모든 일반 도구 LLM 에 노출 (기본) |
| `['toolA', 'toolB']` | 명시된 일반 도구만 노출. 서버에 없는 이름은 무시(경고만) |

**메타도구는 allowlist 의 영향을 받지 않는다** — 서버 단위 on/off 만으로 제어. (resource/prompt 별로 allowlist 를 두지 않은 이유: MCP 서버 측에서 권한 모델로 제어하는 것이 자연스럽고, AI Agent 입장에서는 capability 단위 toggle 만으로 충분.)

`mcpServers[].includeResources: false` / `mcpServers[].includePrompts: false` 토글로 capability 단위 옵트아웃 가능 — 기본은 모두 `true` (서버가 보고했다면 노출).

### 5.7 도구 호출 한도

MCP 도구 호출은 AI Agent 의 `maxToolCalls` (기본 10) 카운트에 **포함**된다 — KB tool 과 동일 정책. 한도 도달 시 loop 종료 후 마지막 LLM 응답 반환.

---

## 6. AgentToolProvider 구현 (`McpToolProvider`)

[`AgentToolProvider`](../4-nodes/3-ai/1-ai-agent.md) 인터페이스의 두 번째 구현체 (첫 번째는 `KbToolProvider`).

### 6.1 인터페이스 매핑

| 메서드 | 동작 |
|--------|------|
| `key` | `'mcp'` |
| `matches(name)` | `name.startsWith('mcp_')` |
| `buildTools(ctx)` | `ctx.config.mcpServers` 순회 → 각 서버 connect/initialize → §5 규칙으로 ToolDef[] 생성. 실패 서버는 skip하고 §8 의 진단 정보 누적 |
| `execute(call, ctx)` | `name` 에서 `<sid>` 추출 → 해당 서버 세션에서 §5.3–5.5 분기 따라 RPC 호출 → 결과를 `AgentToolResult.content` 로 직렬화 |

### 6.2 진단 누적 (`mcpDiagnostics`)

KB 의 `ragDiagnostics` 와 동일한 패턴으로, AI Agent 의 `meta.mcpDiagnostics` 에 호출 통계를 누적하는 것이 목표 모델이다.

> **구현 현황 (2026-06-03)**: 현재 backend 는 `mcpDiagnostics` surface 중 **`serverSummaries[]` slice 만** emit 한다 (`mcp-diagnostics.ts` · `ai-agent.handler.ts buildMcpDiagnosticsMeta`). 아래 예시의 나머지 필드 (`attempted` / `serverCount` / `toolCalls` / `resourceReads` / `promptGets` / `errors[]`) 는 본 spec 에 정의되어 있으나 **미구현 (Planned)** — `mcp-diagnostics.ts` 주석이 외부 MCP 호출 경로와 함께 follow-up 으로 명시. 또한 `serverSummaries[]` 를 push 하는 provider 는 현재 **`Cafe24McpToolProvider` (Internal Bridge) 뿐**이며, 외부 `service_type='mcp'` 통합을 처리하는 `McpToolProvider` 는 build/connect 실패 시 `logger.warn` 만 하고 진단 배열에 아무것도 push 하지 않는다 → **외부 MCP 서버는 진단 표면에 미노출 (Planned)**. 추적: `plan/in-progress/spec-sync-mcp-client-gaps.md`.

```json
{
  "mcpDiagnostics": {
    "attempted": true,
    "serverCount": 2,
    "toolCalls": 4,
    "resourceReads": 1,
    "promptGets": 0,
    "serverSummaries": [
      { "integrationId": "uuid-a", "serviceType": "cafe24", "status": "connected", "toolCount": 18 },
      { "integrationId": "uuid-b", "serviceType": "cafe24", "status": "skipped", "skipReason": "expired_install_timeout", "toolCount": 0 }
    ],
    "errors": [
      { "integrationId": "uuid-c", "phase": "tools/list", "code": "MCP_TIMEOUT", "message": "..." }
    ]
  }
}
```

| 필드 | 의미 |
|------|------|
| `attempted` | MCP 도구가 1번 이상 호출되었거나 노출되었는지 |
| `serverCount` | 본 노드 실행에서 성공적으로 connect 된 서버 수 (= `serverSummaries[]` 중 `status='connected'` 행 수) |
| `toolCalls` / `resourceReads` / `promptGets` | 각 호출 누적 |
| `serverSummaries[]` | `mcpServers` config 에 등록된 각 Integration 의 build 결과. 사용자가 "통합이 보이지 않는다" 원인을 즉시 식별하기 위함. 필드: `integrationId`, `serviceType` (`mcp` / `cafe24` / …), `status` (`connected` / `skipped`), `skipReason` (skip 일 때만), `toolCount` (catalog 에 등록된 도구 수). |
| `errors` | 서버별 부분 실패 기록 (전체 실패가 아닌 격리된 실패) |

**`skipReason` vocabulary**. 본 vocabulary 는 **Internal Bridge (cafe24) 경로의 buildTools 단계 skip** 을 위주로 정의된다. 외부 MCP 의 connect/initialize/tools-list 실패는 종전대로 `errors[]` 에 누적되므로 별도 skipReason 값을 도입하지 않는다 (정보 중복 회피).

> **명명 규칙 분리**: `skipReason` 값은 모두 `lower_snake_case` 다. 본 필드는 에러 코드가 아닌 운영 진단용 enum 이라 [`node-output.md` Principle 3.2](../conventions/node-output.md) 의 `code` UPPER_SNAKE_CASE 규약 (예: `MCP_AUTH_FAILED`, `MCP_TIMEOUT`) 과 구분된다. `Integration.status_reason` (예: `auth_failed`, `install_timeout`) 과는 의도적으로 표기 일치 — `skipReason` 의 일부 값 (`expired_install_timeout`, `expired_refresh_failed`) 이 `status_reason` 의 의미를 그대로 캐리하기 때문.


| 값 | 의미 | 적용 provider |
|----|------|---------------|
| `expired_install_timeout` | Cafe24 Private `pending_install → expired` 24h TTL 만료 — install_token NULL 이라 refresh 불가, 사용자가 삭제 후 재등록 필요 | cafe24 |
| `expired_refresh_failed` | `expired` 상태에서 buildTools 의 1회 refresh 시도가 `invalid_grant` 로 실패 — worker 가 `error(auth_failed)` 로 전이 ([Spec Cafe24 §8.6](../4-nodes/4-integration/4-cafe24.md#86-expired-통합의-buildtools-자가-회복)) | cafe24 |
| `expired_no_refresh_token` | `expired` 상태인데 `credentials.refresh_token` 누락 — refresh 불가능, 사용자 reauth 필요 | cafe24 |
| `error` | `status='error'` (auth_failed / insufficient_scope / network 등) — 외부 명시 reauth 가 정식 회복 (§8.4) | cafe24 / mcp |
| `pending_install` | Cafe24 Private 초기 install 미완료 | cafe24 |
| `lookup_failed` | Integration row 조회 실패 (삭제됨 / 권한 결여) | 공용 |
| `not_capable` | `mcpServers` 에 등록된 Integration 의 `service_type` 이 본 provider 가 처리할 대상 아님 (provider 라우팅 정상 동작 확인용) | 공용 |

Multi-turn 모드에서는 KB 와 동일하게 turn 단위 delta 가 `meta.turnDebug[].mcpDiagnostics` 로도 분리되어 노출된다. `serverSummaries[]` 자체는 build 결과의 정적 스냅샷이므로 turn 마다 재계산되지 않고 노드 실행 단위로 1회 결정된다 (multi-turn resume 시 재build → snapshot 갱신).

---

## 7. 실행 흐름 (요약)

```
AI Agent.execute()
  ↓
[setup] config.mcpServers 조회
  ↓
[buildTools] 각 server lazy connect → initialize → tools/resources/prompts list
            → §5 규칙으로 LLM ToolDef[] 생성
            → 실패 서버는 skip + mcpDiagnostics.errors 누적
  ↓
[1st LLM call] (KB tool, MCP tool, condition tool, 그리고 일반 tool 모두 함께 노출)
  ↓
LLM 응답
  ├─ tool_use(mcp_*) → §6.1 execute → tool_result 주입 → 다음 turn
  ├─ tool_use(kb_*) → KbToolProvider 처리 (변경 없음)
  ├─ tool_use(cond_*) → 조건 처리 (변경 없음)
  └─ 일반 텍스트 → 종료
  ↓
모든 세션 close → meta.mcpDiagnostics 확정
```

---

## 8. 에러 처리

### 8.1 격리 원칙

**한 MCP 서버의 장애가 AI Agent 노드 전체를 죽이지 않는다.** KB 검색과 같은 graceful degradation 전략.

| 상황 | 처리 |
|------|------|
| `initialize` 실패 / `tools/list` 실패 / connect 타임아웃 | 해당 서버 도구는 LLM 에 **노출하지 않음**. `meta.mcpDiagnostics.errors` 에 기록. 다른 서버·KB·일반 도구는 정상 노출 |
| `tools/call` 실패 (네트워크 / 5xx / RPC error) | 해당 호출만 실패. LLM 에 `tool_result` 로 `{ "error": "<code>", "message": "..." }` 전달 → LLM 이 graceful 응답 결정. `mcpDiagnostics.errors` 에도 누적 |
| 401 / 403 (인증 실패) | 위와 동일하되 `Integration.status` 를 `error(auth_failed)` 로 갱신, `last_error` 기록. 사용자에게 reauthorize/rotate 권장 |
| 도구 인자 schema 검증 실패 | LLM 이 보낸 인자가 `inputSchema` 를 위반하면 호출 시도 없이 `tool_result.error = 'INVALID_TOOL_ARGUMENTS'` 반환 (LLM 이 다음 턴에 보정) |
| `tool_result.content` 가 너무 큼 (>100KB 텍스트 또는 >1MB 바이너리) | truncate 후 `tool_result` 끝에 `[truncated: original_size_bytes]` 마커. mcpDiagnostics 경고 |

### 8.2 에러 코드 vocabulary

`tool_result.error` 또는 `mcpDiagnostics.errors[].code` 에 사용:

SoT: `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `MCP_ERROR_CODES` 상수.

| 코드 | 의미 |
|------|------|
| `MCP_CONNECT_FAILED` | TCP / TLS / DNS 실패, HTTPS 강제 위반, `initialize` RPC 실패 (프로토콜 버전 불일치 등 포함) — connect 단계의 모든 실패가 하나로 흡수된다. SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움. **현재 emit 지점: §9 연결 테스트 (`McpTestConnectionService`) 한정**. 노드 실행 buildTools 단계의 connect 실패는 `logger.warn` 만 하고 코드를 LLM/진단에 surface 하지 않음 (§6.2 미구현 참조) |
| `MCP_LIST_FAILED` | `tools/list` 등 list RPC 실패. **현재 emit 지점: §9 연결 테스트 한정** (buildTools 단계 list 실패는 §6.2 미구현으로 미surface) |
| `MCP_CALL_FAILED` | `tools/call` / `resources/read` / `prompts/get` 실패 (노드 실행 `execute` 경로에서 emit) |
| `MCP_TOOL_ERROR` | `tools/call` 응답이 MCP `isError: true` 인 application-level 도구 실패 — 전송은 성공했으나 도구가 에러를 보고. `tool_result.content` 에 서버 content 동봉 |
| `MCP_TIMEOUT` | §4.4 타임아웃 초과. **미구현 (Planned)** — 현재 노드 실행 경로의 타임아웃은 plain `Error` 로 throw 되어 `MCP_CALL_FAILED` (call 단계) 또는 `logger.warn` (build 단계) 로 흡수되며, 별도 `MCP_TIMEOUT` 코드를 surface 하지 않는다 (`mcp-error-codes.ts` 에 상수는 존재) |
| `MCP_AUTH_FAILED` | credential 누락/포맷 오류, 또는 401/403. `Integration.status` 갱신 동반 |
| `MCP_HTTPS_REQUIRED` | URL 이 https:// 가 아니거나, 파싱 불가, 또는 사설/내부망 호스트(SSRF 차단) — preview-test 단계에서 검출 |
| `MCP_UNKNOWN_TOOL` | `execute` 단계에서 `<sid>` 에 해당하는 활성 세션이 없거나, 세션이 노출하지 않은 도구 이름을 LLM 이 호출한 경우 (buildTools 미실행 / 도구 미존재) |
| `INVALID_TOOL_ARGUMENTS` | 인자 schema 검증 실패 또는 인자 JSON 파싱 실패 (호출 자체는 발생 안 함) |
| `MCP_RESPONSE_TOO_LARGE` | content 사이즈 상한 초과 (truncate 적용됨을 알림) |

`Integration.last_error` 에는 `MCP_AUTH_FAILED` 와 같은 status 전이를 유발한 에러만 기록한다 — 일반 호출 실패는 `IntegrationUsageLog` (있다면) 와 `mcpDiagnostics.errors` 로 충분.

### 8.3 IntegrationUsageLog

[Spec 통합 §14 핸들러 실행 세멘틱](../2-navigation/4-integration.md#14-연관-동작) 에서 정의한 Integration 노드의 usage 로깅 패턴은 AI Agent 의 MCP 호출에도 적용된다 — `tools/call` 1회당 1 record, `node_execution_id` 는 호출 시점의 AI Agent NodeExecution.

| 필드 | 타입 | 값 |
|------|------|----|
| `status` | enum | `success` / `failed` |
| `error` | jsonb? | 실패 시 `{ code, message }` (§8.2 vocabulary). `message` 는 2KB 로 clamp |
| `duration_ms` | int | RPC 호출 단위의 elapsed |
| `api_label` | `varchar(128)? NULL` | Internal Bridge (`Cafe24McpToolProvider`) 경로에서만 `cafe24.<resource>.<operation>` 형식 catalog key 채움. 외부 MCP 서버 경로는 NULL |
| `api_method` | `varchar(8)? NULL` | Internal Bridge: HTTP method (cafe24 operation). 외부 MCP 경로: NULL |
| `api_path` | `varchar(256)? NULL` | Internal Bridge: operation.path template. 외부 MCP 경로: NULL |

길이 한도 / truncate 정책은 [`spec/conventions/cafe24-api-metadata.md §7.5`](../conventions/cafe24-api-metadata.md#75-catalog-key-형식--활동-로그-api_label) 참조.

> **api 채우기는 호출부의 명시적 의무**: Internal Bridge 경로는 노드 핸들러의 `IntegrationHandlerBase.logUsage` (api 인자 자동 forward) 를 거치지 않고, tool provider (현재 `Cafe24McpToolProvider`) 가 `IntegrationsService.logUsage` 를 **직접 호출**한다. 따라서 `api` 식별 정보를 호출부에서 직접 채워야 하며, 누락해도 노드 핸들러 테스트는 통과하므로 사각지대가 된다. 채우는 값은 노드 핸들러와 동일 형식 (catalog key `cafe24.<resource>.<operation>` + operation.method + operation.path). 본 의무의 cross-cutting 정의는 [`spec/4-nodes/4-integration/_product-overview.md` INT-US-05 "실행 경로"](../4-nodes/4-integration/_product-overview.md#24-사용처-추적-및-라이프사이클) 가 SoT.

**메타 도구 (`list_resources` · `read_resource` · `list_prompts` · `get_prompt`) 는 usage 로그에 기록하지 않는다** — 외부 API 호출이라기보다 MCP 세션의 내부 discovery 흐름이며, 매 호출 기록은 Activity 탭의 신호 대비 잡음을 키운다. 추후 별도 dashboard 가 필요해지면 분리된 trace 로 도입.

`tools/list` / `resources/list` / `prompts/list` 등 buildTools 단계의 setup RPC 도 usage 로그에 기록하지 않는다.

usage 로그 쓰기는 **fire-and-forget** — `tools/call` 의 응답 반환 직후 비동기로 발사되어 핫패스를 블로킹하지 않는다. DB 쓰기 실패는 swallow + warn log.

### 8.4 인증 실패 자동 status 전환

`tools/call` 응답이 401/403 (또는 `unauthorized`/`forbidden` 메시지) 이면 다음을 동시에 수행:

1. `tool_result.error.code = MCP_AUTH_FAILED` 로 LLM 에 전달 — 사용자 경험을 위해 호출 자체는 graceful fail
2. `IntegrationUsageLog.error.code = MCP_AUTH_FAILED` 로 로그 기록
3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출

본 정책의 적용 범위는 **외부 MCP 서버**(외부 transport, refresh_token 없는 토큰 모델) 한정이다. `error → connected` 자동 복구는 하지 않는다 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Rotate credentials` 또는 OAuth `Reauthorize` 를 통해 `connected` 로 복귀시킨다. 자동 복구 정책을 도입하면 만료된 토큰이 일시 회복되는 race-of-clock 시나리오에서 status 가 깜빡일 수 있어 운영 가시성을 해친다.

**Internal Bridge 예외 (refresh_token 보유 provider)**: Internal Bridge 의 cafe24 처럼 자체 OAuth refresh_token 을 보유한 provider 의 401 은 본 정책 대신 [Spec Cafe24 §6.1](../4-nodes/4-integration/4-cafe24.md#61-인증-실패-자동-status-전환) 의 "refresh + 1회 재시도" 자가 회복 정책을 적용한다 — refresh_token 이 정상 갱신을 보장하므로 외부 MCP 의 race-of-clock 시나리오가 발생하지 않고, 정상 토큰 lifecycle 의 일부이므로 status 깜빡임 우려가 없다. 403 (스코프/권한 부족) 은 Internal Bridge 도 본 §8.4 와 동일하게 즉시 격하. 본 분기의 결정 근거는 [Spec 통합 § Rationale "`call()` 의 401 자동 회복"](../2-navigation/4-integration.md#rationale) 참고.

단일 실패로 status 가 전환되는 점은 OAuth integration 의 기존 정책과 동일하며 의도적 — **외부 MCP 서버 한정** (Internal Bridge 의 refresh_token 보유 provider 는 위 "Internal Bridge 예외" 단락의 자가 회복 정책 우선). 임계값 (예: 3회 연속) 도입은 반복 실패 비용 증가 vs status 가시성 trade-off 분석 후 별도로 결정.

---

## 9. 연결 테스트 (Test Connection)

[Spec 통합 §3.3 Step 3](../2-navigation/4-integration.md#33-step-3-연결-테스트) 의 `POST /api/integrations/preview-test` 흐름과 동일한 방식. MCP 서비스의 테스트 절차:

1. `credentials.url` 이 `https://` 시작인지 검증 — 아니면 `MCP_HTTPS_REQUIRED` (SSRF 차단·malformed URL 도 동일 코드로 흡수, §8.2)
2. Streamable HTTP 클라이언트로 connect → `initialize` 호출 (10s 타임아웃)
3. 응답의 `capabilities` 와 `serverInfo` 를 메모리에 보유
4. (선택) `tools/list` 1회 호출하여 도구 카운트 미리보기 생성
5. 세션 close

성공 시 응답 body 에 다음을 포함한다 (UI 가 capability 미리보기에 사용):

```json
{
  "capabilities": { "tools": {}, "resources": {}, "prompts": {} },
  "serverInfo": { "name": "filesystem-mcp", "version": "1.2.0" },
  "preview": { "toolCount": 12, "resourceSupported": true, "promptSupported": false }
}
```

**실패 응답 형식**: `preview-test` 는 실패해도 예외를 던지지 않고 **HTTP 200 OK** body 에 `{ success: false, code, message }` 를 담아 반환한다 (`code` 는 §8.2 vocabulary 중 `MCP_HTTPS_REQUIRED` / `MCP_AUTH_FAILED` / `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` 부분집합). UI 가 이 body 를 그대로 렌더한다.

> 한편 **이미 저장된 Integration 의 credential rotate** 경로(`POST /api/integrations/:id/test` 후 갱신)는 테스트 실패 시 `INTEGRATION_TEST_FAILED` (`BadRequestException`, HTTP 400) 를 던진다 — 신규 등록 미리보기인 `preview-test` 와 다른 경로다.

---

## 10. 클라이언트 라이브러리 의존성

- **Backend**: 공식 TypeScript SDK `@modelcontextprotocol/sdk` (Streamable HTTP transport 모듈) 를 사용한다. Nest.js `McpClientModule` 이 SDK 를 감싸 워크스페이스 격리·로깅·타임아웃을 주입.
- 단일 transport 사용으로 SDK import 표면을 최소화하며, stdio·websocket 모듈은 import 하지 않는다.

---

## 11. 데이터 모델 영향

신규 컬럼 / 신규 엔티티 **없음**. [Integration §2.10](../1-data-model.md#210-integration) 의 `service_type` String 컬럼에 다음 값들이 본 spec 의 영역에서 사용된다 — `mcp` (외부 HTTP transport §2.1), `cafe24` (Internal Bridge §2.3). 두 값 모두 String 컬럼이므로 enum 마이그레이션 불필요.

`IntegrationUsageLog §2.10.1` 의 사용 패턴이 양쪽 transport 모두에 적용된다 (`tools/call` 1회당 1 record).

---

## 12. 확장 포인트

- **stdio transport**: 데스크톱 bridge 또는 사내 격리 환경 한정으로 도입 가능. credentials 스키마에 `command`, `args`, `env` 추가하고 transport 분기.
- **prompt 의 정적 핀**: `mcp_<sid>__get_prompt` 결과를 systemPrompt 슬롯에 고정 주입하는 사용자 흐름. AI Agent 설정 UI 의 systemPrompt 섹션 옆에 "MCP Prompt 첨부" 추가.
- **resource 의 KB-style 정적 컨텍스트**: 특정 resource URI 를 노드 실행 시 자동으로 read 하여 `messages[].content` prefix 에 주입. `mcpServers[].pinnedResources: string[]`.
- **OAuth 2.1 (PKCE) auth_type**: `bearer_token` 만 MVP. 동적 OAuth 흐름은 [통합 §10 OAuth 콜백](../2-navigation/4-integration.md#10-oauth-콜백-엔드포인트) 패턴을 재사용해 추가 가능.
- **server-to-server proxy / 응답 캐싱**: 트래픽 분석 후 별도 spec.
- **Internal Bridge 확장**: Shopify, Naver Smartstore 등 first-party 이커머스 통합이 `cafe24` 와 동일한 §2.3 패턴으로 추가 가능. backend 에 `<Service>McpBridge` 모듈 + 메타데이터 테이블을 두고 service_type 화이트리스트(§3.1) 에 추가.

각 항목은 본 spec 의 평탄화 모델(§5) 을 깨지 않고 추가 가능하도록 설계되었다.
