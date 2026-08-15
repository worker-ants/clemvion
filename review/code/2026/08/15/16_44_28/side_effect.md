# 부작용(Side Effect) 리뷰

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`
  (`async finalizeStalledExhausted(executionId: string): Promise<void>`, 3345행 정의)를
  `this.dataSource.transaction()` 으로 원자화. 이번 라운드(16_44_28) diff 는 누적 5커밋
  (`3e64f2a0a`~`a184edc00`) 전체를 대상으로 한다.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 대응 테스트
  하네스(`installStalledTx`, 4879행) 추가 + WHERE 가드 단언 보강 + "트랜잭션 중간 실패는
  삼키지 않고 던진다" 신규 테스트(5029행) 추가.
- `CHANGELOG.md`, `plan/in-progress/eia-stalled-atomicity.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/update-returning-tuple-shape.md`, `plan/complete/eia-db-wire-invariant.md`(경로만 rename),
  `spec/5-system/4-execution-engine.md`, `review/**` 산출물 — 전부 문서/프로세스 산출물. 애플리케이션
  실행 경로에 영향 없음.

## 발견사항

- **[INFO]** 트랜잭션 도입으로 no-op 조기 반환 지점이 바뀌었지만 관측 가능한 부작용은 동일하게 유지된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3376` (`if ((result.affected ?? 0) === 0) return;` — 트랜잭션 콜백 내부), `:3406` (`if (!finalized) return;` — 콜백 밖)
  - 상세: 종전엔 `affected===0` 이면 함수 자체가 즉시 `return`(로그·cascade·emit 전부 skip)했다. 변경 후엔 트랜잭션 콜백 내부에서 `return`(빈 트랜잭션이 커밋되며 DB 부작용 없음)하고, 바깥에서 `finalized` 플래그로 같은 skip 을 재현한다. "이미 terminal → `logger.warn`/`finalizeRehydrationCleanup`/`emitExecution` 미실행"이라는 관측 가능한 동작은 두 구현 모두 동일하다. 자매 함수(`cancelParkedExecution:1023`, `markWebChatIdleTimeout:1152`)가 이미 쓰는 `cancelled`/`finalized` 플래그 패턴과 동형이라 이 계열의 기존 관례를 그대로 따른다. 회귀 없음.
  - 제안: 없음 (정보성 확인).

- **[INFO]** `logger.warn` 부작용의 타이밍이 "첫 UPDATE 커밋 직후(둘째 UPDATE 실행 전)"에서 "트랜잭션 전체 커밋 후"로 이동했다 — 순수하게 관측성 개선 방향
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3408-3410` (`this.logger.warn(...)`, `if (!finalized) return;` 바로 다음)
  - 상세: diff 이전에는 `logger.warn` 이 Execution UPDATE(autocommit) 커밋 직후·NodeExecution cascade UPDATE 실행 **전**에 호출됐다. 즉 이 로그는 "Execution 은 failed 로 바뀌었지만 자식 cascade 는 아직 안 됐을 수도 있는" 부분 상태에서도 "성공" 처럼 찍혔다 — 둘째 UPDATE 가 그 뒤 실패하면 로그는 이미 나갔는데 자식은 영구 RUNNING 으로 잔류하는, 이 PR 이 고치는 결함과 정확히 같은 창이다. 변경 후엔 두 UPDATE 가 모두 커밋되고 `finalized === true` 로 확인된 뒤에만 로그가 찍힌다 — 트랜잭션이 실패(예: 신규 테스트 `:5029` 의 `nodeQb.execute` reject)하면 `this.dataSource.transaction(...)` 자체가 throw 해 `3408` 줄에 도달하지 못하므로 **이 로그는 아예 찍히지 않는다**(호출부 `execution-run.processor.ts:88-93` 의 `.catch()` 가 별도 error 로그를 남긴다). 관측 가능한 최종 동작(성공 시 1회 warn, 실패 시 caller 의 error 로그)은 여전히 정합적이고, 오히려 "부분 실패인데 성공처럼 보이는 로그" 가능성을 제거한다. 이 로그를 파싱/스크래핑하는 다른 코드는 발견되지 않았다.
  - 제안: 없음 — 순수 개선. 참고로 직전 라운드(`16_31_53`)에서도 동일 관찰이 INFO 로 기록되고 무조치 처분됐다.

- **[INFO]** 커밋 이후 best-effort 부수효과(`finalizeRehydrationCleanup`, `emitExecution`)의 인자·이벤트 타입·payload shape 은 이번 diff 로 변경되지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3412-3422`
  - 상세: `finalizeRehydrationCleanup(executionId)` 호출과 `emitExecution(executionId, ExecutionEventType.EXECUTION_FAILED, { status, error, durationMs })` 의 인자 구성은 diff 전후 동일하다(`git diff` 상 이 블록은 문맥 이동만 있고 내용 변경 없음). 함수 시그니처(`Promise<void>`)도 변경 없다. 유일 호출부 `ExecutionRunProcessor.onFailed`(`execution-run.processor.ts:69`, `@OnWorkerEvent('failed')`)는 fire-and-forget(`void ... .catch()`)이므로 영향받지 않는다. 공개 API·이벤트 계약 변경 없음.
  - 제안: 없음.

- **[INFO]** `this.dataSource` 는 기존에 이미 주입된 클래스 멤버(`execution-engine.service.ts:775`, `private readonly dataSource: DataSource`)이고, 두 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`, 8479행의 또 다른 트랜잭션 사용처)가 이미 동일 인스턴스를 사용 중이다 — 새 전역/공유 상태 도입 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3357` (`await this.dataSource.transaction(async (manager) => {...})`)
  - 상세: 트랜잭션 도입이 새 DI 의존성이나 모듈 provider 추가를 유발하지 않는다. `manager.createQueryBuilder()` 는 트랜잭션 로컬 매니저이며 함수 스코프 밖으로 leak 되지 않는다. 함수 내부의 `stalledDurationMs`/`finalized` 는 클로저 지역 변수(`let`)로, 자매 함수의 `cancelledDurationMs`/`cancelled` 와 동일한 패턴 — 전역 상태 아님, 매 호출마다 새로 생성되어 재진입 안전.
  - 제안: 없음.

- **[INFO]** 테스트 mock 하네스(`installStalledTx`)가 `service.dataSource.transaction`·`mockExecutionRepo.createQueryBuilder`·`mockNodeExecutionRepo.createQueryBuilder` 를 재정의하지만 테스트 간 상태 누수 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4879-4905`(`installStalledTx` 정의), 최상위 `beforeEach`(255행, `Test.createTestingModule` 로 `service` 전체 재생성)
  - 상세: `installStalledTx` 는 트랜잭션 밖 리포지토리 사용 시 즉시 throw 하도록 `mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder` 를 재정의하고, `service.dataSource.transaction` 을 `jest.fn` spy 로 바꾼다. 이 재정의는 `service` 인스턴스 프로퍼티(및 그 인스턴스가 참조하는 mock 객체)에 대한 것인데, `service` 자체가 최상위 `beforeEach`(255행)에서 매 테스트마다 `Test.createTestingModule` 로 새로 컴파일된다(자매 헬퍼 `installCancelTx` 도 동일 구조 재사용, 3281행). 다른 테스트로 오염 가능성 없음.
  - 제안: 없음.

- **[INFO]** 신규 테스트 `'트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결 이벤트도 안 나간다'`(5029행)가 검증하는 "예외 전파" 계약은 diff 이전부터 있던 동작이며, 이번 diff 가 새로 도입한 것이 아니라 트랜잭션 도입 후에도 유지됨을 확인하는 회귀 잠금 테스트다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5029-5052`
  - 상세: 함수 레벨 `try/catch` 는 diff 이전에도 없었고(`git show origin/main:codebase/.../execution-engine.service.ts` 로 확인 가능한 원본도 raw await), diff 이후에도 의도적으로 도입하지 않았다(JSDoc `:3331-3334` 에 "의도적으로 없다" 명시). `dataSource.transaction()` 콜백 내부에서 두 번째 UPDATE 가 reject 되면 트랜잭션 전체가 reject 되어 함수가 그대로 throw 하고, 유일 호출부의 `.catch()`(`execution-run.processor.ts:88`)가 흡수한다. 콜백이 reject 됐으므로 `finalized` 는 `false` 로 남고, 애초에 그 지점 이후 코드(로그·cleanup·emit)에 도달하지 않는다 — "부분 커밋 후 성공처럼 emit" 시나리오가 구조적으로 불가능해졌다.
  - 제안: 없음.

전역 변수 신설/수정, 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 쓰기(애플리케이션 코드 경로), 공개 함수 시그니처·이벤트 payload 변경, 신규 네트워크 호출은 발견되지 않았다. `plan/*.md`, `spec/*.md`, `review/**` 변경은 프로젝트 컨벤션이 요구하는 프로세스 문서 갱신(정본 트래커 동시 갱신, plan lifecycle 이관, ai-review 산출물)이며 런타임 부작용과 무관하다.

## 요약

이번 변경은 `finalizeStalledExhausted` 의 Execution/NodeExecution 두 UPDATE 를 이미 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)가 쓰는 `dataSource.transaction` 패턴으로 원자화한 것으로, 함수 시그니처·유일 호출부(`execution-run.processor.ts`)·이벤트 emit payload·no-op 조기 반환 시 관측 가능한 동작이 모두 그대로 유지된다. 새로 도입된 전역 상태나 환경 변수, 예상치 못한 파일시스템/네트워크 부작용은 없다. 유일하게 주목할 만한 변화는 `logger.warn` 부수효과의 타이밍이 "부분 상태에서도 찍힐 수 있던 지점"에서 "완전 커밋 확인 후"로 옮겨간 것인데, 이는 회귀가 아니라 오히려 이 PR 이 고치는 바로 그 부분 커밋 결함과 같은 창을 관측성 측면에서도 닫는 방향이다. 테스트 하네스의 mock 재정의는 `beforeEach` 의 전체 서비스 재생성 덕에 테스트 간 상태 누수 없이 스코프가 닫혀 있다. 부작용 관점에서 문제될 항목은 발견되지 않았다.

## 위험도

NONE
