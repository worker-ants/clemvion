### 발견사항

- **[WARNING]** `EdgeDataModal` 컴포넌트에 대한 테스트가 여전히 전무 — 직전 라운드에서 "고쳤다"고 주장한 결함이 회귀 가드 없이 남음
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataModal`), 테스트 `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx` (import 목록에 `EdgeDataModal` 없음)
  - 상세: 이번 라운드에 추가된 RTL 테스트 3건은 전부 `EdgeDataPreviewTooltip` 만 다루고 `EdgeDataModal` 은 한 번도 렌더되지 않는다. 그런데 직전 리뷰(`review/code/2026/07/13/15_52_56/SUMMARY.md` WARNING #6)가 지적한 "모달의 '데이터 없음' 판정이 `undefined`만 검사해 `output:null`일 때 리터럴 `\"null\"`이 노출될 수 있다"는 결함은 `RESOLUTION.md`에 `data == null`로 수정했다고 명시돼 있지만, 그 수정을 고정하는 회귀 테스트가 하나도 없다(테스트 없이 "반영"만 주장). 마찬가지로 WARNING #4("`JsonContent` 재사용")도 `EdgeDataModal`이 실제로 `JsonContent`를 데이터와 함께 렌더하는지, Dialog가 `edgeId !== null`일 때만 열리는지(`open={edgeId !== null}`), `onOpenChange(false)` 시 `onClose`가 호출되는지가 전부 미검증이다. 다음에 누군가 이 컴포넌트를 손대면(예: null 체크를 다시 `undefined`로 되돌리는 실수) 아무 테스트도 실패하지 않는다.
  - 제안: `EdgeDataModal`용 테스트를 추가한다 — (1) `edgeId=null`이면 Dialog 미노출, (2) source 결과가 `output: null`(partial output)일 때 "표시할 데이터가 없어요" 문구 렌더(리터럴 `"null"` 아님), (3) 정상 데이터일 때 `JsonContent`가 렌더되는지(예: `screen.getByRole("dialog")` 안에서 데이터 텍스트 확인), (4) 닫기 액션 시 `onClose` 호출.

- **[WARNING]** 툴팁의 `onMouseEnter`/`onMouseLeave` → `onKeepAlive`/`onDismiss` 배선이 여전히 미검증(직전 라운드 testing.md 가 명시적으로 지적했던 항목)
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:441-444`(`onMouseEnter={onKeepAlive}`, `onMouseLeave={onDismiss}`), 테스트 `edge-data-preview.test.tsx`
  - 상세: 이번 3개 RTL 테스트(무데이터 미렌더 / 축약 렌더 / 클릭→onOpenModal)는 마우스 enter/leave 이벤트를 전혀 시뮬레이션하지 않는다. `onKeepAlive: () => void`와 `onDismiss: () => void`는 타입 시그니처가 완전히 동일해서, 두 prop을 서로 바꿔 배선해도(`onMouseEnter={onDismiss}`, `onMouseLeave={onKeepAlive}`) TypeScript 컴파일은 통과한다 — 오직 동작 테스트만 이 실수를 잡을 수 있는데 그 테스트가 없다. 이 훅·컴포넌트가 애초에 존재하는 이유("커서를 툴팁으로 옮겨 클릭 가능하게")가 정확히 이 배선에 의존한다.
  - 제안: `fireEvent.mouseEnter`/`fireEvent.mouseLeave`를 툴팁 루트(`role="tooltip"`)에 발생시켜 각각 `onKeepAlive`/`onDismiss` mock 이 정확히 호출되는지 검증하는 케이스 추가.

- **[WARNING]** 신규 store selector `findLatestResultByNodeId`에 대한 직접 단위 테스트 부재
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts:712`(구현), `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`(형제 셀렉터 `findNodeResult`는 351행부터 전용 테스트가 있으나 `findLatestResultByNodeId`는 전혀 언급 없음)
  - 상세: 이 함수는 직전 라운드 WARNING #2("O(n) 역스캔 재도입 + `findNodeResult` 문서 불일치")를 해소하기 위해 새로 도입된 공유 selector인데, 정작 store 테스트 파일에는 케이스가 추가되지 않았다. 유일한 소비처인 `edge-data-preview.test.tsx`의 `seedResult` 헬퍼는 `lastIndexByNodeId`를 수동으로 `new Map([[nodeId, 0]])`로 직접 주입하므로, 함수 자체의 두 핵심 로직 — (1) JSDoc이 명시한 "인덱스가 stale(주석: `raw setState seeding 등`)일 수 있어 nodeId 재확인" 방어 분기(`row?.nodeId === nodeId ? row : undefined`가 실제로 `undefined`를 반환하는 경로), (2) "Loop/ForEach로 여러 번 실행된 노드는 마지막 iteration 결과를 반환한다"는 핵심 클레임(같은 nodeId가 `nodeResults`에 여러 번 나타나고 `lastIndexByNodeId`가 마지막 것을 가리키는 시나리오) — 이 둘 다 어디서도 검증되지 않는다. 또한 `RESOLUTION.md`는 이 selector 도입 목적을 "node-settings-panel.tsx/use-expression-context.ts 와 공유"라고 서술하지만 실제로는 두 파일 다 이 함수를 호출하지 않는다(grep 확인) — 통합 자체가 안 됐으므로 최소한 selector 단독 단위 테스트라도 필요하다.
  - 제안: `execution-store.test.ts`에 `findLatestResultByNodeId` 전용 케이스 추가 — 정상 조회, 인덱스 stale(다른 nodeId가 그 인덱스에 있는 경우) → `undefined`, 동일 nodeId 다중 행 중 최신(마지막) 채택.

- **[INFO]** `summarizeDataForPreview`/`formatBytes` 경계값 테스트가 이전 라운드 INFO#15 지적에도 이번 커밋에서 추가되지 않음
  - 위치: `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts`
  - 상세: 배열 축약은 7개 항목만 사용해 "5개 초과" 케이스만 검증하고 정확히 `MAX_TOP_ARRAY=5`개(축약 문구 없어야 함) 경계는 없다. 객체 필드도 4개뿐이라 `MAX_TOP_KEYS=20` 초과 축약 로직(`{N} more fields`)이 전혀 실행되지 않는다. `formatBytes`도 245/2048/2*1024*1024만 써서 `1024`, `1024*1024` 정확 경계(등호 분기: `bytes < 1024`, `bytes < 1024*1024`)가 미검증이다. `RESOLUTION.md`의 이월(INFO) 목록에도 이 항목이 언급되지 않아 의도적 defer 인지 단순 누락인지 불분명하다.
  - 제안: 배열 정확히 5개(축약 없음)·21개(경계 초과), 객체 정확히 20/21개 필드, `formatBytes(1024)`/`formatBytes(1024*1024)` 경계 케이스 추가.

- **[INFO]** `workflow-canvas.tsx`의 hover→미리보기 배선 자체는 여전히 통합 테스트 사각지대(신규 회귀 아님, 기존 갭 연장)
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onEdgeMouseEnter`/`onEdgeMouseLeave`가 `edgeHoverPreview.show(edge.id, event.clientX, event.clientY)`/`scheduleHide()` 호출, 조건부 `EdgeDataPreviewTooltip`/`EdgeDataModal` 렌더)
  - 상세: `workflow-canvas.tsx` 전체가 RTL 하네스 부재 상태(plan §1.2 이월 항목에 이미 문서화됨)라 이번 PR만의 새 결함은 아니다. 다만 `event.clientX`/`event.clientY`를 그대로 좌표로 쓰는 부분, `onOpenModal`이 `edgeHoverPreview.dismiss()`를 먼저 호출한 뒤 `setDataModalEdgeId`하는 순서 등은 훅/컴포넌트 단위 테스트만으로는 커버되지 않는다.
  - 제안: 우선순위 낮음 — canvas 통합 테스트 하네스가 마련되는 후속 작업(§4 오케스트레이션 정리) 시 함께 포함.

- **[없음 — 긍정 사항]** 이번에 추가된 `use-edge-hover-preview.test.ts`(5) · `edge-data-preview.test.tsx`(3, 컴포넌트) 는 mock 사용이 적절하고 격리·가독성이 양호
  - 상세: 전 테스트가 실제 Zustand store(`useExecutionStore.setState`)와 `vi.useFakeTimers()`만 사용해 불필요한 mocking 없이 실제 동작에 가깝게 검증한다. `beforeEach`로 store/타이머를 매번 초기화해 테스트 간 의존성이 없고, `afterEach(cleanup)`으로 DOM도 정리된다. hook 테스트는 지연 숨김(fake timer), keepAlive 취소, dismiss 즉시 처리, unmount 시 타이머 정리, 반환 객체 참조 안정성까지 실제 구현(`useCallback`/`useMemo` 의존성 체인)과 정확히 대응해 검증한다. 순수 util 테스트(10건, 순환 참조 안전성 포함)도 여전히 견고하다.

### 요약

직전 라운드 testing 리뷰(위험도 MEDIUM)가 지적한 핵심 갭 — 훅(`useEdgeHoverPreview`) 타이밍 경쟁 3케이스, 컴포넌트 렌더 분기/클릭 핸들러 — 은 이번 라운드에서 신설된 8개 테스트(hook 5 + component RTL 3)로 실질적으로 해소됐고, 순수 util 10건과 함께 총 18건의 테스트가 명확하고 격리된 형태로 잘 작성됐다. 그러나 같은 PR에서 함께 수정됐다고 주장하는 두 항목 — `EdgeDataModal`의 null-체크 수정과 store 신규 selector `findLatestResultByNodeId` — 은 정작 그 수정 자체를 고정하는 테스트가 하나도 없어 "고쳤다"는 주장이 회귀 가드 없이 남아 있다. 또한 툴팁의 mouse-enter/leave → keepAlive/dismiss 배선처럼 타입 시그니처가 동일해 컴파일러가 못 잡는 실수 유형은 여전히 미검증이다. 이 세 갭은 각각 별도 컴포넌트/함수를 겨냥한 국소적 추가로 해결 가능한 수준이라 병합을 막을 정도는 아니지만, 다음 회귀 발생 시 조용히 재발할 위험이 있다.

### 위험도

MEDIUM
