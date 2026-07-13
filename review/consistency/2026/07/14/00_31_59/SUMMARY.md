# Consistency SUMMARY — `--impl-done` (EIA 후속 F-2, surfaceMismatch)

- 모드: `--impl-done` scope=`spec/5-system/15-chat-channel.md` (+ providers/telegram.md), diff-base=origin/main
- checker 5/5 완료

## BLOCK: NO

| checker | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| cross_spec | 0 | 0 | 2 | LOW |
| rationale_continuity | 0 | 0 | 2 | LOW |
| convention_compliance | 0 | 1 | 2 | LOW |
| plan_coherence | 0 | 1 | 0 | LOW |
| naming_collision | 0 | 0 | 0 | NONE |
| **합계** | **0** | **2** | **6** | **LOW** |

## Critical: 없음 → 차단 없음

## Warning 처분 (2건 — 모두 same-turn 해소)

1. **[convention_compliance]** `chat-channel-adapter.md §2.3` JSDoc 의 하드코딩 "12 문구" 카운트가 stale
   (`formOpenLabel`/`sessionExpired` 도입부터, `surfaceMismatch` 로 9키/18문구가 됨). target(§4.1.1)
   자체는 정확. → **fix**: 브리틀한 숫자 제거("KO/EN default 문구 표").
2. **[plan_coherence]** F-2 완료분이 `plan/in-progress/eia-command-waiting-surface-guard.md` 에 미반영
   (plan_guard 대상). → **fix**: F-2 절 완료 표기 + 체크리스트 + 리뷰 산출물 링크 + F-4/F-5 백로그 추가.

## Info (6건)
R4 예외 카테고리 canonical화 미비 / CCH-ERR-05 degraded 관계 미명시 / 인접 convention 아키텍처 서술
완결성 등 — 모두 기존 관례 계승, 신규 위반 아님. 차단 아님.
