### 발견사항

- **[WARNING]** 핵심 최적화 주장("노드 드래그로 `nodes` 참조가 바뀌어도 결과가 재생성되지 않는다")이 실제로는 재현되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts` (전체 7케이스), 대상 로직 `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` 의 `disabledKey`/`disabledNodeIds` memo
  - 상세: 이번 §3.2 구현·직전 2라운드 ai-review(round 1 performance/side_effect/maintainability 3-리뷰어 공통 WARNING)의 핵심 수정 사항은 "노드 드래그(위치만 변경)로 `nodes` 배열 참조가 바뀌어도 `disabledKey`(정렬 join 문자열)가 동일 값이면 하위 memo 가 재계산되지 않는다"는 것이다. 그런데 신설된 7개 테스트 중 어느 것도 **같은 렌더 사이클에서 `nodes` 배열을 새 참조로 교체**하고(예: `[...nodes]` 또는 새 position 값) `disabledKey` 값(및 최종 결과 배열 참조)이 유지되는지를 검증하지 않는다. 테스트 #6("실행 상태가 tick 으로 바뀌어도...")은 `nodes` 는 그대로 두고 `useExecutionStore` 만 갱신하므로, 정작 이번 수정의 존재 이유였던 "드래그 시나리오"는 여전히 코드 리뷰(주석)로만 보증되고 자동화된 회귀 테스트가 없다. 향후 `disabledKey` 계산 로직(`useMemo(..., [nodes])`)이 실수로 `[nodes]` 대신 다른 키로 바뀌거나, `disabledNodeIds` memo 의존성이 깨져도 이 테스트 스위트는 감지하지 못한다.
  - 제안: `renderHook(({ edges, nodes }) => useEdgeExecutionState(edges, nodes), { initialProps: { edges, nodes } })` 로 마운트한 뒤, `nodes` 를 내용은 동일하지만 새 배열/새 객체 참조로 교체해 `rerender({ edges, nodes: nodes.map(n => ({...n})) })` 하고, 결과 배열이 이전 렌더와 `toBe` 동일함을 단언하는 케이스를 추가한다. 이것이 이번 3라운드에 걸친 성능 수정의 실질적 회귀 가드가 된다.

- **[WARNING]** "비활성 노드 재활성화" 시 `edgeInactive` 가 해제되는지에 대한 회귀 테스트 부재
  - 위치: `use-edge-execution-state.test.ts` (전체), 사용자 문서 `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.en.mdx` ("Re-enabling the node restores it."), `connecting-nodes.mdx` ("노드를 다시 켜면 원래대로 돌아와요")
  - 상세: 사용자 문서가 명시적으로 약속하는 동작("노드를 다시 켜면 엣지가 원래 스타일로 돌아온다")은 `isDisabled: true → false` 로 전이되는 재렌더 시나리오를 요구하는데, 현재 테스트는 `isDisabled` 가 정적으로 `true` 이거나 부재한 케이스만 다루고, **rerender 간 토글**(disabled→enabled)이 `disabledKey`(정렬 join)를 갱신시켜 `edge.data.edgeInactive` 를 다시 `false` 로 되돌리는지는 검증하지 않는다. 위 첫 번째 항목(드래그 참조 안정성)과 짝을 이루는 "값이 실제로 바뀌었을 때는 재계산되어야 한다"는 반대쪽 불변식이라 별도 케이스가 필요하다.
  - 제안: `rerender` 로 `nodes` 의 `isDisabled` 값을 `true→false` 로 바꾸고 `result.current[0].data.edgeInactive` 가 `false` 로, 그리고 필요하면 `className`(disabled 해제 후 실행 상태가 있다면 flowing/completed 로) 갱신되는지 단언하는 케이스 1개 추가.

- **[INFO]** `buildEdgeStyle` 상호 조합(`selected && inactive`, `isHighlighted && inactive`) 미검증
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` (`describe("buildEdgeStyle (§3.1/§3.2)"`, 5케이스), 대상 `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeStyle`
  - 상세: 5케이스가 각 옵션(`selected`/`isHighlighted`/`inactive`/`baseStyle`)을 개별적으로만 조합해 검증한다. 함수 자체는 각 필드가 서로 다른 CSS 속성(stroke/strokeWidth vs opacity/strokeDasharray)에 매핑되어 논리적으로 독립적이라 실제 회귀 위험은 낮지만, "비활성 + 선택됨" 처럼 실제 UI 에서 동시에 발생 가능한 조합이 스타일 객체에 그대로 반영되는지 명시적으로 단언하는 케이스가 없다. 이전 라운드 리뷰(round 1 testing.md)에서 이미 지적된 관점의 연장이며, `custom-edge.tsx` 의 인라인 로직이 순수 함수로 추출·테스트된 것 자체는 그 라운드의 핵심 요청을 잘 해소했다.
  - 제안: 선택 사항 — `it("inactive + selected: opacity/dash 유지하면서 primary stroke·2.5px")` 케이스 1개 추가.

- **[INFO]** `edge.data` 의 기존 임의 필드(예: `portType`) 보존 여부가 여전히 명시적으로 검증되지 않음 (round 2 잔여 INFO, 미해소)
  - 위치: `use-edge-execution-state.ts` (`data: { ...(edge.data ?? {}), edgeInactive: state.inactive }`), 대응 테스트의 `edge()` 헬퍼(`{ id, source, target }` — `data` 자체를 부여하지 않음)
  - 상세: 실제 배선(`workflow-canvas.tsx`)에서 이 훅에 들어오는 엣지는 이미 `enrichEdgesWithPortData` 를 거쳐 `data.portType` 등을 포함할 가능성이 높다. 현재 스프레드 구현은 필드를 보존하지만, 이를 보증하는 회귀 테스트가 없어 향후 리팩터링(스프레드→새 리터럴 치환) 시 `portType` 유실이 조용히 발생해도 잡히지 않는다.
  - 제안: `edge()` 헬퍼에 `data: { portType: "system" }` 사전 필드를 부여한 케이스를 추가해 병합 후에도 유지되는지 단언.

- **[INFO]** disabled 노드가 2개 이상인 경우의 `disabledKey` 정렬/join 로직 자체는 간접 검증만 있음
  - 위치: `use-edge-execution-state.ts` 의 `disabledKey = ids.sort().join(",")`
  - 상세: 현재 테스트(#5, #6)는 disabled 노드 1개짜리 시나리오만 다룬다. 정렬·join 로직 자체는 단순해 위험은 낮으나, 두 disabled 노드가 서로 다른 순서로 `nodes` 배열에 나타나도 같은 `disabledKey` 값을 만들어 안정성을 유지한다는 점(정렬의 존재 이유)은 직접 검증되지 않는다.
  - 제안: 선택 사항 — disabled 노드 2개(순서를 바꿔 재배치)로 `disabledKey`/최종 참조 안정성을 확인하는 케이스 1개.

### 요약
이번 §3.2 구현의 테스트는 2회의 선행 ai-review 라운드를 거치며 실질적으로 성숙했다 — 형제 훅 관례에 맞춘 `renderHook` 단위 테스트 7케이스가 신설되어 실제 Zustand 스토어(mock 없이 `useExecutionStore.setState`)를 그대로 사용하고, `resolveEdgeExecutionState`(9케이스: 우선순위·방향성·실패 경로 포함) · `buildEdgeStyle`(5케이스, `custom-edge.tsx` 인라인 로직을 순수 함수로 추출해 이전 라운드의 "컴포넌트 스타일 조립 미검증" WARNING 을 근본적으로 해소)까지 판정 로직 전 층위가 커버된다. 테스트 격리(스토어 `beforeEach` 리셋)와 가독성(한국어 describe/it 명명, 의도 주석)도 양호하다. 다만 이번 diff 전체의 존재 이유였던 "노드 드래그로 `nodes` 참조가 바뀌어도 무관한 엣지가 재계산되지 않는다"는 핵심 성능 회귀 가드와, 사용자 문서가 약속하는 "비활성 노드 재활성화 시 원상 복귀" 동작은 여전히 코드 리뷰·주석 추론으로만 보증될 뿐 재렌더 간 실제 전이를 재현하는 자동화 테스트가 없다 — 둘 다 `renderHook`+`rerender`(또는 `act`)로 쉽게 추가 가능한 낮은 비용의 개선이며, 나머지는 선택적 보강 수준의 INFO 다.

### 위험도
LOW
