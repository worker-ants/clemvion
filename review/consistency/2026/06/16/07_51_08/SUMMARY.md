# Consistency Check 통합 보고서 (--impl-done, §7)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 규약 위반 1건(WARNING: spec frontmatter `implemented` + `pending_plans` 공존)과 i18n 레이블·키 혼동 2건(WARNING). 모두 기능 정확성에 영향 없음.

## Critical 위배 (BLOCK 사유)
_없음_

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 처분 |
|---|---------|------|------|------|
| W-1 | Convention Compliance | `status: implemented` 이면서 `pending_plans:` 비어있지 않음 — 라이프사이클 invariant 위반 | `spec/3-workflow-editor/3-execution.md` frontmatter | **FIX** — 본 커밋에서 plan 을 `plan/complete/` 로 이동 + `pending_plans:` 삭제 |
| W-2 | Naming Collision | `editor.executionHistory` 와 `workflows.executionHistory` 가 EN `"Execution History"` 공유(모달 vs 페이지) | `dict/en/editor.ts` / `dict/en/workflows.ts` | DEFER — 둘 다 "실행 히스토리" 진입점으로 동일 라벨이 자연스럽고, 레이블 변경(코드)은 ai-review 루프 재무장. 비결함 |
| W-3 | Naming Collision | `editor.historyLoadFailed`(입력 실패) vs `editor.executionHistoryLoadFailed`(상세 실패) 메시지 유사 | `dict/*/editor.ts` | DEFER — 기능 구분 명확(코드 사용처 분리), 개발자 혼동 nit. 코드 변경은 ai-review 루프 재무장 |

## 참고 (INFO) — 핵심
- I-1/I-2 (Cross-Spec): API·응답·트리거·Re-run·`startHistoryView` 모두 spec §7/§2.4/§5·conversation-thread §9.7.1 정합. 충돌 없음.
- I-3/I-4 (Rationale): raw div modal·drawerExpanded 보존이 R-7 미기록(선택적 보완) → R-7 본문에 이미 일부 기술, 추가 보완 DEFER.
- I-5 (Plan Coherence): plan 완료 이동 — W-1 과 함께 본 커밋에서 처리.
- I-7/I-8 (Convention): ImplAnchor grep 통과, i18n en/ko parity 충족.
- I-9 (Naming): `historyPanelOpen`/`historyPickerOpen` prefix 공유 — 기능 구분 명확, rename 선택적 DEFER.

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | NONE |
| Rationale Continuity | NONE |
| Convention Compliance | LOW (W-1 → FIX) |
| Plan Coherence | LOW (I-5 → FIX) |
| Naming Collision | LOW (W-2/W-3 DEFER) |

STATUS=write_blocked BLOCK=NO
