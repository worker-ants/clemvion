# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `resolveContinuationWorkerConcurrency()` — 모듈 로드 시점 `process.env` 직접 읽기
- 위치: `/codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` L528–539
- 상세: 함수 기본 인자 `env: NodeJS.ProcessEnv = process.env` 는 함수 **호출 시** 평가된다. `@Processor` 데코레이터가 `resolveContinuationWorkerConcurrency()` 를 인자 없이 호출하므로 실질적으로 NestJS 모듈 초기화 시점(DI 이전)에 `process.env.CONTINUATION_WORKER_CONCURRENCY` 를 읽는다. 이는 의도된 설계이며 JSDoc 에도 명시되어 있다(`"DI 이전 모듈 로드 시점에 평가"`). 부작용 자체는 없으나, 이 값은 프로세스 전체 lifetime 동안 고정된다 — 런타임 env 변경은 반영되지 않는다. 이는 BullMQ concurrency 특성상 예상된 동작이다.
- 제안: 현재 구조로 충분. 단, 운영 환경에서 concurrency 를 변경하려면 프로세스 재시작이 필요함을 `.env.example` 주석 또는 운영 문서에 명시하면 좋다.

### [INFO] `@Processor` 데코레이터 옵션 추가 — BullMQ Worker 설정 변경
- 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` L371–373
- 상세: `@Processor(CONTINUATION_EXECUTION_QUEUE)` 에서 `@Processor(CONTINUATION_EXECUTION_QUEUE, { concurrency: resolveContinuationWorkerConcurrency() })` 로 변경. 기본값이 `1` 이므로 env 미설정 시 기존 동작(직렬)과 동일하다. BullMQ Worker 의 `concurrency` 옵션을 변경하면 동일 인스턴스 내에서 병렬로 처리될 job 수가 달라지므로, 값을 올릴 경우 `engine.applyContinuation` 등이 공유 상태(`pendingContinuations` Map)를 동시에 접근할 수 있다. 하지만 이는 기존 멀티 인스턴스 환경에서도 이미 존재하는 race window 이며, processor 가 `NodeExecution.status` 재검증 가드를 이미 갖추고 있다(멱등성 보강). 신규 부작용이 아니라 기존 race window 의 인스턴스 내 버전이다.
- 제안: concurrency > 1 로 올릴 때 `pendingContinuations` Map 과 관련 공유 상태의 동시 접근이 안전한지 `ExecutionEngineService` 에서 추가 검토 권장. 현재 기본값(1)에서는 영향 없음.

### [INFO] 전역 변수 없음 — `DEFAULT_CONTINUATION_WORKER_CONCURRENCY` 상수 노출
- 위치: `/codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` L515
- 상세: `DEFAULT_CONTINUATION_WORKER_CONCURRENCY = 1` 을 `export const` 로 노출한다. 이 값은 불변 상수이며, 파일 밖에서 수정할 수 없다. 테스트(`.spec.ts`)에서 단언 값으로 사용하는 용도로 export 되어 있어 적절하다.
- 제안: 특이사항 없음.

### [INFO] 시그니처 변경 없음 — 기존 export 유지
- 위치: `continuation-execution.queue.ts`, `continuation-execution.processor.ts`
- 상세: 기존 export(`CONTINUATION_EXECUTION_QUEUE`, `CONTINUATION_QUEUE_DEFAULT_OPTS`, `buildContinuationJobId`, 타입들)는 모두 그대로 유지된다. 신규 추가된 `resolveContinuationWorkerConcurrency`, `DEFAULT_CONTINUATION_WORKER_CONCURRENCY` 만 새로 export 된다. 기존 호출자에 대한 시그니처 파괴 변경 없음.

### [INFO] plan frontmatter 상태 변경 — 정상 업무 처리
- 위치: `/plan/in-progress/continuation-resume-optional-followups.md`
- 상세: `worktree: null / branch: null / status: backlog` → `worktree: continuation-worker-concurrency-env / branch: worktree-continuation-worker-concurrency-env / status: in-progress` 로 변경. 단순 plan 추적 문서의 메타데이터 갱신이며, 애플리케이션 런타임 상태에 영향 없음.

### [INFO] spec 문서 추가 — 읽기 전용 문서 변경
- 위치: `/spec/5-system/4-execution-engine.md`
- 상세: §7.4 표에 "Worker 동시성" 행 추가, §11 config 표에 `CONTINUATION_WORKER_CONCURRENCY` 행 추가. 런타임 동작에 영향 없는 문서 변경.

### [INFO] 환경 변수 신규 도입 — `.env.example` 에 명시
- 위치: `/codebase/backend/.env.example` L181–187
- 상세: `CONTINUATION_WORKER_CONCURRENCY=1` 이 신규 env 로 추가된다. 미설정 시 코드가 기본값 `1` 로 fallback 하므로 기존 배포 환경에서 이 변수가 없어도 동작에 변화 없다. Breaking change 없음.

## 요약

이번 변경은 `CONTINUATION_WORKER_CONCURRENCY` 환경 변수를 통해 BullMQ continuation worker 의 동시성을 외부 설정 가능하게 만드는 순수 기능 추가다. 기본값이 `1` (기존 동작과 동일한 직렬)로 고정되어 있어 env 미설정 배포 환경에서 런타임 동작 변화가 전혀 없다. `resolveContinuationWorkerConcurrency` 함수는 모듈 로드 시점에 `process.env` 를 한 번 읽는 순수 파서로 설계되어 있고, 전역 변수 변이나 파일시스템·네트워크 부작용이 없다. 기존 export 시그니처도 모두 유지된다. concurrency 를 1 초과로 올릴 경우 인스턴스 내 동시 access 로 인한 공유 상태 race 가 잠재하지만, 이는 기존 멀티 인스턴스 환경에서 이미 존재하는 구조적 한계이며 멱등성 가드가 이를 완화하고 있다. 부작용 관점에서 신규 위험 요소는 없다.

## 위험도

NONE
