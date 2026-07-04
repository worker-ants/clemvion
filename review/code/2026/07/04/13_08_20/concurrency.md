# 동시성(Concurrency) Review — exec-intake-pr4-stalled

## 스코프

`execution-run` 큐 BullMQ stalled 자동 재배달 도입(PR4): `maxStalledCount:0→1`,
`runExecutionFromQueue` 3-way 분기(PENDING/RUNNING/terminal), `finalizeStalledExhausted`
(stalled 소진 dead-letter 마감), `ExecutionRunDlqMonitorService`(관측성), e2e `_test` 훅.

관련 파일:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`
- `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts`
- `codebase/backend/src/modules/executions/executions.controller.ts`
- `codebase/backend/test/execution-stalled-redelivery.e2e-spec.ts`

## 발견사항

### [INFO] `maxStalledCount:1` bound 는 명목상 "1회 재구동"이지만 blast radius 는 최대 2회 실행

- 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:918` (`EXECUTION_RUN_MAX_STALLED_COUNT = 1`), `execution-run.processor.ts:32-36`
- 상세: BullMQ 의미상 `maxStalledCount:1` 은 "job 이 stalled 로 검출된 뒤 최대 1회 재배달, 그 다음 다시 stall 하면 failed" 다. 즉 최초 실행 + 재배달 1회 = 최대 2회의 `redriveStuckExecution`/`runExecution` 세그먼트 진입이 가능하다. 코드 주석(`execution-run.queue.ts:913`)은 이를 "blast radius = `maxStalledCount+1`"로 정확히 문서화하고 있어 계산 자체는 맞다. 다만 이 경계는 **BullMQ job-level에서만** 강제되고, "RUNNING-at-crash 비멱등 노드"(Integration write 등)의 재실행 여부는 `skipExecutedNodes`(§7.3, 완료 노드만 skip)에 의존한다 — 크래시 시점에 이미 실행 중이던(RUNNING) 단일 노드 자체가 비멱등이면 재구동 시 다시 실행된다는 점이 spec 상 "수용된 trade-off"로 명시돼 있으나(§Rationale), 리뷰 관점에서는 실제 노출면이 여전히 존재함을 재확인.
- 제안: 코드/spec 상 이미 문서화된 trade-off이므로 조치 불요. 다만 향후 인프라 변경 시 `maxStalledCount` 값과 "at-least-once 재실행 허용 노드 타입" 화이트리스트가 함께 검토되어야 함을 재확인차 기록.

### [INFO] `finalizeStalledExhausted` 조건부 UPDATE의 원자성은 견고 — 이중 실행 시나리오 3갈래 모두 no-op 안전

- 위치: `execution-engine.service.ts:2754-2803` (`finalizeStalledExhausted`)
- 상세: `WHERE id=:id AND status='running'` 단일 조건부 UPDATE + `affected===0` 이면 조기 return. `execution-run.processor.ts:807-831` (`onFailed`)에서 실행되는 두 경로(setup-throw 이미 terminal / stalled 소진 RUNNING 잔류)를 이 WHERE 절 하나로 정확히 분기한다. `redriveStuckExecution`이 이미 COMPLETED/FAILED/WAITING_FOR_INPUT으로 전이시킨 뒤 `onFailed`가 뒤늦게 호출돼도 `affected=0`→no-op이라 cascade emit이 발생하지 않는다. 원자성 측면에서 CRITICAL/WARNING 없음.
- 참고: `finalizeRehydrationCleanup(executionId)` (context Map 삭제 + LLM config 캐시 삭제)는 멱등(Map 미존재 시 no-op, `execution-context.service.ts:267` 확인)이라 `redriveStuckExecution`의 `finally` 블록과 순서 상관없이 중복 호출돼도 안전.

### [INFO] zombie(hung, non-crashed) 워커 재배달 — in-flight 노드 단위 fencing 부재는 기존 노출면, 신규 회귀 아님

- 위치: `execution-engine.service.ts:2866-2869` (`redriveStuckExecution` 주석 "⚠️ zombie 잔여 race")
- 상세: BullMQ stalled 판정은 lock 갱신 타임아웃(`stalledInterval:30_000`, `execution-run.queue.ts:920-925`) 기준이라, 네트워크 단절로 lock 갱신에 실패했을 뿐 실제로는 아직 살아서 노드를 처리 중인 워커가 나중에 부활하는 "zombie 이중 구동" 창이 이론상 존재한다. 두 워커(원 워커 부활 + 재배달받은 새 워커)가 동시에 같은 executionId 에 대해 `redriveStuckExecution`/`runExecution`을 구동할 수 있다. 코드 주석은 이를 "PR4 BullMQ stalled로 완결하되 in-flight 노드 단위 fencing은 없음, 현행 fail-path와 동일 노출 — 신규 회귀 아님"이라 명시적으로 인정한다. `failOrphanRunningNodeExecutions`(RUNNING NodeExecution FAILED cascade, `execution-engine.service.ts:2724-2742`)와 `skipExecutedNodes`(완료 노드만 skip)가 완화하지만, "crash 시점 RUNNING이었던 단일 노드"가 원 워커에 의해 마저 실행 완료되는 동시에 새 워커가 그 노드를 FAILED로 orphan-cascade 마킹 → 이후 재실행하는 race는 이론상 남는다.
- 리뷰 판단: 이 자체는 이번 diff가 새로 만든 결함이 아니라 기존 §7.5 case B 인프라(PR3)에 내재한 노출면을 stalled 자동 트리거로 확장한 것이며, 코드/spec이 이를 "at-least-once 수용 경계"로 명시적으로 인정하고 있어 CRITICAL로 상향하지 않음. BullMQ job lock이 "동일 job 처리"에 대한 주 fence 역할을 하고, 진짜 위험(zombie 워커 부활)은 극히 드문 타이밍 창이자 문서화된 trade-off.
- 제안: 조치 불요(설계상 수용). 후속 검토 시 in-flight 노드 단위 fencing(예: NodeExecution에 워커 인스턴스 ID + lock 토큰 기록) 도입 여부를 별도 후속 아이템으로 추적 권장.

### [INFO] `_test/simulate-execution-run-redelivery` 훅은 BullMQ job lock 없이 직접 `runExecutionFromQueue` 호출 — 프로덕션 미노출이나 RUNNING-branch 재진입 가드가 순수 in-process 재조회 한 번뿐

- 위치: `codebase/backend/src/modules/executions/executions.controller.ts:232-244`, `execution-engine.service.ts:3121-3151` (`runExecutionFromQueue` RUNNING 분기)
- 상세: 정식 경로(BullMQ worker)에서는 동일 jobId에 대한 job lock이 "동시 두 워커가 같은 job을 동시에 process()하지 않는다"를 보장한다(F2, plan 명시). 그러나 이 e2e 전용 endpoint는 BullMQ를 거치지 않고 `runExecutionFromQueue`를 직접 호출하므로 그 lock 보호가 전혀 없다. 만약 이 endpoint가 동일 executionId에 대해 연속 두 번 빠르게 호출되면(또는 실제 stalled 재배달과 동시에), 두 호출 모두 `findOneBy`로 RUNNING을 읽고 각각 `redriveStuckExecution`을 fire-and-forget으로 구동해 **동일 executionId에 대한 중복 그래프 드라이브**가 발생할 수 있다. `redriveStuckExecution` 내부에 자체 원자 claim이 없고(§7.5 case B 재구동은 재조회 1회만), `updateExecutionStatus`의 조건부 UPDATE(`status IN (비-terminal)`)가 최종 완료/실패 시점의 lost-update만 막을 뿐, 중간 `runNodeDispatchLoop`의 노드 dispatch 자체는 두 인스턴스가 각각 진행할 수 있다(§7.3 `skipExecutedNodes`가 "완료된" 노드만 걸러내므로, 두 호출이 거의 동시에 시작하면 서로 상대방이 아직 완료 처리하지 않은 노드를 함께 재실행 가능).
- 영향 범위: `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트 + `@Roles('owner')`로 프로덕션에는 노출되지 않는다(컨트롤러 주석에 명시). e2e 테스트 자체는 단일 호출만 수행(`execution-stalled-redelivery.e2e-spec.ts:235-242`)해 실제 테스트 스위트에서 이 race가 트리거되지는 않는다.
- 제안: 현재 위험도는 낮음(test-only, 단일 호출 사용). 그러나 향후 이 훅을 재사용해 "동시 재배달" 시나리오 자체를 테스트하려는 시도가 있다면, 훅 자체가 BullMQ lock을 대체하지 못한다는 점을 인지해야 한다. 원한다면 훅에 in-process 실행-중 가드(예: `Set<executionId>`로 동일 ID 재진입 거부)를 추가해 test harness 오용을 방지할 수 있음(강제는 아님, INFO).

### [INFO] `ExecutionRunDlqMonitorService.checkOnce` in-flight 가드 — 정상 구현, 경합 없음

- 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts:610-691`
- 상세: `this.checking` boolean 가드로 tick 겹침(setInterval의 이전 tick이 아직 진행 중인데 새 tick 시작)을 방지한다. Node.js 단일 스레드 이벤트 루프 특성상 `this.checking = true` 설정과 확인 사이에 인터리빙이 불가능하므로(동기 코드 블록) 안전한 패턴이다. `try/finally`로 `checking = false` 복원이 보장되어 예외 발생 시에도 데드락(영구 `checking=true` 잔류)이 없다. `lastAlarmAt` cooldown 갱신도 단일 스레드 내 순차 실행이라 race 없음.
- 판단: 문제 없음, 우수 사례로 기록.

### [INFO] `ExecutionRunDlqMonitorService` 인스턴스별 독립 타이머 — 멀티인스턴스 배포 시 알람 cooldown이 인스턴스마다 개별 적용됨

- 위치: `execution-run-dlq-monitor.service.ts:618-632` (`onModuleInit`, `setInterval`)
- 상세: `lastAlarmAt`은 프로세스-로컬 상태(인스턴스 멤버 변수)이며 분산 락이나 공유 저장소가 없다. 멀티 backend 인스턴스 배포 시 각 인스턴스가 독립적으로 동일 큐의 depth를 폴링하고 각자의 cooldown을 적용하므로, 전체 시스템 관점에서는 알람이 인스턴스 수만큼 중복 발생할 수 있다(단일 인스턴스 cooldown 5분이어도 N개 인스턴스면 최악 5분/N 간격으로 알람 로그 발생). `ContinuationDlqMonitorService`(기존 continuation 큐 모니터)와 "동일 패턴"이라고 명시돼 있어 기존 설계를 그대로 답습한 것.
- 영향: 로그 alarm 중복 발생(structured `logger.error`)일 뿐 데이터 정합성에는 영향 없음 — 순수 관측성 기능이라 CRITICAL/WARNING 아님.
- 제안: 기존 `ContinuationDlqMonitorService`와 동일 trade-off를 그대로 따르는 설계 결정이므로 이번 PR 범위에서 조치 불요. 필요 시 향후 분산 cooldown(Redis 기반) 공통 개선을 별도 검토.

### [INFO] `EXECUTION_RUN_STALLED_INTERVAL_MS = 30_000`과 워커 dispatch 루프의 실질 실행 시간 정합성은 코드 리뷰 범위 밖(런타임 튜닝 사항)

- 위치: `execution-run.queue.ts:920-925`
- 상세: 30초 stalled 감지 주기는 BullMQ 기본값과 동일하다는 주석이 있다. 노드 dispatch(특히 장시간 실행 Integration/AI 노드)가 lock-renew보다 오래 걸리는 경우 실제로 살아있는 워커도 stalled로 오판되어 불필요한 재구동이 트리거될 수 있다. 이는 BullMQ worker의 lock-renewal(기본적으로 workerHost가 자동 갱신)이 별도로 동작하는 한 실질적 문제가 아니며, 이번 diff가 새로 도입한 결함이 아니라 KB `graph-extraction.processor` 선례를 따른 것이다.
- 제안: 조치 불요, 참고 기록만.

## 요약

이번 PR4는 BullMQ native stalled-job 재배달(`maxStalledCount:0→1`)을 도입해 `runExecutionFromQueue`에 RUNNING 분기(§7.5 case B 재구동 재사용)를 추가하고, 소진 시 `finalizeStalledExhausted`가 **status='running' 조건부 UPDATE**로 안전하게 terminal 마감한다. 핵심 동시성 안전장치 세 가지 — (1) `finalizeStalledExhausted`의 조건부 UPDATE(WHERE status='running')를 통한 setup-throw/stalled-소진 두 경로의 자연 분기, (2) BullMQ job lock을 주 fence로 삼아 별도 DB claim을 생략하는 설계, (3) `updateExecutionStatus`의 non-terminal 가드 조건부 UPDATE(기존 M-3 패턴 재사용) — 는 모두 견고하게 구현되어 있고 CRITICAL/WARNING 급 결함은 발견되지 않았다. 유일하게 실질적으로 주목할 지점은 e2e 전용 `_test/simulate-execution-run-redelivery` 훅이 BullMQ job lock 없이 `runExecutionFromQueue`를 직접 호출해 동일 executionId에 대한 이론적 중복 드라이브 창을 열지만, 이는 이중 env 게이트(NODE_ENV=test && E2E_TEST_HOOKS=1) + owner 권한으로 프로덕션에 노출되지 않고 실제 e2e 스펙도 단일 호출만 수행한다. zombie(hung, 실제로 안 죽은) 워커의 이중 구동 잔여 race는 코드/spec이 스스로 "기존 노출면, 신규 회귀 아님"으로 명시하고 있으며 리뷰 결과도 이에 동의한다. 전반적으로 동시성 설계 의도(원자적 조건부 UPDATE, BullMQ lock 의존, 멱등 skip 가드)가 코드와 주석에 일관되게 반영되어 있다.

## 위험도

LOW

STATUS: SUCCESS
