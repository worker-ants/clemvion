# 문서화(Documentation) Review — orphan pending backstop (fresh re-review)

세션: `review/code/2026/07/04/22_28_18` · 이전 세션 `review/code/2026/07/04/22_12_26` 에서 발견된
3건의 documentation WARNING(W2/W3/W4) fix 검증.

## 검증 방법

payload diff(`origin/main...HEAD`) 로 스코프된 11개 파일 변경 확인 + 실제 소스 파일
(`execution-engine.service.ts`, `CHANGELOG.md`, `spec/5-system/4-execution-engine.md`,
`spec/data-flow/3-execution.md`) 을 직접 Read 하여 diff 상 표현과 현재 파일 상태가
일치하는지 대조. `git diff origin/main...HEAD --stat` 로 payload 스코프가 실제 커밋
범위와 일치함을 확인(fallback 불필요).

## 이전 WARNING 재검증

- **W2 (recoverStuckExecutions JSDoc)** — FIXED 확인. `execution-engine.service.ts:2781-2812`
  JSDoc 헤더가 "re-drive stale RUNNING executions **and cancel orphan PENDING** executions"
  로 시작하고, `§7.1/§7.2 point 3/§7.4/§7.5 case B/§8` 레퍼런스, "같은 스캔이 orphan
  `pending` 도 회수한다(`recoverOrphanPendingExecutions`, §8)" 단락, "RUNNING 은 진행
  흔적이 있어 re-drive, PENDING 은 없어 cancel" 근거, "running 재점유 유무와 무관하게
  항상 수행한다"(= early-return 제거와 정합) 를 모두 포함한다. 코드 본문(2833행 `if
  (reclaimedIds.length > 0) {...}` + 2852행 `await this.recoverOrphanPendingExecutions()`
  가 try 블록 최상위, early-return 없이 항상 실행)과 JSDoc 서술이 정확히 일치.

- **W3 (runStuckRecoveryScan JSDoc)** — FIXED 확인. `execution-engine.service.ts:754-762`
  JSDoc 이 "§7.1/§7.5 case B 재구동(+ §8 orphan pending cancel)을 **on-demand 로 1회
  스캔** 트리거한다(`recoverStuckExecutions` 전체 위임)" 로 갱신됨. 이 test-hook
  래퍼가 `recoverStuckExecutions` 를 그대로 위임 호출하므로 orphan cancel 도 함께
  트리거된다는 사실이 정확히 반영됨.

- **W4 (CHANGELOG.md)** — FIXED 확인. `## Unreleased — orphan pending backstop (§8
  recoverStuckExecutions)` 항목이 최상단에 추가됨. 내용은 갭 설명(재큐 job 소실 →
  재-pick up 불가 → 5분 timeout 미검사 → 영구 잔류), 액션(`markQueueWaitTimeout`
  재사용 → wait-timeout cancelled), RUNNING re-drive vs PENDING cancel 구분,
  "신규 migration·env·에러코드 없음" 명시, SoT 링크(`§8/§7.4`) 를 모두 포함하며
  실제 코드 동작과 정확히 일치.

## 추가 확인 — spec 반영 정확성 (INFO 수준, 이전 세션에서 이미 커버됨)

`spec/5-system/4-execution-engine.md` §7.1 상태표·§7.4 "Stale 대상" 단락·§8 admission
트리거 서술, `spec/data-flow/3-execution.md` state diagram·recovery 소스 표가 모두
orphan pending backstop 을 코드와 일치하게 반영한다. 특히 §8 의 옛 "job 자체가 소실된
orphan `pending` 회수는 **후속**" 문구가 "**구현 완료(2026-07-04)**" 로 정확히
교체되어 stale 서술이 남아있지 않음을 재확인(grep 으로 `spec/5-system/4-execution-engine.md`
전체에서 "후속" 키워드 잔존 여부 점검 — orphan/pending 관련 잔존 0건, 남은 "잔여
후속" 언급은 이번 변경과 무관한 다른 항목).

## 신규 테스트 파일 문서화 상태 (참고 — 이전 세션에서 이미 통과)

- `execution-engine.service.spec.ts`: describe 블록 상단 주석이 "§8 orphan pending
  backstop (2026-07-04) — admission 재큐 job 소실로 재-pick up 안 되는 대기 초과
  pending 을 recoverStuckExecutions 부팅 스캔이 wait-timeout cancel" 로 정확.
- `execution-concurrency-cap.e2e-spec.ts`: 파일 헤더 시나리오 목록에 (3)(4) 추가,
  개별 `it` 블록 위 인라인 주석도 갭·기대 결과 서술이 정확.
- `plan/in-progress/orphan-pending-backstop.md` 신규 plan 문서: 현황/설계결정/체크리스트
  구조가 명확하고 RESOLUTION.md·SUMMARY.md 와 정합.

## 발견사항

없음.

## 요약

이전 ai-review 세션(`22_12_26`)에서 지적된 documentation 관점 3건의 WARNING(W2:
`recoverStuckExecutions` JSDoc 미반영, W3: `runStuckRecoveryScan` JSDoc 미반영, W4:
CHANGELOG 누락)이 모두 본 커밋에서 정확히 fix 되었음을 소스 코드 직접 대조로 확인했다.
JSDoc 서술은 코드의 실제 제어 흐름(early-return 제거, RUNNING re-drive/PENDING cancel
분기)과 정확히 일치하며, CHANGELOG 항목은 사용자 관측 가능한 동작 변화(영구 잔류하던
orphan pending 이 이제 wait-timeout cancel 됨)를 정확하고 충분한 근거와 함께 기록한다.
spec 문서(§7.1/§7.4/§8, data-flow §3)도 코드와 정합하며 stale된 "후속" 문구가 정확한
"구현 완료" 서술로 교체되어 남아있지 않다. 신규 테스트 파일들의 인라인 주석도 시나리오
의도를 명확히 설명한다. 문서화 관점에서 추가로 지적할 결함이 없다.

## 위험도

NONE

STATUS: SUCCESS
