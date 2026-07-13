# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** 문서(CHANGELOG/spec/plan)가 실제로 배선되지 않는 `onReconnectStart` 콜백을 서술
  - 위치: `CHANGELOG.md:5`, `spec/3-workflow-editor/2-edge.md:48`, `plan/in-progress/spec-sync-edge-gaps.md:24`
  - 상세: 세 문서 모두 "`workflow-canvas.tsx` 가 `onReconnectStart`/`onReconnect`/`onReconnectEnd` 를 배선한다" 고 서술하지만, 실제 코드(`codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `use-edge-reconnect.ts`)에는 `onReconnectStart` 배선이 전혀 없다(`grep` 확인 결과 두 파일 모두 `onReconnect`/`onReconnectEnd` 2종만 존재). 동일 diff 에 포함된 `review/code/2026/07/13/12_40_48/RESOLUTION.md` 는 이 세션의 CRITICAL 수정으로 "`onReconnectStart`/ref 제거" 를 명시하고 있어, 코드는 이미 success-플래그 방식(ref+`onReconnectStart`)에서 드롭-위치 판정 방식(`connectionState.toNode`)으로 리팩터되며 `onReconnectStart` 가 삭제됐지만, 그 직후 작성된 CHANGELOG/spec/plan 프로즈에는 리팩터 이전 문구가 그대로 남아있다. 이벤트/콜백 배선에 대한 문서와 코드의 불일치로, 향후 유지보수자가 문서만 보고 "onReconnectStart 핸들러가 존재한다" 고 오인해 그 위에 로직을 얹거나 spec 근거로 인용할 위험이 있다.
  - 제안: 세 문서에서 `onReconnectStart` 언급을 제거하고 실제 배선되는 `onReconnect`/`onReconnectEnd` 2종만 서술.

- **[WARNING]** plan 문서가 개명 이전 이름 `deleteEdge` 를 그대로 사용 — 이미 해소된 네이밍 충돌 재도입 위험
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md:24` ("store `onReconnect`(...) + `deleteEdge`(detach=빈영역 드롭 삭제, undo 가능). 테스트: ... store onReconnect 3/deleteEdge 1 ...")
  - 상세: 이전 라운드(`12_40_48`) side_effect 리뷰가 신규 store 메서드명 `deleteEdge` 가 기존 `workflowsApi.deleteEdge`(`/edges/:id` 즉시 REST DELETE, 부작용 프로파일 정반대)와 동명이라 WARNING 을 냈고, `RESOLUTION.md` 가 "store 메서드를 `removeNode` 와 대칭인 `removeEdge` 로 개명(인터페이스·구현·canvas·훅·테스트 전파)" 로 반영을 확정했다. 실제로 `editor-store.ts`/`use-edge-reconnect.ts`/`workflow-canvas.tsx`/양쪽 테스트 파일은 모두 `removeEdge` 로 일관되게 개명되어 있음을 확인했다(CHANGELOG.md·spec 도 `removeEdge` 로 정확히 반영됨). 그런데 plan 문서만 개명 이전 이름 `deleteEdge` 를 그대로 남겨, 이 plan 을 근거로 후속 작업을 하는 사람이 이미 해소된 네이밍 충돌(로컬 상태 전용 vs 즉시 서버 DELETE)을 다시 참조하거나 재도입할 소지가 있다.
  - 제안: plan 파일의 `deleteEdge` 2회 언급을 `removeEdge` 로 정정.

- **[INFO]** `<ReactFlow>` 전역 `onReconnect`/`onReconnectEnd` 배선으로 구조적 엣지(컨테이너 `body`/`emit`)도 드래그 재연결·detach 대상이 됨 — 이전 라운드에서 이미 수용된 INFO, 재확인
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`onReconnect={handleReconnect}` / `onReconnectEnd={onReconnectEnd}` 배선)
  - 상세: 개별 엣지에 `reconnectable:false` 같은 opt-out 이 없어 컨테이너 진입(`body`)·loopback(`emit`) 등 구조적으로 의미가 고정된 엣지도 이제 드래그로 재연결·삭제할 수 있는 표면이 새로 열린다. `Delete` 키로 지우는 것은 기존에도 가능했던 동작이라 완전히 새로운 무결성 위험은 아니지만, "드래그 detach" 라는 새 상호작용 경로가 구조적 엣지까지 확대 적용된 점은 side-effect 관점에서 기록해 둘 가치가 있다. 이전 라운드(`12_40_48`)에서 이미 동일 지적이 나왔고 별도 조치 없이(의도된 동작으로) 수용됐으며, 이번 diff 로 상태가 달라지지 않았다.
  - 제안: 의도된 동작이면 조치 불요. 컨테이너 필수 배선을 재연결 대상에서 제외하고 싶다면 향후 `reconnectable:false` 부여 검토.

- **[INFO]** `onReconnect`/`removeEdge` 는 실제 변경 여부와 무관하게 항상 `pushUndo()` 호출
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect`, `removeEdge`
  - 상세: 제자리 재연결(끝점을 원래 포트로 되돌리는 경우)이나 이미 없는 엣지에 대한 `removeEdge` 호출도 무조건 `pushUndo()` 를 실행해 변화 없는 undo 스냅샷이 하나 남는다. 기능적 영향은 미미(Ctrl+Z 1회가 무변화 상태를 스킵하는 정도)하며, 이전 라운드에서 이미 INFO 로 확인되고 우선순위 낮음으로 수용된 사항이다. 신규 결함 아님.
  - 제안: 우선순위 낮음, 필요 시 "실제 변경 시에만 pushUndo" 최적화 고려.

## 요약

이전 리뷰 라운드(`12_40_48`)가 지적한 CRITICAL(자기연결 드롭 시 엣지 오삭제)과 WARNING(`deleteEdge` 네이밍 충돌)은 코드 레벨에서 정확히 반영되었다 — `use-edge-reconnect.ts` 는 success 플래그가 아닌 `connectionState.toNode` 기반 드롭-위치 판정으로 재설계되었고(회귀 가드 테스트 포함), store 메서드는 `removeEdge` 로 일관되게 개명되어 `workflowsApi.deleteEdge`(즉시 REST DELETE)와의 이름 충돌이 해소되었다. `EditorState` 인터페이스 확장(`onReconnect`/`removeEdge` 추가)은 additive 라 기존 소비자에 영향이 없고, `onConnect`/`onReconnect` 검증 로직을 공용 헬퍼(`evaluateConnectionRejection`/`buildEdgeDataForConnection`)로 통합한 리팩터도 기존 동작을 그대로 보존한다(직접 대조 확인). 다만 코드 수정 시점 이후 작성/갱신된 CHANGELOG·spec·plan 프로즈에 리팩터 이전 상태를 서술하는 잔재가 남아 있다 — CHANGELOG/spec/plan 3곳 모두 이미 제거된 `onReconnectStart` 콜백이 배선된 것처럼 서술하고, plan 문서는 추가로 이미 개명된 store 메서드를 옛 이름 `deleteEdge` 로 지칭한다. 둘 다 런타임 동작에 영향을 주는 결함은 아니지만, 문서가 실제 이벤트/인터페이스와 어긋나 있어 향후 이 문서들을 근거로 작업할 때 혼동이나 이미 해소된 네이밍 충돌의 재도입으로 이어질 수 있다. 그 외 신규 전역 변수·환경 변수·네트워크 호출·예상치 못한 파일시스템 부작용은 발견되지 않았다.

## 위험도
LOW
