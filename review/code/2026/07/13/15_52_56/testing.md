### 발견사항

- **[WARNING]** 신규 `useEdgeHoverPreview` 훅에 대한 테스트가 전무
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts` (신규, 58줄)
  - 상세: `show`/`scheduleHide`/`keepAlive`/`dismiss` 4개 액션과 `HIDE_DELAY_MS`(200ms) 지연 취소 로직을 가진, 타이밍 경쟁을 다루는 훅인데도 전용 테스트 파일이 없다. 같은 디렉터리의 형제 훅들 — `use-edge-execution-state.test.ts`(9케이스, "rerender 참조 안정 포함"), `use-edge-highlighting.test.ts`, `use-edge-reconnect.test.ts` — 은 모두 `renderHook` 단위 테스트를 갖추고 있어 이 파일만 관례를 벗어난다. 이 훅이 존재하는 이유 자체가 "엣지를 벗어나도 즉시 숨기지 않고, 커서가 툴팁으로 이동할 시간을 준다"는 타이밍 경쟁 처리인데, 다음 시나리오가 전혀 검증되지 않는다: (1) `scheduleHide` 후 200ms 이내 `show`/`keepAlive` 호출 시 대기 중이던 hide 타이머가 실제로 취소되는지, (2) `scheduleHide` 후 200ms 경과 시 `preview`가 실제로 `null`이 되는지, (3) 컴포넌트 unmount 시 pending 타이머가 정리되지 않아(별도 `useEffect` cleanup이 코드에 없음) unmount 이후 `setPreview`가 호출될 잠재적 leak/경고 여지. 코드베이스에는 이미 동일한 "지연 후 숨김" 패턴을 `vi.useFakeTimers()`로 검증하는 선례(`use-cafe24-pending-polling.test.tsx`, `secret-reveal-box.test.tsx` 등)가 다수 있어 테스트 작성이 특별히 어려운 구조도 아니다.
  - 제안: `use-edge-hover-preview.test.ts`를 추가해 `renderHook` + `vi.useFakeTimers()`로 위 3가지 타이밍 시나리오(재진입 취소, 지연 후 숨김, unmount cleanup)를 커버할 것.

- **[WARNING]** 신규 컴포넌트 `EdgeDataPreviewTooltip`/`EdgeDataModal`에 대한 RTL 테스트가 전무
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (신규, 127줄)
  - 상세: 같은 디렉터리의 다른 UI 컴포넌트들 — `container-delete-dialog.test.tsx`, `custom-node.test.tsx`, `zoom-controls.test.tsx`, `canvas-empty-state.test.tsx` — 은 모두 대응 RTL 테스트를 갖고 있고, `container-delete-dialog.test.tsx`가 보여주듯 이 코드베이스에서 Radix `Dialog` 기반 컴포넌트도 특별한 포털 mocking 없이 `screen.getByRole("dialog")`로 손쉽게 테스트 가능하다(jsdom 환경에서 검증된 패턴). 그럼에도 이번 두 컴포넌트는 테스트가 하나도 추가되지 않아 다음이 전부 미검증 상태다: `data === undefined || summary.isEmpty`일 때 툴팁이 실제로 `null`을 렌더하는지(가장 중요한 "실행 데이터 없으면 렌더 안 함" 요구사항), "전체 데이터 보기" 클릭 시 `onOpenModal(edgeId)`가 올바른 인자로 호출되는지, `onMouseEnter`/`onMouseLeave`가 `onKeepAlive`/`onDismiss`에 배선돼 있는지, 모달이 `edgeId !== null`일 때만 열리는지, `useEdgeFlowData`의 "여러 nodeResults 중 source와 매칭되는 가장 최근(뒤에서부터 탐색) 결과 채택" 로직(Loop/ForEach 다회 실행 시 마지막 iteration 우선) — 이 부분은 주석으로 문서화까지 됐지만 코드 경로를 실행하는 테스트가 전혀 없다.
  - 제안: `__tests__/edge-data-preview.test.tsx` 신설. `useExecutionStore`를 실제 스토어 API(`setState`)로 세팅해 nodeResults 목록을 주입하고, 위 렌더 분기·클릭 핸들러·최근 결과 선택 로직을 검증.

- **[WARNING]** `EdgeDataModal`의 "데이터 없음" 판정이 `undefined`만 검사해 `null` 출력 시 리터럴 `"null"`이 노출될 수 있음(미검증 엣지 케이스)
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:305-307`
  - 상세: `data === undefined ? "표시할 데이터가 없어요." : JSON.stringify(data, null, 2)`. 그러나 `unwrapNodeOutput`(`output-shape.ts`)은 "partial new shape"(예: 노드가 `waiting_for_input`으로 대기 중이라 아직 최종 output이 없는 경우)에서 `output: null`을 반환하도록 명시적으로 설계되어 있다. 이 경우 `useEdgeFlowData`가 반환하는 값은 `null`이고, `JSON.stringify(null, null, 2)` → 문자열 `"null"`이 그대로 모달에 렌더된다("표시할 데이터가 없어요" 대신 알아보기 힘든 `null` 텍스트가 뜬다). 현재 배선상으로는 툴팁이 `summarizeDataForPreview(null).isEmpty === true`라 렌더되지 않으므로 "전체 데이터 보기" 버튼 자체가 노출되지 않아 오늘 당장은 도달 불가능한 경로이지만, `EdgeDataModal`은 주석대로 "hover 생명주기와 독립적으로" 열리도록 설계된 컴포넌트라 향후 다른 진입점(예: context 메뉴에서 직접 모달 열기)이 추가되면 조용히 어긋나는 잠재 결함이다. 이 불변식(툴팁이 게이트라 null이 도달 안 함)을 문서화하거나 강제하는 테스트가 없다.
  - 제안: 최소한 `data === undefined || data === null` 로 통일하거나, 혹은 "이 모달은 툴팁을 통해서만 열리므로 null이 도달하지 않는다"는 불변식을 테스트로 고정(회귀 가드).

- **[INFO]** `useEdgeHoverPreview()` 반환 객체가 매 렌더 새 참조 — 형제 훅들이 지키는 참조 안정성 관례와 대비되나 검증 부재
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts:481-519`, 소비처 `workflow-canvas.tsx:927-941`
  - 상세: `show`/`scheduleHide`/`keepAlive`/`dismiss` 개별 콜백은 `useCallback`으로 안정화되어 있지만, 훅이 반환하는 객체 `{ preview, show, scheduleHide, keepAlive, dismiss }` 자체는 `useMemo` 없이 매 렌더 새 리터럴이다. `workflow-canvas.tsx`의 `onEdgeMouseEnter`/`onEdgeMouseLeave`가 이 객체 전체를 `useCallback` 의존성 배열에 넣고 있어(`[setHoveredEdge, edgeHoverPreview]`), 캔버스가 리렌더될 때마다 두 콜백도 함께 재생성된다. 같은 PR 그룹의 형제 훅(`use-edge-execution-state`)은 "실행 tick·노드 드래그 시 전체 엣지 재생성을 피하는" per-edge bail-out을 구현하고 이를 `renderHook` 참조안정성 테스트 9케이스로 명시 검증하는데, 이번 훅은 그 관례와 반대 방향이고 이를 잡아낼 테스트도 없다.
  - 제안: 훅 반환값을 `useMemo`로 감싸거나(참조 안정), 최소한 `renderHook`으로 "동일 preview 상태에서 rerender 시 콜백/객체 참조가 유지되는지"를 확인하는 회귀 테스트를 추가.

- **[INFO]** `summarizeDataForPreview`의 경계값(최상위 배열 정확히 5개, 객체 필드 정확히/초과 20개)이 테스트되지 않음
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts`, 대응 구현 `edge-data-preview.ts`의 `MAX_TOP_ARRAY=5`/`MAX_TOP_KEYS=20`
  - 상세: 배열 축약 테스트는 7개 아이템만 사용해 "5개 초과"만 검증하고 "정확히 5개"(축약 문구 안 붙어야 함) 경계는 없다. `MAX_TOP_KEYS=20`(객체 필드 20개 초과 시 `{N} more fields` 축약) 로직은 테스트 객체가 4개 필드뿐이라 전혀 실행되지 않는다. `formatBytes`도 245/2048/2*1024*1024 값만 써서 1024, 1024*1024 정확 경계(등호 분기)가 미검증이다.
  - 제안: 배열 5개(경계, 축약 없음)·21개(경계 초과, `more fields` 문구 포함) 케이스와 `formatBytes(1024)`/`formatBytes(1024*1024)` 경계 케이스를 추가.

- **[INFO]** `use-edge-hover-preview.ts`/`edge-data-preview.tsx`는 순수 함수 의존(스토어는 `useExecutionStore` 직접 구독)이라 테스트 용이성 자체는 양호 — 위 갭은 설계 문제가 아니라 누락
  - 상세: `useEdgeFlowData`가 `useExecutionStore`를 직접 구독하지만 이 스토어는 Zustand라 테스트에서 `setState`로 손쉽게 시드 가능하고(다른 canvas 테스트들이 이미 이런 패턴을 사용), 각 로직(타이머 관리, 데이터 조회)이 이미 훅/순수함수로 분리돼 있어 테스트 작성 난이도가 높지 않다. 즉 위에서 지적한 갭들은 "테스트하기 어려운 구조"가 아니라 순수히 테스트 작성이 누락된 것으로 보인다.

- **[없음 — 긍정 사항]** 순수 util(`summarizeDataForPreview`/`formatBytes`) 테스트는 가독성·격리 면에서 양호
  - 상세: `edge-data-preview.test.ts` 10케이스는 한국어 설명이 명확하고 각 테스트가 서로 독립적(공유 상태 없음)이며 mock을 전혀 쓰지 않는 순수 함수 테스트라 실제 동작과의 괴리가 없다. 순환 참조 케이스(`circular.self = circular`)로 예외 안전성까지 검증한 점, `bytes`가 축약 전 원본 직렬화 크기임을 별도로 검증한 점도 꼼꼼하다.

### 요약

이번 변경의 핵심 순수 로직(`summarizeDataForPreview`/`formatBytes`, `lib/utils/edge-data-preview.ts`)은 10개의 명확하고 격리된 vitest 케이스로 잘 커버됐으나, 실제 사용자 상호작용을 담당하는 신규 훅(`use-edge-hover-preview.ts`)과 신규 컴포넌트(`edge-data-preview.tsx`의 `EdgeDataPreviewTooltip`/`EdgeDataModal`)에는 테스트가 전혀 추가되지 않았다. 이는 같은 디렉터리의 형제 훅·컴포넌트들이 예외 없이 갖추고 있는 테스트 관례에서 벗어난 것이며, 특히 `useEdgeHoverPreview`는 타이밍 경쟁(200ms 지연 취소)을 다루는 훅이라 회귀 위험이 낮지 않다. 추가로 `EdgeDataModal`의 null/undefined 처리 미세 불일치, 훅 반환 객체의 비메모이제이션으로 인한 참조 불안정(형제 훅들이 명시적으로 관리하는 성능 관례와 반대 방향) 등 실제 코드 리뷰에서도 잡힐 만한 엣지 케이스들이 테스트 부재로 인해 문서화·가드되지 않은 채 남아 있다. 다만 이 로직 전체가 배선되는 `workflow-canvas.tsx` 자체는 기존에도 테스트 하네스가 없던 파일(§1.2 이월 항목에 이미 "canvas RTL 하네스 부재로 미검증"이라 문서화됨)이라, 이번 PR만의 새로운 결함이라기보다는 기존 사각지대가 신규 기능에도 그대로 이어진 성격이 크다.

### 위험도

MEDIUM
