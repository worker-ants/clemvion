# Workflow Assistant — Runtime ports hint on edit results

## 배경

Assistant 가 `add_node` 직후에 `add_edge` 를 시도할 때 두 경로에서 **첫 시도 실패 → 다음 라운드 자동 복구** 가 자주 발생한다:

1. **PORT_NOT_FOUND** — `carousel` / `switch` 같은 dynamic-ports 노드의 실제 port id 를 모르고 `out` 또는 추측 값을 보내면 `{error: 'PORT_NOT_FOUND', knownPorts: [...]}` 가 돌아오고, LLM 은 이를 읽어 다음 라운드에서 올바른 port 로 재시도한다. spec §8 의 "[dynamic-ports] → MANDATORY `get_node_schema` 선행" 규칙이 있지만 provider 가 가끔 이를 생략.
2. **NODE_NOT_FOUND** — `add_node` 의 server-assigned UUID 를 기다리지 않고 미리 예측한 id 를 `add_edge` 에 사용해 실패. 서버는 "최근 실패한 add_node" FIFO 로 cascading 실패 힌트를 돌려준다.

두 경로 모두 **기능적으로 정상 복구**되지만, UI 에 빨간 `⚠ PORT_NOT_FOUND` · `⚠ NODE_NOT_FOUND` 배지가 남아 사용자는 "실패가 잦다" 로 체감.

## 사용자 결정

- **방향 A+B** 두 가지를 함께 도입:
  - **A**: `add_node` / `update_node` 성공 응답의 `result` 에 **모든 노드**의 runtime `ports: {outputs, inputs}` 를 자동 포함해 LLM 이 별도 `get_node_schema` 없이 곧장 올바른 port 로 `add_edge` 할 수 있게 한다.
  - **B**: 프런트의 tool-call 배지에서 **`PORT_NOT_FOUND` / `NODE_NOT_FOUND` 두 에러의 실패→성공 연쇄**에 한해 "재시도 후 성공" 한 개 배지로 축약 렌더. 다른 shadow 에러(LABEL_CONFLICT 등) 는 기존대로 빨간 배지 유지.
- `ports` shape: **풍부형** `{outputs: [{id, label?, type?}], inputs: [{id, type?}]}` — `type` 은 `'data' | 'error'` 로 edge `type` 결정 힌트, `label` 은 dynamic 버튼/케이스의 사용자 설정 label (UI 표시 선택에 재사용 여지).

## 영향 받는 문서

| 문서 | 변경 |
| ---- | ---- |
| `prd/2-workflow-editor.md` §10.4 | `ED-AI-40` 신규 — edit tool result 에 runtime ports 를 싣고, 프런트는 PORT/NODE_NOT_FOUND 실패→성공 연쇄를 1 배지로 축약. |
| `spec/3-workflow-editor/4-ai-assistant.md` §3.2 | 편집 배지 설명에 "연쇄 회복 축약" 행 추가 또는 기존 배지 행에 문구 병합. |
| 〃 §4.3 | `add_node` / `update_node` 반환 shape 에 `ports?` 명시. |
| 〃 §4.3.2 (신규) | `RuntimePorts` / `RuntimePortDescriptor` 타입 정의, 조립 규칙 (dynamic ports resolver), 사용 예시. |
| 〃 §5.3.1 | `tool_call.data.result` 설명에 `ports?` 언급. |
| 〃 §8 | 시스템 프롬프트 규약의 "MANDATORY `get_node_schema` 선행" 을 "대부분 불필요 — tool result 의 `ports` 사용" 으로 완화. Ex2 few-shot 도 수정. |
| 〃 §13 | 재시도 축약 배지 i18n 키 (`toolCallBadgeRetryRecovered` 1~2개). |
| `memory/workflow-assistant-runtime-ports-hint.md` (신규) | 결정 근거·계약 요약. |

## 핵심 계약 (구현자용)

### Backend — tool_result shape

`add_node` 성공 반환:
```ts
{
  ok: true,
  id: string,
  ports: RuntimePorts,
  pendingUserConfig?: PendingUserConfigField[],
}
```

`update_node` 성공 반환:
```ts
{
  ok: true,
  ports: RuntimePorts,
  pendingUserConfig?: PendingUserConfigField[],
}
```

```ts
interface RuntimePorts {
  outputs: RuntimePortDescriptor[];
  inputs: RuntimePortDescriptor[];
}
interface RuntimePortDescriptor {
  /** port id (add_edge 의 source_port/target_port 에 그대로 사용). */
  id: string;
  /** 'data' (기본) / 'error'. edge type 결정 힌트 — 'error' 포트는 'error' edge. */
  type?: 'data' | 'error';
  /** dynamic-ports 노드의 사용자 설정 label (예: carousel 버튼의 Korean label). */
  label?: string;
}
```

조립 규칙:
- **Outputs**: static node 는 `NodeComponentRegistry` 의 `ports.outputs` 를 그대로 사용. dynamic-ports 노드는 기존 `resolveEffectiveOutputPorts(config, def)` 재사용 — shadow-workflow 의 `portResolver` 가 이미 쓰는 함수. 결과를 `{id, type?, label?}` 로 매핑.
- **Inputs**: 모든 노드 공통으로 `def.ports.inputs` (현재 `in` 하나 또는 soaking) 를 맵핑. inputs 는 dynamic 이 되는 노드가 없으므로 static.
- dynamic-ports 노드의 case/button `id` 가 없으면 index 기반 fallback (`case_0` 등) 이 resolver 에서 생성되는 기존 동작 유지. LLM 은 이 id 로도 connect 가능.

### Backend — system prompt 완화

기존 §8 테이블의 "노드 카탈로그" 행과 "워크플로우 조립 규칙" 행에서:
- `[dynamic-ports]` 마커는 **카탈로그 시점의 힌트**로만 유지 (초기 plan 수립 시 참고).
- 기존 "MANDATORY: add_edge 전에 `get_node_schema` 선행" 은 "**대부분 불필요**: `add_node`/`update_node` 성공 응답의 `ports` 배열을 그대로 쓰면 됨. 드문 예외(워크플로 스냅샷만 있고 이 턴에 아직 add_node/update_node 가 없는 노드에 edge 를 연결할 때)만 `get_node_schema` 호출" 로 교체.
- Ex2 few-shot 의 step 1 ("Call `get_node_schema` on `carousel`") 를 "Step 1 에서 `add_node carousel` 을 호출하면 result.ports.outputs 에 모든 btn_* port 가 실려온다. 바로 이 id 로 add_edge" 로 재작성.

### Frontend — 배지 축약 (B)

`tool-call-badge.tsx` 의 `groupToolCalls` 로직 확장:

- 기존: 같은 `signature` 연속을 `× N` 으로 묶음. 실패는 signature 에 `:err` 를 붙여 성공과 분리.
- 확장: `add_edge` 의 **실패 배지(에러코드 ∈ {PORT_NOT_FOUND, NODE_NOT_FOUND})** 가 같은 `source_id` + `target_id` 조합(또는 cascading 실패 연쇄의 경우 동일 target 조합) 의 성공 배지가 뒤따라오면 두 배지를 하나의 "회복된 재시도" 배지로 축약한다.
  - 렌더: `✔ add_edge ... (retried)` 양식. `assistant.toolCallBadgeRetryRecovered` i18n. 툴팁/hover 에 원본 실패 이유 + 성공 시의 port 를 노출해 디버깅 정보 보존.
  - 매칭 키: 같은 `(source_id, target_id)` + 인접 호출. 인접성은 "중간에 같은 쌍의 성공 배지가 있으면 축약, 아니면 원 상태 유지" — PORT_NOT_FOUND 는 port 값만 다르고 source/target 이 동일한 재시도가 전형적 패턴이므로 매칭됨. NODE_NOT_FOUND 은 cascading 케이스가 흔해 target id 가 한 번 교체될 수 있으나, **같은 turn 내에서 같은 "source label" 또는 "source id" 를 가진 add_edge 실패 직후의 성공** 으로 확장 매칭한다. 구현은 turn 단위로 실패 FIFO 를 두고 "같은 source-id 의 성공 도달 시 정리" 방식 권장.
- 다른 에러 코드 (LABEL_CONFLICT, CYCLE_DETECTED, UNKNOWN_NODE_TYPE 등) 은 기존대로 빨간 배지 유지 — 사용자 / 디버거에게 명시적으로 보여주는 게 가치 있음.

### i18n

- `assistant.toolCallBadgeRetryRecovered` = "재시도 후 성공" / "Retried and succeeded"

## 검증 기준

- `add_node(carousel)` 결과에 `ports.outputs` 가 `btn_korean`·`btn_western` 등 resolver 가 뽑은 port 들을 포함.
- `update_node(switch, patch={cases:[...]})` 결과에 새 `cases` 의 `case_*` port 들이 반영.
- 프런트: 의도적 PORT_NOT_FOUND (잘못된 port) 를 보낸 뒤 올바른 port 성공이 이어지면 배지가 1건으로 축약. LABEL_CONFLICT 후 recovery 는 여전히 2건.
- 시스템 프롬프트 spec.ts 업데이트로 `system-prompt.spec.ts` "dynamic-ports" 관련 어서션 동기화.
- `workflow-assistant-stream.service.spec.ts` 에 "add_node 결과에 ports 포함" 케이스 추가.

## Out of scope

- `get_node_schema` 도구 자체 제거 (후속 스탭 — 시스템 프롬프트에서 거의 쓰지 않게 되지만 backward-compat 로 남긴다).
- static 노드에 label 정보까지 채우기 (static port 는 def 에 label 이 없는 경우가 많아 id 만 실음).
- (C) `source_label`/`target_label` 기반 add_edge — 별도 과제로 보류.
