---
id: "CLE-WF-ASSIST-TOOLS-EDITRESULT"
title: "AI 어시스턴트 도구 — 편집 응답의 포트와 선택 후보"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-WF-ASSIST-TOOLS"
ancestors: ["CLE-VISION", "CLE-WF", "CLE-WF-ASSIST-TOOLS"]
area: "CLE-WF"
content_hash: "08c95c61fba7cfcfa9eee74450bc8ba649a59c41babc10fa619468b8a47fa5cf"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "c1212f97486b906d991055f090704c62e50e780ac9098cfbfc3226f484693503"
etag: "sha256-e109741ea3ad960afe197c26cbfedc9d4284a7a00dad2ff66c8f08a9c149c63d"
---
## 개요

이 문서는 [AI 어시스턴트 도구](CLE-WF-ASSIST-TOOLS.md) 의 하위 문서로 `add_node`·`update_node` 성공 응답에 실리는 두 부가 정보를 정한다. 하나는 사용자가 직접 골라야 하는 선택기 필드의 후보(`pendingUserConfig`)이고, 다른 하나는 노드의 런타임 포트 목록(`ports`)이다. 편집 도구의 인자와 반환은 부모 문서의 [편집 도구](CLE-WF-ASSIST-TOOLS.md#편집-도구)에 있다.

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
| `integration-selector` | 통합(`Integration`) | `workspace_id` 일치, `status='connected'`, 요청자에게 보이는 것만(다른 사용자의 개인 통합 제외, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)). 요청자가 워크플로우 작성자가 아니면 요청자의 개인 통합도 뺀다. 노드 스키마 meta 에 `integrationServiceType` 힌트가 있으면 그 `service_type` 만 고른다. 힌트는 문자열 하나 또는 `string[]` 이며 배열이면 `service_type IN (...)` 로 조회한다. 힌트가 없으면 연결된 통합 전체다 |
| `mcp-server-selector` | 통합(`Integration`) | `workspace_id` 일치, `status='connected'`, 요청자에게 보이는 것만(`integration-selector` 와 같은 워크플로우 작성자 조건 포함), `service_type` 이 MCP 가능 서비스 전체(`MCP_CAPABLE_SERVICE_TYPES`, backend `integrations/services/mcp-capable-service-types.ts`)에 드는 것. AI 에이전트 노드의 `mcpServers` 필드 전용이다. 힌트 허용 목록은 `['mcp', 'cafe24', 'makeshop']` 이며 단일 기준은 [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)의 `serviceTypes` 허용 목록이다. 내부 MCP 브리지([MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md))가 적용되는 `service_type` 이 늘면 함께 고친다. 여러 개를 고를 수 있다 |
| `llm-config-selector` | 모델 설정(`ModelConfig`, `kind=chat`) | `workspace_id` 일치. 최근 수정 순 |
| `kb-selector` | 지식 저장소(`KnowledgeBase`) | `workspace_id` 일치. 이름 오름차순. 여러 개를 고를 수 있다 |
| `workflow-selector` | 워크플로우(`Workflow`) | 같은 `workspace_id` 이고 `id != session.workflow_id`(현재 편집 중인 워크플로우 제외). 최근 수정 순 |

`list_integrations` 와 두 통합 위젯(`integration-selector` · `mcp-server-selector`)은 같은 함수(`requesterIsWorkflowAuthor`)로 요청자가 워크플로우 작성자인지 판정한다. 편집 중인 워크플로우를 찾지 못하거나 작성자를 알 수 없으면 요청자를 작성자가 아닌 것으로 보고 요청자의 개인 통합도 뺀다. [통합 관리 「개인 통합 사용 판정」](../CLE-INT/CLE-INT-MANAGE.md#개인-통합-사용-판정)이 워크플로우 작성자를 알 수 없는 참조를 통과시키지 않는 것과 같은 방향이다.

위젯마다 후보는 20개까지다. 넘는 후보는 응답에서 자르고 프론트엔드는 후보 선택기에 "Settings 에서 더 많은 후보 보기" 링크를 붙인다.

### LLM 과의 계약

- LLM 은 선택기 필드의 ID 를 채우지 않는다. 추측도 발명도 하지 않고 빈 값 그대로 `add_node`·`update_node` 를 부른다. 서버가 후보를 찾아 싣는다.
- LLM 은 `pendingUserConfig` 를 보고 따로 행동하지 않는다. 이 필드는 프론트엔드 화면 전용이라 다음 LLM 라운드의 tool_result 로 돌려주지 않는다. 사용자가 고른 값은 LLM 을 거치지 않고 에디터 스토어로 바로 간다.
- 후보가 0개인 항목만 LLM 이 마무리 메시지에서 언급한다. 이 규칙과 품질 점검(`PENDING_USER_CONFIG_UNMENTIONED`)은 [AI 어시스턴트](CLE-WF-ASSIST.md)에서 정한다.

## 런타임 포트 목록

`add_node`·`update_node` 성공 응답에는 그 노드의 런타임 포트 목록이 붙는다. 동적 포트 노드(Carousel 버튼, Switch 케이스, AI 에이전트 조건 등)는 현재 `config` 로 해석한 실제 포트 ID 까지 담는다. 그래서 LLM 은 `get_node_schema` 를 따로 부르지 않고 다음 `add_edge` 의 `source_port`·`target_port` 를 채울 수 있다. 잘못된 포트로 먼저 보내고 `PORT_NOT_FOUND` 를 받아 한 라운드를 더 쓰는 패턴이 구조적으로 사라진다.

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

## 구현 위치

- `codebase/backend/src/modules/workflow-assistant/tools/{collect-pending-user-config,detect-pending-user-config}.ts` (선택 필드 후보 수집)
- `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` (위젯별 후보 조회. 통합 · MCP 서버 후보에도 같은 작성자 판정을 적용한다)
- `codebase/backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts` (동적 포트 해석)

## Rationale

### 런타임 포트 목록 반환

`add_node` 직후 `add_edge` 가 두 패턴으로 자주 실패했다.

1. `PORT_NOT_FOUND`: Carousel·Switch 의 동적 포트(`btn_korean`, `case_yes` 등)를 몰라 `out` 으로 보냈다. 서버가 `knownPorts` 로 다음 라운드에서 복구하지만 화면에 빨간 배지가 찍혀 "실패가 잦다" 는 인상을 줬다.
2. `NODE_NOT_FOUND`: 서버가 준 UUID 를 기다리지 않고 예측한 ID 로 `add_edge` 를 시도했다. 연쇄 실패 FIFO 로 복구되지만 역시 빨간 배지가 남았다.

기능은 복구되고 있었고 문제는 체감이었다. 그래서 두 가지를 함께 정했다. 백엔드는 `add_node`·`update_node` 성공 응답에 포트 목록 `{id, type?, label?}` 를 싣는다. 프론트엔드는 실패 뒤 곧바로 같은 source·target 성공이 오면 두 배지를 "재시도 후 성공" 하나로 줄인다([AI 어시스턴트 §패널 화면](CLE-WF-ASSIST.md#패널-화면)).

백엔드 계약은 다음과 같다.

1. `ShadowWorkflow.addNode`·`updateNode` 가 성공하면 `ports: RuntimePorts` 를 함께 돌려준다.
2. `outputs` 는 Shadow 의 `portResolver` 가 이미 부르는 `resolveEffectiveOutputPorts` 를 재사용한다([조립 규칙](#조립-규칙)).
3. 한 쪽당 50개 상한. 처음에는 "플래그 없이 그냥 자른다(현실에서 생길 시나리오 없음)" 로 정했으나 절단 사실을 알리도록 바꿔 `result.portsTruncated: true` 를 싣는다. `shadow-workflow.ts` 구현, frontend `assistant.ts` 타입, `shadow-workflow.spec.ts` 회귀 테스트가 모두 이 기준이다.
4. 시스템 프롬프트의 "[dynamic-ports] → MANDATORY `get_node_schema`" 규칙을 "`result.ports.outputs[*].id` 를 그대로 쓴다" 로 바꿨다.

회귀 테스트는 `shadow-workflow.spec.ts`(Carousel 버튼 포트, `switch.cases` 갱신), `workflow-assistant-stream.service.spec.ts`(tool_result 의 `ports`), `system-prompt.spec.ts` 다.

관련 메모와 범위 밖 사항은 다음과 같다.

- `pendingUserConfig` 와 같은 통로(tool_result 에 함께 싣기)를 쓴다.
- 품질 점검의 `DANGLING_OUTPUT_PORTS` 는 그대로다. 이 변경은 실패 → 복구 라운드를 줄일 뿐 점검과는 무관하다.
- `get_node_schema` 도구는 호환을 위해 남긴다.
- `add_edge` 에 `source_label`·`target_label` 을 받는 안(C 안)은 별도 과제다.
- 정적 포트의 한국어 `label` 은 노드 정의에 없어 채우지 않는다.

### 통합 후보의 워크플로우 작성자 조건

`integration-selector`·`mcp-server-selector` 후보에서 워크플로우 작성자가 아닌 요청자의 개인 통합을 빼는 결정의 근거는 `list_integrations` 와 함께 [부모 문서 Rationale](CLE-WF-ASSIST-TOOLS.md#통합-후보는-워크플로우-작성자-조건도-본다-2026-10-24)에 있다.

### 유지보수 점검

- `resolveEffectiveOutputPorts` 를 바꾸면 frontend `resolveDynamicPorts` 와 동작이 같은지 확인한다. 두 파일이 각자 테스트를 가지므로 한쪽만 고치면 품질 점검이 거짓 양성·거짓 음성을 낸다. 새 `DynamicPortsSpec.kind` 를 더하면 양쪽에 동시에 분기를 더한다.
- `DANGLING_OUTPUT_PORTS` 의 weak·strong 경계를 바꾸면 `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언과 `review-workflow.spec.ts` "does NOT flag weak ports" 를 함께 고친다.
