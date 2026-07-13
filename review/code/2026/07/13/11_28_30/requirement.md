# Requirement Review — edge §1.2 ai-review 반영 커밋(spec 동기화·undo 단일화·헬퍼 추출·테스트)

본 리뷰는 `review/code/2026/07/13/11_04_21` 리뷰(HIGH: CRITICAL 1 + WARNING 6)에 대한 `RESOLUTION.md` 반영 커밋(`2b775357b`)을 fresh 로 재검토한 결과다.

## 발견사항

- **[INFO]** CRITICAL #1(spec stale) 해소 확인 — line-level 일치
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.2 (헤더 + "현재 구현" 각주)
  - 상세: 헤더에서 "(미구현 · Planned)" 제거, "현재 구현" 각주가 실제 구현(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle`, `onConnectEnd`, `NodeSearchPopupState.dragSource`, `buildAndAddNode` 반환값, `onConnect` `skipUndo`, 순수 헬퍼 4종)으로 정확히 갱신됨. 두 신규 불릿("연결원의 출력 포트 → 새 노드의 첫 입력 포트", "대상 노드에 입력 포트가 없으면 자동 연결 생략")도 각각 `buildAutoConnectConnection`/`firstInputHandleId` 의 실제 동작과 line-level 로 일치한다. `plan/in-progress/spec-sync-edge-gaps.md` §1.2 체크박스·CHANGELOG.md 항목도 spec 서술과 상호 정합. 이견 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** WARNING #2(undo 이중 스냅샷) 수정 검증 — 실제 동작은 클레임대로 동작하나 근거가 미묘함
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`(L723 `if (!opts?.skipUndo) get().pushUndo();`), `addNode`(L747-748 `get().pushUndo()`), `workflow-canvas.tsx` `buildAndAddNode`(L575 `pushUndo();` 후 `addNode(...)` 호출)
  - 상세: `buildAndAddNode` 는 자체적으로 `pushUndo()` 를 호출한 뒤 store `addNode` 를 호출하는데, `addNode` store 액션 자체도 내부에서 `get().pushUndo()` 를 한 번 더 호출한다(이 이중 호출은 `duplicate` 액션(L406-427)에도 동일하게 존재하는 **이 PR 이전부터의 기존 패턴**이라 본 PR 이 새로 만든 결함은 아니다). 두 호출 사이에 `set()` 이 끼지 않으므로 두 번째 `pushUndo()` 는 첫 번째와 동일한 스냅샷(신규 노드 추가 전 상태)을 undoStack 에 중복 push 할 뿐 — 상태 자체는 오염되지 않는다. 이어서 `handleAddNodeFromSearch` 가 `onConnect(connection, {skipUndo:true})` 로 엣지를 추가하면 세 번째 push 는 생략되고 노드+엣지가 동일 스냅샷(중복된 프리-노드 상태) 위에만 쌓인다. 따라서 실제 사용자 관점에서 **Ctrl+Z 1회는 여전히 노드+엣지를 함께 제거**한다 — RESOLUTION 의 클레임은 결과적으로 참이다. 다만 이 사전 이중-push 는 undo 스택 한 칸을 낭비해 실질 히스토리 깊이를 줄이고, 그 다음 Ctrl+Z 1회는 상태 변화 없는 사실상 no-op 이 된다(별도 회귀는 아니며 재현 시나리오: 노드 추가 → Ctrl+Z → Ctrl+Z 시 두 번째가 무반응처럼 보임). 이 PR 범위 밖의 pre-existing 이슈로 판단해 CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 별도 조치 불요(이 PR 스코프 아님). 추후 `buildAndAddNode`/`duplicate`/`addNode` 전반의 이중 pushUndo 정리는 별건 hygiene 이슈로 백로그 고려 가능.

- **[INFO]** WARNING #7(`firstInputHandleId` 컨테이너 포트 순서 암묵 의존) — "부분 반영" 그대로 residual, 신규 결함 아님
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `buildAutoConnectConnection` JSDoc, `codebase/frontend/src/lib/stores/editor-store.ts` `detectContainerConflict`(L232-267)
  - 상세: RESOLUTION 은 코드 강화 대신 JSDoc 코멘트만 추가했다("컨테이너 충돌은 현재 노드 정의상 첫 입력이 데이터 포트라 발생하지 않는다"). 실제로 새로 생성된 노드는 `containerId` 가 없으므로 `detectContainerConflict` 의 두 분기(body→target 충돌, emit→source 충돌) 모두 대상이 "이미 다른 컨테이너에 속한 기존 노드"일 때만 발동하고, 신규 target 노드에는 적용되지 않아 현재로선 실제로 orphan 이 발생하지 않음을 코드 레벨로 재확인했다. 향후 어떤 컨테이너 타입의 첫 입력 포트가 `emit` 이 되는 스키마가 추가되면 여전히 조용히 깨질 수 있는 가정이나, 원 리뷰가 이미 LOW 로 판정하고 §1.3 착수 항목으로 이월 기록(`plan/in-progress/spec-sync-edge-gaps.md` §1.3 하위 (a)(b)(c))했으므로 재차 WARNING 으로 올리지 않는다.
  - 제안: 없음(추적 유지로 충분).

- **[INFO]** 기능 완전성·엣지케이스·반환값 — 전 경로 확인, 결함 없음
  - 위치: `edge-utils.ts` `isConnectionDroppedOnPane`/`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`, `workflow-canvas.tsx` `onConnectEnd`/`handleAddNodeFromSearch`/`buildAndAddNode`
  - 상세: `resolveDynamicPorts`(`resolve-dynamic-ports.ts`)를 확인한 결과 프로젝트 전반에서 동적 포트 해석은 **출력(outputs)** 전용(switch-cases/classifier-categories/ai-agent-conditional/info-extractor-mode/presentation-buttons/parallel-branches)이며 입력(inputs) 포트를 동적으로 재계산하는 경로는 존재하지 않는다 — `firstInputHandleId` 가 static `definition.inputs` 만으로 충분하다는 JSDoc 주장이 코드로 실증된다. `vitest edge-utils.test.ts` 를 직접 실행해 **57 passed** 확인(RESOLUTION 클레임과 일치). 대상 노드에 입력 포트 없음(트리거)·`fromNode` 없음·`isValid===true`(정상 연결)·터치 이벤트 빈 리스트 등 경계값 모두 순수 함수 + 테스트로 커버됨. `buildAndAddNode` 정의 부재/트리거 중복 시 `undefined` 반환 → `handleAddNodeFromSearch` 의 `if (newId && dragSource)` 가드가 이를 정확히 처리해 dangling 연결 시도가 없다. `onConnect` 시그니처 변경(`opts?: {skipUndo?}`)의 다른 두 호출부(`<ReactFlow onConnect={onConnect}>`, `add_edge` assistant tool L1084)는 opts 미전달로 기존 pushUndo 동작 그대로 유지되어 회귀 없음.
  - 제안: 없음.

- **[INFO]** review 아티팩트(`review/code/2026/07/13/11_04_21/*.md`, `meta.json`, `_retry_state.json`) 신규 커밋 — 코드 결함 아님
  - 위치: `review/code/2026/07/13/11_04_21/` 디렉터리 8개 신규 파일
  - 상세: 저장소 관례(`review/` 는 gitignore 대상 아니며 SUMMARY·RESOLUTION 도 커밋)에 부합. `meta.json` 의 `agents`/`agents_forced` 목록에 `user_guide_sync`/`api_contract`/`database`/`concurrency`/`dependency` 가 있으나 해당 `.md` 출력 파일은 디렉터리에 없다 — `SUMMARY.md` 자신이 이 disk-write gap 을 이미 명시적으로 인지·기록했으므로(引用: "user_guide_sync 리뷰는 manifest 상 성공으로 보고되었으나 출력 파일이... 존재하지 않아") 본 리뷰가 별도로 재지적할 필요는 없다. 이는 orchestrator 하네스 이슈이지 이번 diff(§1.2 기능 구현)의 요구사항 충족과는 무관하다.
  - 제안: 없음(이미 알려진 하네스 이슈, 코드 변경 불요).

## 요약
`onConnectEnd` + `handleAddNodeFromSearch` + `edge-utils.ts` 순수 헬퍼 5종은 spec §1.2 가 요구하는 두 행위(빈 영역 드롭 시 노드 추가 검색 팝업, 노드 선택 시 생성+연결원의 출력 포트→새 노드의 첫 입력 포트 자동 연결, 입력 포트 없으면 생략)를 정확히 구현하며, 이번 커밋은 직전 ai-review(HIGH: CRITICAL 1 + WARNING 6)의 핵심 지적 — SoT spec `2-edge.md` §1.2 의 stale "미구현·Planned" 서술 — 을 line-level 로 정확히 해소했다(실측 diff 대조 완료). undo 단일화(`skipUndo`)는 pre-existing 이중 `pushUndo` 관례와 맞물려도 "Ctrl+Z 1회로 노드+엣지 함께 제거"라는 실질 클레임을 깨지 않음을 코드 추적으로 확인했고, `vitest` 57건 통과도 재실행으로 검증했다. 컨테이너 포트 순서 암묵 의존(WARNING #7)은 코드 강화 대신 JSDoc 문서화로 부분 반영됐으나 현재 노드 정의 데이터로는 실제 발생하지 않음을 재확인했으며 이미 §1.3 이월 항목으로 추적 중이라 재차 격상하지 않는다. TODO/FIXME 류 미완성 표식 없음, 모든 경로가 적절한 값(또는 명시적 `undefined`/`null`)을 반환하며, 신규 회귀 유발 요소를 찾지 못했다.

## 위험도
LOW
