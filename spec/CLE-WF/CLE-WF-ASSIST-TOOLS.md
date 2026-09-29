---
id: "CLE-WF-ASSIST-TOOLS"
title: "AI 어시스턴트 도구"
type: "design"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "c3b40f5cfda54e6a54976f5554e4a527ad5bf2b70463963364e1faf34f5acec3"
read_as: "approved"
task: null
source_paths: ["spec/3-workflow-editor/4-ai-assistant.md"]
mirror_sha256: "a7db01e6c03d573bd2a484dfaafb32902685c3af4ef104b0d7f904a298e3573f"
etag: "sha256-45ef3932b0e7e5c6956afef579e468516c0c2ebcd62ea67bcf1e65563a53674c"
---
> 구현 상태: 구현됨 · 원문: `spec/3-workflow-editor/4-ai-assistant.md` (§4, §8 워크플로우 조립 규칙 중 버튼 ID 부여, Rationale 의 에러 풍부화 Part A·프로바이더 이상동작 4·11·실행 조회 도구 결정·Runtime ports hint) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

[AI 어시스턴트](CLE-WF-ASSIST.md)가 LLM 에 넘기는 function-calling 도구(어시스턴트 도구, assistant tools)를 정의한다. 백엔드가 도구마다 인자와 반환을 JSON Schema 로 만들어 `ChatParams.tools` 로 전달한다. 도구는 네 부류로 나뉜다. 탐색 도구는 읽기만 한다. 계획 도구는 계획 카드만 바꾼다. 편집 도구는 캔버스를 바꾼다. `finish` 는 어시스턴트 턴을 끝낸다.

편집 도구는 모두 Shadow 검증(`ShadowWorkflow`)을 먼저 거친다. Shadow 검증은 서버 메모리에 둔 워크플로우 사본에 편집을 적용해 보고 규칙 위반을 걸러 내는 장치다. 통과한 호출만 SSE 이벤트로 프론트엔드에 전달되고 에디터 스토어가 그 편집을 캔버스에 반영한다. 도구가 DB 에 직접 쓰는 일은 없다. 영구 저장 경로는 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)의 저장 규칙을 따른다.

이 문서가 다루지 않는 내용은 다음과 같다.

- 대화 루프, 종료 가드, 어시스턴트 도구 호출 한도, 시스템 프롬프트, 패널 화면은 [AI 어시스턴트](CLE-WF-ASSIST.md)가 정한다.
- 도구 호출이 SSE 로 나가는 형식과 메시지에 저장되는 형식은 [AI 어시스턴트 스트리밍과 세션 API](CLE-WF-ASSIST-PROTO.md)가 정한다.
- 재실행을 어시스턴트가 걸지 못하게 하는 정책 근거는 [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md), 실행 데이터 응답 마스킹 정책은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md), 통합 가시성 규칙은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)가 정한다.

## 도구 분류와 공통 인자

| 부류 | 도구 | SSE 발행 | 캔버스 변경 |
|------|------|----------|-------------|
| 탐색 (탐색 단계, read-only) | `get_node_schema`, `list_integrations`, `list_workflows`, `get_workflow`, `get_current_workflow`, `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details`, `verify_workflow` | `tool_call` 이벤트, `kind: 'explore'` | 없음 |
| 계획 (계획 단계, 캔버스 no-op) | `propose_plan`, `clear_plan` | `propose_plan` 은 전용 `plan` 이벤트. `clear_plan` 은 발행하지 않는다 | 없음 |
| 편집 (편집 단계, Shadow 검증 뒤 프론트엔드 반영) | `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` | `tool_call` 이벤트, `kind: 'edit'` | 즉시 반영, 되돌리기(Undo) 가능 |
| 종료 | `finish` | 발행하지 않는다 | 없음 |

이벤트 형식은 [AI 어시스턴트 스트리밍과 세션 API §SSE 이벤트](CLE-WF-ASSIST-PROTO.md#sse-이벤트)에서 정한다.

### 인자 이름 관례

인자 이름은 실제 tool schema(`tool-definitions.ts` 의 JSON Schema 키)를 따르며 표기가 섞여 있다.

- `add_edge` 의 연결선 끝점 인자는 snake_case 다: `source_id`, `source_port`, `target_id`, `target_port`.
- `add_node`·`update_node`·`remove_node`·`remove_edge` 의 식별·페이로드 인자(`id`, `type`, `patch`, `config`, `position` 등)는 camelCase 다.
- 모든 편집 도구에 공통인 계획 단계 인자 `planStepId`·`planStepIds` 도 camelCase 다.
- [`NODE_NOT_FOUND` 힌트](#node_not_found-힌트-규칙) 문구도 snake_case 인자 이름(`source_id`, `target_id`)을 그대로 가리킨다.

### 계획 단계 인자

모든 편집 도구는 선택 인자 `planStepId?: string`(단일, 옛 단축형)과 `planStepIds?: string[]`(여러 개, 권장)를 받는다. 둘 다 주면 합집합으로 모아 해당 단계를 모두 완료 처리한다. 호출 하나가 여러 단계를 한꺼번에 해결하면 배열을 쓴다. 예를 들어 `add_node` 의 `config` 에 버튼까지 넣어 뒤쪽 `update_node` 단계를 대신했다면 `planStepIds: ["s1","s3"]` 로 부른다. 계획 카드의 체크 규칙은 [AI 어시스턴트 §대화 루프](CLE-WF-ASSIST.md#대화-루프)에서 정한다.

## 탐색 도구

탐색 도구는 모두 세션의 `workspace_id` 범위 안에서만 조회한다. 워크스페이스 경계를 넘는 데이터는 돌려주지 않는다.

| 도구 | 인자 | 반환 | 용도 |
|------|------|------|------|
| `get_node_schema` | `type: string` | `{configSchema, ports, description, category}` | 노드 유형 하나의 상세 스키마. 시스템 프롬프트의 노드 카탈로그 요약으로 부족할 때만 부른다 |
| `list_integrations` | `{category?: string}` | `[{id, name, type, category}]` | 현재 워크스페이스에 등록된 통합 목록. 다른 사용자의 개인 통합은 빠진다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md)의 권한 규칙) |
| `list_workflows` | `{limit?: number, search?: string}` | `[{id, name, description, tags, updatedAt}]` | 같은 워크스페이스의 워크플로우 목록. 현재 편집 중인 워크플로우를 빼는 옵션이 있다 |
| `get_workflow` | `{id: UUID, mode?: 'summary'\|'full'}` | `{name, nodes, edges, summary}` | **다른** 워크플로우의 구조 참고(예: "주문 생성" 워크플로우를 읽고 "주문 취소" 설계). 현재 편집 중인 워크플로우는 이 도구로 조회하지 않는다 |
| `get_current_workflow` | 없음 | `{ok, nodes, edges}` (`config` 는 redact 적용) | **현재** 캔버스의 최신 노드·연결선. 같은 턴에서 편집한 뒤 결과를 다시 확인하거나 시스템 프롬프트 스냅샷이 오래됐을 수 있을 때 부른다 |
| `list_knowledge_bases` | 없음 | `[{id, name, documentCount}]` | RAG 노드 설계 때 참고할 지식 저장소 목록 |
| `get_workflow_executions` | `{limit?: number, status?: 'pending'\|'running'\|'completed'\|'failed'\|'cancelled'\|'waiting_for_input'}` | `{ok, workflowId, workflowName, items: [{id, status, startedAt, finishedAt, durationMs, triggerId, nodeStats: {total, completed, failed}}]}` | 세션 워크플로우의 최근 실행 목록. 시작 시각 내림차순. 기본 `limit=10`, 상한 50. 사용자가 실행을 특정하지 않고 "최근 실행이 왜 실패했어?" 처럼 물을 때 후보를 좁힌다. 수동 실행이면 `triggerId` 는 `null` |
| `get_execution_details` | `{id: UUID}` | `{ok, execution, timeline, subExecutions}` ([응답 구조](#get_execution_details-응답-구조)) | 실행 한 건의 전체 타임라인(노드별 상태·입출력·에러). 실패 원인을 찾고 노드 수정 계획을 세우는 데 쓴다. 1단계 서브 워크플로우 자식 실행까지 같은 응답에 담는다 |
| `verify_workflow` | `{verifiedNodeIds: string[], verifiedEdgeIds: string[], requestCoverage: string, concerns?: string[]}` | `{ok: true}` 또는 `{ok: false, error: 'VERIFY_INCOMPLETE', missingNodeIds, missingEdgeIds}` | 종료 가드 3단계(자기 검토 외부화) 도구. LLM 이 검토한 노드·연결선 ID 를 보고하면 서버가 현재 캔버스의 모든 노드·연결선이 들어 있는지 대조한다. 전부 들어 있으면 `ok: true` 로 자기 검토를 끝내 다음 `finish` 가 통과한다. 빠진 것이 있으면 `VERIFY_INCOMPLETE` 와 누락 ID 목록을 돌려줘 LLM 이 확인 뒤 다시 부르게 한다. Shadow 만 읽고 외부 자원에 접근하지 않아 `kind='explore'` 로 발행된다 |

`verify_workflow` 가 끼는 종료 가드 흐름은 [AI 어시스턴트 §종료 가드](CLE-WF-ASSIST.md#종료-가드)에서 정한다.

### 현재 워크플로우 조회는 두 층이다

1. 매 턴 시작 시점의 캔버스 스냅샷이 시스템 프롬프트에 JSON 으로 들어 있다. "현재 캔버스에 무엇이 있나?" 같은 단순 조회는 도구를 부르지 않고 프롬프트를 읽어 답한다.
2. 편집 도구를 부른 뒤 결과 상태를 다시 확인해야 할 때만 `get_current_workflow` 를 부른다.

### `get_node_schema` 반복 조회 제한

같은 턴 안에서 같은 노드 유형을 반복 조회하면 턴 범위 캐시(`schemaCache: Map<string, { result, hits }>`)가 막는다. `hits` 는 호출 순번 그 자체다.

| 순번 | 동작 |
|------|------|
| 1 (첫 호출) | 정상 실행하고 캐시에 넣는다 |
| 2 | 캐시 결과와 함께 `warning: 'REDUNDANT_SCHEMA_LOOKUP'`, `cached: true` 를 싣는다 |
| 3 이상 (`SCHEMA_LOOKUP_HARD_STOP`) | `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` 로 멈춘다 |

`add_node`·`update_node` 결과에 [런타임 포트 목록](#런타임-포트-목록)이 실리므로 `get_node_schema` 는 거의 필요하지 않다. 이번 턴에 직접 편집하지 않은 노드(스냅샷에만 있는 노드)에 연결선을 이을 때만 부른다.

## 실행 조회 도구

`get_workflow_executions` 와 `get_execution_details` 는 사용자가 "왜 실행이 실패했어?" 같은 질문을 할 때 실행 결과를 읽어 원인을 진단하고 노드 수정으로 이어 가게 하는 읽기 전용 도구다. 두 도구 모두 `kind='explore'` 이며 계획 전용 턴에서도 쓸 수 있다. 쓰는 순서(목록 → 한 건 상세)는 [AI 어시스턴트 §시스템 프롬프트](CLE-WF-ASSIST.md#시스템-프롬프트)가 LLM 에 가르친다.

### 조회 범위

실행 조회는 세션의 `workflow_id` 에 묶인다. `get_workflow_executions` 는 `workflowId` 인자를 받지 않고 세션 워크플로우의 실행만 돌려준다. `get_execution_details` 는 실행 ID 를 받지만 그 실행이 다음 둘 중 하나여야 한다.

- 현재 워크플로우의 실행
- 그 실행 트리의 직계 자식 실행(부모 실행의 워크플로우 호출 노드가 부른 서브 워크플로우의 자식 `Execution`)

판정 순서는 이렇다.

1. 실행을 ID 로 찾는다. 없으면 `EXECUTION_NOT_FOUND` 다.
2. 실행의 워크스페이스가 세션 워크스페이스와 다르면 `EXECUTION_NOT_FOUND` 와 똑같이 다룬다. 다른 워크스페이스 실행의 존재를 드러내지 않기 위해서다.
3. `execution.workflowId` 가 세션 워크플로우와 같으면 통과한다.
4. 아니면 `execution.parentExecutionId` 가 가리키는 부모를 한 번 조회한다. 부모의 `workflowId` 가 세션 워크플로우와 같으면 통과한다.
5. 둘 다 아니면 `EXECUTION_NOT_IN_SCOPE` 로 거부한다.

다른 워크플로우의 독립 실행을 보려면 사용자가 그 워크플로우의 에디터와 AI 어시스턴트로 옮겨 가야 한다.

### 자식 실행 확장

통과한 실행의 직계 자식(`parentExecutionId` 가 그 실행인 실행)을 모두 조회해 `subExecutions` 에 담는다. 손자 이상(2단계)은 채우지 않는다. 자식 가운데 하나라도 그 아래 서브 워크플로우 실행이 있으면 `subExecutionsTruncatedDepth` 를 싣는다. 더 깊은 실행은 자식 실행 ID 로 따로 조회한다.

### `get_execution_details` 응답 구조

```typescript
interface ExecutionDetailsResponse {
  ok: true;
  execution: {
    id: UUID;
    workflowId: UUID;
    workflowName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_input';
    startedAt: string;            // ISO 8601
    finishedAt: string | null;    // 진행 중·입력 대기 동안 null
    durationMs: number | null;
    inputData: unknown;           // 마스킹
    outputData: unknown | null;   // 마스킹
    error: unknown | null;        // 마스킹
    parentExecutionId: UUID | null;  // 다른 실행의 서브 워크플로우로 불렸다면 그 부모 ID
    recursionDepth: number;       // 최상위 = 0
  };
  timeline: Array<{
    nodeExecutionId: UUID;
    nodeId: UUID;
    nodeLabel: string;
    nodeType: string;
    // 노드 실행 상태 값은 실행 상태 머신 문서를 따른다
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped' | 'waiting_for_input';
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    inputData: unknown;           // 마스킹
    outputData: unknown | null;   // 마스킹
    error: unknown | null;        // 마스킹
    retryCount: number;
    parentNodeExecutionId: UUID | null;  // 인라인 서브 워크플로우·컨테이너 묶음
  }>;
  subExecutions: Array<{          // 직계 자식 실행(1단계). 2단계 이상은 자식 ID 로 따로 호출
    execution: /* 위 execution 과 같은 필드 */;
    timeline: /* 위 timeline 과 같은 구조 */;
  }>;
  subExecutionsTruncatedDepth?: number;  // 자식 안에 서브 워크플로우가 더 있으면 "N 단계 이후 생략" 신호
  timelineTruncated?: true;              // 이 실행의 timeline 이 500행을 넘어 앞 500행만 담았다. subExecutions[*].timelineTruncated 도 자식별로 같은 뜻
}
```

타임라인 `status` 의 값 집합은 [실행 상태 머신과 대기·재개 §노드 실행 상태](../CLE-EXEC/CLE-EXEC-STATE.md#노드-실행-상태)를 따른다. 조회는 DB 의 상태 값을 그대로 옮기므로 취소된 실행을 조회하면 `cancelled` 가 나온다.

### 마스킹

`inputData`·`outputData`·`error` 는 서버가 두 층을 겹쳐 가린 뒤 돌려준다.

1. 키 이름 기준 `maskSensitiveFields` 를 먼저 적용한다.
2. 그 위에 값 패턴 기준 `deepRedactSecrets` 를 적용한다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)).

두 층을 거친 값은 `"***"` 로 나간다. 객체와 배열은 재귀로 훑는다. 키 이름은 남기므로 어떤 키가 가려졌는지는 응답에서 읽을 수 있다. DB 원문은 그대로 두고 읽는 순간에만 바꾼다. 순서는 키 먼저, 값 나중이다. 순서를 뒤집으면 두 층이 서로의 결과를 지운다. 이 조합은 `redactAssistantFields` 가 맡는다.

- **포맷은 이 도구만의 합성 결과다.** `maskSensitiveFields` 자체의 포맷은 `"****<last4>"` 로 바뀌지 않는다. 같은 유틸을 쓰는 다른 곳(AI 에이전트 노드)은 포맷 면에서 영향을 받지 않는다. 여기서 `"***"` 가 되는 것은 위에 겹친 `deepRedactSecrets` 가 값을 다시 덮기 때문이다. 노드 `config` 의 설정 에코는 응답 마스킹 단계에서만 가린다.
- **가리는 키는 넓어졌다.** 옛 리터럴 목록(`apiKey`, `api_key`, `password`, `token`, `accessToken`, `refreshToken`, `secret`, `clientSecret`, `authorization`)은 접두형 `token` 계열(`csrf_token`, `auth_token`, `session_token`, `csrfToken`)을 통과시켰다. 겹친 층의 `CREDENTIAL_KEY_PATTERN` 이 이 계열을 덮는다. 이 확장은 공유 목록(`DEFAULT_SENSITIVE_KEYS`)을 넓히므로 같은 유틸을 쓰는 다른 곳도 가리는 범위가 넓어진다. 포맷은 그대로이고 대상만 늘었다.
- **남은 빈틈은 그대로 이어받는다.** `deepRedactSecrets` 가 일부러 통과시키는 값은 이 도구에서도 통과한다. 목록은 여기서 다시 적지 않고 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)의 "의도한 잔여 빈틈" 전체를 따른다.

### 페이로드 크기

- `inputData`·`outputData`·`error` 개별 필드에는 크기 상한을 두지 않는다. 목록 → 한 건 상세 순서의 2단계 조회로 LLM 이 폭주를 스스로 피하게 한다.
- 타임라인 행 수는 실행 한 건당 500행으로 제한한다. 루프 노드가 수천 번 돈 실행을 직렬화하다 컨텍스트가 넘치는 것을 막기 위해서다. 넘치면 앞 500행만 담고 `timelineTruncated: true` 를 싣는다. 자식 실행 타임라인도 각각 같은 상한을 쓴다. LLM 은 이 플래그가 켜지면 사용자에게 "앞쪽 500 단계까지만 본 상태" 라고 알린다.
- 한 턴에 큰 페이로드를 세 번 이상 조회하면 [어시스턴트 도구 호출 한도](CLE-WF-ASSIST.md#어시스턴트-도구-호출-한도)에 가까워질 수 있다.

### 진행 중 실행은 스냅샷이다

`running`·`waiting_for_input` 실행을 조회하면 응답을 만드는 시점까지의 부분 상태를 돌려준다. 서비스가 타임라인·자식 실행·2단계 존재 여부를 병렬 쿼리로 모으므로 쿼리 사이에 상태가 바뀌면 세 결과의 시점이 몇 밀리초 어긋날 수 있다. 같은 실행 ID 를 다시 조회하면 어긋남이 풀린다. LLM 도 결과를 "조회 시점 스냅샷" 으로 알고 사용자에게 보고한다.

| `execution.status` | 동작 |
|--------------------|------|
| `completed`, `failed`, `cancelled` | 완결된 타임라인을 돌려준다 |
| `running`, `waiting_for_input` | 지금까지 기록된 부분 타임라인을 돌려준다. 아직 돌지 않은 노드는 빠지고 진행 중인 노드는 `running`·`waiting_for_input` 으로 표시된다. `execution.finishedAt`·`durationMs` 는 `null` 이다 |
| `pending` | 첫 노드도 시작하지 않은 상태다. `timeline` 은 빈 배열이고 `execution` 필드만 채운다 |

실행 중 편집 도구를 거부하는 규칙([AI 어시스턴트 요구사항](CLE-WF-ASSIST.md#요구사항)의 `ASSISTANT_WORKFLOW_RUNNING`, 미구현)은 조회 도구에는 적용하지 않는다. AI 어시스턴트는 실행 중인 워크플로우도 진단 목적으로 조회할 수 있다.

### 에러 코드

| 코드 | 상황 |
|------|------|
| `EXECUTION_NOT_FOUND` | ID 가 없거나 워크스페이스 경계 밖이다 |
| `EXECUTION_NOT_IN_SCOPE` | ID 는 있지만 현재 세션 워크플로우의 실행도, 그 직계 자식 실행도 아니다 |

## 재실행 요청 처리

실행 조회 도구는 실행을 다시 걸지 않는다. AI 어시스턴트가 부를 수 있는 재실행 도구(`re_run_execution` 등)는 정의하지 않는다. 사용자가 재실행을 요청할 때 어시스턴트가 답하는 순서와 안내 문구, 신뢰 단계(G2) 검토는 [재실행 §RR-PL-07](../CLE-EXEC/CLE-EXEC-RERUN.md#rr-pl-07-ai-어시스턴트-비트리거-g1)에서 정한다.

어시스턴트가 안내에 붙이는 실행 상세 페이지 딥링크는 `/w/<slug>/workflows/:workflowId/executions/:executionId` 다. `<slug>` 는 현재 워크스페이스 slug 다([레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)). 재실행 버튼은 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md)의 실행 상세 페이지에 있다.

## 계획 도구

| 도구 | 인자 | 반환 | 용도 |
|------|------|------|------|
| `propose_plan` | `{title: string, summary: string, steps: Step[], openQuestions?: string[]}` | `{ok: true, planId: UUID}` | 사용자에게 계획 카드를 제시한다. 활성 계획이 있을 때 부르면 활성 계획을 새 계획으로 바꾼다. 화제 전환이 아니라 계획을 고칠 때의 정상 경로다 |
| `clear_plan` | `{reason?: string}` | `{ok: true, cleared: true}` | 활성 계획을 세션 컨텍스트에서 지운다. 사용자가 전혀 다른 작업을 요청했거나 계획을 버린다고 밝힌 경우처럼 화제가 완전히 바뀌었을 때만 부른다. 부른 뒤로는 시스템 프롬프트의 활성 계획 컨텍스트가 사라지고 종료 가드도 그 계획을 기준으로 동작하지 않는다 |

```typescript
interface Step {
  id: string;            // LLM 이 정한다. 편집 도구의 planStepId 와 맞춘다
  action: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'remove_edge' | 'note';
  description: string;   // 사용자에게 보일 설명 (i18n 대응)
  rationale?: string;    // 왜 필요한지 (선택)
}
```

`propose_plan` 을 부른 턴에 편집 도구를 부르면 [Shadow 검증](#shadow-검증-규칙)이 `PLAN_AWAITING_APPROVAL` 로 거부한다. 계획 카드와 승인 흐름은 [AI 어시스턴트 §대화 루프](CLE-WF-ASSIST.md#대화-루프)에서 정한다.

## 편집 도구

| 도구 | 인자 | 반환 |
|------|------|------|
| `add_node` | `{type, label, position: {x, y}, config, planStepId?, planStepIds?}` | `{ok, id?, ports?, error?, pendingUserConfig?}` |
| `update_node` | `{id, patch: {label?, config?, position?}, planStepId?, planStepIds?}` | `{ok, ports?, error?, pendingUserConfig?}` |
| `remove_node` | `{id, planStepId?, planStepIds?}` | `{ok, removedEdgeIds?, error?}` |
| `add_edge` | `{source_id, source_port?, target_id, target_port?, type?, planStepId?, planStepIds?}` | `{ok, id?, error?}` |
| `remove_edge` | `{id, planStepId?, planStepIds?}` | `{ok, error?}` |
| `finish` | `{summary?: string}` | 성공이면 루프를 끝낸다(`finishReason: 'stop'`). 막히면 `{ok: false, error: 'PLAN_NOT_COMPLETE', pendingSteps, openQuestions}` 또는 품질 점검·요청 대조 결과를 돌려주고 루프가 이어진다 |

- `ports` 는 [런타임 포트 목록](#런타임-포트-목록), `pendingUserConfig` 는 [사용자 선택 필드 후보](#사용자-선택-필드-후보)를 따른다.
- 성공 응답에는 `configWarnings`(설정 경고), `warning`(계획 단계 누락 경고)이 붙을 수 있다([Shadow 검증 규칙](#shadow-검증-규칙)).
- `update_node`·`remove_node`·`add_edge` 의 `id`·`source_id`·`target_id` 자리에는 노드 UUID 만 쓴다. UUID 의 출처는 직전 `add_node` 성공 응답의 `result.id` 와 `currentWorkflow.nodes[*].id` 두 가지뿐이다. 라벨을 넣으면 `NODE_NOT_FOUND` 가 난다.
- `finish` 는 어시스턴트 턴을 끝내는 신호다. 막는 조건(계획 완결성·품질 점검·요청 대조)과 막힌 뒤의 동작은 [AI 어시스턴트 §종료 가드](CLE-WF-ASSIST.md#종료-가드)에서 정한다.

### 버튼 ID 자동 부여

`add_node`·`update_node` 에서 Carousel·Chart·Table·Template 노드의 버튼 항목 `id` 가 비어 있으면 서버가 안정된 slug 를 붙인다. Shadow 가 부르는 `normalizeNodeButtonIds`(구현 `nodes/core/button-slug.util.ts`)가 맡는다.

- `label` 을 kebab-case 로 바꿔 slug 를 만든다. 겹치면 `-2`, `-3` 접미사를 붙인다.
- `label` 이 영문·숫자가 아니면 순번 ID(`btn_${i}` 등)로 대신한다.
- 이미 있는 ID 는 항상 보존한다. 사용자가 나중에 라벨만 고쳐도 slug 를 다시 만들지 않으므로 연결선이 끊기지 않는다.
- 이 정책을 넣기 전에 저장된 워크플로우의 빈 버튼 ID 는 `codebase/backend/src/scripts/migrate-button-ids.ts` backfill 이 순번 ID 로 채웠다. 따라서 도입 시점 기준 모든 버튼에 ID 가 있다.

## 사용자 선택 필드 후보

`add_node`·`update_node` 성공 응답에 한해 서버가 노드의 zod `configSchema` 를 훑는다. 사용자가 직접 골라야 하는 선택기 필드 가운데 값이 빈 항목을 모아 `pendingUserConfig: PendingUserConfigField[]` 로 싣는다. 빈 항목이 없거나 대상 위젯이 없으면 필드 자체를 뺀다. 프론트엔드는 이 값으로 편집 버블 안에 후보 선택기(candidate picker)를 그린다([AI 어시스턴트 §패널 화면](CLE-WF-ASSIST.md#패널-화면)).

```typescript
interface PendingUserConfigField {
  /** config 안 경로 (예: 'integrationId', 'llmConfigId'). */
  field: string;
  /** 스키마 meta 의 ui.label (i18n 을 거친 최종 문구가 아닌 raw key/label). */
  label: string;
  widget:
    | 'integration-selector'
    | 'llm-config-selector'
    | 'kb-selector'
    | 'workflow-selector'
    | 'mcp-server-selector';
  /**
   * 서버가 워크스페이스 범위에서 조회한 후보. 상한 20개.
   * 해당 종류가 하나도 없으면 빈 배열([])이다. 빈 배열은
   * "조회했지만 후보가 없음" 이라는 명시 신호라 undefined 와 다르다.
   */
  candidates: CandidateEntry[];
}

interface CandidateEntry {
  /** 실제 ID (integration.id · llm_config.id · knowledge_base.id · workflow.id). */
  id: string;
  /** 드롭다운에 보일 주 텍스트. */
  label: string;
  /** 보조 텍스트 (예: serviceType='smtp', model='gpt-4o'). 없을 수 있다. */
  sublabel?: string;
}
```

### 위젯별 후보 조회 범위

| 위젯 | 조회 대상 | 조건과 정렬 |
|------|-----------|-------------|
| `integration-selector` | 통합(`Integration`) | `workspace_id` 일치, `status='connected'`, 요청자에게 보이는 것만(다른 사용자의 개인 통합 제외, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)). 노드 스키마 meta 에 `integrationServiceType` 힌트가 있으면 그 `service_type` 만 고른다. 힌트는 문자열 하나 또는 `string[]` 이며 배열이면 `service_type IN (...)` 로 조회한다. 힌트가 없으면 연결된 통합 전체다 |
| `mcp-server-selector` | 통합(`Integration`) | `workspace_id` 일치, `status='connected'`, 요청자에게 보이는 것만, `service_type` 이 MCP 가능 서비스 전체(`MCP_CAPABLE_SERVICE_TYPES`, backend `integrations/services/mcp-capable-service-types.ts`)에 드는 것. AI 에이전트 노드의 `mcpServers` 필드 전용이다. 힌트 허용 목록은 `['mcp', 'cafe24', 'makeshop']` 이며 단일 기준은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)의 `serviceTypes` 허용 목록이다. 내부 MCP 브리지([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md))가 적용되는 `service_type` 이 늘면 함께 고친다. 여러 개를 고를 수 있다 |
| `llm-config-selector` | 모델 설정(`ModelConfig`, `kind=chat`) | `workspace_id` 일치. 최근 수정 순 |
| `kb-selector` | 지식 저장소(`KnowledgeBase`) | `workspace_id` 일치. 이름 오름차순. 여러 개를 고를 수 있다 |
| `workflow-selector` | 워크플로우(`Workflow`) | 같은 `workspace_id` 이고 `id != session.workflow_id`(현재 편집 중인 워크플로우 제외). 최근 수정 순 |

위젯마다 후보는 20개까지다. 넘는 후보는 응답에서 자르고 프론트엔드는 후보 선택기에 "Settings 에서 더 많은 후보 보기" 링크를 붙인다.

### LLM 과의 계약

- LLM 은 선택기 필드의 ID 를 채우지 않는다. 추측도 발명도 하지 않고 빈 값 그대로 `add_node`·`update_node` 를 부른다. 서버가 후보를 찾아 싣는다.
- LLM 은 `pendingUserConfig` 를 보고 따로 행동하지 않는다. 이 필드는 프론트엔드 화면 전용이라 다음 LLM 라운드의 tool_result 로 돌려주지 않는다. 사용자가 고른 값은 LLM 을 거치지 않고 에디터 스토어로 바로 간다.
- 후보가 0개인 항목만 LLM 이 마무리 메시지에서 언급한다. 이 규칙과 품질 점검(`PENDING_USER_CONFIG_UNMENTIONED`)은 [AI 어시스턴트](CLE-WF-ASSIST.md)에서 정한다.

## 런타임 포트 목록

`add_node`·`update_node` 성공 응답에는 그 노드의 런타임 포트 목록이 붙는다. 동적 포트 노드(Carousel 버튼, Switch 케이스, AI 에이전트 조건 등)는 현재 `config` 로 해석한 실제 포트 ID 까지 담는다. 그래서 LLM 은 `get_node_schema` 를 따로 부르지 않고 다음 `add_edge` 의 `source_port`·`target_port` 를 채울 수 있다. 잘못된 포트로 먼저 보내고 `PORT_NOT_FOUND` 를 받아 한 라운드를 더 쓰는 패턴이 구조적으로 사라진다(ED-AI-40).

```typescript
interface RuntimePorts {
  outputs: RuntimePortDescriptor[];
  inputs: RuntimePortDescriptor[];
}

interface RuntimePortDescriptor {
  /** add_edge 의 source_port / target_port 에 그대로 쓸 포트 ID. */
  id: string;
  /**
   * 'data'(기본) 또는 'error'. add_edge 의 `type` 을 정하는 힌트다.
   *   - 'data'  → `type: 'data'` (정상 흐름)
   *   - 'error' → `type: 'error'` (에러 분기)
   * 생략하면 'data' 로 본다.
   */
  type?: 'data' | 'error';
  /**
   * 동적 포트 노드에서 사용자가 정한 라벨 (예: Carousel 버튼 "한식" / "양식").
   * LLM 이 포트를 가리킬 때는 id 를 쓰지만, 배지·툴팁 같은 화면에서
   * 다시 쓸 수 있게 함께 싣는다. 정적 포트는 대개 비어 있다.
   */
  label?: string;
}
```

### 조립 규칙

| 종류 | `outputs` | `inputs` |
|------|-----------|----------|
| 정적 포트 노드 | `NodeComponentRegistry` 의 `ports.outputs` ID 목록 | `ports.inputs` ID 목록 |
| 동적 포트 노드 | `resolveEffectiveOutputPorts(config, def)` 결과. 사용자가 넣은 `cases[*].id`·`buttons[*].id` 가 유효하면 그대로, 없으면 `case_0`·`btn_0` 같은 순번 ID 를 발행한다 | 기본 `in` (입력은 정적) |

- 동적 포트 노드의 하위 항목(`switch.cases`, `ai_agent.conditions`, `text_classifier.categories`, Carousel·Table·Chart·Template 의 `items[*].buttons`·`itemButtons`·`buttons`)에는 안정되고 고유한 `id` 가 있어야 한다. 없으면 resolver 가 `case_0`·`cond_0`·`class_0`·`items_0_btn_1` 같은 순번 ID 로 포트를 내고 `result.ports` 에도 같은 ID 가 실린다. LLM 은 그 ID 로도 연결할 수 있다. 다만 나중에 사용자가 항목을 고치면 순번이 다시 매겨질 위험이 있으므로 가능하면 안정된 ID 를 직접 지정한다. 포트 ID 규칙은 [노드 포트와 설정 패널](CLE-WF-NODEPANEL.md)을 따른다.
- 정보 추출기 노드(`information_extractor`)는 `config.mode` 에 따라 시스템 포트(`completed`·`user_ended`·`max_turns`·`error` 또는 `out`·`error`)만 내므로 하위 항목 ID 가 없다.
- 한 응답에서 `outputs`·`inputs` 는 각각 50개까지다. 동적 버튼을 극단적으로 많이 넣은 경우의 응답 폭주를 막는다. 잘렸으면 `result` 에 `portsTruncated?: true` 를 함께 싣는다. 이 플래그가 켜지면 LLM 은 `ports` 에 없는 포트 ID 를 추측하지 말고 `get_node_schema` 로 전체 목록을 조회한다. `shadow-workflow.ts` 구현과 frontend `lib/api/assistant.ts` 타입도 같은 전제다.

### LLM 과의 계약

- `add_node`·`update_node` 가 성공하면 LLM 은 `result.ports.outputs[*].id` 를 그대로 `add_edge { source_port: ... }` 에 쓴다. 추측하거나 하드코딩하지 않는다.
- `type === 'error'` 인 포트에는 `add_edge { type: 'error', ... }` 를 쓴다.
- `get_node_schema` 가 필요한 경우는 이번 턴에 `add_node`·`update_node` 로 직접 고치지 않은 노드(스냅샷에만 있는 노드)에 연결선을 이을 때뿐이다.

### 동적 포트 해석의 단일 기준

backend `tools/resolve-dynamic-ports.ts` 가 동적 포트 해석의 단일 기준이다. frontend `codebase/frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 옮겨 왔고 `DynamicPortsSpec` 여섯 종(switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches)을 모두 지원한다. 반환에는 `isUserConfigured: boolean` 이 더 있다. 사용자가 만든 포트(strong)와 프레임워크가 합성한 포트(weak)를 가르며 품질 점검의 `DANGLING_OUTPUT_PORTS` 가 이 값으로 걸러 낸다. frontend 사본과 어긋나지 않도록 `resolve-dynamic-ports.spec.ts` 가 kind 별 시나리오 16개를 맞춰 둔다.

## Shadow 검증 규칙

| 규칙 | 실패 시 반환 |
|------|--------------|
| `type` 은 등록된 노드 유형이어야 한다 | `{ok: false, error: 'UNKNOWN_NODE_TYPE', knownTypes?, suggestedType?, hint?}` ([에러 보강 필드](#에러-보강-필드)) |
| `label` 은 워크플로우 안에서 유일해야 한다 | `{ok: false, error: 'LABEL_CONFLICT', suggested?: string, repeatCount?, hint?}` |
| `add_edge` 의 source·target 과 `update_node`·`remove_node` 의 `id` 가 있어야 한다 | `{ok: false, error: 'NODE_NOT_FOUND', hint?: string}` ([힌트 규칙](#node_not_found-힌트-규칙)) |
| `add_edge` 의 source·target 포트가 있어야 한다 | `{ok: false, error: 'PORT_NOT_FOUND', portInfo: {knownPorts}}`. `ShadowWorkflow.addEdge` 가 `portResolver`(stream 서비스가 `resolveEffectiveOutputPorts` 로 주입)로 포트를 확인한다. 설정 수정이 실패해 생기지 못한 동적 포트에 연결선을 붙이려는 실수를 첫 시도에서 잡는다. 컨테이너 되돌아오기 `emit` 포트는 허용한다 |
| 트리거 노드는 컨테이너 자식이 될 수 없다 | `{ok: false, error: 'CONTAINER_INVALID_CHILD'}` |
| 수동 트리거 노드는 지울 수 없다 | `{ok: false, error: 'MANUAL_TRIGGER_PROTECTED'}` |
| 순환을 만들면 안 된다 | `{ok: false, error: 'CYCLE_DETECTED'}`. 다만 source 노드의 조상 `containerId` 체인 가운데 하나가 target 과 같고 target 포트가 `emit` 이면 허용한다. 자식이 자기나 조상 컨테이너로 돌아가는 반복 되돌아오기 연결선이기 때문이다. 실행 엔진이 `containerId` 로 컨테이너 내부 그래프를 떼어 처리하는 것과 뜻이 맞는다. `emit` 이 아닌 포트(예: `target_port: 'in'`)로 돌아오는 연결선은 반복 의도가 아닌 실수로 보고 순환으로 판정한다 |
| `add_node`·`update_node` 의 최종 `config` 는 노드별 `handler.validate` 도메인 규칙(버튼 수 상한, 정적·동적 필수 필드, 중복 ID 등)을 지키는 것이 권장된다. 저장 자체는 막지 않는다 | 성공 응답(`ok: true`)에 `configWarnings?: string[]` 로 `handler.validate` 의 에러를 5개까지 싣는다. LLM 은 경고만 받고 다음 턴에 `update_node` 로 고치거나 그대로 둘 수 있다. 실행 시점에 실행 엔진이 같은 규칙을 다시 검사해 최종 차단한다 |
| 같은 턴에 `propose_plan` 을 부른 뒤 편집 도구를 부르면 안 된다(계획 전용 턴) | `{ok: false, error: 'PLAN_AWAITING_APPROVAL', message}`. LLM 은 한국어 메시지로 턴을 끝내고 사용자 승인을 기다린다 |

실패하면 LLM 은 tool_result 를 받아 다시 시도하거나 사용자에게 상황을 알린다. 컨테이너·수동 트리거 노드 제약의 원래 규칙은 [워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md)와 [연결선](CLE-WF-EDGE.md)이 정한다.

### 성공이지만 경고가 붙는 경우

| 규칙 | 반환 |
|------|------|
| 활성 계획이 있는데 편집 호출에 `planStepId`·`planStepIds` 가 없다 | `{ok: true, ..., warning: 'MISSING_PLAN_STEP_ID', warningMessage}`. 편집은 성공했지만 계획 카드의 체크가 되지 않는다. LLM 은 다음 편집부터 반드시 단계 ID 를 붙인다 |

### 에러 보강 필드

Shadow 결과(`ShadowResult`)에는 복구를 돕는 선택 필드가 붙는다.

| 필드 | 붙는 경우 |
|------|-----------|
| `knownTypes: string[]` | `UNKNOWN_NODE_TYPE`. 정렬된 등록 유형 목록, 최대 `KNOWN_TYPES_MAX=40` |
| `suggestedType: string` | `UNKNOWN_NODE_TYPE`. 별칭 맵(`NODE_TYPE_ALIASES`)에 걸리면 그 값을 먼저 쓰고 없으면 Levenshtein 거리 3 이하인 유형 |
| `repeatCount: number` | `LABEL_CONFLICT` 가 같은 라벨로 `LABEL_CONFLICT_REPEAT_THRESHOLD`(=2)번 이상 반복될 때 |
| `hint: string` | 복구 지침 한 문장. `UNKNOWN_NODE_TYPE`(별칭·Levenshtein·후보 없음마다 문구가 다르다), `LABEL_CONFLICT`(`repeatCount` 2 이상), `NODE_NOT_FOUND` 에서 붙는다 |

별칭 맵은 LLM 이 목록에 없는 유형 이름을 지어낼 때 실제 유형으로 이끈다. 별칭 대상이 레지스트리에 실제로 있을 때만(`this.knownNodeTypes.has(aliasHit)`) `suggestedType` 으로 싣는다. 레지스트리가 바뀌어도 없는 유형을 권하지 않기 위해서다.

| 지어낸 이름 | 실제 유형 |
|-------------|-----------|
| `error_message`, `error`, `alert`, `notification`, `message`, `text` | `template` |
| `display`, `show`, `render`, `result`, `output` | `template` |
| `user_input`, `input`, `question`, `prompt`, `survey`, `text_input` | `form` |
| `choice`, `choices`, `options`, `selection`, `selector`, `button_group`, `category`, `buttons` | `carousel` |
| `router`, `route`, `branch`, `conditional` | `switch` (참·거짓 분기는 `if_else`) |
| `email`, `send_mail`, `mail` | `send_email` |

`LABEL_CONFLICT` 는 실패한 노드 생성으로 세지 않는다. `addNode()` 의 `LABEL_CONFLICT` 분기에서는 `recordFailedAddNode` 를 부르지 않는다.

LLM 이 자유 텍스트로 채운 값(라벨, `attemptedType`)을 힌트나 에러 메시지에 넣을 때는 반드시 `sanitizeLlmProvidedString(value, maxLen)` 을 거친다. 제어 문자·개행을 없애고 백틱·꺾쇠를 중화하고 길이를 자른다. 길이 상수는 `ATTEMPTED_TYPE_MAX_LEN = 64`(노드 유형 후보), `LABEL_HINT_MAX_LEN = 80`(`NODE_NOT_FOUND` 힌트의 라벨 목록)이다.

### `NODE_NOT_FOUND` 힌트 규칙

`update_node`·`remove_node`·`add_edge` 가 `NODE_NOT_FOUND` 로 실패할 때, 복구 가능성이 높은 두 패턴이면 서버가 `hint` 필드로 복구 지침을 붙인다. 힌트 문자열 안의 LLM 제공 자유 텍스트(라벨 등)는 `sanitizeLlmProvidedString` 으로 개행·제어 문자·`<>` 를 중화한다. C0·C1 제어 문자, Bidi, zero-width 문자까지 중화한다. 라벨 오인 힌트는 추가로 `[hint] … [/hint]` 고정 마커로 감싸 LLM 이 힌트 범위를 지시문으로 오해하지 않게 한다.

| 힌트 | 붙는 조건 | 대표 문구 |
|------|-----------|-----------|
| 앞선 `add_node` 실패 연쇄 | `add_edge` 전용. 같은 턴에 `add_node` 가 한 번이라도 실패했다 | `A prior add_node failed in this turn (labels: […]). The UUID you are referencing does not exist because that node was never created. Fix the upstream add_node failures first, then wire the edges.` |
| 라벨 오인 | `update_node`·`remove_node` 는 항상, `add_edge` 는 연쇄 대상이 없을 때. 받은 ID 값이 Shadow 안 어떤 노드의 `label` 과 정확히 같으면 그 노드의 UUID 를 알려 준다 | `[hint] Value "SendEmail" matches the label of an existing node (id: 11111111-…). Tool arguments use UUIDs, not labels — use the id value from a prior add_node result or from currentWorkflow.nodes[*].id. [/hint]` |

`add_edge` 의 우선순위는 이렇다.

1. 실패한 `add_node` 기록(FIFO)이 비어 있지 않으면 연쇄 힌트를 쓴다.
2. 비어 있을 때만 라벨 오인 힌트로 넘어간다. source 쪽을 먼저 보고 source 가 실제로 없고 라벨이 맞으면 그 힌트를 쓴다. 아니면 target 쪽을 본다.
3. 한 응답에는 힌트를 하나만 싣는다. source·target 이 모두 라벨 실수여도 source 힌트만 보내 LLM 이 source 를 먼저 고친 뒤 target 을 다시 시도하게 한다.

길이와 보안 정책은 다음과 같다.

- `value.length > LABEL_HINT_MAX_LEN * 4` 인 값은 라벨 후보에서 뺀다. 터무니없이 긴 값을 비교하지 않기 위해서다.
- 라벨과 값 문자열은 sanitize 뒤 `JSON.stringify` 로 escape 한다. UUID 는 `[0-9a-f-]` 만 담으므로 그대로 넣는다.
- 공백만 있는 ID 에는 힌트를 붙이지 않는다.
- `hint` 는 원래부터 선택 필드이므로 기존 `NODE_NOT_FOUND` 소비자는 힌트 없이도 똑같이 동작한다.
- `[hint] … [/hint]` 마커는 라벨 오인 힌트에만 쓴다. 연쇄 힌트 등 다른 힌트는 원래 형식을 유지한다.

## 미결 사항

- **Background 본문 실행 조회 도구**: [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md)는 AI 어시스턴트가 `get_background_run(executionId, backgroundRunId)`·`list_background_runs(executionId)` 로 Background 본문 실행을 조회할 수 있고 도구 상세는 이 문서에서 정한다고 적는다. 이 문서의 탐색 도구 목록과 요구사항(ED-AI-35 의 "도구 2종")에는 두 도구가 없다. 현재 구현의 `TOOL_KIND_BY_NAME` 에도 없다. Background 문서는 이 요구를 미구현으로 표시하고 같은 문제를 [Background 노드 §미결 사항](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#미결-사항)에 적는다. 도입하면 두 도구를 [탐색 도구](#탐색-도구) 절에 정의한다. 도입할지, Background 쪽 서술을 계획으로 내릴지 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/tool-definitions.ts` (도구 스키마, `TOOL_KIND_BY_NAME`)
- `codebase/backend/src/modules/workflow-assistant/tools/shadow-workflow.ts` (Shadow 검증, 힌트, 포트 반환)
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` (탐색·실행 조회 도구)
- `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` (도구 이름 → kind 분류와 탐색 dispatch)
- `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts`, `detect-pending-user-config.ts`, `candidate-lookup.service.ts` (선택 필드 후보)
- `codebase/backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts` (동적 포트 해석)
- `codebase/backend/src/modules/workflow-assistant/tools/redact.ts` (조회 결과 마스킹)
- `codebase/backend/src/nodes/core/button-slug.util.ts` (버튼 ID slug)
- `codebase/backend/src/scripts/migrate-button-ids.ts` (빈 버튼 ID backfill)

## Rationale

### 실행 조회 도구 도입

AI 어시스턴트가 자동으로 만든 표현식이 분기에서 `null` 로 터지는 일이 있었다. 어시스턴트가 실행 결과를 읽고 원인을 진단해 비슷한 실수를 스스로 고칠 수 있게 하려고 실행 조회 도구를 넣었다.

| 항목 | 결정 | 근거 |
|------|------|------|
| 도구 수 | 2종 (`get_workflow_executions`, `get_execution_details`) | 기존 탐색 도구와 같은 패턴이다. 목록 → 상세 2단계로 토큰을 아낀다 |
| 범위 | 현재 세션 워크플로우의 실행과 그 실행 트리의 직계 자식 실행(1단계) | 사용자가 "서브 워크플로우 노드에서 실행된 건 1 이야 2 야?" 라고 물었다. 실행 트리 관점으로 답했다. 2단계 이상은 따로 호출해 응답 부피를 제어한다 |
| 마스킹 | `maskSensitiveFields` 와 `deepRedactSecrets` 를 겹치고 `"***"` 로 낸다. 원본은 DB 에 둔다 | 채팅 창에 그대로 그려지므로 최소한의 안전 기본값이 필요하다. 2026-08-23 결정으로 키 축만 쓰던 방식을 바꿨다. 키 축만으로는 자유 텍스트 안의 자격 증명을 잡지 못해 값 축을 겹쳤다 |
| 페이로드 크기 | 필드 크기 상한 없음(마스킹만) | 사용자가 명시적으로 고른 선택이다. 대신 프롬프트가 2단계 패턴을 강제한다 |
| 진행 중·입력 대기 실행 조회 | 허용. 지금까지의 부분 타임라인을 돌려준다 | 실시간 디버깅을 위해서다. 실행 중 편집 거부 규칙은 읽기에 적용하지 않는다 |
| 세션 범위 키 | `session.workflow_id` 에서 자동으로 얻는다. `workflowId` 인자를 받지 않는다 | 범위 경계를 분명히 하고 LLM 이 틀린 `workflowId` 를 추정하지 못하게 한다 |
| 도구 kind | `'explore'` (read-only). 계획 전용 턴에서도 쓸 수 있고 실행 중 거부 규칙도 적용하지 않는다 | 다른 탐색 도구와 맞춘다 |

구현하면서 바뀐 점은 다음과 같다.

- **Repository 를 직접 주입했다.** 기획 단계에서는 `executions.service.ts` 의 `findById`·`findByWorkflow` 를 어댑터로 감쌀 계획이었다. 구현 때 세 가지 이유로 바꿨다. `ExecutionsService.findById` 는 Nest HTTP 예외 `NotFoundException` 을 던져 tool-result 형태 `{ok: false, error}` 와 맞지 않는다. `findByWorkflow` 는 컨트롤러용 DTO 래퍼(`PaginatedResponseDto`)를 돌려줘 LLM 응답에는 과하다. 기존 `listWorkflows`·`listIntegrations` 도 Repository 직접 주입 패턴이다. 나중에 `ExecutionsService` 에 RBAC 같은 공통 규칙이 들어가면 그때 서비스 주입으로 바꾼다. 이 trade-off 는 `explore-tools.service.ts` 클래스 머리 주석에 적혀 있다.
- **마스킹 구현을 바꿨다.** 처음에는 `common/utils/mask-sensitive-fields.util.ts` 를 재사용해 응답 직렬화 직전에 세 필드를 한 번씩 통과시켰다. 2026-08-23 결정으로 그 유틸(키 축) 위에 `deepRedactSecrets`(값 축)를 겹치는 `redactAssistantFields` 로 바꿨다. 원본 DB 행은 건드리지 않는다.
- 두 도구 이름을 `TOOL_KIND_BY_NAME` 에 `'explore'` 로 넣고 stream 서비스의 탐색 dispatch 에 두 경우를 더했다. i18n 키 `assistant.exploreExecutionsList`·`assistant.exploreExecutionDetails`·`assistant.executionNotInScope` 를 더했다.
- 테스트는 `explore-tools.service.spec.ts` 에 `EXECUTION_NOT_FOUND`·`EXECUTION_NOT_IN_SCOPE`·마스킹·서브 워크플로우 확장·진행 중 부분 타임라인 다섯 경우를 두고 `workflow-assistant-stream.service.spec.ts` 에 end-to-end mock 을 둔다.

열어 둔 주제는 다음과 같다.

- 2단계 이상 서브 워크플로우 확장 화면: 지금은 `subExecutionsTruncatedDepth` 로 신호만 주고 따로 조회한다. 사용자 보고가 쌓이면 선택 인자 `depth?: number` 를 검토한다.
- 진행 중 실행의 부분 타임라인 안정성: WebSocket 스트림과 REST 조회 시점이 엇갈려 같은 실행이 조회할 때마다 다른 타임라인을 낼 수 있다. 지금은 응답을 "조회 시점 스냅샷" 으로 보고 사용자에게 알리게 한다. 실제 사용 중 혼선이 보고되면 시스템 프롬프트에 단락을 더한다.
- `get_workflow_executions` 의 `search`·`dateRange` 옵션: 실행 내역 REST API 가 이미 status·정렬·페이지를 지원하므로 서버 쿼리를 새로 만들지 않고도 늘릴 수 있다. 사용자 요청이 오면 조금씩 더한다.

### 에러 보강으로 연쇄 실패 줄이기

설문조사처럼 복합 워크플로우를 만들 때 도구 호출이 연쇄로 실패했다. 실패 응답에 복구 지침을 실어 다음 라운드에서 바로 고치게 하려고 `ShadowResult` 에 `knownTypes`·`suggestedType`·`repeatCount`·`hint` 를 더했다.

- **별칭 기준.** LLM 은 "UI 메시지 전용 노드" 가 따로 있다고 가정하고 유형 이름을 지어내곤 한다. 이런 이름을 `template` 으로 보낸다.
- **Gemini-3-flash 의 유형 발명.** Gemini-3-flash 가 `음식 종류 선택` 같은 라벨로 목록에 없는 유형을 만들어 `add_node` 를 시도했다. 첫 `UNKNOWN_NODE_TYPE` 응답의 `suggestedType`·`knownTypes` 도 무시하고 반복했다. 그래서 입력·선택·분기·이메일·표시 계열 별칭을 넓혀 대부분의 발명 패턴을 한 번에 바로잡게 했다. 프롬프트의 흔한 실수 절에도 "노드 유형은 고정 목록이며 작업 문구로 새 유형을 지어내지 않는다" 는 문장과 계열별 "흔한 발명 → 실제 유형" 표를 넣었다.
- **`LABEL_CONFLICT` 를 실패한 생성으로 세지 않는 이유.** 이름만 겹쳤을 뿐 유형과 설정은 타당한 상태다. 이것이 연쇄 힌트에 섞이면 뒤이은 `add_edge` 의 `NODE_NOT_FOUND` 에 "앞서 노드 생성이 실패했다" 는 틀린 진단이 붙는다. 테스트 `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint" 가 고정한다.
- **LLM 제공 문자열을 반드시 sanitize 하는 이유.** LLM 출력이 `\n## HACK` 같은 마크다운 헤더나 인젝션을 품은 채 힌트로 다시 들어가면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.

### 라벨 오인 힌트

LLM 이 `update_node`·`remove_node`·`add_edge` 의 `id`·`source_id`·`target_id` 자리에 사용자에게 보이는 라벨(예: `"SendEmail"`)을 넣어 `NODE_NOT_FOUND` 가 연쇄로 났다. 설정 patch 도 전혀 반영되지 않는 2차 증상까지 번졌다. 두 층으로 막았다.

1. 시스템 프롬프트의 "Label vs identifier" 절에 "도구 인자는 노드를 UUID 로만 가리키고 라벨로 가리키지 않는다" 는 문단을 더했다. UUID 의 출처 두 가지와 위반 예(`update_node({id: "SendEmail"})`)를 적었다. "라벨은 전역 유일" 문장에는 "유일성은 `add_node` 충돌 감지용이며 UUID 를 대신할 근거가 아니다" 를 덧붙였다.
2. 서버가 라벨 오인 힌트를 붙인다. `buildLabelAsIdHint(value)` 가 `findByLabel` 에 위임해 순회 중복을 없앤다. `add_edge` 는 연쇄 힌트를 먼저 보고 비어 있을 때만 라벨 오인 힌트로 넘어가 두 힌트가 섞이지 않게 했다.

회귀 테스트는 `shadow-workflow.spec.ts` 의 `NODE_NOT_FOUND label-lookalike hint` 묶음(도구·source·target 별 힌트, 양쪽 라벨이면 source 힌트 하나, 공백 ID 는 힌트 없음, FIFO 가 비었을 때의 대체, FIFO 가 있을 때의 우선순위, 개행·`<script>` sanitize)과 `system-prompt.spec.ts` "teaches that tool-argument id slots need UUIDs, never node labels" 다.

### 런타임 포트 목록 반환 (ED-AI-40)

`add_node` 직후 `add_edge` 가 두 패턴으로 자주 실패했다.

1. `PORT_NOT_FOUND`: Carousel·Switch 의 동적 포트(`btn_korean`, `case_yes` 등)를 몰라 `out` 으로 보냈다. 서버가 `knownPorts` 로 다음 라운드에서 복구하지만 화면에 빨간 배지가 찍혀 "실패가 잦다" 는 인상을 줬다.
2. `NODE_NOT_FOUND`: 서버가 준 UUID 를 기다리지 않고 예측한 ID 로 `add_edge` 를 시도했다. 연쇄 실패 FIFO 로 복구되지만 역시 빨간 배지가 남았다.

기능은 복구되고 있었고 문제는 체감이었다. 그래서 두 가지를 함께 정했다. 백엔드는 `add_node`·`update_node` 성공 응답에 포트 목록 `{id, type?, label?}` 를 싣는다. 프론트엔드는 실패 뒤 곧바로 같은 source·target 성공이 오면 두 배지를 "재시도 후 성공" 하나로 줄인다([AI 어시스턴트 §패널 화면](CLE-WF-ASSIST.md#패널-화면)).

백엔드 계약은 다음과 같다.

1. `ShadowWorkflow.addNode`·`updateNode` 가 성공하면 `ports: RuntimePorts` 를 함께 돌려준다.
2. `outputs` 는 Shadow 의 `portResolver` 가 이미 부르는 `resolveEffectiveOutputPorts(config, def)` 를 재사용하고 `{id, type?, label?}` 로 바꾼다.
3. `inputs` 는 `def.ports.inputs` 그대로다. 지금은 모든 노드의 입력이 정적이다.
4. 동적 포트 노드의 case·button ID 가 없으면 기존과 같은 순번 ID(`case_0`, `btn_0`)가 나가고 `ports.outputs` 에도 실린다.
5. 한 쪽당 50개 상한. 처음에는 "플래그 없이 그냥 자른다(현실에서 생길 시나리오 없음)" 로 정했다. 리뷰 W-5 에서 절단 사실을 알리도록 바꿔 `result.portsTruncated: true` 를 싣는다. `shadow-workflow.ts` 구현, frontend `assistant.ts` 타입, `shadow-workflow.spec.ts` 회귀 테스트가 모두 이 기준이다.
6. 시스템 프롬프트의 "[dynamic-ports] → MANDATORY `get_node_schema`" 규칙을 "`result.ports.outputs[*].id` 를 그대로 쓴다" 로 바꿨다.

회귀 테스트: `shadow-workflow.spec.ts` 는 Carousel `addNode` 반환의 `ports.outputs` 에 버튼 ID 가 들어 있는지, `update_node` 로 `switch.cases` 를 고치면 새 `case_*` 포트가 반영되는지 본다. `workflow-assistant-stream.service.spec.ts` 는 tool_result 에 `ports` 가 실리는지 본다. `system-prompt.spec.ts` 는 `[dynamic-ports]` 문구만 보던 단언을 "add_node 결과의 ports" 기조로 바꿨다.

관련 메모와 범위 밖 사항은 다음과 같다.

- `pendingUserConfig` 와 같은 통로(tool_result 에 함께 싣기)를 쓴다.
- 품질 점검의 `DANGLING_OUTPUT_PORTS` 는 그대로다. 이 변경은 실패 → 복구 라운드를 줄일 뿐 점검과는 무관하다.
- `get_node_schema` 도구는 호환을 위해 남긴다.
- `add_edge` 에 `source_label`·`target_label` 을 받는 안(C 안)은 별도 과제다.
- 정적 포트의 한국어 `label` 은 노드 정의에 없어 채우지 않는다.

### 설정 도메인 검증을 막지 않는 이유

`handler.validate` 위반을 저장 차단으로 두면 LLM 이 같은 실패를 끝없이 재시도하는 루프가 생긴다. 그래서 경고(`configWarnings`)로만 알리고 실행 시점에 실행 엔진이 같은 규칙으로 최종 차단해 의미상 방어선을 유지한다.

### 유지보수 점검

- `SCHEMA_LOOKUP_HARD_STOP` 을 바꾸면 상수 정의, 서비스의 인라인 주석, 테스트의 3회차 기대값 세 곳을 함께 고친다.
- `ShadowResult` 필드를 더하거나 빼면 JSDoc, 테스트 fixture, 뒤따르는 `detectPendingUserConfig`·`toChatMessages` 메시지 복원 경로를 확인한다.
- `NODE_TYPE_ALIASES` 에 별칭을 더하면 `shadow-workflow.spec.ts` 의 `it.each` 경우에도 더한다. 별칭 대상이 레지스트리에 없을 때 Levenshtein 으로 넘어가는지 회귀를 확인한다("falls through to Levenshtein when alias exists but not in knownTypes").
- `resolveEffectiveOutputPorts` 를 바꾸면 frontend `resolveDynamicPorts` 와 동작이 같은지 확인한다. 두 파일이 각자 테스트를 가지므로 한쪽만 고치면 품질 점검이 거짓 양성·거짓 음성을 낸다. 새 `DynamicPortsSpec.kind` 를 더하면 양쪽에 동시에 분기를 더한다.
- `DANGLING_OUTPUT_PORTS` 의 weak·strong 경계를 바꾸면 `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언과 `review-workflow.spec.ts` "does NOT flag weak ports" 를 함께 고친다.

### 후속 과제 (범위 밖)

- `ShadowResult` 를 discriminated union 으로 바꾸기
- `ShadowWorkflow` 의 책임 나누기(`ShadowWorkflowErrorAdvisor`)
- `schemaCache` 응답을 명시 구조(`{ ok, data, cached, warning }`)로 감싸기
