# RESOLUTION — review/code/2026/07/26/12_55_55

2R(검증 라운드) 잔여 CRITICAL 1건 + WARNING 5건 전건 처리 완료. INFO 는 조치 불요(백로그만 기록).

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C5 | 코드 | `10b27c320` | `ParallelExecutor` errorPolicy 분기 이전 `ExecutionCancelledError` 우회 재throw 추가(`parallel-executor.ts:277-289` 상단). `errorPolicy:'continue'` 가 취소를 흡수하던 결함 — ForEachExecutor C3 와 대칭. `parallel-executor.spec.ts` 에 `stop`/`continue`/`cancel-others-on-fail` 3정책 × (단독 취소/co-occurring 일반 실패) 2케이스 대칭 회귀 테스트 6건 추가. **mutation 검증**: 재throw 블록 제거 → 4 tests failed(RED, `parallel-executor.spec.ts`) → `cp` 복원 → 27/27 GREEN 재확인 |
| W9 | 코드 | `10b27c320` | `runContainer` catch 최상단에 `if (err instanceof ExecutionCancelledError) throw err;` 추가(FAILED 마킹·NODE_FAILED emit 이전). 컨테이너 자신(`foreach`)의 `NodeExecution` 이 취소를 FAILED 로 오분류하거나 `NODE_FAILED` 를 emit하지 않음을 `nodeExecutionRepository.save`/`emitNode` 인자로 직접 단언하는 회귀 테스트 추가(`execution-engine.service.spec.ts` "Container runtime" describe). **mutation 검증**: 재throw 제거 → 1 test failed(RED, `foreachSaves.some(...FAILED)` 가 `false` 기대에 `true` 수신) → `cp` 복원 → GREEN 재확인 |
| W10 | 코드 | `10b27c320` | `assertExecutionNotCancelled` 에 `{ throttle: true }` 옵션 추가 — 최근 실제 조회 후 `CONTAINER_CANCEL_CHECK_THROTTLE_MS`(250ms) 이내 재호출은 DB 조회를 생략하고 직전 결과를 재사용. `executeContainerBody` 호출부(아이템 경계)만 이 옵션을 사용, 선형 dispatch loop·`executeParallelBranchBody`(노드 경계)는 기존대로 매번 조회. `executionId` → 마지막 실제 조회 시각 Map(`containerCancelCheckedAtMs`) 은 `finalizeRehydrationCleanup`·`runExecution` finally 에서 delete 해 누수 방지. 회귀 테스트: 10아이템을 짧은 간격(<250ms)으로 연속 실행 시 `executionRepository.findOne` 호출 수가 아이템 수보다 뚜렷이 작음을 단언. 기존 C3 회귀 테스트(아이템 0→1 경계 취소 관측)는 `Date.now()` spy 로 스로틀 창을 실측 우회하도록 보강(스로틀 도입으로 실시간 연속 실행에서는 다음 아이템까지 취소가 가려질 수 있어 원래 단언이 깨졌었음). **mutation 검증**: 호출부의 `{ throttle: true }` 제거 → W10 신규 테스트 1 test failed(RED, `findOne` 호출 11회 ≥ itemCount 10 기대에 어긋남) → `cp` 복원 → GREEN 재확인 |
| W11 | 코드 | `10b27c320` | C4 배선(guarded `updateExecutionStatus`) 회귀 테스트 신설(`execution-engine.service.spec.ts` "Form node blocking" describe) — `mockExecutionRepo.query` 를 CANCELLED 전이 UPDATE 호출에 한해 `[]`(0행 매칭=이미 terminal)로 override, 그 외 호출은 기존 default 유지. (a) guarded UPDATE 가 실제로 시도됐음과 (b) 그로 인해 raw `save()` 로 stale finishedAt/durationMs 가 재저장되지 않음(CANCELLED 상태의 `save()` 호출 자체 없음)을 단언. **mutation 검증**: `finalizeCancelledExecution` 내부를 옛 raw `save()` 배선으로 되돌림 → W11 신규 테스트 1 test failed(RED, guarded UPDATE 호출 자체가 관측되지 않음) → `cp` 복원 → GREEN 재확인 |
| W12 | 코드 | `10b27c320` | 두 catch(`runExecution`·`finalizeResumedExecutionOutcome`)의 취소 종결 8줄 블록(finishedAt/durationMs 보정 + guarded UPDATE + emit)을 `finalizeCancelledExecution(savedExecution, logContext)` private 헬퍼로 추출. 두 호출자는 `logContext` 문자열만 다르게 전달 |
| W13 | 코드 | `10b27c320` | `assertExecutionNotCancelled` JSDoc 의 "status 단일 컬럼" 표현을 실제 `select:{id:true,status:true}`(2컬럼)에 맞게 "id/status 2개 컬럼" 으로 정정. `CHANGELOG.md:14` 동일 표현도 함께 정정 + W10 스로틀 도입 사실 추가 |
| INFO(`runParallel` failures 미소비) | 백로그만 | — | 이번 범위 밖(사용자 지시). `plan/in-progress/node-cancellation-residual-signal-propagation.md` "백로그 — 이번 라운드 범위 밖으로 명시적으로 남긴 항목" 절에 기록 |
| INFO(`errorPolicy:'stop'` failures[0] 우선순위 레이스) | 백로그만 | — | 같은 절에 기록 |

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260726-133613.log`)
- unit  : 통과 — backend 412/412 suites, 8271 passed + 1 skipped / 8272 total (`_test_logs/unit-20260726-133706.log`). 모노레포 타 패키지(frontend/channel-web-chat/packages/*) 전부 통과
- build : 통과 (`_test_logs/build-20260726-133822.log`)
- e2e   : 통과 — 46 suites / 259 tests, 0 failures (`_test_logs/e2e-20260726-134025.log`)

### mutation 검증 요약 (전 항목 개별 RED 확인 → `cp` 복원 → GREEN 재확인, `git checkout` 미사용)

| 대상 | 제거한 것 | 결과 |
|---|---|---|
| C5 | `parallel-executor.ts` 의 cancellation bypass 블록 | `parallel-executor.spec.ts` 4 failed → 복원 27/27 GREEN |
| W9 | `runContainer` catch 상단 재throw | W9 신규 테스트 1 failed → 복원 GREEN |
| W10 | `executeContainerBody` 호출부의 `{ throttle: true }` | W10 신규 테스트 1 failed(findOne 11회) → 복원 GREEN |
| W11 | `finalizeCancelledExecution` 의 guarded UPDATE → 옛 raw `save()` | W11 신규 테스트 1 failed(guarded UPDATE 미관측) → 복원 GREEN |

원복은 매번 `cp` 백업(사전에 `/private/tmp/.../scratchpad/mutation-backup/*.ts` 로 커밋 후 상태 저장) 후 대상 파일 위에 덮어쓰는 방식으로 수행 — `git checkout` 미사용. 원복 후 `diff` 로 완전 일치 확인.

## 보류·후속 항목

- `runParallel` 이 `ParallelResult.failures` 를 전혀 소비하지 않는 결함(SUMMARY C5 리포트에 언급된 별개 문제) — 이번 범위 밖으로 명시 지시받아 조치하지 않음. `plan/in-progress/node-cancellation-residual-signal-propagation.md` 백로그 절에 기록.
- `ParallelExecutor` `errorPolicy:'stop'` 의 `failures[0]` branch-index 우선순위 레이스(INFO) — 같은 백로그 절에 기록. 발생 빈도 낮아 승급 보류.
- W10 스로틀 트레이드오프(250ms 관측 지연이 §5 best-effort 계약상 무해하다는 근거 + 대안 기각 사유) — `plan/in-progress/node-cancellation-residual-signal-propagation.md` "트레이드오프 — 아이템 경계 cancel 가드 스로틀" 절에 상세 기록.
