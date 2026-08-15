# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `finalizeCancelledExecution` 의 JSDoc 이 이번 diff 로 생긴 조건부 emit 을 반영하지 못해 "이벤트는 항상 발행된다" 는 거짓 보장을 계속 서술한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4869-4871` (JSDoc, 이번 diff 의 문맥 밖 — 수정되지 않음) vs 같은 함수 본문의 신규 코드 `:4895-4901` (게이트 숫자, 이번 diff)
  - 상세: 이 함수 바로 위 JSDoc 은 *"emit 은 반환값과 무관하게 항상 발행한다 — … 이 헬퍼가 유일한 알림 지점인 경우가 있다"* 라고 명시적으로 서술한다. 그런데 이번 diff 가 추가한 코드(`:4895-4901`)는 정확히 그 반대다 — `persisted` 가 `false` 면 `this.logger.warn(...)` 후 `return` 해 `emitCancellationEvent` 호출( `:4903`)에 **도달하지 않는다**. 즉 "이벤트 발생 여부" 라는 이 함수의 핵심 side-effect 계약이 코드에서는 바뀌었는데 인접 문서(JSDoc)는 갱신되지 않아 서로 모순인 채로 남았다.
    이 PR 은 사실 같은 종류의 결함을 이미 한 번 발견하고 고쳤다 — `spec/conventions/node-cancellation.md` 의 동일 함수 서술("guarded UPDATE 가 이미 terminal 인 행을 걸러낸다")이 emit 미소비 한계를 언급하지 않아 과대서술이었다는 점을 `(2026-08-15 정정)` 노트로 명시적으로 고쳤다(diff `spec/conventions/node-cancellation.md:213-217`). 그런데 정작 그 함수 옆의 소스 코드 JSDoc 에는 같은 정정이 반영되지 않았다 — spec 문서만 고치고 코드 주석은 놓친, 같은 정정이 두 자리 중 한 자리에만 적용된 형태다. 함수가 `private` 라 외부 API 파손은 아니지만, 이후 호출부를 추가하거나 리팩터링하는 개발자가 이 JSDoc 만 보고 "이 헬퍼는 항상 emit 한다" 고 오판할 수 있다.
  - 제안: JSDoc 의 해당 문단을 "emit 은 `updateExecutionStatus` 반환값이 `true` 일 때만 발행한다 — `false`(동시 writer 선점)면 재마킹·emit 을 모두 skip 한다(2026-08-15)" 로 정정. `spec/conventions/node-cancellation.md` 에 적용한 것과 동일한 취소선+정정노트 패턴을 그대로 쓰면 일관적이다.

## 확인했으나 문제 없음 (부작용 관점에서 의도적/영향 없음으로 판단)

- **이벤트 발행 조건 변경 자체** (`finalizeCancelledExecution`, `execution-engine.service.ts:4891-4903`) — `EXECUTION_CANCELLED` 발행이 무조건 → `persisted` 조건부로 바뀐다. 관측 가능한 외부 동작 변경(수신자가 특정 레이스 상황에서 이벤트를 **덜** 받게 됨)이지만, CHANGELOG(`CHANGELOG.md:66-67` 게이트)·plan(`plan/in-progress/eia-db-wire-invariant.md`)에 "수신자 영향" 으로 명시적으로 고지됐고, 이 함수의 두 호출부(`:2783`, `:4787`) 모두 반환값을 쓰지 않는 `void` 소비라 시그니처·호출자 영향은 없다. `updateExecutionStatus` 자체의 시그니처(`Promise<boolean>`)는 이번 diff 이전부터 이미 그 형태였다 — 이번 변경은 기존에 버려지던 반환값을 소비하기 시작한 것뿐이다.
- **`execution` 파라미터의 in-place mutation** (`retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기, `:657-678`) — `RETURNING` 으로 받은 DB 영속값을 `execution.durationMs`/`execution.finishedAt` 에 되쓴다. 함수 시그니처가 참조로 받는 객체를 수정하는 부작용이지만, 호출자(`failRetryExecution`, `:954-1006`)가 그 직후 같은 `execution` 객체로 `emitExecution` payload 를 만드는 용도로만 재사용하며 다른 곳으로 해당 참조가 전파되는 경로는 없다(같은 파일 내 `completeRetryExecution` 은 별도 `execution` 인스턴스). 의도된 "DB=wire" 동기화 목적과 정확히 일치한다.
- **`toFiniteNumber(row?.duration_ms)` 가 `null` 인 경우** — 되쓰기를 건너뛰어 mutation 전 로컬 값(T2)이 그대로 emit 된다(조용한 폴백, 별도 로그 없음). 이번 diff 의 핵심 결함(§6.5 "알려진 예외 1건")이 재현되는 경로이긴 하나, `RETURNING` 이 정상 동작하는 한 발생하지 않고 방어적 폴백이라 CRITICAL 급은 아니다 — 별도 항목으로 등재할 정도는 아니라고 판단(INFO 이하).
- **`execution-status-response.dto.ts` 에 `durationMs` 필드 추가** — 공개 REST 응답(`GET /api/external/executions/:id`)의 인터페이스 변경이지만 additive(optional, nullable)이라 기존 클라이언트 파서와 호환. 신규 로직·계산 없음(영속 컬럼 그대로 노출).
- **`interaction.service.ts` 의 `STATUS_PROJECTION_COLUMNS` 배열에 `'durationMs'` 추가** — 모듈 스코프 상수 배열이지만 SELECT 프로젝션 목록일 뿐 mutable shared state 가 아니고, `readonly` 로 쓰이는 관용구(`satisfies (keyof Execution)[]`)라 런타임 mutation 위험 없음.
- **로거 신규 호출** (`this.logger.warn(...)`, `execution-engine.service.ts:4896-4900`) — 새 로그 라인 발생은 있으나 표준 NestJS Logger 사용, 파일시스템/외부 서비스 직접 접근 없음.
- **테스트 mock 확장** (`returning: jest.fn().mockReturnThis()` 등) — 기존 `createQueryBuilder` mock 체인에 메서드를 추가하는 것뿐이라 다른 테스트에 영향 없음. `eventEmitter`/`service` 는 파일 전역 `beforeEach` 로 매 테스트 재생성되므로(`execution-engine.service.spec.ts:255`, 주석 `:726` 확인) 신규 `jest.spyOn(eventEmitter, 'emitExecution')` 이 테스트 간 누수되지 않는다.
- **환경변수·네트워크 호출·신규 전역 변수** — 이번 diff 전체(코드 6개 파일)에서 `process.env`/`console.*`/`global`/신규 module-level mutable 변수 도입 없음. 신규 외부 서비스 호출 없음(기존 `eventEmitter.emitExecution` 경로 재사용).
- **CHANGELOG.md·plan/*.md·review/*.md·spec/*.md** — 전부 문서/산출물 파일이며 코드 실행 경로에 영향 없음. `review/consistency/2026/08/15/13_43_10/**` 는 별도 세션(consistency-checker)의 정규 산출물로 이 작업 자체의 부작용이 아니다.

## 요약

이번 diff 의 핵심 부작용은 `finalizeCancelledExecution` 의 이벤트 발행을 무조건 → `persisted` 조건부로 바꾼 것과, retry-turn `finalizeGuarded` 가 `RETURNING` 값을 `execution` 파라미터에 되쓰는 것 두 가지다. 둘 다 CHANGELOG·plan·spec 문서에 명시적으로 고지된 의도된 변경이고, 호출부·시그니처·전역 상태에 미치는 영향도 추적 가능한 범위 안에 있다. 유일한 실질 발견은 `execution-engine.service.ts:4869-4871` 의 JSDoc 이 정확히 같은 라운드에 `spec/conventions/node-cancellation.md` 에서는 고친 "emit 이 항상 발행된다" 는 과대서술을 소스 코드 쪽에는 반영하지 못하고 남겨 둔 것 — 같은 정정이 두 자리 중 한 자리에서만 적용된 상태다. 런타임 동작에 영향은 없지만 이 함수의 side-effect 계약을 잘못 전달할 수 있어 WARNING 으로 기록한다.

## 위험도

LOW
