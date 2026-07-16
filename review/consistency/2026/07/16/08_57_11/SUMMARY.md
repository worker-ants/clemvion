# Consistency SUMMARY — `--impl-done` (control-plane per-provider escape)

- 모드: `--impl-done` scope=`spec/5-system/15-chat-channel.md`, diff-base=origin/main
- checker 5/5 완료

## BLOCK: NO

| checker | Critical | Warning | Info |
|---|---|---|---|
| cross_spec | 0 | 0 | 1 |
| rationale_continuity | 0 | 2 | 1 |
| convention_compliance | 0 | 1 | — |
| plan_coherence | 0 | 1 | 1 |
| naming_collision | 0 | 0 | 1 |
| **합계** | **0** | **4** | — |

## Critical: 없음 → 차단 없음. rationale: F-5 제거는 plan 이 예고한 근본 fix 진행(부당 번복 아님) 확인.

## Warning 처분 — 전부 fix (commit `0080c917d`)
- [rationale/naming/cross_spec/plan] "6함수" 리터럴 카운트 stale(escapeControlText 로 7 필수) →
  15-chat-channel R6/§7·chat-channel-adapter R1/R2 제목·slack/discord spec·slack.adapter 주석 전면 정리
  (R1/R2 anchor backlink 부재 확인 후 제목 rename).
- [rationale] 이중-escape 마이그레이션 위험이 plan 에만 있고 CHANGELOG/spec 부재 → CHANGELOG 에 ops note 추가.
- [convention] `unsupportedMessageKind` 가 §4.1 예제/표 누락(pre-existing) → §4.1 예제 등재.

## Info
escapeControlText 신규 식별자 충돌 없음(naming). F-5 관련 식별자 삭제분은 plan/complete 역사 기록에만 잔존.
