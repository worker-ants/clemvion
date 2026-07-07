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
- [ ] §11.3 컨테이너 삭제 Delete/Ungroup 확인 다이얼로그 (editor-store removeNode 는 제거+containerId 재계산만)
  > 잔여 범위 축소: §5.4 ✕ 버튼은 컨테이너에도 이미 렌더됨(공용 `custom-node.tsx`). 남은 것은 **확인 다이얼로그(Delete/Ungroup 선택)** 뿐 — ✕ 버튼·Delete 키·우클릭 모두 현재 즉시 removeNode(사실상 Ungroup). spec §11.3 본문 동기화 완료.
- [ ] §10 미바인딩 단축키: Ctrl+C/V/D/A, Escape(선택 해제분), Space+드래그, Ctrl++/-/0/1 (Ctrl+Shift+R·Escape[드로어 복귀]는 §10.12 로 **기구현** — 본 목록에서 제외)
- [ ] §3.3 Ctrl+C/V 복사·붙여넣기 clipboard 로직 (복제는 우클릭 메뉴 duplicate 만)
- [ ] §4.1 팔레트 Recent 섹션 / Installed(마켓플레이스) 섹션
- [ ] §4.2 팔레트 아이템 클릭으로 노드 추가 (현재 드래그 앤 드롭만) + 팔레트 패널 접기 토글
- [ ] §4.3 빠른 노드 추가 팝업의 Enter 선택 / Escape 취소 키보드 핸들링
- [ ] §11.4 중첩 최대 깊이(3) 제한 enforcement + 초과 토스트 + 레벨별 배경 틴트 (단, §11.2 "시각 containment 미사용" 과의 정합성 재정의 선행 필요)

## 비고
- 각 항목의 근거(claim→코드부재)는 review/spec-coverage/2026/06/03/08_05_49 audit findings 및 본 spec 본문의 "미구현 (Planned)" 표기 참조.
- §11.4 의 시각 틴트는 §11.2 의 현재 렌더 모델(컨테이너 = 일반 노드 크기, 자식 자유 배치)과 배치되므로, 구현 전 시각 containment 도입 여부 결정이 선행되어야 한다.
