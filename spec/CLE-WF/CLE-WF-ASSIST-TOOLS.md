---
id: "CLE-WF-ASSIST-TOOLS"
title: "AI 어시스턴트 도구"
type: "design"
version: 7
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF"
ancestors: ["CLE-VISION", "CLE-WF"]
area: "CLE-WF"
content_hash: "2207e3d71beda235d348e6ff5a2e5e055a580d6b4312d5fd29828ef15c8074ad"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/3-workflow-editor/4-ai-assistant.md"]
mirror_sha256: "761fc1b85d54cddd28dae4563de14071462cfd0fcb65cbe1ebe2457d8dea6987"
etag: "sha256-4a65a9bbceb999c208f5cef914757487b1973a8e9b7b7261844fc9945a06a78b"
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
- [`NODE_NOT_FOUND` 힌트](CLE-WF-ASSIST-TOOLS-SHADOW.md#node_not_found-힌트-규칙) 문구도 snake_case 인자 이름(`source_id`, `target_id`)을 그대로 가리킨다.

### 계획 단계 인자

모든 편집 도구는 선택 인자 `planStepId?: string`(단일, 옛 단축형)과 `planStepIds?: string[]`(여러 개, 권장)를 받는다. 둘 다 주면 합집합으로 모아 해당 단계를 모두 완료 처리한다. 호출 하나가 여러 단계를 한꺼번에 해결하면 배열을 쓴다. 예를 들어 `add_node` 의 `config` 에 버튼까지 넣어 뒤쪽 `update_node` 단계를 대신했다면 `planStepIds: ["s1","s3"]` 로 부른다. 계획 카드의 체크 규칙은 [AI 어시스턴트 §대화 루프](CLE-WF-ASSIST.md#대화-루프)에서 정한다.

## 탐색 도구

탐색 도구는 모두 세션의 `workspace_id` 범위 안에서만 조회한다. 워크스페이스 경계를 넘는 데이터는 돌려주지 않는다.

| 도구 | 인자 | 반환 | 용도 |
|------|------|------|------|
| `get_node_schema` | `type: string` | `{configSchema, ports, description, category}` | 노드 유형 하나의 상세 스키마. 시스템 프롬프트의 노드 카탈로그 요약으로 부족할 때만 부른다 |
| `list_integrations` | `{category?: string}` | `[{id, name, type, category}]` | 현재 워크스페이스에 등록된 통합 목록. 다른 사용자의 개인 통합은 빠진다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md)의 권한 규칙). 요청자가 편집 중인 워크플로우의 작성자가 아니면 요청자 자신의 개인 통합도 빠진다([위젯별 후보 조회 범위](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#위젯별-후보-조회-범위)) |
| `list_workflows` | `{limit?: number, search?: string}` | `[{id, name, description, tags, updatedAt}]` | 같은 워크스페이스의 워크플로우 목록. 현재 편집 중인 워크플로우를 빼는 옵션이 있다 |
| `get_workflow` | `{id: UUID, mode?: 'summary'\|'full'}` | `{name, nodes, edges, summary}` | **다른** 워크플로우의 구조 참고(예: "주문 생성" 워크플로우를 읽고 "주문 취소" 설계). 현재 편집 중인 워크플로우는 이 도구로 조회하지 않는다 |
| `get_current_workflow` | 없음 | `{ok, nodes, edges}` (`config` 는 redact 적용) | **현재** 캔버스의 최신 노드·연결선. 같은 턴에서 편집한 뒤 결과를 다시 확인하거나 시스템 프롬프트 스냅샷이 오래됐을 수 있을 때 부른다 |
| `list_knowledge_bases` | 없음 | `[{id, name, documentCount}]` | RAG 노드 설계 때 참고할 지식 저장소 목록 |
| `get_workflow_executions` | `{limit?: number, status?: 'pending'\|'running'\|'completed'\|'failed'\|'cancelled'\|'waiting_for_input'}` | `{ok, workflowId, workflowName, items: [{id, status, startedAt, finishedAt, durationMs, triggerId, nodeStats: {total, completed, failed}}]}` | 세션 워크플로우의 최근 실행 목록. 시작 시각 내림차순. 기본 `limit=10`, 상한 50. 사용자가 실행을 특정하지 않고 "최근 실행이 왜 실패했어?" 처럼 물을 때 후보를 좁힌다. 수동 실행이면 `triggerId` 는 `null` |
| `get_execution_details` | `{id: UUID}` | `{ok, execution, timeline, subExecutions}` ([응답 구조](CLE-WF-ASSIST-TOOLS-EXEC.md#get_execution_details-응답-구조)) | 실행 한 건의 전체 타임라인(노드별 상태·입출력·에러). 실패 원인을 찾고 노드 수정 계획을 세우는 데 쓴다. 1단계 서브 워크플로우 자식 실행까지 같은 응답에 담는다 |
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

`add_node`·`update_node` 결과에 [런타임 포트 목록](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#런타임-포트-목록)이 실리므로 `get_node_schema` 는 거의 필요하지 않다. 이번 턴에 직접 편집하지 않은 노드(스냅샷에만 있는 노드)에 연결선을 이을 때만 부른다.

## 실행 조회 도구

→ [AI 어시스턴트 도구 — 실행 조회](CLE-WF-ASSIST-TOOLS-EXEC.md)

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

`propose_plan` 을 부른 턴에 편집 도구를 부르면 [Shadow 검증](CLE-WF-ASSIST-TOOLS-SHADOW.md#shadow-검증-규칙)이 `PLAN_AWAITING_APPROVAL` 로 거부한다. 계획 카드와 승인 흐름은 [AI 어시스턴트 §대화 루프](CLE-WF-ASSIST.md#대화-루프)에서 정한다.

## 편집 도구

| 도구 | 인자 | 반환 |
|------|------|------|
| `add_node` | `{type, label, position: {x, y}, config, planStepId?, planStepIds?}` | `{ok, id?, ports?, error?, pendingUserConfig?}` |
| `update_node` | `{id, patch: {label?, config?, position?}, planStepId?, planStepIds?}` | `{ok, ports?, error?, pendingUserConfig?}` |
| `remove_node` | `{id, planStepId?, planStepIds?}` | `{ok, removedEdgeIds?, error?}` |
| `add_edge` | `{source_id, source_port?, target_id, target_port?, type?, planStepId?, planStepIds?}` | `{ok, id?, error?}` |
| `remove_edge` | `{id, planStepId?, planStepIds?}` | `{ok, error?}` |
| `finish` | `{summary?: string}` | 성공이면 루프를 끝낸다(`finishReason: 'stop'`). 막히면 `{ok: false, error: 'PLAN_NOT_COMPLETE', pendingSteps, openQuestions}` 또는 품질 점검·요청 대조 결과를 돌려주고 루프가 이어진다 |

- `ports` 는 [런타임 포트 목록](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#런타임-포트-목록), `pendingUserConfig` 는 [사용자 선택 필드 후보](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#사용자-선택-필드-후보)를 따른다.
- 성공 응답에는 `configWarnings`(설정 경고), `warning`(계획 단계 누락 경고)이 붙을 수 있다([Shadow 검증 규칙](CLE-WF-ASSIST-TOOLS-SHADOW.md#shadow-검증-규칙)).
- `update_node`·`remove_node`·`add_edge` 의 `id`·`source_id`·`target_id` 자리에는 노드 UUID 만 쓴다. UUID 의 출처는 직전 `add_node` 성공 응답의 `result.id` 와 `currentWorkflow.nodes[*].id` 두 가지뿐이다. 라벨을 넣으면 `NODE_NOT_FOUND` 가 난다.
- `finish` 는 어시스턴트 턴을 끝내는 신호다. 막는 조건(계획 완결성·품질 점검·요청 대조)과 막힌 뒤의 동작은 [AI 어시스턴트 §종료 가드](CLE-WF-ASSIST.md#종료-가드)에서 정한다.

### 버튼 ID 자동 부여

`add_node`·`update_node` 에서 Carousel·Chart·Table·Template 노드의 버튼 항목 `id` 가 비어 있으면 서버가 안정된 slug 를 붙인다. Shadow 가 부르는 `normalizeNodeButtonIds`(구현 `nodes/core/button-slug.util.ts`)가 맡는다.

- `label` 을 kebab-case 로 바꿔 slug 를 만든다. 겹치면 `-2`, `-3` 접미사를 붙인다.
- `label` 이 영문·숫자가 아니면 순번 ID(`btn_${i}` 등)로 대신한다.
- 이미 있는 ID 는 항상 보존한다. 사용자가 나중에 라벨만 고쳐도 slug 를 다시 만들지 않으므로 연결선이 끊기지 않는다.
- 이 정책을 넣기 전에 저장된 워크플로우의 빈 버튼 ID 는 `codebase/backend/src/scripts/migrate-button-ids.ts` backfill 이 순번 ID 로 채웠다. 따라서 도입 시점 기준 모든 버튼에 ID 가 있다.

## 사용자 선택 필드 후보

→ [하위 문서](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#사용자-선택-필드-후보)

### 위젯별 후보 조회 범위

→ [하위 문서](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#위젯별-후보-조회-범위)

## 런타임 포트 목록

→ [하위 문서](CLE-WF-ASSIST-TOOLS-EDITRESULT.md#런타임-포트-목록)

## Shadow 검증 규칙

→ [하위 문서](CLE-WF-ASSIST-TOOLS-SHADOW.md#shadow-검증-규칙)

### 에러 보강 필드

→ [하위 문서](CLE-WF-ASSIST-TOOLS-SHADOW.md#에러-보강-필드)

## 미결 사항

- **Background 본문 실행 조회 도구**: [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md)는 AI 어시스턴트가 `get_background_run(executionId, backgroundRunId)`·`list_background_runs(executionId)` 로 Background 본문 실행을 조회할 수 있고 도구 상세는 이 문서에서 정한다고 적는다. 이 문서의 탐색 도구 목록과 요구사항(REQ-ASSIST-052)에는 두 도구가 없다. 현재 구현의 `TOOL_KIND_BY_NAME` 에도 없다. Background 문서는 이 요구를 미구현으로 표시하고 같은 문제를 [Background 노드 §미결 사항](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md#미결-사항)에 적는다. 도입하면 두 도구를 [탐색 도구](#탐색-도구) 절에 정의한다. 도입할지, Background 쪽 서술을 계획으로 내릴지 결정 필요.

## 하위 문서

이 문서에는 요구사항 줄이 없다. 아래 번호는 [AI 어시스턴트](CLE-WF-ASSIST.md#요구사항)의 요구사항 가운데 각 하위 문서가 세부를 정하는 것이다.

- [AI 어시스턴트 도구 — 실행 조회](CLE-WF-ASSIST-TOOLS-EXEC.md): `get_workflow_executions`·`get_execution_details` 의 조회 범위, 자식 실행 확장, 응답 구조, 마스킹, 페이로드 크기, 진행 중 실행, 에러 코드와 도입 결정. 요구사항: REQ-ASSIST-052, REQ-ASSIST-053, REQ-ASSIST-054, REQ-ASSIST-055.
- [AI 어시스턴트 도구 — Shadow 검증과 에러 보강](CLE-WF-ASSIST-TOOLS-SHADOW.md): Shadow 검증 규칙, 성공 경고, 에러 보강 필드(별칭 맵 · sanitize), `NODE_NOT_FOUND` 힌트 규칙과 결정. 요구사항: REQ-ASSIST-029.
- [AI 어시스턴트 도구 — 편집 응답의 포트와 선택 후보](CLE-WF-ASSIST-TOOLS-EDITRESULT.md): `add_node`·`update_node` 성공 응답의 `pendingUserConfig`(위젯별 후보 조회 범위)와 런타임 포트 목록(조립 규칙 · 동적 포트 해석). 요구사항: REQ-ASSIST-030, REQ-ASSIST-033, REQ-ASSIST-034, REQ-ASSIST-062.

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/tool-definitions.ts` (도구 스키마, `TOOL_KIND_BY_NAME`)
- `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` (탐색·실행 조회 도구. `requesterIsWorkflowAuthor` 가 요청자가 워크플로우 작성자인지 판정하고 `list_integrations` 가 그 결과로 개인 통합을 뺀다)
- `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` (도구 이름 → kind 분류와 탐색 dispatch)
- `codebase/backend/src/nodes/core/button-slug.util.ts` (버튼 ID slug)
- `codebase/backend/src/scripts/migrate-button-ids.ts` (빈 버튼 ID backfill)
- 나머지(Shadow 검증 · 후보 수집 · 동적 포트 · 마스킹)는 각 하위 문서의 「구현 위치」에 있다.

## Rationale

### 통합 후보는 워크플로우 작성자 조건도 본다 (2026-10-24)

개인 통합은 통합 소유자가 작성한 워크플로우에서만 쓰고 저장할 때 새로 넣은 참조를 검사하기로 정했다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale). 그 검사만 두면 워크플로우 작성자가 아닌 요청자에게 자기 개인 통합이 후보로 나오고 사용자가 골라도 저장이 400 이다. 그래서 `list_integrations` 와 `integration-selector`·`mcp-server-selector` 후보에서 뺀다([AI 어시스턴트 요구사항](CLE-WF-ASSIST.md#요구사항)). 조건은 저장 검사와 같다([통합 관리 「개인 통합 사용 판정」](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)의 저장 경로 조건).

- **고를 수 없게 보이지 않고 빼는 이유**: 노드 설정 패널의 선택기는 그 통합을 고를 수 없는 항목으로 보이고 이유를 붙인다. 어시스턴트는 LLM 과 후보 선택기가 고를 수 없는 항목을 다룰 방법이 없다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md) Rationale 의 «고르는 화면은 저장 검사를 통과할 통합만 고르게 한다»).
- **받아들인 잔여**: 워크플로우 작성자가 아닌 요청자에게 통합 후보가 0개면 [AI 어시스턴트](CLE-WF-ASSIST.md) 의 0개 안내(REQ-ASSIST-033)가 그대로 나온다. 그 사용자가 개인 통합을 새로 등록해도 이 워크플로우의 후보는 생기지 않고 조직 통합을 등록해야 생긴다. 품질 점검(`PENDING_USER_CONFIG_UNMENTIONED`)이 0개 항목을 마무리 메시지에 적게 하므로 이 안내가 그대로 나간다. 안내 문구는 바꾸지 않았다. 편집 중인 워크플로우를 찾지 못하거나 작성자를 알 수 없을 때도 요청자의 개인 통합을 후보에서 뺀다. 후보에서 빼도 노드에 이미 들어 있는 참조는 그대로라 잃는 데이터가 없다. 에디터의 붙여넣기 · 복제는 반대로 문맥을 모르면 참조를 비우지 않는다. 그쪽은 비우면 노드에 있던 참조를 잃을 수 있어서다([워크플로우 에디터와 캔버스](CLE-WF-EDITOR.md#rationale) R-5).

### 유지보수 점검

- `SCHEMA_LOOKUP_HARD_STOP` 을 바꾸면 상수 정의, 서비스의 인라인 주석, 테스트의 3회차 기대값 세 곳을 함께 고친다.
- `ShadowResult` · 별칭 · 동적 포트 쪽 점검 항목은 해당 하위 문서의 Rationale 에 있다.

### 후속 과제 (범위 밖)

- `ShadowResult` 를 discriminated union 으로 바꾸기
- `ShadowWorkflow` 의 책임 나누기(`ShadowWorkflowErrorAdvisor`)
- `schemaCache` 응답을 명시 구조(`{ ok, data, cached, warning }`)로 감싸기
