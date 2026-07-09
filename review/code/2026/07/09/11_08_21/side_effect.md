# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `updateNodeConfig` 즉시 커밋이 undo 스택을 건너뜀 — 모든 노드 타입의 설정 패널 편집이 실행취소 불가능해짐
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:190-206` (`handleConfigChange`), `codebase/frontend/src/lib/stores/editor-store.ts:945-952` (`updateNodeConfig`)
  - 상세: `handleConfigChange` 가 이제 키 입력마다 `updateNodeConfig(nodeId, newConfig)` 를 호출해 store 에 즉시 커밋한다. 그런데 `updateNodeConfig` 구현은 `pushUndo()` 를 호출하지 않는다 — 반면 같은 store 의 형제 mutator 인 `updateNodeConfigField`(L968), `setNodeContainer`(L987), `handleSave` 내부의 직접 `setState`(node-settings-panel.tsx L2360 `useEditorStore.getState().pushUndo()`) 는 모두 커밋 전에 `pushUndo()` 로 undo 체크포인트를 남긴다. 이 비대칭 때문에:
    1. Manual Trigger 파라미터 추가/편집을 포함해 **모든 노드 타입**(HTTP, AI, Transform 등 `NodeConfigRenderer` 를 쓰는 전체)의 노드별 config 편집이 Ctrl+Z 로 개별 되돌리기가 안 됨.
    2. undo 를 누르면 방금 한 config 편집이 아니라 그 이전에 `pushUndo()` 가 호출됐던 시점(라벨 변경, 엣지 연결 등)으로 건너뛰어 버려, 사용자가 기대하는 "직전 편집만 취소"와 다르게 동작.
    3. 세션 중 `pushUndo()` 가 한 번도 호출된 적이 없으면 undo 스택이 비어있어 undo 가 조용히 no-op.
  - 제안: `updateNodeConfig` 호출 전(또는 `handleConfigChange` 진입 시 debounce 경계에서 1회) `pushUndo()` 를 호출하거나, 최소한 이 트레이드오프를 알고 있는지 확인 필요. 키 입력마다 undo 스냅샷을 남기면 과도한 스택 누적이 되므로 debounce/blur 시점 커밋 등 별도 설계가 필요할 수 있음.

- **[INFO]** 설정 패널 편집 시 캔버스 전체 리렌더 빈도 증가 (perf)
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:120` (`useEditorStore((s) => s.nodes)`), `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:192-207`
  - 상세: 이전에는 `handleConfigChange` 가 로컬 `nodeConfig` state 만 갱신했으므로 store 의 `nodes` 배열 identity 는 "Save changes" 클릭 시에만 바뀌었다. 이제는 노드별 config 필드 입력 한 글자마다 `nodes` 배열 전체가 새 reference 로 교체되어, `s.nodes` 를 구독하는 `workflow-canvas.tsx` 를 포함한 모든 subscriber 가 매 keystroke 마다 리렌더된다. 큰 캔버스에서 설정 패널 입력 시 체감 랙 가능성.
  - 제안: 기능적으로 문제는 아니나, 대형 워크플로우에서 타이핑 랙이 보고되면 이 경로(즉시 커밋)를 debounce 하는 방향을 고려.

- **[INFO]** 저장 시 신규 400 게이트(`INVALID_TRIGGER_PARAMETERS`) — 기존에는 허용되던 저장이 이제 거부됨 (의도된 인터페이스 변경)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:576-611` (`validateManualTrigger`)
  - 상세: `saveCanvas` → `validateManualTrigger` 에 malformed trigger parameter(빈 이름 등)를 거부하는 새 `BadRequestException({code:'INVALID_TRIGGER_PARAMETERS'})` 경로가 추가됐다. spec §6 근거가 명확하고 의도된 hardening이지만, 이미 malformed 파라미터가 저장돼 있던 기존 워크플로우를 다시 저장(save)하려는 호출자는 이전엔 성공하던 요청이 이제 400 을 받게 된다 — 공개 API 동작 변경이므로 프론트/자동화 클라이언트가 이 신규 에러 코드를 처리하는지 확인 필요(본 PR 은 프론트 inline 검증(`trigger-configs.tsx`)과 e2e 테스트로 이를 커버하고 있어 위험은 낮음).
  - 제안: 별도 조치 불요 — 인지 목적의 기록. 배포 노트/체인지로그에 "저장 시 trigger parameter 구조 검증 강화" 언급 권장.

- **[INFO]** 재진입 dispatch 의 `input` 변경 범위가 주석이 말하는 것보다 넓음 (문서 정확성)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2086,2419,3203` (3개 재진입 호출부의 `input: savedExecution.inputData ?? {}`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5960-6017` (`gatherNodeInput`)
  - 상세: 각 diff 주석은 "본 값은 미완료 진입 노드(entry node)에만 영향" 이라 서술한다. 그러나 `gatherNodeInput` 을 보면 `workflowInput`(=이 `input` 파라미터) 은 (1) incoming edge 가 없는 진짜 entry 노드뿐 아니라, (2) incoming edge 가 1개인데 그 predecessor 가 아직 실행되지 않은 경우(back-edge 타깃의 첫 통과 등), (3) incoming edge 가 여러 개인데 전부 미실행(back-edge only)인 경우에도 폴백으로 쓰인다. 즉 이번 변경은 "미완료 entry 노드"뿐 아니라 재진입 시점에 predecessor 가 아직 없는 루프/백엣지 노드에도 영향을 준다. 다만 `runExecution`(정상 경로, L4181-4189)은 애초에 동일한 `input`(=원본 트리거 입력)을 이 폴백으로 이미 쓰고 있으므로, 이번 fix 는 재진입 경로를 정상 경로와 동일하게 맞춘 것으로 보이며 새로운 미검증 동작이 아니라 기존 정상 경로와의 일관성 회복에 가깝다. plan 문서에 "crash-redrive·stalled·park e2e 246/246 무회귀" 로 기록돼 있어 회귀 리스크는 낮음.
  - 제안: 코드 주석을 "미완료 entry 노드"가 아니라 "predecessor 가 아직 실행되지 않은 모든 노드(entry 노드 및 백엣지 재진입 포함)" 로 정정하면 향후 유지보수자의 오해를 줄일 수 있음. 기능 변경 요구는 아님.

- **[INFO]** `loadTriggerParameterSchema` 조회 기준 변경이 5개 호출부에 동시 적용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:290-293`, 호출부: `workflows.service.ts`, `workflows.controller.ts`, `schedule-runner.service.ts`, `hooks.service.ts`, `executions.service.ts`
  - 상세: `category: NodeCategory.TRIGGER` → `type: NODE_TYPES.MANUAL_TRIGGER` 조회 기준 변경은 공유 유틸리티라 5개 호출부 모두에 일괄 적용된다. 함수 자체가 "Manual Trigger 전용"으로 명확히 문서화돼 있고 모든 호출부가 실제로 manual-trigger 파라미터 스키마 조회 목적으로 쓰고 있어 일관된 개선으로 판단됨. 새 유닛 테스트(`load-trigger-parameter-schema.spec.ts`)가 category 누락 케이스를 커버.
  - 제안: 조치 불요 — 확인 목적의 기록.

## 요약

핵심 백엔드 수정 2건(재진입 dispatch 의 durable input 사용, Manual Trigger 노드 조회를 `type` 기준으로 전환)은 근본 원인에 부합하는 국소적 fix 이며, 재진입 경로 변경은 이미 정상 실행 경로가 쓰던 폴백 값과 동일하게 맞춘 것이라 새로운 미검증 부작용이라기보다 기존 동작과의 일관성 회복에 가깝다. 저장 시점 `INVALID_TRIGGER_PARAMETERS` 400 게이트는 의도된 API 동작 강화(spec 근거 있음)로 프론트 inline 검증과 e2e 로 뒷받침된다. 가장 주목할 부작용은 프런트엔드 `node-settings-panel.tsx` 의 `handleConfigChange` 가 이제 모든 노드 타입의 config 편집을 store 에 즉시 커밋하면서, 이 커밋 경로만 다른 store mutator 들과 달리 `pushUndo()` 를 거치지 않아 **undo/redo 기능이 노드별 config 편집에 대해 깨지거나 예측 불가능하게 동작**한다는 점이다. 이는 이번 PR 의 핵심 스코프(Manual Trigger default 유실 수정) 밖의 파급이며 새 테스트로도 커버되지 않는다.

## 위험도

MEDIUM
