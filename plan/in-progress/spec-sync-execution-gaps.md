---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# execution — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/3-workflow-editor/3-execution.md
> 주의: §6 브레이크포인트/단계 실행은 spec 본문·Rationale 에서 이미 "향후 로드맵(미구현)" 으로 분리돼 있으므로 본 plan 범위 밖 (별도 재도입 plan 대상). 본 plan 은 implemented 로 단정됐으나 실제 부재한 surface 만 추적한다.

## 미구현 항목
- [ ] §1.3 단일 노드 테스트 — 노드 우클릭 "실행" 진입점 + 단일 노드 실행 엔드포인트 (현 우클릭 메뉴 = Settings/Duplicate/Disable/Delete 뿐, `workflow-canvas.tsx`)
- [ ] §2.2 Mock Input 다이얼로그 — "Load from History"(이전 실행 입력 로드), 테스트 데이터 세트 저장/이름 지정, 실시간 JSON 검증 UI (현 다이얼로그 = textarea + Cancel/Run 뿐, `editor-toolbar.tsx`)
- [ ] §7 인-에디터 실행 히스토리 — 더보기(⋮) 메뉴의 "실행 히스토리" 항목, 과거 실행 캔버스 오버레이, 히스토리 항목 "이 입력으로 다시 실행" (현 ⋮ = Version History/Export/Delete 뿐)
- [ ] §10.12 단축키 — Ctrl+Shift+R 드로어 토글, Escape 캔버스 포커스 복귀 (현 전역 키 핸들러 = Undo/Redo/Save/Assistant 토글뿐, `workflow-editor.tsx`)

## 비고
- §1.2 부분 실행 트리거(우클릭 → 툴바 드롭다운 "Run from Selected") 및 §8/§9 WS·API 명칭 불일치는 spec 본문 패치로 정정 완료 (기능 자체는 구현돼 있어 plan 항목 아님).
- 각 항목의 근거(claim→코드부재)는 audit findings/3-workflow-editor.md 참조.
