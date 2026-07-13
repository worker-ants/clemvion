# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `onConnect`/`onReconnect` 검증 + 엣지데이터 파생 로직 중복
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`(L710-747)와 신규 `onReconnect`(L749-792)
  - 상세: 두 액션 모두 (1) `isSelfConnection` 체크(early return) → (2) `isDuplicateConnection` 체크 + `toast.error("These nodes are already connected.")` → (3) `detectContainerConflict` 체크 + `toast.error(conflict)` → (4) `pushUndo`(또는 skip) → (5) `sourceNode` 조회 → `sourceNodeType` 추출 → `buildEdgeData` 호출의 동일한 5단계 시퀀스를 그대로 반복한다. 특히 "`sourceNode` 조회 → `sourceNodeType` 추출 → `buildEdgeData(...)`" 3줄(L733-735 / L776-778)은 리터럴 그대로 중복돼 있다. `onReconnect` 는 중복 검사에서 재연결 중인 엣지 자신을 제외하는 것만 다르고 나머지 검증 순서·문구는 동일하다. 이 상태에서 향후 새 검증 규칙(예: 신규 컨테이너 충돌 케이스, 사이클 관련 하드 차단 등)이 한쪽 함수에만 추가되고 반대쪽엔 반영되지 않는 drift 가 발생하기 쉽다.
  - 제안: 데이터 파생부는 `buildEdgeDataForConnection(nodes, connection)` 같은 작은 헬퍼로 추출하고, 검증 시퀀스도 `validateConnectionOrReject(nodes, edges, connection, { excludeEdgeId? })` 형태의 공용 함수로 뽑아 `onConnect`/`onReconnect` 양쪽이 호출하도록 하면 향후 규칙 추가 시 한 곳만 수정하면 된다. (기능적 결함은 아니며 리스크는 낮음 — 현재 두 곳의 로직은 서로 일치한다.)

- **[INFO]** 스토어 셀렉터 변수 네이밍 국소 비일관
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L347-349 부근 (`reconnectEdgeInStore`)
  - 상세: 인접한 다른 셀렉터들은 `onConnect = useEditorStore((s) => s.onConnect)` 처럼 store 필드명을 그대로 바인딩하는데, 이번에 추가된 줄만 `reconnectEdgeInStore` 로 리네이밍했다. `useEdgeReconnect` 훅이 반환하는 `onReconnect: handleReconnect` 와의 이름 충돌을 피하려는 의도적 선택으로 보이며 실제로 타당하지만, 코드만 봐서는 왜 이 줄만 다른 네이밍 컨벤션을 쓰는지 바로 드러나지 않는다.
  - 제안: `// store 원본 onReconnect — 아래 useEdgeReconnect 훅의 반환값과 이름 충돌 회피` 정도의 한 줄 주석이면 충분.

- **[INFO, 긍정]** `useEdgeReconnect` 훅 분리 및 테스트 품질
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`, `.../__tests__/use-edge-reconnect.test.ts`
  - 상세: React Flow 공식 recipe(ref 기반 성공 플래그)를 그대로 따르되 "직전 제스처의 성공 플래그가 다음 제스처로 이월되지 않는다" 같은 회귀 취약 케이스까지 `renderHook` 으로 커버했다. 오케스트레이션(콜백 배선)과 판정 로직(성공 플래그)을 분리해 `workflow-canvas.tsx`(993줄 규모의 기존 God Component)를 추가로 비대하게 만들지 않은 점도 바람직하다. plan 문서에서 §1.2 이월 항목 (a)/(d) 를 "부분 이행"으로 이미 추적 중이므로 잔여 오케스트레이션(§1.2 팝업 경로) 관련 후속 조치는 이 리뷰의 지적 대상이 아니다.

- **[INFO, 긍정]** `firstInputHandleId` 매직 스트링 제거
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` (`RESERVED_INPUT_HANDLE_IDS`)
  - 상세: "emit" 예약 포트 제외 로직을 매직 스트링 하드코딩 대신 명명된 `Set` 상수로 도입하고, backend SoT(`shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`)를 주석으로 명시했다. `edge-utils.test.ts` 에 케이스 2건도 추가돼 있어 모범적인 패턴이다.

## 요약

이번 변경은 기존 `workflow-canvas.tsx` 를 더 비대하게 만들지 않고 재연결(§1.3) 판정 로직을 신규 `useEdgeReconnect` 훅으로 순수 분리했고, 회귀에 취약한 detach 판정을 `renderHook` 단위 테스트로 촘촘히 커버했으며, 컨테이너 예약 포트 매직 스트링도 명명된 상수로 정리하는 등 가독성·테스트 가능성 측면에서 전반적으로 양호하다. 다만 `editor-store.ts` 의 `onConnect`/`onReconnect` 가 자기연결·중복·컨테이너 충돌 검증과 엣지 데이터 파생 로직을 리터럴 그대로 반복하고 있어(특히 "sourceNode 조회 → type 추출 → buildEdgeData" 3줄 중복), 향후 한쪽에만 새 검증 규칙이 추가되고 다른 쪽이 누락되는 drift 위험이 있다 — 현재 리스크 자체는 낮지만 공용 헬퍼 추출을 권장한다.

## 위험도
LOW
