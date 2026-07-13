# 테스트(Testing) Review

## 컨텍스트
이번 diff 는 직전 리뷰(`review/code/2026/07/13/12_40_48`)가 발견한 CRITICAL(재연결 드래그가 자기연결/무효 핸들 드롭 시 기존 엣지를 잘못 삭제)을 `useEdgeReconnect` 훅을 "success 플래그" 대신 **드롭 위치(`connectionState.toNode`)** 기반으로 재설계해 해소한 상태다. 이 CRITICAL 재발을 막는 회귀 테스트(`무효 핸들 드롭이면 삭제하지 않는다`)가 실제로 추가되어 있고 vitest 로 통과함을 직접 실행해 확인했다(`use-edge-reconnect.test.ts` + `editor-store.test.ts` + `edge-utils.test.ts` = 122 passed). 아래는 그 위에서 남아 있는 커버리지 갭·문서-테스트 drift 위주 발견사항이다.

## 발견사항

- **[WARNING]** 재연결 시 포트색(`edgeData`) 재계산 로직이 어떤 테스트로도 검증되지 않음
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect` (신규 `buildEdgeDataForConnection` 호출 + `nextEdges.map` 병합부), 테스트는 `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("onReconnect (§1.3)")`
  - 상세: 코드 주석 자체가 "`reconnectEdge` 는 source/target/handle 만 갱신하므로, `sourceHandle` 이 바뀌면 포트색 `data` 가 stale 하다"는 리스크를 명시하며 이를 막기 위해 `edgeData` 를 재도출·병합하는 신규 로직을 넣었다. 그런데 4개 `onReconnect` 테스트 중 어느 것도 `edges[0].data` 를 단언하지 않고, 4개 케이스 모두 `sourceHandle: "out"` 을 그대로 유지한 채 `target` 만 바꾼다(`sourceHandle` 이 실제로 바뀌는 시나리오 — 예: 분기 노드의 다른 출력 포트로 재연결 — 이 전혀 없다). 즉 이 PR 이 새로 도입한 "핵심 로직"(stale 포트색 방지)이 정확히 그 핵심 로직을 검증하는 assertion 없이 머지된다. `buildEdgeDataForConnection` 이 잘못된 값을 반환하거나 `...((e.data as Record<string, unknown>) ?? {})` 병합 순서가 깨져도 현재 테스트 스위트는 통과한다.
  - 제안: `sourceHandle` 이 실제로 변경되는 재연결(예: `Case 1` → `Case 2` 출력)에서 `edges[0].data` 가 새 `sourceHandle` 기준으로 재계산됐는지 단언하는 케이스 1개 추가.

- **[WARNING]** `detectContainerConflict` 거부 경로가 `onConnect`/`onReconnect` 어느 쪽으로도 테스트되지 않음 — RESOLUTION.md 의 스킵 근거가 사실과 다름
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `evaluateConnectionRejection`(컨테이너 충돌 분기), `review/code/2026/07/13/12_40_48/RESOLUTION.md` disk-write gap 복구 표 "testing" 행
  - 상세: RESOLUTION.md 는 "컨테이너 충돌 거부는 `evaluateConnectionRejection` 공용화로 onConnect 경로와 동일 코드(별도 테스트는 ... 미추가)" 라고 적어, 마치 `onConnect` 경로에서 이미 검증됐다는 전제로 스킵을 정당화한다. 그러나 실제로 리포지토리 전체를 검색(`grep -rn "detectContainerConflict" **/*.test.ts`)해도 `detectContainerConflict` 를 직접 호출/모킹해 거부(toast) 분기를 실행하는 테스트가 **하나도 없다** — `onConnect — 금지 연결 하드 차단 (§2.2)` 블록도 자기연결·중복 두 케이스만 있고 컨테이너 충돌 케이스는 빠져 있다. 즉 "노드가 소속 컨테이너와 다른 컨테이너로 강제 배선되는 것을 막는다"는, 엔진 실행 시점 `CONTAINER_MISSING_EMIT` 오류를 예방하기 위한 핵심 불변식이 store 통합 테스트 레벨에서 `onConnect`/`onReconnect` 어느 쪽으로도 전혀 실증되지 않은 채 남아 있다(이번 PR 이 만든 회귀는 아니지만, 이번 PR 이 이 사각지대를 그대로 `onReconnect` 로 확장했고 그 스킵 근거를 잘못 기록했다).
  - 제안: 최소 1개(`onConnect` 또는 `onReconnect` 어느 한쪽) 통합 테스트로 "컨테이너 자식 노드를 다른 컨테이너 부모의 자식과 연결 시도 → toast + 엣지 미변경"을 실증. RESOLUTION.md 의 "이미 검증됨" 서술도 정정 필요.

- **[WARNING]** CHANGELOG/spec/plan 이 실제로 존재하지 않는 `onReconnectStart` 배선을 계속 서술 — 이를 잡아낼 테스트가 없어 drift 가 표면화되지 않음
  - 위치: `CHANGELOG.md`("`workflow-canvas.tsx` 가 `onReconnectStart`/`onReconnect`/`onReconnectEnd` 를 배선하고..."), `spec/3-workflow-editor/2-edge.md` §1.3, `plan/in-progress/spec-sync-edge-gaps.md` §1.3 항목 — 세 곳 모두 `onReconnectStart` 언급. 실제 `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` diff 는 `onReconnect`/`onReconnectEnd` 두 prop 만 배선하고, `use-edge-reconnect.ts` 훅도 `{ onReconnect, onReconnectEnd }` 만 반환한다(`onReconnectStart`/ref 는 CRITICAL 수정 과정에서 제거됨 — `RESOLUTION.md` "`onReconnectStart`/ref 제거" 참조).
  - 상세: `<ReactFlow>` 에 실제로 어떤 prop 이 배선되는지 검증하는 테스트(RTL/통합)가 이 저장소에 전무하다는 점은 plan §1.2 이월 (d) 로 이미 의도적으로 수용된 상태지만, 그 결과 "문서가 서술하는 배선 표면"과 "실제 배선 표면"이 어긋나도 아무 테스트도 이를 잡지 못한다. 향후 §4 오케스트레이션 정리 시점에 그 통합 테스트를 작성할 사람이 지금 이 CHANGELOG/spec 문구를 근거로 "`onReconnectStart` 도 배선돼 있어야 한다"고 오인해 존재하지 않는 콜백을 검증하려 들 위험이 있다.
  - 제안: 세 문서에서 `onReconnectStart` 언급을 제거(또는 "제거됨" 으로 정정). 향후 배선 통합 테스트를 작성할 때는 문서가 아니라 `use-edge-reconnect.ts` 실제 반환 타입을 SoT 로 삼을 것.

- **[INFO]** `removeEdge` 신규 테스트가 `deriveContainerAssignments` 재도출 부수효과를 검증하지 않음
  - 위치: `codebase/frontend/src/lib/stores/__tests__/editor-store.test.ts` `describe("removeEdge (§1.3 detach)")` (테스트 1건)
  - 상세: 구현 주석은 "엣지 제거는 노드의 `containerId` 근거를 없앨 수 있어 재도출한다(`onEdgesChange` remove 와 동일)"고 명시하지만, 추가된 유일한 테스트는 `edges`/`undoStack` 길이만 확인하고 `nodes` 의 `containerId` 변화는 확인하지 않는다. `onEdgesChange` remove 경로에서도 이 정확한 시나리오(엣지 제거 → containerId 재도출)를 직접 단언하는 테스트가 별도로 존재하지 않아, "detach 로 컨테이너 소속이 실제로 갱신된다"는 계약이 `removeEdge` 신규 액션 기준으로는 미검증 상태다.
  - 제안: 컨테이너 자식(`containerId` 셋업) → 유일한 진입 엣지를 `removeEdge` 로 제거 → `containerId` 가 `null` 로 재도출됐는지 확인하는 케이스 1개 추가(가치 대비 비용 낮음).

- **[INFO]** 테스트 파일 타입체크 사각지대는 기존에 확인된 패턴이며 이번 신규 파일 2건에도 그대로 적용됨
  - 위치: `codebase/frontend/tsconfig.json`(`exclude`: `src/**/*.test.ts`, `src/**/*.test.tsx`), `package.json` `"test": "vitest run"`
  - 상세: `vitest run` 은 타입을 strip 하고 실행할 뿐 타입체크하지 않으며, `tsc --noEmit -p tsconfig.json` 은 `*.test.ts` 를 exclude 하므로 어떤 CI 게이트도 신규 테스트 파일(`use-edge-reconnect.test.ts`, `editor-store.test.ts` 의 신규 케이스, `edge-utils.test.ts` 의 신규 케이스)의 타입 오류를 잡지 못한다. 직전 리뷰(12_40_48)가 발견했던 `Connection` 미-import(TS2304) 가 바로 이 이중 사각지대 때문에 은닉됐던 사례이며, 이번엔 import 가 정상 수정되어 있음을 직접 확인했으나(현재 tsc 는 clean), 구조적 사각지대 자체는 이번 PR 로 해소되지 않았고 향후 동일 클래스의 실수가 재발할 수 있다.
  - 제안: 이번 PR 범위 밖. 별도 트랙(`tsc --noEmit` 을 test glob 포함해 별도 스크립트로 두거나 vitest `typecheck` 옵션 도입)으로 이월 권장.

- **[INFO]** `plan/in-progress/spec-sync-edge-gaps.md` 의 테스트 개수·메서드명 서술이 실제 코드와 어긋남
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 항목 — "테스트: reconnect 훅 renderHook 4 + store onReconnect 3/deleteEdge 1 + firstInputHandleId emit 2" 및 "`deleteEdge`(detach=빈영역 드롭 삭제, undo 가능)"
  - 상세: 실제 `editor-store.test.ts` diff 의 `onReconnect (§1.3)` describe 블록은 4개 케이스(유효 재연결/자기연결 거부/중복 거부/제자리 재연결)이지 3개가 아니다. 또한 store 메서드명은 이번 diff 에서 `deleteEdge` → `removeEdge` 로 개명됐는데(WARNING #4 반영, `RESOLUTION.md` 확인) plan 문서 서술은 개명 전 이름을 그대로 두고 있다.
  - 제안: plan 문서의 개수·이름을 실제 코드에 맞춰 정정(사소하나 향후 커버리지 감사 시 혼란 방지).

## 요약
CRITICAL(자기연결/무효 핸들 드롭 시 엣지 오삭제)은 실제로 고쳐졌고, 그 정확한 회귀를 겨냥한 `renderHook` 테스트가 추가되어 있으며 실행해 통과를 확인했다 — detach 판정을 성공 플래그가 아닌 드롭 위치(`toNode`)로 옮긴 설계는 최소 스텁(`{toNode: {...}}`/`{toNode: null}`)만 모킹해 훅의 실제 결정 경계만 정확히 겨냥하는 좋은 테스트 격리·가독성 사례다. `editor-store.test.ts` 의 "제자리 재연결 자기중복 오판 방지" 케이스도 정밀한 회귀 가드다. 다만 이번 PR 이 새로 도입한 핵심 로직인 재연결 시 포트색(`edgeData`) 재계산은 어떤 테스트도 실제 데이터 변경을 단언하지 않고, `onConnect`/`onReconnect` 공용 컨테이너 충돌 거부 경로는 RESOLUTION.md 의 주장과 달리 저장소 전체에 걸쳐 전혀 테스트되지 않은 채로 남아 있다. 여기에 CHANGELOG/spec/plan 문서가 실제로 제거된 `onReconnectStart` 배선을 계속 서술하는 drift 는, 배선 자체를 검증하는 테스트가 없는 상태에서 향후 통합 테스트 작성자를 오도할 수 있는 잠재 위험이다. CRITICAL 재발 방지는 확실하나 위 3건의 WARNING(신규 핵심 로직 미검증 2건 + 문서-코드 drift 1건)은 후속 커밋에서 정리 권장.

## 위험도
MEDIUM
