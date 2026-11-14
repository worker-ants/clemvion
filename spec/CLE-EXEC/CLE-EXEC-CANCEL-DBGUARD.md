---
id: "CLE-EXEC-CANCEL-DBGUARD"
title: "노드 취소 — DB 관측 취소 가드"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EXEC-CANCEL"
ancestors: ["CLE-VISION", "CLE-EXEC", "CLE-EXEC-CANCEL"]
area: "CLE-EXEC"
content_hash: "e7db7e1e4d4e3c5436ed641a29eb7915934ef61a9be2d4507a389af3ecfcd933"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "dd1ef8ad6602dd207706636c3449aceb57d5912635a3a22dc772e316b13a1c11"
etag: "sha256-4501aae4f2ad01e1683a88be3a955c3fd94e3281ef0041852908449b33be6eb2"
---
## 개요

이 문서는 [노드 취소](CLE-EXEC-CANCEL.md) 의 하위 문서로 신호를 만들지 않는 취소(사용자 실행 중지)를 엔진이 DB 를 다시 읽어 알아채는 방식을 정한다. 규칙 번호는 부모 문서와 이어지는 10~17 이다.

## DB 관측 취소 가드

[신호를 만드는 쪽](CLE-EXEC-CANCEL.md#신호를-만드는-쪽) 의 신호 생산자와 **메커니즘이 다르다**. 두 메커니즘을 섞으면 "신호 사전 확인이 있으니 실행 중지도 걸린다" 는 오해가 생기고 실제로 그 오해가 결함의 배경이었다.

| | 취소 신호(`abortSignal`) | DB 관측 |
| --- | --- | --- |
| 신호 | 표준 `AbortSignal` API | 실행 행 `status` 다시 읽기 |
| 알아채는 쪽 | 핸들러가 `signal.aborted` 를 읽거나 SDK·fetch 에 넘김 | 엔진이 경계마다 DB 를 다시 읽음 |
| 필요한 이유 | 병렬 분기 취소 | `abortSignal` 은 `ParallelExecutor` 가 분기 컨텍스트에만 넣어 선형 경로에서는 늘 `undefined` 다. 실행 중지는 신호를 만들지 않으므로 다시 읽기가 유일한 수단이다 |
| 던지는 것 | `error.name === 'AbortError'`(핸들러) | `ExecutionCancelledError`(엔진, `workflow-errors.ts`) |

10. **노드 경계 확인**(구현됨 2026-07-26): `assertExecutionNotCancelled()` 를 dispatch 순회 루프 세 곳(`runExecution`·`runNodeDispatchLoop`·`executeInline`)과 컨테이너·Parallel 반복(`executeContainerBody` 항목 경계, `executeParallelBranchBody` 노드 경계)에서 부른다. 바깥 취소를 보면 `ExecutionCancelledError` 로 dispatch 를 멈춘다.
11. **컨테이너 항목 경계는 250ms 로 묶는다**: 컨테이너 안에서는 항목 경계마다 확인한다. `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250` 안에 다시 부르면 직전 결과를 쓴다. 선형 노드 경계와 Parallel 분기 노드 경계는 묶지 않고 매번 조회한다.
12. **턴 경계 확인**(구현됨 2026-07-27): 멀티턴 AI 는 턴마다 park 로 세그먼트가 끝나 노드 경계 확인에 닿지 않는다. 그래서 `AiTurnOrchestrator` 가 **턴 경계**에서 같은 가드를 직접 부른다. 이 호출은 턴 실패를 `FAILED` 로 마감하는 try/catch **바깥**에 있어야 한다. 안에 두면 취소가 실패로 잘못 분류된다.
13. **park·재개 짝 전이의 종결 가드**(구현됨 2026-07-27): 실행과 노드 실행을 한 트랜잭션으로 옮기는 경로는 같은 트랜잭션에서 대상 행을 `SELECT … FOR UPDATE` 로 잠그고 **비종결 상태를 확인한 뒤에만** 쓴다. 확인 없이 쓰면 턴 진행 중 도착한 실행 중지가 덮여 **취소가 사라진다**. 선점을 보면 짝 노드 실행을 `cancelled` 로 표시한 뒤 `ExecutionCancelledError` 를 전파한다. 이 가드를 쓰는 곳은 짝 전이, `finalizeFailedExecution`, `failFirstSegmentSetup`, `executeSync` 타임아웃이다. 마지막 턴 재시도 재진입에 한해 비종결 판정에 `failed` 가 조건부로 들어간다(`allowRetryReentry` opt-in). 자세한 내용은 [실행 상태 머신과 대기·재개](CLE-EXEC-STATE.md) 의 원자성 보장에 있다.
14. **마지막 턴 재시도 종결 가드**(구현됨 2026-07-28): 재진입의 종결(`completed`·`failed`·`cancelled`)은 메모리 엔티티를 믿지 않는다. 재진입 전이(`failed → running`)가 **다른 엔티티 인스턴스**에 적용돼 종결 시점의 메모리 `status` 가 낡았을 수 있다. 그래서 종결 직전에 **행을 다시 읽어 비종결을 확인**하고 그 상태에서 목표로 옮길 수 없거나 조건부 UPDATE 가 0행이면 **저장과 종결 이벤트 발행을 모두 건너뛴다**. 확인 없이 쓰면 턴 진행 중 도착한 실행 중지가 `failed`·`completed` 로 덮여 취소가 사라진다. `retry-turn.service.ts` 의 `completeRetryExecution`·`failRetryExecution` 이 공용 `finalizeGuarded` 로 처리한다.
15. **최상위 취소 종결 가드**(`finalizeCancelledExecution`): 조건부 UPDATE(`status IN (비종결)`)가 0행이면 **행을 다시 읽어 DB 값으로 가른다**. 이미 `CANCELLED` 면 **이벤트를 낸다**. `stop()` 은 `running`·`pending` 경로에서 이벤트를 내지 않으므로 여기가 유일한 알림 지점이다. 다른 종결자가 `FAILED`·`COMPLETED` 로 먼저 마감했으면 건너뛴다. 형제 `finalizeFailedExecution` 은 진입만 같고 0행 뒤의 방향이 반대다. 그쪽은 "덮어쓰지 말라" 가 목적이라 무조건 건너뛴다. 새 취소 마감 경로를 만들 때 무조건 건너뛰기를 기본으로 가정하지 않는다.
16. 이미 `cancelled` 인 행에 종결 경로가 다시 닿아도 **먼저 커밋된 취소 시각(`finishedAt`·`durationMs`)이 기준**이다. 취소할 때 `error` 는 저장하지 않는다. 취소를 실패와 가르고 REST 로 내부 예외 메시지가 나가지 않게 하려는 것이다.
17. 규칙 13~15 의 조건부 UPDATE 를 `.query()` 로 실행한 raw `UPDATE … RETURNING` 으로 쓰면 결과는 `[rows, affectedCount]` 튜플이다. 0행 판정은 `updateReturningRows` 를 거쳐 읽는다. QueryBuilder 의 `.update().returning().execute()` 는 이 규칙의 대상이 아니다([raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md) 규칙 1·2).

## 구현 현황

2026-07-28 코드 대조 기준이다.

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| 사용자 실행 중지(`POST /api/executions/:id/stop`, 툴바 Stop) | ✅ | `executions.controller.ts`·`executions.service.ts`·`editor-toolbar.tsx`. 실행 행 UPDATE 까지가 이 행의 범위이고 dispatch 를 멈추는 것은 아래 가드 행이다. 진입점 규칙은 [노드 취소](CLE-EXEC-CANCEL.md) 규칙 7 |
| 노드 경계 취소 확인(`assertExecutionNotCancelled`) | ✅ | 선형 세 곳과 컨테이너(250ms 묶음)·Parallel 반복 루프. mutation 검증 완료 |
| 멀티턴 AI 턴 경계 취소 확인 | ✅ | `ai-turn-orchestrator.service.ts` |
| park·재개 짝 전이 종결 가드 | ✅ | `execution-engine.service.ts`. mutation 6/6. 선점을 본 소비처의 마감은 공용 헬퍼 `linked-transition-guard.ts` 가 맡는다. 짝 노드 실행을 `cancelled` 로 표시하고 `ExecutionCancelledError` 를 던진다. AI 턴 오케스트레이터와 Form·버튼 상호작용 서비스(park·재개 재claim)가 이 헬퍼를 함께 쓴다(`CLE-T-J6GRJ9`) |
| 최상위 취소 종결 가드(`finalizeCancelledExecution`) | ✅ | 회귀 테스트 세 갈래(이미 취소, 다른 종결자 선점, 다시 읽기 실패) |
| 마지막 턴 재시도 종결 가드 | ✅ | `retry-turn.service.ts`. mutation 13/13 |

남은 과제는 NERV Task 가 추적한다.

- `CLE-T-ST51H4`: 노드 경계 가드 호출 순서를 헬퍼 하나로 묶는다.
- `CLE-T-WKESFB`: 실행 엔진 테스트를 정리한다.

## 구현 위치

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`assertExecutionNotCancelled`, 짝 전이 가드, `finalizeCancelledExecution`, `markNodeCancelled`)
- `codebase/backend/src/modules/execution-engine/linked-transition-guard.ts` (`assertLinkedTransitionApplied`, 짝 전이 선점 때 짝 노드 실행 마감과 취소 전파)
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (턴 경계 가드)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (`finalizeGuarded`)
- `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (`ExecutionCancelledError`)

## Rationale

### 사용자 실행 중지는 DB 관측으로 알아챈다 (2026-07-27)

사용자 실행 중지(`POST /api/executions/:id/stop`)는 **`AbortController` 를 만들지 않고** 실행 행을 UPDATE 할 뿐이다. `context.abortSignal` 을 채우는 곳은 `parallel-executor.ts`(cancel-others-on-fail) 하나뿐이라 **선형 경로와 재개 경로에서 `context.abortSignal` 은 늘 `undefined`** 다. "신호를 전파하면 된다" 는 접근은 전파할 신호가 없어 성립하지 않는다. 엔진이 경계마다 행을 다시 읽는 것이 유일한 수단이다.

그래서 `context.abortSignal?.throwIfAborted()` 는 실행 중지의 보장 근거가 되지 못하고 "타임아웃으로 완화된다" 는 판단도 틀렸다. 실제 결함은 취소가 사라지는 것이었다. 2026-07-26 이전에는 노드 경계 가드가 없어 실행 중지 뒤에도 하류 노드가 계속 dispatch 됐다.

### 짝 전이에 종결 가드를 둔다 (2026-07-27)

park·재개 경로는 실행을 메모리에 읽은 뒤 **다시 읽지 않는다**. 그래서 턴이 도는 동안(LLM 호출은 수 초에서 수 분) 도착한 실행 중지가 DB 를 `cancelled` 로 바꿔도 메모리 엔티티는 `running` 이고 상태 전이 검사는 `running → waiting_for_input` 을 정상으로 통과시킨다. 가드가 없으면 그 쓰기가 `cancelled` 를 덮어 **사용자가 누른 실행 중지가 그대로 사라진다**.

같은 트랜잭션 안에서 행을 잠그는(`SELECT … FOR UPDATE`) 것은 확인과 쓰기 사이의 창을 없애기 위해서다. 다시 읽기와 쓰기를 따로 하면 그 사이에 실행 중지가 끼어들 수 있다.

### 취소 시각을 지키는 방식이 두 가지다 (2026-07-28)

이미 `cancelled` 인 행에 종결 경로가 다시 닿을 때 `stop()` 이 쓴 `finishedAt`·`durationMs` 를 지키는 방식이 소비자마다 다르다.

- `finalizeCancelledExecution` 은 **앱 수준 `??` 병합**을 쓴다. 메모리 값이 비었을 때만 채운다. 조건부 UPDATE 가 0행이면 행을 다시 읽어 DB 가 `CANCELLED` 면 이벤트를 내고 다른 종결이면 건너뛴다.
- `finalizeGuarded`(마지막 턴 재시도)는 **SQL `COALESCE(col, :new)`** 를 쓴다. 다시 읽기(`SELECT`)와 `UPDATE` 사이의 창을 믿지 않으려는 것이다. UPDATE 문이 그 순간의 DB 값을 다시 평가하므로 그 사이 다른 트랜잭션이 값을 채웠어도 덮지 않는다. 앱 수준 병합은 `SELECT` 시점 스냅샷으로 판단하므로 같은 창을 닫지 못한다.

두 방식 모두 "먼저 커밋된 취소 시각이 기준" 이라는 같은 계약을 지킨다.

`finalizeCancelledExecution` 의 0행 처리는 2026-08-15 에 두 번 고쳤다. 처음에는 호출자가 UPDATE 결과를 읽지 않아 이미 선점된 실행에도 `EXECUTION_CANCELLED` 가 나갔다. 1차 수정은 형제 `finalizeFailedExecution` 을 그대로 따라 0행이면 무조건 건너뛰게 했는데 그러자 **사용자가 누른 실행 중지가 바깥에 알려지지 않았다**. `stop()` 이 `running`·`pending` 경로에서 이벤트를 내지 않아 이 함수가 유일한 알림 지점이었기 때문이다. 그래서 0행의 두 가지 뜻(`stop()` 이 이미 마감함, 다른 종결자가 이김)을 DB 에 실제로 남은 값으로 가르게 했다. UPDATE 가 썼는지만으로는 둘을 가를 수 없다.

### 컨테이너 항목 경계 확인을 250ms 로 묶는다

`assertExecutionNotCancelled` 는 컨테이너(ForEach·Loop·Map)에서 **항목 경계마다** 불린다. ForEach 입력 배열에는 길이 상한이 없고 중첩 컨테이너는 곱으로 늘어나, 묶지 않으면 항목 수에 비례하는 순차 DB 왕복이 쌓인다.

개수 기준(예: N 개마다 한 번)은 항목마다 걸리는 시간이 고르지 않아 기각했다. 빠른 항목 1000개와 느린 항목 10개에서 같은 개수가 전혀 다른 지연을 뜻한다. 시간 기준은 "취소 관측이 최대 250ms 늦어진다" 는 상한을 항목 특성과 상관없이 보장한다.

### 0행 분기가 넉 달 동안 닿지 않았다 (2026-08-30)

규칙 13·14 의 "조건부 UPDATE 가 0행이면 건너뛴다" 판정에 쓴 반환값은 `[rows, affectedCount]` 튜플이었다. 그래서 `length > 0` 이 늘 참이었고 0행 분기는 운영에서 닿지 않았다. `8332d9a20`(2026-08-13)이 고쳤다.

영향은 좁다. 노드 경계와 턴 경계의 `assertExecutionNotCancelled()` 는 반환값으로 가르지 않아 영향이 없다. 짝 전이의 `SELECT … FOR UPDATE` 잠금 자체도 정상 동작했다. 영향을 받은 것은 짝 전이의 "0행이면 건너뜀" 과 마지막 턴 재시도 종결의 "0행이면 저장·발행 모두 건너뜀" 이다. 원인은 소비자들이 함께 쓰는 드라이버 메서드(`updateExecutionStatus`) 한 곳이었다. `finalizeCancelledExecution` 은 반환값으로 가르기 시작한 것이 수정 뒤(2026-08-15)라 영향 밖이다.

위 [구현 현황](#구현-현황) 표의 mutation 6/6·13/13 은 드라이버 mock 경계 **안쪽**의 로직 검증이다. mock 이 불리언을 정직하게 돌려주는 세계에서 가드 로직은 옳았다. 그러나 그때 실제 드라이버는 튜플을 행 배열로 오해해 늘 참을 돌려줬다. "mutation N/N 검증" 은 로직이 옳다는 뜻이지 그 분기가 실제로 탔다는 뜻이 아니다. 헬퍼 경계 안쪽 검증은 그 경계 **밖**의 계약이 참일 때만 결론으로 이어진다. 불변식은 [raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md) 이 정한다.
