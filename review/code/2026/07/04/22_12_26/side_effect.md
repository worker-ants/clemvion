# 부작용(Side Effect) Review — orphan pending backstop

## 발견사항

- **[INFO]** `recoverStuckExecutions` 부팅 경로(`onApplicationBootstrap`)는 여전히 예외를 캐치하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:746-751` (`onApplicationBootstrap` → `await this.recoverStuckExecutions();`)
  - 상세: `recoverOrphanPendingExecutions()` 호출이 `try` 블록 안, `finally`(lock release) 이전에 추가되었다. `reclaimStuckRunningExecution`(기존 stale-RUNNING re-claim)이 throw 하면 새로 추가된 orphan pending 스캔은 실행되지 않고 곧바로 `finally`(lock 해제)로 넘어가 예외가 그대로 propagate 된다 — 이는 이번 diff 가 의도한 그대로다(prompt 기대와 일치). 다만 이 propagate 자체는 기존에도 존재하던 특성으로, `onApplicationBootstrap`이 이를 캐치하지 않으므로 예외 시 애플리케이션 부팅이 실패한다. 이번 변경으로 신규 도입된 리스크는 아니며(기존 코드에도 동일한 무보호 구조가 있었음), 회귀는 아니다.
  - 제안: 없음(pre-existing 특성, 이번 변경 범위 밖). 참고용으로만 기록.

- **[INFO]** `markQueueWaitTimeout`가 내부에서 모든 예외를 삼키는 구조라 `recoverOrphanPendingExecutions`의 순차 `for...of` 루프가 중단되지 않음을 확인
  - 위치: `execution-engine.service.ts:2559-2602` (`markQueueWaitTimeout`), `2906-2923` (`recoverOrphanPendingExecutions`)
  - 상세: `markQueueWaitTimeout`은 DB UPDATE·이벤트 emit·routing release 전체를 하나의 `try/catch`로 감싸고 있어 어떤 이유로든 실패해도 reject 하지 않는다. 따라서 다건 orphan 회수 시 한 건이 실패해도 나머지 순회는 계속되고, 상위 `recoverStuckExecutions`의 `try` 블록도 중단되지 않는다 — 의도된 best-effort 동작과 일치.
  - 제안: 없음(확인 목적의 기록).

## 검증 결과 (요청 4항목)

1. **stale-running redrive 동작 불변 (reclaimedIds.length > 0 케이스)**: 확인됨. `if (reclaimedIds.length === 0) return;` → `if (reclaimedIds.length > 0) { ... }`로 바뀌었을 뿐, 블록 내부 로직(warn 로그, fire-and-forget `redriveStuckExecution` 호출 + `.catch` 방어)은 완전히 동일하게 옮겨졌다. 조건 반전 리팩터일 뿐 동작 변경 없음.
2. **lock 은 모든 경로에서 finally 로 해제**: 확인됨. `recoverOrphanPendingExecutions()` 호출이 기존 `try` 블록 끝에 추가되었고, `finally { await this.continuationBus.releaseLock(RECOVERY_LOCK_KEY); }`는 위치·구조 변경 없이 그대로 유지된다. reclaim 성공/실패, orphan scan 성공/실패 어느 경로든 `finally`를 거치므로 lock 해제가 보장된다.
3. **reclaim이 throw 하는 경로**: 확인됨. `reclaimStuckRunningExecution` 호출이 `if` 분기보다 앞에 위치하므로, 이 호출이 throw 하면 `if` 블록도 신규 `recoverOrphanPendingExecutions()` 호출도 도달하지 않고 곧장 `finally`(lock 해제)로 이동 후 예외가 `recoverStuckExecutions` 호출자에게 propagate 된다. Orphan 스캔은 스킵됨 — 요청된 기대와 일치.
4. **`markQueueWaitTimeout` 재사용 시 orphan 건별 emit**: 확인됨. `recoverOrphanPendingExecutions`의 `for (const { id } of orphans) { await this.markQueueWaitTimeout(id); }` 루프가 orphan 건마다 순차 호출하며, `markQueueWaitTimeout` 내부에서 조건부 UPDATE(affected>0)일 때만 `EXECUTION_CANCELLED` emit + `releaseExecutionRouting(executionId)`를 수행한다(기존 로직 그대로 재사용, 변경 없음). 신규 호출 경로 추가는 있으나 함수 자체의 부작용 시그니처(이벤트 emit·라우팅 해제)는 변하지 않았다.

## 기타 관점 점검

- **전역 상태/전역 변수**: 신규 전역 변수 없음. `LessThan` import 추가는 typeorm 표준 연산자 사용으로 부작용 없음.
- **시그니처 변경**: `recoverStuckExecutions()`(private, 반환형 `Promise<void>` 불변), `runStuckRecoveryScan()`(public, 호출부 `executions.controller.ts`의 e2e 전용 테스트훅, 시그니처 불변) 모두 외부 계약 변경 없음. 신규 `private recoverOrphanPendingExecutions()`는 내부 전용이라 외부 호출자 영향 없음.
- **공개 API**: 변경 없음. `_test/recover-stuck-executions` 엔드포인트(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트 + `@Roles('owner')`)는 이번 diff 대상이 아니며 기존 그대로.
- **파일시스템 부작용**: 없음. DB read(`find`)/update(`markQueueWaitTimeout` 내부 UPDATE)만 발생, 신규 파일 I/O 없음.
- **환경 변수**: 신규 env 읽기/쓰기 없음. `resolveQueueWaitTimeoutMs()`는 기존 §8 admission 로직이 이미 사용하던 헬퍼 재사용(diff 범위 밖).
- **네트워크 호출**: 신규 외부 서비스 호출 없음. `continuationBus.acquireLock/releaseLock`은 기존 Redis 기반 lock 재사용, 신규 호출처 없음.
- **이벤트/콜백 변경**: `recoverStuckExecutions`가 호출하는 이벤트 표면이 넓어짐 — 이전에는 stale RUNNING 이 0건이면 어떤 이벤트도 발생하지 않았으나, 이제는 (running 재점유 유무와 무관하게) orphan pending 이 있으면 매 부팅/테스트훅 호출마다 `EXECUTION_CANCELLED` 이벤트가 orphan 건수만큼 추가로 발생할 수 있다. 이는 diff 의 명시적 의도(§8 backstop 도입)이며 spec·plan·consistency-check(BLOCK: NO)로 사전 합의된 변경이라 부작용이라기보다 의도된 신규 기능이다. 다만 리뷰 관점에서 기록: 이 경로를 구독하는 클라이언트(WS)는 이제 부팅/테스트훅 호출마다 추가로 `execution.cancelled` 알림을 받을 수 있음을 인지해야 한다(설계상 원하는 동작).

## 요약

핵심 리팩터는 `if (reclaimedIds.length === 0) return;` 조건 반전(`if (length > 0) { ... }`)과 그 뒤에 `recoverOrphanPendingExecutions()` 호출 추가뿐이며, 기존 stale-RUNNING re-drive 로직·`finally`의 lock 해제 위치·`markQueueWaitTimeout`의 조건부 UPDATE+이벤트 emit+라우팅 해제 부작용은 모두 그대로 보존된다. reclaim 단계에서 예외가 발생하면 orphan 스캔은 스킵되고 lock 은 `finally`에서 정상 해제되며 예외는 상위로 전파된다(요청 시나리오와 일치, 회귀 없음). 새로 추가된 부작용은 "running 재점유 여부와 무관하게 매 스캔마다 orphan pending 건수만큼 `EXECUTION_CANCELLED` 이벤트가 추가로 발생할 수 있다"는 점인데, 이는 §8 backstop 기능의 의도된 확장이고 spec/plan/consistency-check 로 사전 합의되어 있어 "의도치 않은" 부작용으로 분류되지 않는다. 전역 상태·파일시스템·환경변수·네트워크·공개 시그니처 어느 쪽에서도 새로운 위험 요소는 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
