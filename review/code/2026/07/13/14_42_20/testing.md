### 발견사항

- **[WARNING] `use-edge-execution-state.test.ts` 5케이스 모두 "렌더 전 상태 세팅"만 검증 — 실행 중 실시간 전이(재렌더) 시나리오 미검증**
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts` (전체)
  - 상세: 5개 테스트 모두 `useExecutionStore.setState(...)` 를 `renderHook` **이전**에 호출한 뒤 단일 렌더 결과만 단언한다. 정작 이 훅의 존재 이유(§3.2 구현 커밋 메시지·주석에 명시)는 "실행 중 매 tick `nodeStatuses` 가 새 `Map` 으로 바뀌어도 실제로 상태가 변한 소수의 엣지만 새 객체가 되고 나머지는 재사용된다"는 **재렌더 간** 참조 안정성인데, 이를 실제로 재현하는 테스트가 하나도 없다(`rerender`/`act` 이후 store 업데이트 미사용). 형제 훅 `use-edge-highlighting.test.ts` 는 동일한 관례가 걸린 지점에서 `renderHook` 으로 먼저 마운트한 뒤 `act(() => useCanvasHoverStore.setState(...))` 로 스토어를 갱신해 훅이 실제로 반응(재계산)하는지, 그리고 무관한 엣지가 참조를 유지하는지를 검증한다 — 이번 신규 테스트는 이 패턴을 따르지 않는다. 결과적으로 (a) 노드가 `running`→`completed` 로 전이되는 도중 무관한 엣지들이 진짜로 원본 참조를 유지하는지, (b) 이전 라운드에서 지적됐던 "`executing=true` 인데 `nodeStatuses` 가 아직 빈 Map인 찰나" 경계(조기 반환 조건이 깨져 전체 배열이 불필요하게 재생성됨, 이전 testing.md WARNING #2)가 실제로 재현되는지가 여전히 검증되지 않는다.
  - 제안: 기존 5케이스에 더해 `renderHook(({edges,nodes}) => useEdgeExecutionState(edges,nodes), {initialProps})` + `rerender` 또는 `act(() => useExecutionStore.setState(...))` 로 (1) 두 엣지 중 하나만 상태가 바뀌었을 때 나머지 엣지가 이전 렌더의 참조와 `toBe` 동일한지, (2) `status:"running"` 인데 `nodeStatuses` 가 비어 있는 과도 상태에서의 동작을 명시적으로 문서화하는 케이스를 추가.

- **[WARNING] `custom-edge.tsx` 의 `inactive` 스타일 분기·`props.style` 우선순위 상호작용이 여전히 미검증(이월 상태 유지)**
  - 위치: `codebase/frontend/src/components/editor/canvas/custom-edge.tsx` (`...(inactive ? { opacity: 0.4, strokeDasharray: "6 4" } : {})`, 뒤이은 `...props.style` 스프레드)
  - 상세: 이 diff 가 참조하는 직전 라운드 리뷰(`review/code/2026/07/13/14_20_12/testing.md`, `RESOLUTION.md` 항목 #3)에서 이미 지적된 갭이며, `RESOLUTION.md` 는 이를 "이월"로 명시적으로 defer 했다. 현재도 `custom-edge.tsx` 에 대응하는 테스트 파일이 여전히 존재하지 않는다(`find` 결과 0건). `props.style` 이 React Flow 내부에서 `opacity`/`strokeDasharray` 를 주입하는 경로가 있다면 `inactive` 스타일이 조용히 덮어써질 수 있고, `selected && inactive`, `isHighlighted && inactive` 조합도 여전히 미검증이다. 의도된 defer 이므로 감점 요소로 보진 않되, §4 오케스트레이션 작업 시 반드시 편입돼야 할 잔여 항목으로 재확인.
  - 제안: 스타일 조립을 `buildEdgeStyle(props)` 형태 순수 함수로 추출해 `edge-utils.ts` 패턴처럼 단위 테스트하거나, canvas RTL 하네스 도입 시 우선 편입.

- **[INFO] `resolveEdgeExecutionState` 가 `completed`/`running` 이외 `NodeExecutionStatus` 값(`failed`/`cancelled`/`skipped`/`waiting_for_input`)에 대한 명시적 테스트 없음**
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` (`resolveEdgeExecutionState (§3.2)` describe 블록, 7케이스)
  - 상세: 실제 스토어 `NodeExecutionStatus` 유니온(`execution-store.ts`)은 `pending`/`running`/`completed`/`failed`/`cancelled`/`skipped`/`waiting_for_input` 7종이다. 현재 7케이스는 `"completed"`/`"running"` 리터럴만 조합해 검증하며, 예컨대 "source 는 완료됐지만 target 이 `failed` 로 전이" 같은 실제로 자주 발생하는 실패 경로에서 flowing/completed 가 정확히 모두 false 로 떨어지는지(엣지가 "실행 중" 스타일에 멈춰있지 않는지)를 확인하는 케이스가 없다. 로직상 정답은 예측 가능하나 실패 경로는 실행 취소/에러 처리와 맞물려 회귀 위험이 상대적으로 높은 지점이라 회귀 가드 가치가 있다.
  - 제안: `it("target 이 failed 면 flowing/completed 모두 false")` 등 1~2 케이스 추가 권장(선택 사항).

- **[INFO] `flowing` 판정의 방향성 역전 케이스(source `running` + target `completed`) 미검증**
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` (동일 describe 블록)
  - 상세: `flowing` 은 spec·주석 모두 "데이터 이동 방향"을 명시(source 완료 + target 실행 중)하는데, 테스트는 정방향(`source:"completed", target:"running"`)만 다루고 역방향(`source:"running", target:"completed"`)이 `flowing:false` 임을 확인하는 케이스가 없다. 방향 조건이 실수로 뒤집혀도(`sourceStatus==='running' && targetStatus==='completed'`) 현재 테스트 스위트로는 잡히지 않는다.
  - 제안: 역방향 조합 1케이스 추가.

- **[INFO] `edge.data` 의 기존 임의 필드(예: `portType`) 보존 여부를 명시적으로 검증하는 테스트 부재**
  - 위치: `use-edge-execution-state.ts` (`data: { ...(edge.data ?? {}), edgeInactive: state.inactive }`), 대응 테스트 파일의 `edge()` 헬퍼(`{ id, source, target }` — `data` 필드 자체를 부여하지 않음)
  - 상세: `workflow-canvas.tsx` 배선상 이 훅에 들어오는 `edges` 는 `useEditorStore` 의 실제 엣지로, 실제 운용 환경에서는 이미 `enrichEdgesWithPortData` 등을 거쳐 `data.portType` 을 포함하고 있을 가능성이 높다. 현재 스프레드 구현은 정확히 필드를 보존하지만(코드 검토로 확인), 이를 보증하는 회귀 테스트가 없어 향후 리팩터링(예: 스프레드를 신규 객체 리터럴로 교체) 시 `portType` 유실이 조용히 발생해도 테스트가 못 잡는다.
  - 제안: `edge()` 헬퍼에 `data: { portType: "system" }` 같은 사전 필드를 부여한 케이스를 하나 추가해, 병합 후에도 해당 필드가 유지되는지 단언.

- **[INFO] `useEdgeExecutionState` → `useEdgeHighlighting` 합성(className Set 병합) 을 검증하는 통합 테스트 부재**
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:164-166` (두 훅 체이닝)
  - 상세: 두 훅은 각각 독립적으로 잘 테스트돼 있으나(`use-edge-execution-state.test.ts` 5케이스, `use-edge-highlighting.test.ts`), 실제 배선처럼 `executionEdges = useEdgeExecutionState(edges, nodes)` 결과를 `useEdgeHighlighting` 에 다시 흘려 `className` 이 `"edge-flowing edge-highlighted"` 형태로 정확히 공존하는지 확인하는 테스트는 없다. `RESOLUTION.md`/이전 라운드 리뷰가 이미 "canvas RTL 하네스 부재"를 알려진 한계로 기록하고 §4 오케스트레이션 정리 시 편입 예정임을 명시했으므로 새로운 지적은 아니나, 이번 라운드에서도 여전히 유효한 잔여 갭임을 재확인.
  - 제안: 조치 불요(§4 로 이월된 기존 결정 유지), 참고용 기록.

### 요약
핵심 판정 로직(`resolveEdgeExecutionState`, edge-utils.test.ts 7케이스)과 이를 소비하는 훅(`useEdgeExecutionState`, 신규 use-edge-execution-state.test.ts 5케이스)이 이전 라운드 WARNING(훅 단위 테스트 부재)을 실제로 해소했고, 실제 zustand 스토어(`useExecutionStore.setState`)를 mock 없이 그대로 사용해 `nodeStatuses` Map→`nodeStatusById` 변환까지 실제 셰이프로 검증한 점은 긍정적이다(mock 과 실제 동작의 괴리 없음). 다만 신규 테스트가 전부 "렌더 이전에 상태를 고정"하는 방식이라, 이 훅의 설계 목적 그 자체인 "재렌더 간 참조 안정성"(실행 tick·노드 드래그 시 무관한 엣지의 bail-out)을 형제 훅(`use-edge-highlighting.test.ts`)의 `act()`+스토어 업데이트 패턴과 달리 재현하지 않는다는 점이 가장 아쉬운 갭이다. `custom-edge.tsx` 의 inactive 스타일 분기 미검증은 직전 라운드에서 이미 지적·의도적으로 이월된 항목으로 재확인만 하며, 그 외 실패/취소 상태·방향성 역전·data 필드 보존·상위 합성 검증 부재는 모두 낮은 우선순위의 INFO 성격 보강 여지다. 테스트 격리(스토어 `beforeEach` 리셋)·가독성(한국어 describe/it 명명)은 양호하다.

### 위험도
LOW
