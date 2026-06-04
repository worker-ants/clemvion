# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 8: execution-run.queue.ts

- **[INFO]** `buildExecutionRunJobId` 함수가 입력을 그대로 반환하는 pass-through
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (라인 36–38)
  - 상세: `buildExecutionRunJobId(executionId: string): string { return executionId; }` 는 현재 아무런 변환을 수행하지 않아 함수 존재 이유가 불명확하다. PR3/PR4 에서 seq 를 붙이는 확장을 위한 의도적인 인터페이스 경계라는 설명이 JSDoc 에 있지만, 함수 이름만으로는 이 의도를 알 수 없다.
  - 제안: 현재 상태를 유지하되 JSDoc 에 "향후 `<executionId>:run:<seq>` 형식으로 변경될 예정이므로 호출자는 이 함수를 반드시 경유할 것" 을 명시하면 충분. 이미 어느 정도 설명이 있어 허용 수준이나, 확장 시점에 함수명을 `buildExecutionRunJobIdV1` 등으로 구분하는 것도 고려 가능.

- **[INFO]** `resolveExecutionRunWorkerConcurrency` 의 정규식 검증과 `Number.isInteger` 이중 검증 패턴
  - 위치: 라인 76–83
  - 상세: `!/^\d+$/.test(raw.trim())` 로 이미 순수 양의 정수 문자열임을 검증한 후, 다시 `Number.isInteger(parsed) && parsed > 0` 를 검사한다. 정규식 통과 시 `Number.isInteger` 는 항상 `true` 이므로 이중 검증이다. `resolveContinuationWorkerConcurrency` 와 동일 패턴이라는 주석으로 일관성은 확보됐지만, 로직 중복이 혼란을 줄 수 있다.
  - 제안: 정규식이 통과하면 `Number.isInteger` 체크는 생략하거나, 정규식 없이 `Number.isInteger && parsed > 0` 만 남기는 단순화. 단, 코드베이스 기존 패턴과 일치시키는 것이 우선이므로 현행 유지도 무방.

---

### 파일 6: execution-run.processor.ts

- **[INFO]** `onFailed` 내 `maxAttempts` 계산 로직 인라인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts` (라인 61–66)
  - 상세: `job.opts?.attempts ?? EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts` 계산이 `onFailed` 내부에 직접 작성돼 있다. 현재 코드는 짧고 명확하나, `EXECUTION_RUN_QUEUE_DEFAULT_OPTS` 를 import 하여 폴백하는 패턴은 큐 옵션 구조 변경 시 processor 도 함께 수정해야 하는 결합을 만든다.
  - 제안: 수용 가능한 수준. 향후 attempts 가 여러 곳에서 참조된다면 queue 파일에서 `getDefaultAttempts()` 헬퍼를 제공하는 것을 고려.

---

### 파일 4: execution-engine.service.ts (변경 부분)

- **[WARNING]** `execute()` 내 `triggerType` 결정 로직이 단순 이진 분기로 하드코딩됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `execute()` 메서드 (추가된 라인: `const triggerType = options?.executedBy ? 'manual' : 'webhook';`)
  - 상세: `'webhook'` 이 `schedule` 과 `webhook` 모두를 포괄하는 매직 리터럴로 사용됐다. JSDoc 에 "후속(triggerType threading)으로 미룬다" 는 주석이 있으나, `'webhook'` 이라는 이름이 오해를 부른다. schedule 으로 발화된 실행도 `triggerType = 'webhook'` 으로 처리된다.
  - 제안: 임시 값임을 명확히 하는 상수 또는 별칭 사용. 예: `const triggerType: ExecutionRunTriggerType = options?.executedBy ? 'manual' : 'webhook'; // TODO(PR2): trigger type 을 ExecuteOptions 에 threading 하여 schedule 세분화` 처럼 TODO 주석을 코드 바로 옆에 달거나, `'trigger'` 처럼 의미 중립적인 임시 리터럴을 사용. 현재 `'webhook'` 은 우선순위상 `schedule` 보다 높으므로 schedule 실행이 의도치 않게 webhook 우선순위를 받아 실행됨 — 기능상 무해하나 의도 오독 위험.

- **[INFO]** `runExecutionFromQueue` 의 JSDoc 주석이 길어 함수 시그니처 가독성 저하
  - 위치: `runExecutionFromQueue` 메서드 선언부
  - 상세: JSDoc 이 9줄에 걸쳐 배경·멱등성·설계 의도를 모두 담고 있어 상세하나, 이 중 spec 링크·PR 범위 언급·설계 논거는 `spec/` 문서나 `execution-run.queue.ts` 의 파일 레벨 주석에 이미 기재돼 있어 중복된다.
  - 제안: JSDoc 을 "worker 진입점: row 재조회 → status 재검증 → routing 재등록 → runExecution 위임" 한 줄 요약 + SoT 참조 링크 1줄로 압축. 상세 배경은 queue 파일 주석을 참조하도록 유도.

---

### 파일 3: execution-engine.service.spec.ts (변경 부분)

- **[WARNING]** 인라인 worker 브릿지의 `void ... .catch(() => undefined)` 패턴이 오류를 무음으로 삼킴
  - 위치: `getQueueToken(EXECUTION_RUN_QUEUE)` mock `add` 구현 내 (라인 579–596 영역)
  - 상세: `void service.runExecutionFromQueue(...).catch(() => undefined)` 는 production worker 의 fire-and-forget 타이밍을 재현하기 위한 의도적 설계이나, `.catch(() => undefined)` 가 `runExecutionFromQueue` 의 throw 를 완전히 삼켜버린다. 브릿지가 에러를 무시하면 특정 실패 경로 테스트에서 검증이 누락될 수 있다.
  - 제안: 브릿지에서 에러를 삼키는 이유를 주석으로 명시 (현재 일부 설명 있음). 추가로, 특정 테스트에서 worker reject 를 검증해야 한다면 `mockImplementationOnce` 로 직접 throw 경로를 노출하는 패턴을 사용하는 것이 명확.

- **[INFO]** `asRecorder` 헬퍼가 describe 블록 내부에 정의되어 있어 재사용 범위 제한
  - 위치: `describe('execute() — execution-run intake 큐 발행 (PR1)')` 내부 `const asRecorder`
  - 상세: `asRecorder()` 는 해당 describe 스코프 안에서만 사용 가능하고, 다른 describe 에서 큐 mock 을 순수 recorder 로 바꿔야 할 때 동일 패턴을 재작성해야 한다.
  - 제안: 최상위 describe 스코프로 승격하거나, 인자로 `mock` 을 받는 유틸 함수로 추출. 단, 현재 사용 빈도를 고려하면 수용 가능한 수준.

- **[INFO]** `pendingRow` 헬퍼가 `describe('runExecutionFromQueue...')` 내에만 정의됨
  - 위치: `describe('runExecutionFromQueue — worker 진입점 + routing context 재등록')` 내부
  - 상세: `pendingRow` 팩토리는 describe 스코프에 묶여 있어 다른 describe 블록에서 유사한 partial Execution 객체가 필요할 때 중복 작성이 예상된다.
  - 제안: 최상위 describe 스코프에 `createPendingExecution(overrides)` 팩토리로 추출. `getPendings` 헬퍼를 최상위로 승격한 패턴과 일관성 유지.

---

### 파일 2: execution-engine.module.ts (변경 부분)

- **[INFO]** BullMQ 큐 등록 순서가 논리적 흐름과 불일치
  - 위치: `imports` 배열 내 `BullModule.registerQueue` 세 항목
  - 상세: `BACKGROUND_EXECUTION_QUEUE`, `CONTINUATION_EXECUTION_QUEUE`, `EXECUTION_RUN_QUEUE` 순서로 등록되어 있으나 `EXECUTION_RUN_QUEUE` 가 `CONTINUATION_EXECUTION_QUEUE` 뒤에 추가됐다. 실행 흐름 관점에서는 `intake → continuation` 순이므로 두 큐의 순서를 바꾸면 코드 읽기가 자연스럽다.
  - 제안: `EXECUTION_RUN_QUEUE` 등록을 `BACKGROUND_EXECUTION_QUEUE` 직후, `CONTINUATION_EXECUTION_QUEUE` 직전으로 이동. 기능 영향 없음.

---

### 파일 1: .env.example (변경 부분)

- **[INFO]** 신규 변수 주석이 한국어로만 작성되어 기존 영문 주석 스타일과 혼재
  - 위치: `EXECUTION_RUN_WORKER_CONCURRENCY` 항목 (라인 213–217)
  - 상세: 파일 내 다른 모든 변수 주석(특히 같은 "Execution Engine" 섹션의 `CONTINUATION_WORKER_CONCURRENCY`, `SIGTERM_GRACE_MS` 등)은 영문으로 작성되어 있으나, `EXECUTION_RUN_WORKER_CONCURRENCY` 주석은 한국어로 작성됐다.
  - 제안: `CONTINUATION_WORKER_CONCURRENCY` 패턴을 그대로 참고해 영문으로 통일하거나, 적어도 첫 문장을 영문으로 작성해 스타일 일관성 유지.

---

## 요약

전반적으로 PR1 구현은 명확한 책임 분리(queue 정의 / processor / 서비스 진입점)를 보이며 중복 코드나 과도한 중첩이 없다. 파일별 JSDoc 주석이 풍부하고 설계 의도를 명시적으로 기술하고 있어 가독성이 높다. 주요 유지보수성 위험은 두 곳이다: (1) `execute()` 내 `triggerType = 'webhook'` 이 schedule 실행도 덮어쓰는 의미 오독 위험 — 기능 영향은 없으나 후속 개발자가 "schedule 실행도 webhook 우선순위를 받는다"는 사실을 놓칠 수 있음; (2) 테스트 내 인라인 worker 브릿지의 silent error swallowing — 일부 실패 경로 검증 누락 위험. 나머지 발견사항(함수 순서, 헬퍼 스코프, 이중 검증)은 INFO 수준으로 기능 안전성에 영향 없다.

## 위험도

LOW
