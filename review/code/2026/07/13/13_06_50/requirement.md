# Requirement Review — spec/3-workflow-editor/2-edge.md §1.3 (엣지 재연결/detach)

## 발견사항

- **[SPEC-DRIFT] `onReconnectStart` 배선 서술이 실제 코드와 불일치(3개 문서 동시 stale)**
  - 위치: `CHANGELOG.md`(Unreleased §1.3 항목 1) / `spec/3-workflow-editor/2-edge.md` §1.3 "현재 구현" 인용문 / `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스 본문
  - 상세: 세 문서 모두 "`workflow-canvas.tsx` 가 `onReconnectStart`/`onReconnect`/`onReconnectEnd` 를 배선한다"고 서술한다. 그러나 실제 `workflow-canvas.tsx`(파일4 diff)는 `onReconnect`/`onReconnectEnd` 두 콜백만 `<ReactFlow>` 에 배선하며, `useEdgeReconnect` 훅(파일3)도 `{ onReconnect, onReconnectEnd }` 두 개만 반환한다 — `onReconnectStart` 는 코드베이스 어디에도 없다(`grep onReconnectStart` 결과 0건). 동봉된 `review/code/2026/07/13/12_40_48/RESOLUTION.md` 의 CRITICAL #1 조치 내역이 "`onReconnectStart`/ref 제거"를 명시하고 있어, 이 불일치는 실수가 아니라 **CRITICAL 수정 과정에서 success-flag(ref+onReconnectStart) 설계를 드롭 위치(toNode) 판정으로 교체한 의도적 리팩터**의 흔적이다 — 즉 코드가 옳고(더 단순하고 회귀도 없음), 세 문서의 서술만 리팩터 이전 설계를 그대로 남기고 있다.
  - 제안: 코드 변경 불필요. `CHANGELOG.md` 항목 1, `spec/3-workflow-editor/2-edge.md` §1.3 "현재 구현" 문단, `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스에서 `onReconnectStart` 언급을 제거하고 "`onReconnect`/`onReconnectEnd` 두 콜백만 배선"으로 정정.

- **[WARNING] plan 체크박스가 개명 전 메서드명(`deleteEdge`)을 그대로 서술**
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스 본문 ("... + `deleteEdge`(detach=빈영역 드롭 삭제, undo 가능). 테스트: ... store onReconnect 3/deleteEdge 1 ...")
  - 상세: RESOLUTION.md WARNING #4 조치로 store 메서드가 `deleteEdge` → `removeEdge` 로 개명됐고 실제 코드(`editor-store.ts`, `use-edge-reconnect.ts`, `workflow-canvas.tsx`, 두 테스트 파일)는 모두 `removeEdge` 로 일관돼 있다(`grep deleteEdge` 결과 코드 내 잔존은 원래부터 있던 `workflowsApi.deleteEdge` REST 헬퍼 하나뿐 — 이는 개명 사유가 된 별개 항목이라 정상). `CHANGELOG.md`/`spec/3-workflow-editor/2-edge.md` 는 이미 `removeEdge` 로 정확히 반영돼 있어 plan 파일만 뒤처짐.
  - 제안: plan 체크박스 텍스트의 `deleteEdge` 두 곳을 `removeEdge` 로 정정(코드 변경 아님, 완료 항목 서술 정확성 문제).

- **[INFO] 재연결 경로의 컨테이너 충돌(container conflict) 거부 분기는 전용 단위 테스트 없음**
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onReconnect` → `evaluateConnectionRejection` → `detectContainerConflict`
  - 상세: `onReconnect` 는 `onConnect` 과 동일하게 `evaluateConnectionRejection` 을 호출하므로 컨테이너 충돌 거부 로직 자체는 `onConnect` 테스트로 공유 커버되지만, 재연결 경로를 통해 이 분기에 도달하는 케이스(예: body/emit 재연결이 다른 컨테이너 소속과 충돌)의 전용 테스트는 없다. 이는 신규 결함이 아니라 직전 리뷰(`12_40_48`)의 testing WARNING에서 이미 식별돼 "공용 헬퍼화로 코드 경로가 `onConnect` 와 동일하므로 별도 테스트 가치가 낮다"는 근거로 의도적으로 보류된 항목(RESOLUTION.md 부분 반영 표)이다 — 재지적이 아니라 참고용 재확인.
  - 제안: 별도 조치 불요(이미 트리아지된 잔여 항목). 회귀가 실제 보고되면 그때 fixture 추가.

- **[INFO] reconnect/detach 제스처에 대한 e2e(Playwright) 커버리지 없음**
  - 위치: `codebase/frontend/e2e/` (관련 spec 파일 없음, grep 0건)
  - 상세: 마우스 드래그 기반 엣지 끝점 재연결·detach 제스처는 renderHook 단위 테스트(4케이스)와 store 단위 테스트(4케이스)로만 커버되고 Playwright e2e 는 없다. React Flow 캔버스 드래그 시뮬레이션의 일반적 어려움을 고려하면 이번 PR 스코프에서 순수 판정 로직을 훅으로 분리해 단위 테스트한 접근은 합리적이며, RESOLUTION.md 검증 섹션도 "e2e 후속" 으로 명시해 이미 인지된 사항이다.
  - 제안: 조치 불요(참고). 향후 canvas e2e 하네스 도입 시 함께 편입 검토.

## 검증한 항목 (문제 없음)

- **CRITICAL 회귀 재현 여부**: 직전 리뷰(`review/code/2026/07/13/12_40_48`)가 지적한 "reconnect 드래그를 자기연결(무효) 핸들에 드롭하면 엣지가 삭제된다"는 CRITICAL 은 `use-edge-reconnect.ts` 가 success 플래그 대신 `onReconnectEnd` 의 `connectionState.toNode` 로 판정하도록 재설계되어 해소됨을 코드로 직접 확인. `toNode` 가 존재하면(=핸들/노드 위 드롭) 무조건 원상 유지, `null`(=pane) 일 때만 `removeEdge` 호출 — 재연결 성공 여부와 무관하게 드롭 위치만으로 판정하므로 자기연결/중복/컨테이너충돌 등 어떤 사유로 거부되든 detach 오귀결이 발생하지 않는다. 회귀 가드 테스트(`use-edge-reconnect.test.ts` 3, 4번째 케이스) 존재.
- **`onReconnect` 의 유효성 규칙**: `evaluateConnectionRejection` 이 `onConnect`·`onReconnect` 양쪽에서 공용되며 반환 계약(`null`=진행, `""`=조용히 거부, 문자열=toast 거부)이 두 호출부에서 일관되게 처리됨을 확인. 재연결 시 중복 검사만 `edges.filter((e) => e.id !== oldEdge.id)` 로 자기 자신을 제외 — "제자리 재연결"이 오탐 거부되지 않음을 `editor-store.test.ts` 테스트로 확인(§1.3 detach·onReconnect describe 블록 4케이스 + removeEdge 1케이스).
- **`reconnectEdge(..., { shouldReplaceId: false })` id 보존**: 재연결 후에도 엣지 id 가 유지되어 선택 상태·엣지 참조가 깨지지 않음을 store 테스트로 확인. `sourceHandle` 변경 시 포트색 data 를 `buildEdgeDataForConnection` 으로 재계산해 stale data 문제 없음.
- **`firstInputHandleId` 의 예약 포트(`emit`) 스킵**: `RESERVED_INPUT_HANDLE_IDS`(SoT: backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`)가 실제 backend 상수(`new Set(['emit'])`)와 값이 일치함을 grep 으로 확인. 입력 배열이 없거나(`undefined`) 예약 포트만 있는 경우 모두 `null` 반환(엣지 케이스 2건 테스트로 커버).
- **역방향 연결(§1.3 첫 항목) "커스텀 코드 불요" 주장**: `isValidConnection` 이 자기연결만 검사하고 `isSelfConnection`/`isDuplicateConnection` 모두 direction-agnostic 함을 코드로 확인. `connectionDragSource`(§1.2 헬퍼)는 `fromHandle.type !== 'source'` 인 입력 포트 시작 드래그를 명시적으로 배제하는 테스트가 있어 §1.2 로직과 §1.3 충돌 없음을 뒷받침.
- **`removeEdge` 개명(WARNING #4) 전파 완결성**: `editor-store.ts`/`use-edge-reconnect.ts`/`workflow-canvas.tsx`/양쪽 테스트 파일 전체에서 `removeEdge` 로 일관, `deleteEdge` 잔존은 원래부터 있던 무관한 `workflowsApi.deleteEdge`(REST) 뿐임을 grep 으로 확인 — 개명 누락 없음.
- **TODO/FIXME/HACK/XXX**: 신규·변경 코드 파일(`use-edge-reconnect.ts`, `workflow-canvas.tsx`, `editor-store.ts`, `edge-utils.ts`) 전체에서 grep 결과 0건.
- **유저가이드 동기화**: `connecting-nodes.mdx`/`connecting-nodes.en.mdx` 에 재연결·detach·undo 설명이 ko/en 동반 반영되고, `.mdx` frontmatter `code:` 목록에 `use-edge-reconnect.ts`/`edge-utils.ts` 가 추가돼 spec 파일의 `code:` 목록과 정합.

## 요약

직전 라운드(`review/code/2026/07/13/12_40_48`)에서 지적된 CRITICAL(자기연결 reconnect 드롭이 엣지 삭제로 오귀결)과 WARNING 3건(검증/데이터파생 중복, `Connection` 타입 미-import, `deleteEdge` 네이밍 충돌)은 모두 코드로 확인 가능한 수준까지 정확히 반영·해소됐다. 남은 발견사항은 기능 결함이 아니라 문서 텍스트가 리팩터 이전 설계(`onReconnectStart` 배선, `deleteEdge` 메서드명)를 그대로 서술하는 spec/CHANGELOG/plan 3중 stale text — 코드가 옳고 문서 갱신만 누락된 SPEC-DRIFT 성격이다. 나머지는 이미 트리아지된 낮은 우선순위 잔여 항목(재연결 경로의 컨테이너 충돌 전용 테스트, e2e 부재)으로 신규 차단 사유가 아니다.

## 위험도
LOW
