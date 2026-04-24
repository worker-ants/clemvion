# Workflow Assistant — Runtime ports hint (ED-AI-40, 2026-04-24)

## 배경

사용자 보고: Assistant 가 `add_node` 직후 `add_edge` 를 시도할 때 두 가지 패턴으로 실패가 자주 일어난다.

1. **PORT_NOT_FOUND** — `carousel` / `switch` 의 dynamic 포트(`btn_korean`, `case_yes` 등) 를 몰라 `out` 으로 보내 실패. 서버가 `knownPorts` 힌트를 돌려줘 다음 라운드에서 복구하지만, UI 에 빨간 배지가 찍히는 게 "실패 잦음" 으로 체감.
2. **NODE_NOT_FOUND** — `add_node` 의 server-assigned UUID 를 기다리지 않고 예측한 id 로 `add_edge` 시도. cascading 실패 FIFO 로 복구되지만 역시 빨간 배지.

기능적으로는 복구가 잘 작동 — UX 만 "실패가 잦다" 로 체감되는 문제.

## 결정 (ED-AI-40)

**A+B 조합**:

- **A (backend)**: `add_node` / `update_node` 성공 응답의 `result` 에 `ports: { outputs, inputs }` 자동 포함. static · dynamic-ports 모두. shape 은 풍부형 `{id, type?, label?}`. LLM 은 별도 `get_node_schema` 없이 이 ports 를 그대로 다음 `add_edge` 의 `source_port` / `target_port` 에 쓴다. 결과: "잘못된 port 로 쏘고 PORT_NOT_FOUND" 경로가 구조적으로 사라짐.

- **B (frontend)**: tool-call 배지 그룹핑을 확장해 `PORT_NOT_FOUND` / `NODE_NOT_FOUND` 실패 직후 같은 source/target 의 성공이 오면 두 배지를 **"재시도 후 성공"** 한 개로 축약. 다른 shadow 에러(LABEL_CONFLICT 등) 는 기존 빨간 배지 유지.

## 문서 변경 지도

| 문서 | 섹션 | 변경 |
|------|------|------|
| `prd/2-workflow-editor.md` | §10.4 | `ED-AI-40` 신규 — runtime ports + 재시도 배지 축약. |
| `spec/3-workflow-editor/4-ai-assistant.md` | §3.2 | "재시도 후 성공 축약" 행 추가. |
| | §4.3 | 편집 도구 반환 shape 에 `ports?` 명시. |
| | §4.3.2 (신규) | `RuntimePorts` / `RuntimePortDescriptor` 타입·조립 규칙·LLM 계약. |
| | §5.3.1 | tool_call.data.result 설명에 `ports` 언급. |
| | §8 | "노드 카탈로그" / "워크플로우 조립 규칙" 행에서 `get_node_schema` 선행을 "대부분 불필요" 로 완화, `result.ports` 를 "직접 사용" 하도록 명시. |
| | §13 | `toolCallBadgeRetryRecovered` 1 키. |
| | §14 | ED-AI-40 매핑. |

## 구현자가 기억할 계약

### Backend

1. `ShadowWorkflow.addNode` / `updateNode` 성공 시 `ports: RuntimePorts` 를 함께 반환.
2. `outputs` 계산은 기존 `resolveEffectiveOutputPorts(config, def)` 재사용 — shadow 의 portResolver 가 이미 호출하는 함수. 여기서는 반환값을 `{id, type?, label?}` 로 매핑.
3. `inputs` 는 `def.ports.inputs` 그대로 (현재 모든 노드가 static inputs).
4. Dynamic-ports 노드의 case/button id 가 없으면 기존과 동일 fallback (`case_0`, `btn_0`) 이 발행되고 그 fallback id 가 `ports.outputs` 에도 실린다 — LLM 은 이 id 로도 add_edge 가능.
5. 상한 50 (한 쪽당). 초과는 truncate 하고 `portsTruncated: true` 같은 플래그 없이 그냥 자른다 (현실 발생 시나리오 없음).
6. System prompt `STATIC_BLOCK_*` 에서 "[dynamic-ports] → MANDATORY `get_node_schema`" 를 "`result.ports.outputs[*].id` 를 그대로 사용" 으로 교체.

### Frontend

1. `tool-call-badge.tsx` 의 `groupToolCalls` 에 recovery grouping 로직 추가:
   - 실패 배지 `call.result.error ∈ {'PORT_NOT_FOUND', 'NODE_NOT_FOUND'}` 이고
   - 같은 `(source_id, target_id)` (arg 기준) 의 성공 배지가 곧이어 (또는 cascading NODE_NOT_FOUND 는 같은 source 기준) 나타나면
   - 두 배지를 하나의 "재시도 후 성공" 그룹으로 묶음.
   - 성공 배지가 없으면 기존대로 실패 빨간 배지 유지.
2. 축약 배지 클릭/hover 시 원본 실패 이유 (실패 port 값, 실패 에러 코드) 와 성공 시 port 값 모두 노출.
3. i18n `assistant.toolCallBadgeRetryRecovered` 추가.

### 회귀 테스트

- Backend: `shadow-workflow.spec.ts` — addNode(carousel) 반환에 `ports.outputs` 가 버튼 id 포함. update_node 로 switch.cases 수정 시 새 case_* port 반영.
- Backend: `workflow-assistant-stream.service.spec.ts` — tool_result 에 `ports` 가 실리는지 어서션.
- Backend: `system-prompt.spec.ts` — `[dynamic-ports]` 문구 단독으로 체크하던 어서션을 "ports from add_node" 기조로 교체.
- Frontend: `tool-call-badge.test.ts` — (1) 같은 source/target PORT_NOT_FOUND → 성공 → 1 배지, (2) LABEL_CONFLICT → 성공 → 2 배지 유지 (축약 안 됨), (3) NODE_NOT_FOUND cascading → 최종 성공 → 1 배지.

## 연관 메모

- [workflow-assistant-candidate-picker.md](./workflow-assistant-candidate-picker.md) — `pendingUserConfig` 가 result 에 실리는 것과 동일 채널을 쓴다 (tool_result 에 함께 embed).
- [workflow-assistant-provider-quirks-and-review-always.md](./workflow-assistant-provider-quirks-and-review-always.md) — DANGLING_OUTPUT_PORTS review guard 는 그대로 유지. 이번 변경은 "실패→복구" 라운드를 줄일 뿐 guard 자체와는 무관.

## Out of scope

- `get_node_schema` 도구 자체 제거 — backward compat 로 유지.
- `add_edge` 의 `source_label` / `target_label` 지원 (C 안) — 별도 과제.
- Static 노드 port 의 한글 `label` 보강 — def 에 없으므로 생략.
