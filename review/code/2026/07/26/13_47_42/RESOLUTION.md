# RESOLUTION — review/code/2026/07/26/13_47_42 (3R)

3R SUMMARY 의 **Critical 0 / WARNING 5건(W14~W18)** + INFO 정정 처리. 조치 커밋 `2ca6ada66`.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 확인 |
| --- | --- | --- | --- |
| **W14** | 코드 | `executeBackgroundSubgraph` 의 `finally` 에 `containerCancelCheckedAtMs.delete(job.executionId)` 추가. Background 본문은 부모와 **같은 executionId** 를 공유하는데 fire-and-forget 이라 부모 `finally` 가 먼저 지운 뒤 다시 `set()` 되어 영구 잔류했다(싱글턴 서비스 필드 = 무한 성장 누수) | `execution-engine.service.ts:6951`. 정리 지점이 2곳(`:2670`·`:4544`)에서 **3곳**으로 |
| **W15** | 코드 | `executeNode` 의 generic catch 에 `if (err instanceof ExecutionCancelledError) throw err;` 를 **FAILED 마킹·`NODE_FAILED` emit 보다 앞에** 추가(W9 와 대칭). `workflow.handler.ts` 의 C1 재throw 가 `executeNode` try 안에서 발생해 이 catch 로 떨어지던 경로를 닫았다 — Sub-Workflow 노드가 취소를 `failed` 로 오분류하고 내부 message(executionId 포함)를 WS 로 방출하던 문제 | `execution-engine.service.ts` `executeNode` catch |
| **W16** | 코드 | `retry-turn.service.ts` 의 `execution.error` 대입을 `!isCancelled` 로 가드. 기존 `isCancelled` 판정(`:642`)을 재사용해 **WS emit 과 DB 저장 정책을 일치**시켰다(WS 는 이미 취소 시 `error` 를 제외하고 있었는데 DB 저장만 무조건이라 REST `GET /executions/:id` 로 내부 message 가 노출됐다) | `retry-turn.service.ts:641-651` |
| **W17** | 테스트 | 스로틀 회귀 테스트를 `jest.spyOn(Date,'now')` 로 결정화(자매 C3 테스트와 동일 패턴). 기존에는 wall-clock 의존이라 **40회 반복 중 3회 flake** 했고, 실패 시그니처(`findOne` 11회)가 "스로틀이 아예 없음" 과 구분되지 않았다 | `execution-engine.service.spec.ts:10196` |
| **W18** | 테스트 | 스로틀 Map 정리 회귀 테스트 신설 — 실행 종료 후 `containerCancelCheckedAtMs` 에서 executionId 키 제거를 단언. **W14 의 Background 공유 executionId 경로를 직접 커버**한다. 기존에는 두 `delete` 를 모두 제거해도 415/415 GREEN 이었다 | `execution-engine.service.spec.ts:3747` (`cleans up containerCancelCheckedAtMs ... (W14 background leak regression)`) |
| INFO | 문서 | plan 의 "best-effort" 인용을 §5 → **§2.2** 로 정정(§5 본문에 그 단어가 없었다). CHANGELOG·테스트 주석에 실채택 **250ms** 명시 | `plan/in-progress/node-cancellation-residual-signal-propagation.md` · `CHANGELOG.md` |

### 미조치 (의도)

- `ParallelExecutor` `'stop'` 정책의 `failures[0]` branch-index 우선순위 레이스 — INFO, 백로그 기록됨.
- `runParallel` 이 `ParallelResult.failures` 를 소비하지 않는 문제 — 2R 에서 범위 밖 판정, 백로그.
- `opts?.throttle` 2회 평가 · `Date.now` spy 의 `try/finally` 미사용 · `ExecutionCancelledError` message 인자 전용 테스트 — 전부 INFO, 저위험.
- **spec 본문 갱신(§2.3/§5.1/§6 + `code:`)은 developer 권한 밖** — `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-26 #6)" 로 project-planner 위임 유지.

## TEST 결과

조치 커밋 `2ca6ada66`(14:22:34) 기준.

- lint  : 통과 — `run-test.sh lint` PASS (`_test_logs/lint-20260726-144155.log`, 커밋 이후 재실행)
- unit  : 통과 — `run-test.sh unit` PASS (`_test_logs/unit-20260726-144246.log`, 커밋 이후 재실행).
  추가로 변경 표면을 직접 겨냥해 `npx jest src/modules/execution-engine/ src/nodes/flow/workflow/` 실행 —
  **43 suites / 1120 tests 전부 통과**(wrapper 의 `tests=14` 는 내부 패키지 집계라 엔진 스위트를 포함하지 않으므로 별도 확인)
- build : 통과 — `run-test.sh build` PASS (`_test_logs/build-20260726-142238.log`)
- e2e   : 통과 — `run-test.sh e2e` PASS, **46 suites / 259 tests** 전부 통과.
  `test/node-cancellation-propagation.e2e-spec.ts` PASS (18.981s) 포함.
  로그 `_test_logs/e2e-20260726-143658.log` (마지막 코드 커밋 이후 실행)

## 비고 — 본 RESOLUTION 의 작성 경위

`resolution-applier` sub-agent 가 코드·테스트 조치와 커밋(`2ca6ada66`)까지 완료했으나, e2e 대기 단계에서 두 차례 결과 없이 반환해 RESOLUTION.md 를 남기지 못했다. 호출자(main)가 e2e 완료를 직접 확인하고, W14~W18 조치가 실제 소스에 반영됐는지 파일별로 대조한 뒤 본 문서를 작성했다. 위 표의 "확인" 열은 전부 main 이 직접 grep/Read 로 검증한 결과다.
