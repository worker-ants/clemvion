---
id: "CLE-INT-MANAGE-RUN"
title: "통합 관리 — 사용처 · 연결 테스트 · 실행 연동"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-MANAGE"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-MANAGE"]
area: "CLE-INT"
content_hash: "dac0f69c990240ab9d203620bedaa692ec87e542268e4271c3687598c27a5ba8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "db1d66859e8152cfeb0948417e39a1be23a931e48a0a38eaa05a8d20edfa183c"
etag: "sha256-9bd8c6c911a7c89bb6ffbabefaab725c40f66ceeece55d02f21989360e63ce4d"
---
## 개요

이 문서는 [통합 관리](CLE-INT-MANAGE.md) 의 하위 문서로 사용처 추적과 삭제 차단, 연결 테스트 세 경로, 노드 실행 · 워크플로우 에디터와의 연동, 통합 감사 로그를 정한다. 노드가 개인 통합을 쓸 수 있는지는 [통합 관리 — 개인 통합 사용 판정](CLE-INT-MANAGE-USE.md#개인-통합-사용-판정), 에러 코드 표는 [통합 관리 — API 와 에러 코드](CLE-INT-MANAGE-API.md#에러-코드) 가 정한다.

## 사용처 추적과 삭제 차단

`GET /api/integrations/:id/usages` 는 모든 워크플로우의 `Node.config` 를 JSONB 로 조회해 두 참조 경로의 합집합을 돌려준다.

- 직접 참조: 최상위 `config->>'integrationId' = :id`. HTTP·Database·Send Email·Cafe24·MakeShop 등 통합 노드다.
- MCP 참조: AI 에이전트 노드 `config->'mcpServers'` 배열 안 객체의 `integrationId`. JSONB containment 로 찾는다: `config->'mcpServers' @> '[{"integrationId":"<id>"}]'::jsonb`.

결과는 워크플로우 단위로 묶는다: `{ workflowId, workflowName, isActive, authorIsIntegrationOwner, nodes: [{ id, label, type, usageKind }] }[]`.

- `usageKind: 'direct' | 'mcp'` 는 노드가 통합을 참조하는 방식이다. 일반 노드에는 `mcpServers` 가 없고 AI 에이전트 노드는 최상위 `integrationId` 를 쓰지 않아 두 경로는 실제로 겹치지 않는다. 한 노드가 양쪽에 걸리면 `direct` 로 둔다.
- `authorIsIntegrationOwner` 는 그 워크플로우의 작성자(`workflow.created_by`)가 통합 소유자(`integration.created_by`)와 같은지다. 공개 범위 전환 다이얼로그([위험 영역 탭](CLE-INT-MANAGE-DETAIL.md#위험-영역-탭))가 쓴다. 워크플로우 작성자 id 는 싣지 않는다.
- 응답에는 요청자가 볼 수 있는 워크스페이스의 워크플로우만 넣는다.

삭제 차단 다이얼로그 문구:

> Cannot delete "Google - Team Account"
>
> This integration is still referenced by the following nodes:
>
> Workflow A (Active) · Send Email message (node id: abc) · Lookup Google user (node id: def)
> Workflow B (Inactive) · Notify on failure (node id: ghi)
>
> Please replace or remove these node references first.
>
> [Close] [Open Workflow A →]

- 서버의 `DELETE /api/integrations/:id` 도 같은 조건을 확인해 409 `INTEGRATION_IN_USE` 를 돌려준다. 사용처 목록은 에러 봉투의 `details.usages` 에 싣는다. 사전 조회와 삭제 사이에 사용처가 생겨 409 가 오면 화면은 그 목록으로 같은 차단 다이얼로그를 띄우고 목록이 없으면 토스트로 알린다. 현재 구현은 이 목록을 응답에 싣지 못한다([미결 사항](CLE-INT-MANAGE.md#미결-사항)).
- 통합을 MCP 도구로 참조하는 AI 에이전트 노드도 차단 대상이다. 쓰이고 있는 MCP 통합을 실수로 지워 AI 에이전트가 실행 중에 깨지는 것을 막는다. 다이얼로그의 MCP 노드 행에도 `MCP` 배지를 붙인다.
- 삭제 후 재등록으로 복구하는 통합(MakeShop, 설치 토큰 보존 전에 연결된 옛 Cafe24 Private)은 이 차단 때문에 노드의 통합 참조를 먼저 비우거나 바꿔야 지울 수 있다. 다시 등록한 뒤에는 노드에서 새 통합을 다시 고른다. 순서와 이유는 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#makeshop-은-삭제-후-재등록으로만-복구한다) 이 정한다. 24시간 설치 기한을 넘겨 만료된 설치 대기 행(`install_timeout`)은 서비스와 관계없이 지우지 않고 같은 상점을 새로 등록하므로 삭제 전에 참조를 먼저 비우는 단계가 없다. 이 행을 쓰던 노드와 AI 에이전트가 있으면 새로 등록한 통합을 다시 고른다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)).
- 멤버가 나가거나 제거될 때 그 사람의 개인 통합을 지우는 경로는 이 차단을 거치지 않는다([멤버가 나가거나 제거될 때](CLE-INT-MANAGE-PERM.md#멤버가-나가거나-제거될-때)). 그 통합을 참조하던 노드는 삭제된 통합과 같다. 에디터의 선택기에는 `(missing)` 옵션이 보이고 캔버스에는 [삭제된 통합 표시](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#삭제된-통합-표시) 배지가 붙는다. 통합 노드는 실행에서 실패한다. AI 에이전트의 MCP 서버 항목은 도구 목록에서 빠진다([MCP 클라이언트](CLE-INT-MCP.md)).

통합이 만료됨이나 오류가 되면 그 통합을 참조하는 모든 노드는 워크플로우 에디터에서 경고 배지(🟡·🔴)와 tooltip "Integration needs attention — open settings" 를 보인다. 노드 설정 패널에는 통합 상세로 가는 바로가기 링크를 둔다.

## 연결 테스트

| 경로 | 쓰임 |
| --- | --- |
| `POST /api/integrations/preview-test` | 저장 전 연결 테스트. 본문 `{ serviceType, authType, credentials }`(`PreviewTestDto`) |
| `POST /api/integrations/:id/test` | 저장된 자격 증명으로 연결 테스트 |
| `POST /api/integrations/:id/rotate` | 안에서 새 자격 증명으로 연결 테스트를 하고 성공할 때만 저장 |

- 결과는 `IntegrationTestResult`(`{ success, code, message }` 와 서비스별 추가 필드)다. 서비스마다 무엇을 확인하고 어떤 코드를 내는지는 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md) 이 정한다.
- 실패 코드는 노드 출력의 `output.error.code` 와 다른 이름공간이다. 노드 코드와 이름이 같은 값도 연결 테스트 결과로 받았으면 연결 테스트의 정의로 읽는다. 이름이 같은 값은 두 무리다.
  - host 차단 코드(`EMAIL_HOST_BLOCKED`·`DB_HOST_BLOCKED`·`HTTP_BLOCKED`)는 노드와 같은 SSRF 가드의 판정이라 뜻도 같다.
  - Cafe24·MakeShop 의 인증 실패와 전송 실패(`CAFE24_AUTH_FAILED`·`CAFE24_TRANSPORT_FAILED`·`MAKESHOP_AUTH_FAILED`·`MAKESHOP_TRANSPORT_FAILED`)는 노드와 같은 API 클라이언트가 내서 이름이 같다. 뜻은 다를 수 있다. MakeShop 연결 테스트는 403 을 `MAKESHOP_AUTH_FAILED` 로 내지만 통합 상태를 낮추지 않는다. 노드 실행은 같은 403 에 같은 코드를 내고 상태를 `error(auth_failed)` 로 낮춘다([서비스별 인증 방식과 자격 증명 「MakeShop」](CLE-INT-AUTH.md#makeshop)).
- 외부를 실제로 부르는 서비스는 Email·MCP·HTTP·Database 이고 Cafe24·MakeShop·Google·GitHub·Webhook 은 저장 전 테스트에서 구조만 확인한다. Cafe24·MakeShop 은 저장 뒤 `:id/test` 에서 실제로 부른다.
- 설치 대기 통합에 `:id/test` 를 부르면 외부 호출 없이 `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 로 바로 거절한다. 토큰이 없어 외부 호출이 의미가 없다. 서비스 유형이 아니라 상태만 보는 가드라 설치 대기를 쓰는 모든 서비스에 적용된다. 화면의 버튼 비활성을 우회한 API 직접 호출의 백엔드 방어다.
- 같은 엔드포인트의 다른 가드도 같은 모양이다. 복호화 실패는 `INTEGRATION_CREDENTIALS_UNREADABLE`, Cafe24 자격 증명 필드 누락은 `INTEGRATION_INCOMPLETE` 를 200 과 `IntegrationTestResult` 로 돌려준다.
- 사용자가 직접 누른 연결 테스트의 실패는 연속 네트워크 실패(`consecutive_network_failures`)에 합산하지 않는다.
- 자격 증명 교체(`:id/rotate`)는 결과 객체를 돌려주지 않는다. 안의 연결 테스트가 실패하면 400 `INTEGRATION_TEST_FAILED` 에러 봉투로 거절하고 자격 증명과 상태를 바꾸지 않는다. 테스트 결과의 `message` 와 `code` 를 어디에 싣는지는 [에러 코드](CLE-INT-MANAGE-API.md#에러-코드) 가 정한다. `:id/test` 와 `preview-test` 의 실패는 이 코드를 쓰지 않는다.

## 노드 실행 연동

핸들러 실행 계약은 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 과 [노드 핸들러 계약](../CLE-EXEC/CLE-EXEC-HANDLER.md) 이 정한다. 통합 쪽에서 보는 핵심은 이렇다.

- 모든 통합 핸들러는 `IntegrationsService.getForExecution` 으로 자격 증명을 꺼내고 호출 결과를 그 통합과 함께 `IntegrationsService.logUsage` 로 기록한다. 개인 통합이면 조회가 [개인 통합 사용 판정](CLE-INT-MANAGE-USE.md#개인-통합-사용-판정) 을 거친다. 부르는 쪽이 넘기는 인자와 통합 서비스가 워크플로우 작성자를 구하는 방법은 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#integrationsservice-api-실행-엔진용) 이 정한다.
- 통합을 얻기 전에 끝난 실행은 조회 거절이든 그 앞 단계의 실패든 활동 로그를 남기지 않는다. 설정의 통합 ID 가 가리키는 통합의 `last_used_at`·`last_error` 도 쓰지 않는다. 자격 증명을 읽지 못한 통합도 얻지 못한 통합으로 본다([통합 노드 공통 Rationale](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#자격-증명을-읽지-못한-통합은-얻지-못한-통합으로-본다-2026-11-05)).
- `logUsage` 는 조회가 돌려준 통합을 인자로 받는다. 그래서 얻지 못한 통합에는 기록할 수 없다([활동 로그는 얻은 통합에만 쓴다](CLE-INT-MANAGE-USE.md#활동-로그는-얻은-통합에만-쓴다)).
- 엔진은 노드 실행 직전에 `ExecutionContext.nodeExecutionId` 를 넣어 활동 로그의 귀속을 보장한다.
- 실패하면 핸들러는 `IntegrationError(code, message)` 를 throw 하지 않고 `port: 'error'` 와 `output.error` 로 보낸다. 통합을 얻은 뒤의 실패면 `logUsage(통합, { status: 'failed' })` 로 기록한다. config 형식 오류(`handler.validate` 실패)만 throw 로 남는다. 실패가 통합 상태를 어디까지 바꾸는지는 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 의 미결 사항이다.
- 노드 에러 코드(`INTEGRATION_CALL_FAILED`·`INTEGRATION_TYPE_MISMATCH`·`INTEGRATION_NOT_CONNECTED`·`INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED`·`INTEGRATION_SERVICE_UNAVAILABLE` 등 공통 코드와 노드별 코드)는 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 과 각 노드 문서가 정한다. 존재하지 않거나 다른 워크스페이스의 통합은 별도 `INTEGRATION_NOT_FOUND` 없이 `INTEGRATION_CALL_FAILED` 다.
- 개인 통합 사용 판정을 통과하지 못한 개인 통합도 같은 코드와 같은 문구로 실패한다. 노드 출력만 보고는 남의 개인 통합인지 알 수 없다. AI 에이전트의 `mcpServers[].integrationId` 는 없는 통합과 같이 그 서버만 건너뛰고 노드는 계속 실행한다. 건너뛴 서버를 알리는 방식은 [MCP 클라이언트 「통합 조회 기준」](CLE-INT-MCP.md#통합-조회-기준) 이 정한다.
- HTTP Request 노드는 2xx 가 아닌 응답을 노드 출력 `HTTP_4XX`·`HTTP_5XX` 로 내고 활동 로그에는 `HTTP_{status}`(예: `HTTP_502`)로 남긴다([HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md)).
- 연결 테스트 전용 코드(`EMAIL_CONNECT_FAILED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)와 노드와 공유하는 host 차단 코드(`EMAIL_HOST_BLOCKED`·`DB_HOST_BLOCKED`·`HTTP_BLOCKED`)는 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md) 에 있다.

활동 로그 기록 시점:

| 노드 | 기록 조건 |
| --- | --- |
| `send_email` | 매 호출(성공·실패 모두) |
| `database_query` | 매 호출(성공·실패 모두) |
| `http_request` | `authentication === 'integration'` 일 때만. None·Custom 은 대상이 아니다 |
| `cafe24` | 매 호출(성공·실패 모두). AI 에이전트의 `Cafe24McpToolProvider` 호출도 같은 로그에 남긴다. `node_execution_id` 는 호출 시점의 AI 에이전트 노드 실행이다. 메타 도구 호출은 남기지 않는다([MCP 클라이언트](CLE-INT-MCP.md)) |
| `makeshop` | 매 호출(성공·실패 모두). `MakeshopMcpToolProvider` 호출도 같다 |

표의 «매 호출» 은 통합을 얻은 뒤의 호출이다. 통합을 얻기 전에 끝난 실패는 남기지 않는다.

### 워크플로우 에디터

- 노드 설정 패널은 공용 드롭다운인 통합 선택기(`IntegrationSelector`)로 통합을 고른다. 지금 사용자가 워크플로우 작성자가 아니면 자기 개인 통합은 고를 수 없는 항목으로 보이고 워크플로우 작성자의 개인 통합만 노드에서 쓸 수 있다는 이유가 함께 보인다. 화면 문구는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙을 따른다. 조직 통합은 누구나 고른다. `serviceTypes` prop 으로 거른다: Send Email 은 `email`, Database 는 `database`, HTTP 의 `authentication='integration'` 모드는 `http`, Cafe24 노드는 `cafe24`, MakeShop 노드는 `makeshop`, AI 에이전트의 `mcpServers` 항목은 `['mcp', 'cafe24', 'makeshop']`.
- AI 에이전트의 `mcpServers` 선택은 외부 MCP 서버와 Cafe24·MakeShop 통합을 모두 받는다. Cafe24·MakeShop 은 `Cafe24McpToolProvider`·`MakeshopMcpToolProvider` 가 서버 안의 `AgentToolProvider` 로 동작한다([MCP 클라이언트](CLE-INT-MCP.md)). 화면은 그룹을 나눠 보인다(`🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores (Internal Bridge)` / `🛒 MakeShop stores (Internal Bridge)`).
- AI 에이전트의 `mcpServers` 는 다중 선택이고 서버별로 노출 도구 목록과 resource·prompt 노출 토글이 붙는다. Cafe24 는 도구가 많아(리소스 × operation 485개, 2026-07-17 실측, 수치 기준은 저장소 `codebase/api-catalogs/cafe24/_overview.md` §5 이고 NERV 사본은 [Cafe24 API 카탈로그](CLE-C24-CATALOG#5-coverage-matrix) 다) 노출 도구 목록을 카테고리 단위로 묶어 보인다. 이 규모는 `AI_AGENT_TOOL_COUNT_MAX` 기본값(128)을 늘 넘으므로 노출 도구 목록은 편의가 아니라 사실상 필수다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md), [Cafe24 operation 메타데이터](CLE-C24-META)).
- 통합 상태 배지를 함께 보이고 해당 유형 통합이 0건이면 선택기 아래에 `+ Create {Service} integration` 링크(`/integrations/new?service=…&step=auth`)를 보인다.
- 삭제된 통합 ID 가 저장돼 있으면 `{id앞8자}… (missing)` 옵션을 더해 값을 보존한다. 캔버스의 배지는 [통합 노드 공통 「삭제된 통합 표시」](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md#삭제된-통합-표시) 가 정한다.
- 워크플로우 작성자가 아닌 사용자에게는 워크플로우 작성자의 개인 통합이 목록에 없으므로 같은 `(missing)` 옵션으로 보이고 값은 그대로 남는다. 저장 검사는 바뀐 참조만 보므로 그 노드의 다른 필드를 고쳐 저장해도 거절되지 않는다.
- 그 사용자가 통합 참조를 그대로 두고 같은 노드의 다른 필드(HTTP Request 노드의 URL, Send Email 노드의 받는 사람 등)를 바꾸는 것은 막지 않는다. 노드는 워크플로우 작성자의 자격 증명으로 바뀐 목적지를 부른다([Rationale](CLE-INT-MANAGE-USE.md#개인-통합의-역할-하한과-노드-사용-기준을-정한다-2026-10-24) 의 받아들인 잔여).
- 노드를 붙여넣거나 복제하면 지금 사용자가 그 워크플로우에서 고를 수 없는 통합 참조를 비우고 경고한다. 지금 사용자, 워크플로우 작성자, 통합 목록 가운데 하나라도 모르면 비우지 않는다. 규칙은 [에디터](../CLE-WF/CLE-WF-EDITOR.md#노드-조작) 가 정한다.

## 감사 로그

통합 생성·수정·삭제·교체·재인증·공개 범위 전환을 `resource_type='integration'` 으로 기록한다. 액션은 `integration.created`, `integration.updated`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed` 다. `integration.scope_changed` 는 개인과 조직 사이의 공개 범위 전환이며 `details { from, to }` 를 싣는다. OAuth 권한 범위 변경이 아니다. 전환이 커밋됐을 때만 남기고 통합을 만든 사람이 멤버가 아니라 거절한 전환은 남기지 않는다. 액션 카탈로그는 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), 명명 규약은 [감사 action 명명](../CLE-OBS/CLE-OBS-AUDITNAME.md) 이 정한다.

멤버가 나가거나 제거되면서 지운 개인 통합도 통합마다 `integration.deleted` 를 남긴다. `details` 에는 일반 삭제와 같은 `serviceType`·`name` 에 `mode` 와 `memberUserId` 를 더한다. 두 키는 같은 요청의 `member.removed` 와 같다. 나가기는 `mode='left'`, 제거는 `mode='removed'` 이고 `memberUserId` 는 나가거나 제거된 멤버다. 일반 삭제에는 두 키가 없다. 감사 행의 행위자는 나가기면 나간 멤버, 제거면 제거한 관리자다. 같은 요청의 `member.removed` 와 함께 남는다. 이 기록은 커밋 뒤 삭제 포트의 후처리가 일반 삭제와 같은 마무리로 남긴다([통합 데이터와 흐름 「멤버가 나가거나 제거될 때」](CLE-INT-DATA.md#멤버가-나가거나-제거될-때)).

`integration.reauthorized` 는 모든 재인증을 포괄하지 않는다. OAuth 제공자가 없는 통합의 reset 경로 전용이다. `reauthorize()` 가 상태를 연결됨으로 되돌리는 즉시 `details.mode='reset'` 으로 기록한다. OAuth 통합의 재인증은 `reauthorize()` 가 `oauth/begin` 에 맡기기만 하므로 시작 시점에 기록하지 않고 이어지는 콜백 완료도 현재 기록하지 않는다. OAuth 재인증 완료는 현재 감사 커버리지의 빈틈이다. 확장할 때 콜백 성공 지점에서 기록한다.

Cafe24 Private 의 재설치 대기 경로도 같은 빈틈에 들어간다. 통합 재인증과 추가 권한 요청이 재설치 대기 표시를 남길 때도, 그 뒤 «테스트 실행» 콜백이 표시를 지우고 자격 증명을 바꿀 때도 감사 로그를 남기지 않는다. `integration.reauthorized` 는 여전히 reset 경로에서만 남는다.

## 구현 위치

- `codebase/backend/src/modules/integrations/**` (`integrations.service.ts`: `getForExecution`·`logUsage`·`testConnection`)
- e2e: `codebase/backend/test/integration-connection-test.e2e-spec.ts`(연결 테스트 세 경로와 교체 실패의 `details.testCode`)

## Rationale

### 자격 증명 교체의 연결 테스트 실패는 400 이다 (2026-11-12)

`INTEGRATION_TEST_FAILED` 의 HTTP 상태가 문서마다 달랐다. 2026-11-12 에 사용자가 세 가지를 정했다. 상태는 400 이다. 테스트 결과 코드는 `details.testCode` 에 싣는다. Cafe24 · MakeShop 이 노드와 같은 코드 이름을 쓰는 것은 예외로 적는다.

- 400 으로 둔다. 실패 원인은 대개 새 값이다(틀린 비밀번호 · 토큰). 외부 서버 장애로 실패해도 클라이언트가 할 일은 값을 확인하고 다시 보내는 것으로 같다. 같은 경로가 자격 증명 구조 검증 실패(`INTEGRATION_INVALID_CREDENTIALS`)와 `oauth2` 교체 요청(`INTEGRATION_ROTATE_UNSUPPORTED`)도 400 으로 거절한다. 화면은 이 경로의 거절을 모두 400 으로 받는다.
- 422 는 뺐다. 422 는 2026-04-12 에 이 문서의 전신이 에러 카탈로그에 처음 적은 값이다. 같은 날 들어온 첫 구현은 400 이었고 그 뒤로 422 를 쓴 적이 없다. [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 은 422 를 비즈니스 로직 에러에 쓰지만 지금 백엔드에서 422 를 던지는 곳은 실행 API 한 곳(`executions.controller.ts`)뿐이다. 이 코드를 422 로 옮기면 클라이언트 계약이 바뀌는데 새로 얻는 구분이 없다.
- 테스트 결과의 `code` 는 `details.testCode` 에 싣는다. 이 결정 전의 구현은 이 값을 버려서 화면이 `HTTP_AUTH_FAILED` 와 `HTTP_CONNECT_FAILED` 같은 갈래를 문구로만 알 수 있었다. 최상위 `code` 는 `INTEGRATION_TEST_FAILED` 로 둔다. 이름을 `details.code` 로 두지 않은 것은 값이 에러 코드 카탈로그가 아니라 연결 테스트 결과의 이름공간이기 때문이다. `details.code` 로 두면 에러 코드로 읽혀 «세부 사유는 한 자리에만 싣는다» 와 부딪힌다([에러 응답과 클라이언트 처리 2.3](../CLE-API/CLE-API-ERROR.md#23-도메인-세부-사유를-어디에-싣는가-top-level-code-교체와-detailscode)).
- 교체 실패 토스트는 통합 화면의 다른 토스트와 같은 규칙으로 문구를 고른다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 규칙 5). `INTEGRATION_TEST_FAILED` 는 그 매핑에 넣지 않아 테스트 결과의 `message` 가 영문 그대로 보인다. `details.testCode` 로 사전 문구를 고를지는 정하지 않았다.
- `:id/test` · `preview-test` 의 실패는 그대로 200 결과 객체다. 그 둘은 테스트가 요청의 목적이라 실패도 결과다([설치 대기 연결 테스트는 200 과 `success:false` 로 거절한다](#설치-대기-연결-테스트는-200-과-successfalse-로-거절한다)). 교체는 저장이 목적이고 테스트 실패는 저장을 거절한 이유다.
- 연결 테스트 코드는 노드 코드와 다른 이름공간이라는 원칙은 그대로 두고 이름이 같은 두 무리를 예외로 적었다. Cafe24 · MakeShop 의 인증 · 전송 실패 코드는 연결 테스트와 노드가 같은 API 클라이언트를 써서 이름이 같아졌다. 이름을 연결 테스트 전용으로 가르면 같은 클라이언트가 호출 경로에 따라 다른 이름을 내야 한다. 그래서 이름은 두고 뜻이 다른 자리(MakeShop 403)를 [연결 테스트](#연결-테스트) 에 적었다.

### 설치 대기 연결 테스트는 200 과 `success:false` 로 거절한다

`:id/test` 는 `IntegrationsService.testConnection` 입구에서 설치 대기 행을 외부 호출 없이 거절한다. 토큰이 없어 외부 호출이 의미가 없고 화면의 버튼 비활성을 우회한 API 직접 호출에 대한 백엔드 방어가 필요했다.

- 같은 엔드포인트의 다른 가드 둘(`INTEGRATION_CREDENTIALS_UNREADABLE` 복호화 실패, Cafe24 `pingConnection` 의 `INTEGRATION_INCOMPLETE`, `cafe24-api.client.ts` `mapPingError`)이 모두 200 과 `IntegrationTestResult` 모양이다.
- `:id/test` 는 «검증» 이 아니라 «테스트를 하고 결과를 돌려주는» 엔드포인트라 가드 결과도 같은 `{ success, code, message }` 모양이 자연스럽다.
- 사용자가 «Test Connection» 을 눌렀을 때 결과 카드를 그대로 보이는 흐름이 새 분기에도 그대로 동작해 프런트엔드 변경이 없다.

검토한 다른 안: 422 는 HTTP 의미로 가장 정확하지만 프런트엔드가 결과 카드와 별도 에러 토스트 두 경로를 처리해야 하고 이 서비스의 다른 throw(교체, 권한 범위, `INVALID_CREDENTIALS`)가 모두 400 이라 상태 코드가 늘어나는 부담이 있다. 400 은 기존 throw 와 일관되지만 «입력 검증 실패» 로 읽혀 «자원 상태 거부» 와 맞지 않는다. 가드는 서비스 유형을 보지 않고 상태만 본다. 상태 enum 이 영속 상태의 단일 기준이고 설치 대기를 쓰는 새 서비스에도 자동으로 적용된다. 별도 «엔드포인트 보호 정책» 절을 새로 두는 안은 가드 하나로는 절을 둘 규모가 아니라서 쓰지 않았다. 인접 엔드포인트 비고(precheck 우선순위, begin 멱등 분기)와 같은 표현 방식이라 API 표 비고 한 줄과 이 항목이 가장 가벼운 배치다.

### 사용처 추적에 AI 에이전트 MCP 참조를 넣는다

처음 사용처 추적은 노드 `config.integrationId` 최상위 필드만 훑었다. AI 에이전트 노드는 통합을 `config.mcpServers[].integrationId`(중첩 배열)에 저장하므로 빠졌다. 세 가지 이유로 합집합에 넣는다.

- **스펙 정합**: 에디터 절과 Cafe24·MakeShop 절은 이미 통합이 `mcpServers` 에서 쓰인다고 적고 활동 로그는 MCP 호출을 이미 기록한다. 사용 탭만 빼면 «활동 탭에는 호출이 있는데 사용 탭에는 사용처가 없다» 는 모순이 생긴다.
- **삭제 안전**: 삭제 차단이 같은 쿼리를 쓰므로 MCP 참조가 빠지면 쓰이는 통합이 경고 없이 지워져 AI 에이전트가 깨진다. 멤버가 나가거나 제거될 때의 개인 통합 삭제는 이 차단을 거치지 않는다([나간 멤버의 개인 통합은 나갈 때 지운다](CLE-INT-MANAGE-PERM.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29)).
- **사용자 신뢰**: MCP 도 정당한 사용 형태라 추적되는 편이 기대와 맞다.

`usageKind` 로 `direct`·`mcp` 를 나눠 배지로 보인다. 한 통합이 일반 노드와 MCP 양쪽에서 쓰일 때 사용자가 맥락을 구분하게 한다. 두 경로는 노드 유형상 실제로 겹치지 않지만 방어적으로 `direct` 우선 규칙을 둔다. 쿼리는 직접 참조는 `->>` 비교, MCP 참조는 JSONB containment(`@>`)로 배열 안 객체를 찾는다. `@>` 는 GIN 인덱스를 탈 수 있어 워크플로우가 늘어도 확장된다.
