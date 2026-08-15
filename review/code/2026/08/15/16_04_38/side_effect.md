# 부작용(Side Effect) 리뷰

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 를 `dataSource.transaction()` 으로 원자화
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 대응 테스트 하네스(`installStalledTx`) 추가/치환
- `plan/in-progress/eia-stalled-atomicity.md` (신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `spec/5-system/4-execution-engine.md` — 문서만 변경, 부작용 없음

## 발견사항

- **[INFO]** `finalizeStalledExhausted` 의 두 UPDATE 를 트랜잭션으로 묶으면서 no-op 조기 반환 지점이 바뀌었지만 관측 가능한 부작용은 동일하다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3367` (`if ((result.affected ?? 0) === 0) return;`), `:3396` (`if (!finalized) return;`)
  - 상세: 종전엔 `affected===0` 일 때 함수 자체가 즉시 `return`(로그·cascade·emit 전부 skip)했다. 변경 후엔 트랜잭션 콜백 내부에서만 `return`(빈 트랜잭션 커밋, DB 부작용 없음)하고, 바깥에서 `finalized` 플래그로 같은 skip 을 재현한다. 두 경로 모두 "이미 terminal → logger.warn / `finalizeRehydrationCleanup` / `emitExecution` 미실행" 이라는 관측 가능한 동작은 동일하게 유지된다 — 부작용 관점에서 회귀 없음. 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)와 동형 패턴이라 이 계열의 기존 관례를 그대로 따른다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** 커밋 이후 best-effort 부수효과(`finalizeRehydrationCleanup`, `emitExecution`)는 여전히 트랜잭션 밖에서 실행되며 이벤트 payload·시그니처는 이번 diff 로 변경되지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3401-3412`
  - 상세: diff 는 `emitExecution` 호출 자체(인자·이벤트 타입 `EXECUTION_FAILED`·payload shape)를 건드리지 않는다. `finalizeStalledExhausted(executionId): Promise<void>` 시그니처도 변경 없음 — 유일한 호출부(`execution-run.processor.ts:88`, fire-and-forget `.catch`)는 영향받지 않는다. 공개 API·이벤트 계약 변경 없음.
  - 제안: 없음.

- **[INFO]** 테스트 하네스의 mock throw-on-call 무장은 `beforeEach` 로 매 테스트 재생성되는 mock 에 적용되어 테스트 간 상태 누수가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `installStalledTx` (약 4879-4905행), `beforeEach`(255행 `mockExecutionRepo`/336행 인근 `mockNodeExecutionRepo` 재생성) 및 726행 주석("service 는 beforeEach 로 매 테스트 재생성되므로 mutation 누수 없음")
  - 상세: `mockExecutionRepo.createQueryBuilder`/`mockNodeExecutionRepo.createQueryBuilder` 를 "호출되면 throw" 로 재정의하고 `service.dataSource.transaction` 을 spy 로 교체하는데, `service`(및 그 안의 `dataSource` mock)가 `beforeEach` 에서 `Test.createTestingModule` 로 매 테스트 새로 컴파일되므로 다른 테스트로 오염되지 않는다. 기존 자매 패턴(`installCancelTx`, 3281행)과 동일 구조.
  - 제안: 없음.

- **[INFO]** DB 왕복(커넥션 획득) 패턴이 "두 개의 독립 autocommit UPDATE" 에서 "단일 트랜잭션 안 UPDATE 2회" 로 바뀐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3348-3395`
  - 상세: 성능/커넥션 풀 사용량 관점의 미세한 변화이나, 이미 프로덕션에서 쓰이는 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`) 와 동일한 패턴이라 신규 리스크가 아니다. side-effect 관점(전역 상태·시그니처·네트워크·이벤트)에서는 영향 없음.
  - 제안: 없음 — 필요하면 별도 성능 리뷰어 관점.

전역 변수 신설/수정, 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 쓰기, 공개 함수 시그니처·이벤트 payload 변경은 발견되지 않았다. `plan/*.md`, `spec/*.md` 변경은 문서 전용이라 런타임 부작용과 무관하다.

## 요약

이번 변경은 `finalizeStalledExhausted` 의 Execution/NodeExecution 두 UPDATE 를 이미 자매 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)가 쓰는 `dataSource.transaction` 패턴으로 원자화한 것으로, 함수 시그니처·유일 호출부(`execution-run.processor.ts`)·이벤트 emit payload·no-op 조기 반환 시 관측 가능한 동작이 모두 그대로 유지된다. 새로 도입된 전역 상태나 환경 변수, 예상치 못한 파일시스템/네트워크 부작용은 없으며, 커밋 이후 best-effort 부수효과(cleanup, emit)의 위치도 자매 패턴과 동형이다. 테스트 파일의 mock throw-on-call 무장은 `beforeEach` 재생성 덕에 테스트 간 상태 누수 없이 스코프가 닫혀 있다. 부작용 관점에서 문제될 항목은 발견되지 않았다.

## 위험도

NONE
