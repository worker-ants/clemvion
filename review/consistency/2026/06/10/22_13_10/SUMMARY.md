# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불요.

## 전체 위험도
**LOW** — spec ↔ 구현 불일치 1건(W-1, 삭제 상수명 spec 잔류)이 여러 checker 에서 수렴, 나머지는 INFO/plan 추적 보강.

## Critical 위배

없음.

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| W-1 | Cross-Spec/Convention/Naming (수렴) | 삭제된 FAILED/DELAYED_DEGRADED_THRESHOLD 상수명이 `16-system-status-api.md` 90·94 잔류 | spec-update-deadcode-cleanup.md §1(이미 draft)로 planner 반영 |
| W-2 | Plan Coherence | 03-maintainability §m-2 의 toEiaEvent alias 제거 완료 추적 미명시 | plan/spec-draft 에 ✅ 표시 |
| W-3 | Cross-Spec | FREEZE_BRANCH_CACHE/structuredOutputCache 가 spec 미기술 | 10-parallel §Rationale + execution-context.md §1 에 추가 (spec-draft) |

## 참고 (INFO)

| # | 항목 |
|---|------|
| I-1·I-6 | toEiaEvent→toChatChannelEvent rename — spec(14-chat-channel:116) 정합, 잔재 0 |
| I-2 | on()/registerContinuationHandlers 제거 — §Rationale full B3 정합 |
| I-3 | §7.4 full B3 날짜 갱신 선택 (spec-draft §2) |
| I-4 | 14-chat-channel frontmatter 없음 — 규약 대상 아님 |
| I-5 | M-5 structuredClone 전환 제외 — spec 결정 준수 |

## Checker별 위험도

| Checker | 위험도 |
|---------|--------|
| Rationale Continuity | NONE |
| Cross-Spec / Convention / Plan Coherence / Naming Collision | LOW |

## 권장 조치사항
1. (W-1) planner: 16-system-status-api §3 상수명→getter (spec-update-deadcode-cleanup §1).
2. (W-2) m-2 alias 제거 완료 ✅ 표기 — main 세션 직후.
3. (W-3) spec-draft 에 freeze/structuredOutputCache 항목 추가 — main 세션 직후.

_브랜치: refactor-approved-batch | 5 checker 모두 success_
