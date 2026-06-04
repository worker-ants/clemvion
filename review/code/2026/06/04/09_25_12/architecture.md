# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] queue 상수·유틸 파일(`execution-run.queue.ts`)의 단일 책임 범위 양호
- 위치: `/codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` 전체
- 상세: 큐 이름 상수, job 옵션 기본값, jobId 빌더, priority 해석기, 동시성 파서, 타입 정의를 한 파일에 모았다. 각 export는 상태를 공유하지 않고 순수 함수·상수이므로 응집도가 높고 결합도가 낮다. 동일 패턴이 `continuation-execution.processor` 측에도 적용된 선례(`resolveContinuationWorkerConcurrency`)와 일관성을 유지한다.
- 제안: 현행 유지.

### [INFO] `ExecutionRunProcessor`가 `forwardRef`로 `ExecutionEngineService`를 주입하는 순환 의존 구조
- 위치: `/codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` 라인 53–58
- 상세: `ExecutionRunProcessor`가 `@Inject(forwardRef(() => ExecutionEngineService))`를 사용한다. 이는 `ExecutionEngineService`가 큐(Queue)를 주입받고, 동시에 같은 모듈의 Processor가 service를 역참조하는 양방향 의존 때문이다. `BackgroundExecutionProcessor`도 동일 패턴을 이미 사용하고 있어 기존 코드베이스에서 허용된 관례다. NestJS DI 컨테이너가 forwardRef로 이 순환을 해소하지만, 단일 모듈 내 순환 참조 자체는 확장 시 위험 지점이다. PR3/PR4에서 Processor가 더 많은 service를 참조하면 순환 위험이 누적된다.
- 제안: PR3 이후 `ExecutionRunProcessor`를 별도 서브모듈로 분리하거나 `runExecutionFromQueue`를 인터페이스(`IExecutionRunHandler`)로 추상화해 순환을 단방향으로 전환하는 것을 고려한다. PR1 범위에서는 기존 패턴과 동일하므로 수용 가능.

### [WARNING] `ExecutionEngineService.runExecutionFromQueue`가 공개(`public`) API로 노출
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff 라인 `async runExecutionFromQueue(...)`
- 상세: `runExecutionFromQueue`는 `ExecutionRunProcessor`만 호출해야 하는 worker 전용 진입점이지만, `public` 메서드로 선언되어 모듈 경계를 우회하는 호출이 가능하다. 테스트 파일도 이 메서드를 직접 호출하는데(`service.runExecutionFromQueue(executionId, ...)`), 이는 격리 의도에 맞으나 production 코드에서의 노출은 모듈 경계를 약화시킨다.
- 제안: `@internal` JSDoc을 붙이거나, `ExecutionRunProcessor`를 `ExecutionEngineService`의 `providers` 내부에 co-locate시켜 직접 접근을 의도적으로 허용하는 이유를 문서화한다. 장기적으로는 `runExecutionFromQueue`를 별도 인터페이스(토큰)로 주입해 public surface를 줄이는 것을 권장한다.

### [INFO] `execute()` 단계에서의 triggerType 추론 로직이 단순 이분법
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff 라인 `const triggerType = options?.executedBy ? 'manual' : 'webhook';`
- 상세: `options.executedBy`가 없으면 모두 `'webhook'`으로 처리한다. `schedule` 타입 트리거가 webhook과 동일 우선순위를 부여받아 spec §4.3의 3-tier(manual > webhook > schedule)가 아직 미완성이다. 이는 plan 파일에서 "후속"으로 명시적으로 추적되고 있다.
- 제안: `ExecuteOptions`에 `triggerType?: ExecutionRunTriggerType` 필드를 추가하는 후속 PR(PR2 또는 별도)에서 개방-폐쇄 원칙에 맞게 확장한다. PR1 범위 내에서는 주석과 plan에 명시되어 있어 수용 가능.

### [INFO] job payload에 `input`이 중복 전달됨 (`row.inputData`와 동일 데이터)
- 위치: `execution-run.queue.ts` `ExecutionRunJob` 인터페이스 + `execution-engine.service.ts` diff enqueue 호출부
- 상세: `execute()`가 `Execution` row에 `inputData`를 저장한 뒤, 큐 job에도 동일한 `input`을 담는다. `runExecutionFromQueue`에서 row를 재조회한 뒤 job의 `input`을 `runExecution(execution, input)`에 넘긴다. `row.inputData`를 그대로 쓰지 않고 job에서 input을 재전달하는 이유가 JSDoc에 "raw input 의 정확한 의미를 보존"으로 설명되어 있으나, 데이터 이중 저장이다. `inputData`를 쓰면 job payload 크기를 줄이고 단일 진실을 유지할 수 있다.
- 제안: PR3에서 멱등 rehydration 도입 시 `runExecution(execution, execution.inputData)`로 일원화하는 것을 검토한다. PR1 범위에서는 기존 `runExecution` 시그니처와의 호환성을 위해 현행 유지 가능.

### [INFO] 테스트 내 인라인 worker 브릿지가 테스트 레이어 경계를 넘음
- 위치: `execution-engine.service.spec.ts` diff 라인 `add: jest.fn().mockImplementation(...void service.runExecutionFromQueue(...)...)`
- 상세: 테스트 모듈이 `EXECUTION_RUN_QUEUE` mock의 `add` 구현에서 `service.runExecutionFromQueue(...)`를 직접 호출한다. 이는 기존 `execute()` 테스트들을 무수정으로 통과시키기 위한 실용적 선택이나, service 인스턴스를 mock 팩토리 클로저가 캡처하는 패턴이라 `service`가 null인 시점과의 순서 의존성이 숨어있다(`resolvedService` 패턴과 유사한 late-binding 구조). 실제로는 `beforeEach`에서 모듈이 컴파일된 뒤 `service`가 set되므로 문제없지만, 유지보수 시 혼란 여지가 있다.
- 제안: 인라인 브릿지 패턴의 의도를 주석으로 명확히 문서화(이미 부분적으로 되어 있음). 추가로 `resolvedService`처럼 `let serviceRef: ExecutionEngineService` 변수를 사용해 바인딩 시점을 명시화하는 것을 고려한다.

### [INFO] `ExecutionEngineModule`에서 `ExecutionRunProcessor`가 `providers`에만 등록되고 `exports`에 없음
- 위치: `execution-engine.module.ts` diff
- 상세: `ExecutionRunProcessor`는 모듈 내부에서만 소비되며 외부로 export할 이유가 없다. 이는 올바른 모듈 경계 설계다. BullMQ Processor는 NestJS가 자동으로 worker를 등록하므로 providers 등록만으로 충분하다.
- 제안: 현행 유지.

### [WARNING] `execute()` 와 `runExecutionFromQueue()` 사이의 `input` 데이터 소유권 불명확
- 위치: `execution-engine.service.ts` diff의 enqueue 블록 + `runExecutionFromQueue` 내 `runExecution(execution, input)` 호출
- 상세: `execute()`는 `Execution` row 저장 시 `inputData`를 persist하고, 큐 job에도 `input`을 실어 보낸다. worker는 row를 재조회해 `execution` 객체를 얻지만, `runExecution` 호출 시 row의 `inputData`가 아닌 job의 `input`을 사용한다. 이는 row가 이미 `inputData`를 갖고 있음에도 job이 정보의 권위적 소스가 되는 구조다. 두 소스가 diverge하는 상황(예: `inputData` 직접 수정)에서 동작이 불명확해진다.
- 제안: `runExecutionFromQueue` 내에서 `execution.inputData`를 사용하거나, job `input`과 `execution.inputData`의 우선순위를 명시적으로 정책화한다.

## 요약

PR1(exec-intake-queue)은 `execute()`의 fire-and-forget in-process 호출을 BullMQ 영속 큐(`execution-run`)로 대체하는 구조 변경이다. 레이어 책임 분리(큐 상수/옵션 파일, Processor, Service 진입점 분리)는 기존 `continuation` 패턴과 일관성이 있으며 잘 구조화되어 있다. 핵심 설계 결정(routing context를 worker로 이동, jobId = executionId dedup, maxStalledCount:0으로 이중 실행 방지)은 spec §4.1–4.3의 의도를 충실히 반영한다. 주요 아키텍처 우려는 (1) `ExecutionRunProcessor`→`ExecutionEngineService` 역참조 순환(기존 패턴 답습, PR3 이후 해소 권장), (2) `runExecutionFromQueue`의 public 노출(worker 전용 진입점임에도 모듈 외부 접근 가능), (3) input 이중 저장(job payload + row.inputData)으로, 모두 중간 수준의 장기 위험이나 PR1 범위 내에서는 명시적 후속 추적이 되어 있어 수용 가능하다.

## 위험도

LOW
