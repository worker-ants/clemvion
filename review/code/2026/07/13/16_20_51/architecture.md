### 발견사항

- **[WARNING]** "nodeId 최신 실행 결과 조회" 중복 해소가 신규 코드에만 국한 — 기존 중복 사이트는 그대로 남음
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts` (`findLatestResultByNodeId`, 신설) vs `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:508-513`(`InfoTab`) / `codebase/frontend/src/components/editor/expression/use-expression-context.ts:104-120`(`selectSortedNodeResults` 위 역순 스캔)
  - 상세: 직전 라운드 리뷰(WARNING #2, `review/code/2026/07/13/15_52_56/architecture.md`)는 "`nodeId` 로 최신 실행 결과 찾기" 로직이 이미 `node-settings-panel.tsx`(원본 raw-array 역순 스캔)와 `use-expression-context.ts`(sorted 프로젝션 위 역순 스캔)에 각각 다른 변형으로 존재하는 상태에서, 신규 `edge-data-preview.tsx` 가 세 번째(사실상 `InfoTab`과 동일한) 변형을 추가한다고 지적했고, "`execution-store.ts` 에 `lastIndexByNodeId` 기반 공유 selector 를 추가해 `edge-data-preview.tsx`·`node-settings-panel.tsx`·(가능하면) `use-expression-context.ts` 가 공유하도록 단일화" 하라고 제안했다. 이번 라운드에서 실제로 반영된 것은 store 에 `findLatestResultByNodeId(nodeId)`(O(1), `lastIndexByNodeId` 기반)를 신설하고 신규 파일 `useEdgeFlowData` 하나만 그것을 소비하도록 배선한 것뿐이다. `git grep` 로 재확인한 결과 `node-settings-panel.tsx` `InfoTab`(508-513행, `for (let i = nodeResults.length - 1; ...)` 원본 그대로) 와 `use-expression-context.ts`(104행대, `selectSortedNodeResults` 위 역순 스캔)는 여전히 각자의 독립 구현을 그대로 유지한다. 즉 이제 "동일 개념의 O(1) selector 가 스토어 공개 API 로 존재하는데도, 그 selector 가 해결하려던 정확히 그 문제(중복)를 겪는 기존 두 소비처는 여전히 그것을 쓰지 않는" 역설적 상태가 됐다 — RESOLUTION.md 는 이 항목을 "반영" 으로 표시했지만, 실제로는 신규 파일의 지엽적 회귀만 막았을 뿐 지적된 아키텍처 개선(단일화)은 완결되지 않았다.
  - 제안: `node-settings-panel.tsx` `InfoTab`·`use-expression-context.ts` 도 `findLatestResultByNodeId` 로 교체하는 후속 작업을 별도 TODO/plan 항목으로 명시적으로 남길 것. 최소한 RESOLUTION 기록에서 "부분 반영(신규 코드에 한정, 기존 2 사이트는 미이관)"으로 정정해 향후 세션이 "이미 끝난 일"로 오인하지 않게 한다.

- **[INFO]** (양호) 재사용 가능 컴포넌트 재작성 문제는 실제로 해소됨
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataModal`)
  - 상세: 직전 라운드 WARNING("`JsonContent` 를 두고 `<pre>{JSON.stringify(...)}</pre>` 를 인라인 재작성")이 이번 라운드에서 `import { JsonContent } from "../run-results/renderers/presentation-renderers"` + `<JsonContent data={data} />` 로 정확히 교체되어 해소를 확인했다. 데이터 없음 판정도 `data == null`(undefined+null 모두)로 통일돼 별건 WARNING(#6)도 함께 해소.

- **[INFO]** store 내 두 selector(`findNodeResult` vs `findLatestResultByNodeId`) 공존 — 의미 분리는 적절
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts:295-304, 694-718`
  - 상세: 기존 `findNodeResult(nodeExecutionId, nodeId)`(exec-id 정밀 매치 + exec-id 없을 때 첫 항목 폴백)와 신규 `findLatestResultByNodeId(nodeId)`(exec-id 무시, 항상 최신 도착 항목)는 시맨틱이 다르고 각각 별도 인덱스 맵(`nodeResultIndexByExecId`/`firstNoExecIdIndexByNodeId` vs `lastIndexByNodeId`)을 O(1)로 사용해 책임이 겹치지 않는다. stale 인덱스에 대한 방어(`row?.nodeId === nodeId` 재확인)도 기존 `findNodeResult` 패턴과 대칭적으로 구현되어 있어 일관성이 좋다. 이 부분은 이번 라운드에서 순수하게 잘 설계된 추가다.

- **[INFO]** (변동 없음, 재확인) `canvas/` → `run-results/` 크로스 임포트, `edges` prop-drilling, `workflow-canvas.tsx` 오케스트레이션 누적
  - 위치: `edge-data-preview.tsx:6`(`unwrapNodeOutput` import), `workflow-canvas.tsx`/`edge-data-preview.tsx`(`edges` 배열 prop-drilling), `workflow-canvas.tsx`(1034줄, hover/modal state 추가)
  - 상세: 직전 라운드에서 INFO 로 남긴 세 항목은 이번 수정 라운드의 범위 밖이라 그대로다(악화도 추가 개선도 없음). 모두 낮은 우선순위 관찰이며 §4 오케스트레이션 정리 후속 작업으로 이미 plan 에 이월돼 있다.

### 요약

이번 라운드는 직전 ai-review 의 CRITICAL(i18n ratchet 위반)과 대부분의 WARNING(JsonContent 재사용, null 판정 통일, 테스트 커버리지)을 정확히 해소했고, 특히 store 에 `findLatestResultByNodeId` 라는 의미가 분명한 O(1) selector 를 신설해 문서-구현 불일치는 완전히 바로잡았다. 다만 그 selector 신설의 원래 동기였던 "3중 중복 로직 단일화"는 신규 파일 자신에게만 적용됐을 뿐, 지적 대상이었던 기존 두 소비처(`node-settings-panel.tsx` `InfoTab`, `use-expression-context.ts`)는 여전히 각자의 역순 스캔 변형을 유지하고 있어, RESOLUTION.md 의 "반영" 표기는 실제 범위보다 넓게 서술돼 있다. 레이어 책임·순환 의존성·SOLID 관점에서 새 구조(순수 유틸 → 타이밍 훅 → 프레젠테이션 컴포넌트 → 오케스트레이터) 자체는 견고하며 이번 결함은 병합을 막을 수준은 아니고, 후속 이관 작업으로 명시적으로 추적하면 충분하다.

### 위험도
LOW
