# Consistency SUMMARY — `--impl-done` (F-1~F-6 종결)

- 모드: `--impl-done` scope=`spec/5-system/15-chat-channel.md`, diff-base=origin/main
- checker 5/5 완료

## BLOCK: NO

| checker | Critical | Warning | Info |
|---|---|---|---|
| cross_spec | 0 | 3 | — |
| rationale_continuity | 0 | 2 | — |
| convention_compliance | 0 | 0 | 2 |
| plan_coherence | 0 | 0 | 2 |
| naming_collision | 0 | 1 | 2 |
| **합계** | **0** | **6** | — |

## Critical: 없음 → 차단 없음

## Warning 처분 — spec 내부 정합 5건 fix (commit `2496f834a`), 2건 종결/수용

- [cross_spec] §7.4 receiver 서술 vs §7.5.1 nodeId 모델 모순 → §7.4 를 "nodeId 는 사후 검증 입력" 으로 정합.
- [cross_spec] §3.5 에러 형태(details.code) vs 실제 CustomValidationPipe → §3.5 정정(details[].message prefix + INVALID_FIELD).
- [cross_spec] formValidationFailed/formNextField 카탈로그 부재 → §4.1 예제 등재.
- [rationale] Rationale "표 3번째 행" stale(F-1 삽입으로 밀림) → "표면 불일치 행" 으로 정정.
- [rationale] §4.1 예제 config 가 F-5 검증 위반(unescaped 마침표) → 예제 escape.
- [naming] F-5/F-6 plan 라벨 도메인 미분리 → plan 완료 이동으로 종결.
- [plan_coherence] 완료 plan in-progress 잔존 → complete/ 이동으로 종결.

## Info
diff 는 error-codes·swagger·chat-channel-adapter 등 기존 convention 을 충실히 재사용, CRITICAL 급 위반 없음.
