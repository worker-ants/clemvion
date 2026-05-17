# Data Flow: 워크플로우 (Workflow)

> 관련 spec: [Spec 워크플로우 에디터](../3-workflow-editor/_product-overview.md) · [Spec AI Assistant](../3-workflow-editor/4-ai-assistant.md) · [데이터 모델 §2.4~§2.7, §2.15, §2.20~§2.21](../1-data-model.md) · [data-flow 개요](./0-overview.md)

---

## Overview

### System role

워크스페이스 안에서 사용자가 시각적으로 편집하는 자동화 단위. 노드·엣지·메타 설정·버전 스냅샷·AI
Assistant 채팅 세션을 묶어 단일 진실로 관리한다. 실행 자체는 [`execution.md`](./3-execution.md) 가
담당하고, 본 문서는 *편집 시점* 의 데이터 흐름을 다룬다.

코드 진입점:

- `codebase/backend/src/modules/workflows/workflows.service.ts` — Workflow CRUD
- `codebase/backend/src/modules/nodes/nodes.service.ts` — Node CRUD
- `codebase/backend/src/modules/edges/edges.service.ts` — Edge CRUD
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — 버전 스냅샷
- `codebase/backend/src/modules/workflow-assistant/` — AI Assistant 세션·메시지·도구 호출

---

## 1. Source → Sink

### 1.1 워크플로우 생성 + 노드/엣지 편집

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (Editor)
  participant Wf as WorkflowsService
  participant Nd as NodesService
  participant Ed as EdgesService
  participant Ver as WorkflowVersionsService
  participant PG as Postgres

  C->>Wf: POST /api/workflows {name, folderId?}
  Wf->>PG: INSERT workflow (workspace_id=ws, name, current_version=1, created_by)
  Wf-->>C: 201 { workflow }

  C->>Nd: POST /api/workflows/:id/nodes {type, category, position, config}
  Nd->>PG: INSERT node (workflow_id, type, category, label, position_x/y, config={})
  Nd-->>C: 201 { node }

  C->>Ed: POST /api/workflows/:id/edges {sourceNodeId, sourcePort, targetNodeId, targetPort}
  Ed->>PG: SELECT node (source/target 가 같은 workflow_id 인지 검증)
  Ed->>PG: INSERT edge (workflow_id, source_node_id, source_port, target_node_id, target_port, type='data')
  Ed-->>C: 201 { edge }

  C->>Ver: POST /api/workflows/:id/versions {changeSummary}
  Ver->>PG: SELECT MAX(version) FROM workflow_version WHERE workflow_id=:id
  Ver->>PG: INSERT workflow_version (version=max+1, snapshot=JSONB(nodes+edges+settings))
  Ver->>PG: UPDATE workflow SET current_version=max+1
  Ver-->>C: 201 { version }
```

### 1.2 노드 컨테이너 / Tool Area 배치

| 동작 | 노드 컬럼 변화 | 검증 |
| --- | --- | --- |
| Loop / ForEach / Map 내부에 자식 노드 배치 | `child.container_id = container.id` | `container.type ∈ {loop, foreach, map}`. 트리거 카테고리 자식 거부 (`CONTAINER_INVALID_CHILD`). cycle 거부 (`CONTAINER_CYCLE`). |
| AI Agent 의 Tool Area 에 노드 배치 | `tool.tool_owner_id = aiAgent.id` | `aiAgent.type = 'ai_agent'`. |
| 둘 다 set | — | CHECK 제약 `chk_node_placement` (V001) 가 거부. |
| Background body | `container_id` 사용 안 함 — `background` 포트 엣지로 식별 (`spec/5-system/4-execution-engine.md §3.3`) | — |

### 1.3 AI Assistant 세션·메시지

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (Editor 패널)
  participant Ctl as WorkflowAssistantController
  participant SS as SessionService
  participant Stream as StreamService
  participant LLM as LlmService
  participant PG as Postgres
  participant WS as WebsocketService

  C->>Ctl: POST /api/workflows/:wfId/assistant/sessions
  Ctl->>SS: createSession
  SS->>PG: INSERT workflow_assistant_session (workspace_id, workflow_id, user_id, llm_config_id, status='active', last_interaction_at)
  SS-->>C: { session }

  C->>Ctl: POST /api/workflow-assistant/sessions/:id/messages {content}
  Ctl->>PG: INSERT workflow_assistant_message (session_id, role='user', content)
  Ctl->>Stream: streamReply()
  Stream->>LLM: chat (tools: clarify/plan/edit)
  loop streamed deltas
    Stream-->>WS: emit 'assistant:delta' to session room
  end
  Stream->>PG: INSERT workflow_assistant_message (role='assistant', tool_calls, plan?, usage, finish_reason)
  alt tool_calls present
    Stream->>PG: INSERT workflow_assistant_message (role='tool', tool_call_id, content=result_summary)
  end
  Stream->>PG: UPDATE workflow_assistant_session SET message_count, last_interaction_at, updated_at
  Stream-->>C: SSE 종료
```

### 1.4 Assistant 가 워크플로우를 편집할 때

Assistant 의 `edit` 류 tool_call 은 일반 API 와 동일하게 `NodesService` / `EdgesService` 를 거쳐
Postgres 에 반영된다 (별도 우회 경로 없음). 변경 결과는 `tool_calls[].result` 에 축약본으로 저장되어
대화 히스토리에서 재현 가능 (`spec/3-workflow-editor/4-ai-assistant.md §9.1`).

---

## 2. Schema 매핑

### 2.1 Postgres — 편집 흐름

| Sink (table) | 흐름 | read/write 컬럼 | 인덱스 / 제약 |
| --- | --- | --- | --- |
| `workflow` | 생성 | INSERT `workspace_id, name, description?, is_active=false, tags='{}', folder_id?, settings={}, current_version=1, created_by` | FK `workspace_id` (CASCADE), `folder_id` (SET NULL) |
| `workflow` | 활성 토글 | UPDATE `is_active, updated_at` | — |
| `workflow` | 버전 커밋 | UPDATE `current_version, updated_at` | — |
| `node` | 추가 | INSERT `workflow_id, type, category, label, position_x/y, config={}, container_id?, tool_owner_id?` | CHECK `chk_node_placement` (둘 다 set 금지) |
| `node` | 이동 / 설정 변경 | UPDATE `position_x, position_y, config, label, is_disabled` | — |
| `node` | 컨테이너 / Tool Area 배치 | UPDATE `container_id` 또는 `tool_owner_id` | cycle 검사는 런타임에서 (`CONTAINER_CYCLE`) |
| `edge` | 추가 | INSERT `workflow_id, source_node_id, source_port, target_node_id, target_port, type IN (data/error), condition?` | `(source_node_id, source_port, target_node_id, target_port) UNIQUE`, `chk_no_self_loop`, FK CASCADE |
| `workflow_version` | 버전 커밋 | INSERT `workflow_id, version, snapshot=JSONB, change_summary?, created_by, created_at` | `(workflow_id, version) UNIQUE` |
| `workflow_assistant_session` | 세션 생성 | INSERT `workspace_id, workflow_id, user_id, title?, llm_config_id?, status='active', message_count=0, last_interaction_at` | `(workflow_id, status, last_interaction_at DESC)`, `(workspace_id, user_id, updated_at DESC)` (V019) |
| `workflow_assistant_message` | 사용자 메시지 | INSERT `session_id, role='user', content` | `(session_id, created_at)` (V019) |
| `workflow_assistant_message` | assistant 응답 | INSERT `session_id, role='assistant', content, tool_calls, plan?, usage, finish_reason, auto_resumed` | thinking_tokens column 은 V018 에서 `usage` JSONB 안에 inline |
| `workflow_assistant_message` | tool 결과 | INSERT `session_id, role='tool', tool_call_id, content` | — |
| `workflow_assistant_session` | 메시지 추가 시 | UPDATE `message_count = message_count + Δ, last_interaction_at, updated_at` | 비정규화 |

### 2.2 Redis · S3 · 외부

| Sink | 흐름 | 비고 |
| --- | --- | --- |
| Redis | — | 본 도메인은 큐를 직접 enqueue 하지 않음. 실행 트리거 시 [`execution.md`](./3-execution.md) 의 큐로 진입. |
| S3 | — | 워크플로우 자체는 S3 를 사용하지 않음. Form 노드 첨부는 [`file-storage.md`](./4-file-storage.md) 가 다룸. |
| LLM provider | Assistant 응답 스트리밍 | `LlmService.chat`. 사용량은 `llm_usage_log` 에 적재 ([`llm-usage.md`](./7-llm-usage.md)) |
| WebSocket | Assistant SSE / Editor 협업 emit | 단일 sink `WebsocketService` |

---

## 3. 상태 전이

### 3.1 `workflow.is_active`

```mermaid
stateDiagram-v2
  [*] --> Inactive: INSERT (default false)
  Inactive --> Active: 토글 (수동 실행은 비활성도 가능, 스케줄·웹훅 트리거는 활성만 동작)
  Active --> Inactive: 토글
  Active --> [*]: workflow 삭제 (CASCADE: nodes/edges/versions/executions/assistant_sessions)
```

### 3.2 `workflow_assistant_session.status`

| 상태 | 진입 | 결과 |
| --- | --- | --- |
| `active` | INSERT | UI 사이드 패널에 노출. 메시지 추가 가능. |
| `archived` | PATCH `/sessions/:id/archive` | UI 에서 숨김. row 는 보존. |

### 3.3 `workflow_assistant_message` 의 role 시퀀스

대화 한 턴의 정상 시퀀스: `user` → `assistant` (with `tool_calls`) → `tool` × N → `assistant` (final).
`finish_reason = aborted` 인 경우는 사용자가 stream 중단 시. `auto_resumed = true` 는 V020 이후 도입된
"이전 미완료 응답 자동 이어쓰기" flag (`spec/3-workflow-editor/4-ai-assistant.md` 참조).

---

## 4. 외부 의존

| 의존 | 방향 | 참고 |
| --- | --- | --- |
| Auth / Workspace | RBAC 검사 | editor 이상이 CRUD 가능 |
| Execution 도메인 | 워크플로우 실행 트리거 | [`execution.md`](./3-execution.md) |
| LLM Usage 도메인 | Assistant LLM 호출 | [`llm-usage.md`](./7-llm-usage.md) |
| WebSocket | Assistant 스트리밍 emit | `session:${sessionId}` room |

---

## Rationale

### 노드 배치 두 축의 mutual exclusion

`container_id` 와 `tool_owner_id` 는 의미가 본질적으로 다르다 (실행 컨텍스트 vs. Tool Area 등록).
CHECK 제약 `chk_node_placement` (V001) 로 동시 set 을 거부해 잘못된 정의를 DB 단에서 차단한다.
Background 컨테이너는 `container_id` 를 쓰지 않고 `background` 포트 엣지로 본문을 식별하므로 (실행
엔진 §3.3) 본 제약과 충돌하지 않는다.

### 버전 스냅샷 = JSONB

`workflow_version.snapshot` 은 nodes + edges + settings 의 전체 스냅샷을 단일 JSONB 로 저장한다.
이는 (1) "특정 시점의 워크플로우" 를 단일 row 로 복원 가능, (2) `node`/`edge` table 의 스키마가 바뀌어도
이전 버전을 그대로 보존, (3) 비교/diff 를 application 단에서 자유롭게 구현할 수 있게 한다는 장점이 있다.
trade-off 는 row 크기가 커질 수 있다는 점이지만, 버전 단위 빈도가 낮아 수용 가능하다고 판단했다.

### Assistant message 의 `usage` JSONB

`prompt_tokens / completion_tokens / total_tokens / thinking_tokens / model` 을 별 컬럼이 아닌
단일 JSONB 로 둔 이유는 provider 마다 키 구조가 다르고, V018 처럼 새 필드(`thinking_tokens`)가
중간에 추가될 때 마이그레이션 없이 점진적으로 채울 수 있기 때문이다. 집계가 필요한 경우 `llm_usage_log`
table 이 정규화된 카운트를 별도로 갖는다 ([`llm-usage.md`](./7-llm-usage.md)).
