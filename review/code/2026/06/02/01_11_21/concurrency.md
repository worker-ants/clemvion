# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] `cancel` 케이스 fire-and-forget — await 누락
- 위치: `continuation-execution.processor.ts` L422–424
- 상세: `case 'cancel':` 에서 `applyCancellation` 을 `void this.engine.applyCancellation(executionId)` 로 처리하고 있다. 코드 주석 자체가 "TODO: async 전환 시 `void` 제거 후 `await` 복원 필요"라고 명시하고 있다. worker concurrency 가 1일 때는 해당 job 이 처리되는 동안 다음 job 을 pick up 하지 않으므로 실질적 영향이 거의 없지만, `CONTINUATION_WORKER_CONCURRENCY` 를 2 이상으로 상향하면 cancel 처리 중 다른 continuation job(resume/ai_message 등)이 동시에 처리될 수 있다. `applyCancellation` 의 완료를 기다리지 않는 상태에서 다른 worker slot 이 동일 executionId 에 대한 `continue` job 을 pick up 하면, cancel 이 완료되기 전에 resume 코루틴이 진행되는 race window 가 생긴다.
- 제안: concurrency 상향 전에 반드시 `void` 를 제거하고 `await this.engine.applyCancellation(executionId)` 로 전환할 것. 현재 기본값 1 이 유지되는 동안은 LOW 실영향이지만, env 조정으로 concurrency 가 올라가면 즉시 경쟁 조건이 발생하므로 TODO 를 명시적 이슈로 tracking 해야 한다.

### [INFO] concurrency > 1 시 동일 executionId 에 대한 멱등 가드 범위 확인 필요
- 위치: `continuation-execution.processor.ts` L399–408
- 상세: `isNodeExecutionWaiting` 으로 사전 상태 재검증을 수행하지만 이 검증과 실제 `applyContinuation` 호출 사이에는 check-then-act 간격이 있다. concurrency = 1(기본값)일 때는 동일 worker 가 순차 처리하므로 문제 없다. concurrency 를 올렸을 때 **서로 다른 nodeExecutionId** 를 가진 두 job 이 동시에 처리되는 것은 정상이고 DB 멱등 가드로 커버된다. 그러나 만약 동일 nodeExecutionId 에 대한 두 job 이 (시퀀스 seq 가 다른 두 enqueue) 동시 pick up 될 경우 두 job 모두 `isNodeExecutionWaiting = true` 를 보고 진행할 수 있다. 이 경우 spec §7.3 의 "Worker는 실행 전 taskId 중복 확인" 과 BullMQ jobId 단조 증가 규약이 1차 방어이고, `NodeExecution.status` 저장 시 DB upsert/conditional-update 가 2차 방어라면 충분하나, 해당 저장 경로의 원자성이 코드 레벨에서 명시되어 있는지 확인이 권장된다.
- 제안: `applyContinuation` 내부에서 `NodeExecution.status` 를 `waiting_for_input → completed` 로 업데이트할 때 optimistic/conditional UPDATE (`WHERE status = 'waiting_for_input'`) 가 적용되어 있음을 확인하거나, 코드 주석에 그 의도를 명시한다. 이미 구현되어 있다면 INFO 수준, 없다면 WARNING 으로 상향.

### [INFO] `resolveContinuationWorkerConcurrency` 는 모듈 로드 시점 1회 평가
- 위치: `continuation-execution.queue.ts` L531–542, `continuation-execution.processor.ts` L374–376
- 상세: `@Processor` 데코레이터 인자가 모듈 초기화 시점에 한 번만 평가된다는 점이 코드 주석에 정확히 설명되어 있다. 이는 올바른 설계이며 동시성 문제가 없다. 다만 런타임 중 env 를 변경해도 worker concurrency 가 반영되지 않는다는 운영 주의가 문서에 명시되어 있으면 좋다(env 변경은 재배포 필요).
- 제안: `.env.example` 코멘트에 "변경 시 인스턴스 재시작 필요" 한 줄 추가를 검토.

## 요약

이번 변경은 `ContinuationExecutionProcessor` 의 BullMQ worker concurrency 를 하드코딩 1에서 `CONTINUATION_WORKER_CONCURRENCY` 환경변수로 외부화하는 작업이다. 기본값이 1(직렬)로 유지되므로 현재 운영 동작에는 영향이 없다. 파서(`resolveContinuationWorkerConcurrency`)는 정규식 선검증 + `Number.isInteger` 이중 가드로 공학표기·소수·0·음수를 안전하게 차단하며 테스트 커버리지도 충분하다. 동시성 위험이 현실화되는 유일한 경로는 concurrency 를 2 이상으로 상향했을 때 `cancel` case 의 `void` fire-and-forget (await 미처리)이다. 이 경우 cancel 완료 전에 다른 slot 에서 resume job 이 실행될 수 있는 race window 가 생기므로, concurrency 상향 전 반드시 해당 TODO 를 해소해야 한다. 그 외에는 BullMQ jobId 멱등성, NodeExecution.status 재검증 가드, 분산 lock 등 기존 원칙이 그대로 유지되어 동시성 안전성 수준이 퇴보하지 않는다.

## 위험도

LOW

---

STATUS=success ISSUES=2
