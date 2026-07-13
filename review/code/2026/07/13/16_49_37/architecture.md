### 발견사항

- **[INFO]** (재확인 · 하향) "nodeId 최신 실행 결과 조회" 중복은 여전히 존재하나, 이번 라운드에서 정직하게 스코프 밖 defer 로 문서화됨(라운드 1·2 의 WARNING 대비 하향)
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` `findLatestResultByNodeId`(공유 selector) vs `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:508-513`(`InfoTab`, 자체 역순 for-루프 그대로) / `codebase/frontend/src/components/editor/expression/use-expression-context.ts`(`selectSortedNodeResults` 기반 별도 패턴)
  - 상세: 직접 코드 확인 결과 `node-settings-panel.tsx` `InfoTab` 은 여전히 `for (let i = nodeResults.length - 1; i >= 0; i--) { if (nodeResults[i].nodeId === nodeId) return nodeResults[i]; }` 를 그대로 유지하고 있어(508-513행), 신규 `findLatestResultByNodeId`(O(1), stale-index 재확인 포함)와 동일 개념의 구현이 저장소에 두 곳 공존한다. 다만 이번 라운드에서는 `plan/in-progress/spec-sync-edge-gaps.md` "비고" 절에 "`node-settings-panel.tsx` 는 1:1 이관 후보(현재 selector 미사용, divergence 위험)이나 `use-expression-context.ts` 는 전체 `Map<nodeId,latest>` 를 빌드하는 다른 패턴이라 single-nodeId selector 로 드롭인 불가"라고 실측 근거와 함께 명시적으로 구분·기록했고, follow-up 식별자(`task_edb57ca2`)로 추적을 남겼다. `use-expression-context.ts` 를 실제로 열어 확인해도(`selectSortedNodeResults(nodeResults)` 위에서 순회) 이 구분은 정확하다. 즉 라운드 1·2 에서 architecture/maintainability 리뷰어가 반복 지적했던 "단일화 미완결 + RESOLUTION 문구가 실제 범위보다 넓게 서술됨" 문제 자체는, 이번엔 "부분 반영 + 정확한 스코핑 + 근거 기록"으로 정직하게 좁혀져 더 이상 문서-구현 불일치가 아니다. 남은 것은 순수하게 "아직 이관되지 않은 기존 코드"라는 사실 자체이며, 이는 이 PR(엣지 hover 미리보기) 스코프 밖의 무관 컴포넌트 변경이라 병합 차단 사유는 아니다.
  - 제안: `task_edb57ca2`(또는 이를 대체할 명시적 plan 항목)가 실제로 `node-settings-panel.tsx` `InfoTab` 을 `findLatestResultByNodeId` 로 교체하는 후속 작업으로 이어지는지 추적 유지. `use-expression-context.ts` 는 별도 bulk selector(예: `buildLatestResultMap()`)가 필요하다면 그때 별건으로 설계.

- **[INFO]** (변동 없음, 재확인) `canvas/` → `run-results/` 신규 크로스 임포트
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:6` `import { unwrapNodeOutput } from "../run-results/output-shape";`, `import { JsonContent } from "../run-results/renderers/presentation-renderers";`
  - 상세: 두 라운드 전부터 지적된 항목으로 이번 라운드에도 변화 없음. `canvas/` 가 `run-results/` 의 구현 세부(`output-shape.ts`, `presentation-renderers.tsx`)에 직접 의존하는 첫 사례이며, 두 기능 모듈이 실제로는 "노드 산출값을 정규화/렌더링"이라는 cross-cutting 개념을 공유한다는 사실이 폴더 구조엔 드러나지 않는다. 기능상 결함은 아니고, 세 번째 소비처가 생기기 전까지는 급하지 않다.
  - 제안: 조치 불요(당장). 향후 소비처가 늘면 `output-shape.ts`/`JsonContent` 를 `lib/` 또는 `components/editor/shared/` 등 중립 위치로 승격하는 편이 결합 방향을 명확히 한다.

- **[INFO]** (변동 없음, 재확인) `edges` 배열 prop-drilling → leaf 컴포넌트 재탐색
  - 위치: `workflow-canvas.tsx`(`EdgeDataPreviewTooltip`/`EdgeDataModal` 양쪽에 `edges={edges}` 전달) / `edge-data-preview.tsx` `useEdgeFlowData(edgeId, edges)` 내부 `edges.find((e) => e.id === edgeId)`
  - 상세: `onEdgeMouseEnter` 시점에 캔버스는 이미 `RFEdge`(따라서 `edge.source`)를 쥐고 있는데도 `edgeId` 문자열만 하위로 넘기고, 하위 두 컴포넌트가 각자 전체 `edges` 배열을 받아 동일한 `.find()` 를 반복한다. 이전 라운드에서 "§4-insert/후속으로 이월" 로 명시된 항목이라 이번 라운드의 새 결함은 아니며, 기능적 문제는 없다.
  - 제안: hover 시점에 `sourceNodeId` 를 `EdgeHoverPreviewState` 에 함께 태우거나 `useEdgeFlowData` 가 `Edge` 객체를 직접 받도록 시그니처를 바꾸는 것을 후속으로 고려.

- **[INFO]** (변동 없음, 재확인) `workflow-canvas.tsx` 오케스트레이션 누적
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(엣지 관련 훅만 `useEdgeHighlighting`/`useEdgeReconnect`/`useEdgeExecutionState`/`useEdgeHoverPreview` 4개 + `dataModalEdgeId` state + 컨텍스트 메뉴·노드 검색 팝업·단일 노드 실행 등 다수 책임 공존)
  - 상세: `plan/in-progress/spec-sync-edge-gaps.md` 가 이미 이 파일의 God-component 화를 인지·추적 중이며, 이번 PR(및 2회 수정 라운드)이 그 위에 hover/modal 배선을 한 겹 더 얹었다. 개별 신규 로직 자체는 전용 훅/컴포넌트로 잘 추출돼 응집도가 양호하지만, 오케스트레이터 파일의 책임 누적은 계속된다. 새로운 결함은 아니다.
  - 제안: 별건 아님 — 기존 계획대로 "§4 오케스트레이션 정리" 후속에서 이번에 추가된 hover/modal 배선도 함께 이동 대상에 포함.

- **[INFO]** (양호, 3라운드 누적 확인) 계층 분리·명명 일관성·순환 의존성 부재는 최종 상태에서도 유지됨
  - 위치: `lib/utils/edge-data-preview.ts`(순수 함수) → `use-edge-hover-preview.ts`(타이밍 전용 훅) → `edge-data-preview.tsx`(프레젠테이션) → `workflow-canvas.tsx`(오케스트레이터)
  - 상세: 3회의 리뷰-수정 사이클을 거치며 이 계층 구조 자체는 흔들리지 않았다. 스토어의 두 selector(`findNodeResult` vs `findLatestResultByNodeId`)는 시맨틱이 명확히 분리돼(exec-id 정밀 매치 vs 항상 최신) 책임이 겹치지 않고, stale-index 방어도 대칭적으로 구현돼 있다. `git grep` 기준 순환 임포트는 발견되지 않았고, 형제 훅(`use-edge-reconnect.ts`, `use-edge-execution-state.ts`)과 구조·네이밍이 일관된다.

### 요약

3차 리뷰 시점 기준으로, 라운드 1(CRITICAL: i18n 하드코딩)과 라운드 2(WARNING: `JsonContent` 재구현·null 판정 불일치·훅 테스트 부재·sweep 미방어 등)에서 지적된 아키텍처·유지보수성 결함은 코드로 직접 재확인한 결과 모두 해소돼 있다. 유일하게 두 라운드에 걸쳐 반복됐던 항목("nodeId 최신 실행 결과" 조회 로직이 스토어 공유 selector 도입에도 불구하고 `node-settings-panel.tsx`/`use-expression-context.ts` 기존 소비처에는 이관되지 않음)은 이번 라운드에서 실제 코드 이관 대신, 두 기존 소비처를 실측 근거로 구분(1:1 이관 후보 vs 다른 패턴이라 드롭인 불가)해 plan 비고에 정직하게 기록하고 follow-up 식별자로 추적하는 방식으로 다뤄졌다 — 이는 이 PR 의 스코프(엣지 hover 미리보기) 밖 무관 컴포넌트를 건드리지 않으면서도 "은근슬쩍 반영된 것으로 넘어가지 않는" 적절한 처리로 판단되며, 병합을 막을 사유는 아니다. 그 외 canvas→run-results 크로스 임포트, edges prop-drilling, workflow-canvas.tsx 오케스트레이션 누적은 이전부터 인지·이월된 낮은 우선순위 관찰로 변화가 없다. 신규 순환 의존성, 레이어 위반, SOLID 위반, 안티패턴은 발견되지 않았다.

### 위험도
LOW
