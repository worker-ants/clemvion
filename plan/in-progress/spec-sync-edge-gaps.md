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
- [ ] §1.3 입력 포트 시작 역방향 연결 + 기존 엣지 분리 재연결 모드 (`onReconnect`/역방향 드래그 핸들러 부재)
  - §1.2 ai-review 이월(착수 시 함께 검토): (a) `workflow-canvas.tsx` God Component 팽창 — "드래그 종료→팝업 오픈→자동 연결" 오케스트레이션을 전용 훅으로 추출. (b) `NodeSearchPopupState.dragSource` 단방향(출력→입력)만 인코딩 → 방향 태그 유니온(`role`)으로 재설계. (c) `onConnectEnd`/`connectionDragSource` 의 `fromHandle.type==='source'` 분기가 `onReconnect`(엣지 detach) 제스처와 충돌하지 않는지 확인, 필요 시 재연결 제외 가드. (d) **[의도적 최종 이월 — 결정 확정]** `workflow-canvas.tsx` 실배선(`onConnectEnd`→`handleAddNodeFromSearch`→`onConnect`)의 RTL + `@xyflow/react` mock 통합 테스트. 판정/조립 순수 로직은 vitest 로 전수 커버(edge-utils 21 + store 2)되고 남는 미검증 부분은 얇은 glue(헬퍼 호출 순서·인자 전달)뿐이다. 저장소에 canvas 컴포넌트 테스트 하네스가 전무해 지금 새로 도입하면 flaky 위험이 크고, 이 테스트는 (a) 오케스트레이션 훅 추출로 검증 대상이 순수 훅이 되는 §1.3 시점에 함께 작성하는 것이 옳다. **ai-review 11_04_21/11_28_30/11_46_01/12_02_54 4회 연속 동일 지적이나, 본 이월은 리뷰어가 명시 허용한 "의도적 미해결 최종 확정" 경로다 — §1.3 착수 전까지 재지적 대상 아님(§1.2 PR 은 이 항목으로 blocking 하지 않는다).**
  - (e) `firstInputHandleId`/`buildAutoConnectConnection` 의 "자동 연결 시 컨테이너 충돌 미발생" 불변식이 코드가 아닌 JSDoc 에만 의존(ai-review `12_02_54` requirement WARNING). 현재 `loop`/`foreach`/`map` 컨테이너 첫 입력이 항상 `'in'` 이라 `detectContainerConflict` 미트리거이나, 신규 컨테이너 노드 정의가 첫 입력을 예약 포트(`'emit'` 등)로 두면 노드는 생성되고 엣지는 거부돼 orphan 이 남는다(생성 롤백 없음). latent·현재 미발생. §1.3 착수 시 `firstInputHandleId` 가 예약 포트 id 를 코드 레벨에서 제외하도록 강화하거나, 신규 컨테이너 노드 추가 PR 의 체크리스트로 첫 입력 포트 규약을 검증.
- [x] §2.2 금지 연결 검사 — 자기연결(source===target) `isValidConnection` 커서 🚫 + 동일 연결 중복 `onConnect` 토스트 하드 차단 (출력→출력/입력→입력 은 React Flow 핸들 타입 강제). 순수 헬퍼 `edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`.
- [x] §2.3 사이클 — warn-not-block. 그래프 DFS back-edge 탐지 → 분기 노드 없는 탈출 불가 순환만 `graph:unescapable-cycle` 경고 배지. 컨테이너 loopback(`emit`)·진입(`body`) 예외. FE+BE 동일 규칙(`evaluateGraphCycleWarnings`). "모든 사이클 차단"·툴팁 하드블록 전제는 폐기(위 ✅ 참조).
- [ ] §3.2 실행 상태 스타일 — 데이터 흐름(애니메이션 점선), 실행 완료(초록 잠시), 비활성 노드(반투명 점선)
- [ ] §4 / §5 엣지 호버 데이터 미리보기 툴팁 (Data Flow Preview) + 축약 표시 + 전체 데이터 모달
- [ ] §4 엣지 중간 노드 드롭 삽입 (source→새노드, 새노드→target)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 위 spec 본문의 "현재 구현" 주석 참조.
- 구현된 부분(§2.1 출력→입력 방향 강제, §3.1 포트색, §3.3 hover dim/glow, §4 클릭/Delete/hover 하이라이트)은 spec 본문 그대로 정확.
