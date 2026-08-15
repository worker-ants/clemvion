# 부작용(Side Effect) 리뷰 — `finalizeStalledExhausted` 트랜잭션 원자화 (W1 하드닝 반영)

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`(3340행 부근)의 Execution/NodeExecution 두 UPDATE 를 `dataSource.transaction()` 으로 원자화(자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형). 이번 라운드 추가분은 인라인 주석을 JSDoc 참조로 축약한 것뿐(6줄 diff).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `installStalledTx` 헬퍼 + Execution UPDATE `WHERE id` 단언 추가(트랜잭션 테스트·성공 테스트 양쪽).
- `CHANGELOG.md`, `plan/in-progress/eia-stalled-atomicity.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/update-returning-tuple-shape.md`, `plan/complete/eia-db-wire-invariant.md`, `review/**`(직전 라운드 산출물 커밋) — 전부 문서/프로세스 산출물, 런타임 부작용 없음.

`git diff origin/main..HEAD -- 'codebase/**' --stat` 로 실측: production/test 코드 변경은 위 두 파일뿐(144줄, +94/+106 vs -11/-56 net). 나머지는 전부 `plan/`·`review/`·`CHANGELOG.md`.

## 발견사항

- **[INFO]** 신규 WHERE 단언 추가는 코드 동작을 바꾸지 않는 테스트 전용 변경 — production 부작용 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (`installStalledTx` 사용처 — Execution `execQb.where` 단언 추가), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 는 이번 라운드 diff 에서 주석 문구만 변경(코드 로직·이벤트·시그니처 불변)
  - 상세: 이번 라운드가 추가한 것은 (a) 테스트에 `expect(execQb.where).toHaveBeenCalledWith('id = :id', {...})` 단언, (b) production 코드의 인라인 주석을 "근거는 위 JSDoc 참조" 로 축약. 둘 다 실행 경로·전역 상태·이벤트 emit·시그니처에 영향 없다.
  - 제안: 없음.

- **[INFO]** (직전 라운드부터 유지) `finalizeStalledExhausted` 는 diff 전후 모두 함수 레벨 `try/catch` 가 없어, `dataSource.transaction()` 이 throw 하면 예외가 그대로 호출자로 전파된다 — 유일한 프로덕션 호출부만 확인 필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeStalledExhausted` 전체(트랜잭션 호출은 함수 본문 중앙, `await this.dataSource.transaction(async (manager) => {...})`), 대조 `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:88` (`void this.engine.finalizeStalledExhausted(executionId).catch((err_) => {...})`)
  - 상세: 자매 `cancelParkedExecution`·`markWebChatIdleTimeout` 은 함수 전체를 `try{...}catch{logger.error}` 로 감싸 DB 오류를 내부 흡수하지만, 이 함수는 여전히 감싸지 않는다(diff 이전부터 이 구조 — 이번 PR 이 만든 회귀 아님, `git diff origin/main..HEAD` 로 대조 확인). 유일한 프로덕션 호출부인 `ExecutionRunProcessor.onFailed`(non-async, `@OnWorkerEvent('failed')`)가 `.catch()` 로 이미 예외를 흡수·로깅하므로 unhandled rejection 은 발생하지 않는다. 다른 호출부는 존재하지 않는다(`grep -rl finalizeStalledExhausted codebase/backend/src` 로 확인: 정의·spec 두 곳 + 이 processor 뿐).
  - 제안: 조치 불요 — 이미 database.md/maintainability.md 리뷰어가 별도로 지적한 사안과 같은 결이라 중복 등재하지 않음. 향후 이 함수를 재차 손댈 때 "왜 여기만 caller-side 흡수인가"를 문서에 한 줄 남기면 재조사 비용을 줄일 수 있다는 점만 참고.

- **[INFO]** 이벤트 emit 시점(로그 warn 포함)이 "cascade UPDATE 실행 전"에서 "트랜잭션 커밋 후"로 이동했지만 관측 가능한 최종 결과는 동일
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `this.logger.warn(...)` 호출과 `this.finalizeRehydrationCleanup(executionId)` / `await this.eventEmitter.emitExecution(...)` 블록(트랜잭션 콜백 종료 직후)
  - 상세: 변경 전엔 `logger.warn` 이 Execution UPDATE 커밋 직후·NodeExecution cascade UPDATE 실행 **전**에 찍혔다. 변경 후엔 두 UPDATE 가 커밋된 **후**에만 찍힌다 — 즉 둘째 UPDATE(또는 트랜잭션 전체)가 실패하면 이제는 이 경고 로그 자체가 찍히지 않는다(예외가 caller `.catch()` 의 error 로그로 대체). 이는 원자성 수정의 자연스러운 부수 결과이며, 로그는 이벤트 계약도 전역 상태도 아니므로 side-effect 관점에서 문제되지 않는다. `emitExecution` 인자(이벤트 타입 `EXECUTION_FAILED`, payload shape, `stalledDurationMs`)는 이번 diff 로 값·순서·조건 모두 불변.
  - 제안: 없음(정보성 확인). 로그 타이밍 변화가 알람/모니터링 매칭 로직에 의존성이 있다면(예: 이 warn 로그를 별도로 스크래핑하는 외부 도구) 확인이 필요하지만 코드베이스 내에서 이 로그 문자열을 파싱하는 곳은 발견되지 않았다.

- **[INFO]** 테스트 mock 재정의(`installStalledTx`, `service.dataSource.transaction` spy 치환)는 `beforeEach` 로 매 테스트 재생성되어 테스트 간 상태 누수 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `installStalledTx` 정의부, 최상위 `beforeEach`(`Test.createTestingModule` 로 `service` 재컴파일)
  - 상세: 직전 라운드 side_effect 리뷰(`review/code/2026/08/15/16_19_26/side_effect.md`)에서 이미 확인된 사실이며 이번 라운드 diff 는 이 구조를 바꾸지 않았다. `service`(및 그 안의 `dataSource` mock)가 매 테스트 새로 컴파일되므로 한 테스트의 throw-무장이 다음 테스트로 전이되지 않는다.
  - 제안: 없음.

전역 변수 신설/수정, 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 쓰기, 공개 함수 시그니처(`finalizeStalledExhausted(executionId: string): Promise<void>` 불변) 변경, 신규 네트워크 호출은 발견되지 않았다. `this.dataSource` 는 생성자에서 이미 주입돼 있던 의존성(775행)을 그대로 재사용하며, 자매 두 함수가 이미 프로덕션에서 쓰는 것과 동일한 API(`DataSource.transaction`)다.

## 요약

이번 라운드(`16_31_53`)의 실질 변경은 직전 라운드(`16_19_26`)가 이미 검토한 트랜잭션 원자화에 대해 (1) Execution UPDATE 의 `WHERE id` 를 단언하는 테스트 2건 추가, (2) production 코드의 중복 인라인 주석을 JSDoc 참조로 축약한 것뿐이다. 둘 다 실행 경로·전역 상태·이벤트 payload·함수 시그니처·환경 변수·네트워크 호출에 영향을 주지 않는다. 기존에 확인된 사실(함수 레벨 try/catch 부재는 diff 이전부터 있던 구조이고 caller 의 `.catch()` 가 흡수, 로그 타이밍이 트랜잭션 커밋 후로 이동했지만 최종 관측 상태는 동일, 테스트 mock 재정의는 `beforeEach` 로 스코프가 닫혀 있음)은 이번 diff 로도 변하지 않았다. 부작용 관점에서 CRITICAL/WARNING 급 문제는 발견되지 않았다.

## 위험도

NONE
