# Resolution — consistency --impl-done 07_51_08 (§7)

판정: **BLOCK: NO** (Critical 0). Warning 3 처분.

## Warning

| # | 처분 | 조치 |
|---|------|------|
| W-1 | **FIX** | `status: implemented` + `pending_plans` 공존 위반 해소 — `plan/in-progress/spec-sync-execution-gaps.md`(전 항목 [x] 완료)를 `git mv` 로 `plan/complete/` 이동(frontmatter `status: complete` + `spec_impact: [spec/3-workflow-editor/3-execution.md]` 추가) + spec frontmatter `pending_plans:` 행 삭제 + 본문 추적 경로를 `plan/complete/` 로 갱신. 검증: spec-status-lifecycle·spec-plan-completion(Gate C)·plan-frontmatter 가드 PASS(2205). 본 fix 는 spec/plan 전용(codebase 무변경) — review_guard 는 codebase/** 만 감시하므로 ai-review/--impl-done 게이트 재무장 없음(기존 07_43_04 ai-review·07_51_08 impl-done 유효 유지). |
| W-2 | **DEFER** | `editor.executionHistory` vs `workflows.executionHistory` EN 라벨 공유 — 둘 다 "실행 히스토리" 진입점이라 동일 라벨이 부자연스럽지 않고, 사용자 라벨 변경은 i18n(codebase) 편집이라 ai-review 루프 재무장. 런타임 충돌 없음(namespace 분리). 후속 nice-to-have. |
| W-3 | **DEFER** | `historyLoadFailed`(입력 픽커 실패) vs `executionHistoryLoadFailed`(상세 적재 실패) 메시지 유사 — 사용처·기능 명확히 분리됨(개발자 혼동 nit). 키 rename 은 codebase 편집이라 게이트 재무장. 후속. |

## INFO
- I-1/I-2 Cross-Spec: 전부 정합(조치 불요).
- I-3/I-4 Rationale: raw div modal / drawerExpanded 보존 — R-7·코드 주석에 일부 기술됨, 추가 1줄 보완은 선택적 DEFER.
- I-5 Plan Coherence: W-1 과 함께 plan 이동으로 해소.
- I-6 exec-single-node.md push/PR 체크박스: 타 plan, 본 PR 무관.
- I-7/I-8 Convention: ImplAnchor·i18n parity 통과.
- I-9 `historyPanelOpen`/`historyPickerOpen`: 기능 구분 명확, rename 선택적 DEFER.

## 종결
- **BLOCK: NO**. W-1 본 PR 해소, W-2/W-3·INFO 비결함 DEFER.
- W-1 fix 는 codebase 무변경(spec frontmatter·prose + plan 이동)이라 review 게이트(ai-review/impl-done) 재실행 불요 — review_guard 가 codebase/** 변경만 감시함(`.claude/hooks/_lib/review_guard.py`).
