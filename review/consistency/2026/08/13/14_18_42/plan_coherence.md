# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위 요약

- diff (`origin/main...HEAD`, 2 commits): `plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그
  잔여 3건("backlog-final-three") 마감 — (1) `executions.service.ts` `snapshotCache` LRU 상한/방향
  회귀 테스트, (2) `chat-channel.dispatcher.spec.ts` 로그 레벨 분기 양방향 테스트 + fixture 통합,
  (3) `execution-engine.service.ts` `admitExecutionOrDefer` 의 `Array.isArray(rows)` 런타임 가드
  (throw, 트랜잭션 롤백 유지). **`spec/5-system/**.md` 자체는 1줄도 변경되지 않았다** — 순수
  코드+테스트+plan 체크박스 diff.
- 대상 target(`spec/5-system/`)의 `4-execution-engine.md` frontmatter `pending_plans`:
  `execution-engine-residual-gaps.md`(G2 defer 확정, 이번 diff 무관) ·
  `retry-turn-terminal-guard.md`(코드 완료·PR #1024 머지, 잔여는 P2/P3 후속 목록 — `retryLastTurn`/
  `applyRetryLastTurn` 경로, 이번 diff 의 `admitExecutionOrDefer` 와는 다른 코드 경로) ·
  `exec-intake-followups.md`(admission 관련 항목은 전부 `[x]` 완료 처리됨, 이번 diff 와 직접
  충돌 없음).

## 확인한 것 (충돌 없음으로 판정)

1. **미해결 결정과의 충돌** — 이번 diff 가 손댄 3개 항목은 모두 `backend-lint-gate-broken-on-main.md`
   자체가 명시적으로 "결정 필요"로 남겨둔 게 아니라, 직전 세션이 근거를 들어 유예한 항목이고
   이번 라운드가 그 유예 근거("emit JS 가 md5 까지 before/after 동일" = 타입 전용 PR 제약)가
   더 이상 적용되지 않음을 확인한 뒤 착수했다. `Array.isArray` 가드를 `return false`(defer)로
   최초 작성했다가 code-review(`14_01_46` side_effect WARNING 1)가 "콜백이 예외 없이 끝나
   트랜잭션이 커밋된다"를 지적해 `throw`로 되돌렸고, `RESOLUTION.md`가 그 근거를 정확히
   기록했다 — 새 결정을 plan/spec 의 미해결 항목과 충돌시키며 내린 사례는 없음.
2. **선행 plan 미해소** — `execution-engine-residual-gaps.md` G2(`errorPolicy='continue'`
   SIGTERM 분기)는 이번 diff 의 admission-gate 코드(§8 동시성 cap)와 다른 표면이라 전제
   관계 없음. `retry-turn-terminal-guard.md`의 미완료 후속(P2 원자 claim SQL 실 DB 검증 등)도
   `retry-turn.service.ts`(재진입 turn) 쪽이며 `execution-engine.service.ts`
   `admitExecutionOrDefer`(최초 admission)와 코드 경로가 분리돼 있어 이번 diff 가 그 미해소
   상태를 전제로 삼지 않는다.
3. **후속 항목 누락** — 코드 리뷰 라운드(`review/code/2026/08/13/14_01_46`)가 이미 3개 WARNING을
   전량 처리(RESOLUTION.md)했고, 남은 INFO 9건 중 "`snapshotCache`/dispatcher 로그 레벨은
   spec 요구사항이 아니라 문서화 대상 아님"(INFO 9)까지 requirement 리뷰어가 확인했다 — 이번
   diff 로 인해 target(spec/5-system/)에 새로 반영해야 할 계약 변경은 없다.
   - 부가 확인: `admitExecutionOrDefer` 의 신규 `throw`는 `runExecutionFromQueue`의
     로컬 try/catch(=> `runExecution` 호출만 감쌈) 밖에서 발생해 BullMQ
     `execution-run.processor.ts`의 `process()`까지 전파된다. 그 큐는 `attempts: 1`
     (crash-retry 미도입 정책)이라 job 은 즉시 dead-letter 되고, 트랜잭션 롤백으로
     `execution.status`는 `pending`으로 남는다. 이 경우 `onFailed`의
     `finalizeStalledExhausted`(status='running' 조건부)는 no-op 이지만, 이미 완료된
     `exec-intake-followups.md`의 **"orphan pending backstop"**(`recoverOrphanPendingExecutions`,
     `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 경과 후 `cancelled` 마감)이 이 경로를 흡수한다.
     즉 새 gap 이 아니라 기존 일반 백스톱으로 이미 커버되는 경로다 — **추가 plan 항목 불요**로
     판단(정보 제공 목적으로만 기록, `RESOLUTION.md`의 "재시도가 정상적으로 집는다"는 표현은
     엄밀히는 즉시 재시도가 아니라 5분 지연 취소지만 review/** 는 SoT 가 아니고 실제 동작은
     안전하므로 결함으로 등재하지 않음).
   - `spec/5-system/4-execution-engine.md`의 `pending_plans` 목록에 `backend-lint-gate-broken-on-main.md`를
     추가할 필요도 없다 — 그 plan 은 엔진 spec 이 약속한 미구현 표면(G1/G2/G3 류)을 다루는 것이
     아니라 코드 견고성/테스트 백로그이므로 spec-impl-evidence §3 의 `pending_plans` 대상이 아니다.

## 요약

이번 diff 는 `spec/5-system/**.md` 를 변경하지 않는 순수 코드/테스트/plan-체크박스 변경이며,
`4-execution-engine.md` frontmatter 가 지목하는 3개 in-progress plan(execution-engine-residual-gaps·
retry-turn-terminal-guard·exec-intake-followups) 중 어느 것의 미해결 결정·선행 조건과도 충돌하거나
그것을 전제하지 않는다. 새로 발견한 admission-throw → BullMQ dead-letter 전파 경로는 이미 완료된
"orphan pending backstop" 이 흡수하는 기존 안전망 범위 안에 있어 별도 plan 항목이 필요하지 않다.
Plan 정합성 관점에서 이 PR 을 막을 이유가 없다.

## 위험도

NONE
