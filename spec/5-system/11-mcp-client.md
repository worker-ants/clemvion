# Spec: MCP Client (Model Context Protocol)

> 관련 문서: [Spec AI 노드 §1 AI Agent](../4-nodes/3-ai-nodes.md#1-ai-agent) · [Spec RAG 검색 §7 확장 포인트](./9-rag-search.md#7-확장-포인트--agenttoolprovider) · [Spec 통합 관리 §5.6 MCP Server](../2-navigation/4-integration.md#56-mcp-server) · [Spec Integration 노드 §1 공통 패턴](../4-nodes/4-integration-nodes.md#1-공통-패턴) · [데이터 모델 - Integration §2.10](../1-data-model.md#210-integration)

---

## 1. 개요

AI Agent 노드가 외부 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버의 능력(Tools / Resources / Prompts)을 LLM 의 도구 호출 인터페이스로 노출해 활용할 수 있도록 하는 클라이언트 추상화 계층.

**위치**: AI Agent 노드 핸들러 내부의 `AgentToolProvider` 구현체(`McpToolProvider`)와, 그 하위에서 MCP 프로토콜 통신을 담당하는 `McpClientService` 모듈로 구성된다. 외부 프로토콜·인증·세션을 모두 캡슐화하여 AI Agent 핸들러는 KB 검색과 동일한 추상화로 MCP 도구를 다룬다.

**범위**:
- LLM 의 능동적 tool calling 으로만 호출 (KB 와 동일 — 핸들러가 prefill 하지 않음)
- 워크스페이스 공용 자원 (사용자 개인 MCP 서버는 본 spec 의 범위 밖)
- Streamable HTTP (SSE) **단일** transport — stdio·websocket 미지원

**MVP 미포함**:
- stdio MCP 서버 spawn (멀티테넌트 SaaS에서 프로세스·보안 격리 부담)
- MCP `prompts/get` 결과를 systemPrompt 슬롯에 정적으로 핀하는 UX
- MCP server-to-server proxy / 응답 캐싱 레이어
- MCP 서버 헬스체크의 자체 cron (만료 스캐너 §11.1 의 token_expires_at 흐름은 사용 안 함)

---

## 2. Transport

### 2.1 Streamable HTTP

MCP 의 **Streamable HTTP** transport 만 지원한다.

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

---

## 3. Integration 모델

MCP 서버는 **신규 노드가 아니라** 기존 Integration 엔티티의 새 `service_type` 으로 등록된다 ([데이터 모델 §2.10](../1-data-model.md#210-integration)). 별도 테이블·컬럼은 추가하지 않는다.

### 3.1 service_type / auth_type

| 필드 | 값 |
|------|----|
| `Integration.service_type` | `mcp` |
| `Integration.auth_type` | `bearer_token` / `api_key` / `none` |
| `Integration.scope` | 기본 `organization` (개인 등록 미지원) |

### 3.2 credentials JSONB 스키마

`auth_type` 에 따라 다음 필드를 갖는다 — 모든 비밀 필드는 [Integration §5.6](../2-navigation/4-integration.md#56-mcp-server) 의 정책으로 AES-256-GCM 암호화된다.

| `auth_type` | 필드 | 비밀 |
|-------------|------|------|
| 공통 | `url` (https URL, 필수) | × |
| 공통 | `default_headers` (Record<string,string>?) | × |
| `bearer_token` | `token` | 🔒 |
| `api_key` | `header_name` (e.g. `X-Api-Key`), `value` | `value` 만 🔒 |
| `none` | — | — |

> `url` 은 **HTTPS 강제** (테스트 연결 시 `https://` 시작 검증, 미충족 시 `MCP_HTTPS_REQUIRED`). 호스트가 다음 중 하나에 해당하면 동일한 코드로 차단된다 (SSRF 방어):
>
> - loopback (`127.0.0.0/8`, `::1`) / link-local (`169.254.0.0/16`, `fe80::/10`)
> - RFC 1918 사설 대역 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
> - IPv6 unique-local (`fc00::/7`)
> - cloud metadata 호스트명 (`metadata.google.internal`, `metadata.azure.com` 등)
>
> 호스트명이 IP literal 이 아닐 경우 즉시 차단하지는 않지만 (DNS 결과를 기다리지 않음), connect 단계에서 SDK 가 시도하는 실제 fetch 가 사설망 IP로 해석되더라도 transport 가 동일 검증을 1회 더 수행한다. 본 룰은 [Spec API §SSRF 가이드](./2-api-convention.md) 의 일반화이며, MCP 등록 단계에서 일관 적용된다.

### 3.3 capabilities 캐시 (선택)

`Integration.last_error` 와 별개로, 서버 등록 시 1회 `initialize` 응답의 `capabilities` 객체를 `credentials.cached_capabilities` (write-only로 처리하지 않음, 메타데이터) 에 저장해 노드 설정 UI 의 즉시 미리보기에 활용할 수 있다. **저장된 capabilities 는 hint 일 뿐, 실제 실행 시점에 다시 조회한 결과를 우선한다.**

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

AI Agent config 의 `mcpServers[].toolOverrides[]` ([Spec AI 노드 §1 Config](../4-nodes/3-ai-nodes.md#설정-config)) 로 도구별 description 을 커스터마이즈할 수 있다. 이름은 변경 불가 — 호환성 유지 위함.

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
      "uri": { "type": "string", "description": "Resource URI (use list_resources to discover)" }
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

[`AgentToolProvider`](../4-nodes/3-ai-nodes.md#1-ai-agent) 인터페이스의 두 번째 구현체 (첫 번째는 `KbToolProvider`).

### 6.1 인터페이스 매핑

| 메서드 | 동작 |
|--------|------|
| `key` | `'mcp'` |
| `matches(name)` | `name.startsWith('mcp_')` |
| `buildTools(ctx)` | `ctx.config.mcpServers` 순회 → 각 서버 connect/initialize → §5 규칙으로 ToolDef[] 생성. 실패 서버는 skip하고 §8 의 진단 정보 누적 |
| `execute(call, ctx)` | `name` 에서 `<sid>` 추출 → 해당 서버 세션에서 §5.3–5.5 분기 따라 RPC 호출 → 결과를 `AgentToolResult.content` 로 직렬화 |

### 6.2 진단 누적 (`mcpDiagnostics`)

KB 의 `ragDiagnostics` 와 동일한 패턴으로, AI Agent 의 `meta.mcpDiagnostics` 에 호출 통계를 누적한다.

```json
{
  "mcpDiagnostics": {
    "attempted": true,
    "serverCount": 2,
    "toolCalls": 4,
    "resourceReads": 1,
    "promptGets": 0,
    "errors": [
      { "integrationId": "uuid", "phase": "tools/list", "code": "MCP_TIMEOUT", "message": "..." }
    ]
  }
}
```

| 필드 | 의미 |
|------|------|
| `attempted` | MCP 도구가 1번 이상 호출되었거나 노출되었는지 |
| `serverCount` | 본 노드 실행에서 성공적으로 connect 된 서버 수 |
| `toolCalls` / `resourceReads` / `promptGets` | 각 호출 누적 |
| `errors` | 서버별 부분 실패 기록 (전체 실패가 아닌 격리된 실패) |

Multi-turn 모드에서는 KB 와 동일하게 turn 단위 delta 가 `meta.turnDebug[].mcpDiagnostics` 로도 분리되어 노출된다.

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

| 코드 | 의미 |
|------|------|
| `MCP_CONNECT_FAILED` | TCP / TLS / DNS 실패, HTTPS 강제 위반, `initialize` RPC 실패 (프로토콜 버전 불일치 등 포함) — connect 단계의 모든 실패가 하나로 흡수된다. SDK 가 connect 와 initialize 를 하나의 호출로 묶어 처리하므로 두 단계를 의미적으로 분리하기 어려움 |
| `MCP_LIST_FAILED` | `tools/list` 등 list RPC 실패 |
| `MCP_CALL_FAILED` | `tools/call` / `resources/read` / `prompts/get` 실패 |
| `MCP_TIMEOUT` | §4.4 타임아웃 초과 |
| `MCP_AUTH_FAILED` | credential 누락/포맷 오류, 또는 401/403. `Integration.status` 갱신 동반 |
| `MCP_HTTPS_REQUIRED` | URL 이 https:// 가 아니거나, 파싱 불가, 또는 사설/내부망 호스트(SSRF 차단) — preview-test 단계에서 검출 |
| `INVALID_TOOL_ARGUMENTS` | 인자 schema 검증 실패 (호출 자체는 발생 안 함) |
| `MCP_RESPONSE_TOO_LARGE` | content 사이즈 상한 초과 (truncate 적용됨을 알림) |

`Integration.last_error` 에는 `MCP_AUTH_FAILED` 와 같은 status 전이를 유발한 에러만 기록한다 — 일반 호출 실패는 `IntegrationUsageLog` (있다면) 와 `mcpDiagnostics.errors` 로 충분.

### 8.3 IntegrationUsageLog

[Spec 통합 §14 핸들러 실행 세멘틱](../2-navigation/4-integration.md#14-연관-동작) 에서 정의한 Integration 노드의 usage 로깅 패턴은 AI Agent 의 MCP 호출에도 적용된다 — `tools/call` 1회당 1 record, `node_execution_id` 는 호출 시점의 AI Agent NodeExecution.

| 필드 | 값 |
|------|----|
| `status` | `success` / `failed` |
| `error` | 실패 시 `{ code, message }` (§8.2 vocabulary). `message` 는 2KB 로 clamp |
| `duration_ms` | RPC 호출 단위의 elapsed |

**메타 도구 (`list_resources` · `read_resource` · `list_prompts` · `get_prompt`) 는 usage 로그에 기록하지 않는다** — 외부 API 호출이라기보다 MCP 세션의 내부 discovery 흐름이며, 매 호출 기록은 Activity 탭의 신호 대비 잡음을 키운다. 추후 별도 dashboard 가 필요해지면 분리된 trace 로 도입.

`tools/list` / `resources/list` / `prompts/list` 등 buildTools 단계의 setup RPC 도 usage 로그에 기록하지 않는다.

usage 로그 쓰기는 **fire-and-forget** — `tools/call` 의 응답 반환 직후 비동기로 발사되어 핫패스를 블로킹하지 않는다. DB 쓰기 실패는 swallow + warn log.

### 8.4 인증 실패 자동 status 전환

`tools/call` 응답이 401/403 (또는 `unauthorized`/`forbidden` 메시지) 이면 다음을 동시에 수행:

1. `tool_result.error.code = MCP_AUTH_FAILED` 로 LLM 에 전달 — 사용자 경험을 위해 호출 자체는 graceful fail
2. `IntegrationUsageLog.error.code = MCP_AUTH_FAILED` 로 로그 기록
3. **`Integration.status` 를 `error` 로, `status_reason` 을 `auth_failed` 로 atomic UPDATE 전환** — 다음 노드 실행이 기동될 때 통합 관리 화면이 "Need attention" 배너로 자동 노출

자동 복구는 하지 않는다 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Rotate credentials` 또는 OAuth `Reauthorize` 를 통해 `connected` 로 복귀시킨다. 자동 복구 정책을 도입하면 만료된 토큰이 일시 회복되는 race-of-clock 시나리오에서 status 가 깜빡일 수 있어 운영 가시성을 해친다.

단일 실패로 status 가 전환되는 점은 OAuth integration 의 기존 정책과 동일하며 의도적 — 임계값 (예: 3회 연속) 도입은 반복 실패 비용 증가 vs status 가시성 trade-off 분석 후 별도로 결정.

---

## 9. 연결 테스트 (Test Connection)

[Spec 통합 §3.3 Step 3](../2-navigation/4-integration.md#33-step-3-연결-테스트) 의 `POST /api/integrations/preview-test` 흐름과 동일한 방식. MCP 서비스의 테스트 절차:

1. `credentials.url` 이 `https://` 시작인지 검증 — 아니면 `MCP_INVALID_URL` (test 단계 한정 코드)
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

실패 시 `INTEGRATION_TEST_FAILED` (HTTP 422) + `details.code` 에 §8.2 의 vocabulary.

---

## 10. 클라이언트 라이브러리 의존성

- **Backend**: 공식 TypeScript SDK `@modelcontextprotocol/sdk` (Streamable HTTP transport 모듈) 를 사용한다. Nest.js `McpClientModule` 이 SDK 를 감싸 워크스페이스 격리·로깅·타임아웃을 주입.
- 단일 transport 사용으로 SDK import 표면을 최소화하며, stdio·websocket 모듈은 import 하지 않는다.

---

## 11. 데이터 모델 영향

신규 컬럼 / 신규 엔티티 **없음**. 기존 [Integration §2.10](../1-data-model.md#210-integration) 의 `service_type` enum 예시 목록에 `mcp` 가 추가되는 것이 유일한 변동(컬럼은 String 이므로 마이그레이션 불필요).

`IntegrationUsageLog §2.10.1` 의 사용 패턴이 한 개 늘어나는 것 외에 새 보조 테이블은 없다.

---

## 12. 확장 포인트

- **stdio transport**: 데스크톱 bridge 또는 사내 격리 환경 한정으로 도입 가능. credentials 스키마에 `command`, `args`, `env` 추가하고 transport 분기.
- **prompt 의 정적 핀**: `mcp_<sid>__get_prompt` 결과를 systemPrompt 슬롯에 고정 주입하는 사용자 흐름. AI Agent 설정 UI 의 systemPrompt 섹션 옆에 "MCP Prompt 첨부" 추가.
- **resource 의 KB-style 정적 컨텍스트**: 특정 resource URI 를 노드 실행 시 자동으로 read 하여 `messages[].content` prefix 에 주입. `mcpServers[].pinnedResources: string[]`.
- **OAuth 2.1 (PKCE) auth_type**: `bearer_token` 만 MVP. 동적 OAuth 흐름은 [통합 §10 OAuth 콜백](../2-navigation/4-integration.md#10-oauth-콜백-엔드포인트) 패턴을 재사용해 추가 가능.
- **server-to-server proxy / 응답 캐싱**: 트래픽 분석 후 별도 spec.

각 항목은 본 spec 의 평탄화 모델(§5) 을 깨지 않고 추가 가능하도록 설계되었다.
