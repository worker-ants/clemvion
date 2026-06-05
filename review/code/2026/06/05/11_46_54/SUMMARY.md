# Code Review 통합 — B3 summary_buffer 토큰 재계산 O(n²)→O(n)

**BLOCK: NO** — Critical 0. 4 reviewer(perf/side-effect/testing/maintainability) fan-out, 전원 BLOCK:NO.
대상(merge-base 57d366b6..HEAD): agent-memory-injection.ts(루프 O(n) 증분) + .spec.ts(오라클 회귀핀) + conversation-thread.md(선존 §9 앵커 fix).

## Critical / Warning
- _Critical 없음._
- **maintainability W (적용)**: `cut`/`remainingCount` 변수 중복·네이밍 → `cutIdx` 단일화(`uncompressed.length - cutIdx`), `MIN_RECENT_RAW_TURNS` export 해 테스트 오라클 하드코딩 `2` 제거.

## INFO (분석/보류)
- performance: O(n²)→O(n) 달성 확인(재토큰화+shift 제거), 정수연산이라 누적오차 없음, 경계조건 동일, 잔존 O(n²) 없음. 위험도 NONE.
- side-effect: toCompress 집합·newUpToSeq·summarized·예산경계(`>`)·마지막 turn 방어 모두 bit-identical, 제거 변수 미사용 확인. NONE.
- testing: 오라클 bit-identical sweep(24turn×budget) + 개수정밀 + getter 계측 O(n) 입증 — 신뢰도 높음. 기존 28 + 신규 3 = 31 GREEN.
  - 보류(경미): runningSummary≠undefined sweep 케이스, `budget==currentTokens` 정확경계 단언 추가.

## reviewer별 BLOCK
performance NO · side-effect NO · testing NO · maintainability NO
