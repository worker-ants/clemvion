---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# edge — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 유지하며 분리한 미구현 항목 추적.
> 관련 spec: spec/3-workflow-editor/2-edge.md
> 주의: AI Agent Tool Area(§7) 관련 재설계는 별도 plan `ai-agent-tool-connection-rewrite.md` 가 담당 — 본 plan 은 엣지 생성/유효성/실행상태/데이터미리보기 갭만 추적한다.

## ✅ §2.2/§2.3 결정·구현 완료 — warn-not-block (2026-07-07, PR #845)

2026-07-06 impl-prep BLOCK(Critical 2건, `review/consistency/2026/07/06/20_56_05/SUMMARY.md`)이 드러낸 두 충돌을 사용자 결정(A: warn-not-block)으로 해소하고 구현 완료:

1. **§2.3 사이클 예외 방향 정정** — SoT `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS = {'emit'}` 에 맞춰 "자식 → 조상 컨테이너의 `emit` 포트(`targetHandle==='emit'`)" 로 정정. 컨테이너 진입(`sourceHandle==='body'`)도 예외.
2. **"모든 사이클 차단" 전제 폐기 → 편집기 warn-not-block** — 실행 엔진이 분기 노드 back-edge 순환을 정식 지원하므로 캔버스는 사이클을 막지 않고, 분기 노드 없이 탈출 불가한 순환(`graph:unescapable-cycle`, severity warning)만 배지로 경고. backend `shadow-workflow.ts`(LLM 도구)는 여전히 hard-block — surface 별 요구 차이(2-edge.md §Rationale R-2 에 근거 기록).

구현: graph-level 규칙 `evaluateGraphCycleWarnings`(`@workflow/graph-warning-rules` `rules/cycle.ts`) + FE `editor-store.ts` `evaluateGraphWarningsLocal` 병합 + BE `getGraphWarnings` 병합. 자기연결/중복은 `onConnect`+`isValidConnection` 하드 차단(`edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`). i18n `GRAPH_WARNING_KO['graph:unescapable-cycle']` + P3-C-1 가드 확장.

## 미구현 항목
- [x] §1.2 출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 검색 팝업 + 자동 엣지 연결 — 구현 완료. `workflow-canvas.tsx` 에 `onConnectEnd`(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle` 기반) 배선: 출력 포트(`fromHandle.type==='source'`) 드래그가 빈 영역(`isValid!==true`)에 드롭되면 드롭 위치에 노드 추가 검색 팝업(더블클릭·우클릭 메뉴와 공유하는 `openNodeSearchPopupAt`)을 열고 `NodeSearchPopupState.dragSource` 에 연결원을 기록. `buildAndAddNode` 가 신규 노드 id 를 반환하도록 리팩터, `handleAddNodeFromSearch` 가 노드 생성 후 `onConnect(dragSource → 새 노드의 첫 입력 포트, {skipUndo})` 로 자동 연결(대상 입력 포트 없으면 생략). **undo 단일화**: `onConnect` 에 `skipUndo` 옵션 추가로 `buildAndAddNode` 단일 pushUndo 만 체크포인트 → Ctrl+Z 1회로 노드+엣지 함께 취소. 순수 헬퍼 `edge-utils.ts` `connectionDragSource`/`pointerClientPosition`/`buildAutoConnectConnection`/`firstInputHandleId`/`isConnectionDroppedOnPane` + vitest 23케이스(edge-utils 헬퍼 21 + `onConnect` skipUndo 2). spec §1.2 본문 "미구현 · Planned" → 구현 반영, CHANGELOG 등재. ai-review(`review/code/2026/07/13/11_04_21`, HIGH→해소) CRITICAL(spec stale)+WARNING(undo·testing·CHANGELOG·팝업 중복) 반영 완료.
- [x] §1.3 입력 포트 시작 역방향 연결 + 기존 엣지 재연결 모드 — 구현 완료. **역방향 연결**: React Flow strict `connectionMode`(기본) 기본 동작으로 지원됨을 확인(핸들에 `isConnectableStart`/`isConnectableEnd` 제약 없음, Connection 은 핸들 타입 기준 정규화, `onConnect`/`isValidConnection` direction-agnostic) → 커스텀 코드 불요, spec "미구현" 오기재 정정. **재연결**: `workflow-canvas.tsx` 가 `onReconnect`/`onReconnectEnd` 두 콜백 배선(로직은 신규 `use-edge-reconnect.ts` `useEdgeReconnect` 훅 — detach 는 `connectionState.toNode==null`=pane 드롭으로 판정). store `onReconnect`(`reconnectEdge` `shouldReplaceId:false` id 보존 + onConnect 동일 유효성 `evaluateConnection`, 중복 검사서 자기 제외 + 포트색/컨테이너 재도출) + `removeEdge`(detach=빈영역 드롭 삭제, undo 가능). 테스트: reconnect 훅 renderHook 4 + store onReconnect 6/removeEdge 2 + firstInputHandleId emit 2.
  - §1.2 이월 항목 처리: **(a) 부분 이행** — reconnect 오케스트레이션을 `useEdgeReconnect` 훅으로 추출(§1.2 popup 오케스트레이션은 컴포넌트 state 결합이 커 별도 이월). **(b) 불요 확정** — 역방향 연결이 우리 팝업이 아닌 React Flow 네이티브 경로라 `dragSource` 방향 태그 유니온 재설계 불필요(단방향 유지). **(c) 충돌 없음 확인** — 재연결은 `onReconnect*` 별도 콜백이고 `onConnectEnd`(§1.2)는 신규 드래그만 처리, RF 가 두 제스처를 내부적으로 구분(reconnect 는 앵커 드래그) → `fromHandle.type==='source'` 분기와 무충돌. **(d) 부분 이행** — reconnect glue 는 `useEdgeReconnect` 훅으로 순수 추출해 renderHook 단위 테스트(detach 결정 전수). §1.2 popup 실배선(onConnectEnd→handleAddNodeFromSearch)은 컴포넌트 state 결합·canvas RTL 하네스 부재로 여전히 미검증 — 순수 헬퍼는 vitest 전수 커버, 잔여 glue 는 §4 오케스트레이션 정리 시로 이월. **(e) 완료** — `firstInputHandleId` 가 예약 입력 포트(`emit`, `RESERVED_INPUT_HANDLE_IDS`)를 코드 레벨에서 제외(테스트 2케이스). latent 컨테이너 충돌 orphan 위험 해소.
- [x] §2.2 금지 연결 검사 — 자기연결(source===target) `isValidConnection` 커서 🚫 + 동일 연결 중복 `onConnect` 토스트 하드 차단 (출력→출력/입력→입력 은 React Flow 핸들 타입 강제). 순수 헬퍼 `edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`.
- [x] §2.3 사이클 — warn-not-block. 그래프 DFS back-edge 탐지 → 분기 노드 없는 탈출 불가 순환만 `graph:unescapable-cycle` 경고 배지. 컨테이너 loopback(`emit`)·진입(`body`) 예외. FE+BE 동일 규칙(`evaluateGraphCycleWarnings`). "모든 사이클 차단"·툴팁 하드블록 전제는 폐기(위 ✅ 참조).
- [x] §3.2 실행 상태 스타일 — 구현 완료. 신규 `use-edge-execution-state.ts` `useEdgeExecutionState` 훅이 실행 스토어(`status`/`nodeStatuses`)+노드 `isDisabled` 로 각 엣지에 상태 스타일을 입힌다(순수 판정 `edge-utils.ts` `resolveEdgeExecutionState`, 우선순위 inactive>flowing/completed). **데이터 흐름**(실행 중 source completed+target running)=`className wc-edge-flowing`→globals.css 마칭 점선(`edge-flow` keyframe 재사용), **실행 완료**(둘 다 completed)=`className wc-edge-completed`→`wc-edge-complete-flash` 1회성 초록 flash 후 포트색 복귀, **비활성**(source/target `isDisabled`)=`data.edgeInactive`→`custom-edge.tsx` 반투명 점선. `useEdgeHighlighting`(§3.3) 앞단에서 합성(className Set 병합). 테스트: `resolveEdgeExecutionState` vitest 7케이스.
- [ ] §4 / §5 엣지 호버 데이터 미리보기 툴팁 (Data Flow Preview) + 축약 표시 + 전체 데이터 모달
- [ ] §4 엣지 중간 노드 드롭 삽입 (source→새노드, 새노드→target)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 위 spec 본문의 "현재 구현" 주석 참조.
- 구현된 부분(§2.1 출력→입력 방향 강제, §3.1 포트색, §3.3 hover dim/glow, §4 클릭/Delete/hover 하이라이트)은 spec 본문 그대로 정확.
