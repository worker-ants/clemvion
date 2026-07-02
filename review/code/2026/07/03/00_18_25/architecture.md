# 아키텍처(Architecture) Review — 06 C-2 재개 진입 DB 원자 claim

## 발견사항

- **[WARNING]** claim 후 crash 로 stuck `RUNNING` NodeExecution 을 회수하는 배치/복구 경로가 실제로는 없음 (문서상 주장과 코드 불일치)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:685-696`(`recoverStuckExecutions` 호출부), `:2498`(`recoverStuckExecutions` 본문), `:839-850`(`claimResumeEntry` JSDoc)
  - 상세: `claimResumeEntry` JSDoc 및 `plan/in-progress/spec-draft-c2-atomic-claim.md` 의 Rationale 은 "claim 후 worker crash 로 남은 `running` row 는 §7.4 `recoverStuckExecutions`(RUNNING 대상)가 회수한다"고 명시한다. 그러나 `recoverStuckExecutions`(L2498)는 `this.executionRepository` — 즉 **`Execution`** 엔티티(부모)의 `status=RUNNING` & `started_at < staleThreshold` 만 갱신하며, `NodeExecutionStatus.RUNNING` 을 다루는 배치 경로는 코드베이스 어디에도 없다(`grep` 결과 `NodeExecution` 대상 RUNNING 갱신은 `markNodeExecutionFailed`(명시적 호출 경로만) 와 `markSpawnedRowFailedOnPublishError`(retry 전용, `spawnedNodeExecutionId` 단건)뿐). `claimResumeEntry` 가 `NodeExecution.status` 를 `waiting_for_input → running` 으로 원자 전이시킨 뒤, rehydration 로직이 `markNodeExecutionFailed` 호출 전에 프로세스가 죽으면(예: worker OOM/kill) 그 `NodeExecution` row 는 **`RUNNING` 에 무기한 stuck** 되고, 상위 `Execution` 이 `staleThreshold`(RUNNING 경과시간) 조건을 만족해 `recoverStuckExecutions` 가 부모를 `FAILED` 로 옮기더라도 자식 `NodeExecution` row 는 여전히 `RUNNING` 으로 남는다(별도 cascading update 없음, `:2519-2534` 갱신 대상은 `Execution` 테이블 단독). 이는 이번 diff 가 새로 만든 "claim 성공 후 실패" 실패 모드에 대한 실제 방어망이 코드에 없다는 뜻이며, 문서(JSDoc/스펙초안)의 주장이 구현을 앞서가는(spec-drift) 상태다.
  - 제안: (a) `recoverStuckExecutions` 를 `NodeExecution.status=RUNNING` & 경과시간 기준까지 포함하도록 확장하거나, (b) `Execution` 복구 시 자식 `NodeExecution` RUNNING row 를 cascading 으로 함께 FAILED 처리하는 로직을 추가하고, (c) JSDoc/spec-draft 문구를 실제 구현 범위에 맞게 정정한다. 이 gap 은 `plan/in-progress/spec-draft-c2-atomic-claim.md` 의 착수 조건("동일 실행 2회 동시 재개 unit + dockerized e2e")에도 crash-recovery 케이스가 빠져 있어 회귀 테스트로도 잡히지 않는다.

- **[INFO]** `claimResumeEntry` 가 이중 책임(원자 claim 실행 + `__no_node_exec__`/빈 id legacy 우회)을 한 메서드에 담고 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:843-864`
  - 상세: 기존 `isNodeExecutionWaiting` 도 동일 구조였으므로 새 회귀는 아니나, "원자 claim" 이라는 이름이 암시하는 단일 책임과 "legacy bypass(unconditional true)" 라는 별개 관심사가 한 함수에 공존한다. `nodeExecutionId` 가 없는 케이스는 원래 "가드 자체가 의미 없는" 경로이므로 이 자체는 정당한 단축이지만, 향후 claim 정책이 복잡해질수록(예: 재시도 backoff, claim TTL) 이 조기 return 이 새 로직을 우회하는 사각지대가 될 수 있다.
  - 제안: 현재로선 조치 불필요. 향후 claim 로직이 확장되면 guard 분리(`isLegacyBypass(id)` 헬퍼 등)를 고려.

- **[INFO]** `markNodeExecutionFailed` 의 `status IN (WAITING_FOR_INPUT, RUNNING)` 확장은 claim 패턴과 정합적
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2421-2434`
  - 상세: claim 이 `WAITING_FOR_INPUT → RUNNING` 전이를 도입했으므로, 실패 시 롤백 대상에 `RUNNING` 을 추가한 것은 claim-then-fail 시나리오의 필요조건이며 idempotent 원자 UPDATE(`status IN (...)`) 패턴도 기존 `_retryState`/`isNodeExecutionWaiting` 계열과 일관된 스타일이다. 코드 자체의 설계는 건전하다 — 위 WARNING 은 이 롤백이 "호출되는 경로가 실제로 실행될 것"이라는 전제(즉 rehydration 실패가 예외로 catch 되어 `markNodeExecutionFailed` 까지 도달하는 케이스)에는 맞지만, "프로세스 자체가 죽는" 케이스는 애초에 이 함수 호출 자체가 불가능하므로 별도 배치 복구가 필요하다는 것이 핵심이다.

- **[INFO]** 레이어 책임/응집도는 양호 — 원자성 관심사가 `ExecutionEngineService`(도메인 서비스) 내부에 캡슐화되고, `ContinuationExecutionProcessor`(큐 consumer/프레젠테이션에 가까운 레이어)는 `claimResumeEntry` 라는 boolean 계약만 소비
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts:387-395`
  - 상세: processor 는 claim 성공/실패라는 결과만 보고 ack-and-discard 여부를 결정할 뿐, DB 원자성 구현(QueryBuilder, WHERE 절 등)에 전혀 관여하지 않는다. 이는 처리기(오케스트레이션)와 서비스(도메인 로직)의 책임 분리가 명확히 유지된 리네이밍 중심 변경으로, 이번 diff 의 구조적 위험은 낮다. 메서드명 변경(`isNodeExecutionWaiting` → `claimResumeEntry`)도 "조회"에서 "명령(claim)"으로 의미가 바뀐 것을 정확히 반영해 인터페이스 가독성이 개선됐다.

- **[INFO]** `retry_last_turn` 분기가 `claimResumeEntry` 가드를 우회하는 것은 기존 결정(C-1 후속 ④, engine→Retry 순환 DI 제거)의 연장선이며 이번 diff 로 인한 신규 결합도 이슈 아님
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts:384-395`
  - 상세: `RetryTurnService.applyRetryLastTurn` 내부에서 자체 RUNNING 검증을 수행한다는 주석이 있으나, 이번 diff 범위(claim 관련 파일)에는 `RetryTurnService` 자체 변경이 포함되지 않아 그 자체 가드가 claim 패턴과 일관된 원자성(조건부 UPDATE)을 쓰는지는 이 리뷰 대상 밖. 별도 확인 권장 사항으로만 기록.

## 요약

이번 변경은 `isNodeExecutionWaiting`(비원자 SELECT check-then-act) 를 `claimResumeEntry`(조건부 UPDATE 기반 원자 claim) 로 교체해 멀티 인스턴스/동시성 상향 상황에서의 "동일 turn 이중 실행" race 를 구조적으로 제거한다는 점에서 설계 방향은 견고하다. Processor(오케스트레이션 레이어)와 Service(도메인 레이어) 간 책임 분리, 명명 변경의 의미 정합성, `markNodeExecutionFailed` 롤백 대상 확장(RUNNING 추가) 등은 기존 원자적 UPDATE 관례(`_retryState` 패턴)의 자연스러운 일반화로 SOLID/응집도 관점에서 문제가 없다. 다만 이 patch 가 새로 만들어낸 "claim 성공 후 rehydration 프로세스가 죽는" 실패 모드에 대해, JSDoc 과 spec-draft 가 `recoverStuckExecutions` 가 이를 회수한다고 주장하지만 실제로는 `Execution`(부모) 레벨만 다루고 `NodeExecution`(자식) RUNNING row 에 대한 배치 복구 경로가 코드에 존재하지 않는다 — 이는 설계 문서와 구현 간의 실질적 gap 이며, 운영 환경에서 worker crash 시 stuck `RUNNING` NodeExecution row 가 영구 잔존할 수 있는 신뢰성 리스크로 이어진다.

## 위험도

MEDIUM
