---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
spec_impact:
  - spec/3-workflow-editor/0-canvas.md
  - spec/3-workflow-editor/2-edge.md
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/4-nodes/0-overview.md
  - spec/0-overview.md
  - spec/conventions/cross-node-warning-rules.md
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
- [x] §4.1 팔레트 **Installed(마켓플레이스) 섹션** — 마켓플레이스 모듈(`marketplace-and-plugin-sdk.md`) 의존, backlog 유지. (Recent 와 분리) **→ 마켓플레이스 백로그(`marketplace-and-plugin-sdk.md`)로 이관, 본 spec-sync plan 범위 종결.**
- [x] §4.2 팔레트 아이템 클릭으로 노드 추가(뷰포트 중앙+지터, `palette-canvas-bridge`) + 패널 접기 토글(아이콘 레일). **PR #847**.
- [x] §4.3 빠른 노드 추가 팝업 키보드 — ↑/↓ 하이라이트·Enter 선택·Escape 닫기(팝업 우선, `stopPropagation`). 순수 리듀서 `quick-add-nav`. **PR #847**.
- [x] §8 자동 저장 + PRD §5 ED-SP-05(설정 즉시 반영) — **spec 정정으로 해소(구현 안 함, 방향 반대)**. 2초 디바운스 타이머 자동 저장·오프라인 로컬 초안·동시편집 충돌 감지·설정 즉시 반영은 모두 미구현이며, 현재의 명시 저장(수동 `Ctrl+S`·`Save` + 실행 직전 저장)·설정 `변경 저장`/`JSON 적용` 모델이 의도된 설계로 확인됨(사용자 결정 2026-07-08). §8/§8.1·§5.3·PRD ED-SP-05/SV-02/AI-17·2-edge §8·4-ai-assistant·**0-overview §3.3·4-nodes/0-overview §1.4**(cross-cutting SoT 전파, consistency Critical 2건 해소) 의 저장 참조를 현재 동작으로 정정 + 0-canvas `Rationale R-3` 기록. 유저 가이드는 PR #855 에서 이미 현재 동작 서술. 타이머 자동 저장·오프라인 초안 부활은 별도 기획 판단으로 남김.
- [x] §11.4 중첩 최대 깊이(3) 제한 + 초과 토스트 + 레벨별 배경 틴트 — **spec 정정으로 해소(구현 안 함 — 파기 확정, 사용자 결정 2026-07-08)**. 중첩 기능 자체는 실재·구현·테스트됨(실행 엔진 §3.4 중첩 컨테이너 스코프, `loop`/`foreach-executor` save/restore + nested-container 테스트)이라 **유지**하되, 깊이 상한(3)·초과 토스트·레벨별 배경 틴트는 앞으로도 구현하지 않는다. 근거: (a) 배경 틴트는 §11.2 "시각 containment 미사용" 과 모순, (b) 깊이 상한 3은 근거 없고 실행 엔진은 사이클(`CONTAINER_CYCLE`)만 차단·무제한, (c) 중첩 실행은 이미 구현. §11.4 본문·§Rationale R-4·`cross-node-warning-rules §9` 동기화.

## 비고
- 각 항목의 근거(claim→코드부재)는 review/spec-coverage/2026/06/03/08_05_49 audit findings 및 본 spec 본문의 "미구현 (Planned)" 표기 참조.
- §11.4 의 시각 틴트·깊이 제한은 §11.2 시각 containment 미사용 결정과의 모순 + 근거 부재로 **파기 확정**(구현 안 함, 사용자 결정 2026-07-08) — 상세 §Rationale R-4. 중첩 기능 본체(실행 스코프)는 유지.
