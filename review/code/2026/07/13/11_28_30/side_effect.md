### 발견사항

- **[INFO] `onConnect` skipUndo 옵션은 pushUndo 호출만 건너뛰고 다른 부수효과(`isDirty`, 자기연결/중복/컨테이너 충돌 검증, edge/node 갱신)는 그대로 수행 — 안전한 범위**
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`(L702-739)
  - 상세: `if (!opts?.skipUndo) get().pushUndo();`(L723) 앞에 `isSelfConnection`/`isDuplicateConnection`/`detectContainerConflict` 검증이 그대로 위치해 자동 연결 경로(`handleAddNodeFromSearch` → `onConnect(connection, { skipUndo: true })`)도 동일 검증을 통과해야 엣지가 생성된다. `pushUndo()` 자체는 undo 스택에 스냅샷만 push 하고 다른 상태(`isDirty` 등)에 관여하지 않으므로(`pushUndo`(L1201-) 구현 확인), skipUndo 옵션 도입이 undo 스택 외의 상태 변경을 의도치 않게 생략시키지 않는다.
  - 제안: 없음(확인 완료).

- **[INFO] `onConnect` 시그니처 확장(`opts?: { skipUndo?: boolean }` 추가)은 하위 호환 — 기존 호출자 영향 없음**
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` L86-88(타입), L702(구현); 기존 호출자 `editor-store.ts` L1084 (`applyAssistantOperation`의 `add_edge` 처리)
  - 상세: 두 번째 인자가 optional 이라 기존 `s.onConnect({...})`(옵션 없이 호출, AI 어시스턴트 `add_edge` 툴 콜 경로)는 `opts === undefined` → `opts?.skipUndo` 는 falsy → 기존과 동일하게 `pushUndo()` 실행. grep 결과 `onConnect(` 호출부는 신규 자동연결 경로(`workflow-canvas.tsx` L616)와 이 기존 경로 두 곳뿐이라 회귀 없음.
  - 제안: 없음(확인 완료).

- **[INFO] 잔존(이번 diff 범위 밖) — `buildAndAddNode`(로컬 `pushUndo()`) + store `addNode`(내부 `get().pushUndo()`) 이중 push 는 여전히 존재, "Ctrl+Z 1회" 주장은 스택 최상단에 한해 성립**
  - 위치: `workflow-canvas.tsx` `buildAndAddNode`(L578 부근 `pushUndo();` 호출) → `addNode({...})` → `editor-store.ts` `addNode`(L747-748, 내부에서 또 `get().pushUndo()`)
  - 상세: 이번 diff 의 `skipUndo` 수정은 신규 `onConnect(...)` 호출이 만들던 **3번째** push 를 제거해 "드래그→드롭→노드선택" 제스처의 push 횟수를 3회→2회로 줄였다. 다만 노드 생성 자체가 이미 2회(둘 다 "노드 추가 전" 동일 스냅샷) push 하는 기존 결함(이번 diff 이전부터 존재, RESOLUTION.md 도 "이번 diff 가 만든 것 아님"으로 별건 인지)은 그대로 남아 있다. 실질 사용자 영향을 재확인하면: 스택 top(가장 최근 push)을 pop 하는 Ctrl+Z 1회는 "노드+엣지 없음" 상태(두 push 가 동일 스냅샷이므로) 로 정확히 되돌아가 **원 리뷰의 "Ctrl+Z 1회로 노드+엣지 함께 취소" 목표는 실제로 달성됨**. 다만 스택에는 동일한 스냅샷이 하나 더 남아있어, 이어서 Ctrl+Z 를 한 번 더 누르면 시각적으로 아무 변화 없는 "공짜 undo" 소비가 발생한다(redo 스택 왜곡까지는 아니고, undo 히스토리 깊이만 실제보다 1 더 소모). 이 자체는 이번 diff 가 새로 만든 문제가 아니고 §1.2 자동연결에 국한되지도 않는(모든 `buildAndAddNode` 호출 경로 공통) 기존 결함이라 이번 변경 범위에서 조치할 필요는 없다.
  - 제안: 조치 불요(이번 diff 스코프 밖). 다만 RESOLUTION.md #2 항목의 "Ctrl+Z 1회로 노드+엣지 함께 취소"라는 서술은 정확하나, 그 아래 남아있는 중복 스냅샷 자체는 여전히 미해결이라는 점을 백로그(§1.3 착수 시 혹은 별도)에 남겨두는 것을 권장.

- **[INFO] `onConnectEnd` 신규 배선은 기존 `onConnect`/`onPaneClick` 경로와 이중 실행 없음 — 조기 return 으로 격리 확인**
  - 위치: `workflow-canvas.tsx` `onConnectEnd`(L339-354), `<ReactFlow onConnectEnd={onConnectEnd} ...>`(L760)
  - 상세: `connectionDragSource`(`edge-utils.ts`)가 `isValid === true`(유효 연결 성립)면 즉시 `null` 을 반환해 `onConnectEnd` 핸들러가 조기 return 하므로, React Flow 의 표준 `onConnect` 콜백 경로와 겹치지 않는다. `onReconnect`/`reconnectable` 은 grep 결과 미배선 상태 그대로라 §1.3 관련 잠재 상호작용(전 리뷰 INFO #15/#2 이월)도 이번 diff 로 인해 새로 발생하지 않음.
  - 제안: 없음(§1.3 착수 시 재검토는 plan 에 이미 기록됨).

- **[INFO] 신규 순수 헬퍼(`connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`/`isConnectionDroppedOnPane`)는 전역/공유 상태·DOM·네트워크·파일시스템·환경변수에 접근하지 않는 부작용 없는 함수**
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` L116-186 부근
  - 상세: 모두 인자만으로 값을 계산하는 순수 함수이며, 신규 테스트(`edge-utils.test.ts`)도 리터럴 인자만 사용해 공유 스토어를 건드리지 않는다.
  - 제안: 없음.

- **[INFO] 리뷰 아티팩트 신규 커밋 파일(`review/code/2026/07/13/11_04_21/*`) 내 절대경로 노출은 저장소 기존 관례**
  - 위치: `review/code/2026/07/13/11_04_21/_retry_state.json`, `meta.json` 등
  - 상세: 로컬 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)가 그대로 커밋되는데, 이는 이 저장소의 `review/` 디렉터리 커밋 관례(gitignore 대상 아님, 기존 세션 산출물도 동일 패턴)와 일치하며 이번 diff 가 새로 도입한 위험이 아니다. 시크릿·자격증명은 포함되지 않음.
  - 제안: 없음(기존 관례 범위 내).

### 요약
이번 diff 는 원 리뷰(`review/code/2026/07/13/11_04_21`)가 지적한 side_effect WARNING("자동 연결이 undo 스냅샷을 추가로 push해 Ctrl+Z 1회로 노드+엣지가 함께 취소되지 않음")을 `onConnect` 에 `skipUndo` optional 파라미터를 추가하는 최소 변경으로 정확히 해소했다. 시그니처 확장은 하위 호환(옵션 파라미터, 기존 호출자 무영향)이고, skipUndo 는 undo 스택 push 만 건너뛸 뿐 `isDirty`·연결 유효성 검증 등 다른 상태 변경 로직에는 관여하지 않아 의도치 않은 부작용이 없다. `onConnectEnd` 신규 배선도 조기 return 으로 기존 `onConnect` 경로와 격리되어 이중 실행 위험이 없다. 다만 노드 생성 경로(`buildAndAddNode`+store `addNode`) 자체가 이미 갖고 있던 이중 pushUndo(diff 이전부터 존재, 별건)는 여전히 남아 있어 "완전한 단일 스냅샷"은 아니지만, 사용자 체감상 "Ctrl+Z 1회로 노드+엣지 함께 취소"라는 목표 자체는 정상 동작한다. 전역 변수·환경 변수·네트워크·파일시스템 부작용, 공개 API 변경으로 인한 외부 영향은 없다.

### 위험도
LOW
