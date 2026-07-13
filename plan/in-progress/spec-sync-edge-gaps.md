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
- [x] §1.2 출력 포트 드래그 → 빈 영역 드롭 시 노드 추가 검색 팝업 + 자동 엣지 연결 — 구현 완료. `workflow-canvas.tsx` 에 `onConnectEnd`(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle` 기반) 배선: 출력 포트(`fromHandle.type==='source'`) 드래그가 빈 영역(`!isValid`)에 드롭되면 드롭 위치에 노드 추가 검색 팝업을 열고 `NodeSearchPopupState.source` 에 연결원을 기록. `buildAndAddNode` 가 신규 노드 id 를 반환하도록 리팩터하고, `handleAddNodeFromSearch` 가 노드 생성 후 `onConnect(source → 새 노드의 첫 입력 포트)` 로 자동 연결(대상 입력 포트 없으면 생략). 순수 헬퍼 `edge-utils.ts` `isConnectionDroppedOnPane`/`firstInputHandleId` + vitest 9케이스. 입력 포트 시작 역방향 드래그는 §1.3 소관으로 분리.
- [ ] §1.3 입력 포트 시작 역방향 연결 + 기존 엣지 분리 재연결 모드 (`onReconnect`/역방향 드래그 핸들러 부재)
- [x] §2.2 금지 연결 검사 — 자기연결(source===target) `isValidConnection` 커서 🚫 + 동일 연결 중복 `onConnect` 토스트 하드 차단 (출력→출력/입력→입력 은 React Flow 핸들 타입 강제). 순수 헬퍼 `edge-utils.ts` `isSelfConnection`/`isDuplicateConnection`.
- [x] §2.3 사이클 — warn-not-block. 그래프 DFS back-edge 탐지 → 분기 노드 없는 탈출 불가 순환만 `graph:unescapable-cycle` 경고 배지. 컨테이너 loopback(`emit`)·진입(`body`) 예외. FE+BE 동일 규칙(`evaluateGraphCycleWarnings`). "모든 사이클 차단"·툴팁 하드블록 전제는 폐기(위 ✅ 참조).
- [ ] §3.2 실행 상태 스타일 — 데이터 흐름(애니메이션 점선), 실행 완료(초록 잠시), 비활성 노드(반투명 점선)
- [ ] §4 / §5 엣지 호버 데이터 미리보기 툴팁 (Data Flow Preview) + 축약 표시 + 전체 데이터 모달
- [ ] §4 엣지 중간 노드 드롭 삽입 (source→새노드, 새노드→target)

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings 및 위 spec 본문의 "현재 구현" 주석 참조.
- 구현된 부분(§2.1 출력→입력 방향 강제, §3.1 포트색, §3.3 hover dim/glow, §4 클릭/Delete/hover 하이라이트)은 spec 본문 그대로 정확.
