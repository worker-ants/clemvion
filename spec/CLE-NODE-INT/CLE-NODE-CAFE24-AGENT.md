---
id: "CLE-NODE-CAFE24-AGENT"
title: "Cafe24 노드 — AI 에이전트 노출"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CAFE24"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-INT", "CLE-NODE-CAFE24"]
area: "CLE-NODE-INT"
content_hash: "e4e47c6adbb709ce785bbfebd86335efa31fbf62e8b3cb4739d0671ebd2416ca"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "1e08f3ad5f40088ea7f77dd851d079085328ec117b4a326dc4d84fab1e2075f7"
etag: "sha256-6ab6a20a47aef52b74fc34e274eb7c78200bedf294c872869467ecc2a4c5f768"
---
## 개요

이 문서는 [Cafe24 노드](CLE-NODE-CAFE24.md) 의 하위 문서로 같은 Cafe24 통합을 AI 에이전트에 내부 MCP 브리지 도구로 노출하는 규칙을 정한다.

## AI 에이전트 노출

통합 하나를 이 노드와 AI 에이전트 MCP 도구가 함께 쓴다. `Cafe24McpToolProvider`(`codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`)가 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)의 내부 MCP 브리지 패턴으로 이 노드와 같은 메타데이터 테이블에서 MCP 도구 목록을 자동으로 만든다. 노드와 MCP 도구는 같은 `Cafe24ApiClient` 호출 경로를 쓴다.

### 도구 이름

| 노드 쪽 | MCP 쪽 |
|---------|--------|
| `resource='product'`, `operation='product_list'` | `mcp_<통합 id 8자>__product_list` |
| `resource='order'`, `operation='order_get'` | `mcp_<통합 id 8자>__order_get` |
| `resource='customer'`, `operation='customer_delete'` | `mcp_<통합 id 8자>__customer_delete` |

- 도구 이름의 sanitize·길이 규칙은 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 도구 이름 규칙을 그대로 쓴다. operation id 안에 밑줄이 들어가도 서버와 도구를 가르는 첫 `__` 위치로 나누므로 충돌하지 않는다.
- `mcp_<sid>__` 접두어를 누가 붙이는지는 [Cafe24 operation 메타데이터](CLE-C24-META) MCP 매핑 절이 정한다. 도구 프로바이더가 `buildTools()` 에서 접두어가 붙은 이름을 직접 만들고, `execute()` 에 들어올 때 접두어를 벗겨 bare operation id 로 처리한다.
- 노출 도구 목록(`mcpServers[].enabledTools`)은 bare operation id 배열(예: `['product_list', 'order_list']`)로 저장하고 비교한다.
- `buildTools()` 는 모든 도구 설명 끝에 KST 시간대 안내 한 줄(`CAFE24_TIMEZONE_SUFFIX`)을 자동으로 붙인다. AI 에이전트가 `$now`(UTC)와 KST 의 9시간 차이를 몰라 도구 인자를 잘못 만드는 회귀를 막는 1차 방어선이다. AI 노드 시스템 프롬프트의 시스템 컨텍스트 접두([AI 노드 공통](../CLE-NODE-AI/CLE-NODE-AI-COMMON.md))와 함께 두 경로로 알린다.

### 메타 도구 미사용

내부 MCP 브리지는 `tools` capability 만 보고하고 `resources`·`prompts` 는 보고하지 않는다. Cafe24 Admin API 는 도구 기반 RPC 모델이고 프롬프트 템플릿이나 읽기 전용 리소스 모델이 없기 때문이다. 그래서 `mcp_<sid>__list_resources` 같은 메타 도구는 노출하지 않는다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 노출 규칙).

### 노출 도구 목록 화면

AI 에이전트 설정에서는 리소스 단위로 묶어 고르게 한다. "Product (read/write 전부 허용)" 같은 묶음을 고르면 프론트엔드가 `enabledTools` 배열로 펼쳐 저장한다(용어는 [Cafe24 operation 메타데이터](CLE-C24-META) allowlist 절).

- 리소스 전체가 별도 승인 대상인 묶음은 그룹 머리에 ⚠ 와 "별도 승인 필요" 를 보인다. operation 단위 별도 승인 대상은 해당 행에만 ⚠ 를 보인다. 명단은 [Cafe24 별도 승인 scope](CLE-C24-SCOPES)가 정한다.
- 백엔드가 `tools/list` 응답 메타데이터에 `restrictedApproval` 을 실어 보내고 프론트엔드가 자동으로 렌더한다.
- 막지는 않는다. 사용자가 알고 고를 수 있게 안내만 한다.

### 호출 제한 공유

노드 호출과 MCP `tools/call` 은 모두 같은 `Cafe24ApiClient` 를 지나므로 같은 통합의 leaky bucket 을 공유한다. AI 에이전트 멀티턴 중 LLM 이 빠르게 연달아 부르면 다른 워크플로우의 같은 통합 호출도 함께 기다린다. 대기 · 격리 규칙은 [호출 제한](CLE-NODE-CAFE24-EXEC.md#호출-제한)이 정한다.

### 활동 로그

MCP 쪽 호출도 같은 활동 로그(`IntegrationUsageLog`)에 기록한다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md)). `node_execution_id` 는 호출 시점의 AI 에이전트 노드 실행이다. 통합 상세 화면의 활동 탭은 두 경로의 호출을 함께 보인다. 내부 MCP 브리지는 노드 핸들러 베이스를 거치지 않고 `IntegrationsService.logUsage` 를 직접 부르므로 `api` 식별 정보도 직접 채워야 한다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) INT-US-05). dry-run 재실행에서 모의 응답으로 대신한 도구 호출은 외부로 나가지 않았으므로 남기지 않는다([MCP 클라이언트 §dry-run 재실행](../CLE-INT/CLE-INT-MCP.md#dry-run-재실행)).

### 만료된 통합의 도구 목록 처리

`buildTools()` 는 AI 에이전트 노드가 실행될 때 `mcpServers[]` 의 각 Cafe24 통합을 조회해 도구 목록을 만든다. 통합 상태에 따라 다음과 같이 처리한다.

| 상태 | 처리 |
|------|------|
| `connected` | 정상 도구 목록 |
| `expired` + `status_reason='install_timeout'` | 뺀다(`install_token` 이 NULL 이라 갱신 불가). `mcpDiagnostics.serverSummaries[].skipReason='expired_install_timeout'` |
| `expired` + 리프레시 토큰 있음 + 사유가 `install_timeout` 아님 | 큐를 거쳐 1회 토큰 갱신(`refreshViaQueue`)을 시도한다. 갱신 결과로 통합이 `connected` 로 돌아와 도구 등록을 이어 가는지는 정의가 갈린다. [미결 사항](CLE-NODE-CAFE24.md#미결-사항) 참조. 갱신에 실패하면 `error(auth_failed)` 로 바뀌고 뺀다(`skipReason='expired_refresh_failed'`) |
| `expired` + 리프레시 토큰 없음 | 뺀다(`skipReason='expired_no_refresh_token'`). 이상 케이스라 사용자의 통합 재인증이 필요하다 |
| `error(*)` | 뺀다(`skipReason='error'`). 외부에서 명시적으로 통합 재인증하는 것이 정식 복구다. App URL 이 없는 Cafe24 Private 통합은 삭제 후 다시 등록한다([인증 실패 처리](CLE-NODE-CAFE24-CONFIG.md#인증-실패-처리)) |

빼는지와 그 이유는 모두 AI 에이전트 노드의 `meta.mcpDiagnostics.serverSummaries[]` 에 남는다. 사용자는 "통합이 보이지 않는" 원인을 바로 알 수 있다([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 진단).

## Rationale

### 내부 MCP 브리지

통합 하나를 서버 프로세스 안에서 MCP 도구로 노출한다. AI 에이전트 스펙과 핸들러는 바꾸지 않는다. 백엔드 구현은 AI 에이전트 핸들러의 도구 프로바이더 인터페이스(`codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`)를 구현한 `Cafe24McpToolProvider`(메타데이터 → `buildTools()`·`execute()`)다. 별도 외부 MCP 서버를 두고 통합을 두 번 등록하는 방식은 자격 증명이 중복되고 운영 부담이 커서 쓰지 않았다.
