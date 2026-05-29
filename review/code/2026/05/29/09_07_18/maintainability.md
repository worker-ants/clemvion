# 유지보수성(Maintainability) 리뷰

## 발견사항

### 1. `continuation-dlq-monitor.service.ts`

- **[INFO]** **`parsePositiveInt` 함수 중복 선언**
  - 위치: `continuation-dlq-monitor.service.ts:138–140`
  - 상세: `execution-engine.module.ts`의 `SHUTDOWN_GRACE_MS` 팩토리(`Number.isFinite(parsed) && parsed > 0`)와 거의 동일한 양의 정수 파싱 로직이 별도 모듈-로컬 함수로 재구현되어 있다. 차이는 `Number.isFinite` vs `Number.isInteger` 뿐이다. 코멘트도 "SHUTDOWN_GRACE_MS 의 W-2 fix 와 동일 방어"라고 명시하고 있어 중복 의도가 노출된다. 현재는 2곳이지만, 환경변수 파싱이 추가될 때마다 세 번째, 네 번째 복사본이 생겨 수정 누락 위험이 높아진다.
  - 제안: `codebase/backend/src/modules/execution-engine/shutdown/shutdown.constants.ts` 또는 `common/` 유틸로 `parsePositiveInt(raw, fallback)` 을 추출·export 하여 두 사용처가 공유하도록 리팩터링한다.

- **[INFO]** **공개 속성 접근 제한자 일관성**
  - 위치: `continuation-dlq-monitor.service.ts:40–43`
  - 상세: `thresholdJobs`, `intervalMs`, `cooldownMs`, `enabled` 는 `readonly`로 선언되어 있지만, 테스트에서 직접 접근하기 위해 `public`(기본 TS 접근 레벨)으로 노출되어 있다. 코드베이스의 NestJS 서비스들은 일반적으로 비공개 상태는 `private`으로 유지하고 테스트는 `as unknown as` cast를 쓰거나 전용 getter를 사용하는 패턴을 따른다. 다만 테스트 진입점 설계 의도가 명확하고, spec §7.4 설정 검증용 `readonly` 공개 필드는 합리적인 선택이기도 하므로 강제 수정 대상은 아니다.
  - 제안: 의도라면 JSDoc에 `@internal` 또는 `@visibleForTesting`을 추가해 외부 호출자가 이 필드에 의존하지 않도록 표시한다.

- **[INFO]** **로그 메시지 언어 혼용**
  - 위치: `continuation-dlq-monitor.service.ts:78–81, 89`
  - 상세: `onModuleInit`의 영문 disabled 메시지("Continuation DLQ monitor disabled (CONTINUATION_DLQ_MONITOR_ENABLED=false).")와 동일 메서드의 한국어 시작 메시지("Continuation DLQ monitor 시작 — interval=...")가 같은 블록 내에 섞여 있다. `checkOnce` 내부에서도 한국어 warn("Continuation DLQ 조회 실패")과 영문 `[DLQ ALARM]` 알람이 혼재한다. 운영 중 로그 파이프라인 키워드 필터 작성 시 혼란을 줄 수 있다.
  - 제안: 언어를 통일하거나, 최소한 같은 이벤트 종류(장애/알람)는 동일 언어로 작성한다.

---

### 2. `continuation-execution.processor.ts` — `onFailed` 추가

- **[INFO]** **`err?.message ?? err` 패턴 중복**
  - 위치: `continuation-execution.processor.ts:1002, 1004`
  - 상세: `onFailed`에서 `err?.message ?? err` 패턴이 두 곳에서 반복된다(job 없는 케이스, 정상 로그 케이스). 동일 파일의 `checkOnce`도 `err instanceof Error ? err.message : String(err)`를 쓰는데 이와 달리 옵셔널 체이닝을 쓰는 차이가 있다. `onFailed`의 시그니처가 `Error`를 받으므로 `err.message` 로 직접 접근 가능하며 `?.`는 불필요하다.
  - 제안: `onFailed`의 인자 타입이 `Error`임을 활용해 `err.message`로 통일하거나, 모듈 수준 헬퍼 `errorMessage(err: unknown): string`를 두어 일관성을 확보한다.

- **[INFO]** **`terminal` 변수 명명**
  - 위치: `continuation-execution.processor.ts:1000`
  - 상세: `terminal`이라는 이름은 "터미널 단계(소진)" 개념을 표현하지만, 코드베이스의 다른 boolean 변수 네이밍 패턴(예: `stillWaiting`, `alarmed`)과 비교하면 `isExhausted` 또는 `isDeadLetter`가 로그에 나타나는 `DEAD-LETTER` 태그와 더 직접적으로 대응되어 의도를 명확히 드러낸다.
  - 제안: `const isDeadLetter = attemptsMade >= maxAttempts;` 로 변경.

---

### 3. `execution-engine.service.ts` — `InvalidExecutionStateError` 및 `resolveWaitingNodeExecutionId`

- **[WARNING]** **`InvalidExecutionStateError` 위치 — 공개 API와 내부 에러 혼재**
  - 위치: `execution-engine.service.ts:282–289`
  - 상세: `execution-engine.service.ts`에는 `private` scope 에러(`ExecutionCancelledError`, `RehydrationError`)와 `export` 에러(`InvalidExecutionStateError`)가 함께 정의되어 있다. 코드베이스에는 이미 `workflow-errors.ts`라는 공개 에러 전용 파일이 존재한다(`WorkflowNotFoundError`, `SubWorkflowTimeoutError`). `InvalidExecutionStateError`는 controller·gateway·interaction.service 3곳에서 import하는 공개 에러인데, 1,400줄 이상의 서비스 파일 내부에 묻혀 있어 찾기 어렵고, `execution-engine.service.ts`에 대한 의존을 불필요하게 높인다.
  - 제안: `InvalidExecutionStateError`를 `workflow-errors.ts`(또는 `continuation/continuation-errors.ts`)로 이동하고, 현재 3개 임포트를 해당 파일에서 직접 가져오도록 변경한다.

- **[INFO]** **`resolveWaitingNodeExecutionId` try/catch 바깥 변수 선언 패턴**
  - 위치: `execution-engine.service.ts`, 변경 2.3 구간
  - 상세: 변경 후 `rows` 변수를 `try` 블록 앞에서 선언(`let rows: Array<...>`)하고 try 내부에서 할당하는 패턴을 택했다. TypeScript에서 이 방식은 narrowing이 작동하지 않아 `try` 이후 `rows` 가 잠재적으로 uninitialized처럼 보이지만, catch에서 무조건 re-throw하기 때문에 실제로는 안전하다. 그러나 try 바깥 var-pattern은 구조적으로 권장되지 않으며, try 이후 분기가 늘어나면 취약해질 수 있다.
  - 제안: try 블록이 catch에서 항상 throw하는 경우 `const rows = await ...` 를 try 내부에 두고 성공 시 즉시 return하는 early-return 패턴이 더 명시적이다. 현재 코드도 동작은 정확하므로 선택적 개선이다.

---

### 4. `websocket.gateway.ts` — `errorCode` 필드 추가

- **[WARNING]** **동일 에러 처리 패턴 4회 반복 (중복 코드)**
  - 위치: `websocket.gateway.ts` — `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation`의 catch 블록
  - 상세: 각 핸들러 catch 블록에 `const errorCode = error instanceof InvalidExecutionStateError ? error.code : undefined;` 가 동일하게 4번 복사되어 있다. 추후 에러 코드 분류 기준(예: 다른 에러 타입 추가)이 바뀌면 4곳을 모두 수정해야 하므로 누락 리스크가 있다.
  - 제안: gateway 내부 유틸 메서드 `buildErrorAck(event: string, error: unknown)` 또는 별도 헬퍼 함수로 추출한다. `interaction.service`의 `dispatchContinuation`이 잘 적용한 패턴과 같은 방향이다.

- **[INFO]** **`errorCode` 필드가 반환 타입 인라인 인터페이스에 4번 추가됨**
  - 위치: `websocket.gateway.ts` 반환 타입 정의 4개소
  - 상세: 각 핸들러의 반환 타입이 인라인 객체 타입 리터럴로 작성되어 있어, `errorCode` 한 줄을 4개 복사본에 각각 추가해야 했다. 공유 응답 타입(`ContinuationAckData` 같은 interface)이 있었다면 한 곳만 수정하면 됐을 것이다.
  - 제안: 4개 핸들러가 공유하는 ack data 타입을 인터페이스로 추출한다.

---

### 5. `interaction.service.ts` — `dispatchContinuation`

- **[INFO]** **`dispatchContinuation`의 인자 타입**
  - 위치: `interaction.service.ts:269`
  - 상세: `dispatchContinuation(promise: Promise<unknown>)` 이 `Promise<unknown>`을 받아 `Promise<void>`를 반환한다. 내부에서 결과를 사용하지 않으므로 `Promise<void>` 인자 타입도 충분하다. `unknown`을 쓰면 호출자가 실수로 다른 타입의 promise를 전달해도 컴파일 에러가 없다.
  - 제안: `Promise<void>` 로 좁혀 의도를 명시한다.

---

### 6. `continuation-execution.processor.spec.ts` — `onFailed` 테스트

- **[INFO]** **`failJob` 헬퍼와 파일 상단 `makeJob` 헬퍼 간 불일치**
  - 위치: `continuation-execution.processor.spec.ts:675–691`
  - 상세: `onFailed` describe 블록 내에 `failJob`과 `warnSpy` 헬퍼 함수를 정의했다. 파일의 최상단에 이미 `makeJob` 헬퍼 함수가 존재하는데, `failJob`이 별도로 추가된 이유는 `attemptsMade`/`opts.attempts` 필드를 직접 세팅해야 하기 때문이다. 현재 구조는 파일 내에 두 개의 job 생성 헬퍼가 공존한다.
  - 제안: `makeJob`에 `attemptsMade`와 `opts.attempts` 오버라이드 파라미터를 추가하거나, `failJob`을 describe 블록 밖 파일 상단 헬퍼 그룹으로 이동해 헬퍼 함수 위치 규칙을 일관되게 유지한다.

---

### 7. `continuation-dlq-monitor.service.spec.ts` — `makeService` 환경변수 복원

- **[INFO]** **환경변수 저장·복원 이중 루프 구조**
  - 위치: `continuation-dlq-monitor.service.spec.ts:42–62`
  - 상세: `makeService` 함수가 env 설정, 서비스 인스턴스화, env 복원을 한 함수 내에서 수행한다. 복원 타이밍(생성자 호출 직후, 테스트 본문 실행 전)은 주석으로 설명되어 있어 의도는 명확하다. 다만 저장 루프와 복원 루프가 동일 `keys` 배열을 순회하는 별도 for 루프로 반복되어 있어, 키가 늘어날 때 두 루프 간 누락 가능성이 생긴다.
  - 제안: `jest.replaceProperty` / `jest.spyOn(process, 'env')` 같은 Jest-idiomatic env mocking 방식으로 교체하거나, 저장·복원 로직을 Map 기반의 단일 유틸로 통합하는 방향을 검토한다.

---

## 요약

이번 변경은 Phase 3.1 DLQ 모니터링(`ContinuationDlqMonitorService`)과 publisher 측 사전 검증 실패의 동기 에러 surface(`InvalidExecutionStateError`) 두 가지 기능을 추가한다. 전반적으로 코드 의도가 JSDoc과 인라인 주석으로 잘 문서화되어 있고, 테스트 커버리지도 분기 케이스 수준까지 충실하다. 주요 유지보수 위험은 두 가지다: (1) `parsePositiveInt` 함수가 모듈-로컬 중복으로 재구현되어 확장 시 불일치 가능성이 있고, (2) `InvalidExecutionStateError`가 이미 공개 에러 전용 파일(`workflow-errors.ts`)이 존재함에도 1,400줄 이상의 서비스 파일 중간에 정의되어 있어 3개 소비자가 서비스 파일에 과도하게 결합된다. `websocket.gateway.ts`의 catch 블록 4중 복사는 패턴 추출로 즉시 개선 가능하다. 나머지 사항은 스타일·일관성 수준의 소규모 항목이다.

## 위험도

LOW
