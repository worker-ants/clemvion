# 성능(Performance) 리뷰 결과

## 발견사항

- **[WARNING]** 노드 설정 패널의 config 편집이 이제 키 입력마다 전역 스토어를 커밋 → 캔버스/표현식 컨텍스트가 매 키 입력마다 재계산
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` `SettingsTab.handleConfigChange` (L191-2111, `updateNodeConfig(nodeId, newConfig)` 호출 추가)
  - 상세: 이번 fix 전에는 `handleConfigChange` 가 `setNodeConfig`(로컬 state)만 갱신하고, "Save changes" 를 눌러야 비로소 `useEditorStore.setState({ nodes: ... })` 로 커밋됐다. 이번 변경으로 `updateNodeConfig` 가 **모든 config 값 변경(트리거 파라미터뿐 아니라 URL 입력, JSON 바디, code 에디터 등 `NodeConfigRenderer` 가 렌더하는 모든 노드 타입의 모든 필드)마다 즉시** `useEditorStore` 를 갱신한다 (`editor-store.ts:945-952` `updateNodeConfig` → `state.nodes.map(...)` 로 `nodes` 배열 새 참조 생성 + `isDirty:true`).
    `nodes` 를 직접 구독하는 다수 컴포넌트가 이 새 배열 참조 때문에 매 키 입력마다 재실행된다:
    - `workflow-canvas.tsx:120` — `useEditorStore((s) => s.nodes)` 구독 후 ReactFlow 에 그대로 전달. 큰 그래프일수록 재조정(diff) 비용이 커짐.
    - `use-expression-context.ts:107,112` — `useMemo` 의존성이 `nodes`/`edges` 이므로, 조상 노드 탐색(`getAncestorsInScope`) 등 O(n) 그래프 순회가 매번 다시 실행됨.
    - `assistant-panel.tsx:41,96,129` / `assistant-message.tsx:289` — 동일하게 `nodes` 를 `useMemo` 의존성으로 사용.
    즉 이전에는 "Save changes" 클릭 1회에 한정되던 store-wide 재계산이, 이번 fix 이후로는 **패널이 열려 있는 동안 모든 타이핑마다** 발생한다. 노드/엣지 수가 많은 워크플로우에서는 입력 지연(타이핑 랙)으로 체감될 수 있다.
  - 제안: `updateNodeConfig` 호출을 디바운스(예: 200-300ms) 하거나 blur 시점에만 커밋하되 `isDirty` 는 즉시 반영하는 방식으로 분리. 또는 `nodes` 구독 컴포넌트들이 config 내용이 아닌 id/type/label 등 최소 shape 만 구독하도록 selector 를 좁혀 재계산 범위를 줄이는 것도 대안. 이번 정합성 수정(§persistence gap)의 목적은 유지하면서 store 갱신 빈도만 낮추면 됨.

- **[INFO]** `ManualTriggerConfig` 의 이름 중복/에러 계산이 매 렌더마다 메모이제이션 없이 재계산
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx` L1817-1829 (`nameCounts`, `nameError`)
  - 상세: `parameters.reduce(...)` 로 `nameCounts` 를 만들고, 각 파라미터 행마다 `nameError(p)` 를 호출해 `PARAM_NAME_RE.test` 등을 수행한다. `useMemo` 없이 컴포넌트 렌더마다(그리고 위 WARNING 으로 인해 이제 상위 트리 재렌더도 잦아짐) 재계산된다. 현재 트리거 파라미터 개수는 사용자가 수동으로 추가하는 소규모 배열이라 실질적 영향은 미미함.
  - 제안: 우선순위 낮음. 파라미터 수가 커질 가능성이 있다면 `useMemo(() => ..., [parameters])` 로 감싸는 것을 고려.

- **[INFO]** `loadTriggerParameterSchema` 조회 predicate 를 `category` → `type` 으로 변경 — 두 컬럼 모두 전용 인덱스 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` L333-335 (`nodeRepository.findOne({ where: { workflowId, type: NODE_TYPES.MANUAL_TRIGGER } })`)
  - 상세: `Node` 엔티티(`codebase/backend/src/modules/nodes/entities/node.entity.ts`)에는 `IDX_node_workflow_label (workflowId, label)` 만 존재하고 `workflowId` 단독 인덱스나 `(workflowId, type)`/`(workflowId, category)` 복합 인덱스는 없다. 따라서 이번 predicate 변경이 기존 대비 쿼리 비용을 악화시키지는 않지만(둘 다 동일하게 인덱스 미사용), 워크플로우당 노드 수가 적어(수십~수백 개 수준) 실질적 영향은 없을 것으로 보임 — 기존부터 존재하던 잠재적 갭이며 이번 diff 가 새로 유발한 회귀는 아님.
  - 제안: 조치 불필요(참고용). 노드 수가 매우 큰 워크플로우가 흔해지면 `(workflow_id, type)` 복합 인덱스 추가를 검토.

- **[INFO]** `execution-engine.service.ts` 재진입 3개소의 `input: savedExecution.inputData ?? {}` — 참조 전달이라 추가 비용 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L51, L62, L75 (세 재진입/redrive 호출부)
  - 상세: `savedExecution.inputData` 는 이미 `Execution` 엔티티 조회 시 메모리에 로드돼 있던 durable 컬럼이므로 추가 DB I/O 는 없다. `runNodeDispatchLoop` → `gatherNodeInput` 경로에서 `input` 은 참조로 전달되며 루프 내에서 별도로 deep clone 되는 부분은 확인되지 않아, 기존 정상 실행 경로(`runExecution`)와 동일한 비용 프로파일이다. N+1 이나 반복 직렬화가 새로 생기지 않음 — 정합성 수정이며 성능 영향은 무시할 수준.
  - 제안: 조치 불필요.

- **[INFO]** `workflows.service.ts` 저장 시점 파라미터 스키마 검증 추가
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L917-937 (`validateTriggerParameterSchema(params)`)
  - 상세: `saveCanvas` 경로에서 한 번, 파라미터 배열(사용자가 UI 로 직접 추가하는 소규모 리스트)에 대해서만 동기 순회. N+1 이나 반복 DB/외부 호출 없음.
  - 제안: 조치 불필요.

## 요약

핵심 정합성 수정(엔진 재진입 시 durable input 재사용, 트리거 노드 `type` 기반 조회, 저장 시점 파라미터 스키마 검증)은 성능 관점에서 문제가 없다 — 참조 전달·소규모 배열 순회·기존과 동일한 인덱스 특성이라 N+1, 블로킹 I/O, 알고리즘 복잡도 악화가 없다. 다만 프론트엔드의 `node-settings-panel.tsx` 변경은 정합성 버그(패널에서 config 를 편집해도 "Save changes" 없이는 store 에 반영되지 않던 문제)를 고치는 대가로, **모든 노드 타입의 모든 config 필드 편집이 이제 키 입력마다 전역 Zustand `nodes` 배열을 교체**하게 되어 캔버스(ReactFlow)·표현식 컨텍스트·어시스턴트 패널 등 `nodes` 구독 컴포넌트들의 재계산/재렌더가 편집 세션 내내 매 키 입력마다 발생한다는 부작용이 있다. 노드/엣지 수가 많은 워크플로우에서 입력 지연으로 이어질 수 있어 디바운스 등 완화책을 권장한다. 그 외 발견사항은 참고용(INFO) 수준이다.

## 위험도

MEDIUM
