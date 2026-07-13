# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 상태-파생 boilerplate 3줄 패턴 반복
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect`(`reconnectEdge` 이후)와 `removeEdge`
  - 상세: 두 액션 모두 "`nextEdges` 계산 → `deriveContainerAssignments(state.nodes, nextEdges)` → `return { edges: nextEdges, nodes: nextNodes, isDirty: true }`" 동일 3줄 종결부를 반복한다(주석상 기존 `onEdgesChange` remove 경로와도 동일 패턴). 기능 결함은 아니며 zustand reducer 관용구 수준의 경미한 중복이라 리스크는 낮다.
  - 제안: 필요 시 `commitEdges(state, nextEdges)` 같은 작은 헬퍼로 추출 고려(선택 사항, 현재 규모로는 시급하지 않음).

- **[INFO]** 훅 단위 테스트 셋업 반복
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-reconnect.test.ts` 4개 `it` 블록
  - 상세: 각 테스트가 `reconnect = vi.fn()` / `removeEdge = vi.fn()` / `renderHook(() => useEdgeReconnect(...))` 를 동일하게 반복 선언한다. `beforeEach` 로 추출 가능하나 테스트 4건 규모에서는 가독성 저해가 크지 않다.
  - 제안: 조치 불필요 수준(테스트 파일이 더 늘어날 때 재검토).

- **[INFO, 긍정]** 이전 2회 리뷰(2026-07-13 `12_40_48`, `13_06_50`)에서 제기된 유지보수성 WARNING/INFO 전건이 이번 diff 에서 실제로 해소됨을 코드로 확인:
  - `onConnect`/`onReconnect` 검증 + 엣지데이터 파생 로직 리터럴 중복(12_40_48 WARNING) → `evaluateConnection`/`buildEdgeDataForConnection` 공용 헬퍼로 추출되어 양쪽이 호출.
  - `null`/`""`/문자열 3중 sentinel 규약(13_06_50 WARNING, 당시 함수명 `evaluateConnectionRejection`) → `{ ok: true } | { ok: false; message?: string }` 판별 유니온으로 리팩터(함수명도 `evaluateConnection` 으로 정리) — truthy 단축 실수를 컴파일 타임에 차단하는 구조로 개선.
  - CHANGELOG/spec 이 이미 제거된 `onReconnectStart` 배선을 계속 서술하던 문서-코드 불일치(13_06_50 WARNING) → 이번 diff 의 `CHANGELOG.md`/`spec/3-workflow-editor/2-edge.md` §1.3 는 "`onReconnect`/`onReconnectEnd` 두 콜백만 배선"으로 정정됨.
  - `reconnectEdgeInStore` 셀렉터 네이밍이 인접 `onConnect` 컨벤션과 다른데 이유 미표기(12_40_48 INFO) → `workflow-canvas.tsx` 에 캔버스 콜백 `handleReconnect` 와의 혼동 회피 목적을 밝히는 한 줄 주석 추가됨.
  - `firstInputHandleId` 의 `"emit"` 매직 스트링 → `RESERVED_INPUT_HANDLE_IDS` 명명 상수 + backend SoT(`shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`) 참조 주석 + 테스트 2건.

- **[INFO, 긍정]** `use-edge-reconnect.ts` JSDoc 품질
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: 과거 CRITICAL(자기연결/무효 핸들 드롭이 "빈 영역 드롭" 으로 오판돼 엣지가 삭제되던 결함)의 재발을 막기 위해 "success 플래그가 아니라 드롭 위치(`toNode`)로 판정해야 하는 이유"를 ⚠️ 경고 블록으로 명시했고, 이 서술과 1:1 대응하는 renderHook 회귀 가드 테스트("무효 핸들 위 드롭이면 삭제하지 않는다")가 함께 존재한다. 코드만으론 드러나지 않는 설계 의도(왜 이 방식이어야 하는가)를 남겨 향후 편집자가 같은 실수를 반복하지 않게 하는 모범 사례.

## 요약

`use-edge-reconnect.ts`/`editor-store.ts`/`edge-utils.ts` 신규·변경 코드는 함수 길이가 짧고 중첩이 얕으며, 판정 로직(재연결/detach)이 순수 훅·순수 헬퍼로 분리돼 993줄 규모의 `workflow-canvas.tsx` 를 추가로 비대하게 만들지 않았다. 무엇보다 이 PR 은 동일 세션 내 2회의 선행 ai-review(`12_40_48`→CRITICAL 1+WARNING 3, `13_06_50`→WARNING 2)에서 지적된 유지보수성 항목 — 검증/데이터파생 로직 중복, 암묵적 sentinel 반환 규약, 문서-코드 불일치(`onReconnectStart`), 네이밍 이유 미표기 — 을 모두 실제 코드 변경으로 해소했음을 diff 상에서 직접 확인했다. 남은 것은 `onReconnect`/`removeEdge` 의 3줄짜리 상태-파생 종결부 반복과 훅 테스트의 셋업 보일러플레이트뿐이며, 둘 다 기능 리스크 없는 선택적 개선 수준(INFO)이다.

## 위험도
NONE
