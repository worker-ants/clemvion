---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# canvas — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec(`spec/3-workflow-editor/0-canvas.md`)을 `partial` 로 유지하며 분리한 미구현 항목 추적.
> 관련 spec: spec/3-workflow-editor/0-canvas.md

## 미구현 항목
- [x] §7 미니맵 — @xyflow `MiniMap` 오버레이/뷰포트 사각형/토글 (`canvas-minimap.tsx` 신설, workflow-canvas 렌더). lint·unit·build·e2e(236) 통과.
- [x] §6/§3.1 줌 슬라이더 + 줌 퍼센트 표시 (`zoom-controls.tsx` 로 ZoomControls 분리 + 슬라이더 25~200%·실시간 퍼센트, ReactFlow minZoom/maxZoom 정합). lint·unit·build·e2e 통과.
- [x] §5.4 노드 우상단 ✕ 삭제 버튼 (`custom-node.tsx` — hover fade-in/선택 상시, manual_trigger·실행 중 숨김, removeNode). lint·unit·build·e2e 통과.
  > spec 본문 §3.1/§5.4/§6/§7 "미구현 (Planned)" 주석도 구현됨으로 동기화 (commit b6f317edf). /ai-review·/consistency-check --impl-done 는 REVIEW WORKFLOW 에서 수행.
- [x] §11.3 컨테이너 삭제 Delete/Ungroup 확인 다이얼로그 — `container-delete-dialog.tsx`(라디오: Delete-all vs Ungroup, Ungroup 기본). ✕ 버튼·우클릭(`requestNodeDelete`)·Delete 키(`onBeforeDelete`) 세 경로 경유. 빈 컨테이너·일반 노드는 즉시 삭제. `confirmContainerDelete(mode)`. spec §11.3/§11.2.1 동기화. lint·unit·build·e2e·ai-review(Critical 0)·consistency(BLOCK:NO) 통과. **PR #846**.
- [x] §10 단축키: Ctrl+C/V/D/A·Escape(드로어 복귀 우선 분기)·Space 패닝(`panActivationKeyCode`)·Ctrl++/-/0/1(줌, 캔버스 컴포넌트). `isEditableTarget` 가드(shared util). spec §10 표 구현됨 flip + Ctrl+Shift+R/Escape 오기재 정정. lint·unit·build·e2e·ai-review(Critical 0)·consistency(BLOCK:NO) 통과. **PR #846**.
- [x] §3.3 Ctrl+C/V 복사·붙여넣기 + Ctrl+D 복제 — `editorClipboard` 앱 내부 상태. copySelection/pasteClipboard/duplicateSelection(신규 id·오프셋·유니크 라벨·엣지 재연결·containerId 재도출). 캔버스 우클릭 "붙여넣기"(클릭 위치). spec §3.3/§3.5 동기화. lint·unit·build·e2e·ai-review(Critical 0)·consistency(BLOCK:NO) 통과. **PR #846**.
- [x] §4.1 팔레트 **Recent 섹션** — 최근 사용 노드 타입 상단 표시(`recent-nodes-store`, 세션 한정·최대 5·최신순·manual_trigger 제외·검색 중 숨김). `addNode` 주 choke point + paste/duplicate 는 `recordRecentNodeTypesFrom` 별도 기록. **PR #847**.
- [ ] §4.1 팔레트 **Installed(마켓플레이스) 섹션** — 마켓플레이스 모듈(`marketplace-and-plugin-sdk.md`) 의존, backlog 유지. (Recent 와 분리)
- [x] §4.2 팔레트 아이템 클릭으로 노드 추가(뷰포트 중앙+지터, `palette-canvas-bridge`) + 패널 접기 토글(아이콘 레일). **PR #847**.
- [x] §4.3 빠른 노드 추가 팝업 키보드 — ↑/↓ 하이라이트·Enter 선택·Escape 닫기(팝업 우선, `stopPropagation`). 순수 리듀서 `quick-add-nav`. **PR #847**.
- [ ] §11.4 중첩 최대 깊이(3) 제한 enforcement + 초과 토스트 + 레벨별 배경 틴트 (단, §11.2 "시각 containment 미사용" 과의 정합성 재정의 선행 필요)

## 비고
- 각 항목의 근거(claim→코드부재)는 review/spec-coverage/2026/06/03/08_05_49 audit findings 및 본 spec 본문의 "미구현 (Planned)" 표기 참조.
- §11.4 의 시각 틴트는 §11.2 의 현재 렌더 모델(컨테이너 = 일반 노드 크기, 자식 자유 배치)과 배치되므로, 구현 전 시각 containment 도입 여부 결정이 선행되어야 한다.
