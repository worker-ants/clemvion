# 부작용(Side Effect) 리뷰 — retry_last_turn 재진입 원자 claim (커밋 b351731f0)

리뷰 대상 3파일 중 실제 코드 변경은 `retry-turn.service.ts`(`applyRetryLastTurn` 에 원자 claim
UPDATE 신설) 뿐이다. `continuation-execution.processor.ts` 는 주석만 정정(로직 무변경),
`retry-turn.service.spec.ts` 는 그 claim 을 위한 mock 보강 + 신규 테스트 2건 추가다
(`git show HEAD` 로 실제 diff 대조 확인).

## 발견사항

- **[CRITICAL]** 신설된 원자 claim UPDATE 가 제거한 `_retryState` 를, 바로 다음 두 방어 분기의
  stale full-entity `save()` 가 조용히 되살린다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:323-332`(신설
    claim) 와 상호작용하는 `:347-358`(execution not-found 분기), `:359-370`(node not-found
    분기) — 특히 `save(spawnedRow)` 호출부인 `:356`, `:368`.
  - 상세: 신설 claim(`:323-332`)은 `createQueryBuilder().update(NodeExecution).set({ inputData:
    () => "input_data - '_retryState'" })...execute()` 로 DB 의 `input_data` 컬럼에서만
    `_retryState` 키를 원자 제거한다. 그런데 이 claim 은 in-memory `spawnedRow` 엔티티(함수
    최상단 `:272-274` 에서 `findOneBy` 로 로드된 그 객체)를 갱신하지 않는다 — `spawnedRow.inputData`
    는 claim 이후에도 여전히 `_retryState` 를 포함한 옛 값이다. claim 성공 직후 `execution` 또는
    `node` 조회가 실패하면(`:347`, `:359`), 코드는 `spawnedRow.status/error/finishedAt` 만 설정한
    뒤 `this.nodeExecutionRepository.save(spawnedRow)`(`:356`/`:368`, full-entity save)를 호출한다.
    TypeORM 0.3.30(`node_modules/.pnpm/typeorm@0.3.30.../persistence/SubjectChangedColumnsComputer.js`)
    의 `computeDiffColumns` 는 jsonb 컬럼에 대해 `save()` 호출 시점에 **DB 를 다시 SELECT 해**
    (`SubjectDatabaseEntityLoader`) `databaseEntity.inputData`(claim 이후 값 = `_retryState` 없음)와
    `entity.inputData`(stale in-memory 값 = `_retryState` 있음)를 `deepCompare` 하고, 다르면
    `inputData` 를 "변경된 컬럼" 으로 포함시켜 옛(stale) 값을 그대로 다시 쓴다 — 즉 `save()` 가
    `input_data` 를 옛 값으로 덮어써 방금 claim 이 지운 `_retryState` 를 **부활**시킨다. 결과 상태는
    `status=FAILED` 인데 `inputData._retryState` 가 다시 존재하는 모순 row — 이 파일이 바로 위
    `finalizeGuarded`(`#1022`) 에서 "무가드 full-entity `save()` 는 stale in-memory 엔티티로 DB 를
    덮어쓴다" 며 극도로 경계하던 것과 **동일 결함 클래스**가, 이번 신설 claim 코드와 기존 not-found
    분기의 조합에서 새로 재발했다. (참고: `status=FAILED` 로도 같이 쓰이므로 향후 `status='running'`
    조건부 재-claim 은 막혀 즉시 중복실행으로 이어지진 않는다 — 다만 "원자 소비" 불변식 자체가
    깨지고, 이 row 를 이후 어떤 관측자가 "아직 소비 안 됨" 으로 오판할 소지가 남는다.) 현재
    `retry-turn.service.spec.ts` 의 (d)/(e) 테스트는 `mockNodeExecutionRepo.save = jest.fn()
    .mockImplementation((e) => Promise.resolve(e))` 로 순수 pass-through라, 실제 Postgres 의
    diff-and-overwrite 상호작용을 구조적으로 재현할 수 없어 이 회귀는 mock 테스트로 검출 불가능하다
    (커밋 메시지의 "mutation 4/4 RED" 는 claim 자체의 mutation 만 겨냥해 이 경로는 다루지 않는다).
  - 제안: not-found 두 분기에서 `nodeExecutionRepository.save(spawnedRow)` 대신, 이미 이 파일의
    `finalizeGuarded`/`completeRetryExecution`/`failRetryExecution` 이 쓰는 것과 동일한 패턴 —
    `createQueryBuilder().update(NodeExecution).set({ status, error, finishedAt })...execute()`
    로 **의도한 컬럼만** targeted update 하거나, `save()` 호출 전 `delete (spawnedRow.inputData as
    Record<string, unknown>)._retryState` 로 in-memory 엔티티를 claim 이후 DB 상태와 맞춰준다.

- **[WARNING]** claim 을 `Promise.all`/`rehydrateContext`/`emitNode` 보다 앞으로 당기면서, 커밋
  메시지가 명시한 "크래시 트레이드오프" 의 실제 적용 범위가 서술보다 넓어졌다 — 일반 unhandled
  exception 도 동일하게 row 를 영구 미종결로 만든다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:323-332`(claim)
    와 `:420`(로컬 `try` 시작) 사이 — `:343-346`(execution/node `Promise.all`), `:375`
    (`rehydrateContext`), `:380-388`(`buildRetryReentryState`, 동기 호출), `:392-398`
    (`setNodeOutput`), `:405-418`(`emitNode` NODE_STARTED). 이 구간 전체가 로컬 `try/catch`
    (`:420-450`) 밖에 있다.
  - 상세: 커밋 메시지는 "크래시로 중단된 턴의 BullMQ 재배달도 함께 막힌다" 를 **의도된
    트레이드오프**로 명시하고 `recoverStuckExecutions`(Execution 레벨 백스톱)를 복구 경로로
    지목한다. 그런데 claim 을 앞당긴 결과, 이 트레이드오프는 "프로세스 전체가 죽는 크래시" 뿐
    아니라 **같은 프로세스 내에서 위 구간 중 아무 곳에서나 발생하는 일반 예외**(예: 일시적 DB
    커넥션 오류로 `findOneBy` reject, `rehydrateContext`/`emitNode` 내부 버그·WS 전송 오류)에도
    동일하게 적용된다. claim 이전 코드에서는 이 구간에서 예외가 나도 BullMQ 재배달 시 아무것도
    소비되지 않은 상태라 재시도가 매번 깨끗하게 처음부터 재시도됐다(부작용 없는 재시도). claim
    이후에는 첫 시도에서 claim 이 이미 커밋되므로, 재배달된 시도는 `jsonb_exists(input_data,
    '_retryState')` 가 거짓이 되어 즉시 `affected=0 → ack-and-discard`(`:333-339`) 하고 반환한다
    — 즉 **일시적 오류였음에도 재시도가 더 이상 아무 일도 하지 않게 되어 row 가 RUNNING 으로
    영구 잔류**한다. 게다가 이 구간에서 던져지는 예외는 로컬 `try/catch` 밖이라
    `contextService.deleteContext`/`driver.clearLlmDefaultConfigCache`(`finally`, `:447-449`)도
    실행되지 않는다 — `rehydrateContext` 성공 후(컨텍스트가 `contextService` 의 Map 에 등록된
    후) `buildRetryReentryState`/`setNodeOutput`/`emitNode` 중 하나가 던지면 그 in-memory
    ExecutionContext 항목도 함께 누수돼, "live 면 재사용" 로직(`:372-374` 주석)이 이후 같은
    executionId 에 대해 잘못된/stale 컨텍스트를 재사용할 소지를 남긴다(이 Map 누수 구조 자체는
    이 diff 이전에도 있었으나, 이전엔 재시도가 매번 새로 시작해 문제가 드러날 일이 적었고 지금은
    claim 이 재시도를 막아 첫 실패가 사실상 영구화된다는 점이 새 리스크다). 현재 spec 에는 이
    구간의 예외 경로(`findOneBy` reject, `rehydrateContext`/`emitNode` throw)에 대한 테스트가
    없다.
  - 제안: (a) `recoverStuckExecutions`/`redriveStuckExecution` 이 이 시나리오(원본 Execution 은
    아직 `running` 이 아니라 이 retry 재진입 흐름 특유의 spawn row 가 RUNNING with no
    `_retryState`)까지 실제로 복구하는지 별도로 검증·문서화할 것. (b) 최소한 `rehydrateContext`
    ~ `emitNode` 구간도 claim 이후 실패 시 `spawnedRow` 를 FAILED 로 마감하는 방어 처리(또는
    try/catch 확장)를 고려. 이미 알려진 트레이드오프의 "범위" 를 명시적으로 넓혀 재확인하는
    성격이라 CRITICAL 은 아니지만, 문서화된 트레이드오프가 실제로는 서술보다 넓다는 점은
    확인·승인이 필요하다.

- **[INFO]** `continuation-execution.processor.ts` 변경은 주석 정정뿐이며 로직·분기·시그니처
  변화 없음을 실제 diff(`git show HEAD -- .../continuation-execution.processor.ts`)로 확인.
  부작용 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`
    (전체, 특히 `process()` 메서드 주변 주석 블록).

- **[INFO]** `retry-turn.service.spec.ts` 의 신규 mock(`mockNodeExecutionRepo.createQueryBuilder`
  기본값 `{ affected: 1 }`)과 신규 테스트 (b2)/(b3)는 claim UPDATE 의 SET/WHERE 절 형태만
  검증하고, 위 CRITICAL 항목이 요구하는 "claim 이후 실제 DB 재조회 시 컬럼 diff" 상호작용은
  mock 특성상 관측 대상이 아니다 — 결함이라기보다 이 리뷰가 테스트 리뷰어 영역과 겹치는 지점을
  명확히 하기 위한 참고.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:56-68`
    (`mockNodeExecutionRepo` 기본 mock), `:386-434`(신규 테스트 (b2)/(b3)).

## 요약

이번 diff 의 핵심 목적(동시 배달 시 `applyRetryLastTurn` 이중 진행을 원자 UPDATE 로 차단)은
정상 단일-delivery 경로와 진짜 동시 배달 경로 모두에서 올바르게 달성된다 — claim 이전 대비
새 전역 변수·환경 변수·네트워크 호출·공개 시그니처 변경은 없고, `continuation-execution
.processor.ts` 는 주석 정정에 그친다. 다만 claim 을 기존 코드 중간에 삽입하면서 두 가지 부작용이
새로 생겼다: (1) claim 직후 execution/node not-found 방어 분기의 stale in-memory `save()` 가
TypeORM 의 jsonb diff 메커니즘을 통해 방금 원자 제거한 `_retryState` 를 되살리는 CRITICAL 급
상태-일관성 결함(같은 파일이 다른 엔티티에 대해 이미 한 번 겪고 고친 결함 클래스의 재발이며,
mock 기반 유닛 테스트로는 구조적으로 검출 불가), (2) claim 을 Promise.all/rehydrateContext/
emitNode 보다 앞에 두어 그 구간의 일반 예외가 문서화된 "크래시 트레이드오프" 와 동일하게 row 를
영구 미종결 상태로 남기는 범위 확대(의도 자체는 이미 공개돼 있으나 그 실제 범위는 재확인 필요).
전체적으로 duplicate-processing 방지라는 1차 목표는 안전하게 달성됐지만, 병합 전 (1)의 수정은
필요하다고 판단된다.

## 위험도

HIGH
