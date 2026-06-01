# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] resolveContinuationWorkerConcurrency 단위 테스트 — 우수한 커버리지
- 위치: `/codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.spec.ts`
- 상세: 양수 정수, 미설정, 빈 문자열, 공백, 비숫자(abc), 0, 음수, 소수(2.5), 공학표기(1e10), 16진수(0x10), 앞뒤 공백 trim 등 명세가 요구하는 모든 fallback 경로를 `it.each`로 망라. `DEFAULT_CONTINUATION_WORKER_CONCURRENCY === 1` 도 명시적으로 어설션해 상수 회귀를 방지.
- 제안: 없음. 이 함수에 대한 테스트 커버리지는 충분하다.

### [INFO] ContinuationExecutionProcessor 단위 테스트 — 변경 영향 범위에 충분
- 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.spec.ts`
- 상세: 이번 PR 에서 processor 에 가해진 변경은 `@Processor` 데코레이터에 `concurrency` 옵션을 주입하는 것뿐이다. 데코레이터 메타데이터 자체는 BullMQ 런타임이 소비하므로 단위 테스트로 검증할 수 없고, 기존 dispatch 동작 테스트(5 type + idempotency guard + retry_last_turn + onFailed)는 변경 없이 그대로 유효하다. 결합도 측면에서도 `ExecutionEngineService` mock 은 `Pick` 으로 필요한 4개 메서드만 선택하여 테스트 격리가 양호하다.
- 제안: 없음.

### [INFO] concurrency 옵션 런타임 동작 — 통합/e2e 레벨 검증 부재 (허용 범위)
- 위치: `continuation-execution.processor.ts` L371–373
- 상세: `resolveContinuationWorkerConcurrency()` 반환값이 BullMQ Worker 에 실제로 전달되는지(concurrency 옵션이 올바르게 적용되는지)는 단위 테스트로 확인할 수 없다. 이는 `@Processor` 데코레이터가 DI 이전 모듈 로드 시점에 평가되고, BullMQ Worker 인스턴스 생성은 NestJS 내부이기 때문이다. 그러나 (a) `resolveContinuationWorkerConcurrency` 자체는 순수 함수로 단위 검증이 완료되어 있고, (b) BullMQ/NestJS 라이브러리 동작을 통합 테스트로 검증하는 것은 본 프로젝트 e2e 범위 밖이며 비용 대비 가치가 낮다. 명세에도 "concurrency 주입 여부"를 별도 통합 테스트 대상으로 규정하지 않는다.
- 제안: 현 상태 유지. 향후 BullMQ Worker concurrency 동작 전체를 검증하는 e2e 테스트가 추가되는 시점에 해당 시나리오를 포함시킨다.

### [INFO] `retry_last_turn` — isNodeExecutionWaiting 우회 명시 테스트 추가 확인
- 위치: `continuation-execution.processor.spec.ts` L204–215
- 상세: spec §7.5 의 "spawned row 는 RUNNING 이므로 WAITING 가드를 건너뜀" 규약을 `bypass isNodeExecutionWaiting guard` 테스트가 명시적으로 검증한다. `isNodeExecutionWaiting` 가 `false` 를 반환하는 상황에서도 `applyRetryLastTurn` 이 호출되는 것을 확인해 guard 우회 의도가 코드와 테스트 모두에서 일치한다.
- 제안: 없음.

### [INFO] `cancel` — fire-and-forget(`void`) 동작과 테스트 갭
- 위치: `continuation-execution.processor.ts` L421 / `processor.spec.ts` L86–90
- 상세: `applyCancellation` 은 현재 `void`(fire-and-forget) 호출이며 테스트는 "호출됐는가"만 검증한다. 향후 `applyCancellation` 이 async 전환되면 `await` 복원 + 에러 전파 동작 추가 테스트가 필요하다. 이 점은 코드 내 TODO 주석으로 이미 명시되어 있어 인지된 기술 부채다.
- 제안: async 전환 시 `applyCancellation` 이 throw 했을 때 processor 가 에러를 전파하는지 테스트를 추가한다.

### [INFO] `onFailed` — `job.opts?.attempts` 미설정(undefined) fallback 경로 테스트
- 위치: `processor.spec.ts` L232–278
- 상세: `onFailed` 테스트는 `job.opts.attempts` 가 명시된 경우만 검증한다. `opts?.attempts` 가 `undefined` 일 때 `CONTINUATION_QUEUE_DEFAULT_OPTS.attempts` 로 fallback 하는 경로(L482)가 테스트되지 않는다. 이는 사소한 갭이나 경계값 커버리지 측면에서 추가할 수 있다.
- 제안: `failJob` 헬퍼에서 `opts.attempts` 를 생략한 케이스를 추가해 fallback 값(3)이 올바르게 사용되는지 검증.

## 요약

이번 변경의 핵심 추가물인 `resolveContinuationWorkerConcurrency()` 순수 함수는 명세가 요구하는 모든 입력 경계값(양수, 미설정, 빈 문자열, 공백, 비숫자, 0, 음수, 소수, 공학표기, 16진수, trim)을 망라한 단위 테스트로 완전히 커버된다. Processor 변경은 데코레이터 메타데이터 주입에 국한되므로 기존 단위 테스트의 유효성에 영향이 없으며, 테스트 격리·가독성·의도 표현 모두 양호하다. 유일한 비중 있는 미커버 경로는 `onFailed` 의 `opts?.attempts` 미설정 fallback이나, 이는 INFO 수준의 사소한 갭이다. 전체적으로 테스트 구조가 변경 범위에 비례하게 잘 작성되어 있다.

## 위험도

LOW
