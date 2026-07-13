### 발견사항

- **[WARNING] 신규 훅 `use-edge-execution-state.ts` 에 대응하는 단위 테스트 파일 부재**
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (신규, 70줄)
  - 상세: 같은 디렉터리의 형제 훅들(`use-edge-highlighting.ts` → `__tests__/use-edge-highlighting.test.ts`, `use-edge-reconnect.ts` → `__tests__/use-edge-reconnect.test.ts`)은 모두 `renderHook` + store `setState` 로 훅 자체를 단위 테스트하는 것이 이 코드베이스의 확립된 관례다. 그런데 이번에 추가된 `useEdgeExecutionState` 는 그 관례를 벗어나 순수 판정 함수 `resolveEdgeExecutionState`(edge-utils.ts)만 vitest 7케이스로 커버되고, 훅 자체(`disabledNodeIds`/`nodeStatusById` 구성, `useMemo` 조기 반환 최적화, `className`/`data.edgeInactive` 조립)는 어떤 테스트로도 실행되지 않는다. `grep` 결과 `useEdgeExecutionState`·`wc-edge-flowing`·`wc-edge-completed`·`edgeInactive` 를 참조하는 테스트가 저장소 전체에 0건이다.
  - 제안: `use-edge-highlighting.test.ts` 패턴을 그대로 따라 `__tests__/use-edge-execution-state.test.ts` 를 추가한다. 최소한 다음을 커버해야 한다.
    - 실행 컨텍스트가 전혀 없을 때(`disabledNodeIds.size===0 && !executing && nodeStatusById.size===0`) 원본 `edges` 참조를 그대로 반환하는지(ref-equality) — 형제 훅 테스트의 "returns original edges reference" 케이스와 동일한 회귀 가드.
    - `nodes` 배열에서 `data.isDisabled=true` 인 노드 id 가 `disabledNodeIds` 로 올바르게 모이는지.
    - `nodeStatuses`(zustand `Map<string, NodeStatusInfo>`) → `nodeStatusById`(`Map<string, string>`) 변환이 실제 스토어 셰이프와 맞물려 동작하는지(현재는 `resolveEdgeExecutionState` 테스트가 만든 인위적 `ctx()` 로만 검증되고, 실제 스토어 데이터 흐름은 미검증).
    - `state.flowing`/`state.completed` 에 따라 `edge.className` 이 `FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS`/`undefined` 중 정확히 하나로 설정되는지.
    - `edge.data.edgeInactive` 가 기존 `edge.data` 를 보존하면서 병합되는지(다른 필드 유실 없음).

- **[WARNING] 경계 조건: `executing=true` 이지만 `nodeStatuses` 가 아직 비어 있는 순간의 재계산 동작 미검증**
  - 위치: `use-edge-execution-state.ts:524-530` (조기 반환 조건)
  - 상세: 조기 반환 조건은 `disabledNodeIds.size===0 && !executing && nodeStatusById.size===0` 세 항목의 AND 다. 실행이 막 시작돼 `status` 가 `"running"` 으로 바뀌었지만 아직 어떤 노드도 상태를 보고하지 않은 찰나(`nodeStatuses` 여전히 빈 Map)에는 `!executing` 이 `false` 라 조기 반환 조건이 깨지고, 의미 있는 변화가 전혀 없는데도 전체 `edges` 배열이 새 객체로 재조립된다(모든 엣지의 `data` 참조가 바뀜). 이 경계는 로직상 정답 자체는 맞지만(모든 엣지가 결국 `{inactive:false, flowing:false, completed:false}`), "불필요한 re-render 방지" 라는 훅 자체의 설계 의도(주석에 명시)에 반하는 사각지대이며 어떤 테스트도 이 케이스를 명시적으로 검증하지 않는다.
  - 제안: 위 신규 테스트 파일에 `executing:true, nodeStatuses: empty` 케이스를 추가해 의도된 동작인지(엣지 배열 전체가 새 참조가 되는 것이 허용 범위인지, 아니면 조기 반환 조건에 `nodeStatusById.size===0` 만으로 충분한지) 문서화·확정한다.

- **[WARNING] `custom-edge.tsx` 의 `inactive` 스타일 분기 및 `props.style` 오버라이드 상호작용 미검증**
  - 위치: `codebase/frontend/src/components/editor/canvas/custom-edge.tsx:29-34`
  - 상세: `custom-edge.tsx` 자체가 원래부터 컴포넌트 테스트 파일이 없던 상태(사전 존재 갭)이긴 하나, 이번 diff 로 `...(inactive ? { opacity: 0.4, strokeDasharray: "6 4" } : {})` 분기가 추가됐고 그 뒤에 `...props.style` 이 스프레드된다. `props.style` 이 `opacity`/`strokeDasharray` 를 포함해 내려오는 경로(React Flow 가 내부적으로 주입하는 경우)가 있다면 `inactive` 스타일이 조용히 덮어써질 수 있는데, 이 우선순위 상호작용을 검증하는 테스트가 전무하다. `selected && inactive` 조합, `isHighlighted && inactive` 조합도 마찬가지로 미검증.
  - 제안: 최소한 순수 스타일 조립 로직만이라도 (예: RTL 로 `render(<CustomEdge .../>)` 후 path 의 `style` 속성 assert, 또는 스타일 조립을 별도 순수 함수로 뽑아 vitest) 검증. 컴포넌트 RTL 하네스가 부담스러우면 `buildEdgeStyle(props)` 같은 순수 함수로 추출해 edge-utils 패턴처럼 단위 테스트하는 편이 테스트 용이성 측면에서 더 낫다.

- **[INFO] `resolveEdgeExecutionState` 의 `nodeStatusById: ReadonlyMap<string, string>` 타입이 실제 `NodeExecutionStatus` 유니온과 분리되어 있음**
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts:2988-2995`
  - 상세: 실제 스토어의 `NodeStatusInfo.status` 는 `"pending"|"running"|"completed"|"failed"|"cancelled"|"skipped"|"waiting_for_input"` 유니온이지만, 순수 함수 시그니처는 `string` 을 받는다. 테스트(`edge-utils.test.ts`)도 임의 문자열(`"completed"`, `"running"`)을 넘기므로 오타(`"compelted"`)가 있어도 타입 체커가 잡아내지 못하고 테스트도 통과해버린다 — mock 이 실제 값 집합과 괴리될 수 있는 지점.
  - 제안: `ctx.nodeStatusById` 를 `ReadonlyMap<string, NodeExecutionStatus>` 로 좁혀 타입 안전성을 회복하면, 테스트에 넘기는 문자열도 실제 스토어 값과 자동으로 정합된다.

- **[INFO] 부분 상태(source 만 상태 있고 target 은 없음, 혹은 반대)에 대한 명시적 테스트 케이스 부재**
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts:1813-1880`
  - 상세: 현재 7케이스는 "둘 다 없음", "둘 다 completed", "source completed + target running(+/-executing)", "disabled 조합" 을 커버하지만, "source 만 상태 있고 target 은 없음"(예: source `completed`, target 상태 미보고) 같은 한쪽만 채워진 경우는 명시적으로 다루지 않는다. 로직상 결과는 예측 가능(둘 다 false)하지만, 이런 부분 상태는 실제 실행 중(노드들이 순차적으로 완료 이벤트를 보고하는) 가장 흔히 거치는 과도 상태라 회귀 가드로서의 가치가 있다.
  - 제안: `it("target 상태가 없으면 flowing/completed 모두 false")` 케이스 1개 추가 권장(선택 사항, CRITICAL 아님).

### 요약
새로 도입된 순수 판정 함수 `resolveEdgeExecutionState` 는 상호배타 우선순위(inactive > flowing/completed)를 포함해 7개 케이스로 꼼꼼하게 단위 테스트됐고 가독성도 좋다. 다만 그 판정 결과를 실제로 소비·조립하는 신규 훅 `use-edge-execution-state.ts` 는 이 코드베이스에서 형제 훅들(`use-edge-highlighting`, `use-edge-reconnect`)이 예외 없이 갖추고 있는 `renderHook` 단위 테스트가 전혀 없어 관례에서 벗어난 커버리지 공백이다. 특히 "실행 컨텍스트 없음 → 원본 참조 반환" 최적화와 `nodeStatuses` Map → `nodeStatusById` 변환, `className`/`data.edgeInactive` 조립 등 이 훅 고유의 로직은 순수 함수 테스트로는 검증되지 않는다. `custom-edge.tsx` 의 `inactive` 스타일 분기도 `props.style` 과의 우선순위 상호작용이 미검증 상태다. CSS·문서·plan/spec 변경은 성격상 단위 테스트 대상이 아니며 적절히 제외됐다. 전체적으로 핵심 판정 로직의 테스트 품질은 높으나 "glue" 계층(훅·컴포넌트)의 테스트 용이성·실제 커버리지가 이 저장소의 기존 기준에 못 미친다.

### 위험도
WARNING
