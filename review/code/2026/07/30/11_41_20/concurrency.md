# 동시성(Concurrency) 리뷰 — retry_last_turn 재진입 원자 claim

## 스코프

`codebase/backend/src/modules/execution-engine/retry-turn.service.ts` +
`retry-turn.service.spec.ts`. `main` 대비 diff(커밋 `b351731f0`, `414550a1d`)는
`applyRetryLastTurn` 재진입 가드를 조건부 UPDATE 기반 원자 claim
(`claimSpawnedRetryRow`)으로 교체하고, 직전 라운드(`review/code/2026/07/28/20_32_57`)가
지적한 **claim 삽입 위치 결함 2건**(CRITICAL #1: claim이 "손상 판정"보다 뒤에 있어 살아있는
delivery를 오판, CRITICAL #2: claim 성공 후 in-memory `_retryState` 미동기화로 stale
`save()`가 DB의 원자 제거를 부활)을 수정한 것이 이번 변경의 실체다. 이 파일은 이미
6라운드에 걸쳐 concurrency 관점 리뷰·mutation 검증(`plan/in-progress/retry-turn-terminal-guard.md`
§코드 표)을 거쳤으므로, 본 리뷰는 (a) 이번 수정 자체의 정확성을 독립적으로 재검증하고 (b)
그 라운드들이 놓쳤을 수 있는 새 결함이 있는지를 중심으로 본다.

## 발견사항

- **[INFO]** CRITICAL #1(claim 순서) 수정 확인 — 정확함
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:308-348` (`applyRetryLastTurn`), 특히 `:324`(`const claimed = await this.claimSpawnedRetryRow(...)`)와 `:337`(`if (!retryState)`)
  - 상세: 이전 버전(`b351731f0`)은 in-memory `retryState`(claim 이전에 읽은 값) 부재를 먼저 판정해 무가드 `save()`로 FAILED 마킹했다. 현재는 순서가 뒤바뀌어 (1) 원자 claim 실행 → (2) 실패 시 원인 구분 없이 discard(`:325-336`) → (3) claim 성공 후에야 `!retryState` 방어 분기(`:337-347`, 로그만 남기고 discard)를 본다. `claimSpawnedRetryRow`(`:520-533`)의 WHERE 절이 `status = 'running'`과 `jsonb_exists(input_data, '_retryState')`를 **하나의 UPDATE 문**에 걸어 두 조건을 원자적으로 평가하므로, 두 delivery가 동시에 같은 row를 두고 경합해도 정확히 하나만 `affected=1`을 받는다 — Postgres 행 잠금 기반의 올바른 CAS(compare-and-swap) 패턴이다. 코드 추적 결과 "claim 성공(`affected=1`)인데 in-memory `retryState`가 undefined"인 조합은 이 파일이 통제하는 쓰기 경로 안에서 구조적으로 재현 불가능하다는 JSDoc(`:337-347`, `:502-514`)의 주장이 타당함을 확인했다.
  - 제안: 없음(정확). 참고로 `retry-turn.service.spec.ts`의 `(c)` 케이스(`:441-463`)와 "claim 성공 후 try 진입 전 예외 → 재배달" 케이스(`:471-509`)가 이 순서를 mutation 수준으로 고정하고 있다.

- **[INFO]** CRITICAL #2(in-memory 동기화) 수정 확인 — 정확함
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:356` (`delete spawnedRow.inputData[RETRY_STATE_KEY];`)
  - 상세: 이 delete가 claim 성공 직후·후속 `Promise.all` 이전에 동기적으로 실행되어, execution/node not-found 분기(`:373`, `:385`의 `save(spawnedRow)`)가 참조하는 in-memory 엔티티에서 이미 키가 제거된 상태를 보장한다. `retry-turn.service.spec.ts`의 `(d)`/`(e)` 케이스가 `save()`에 전달된 엔티티의 `inputData._retryState`가 `undefined`임을 직접 단언(`:526-530`, `:548-552`)해 회귀를 잠갔다.
  - 제안: 없음(정확).

- **[INFO]** async/await·인터페이스 계약 정합성 — 이상 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 전체, 특히 `applyRetryLastTurn`의 `Promise.all([...])`(`:360-363`), `this.driver.buildRetryReentryState(...)`(`:397-405`, 동기 반환), `this.contextService.setNodeOutput(...)`(`:409-415`, `void` 반환)
  - 상세: `engine-driver.interface.ts`와 대조한 결과 `updateExecutionStatus`/`rehydrateContext`/`loadAndBuildGraph`/`runNodeDispatchLoop`는 `Promise<...>`를 반환하고 전부 `await` 처리됐으며, `contextKeyOf`/`buildRetryReentryState`/`findActivatedBackEdge`/`clearLlmDefaultConfigCache`는 동기(non-Promise) 반환이고 실제로 `await` 없이 호출된다. 누락된 await나 불필요한 await는 발견되지 않았다.
  - 제안: 없음.

- **[INFO]** `finalizeGuarded`의 낙관적 동시성 패턴 — 재확인, 새 결함 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:555-660`
  - 상세: 이번 diff가 건드리지 않은 pre-existing 코드지만 같은 파일의 핵심 동시성 choke point라 함께 추적했다. SELECT(`live`, `:561`)로 정본을 읽고, 멱등/전이 판정을 그 값 기준으로 내린 뒤, 최종 쓰기는 항상 `andWhere('status = :status', { status: target|live.status })`로 **그 판정 시점의 상태를 조건으로 건 guarded UPDATE**를 쓴다(`:614-625`, `:629-639`, `driver.updateExecutionStatus` 내부). SELECT~UPDATE 사이에 상태가 바뀌면 `affected=0`으로 정확히 무효화되므로 TOCTOU 창이 닫혀 있다. CANCELLED 멱등 분기의 `COALESCE(finished_at, ...)`/`COALESCE(duration_ms, ...)`(`:617-618`)도 "그 순간의 DB 값"을 SQL 레벨에서 재평가하는 동일 원칙이다. 4라운드에 걸친 기존 리뷰·mutation 검증과 별개로 독립 재추적한 결과 새로 발견된 이슈는 없다.
  - 제안: 없음.

- **[INFO]** 알려진 잔여 갭 — 이미 `plan/in-progress/retry-turn-terminal-guard.md`에 추적됨(신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:520-533` (`claimSpawnedRetryRow`)
  - 상세: (1) 표 #15(P2) — claim 실패 시 discard 후 spawn row가 RUNNING orphan으로 영구 잔류할 수 있고, `recoverStuckExecutions`의 `failOrphanRunningNodeExecutions` 백스톱은 이미 terminal(`failed`)인 Execution 경로에는 닿지 않는다. 코드 추적 결과 이 갭은 claim **실패** 분기(`:325-336`)뿐 아니라, 구조적으로 도달 불가능하다고 확정된 "claim 성공 + in-memory retryState 부재" 방어 분기(`:337-347`)에도 동일하게 적용된다 — 후자는 실제로는 발생하지 않으므로 실질 위험 증가는 아니지만, 같은 트레이드오프 서술이 두 분기 모두에 해당함을 참고로 남긴다. (2) 표 #3(P2) — 이 원자 claim의 SQL 조건(`status = 'running' AND jsonb_exists(...)`)이 실 Postgres 동시 UPDATE 하에서 정확히 1/0을 반환하는지는 unit(mock)·e2e 어느 계층에서도 검증되지 않았다(`grep` 결과 `retry_last_turn` 관련 e2e 스펙 없음). 두 항목 모두 기존 6라운드 리뷰가 이미 식별해 plan에 P2로 등재·defer한 것으로, 본 리뷰가 새로 발견한 결함이 아니다.
  - 제안: 별도 조치 불요(이미 plan에 등재·의도적 defer). 후속 착수 시 해당 plan 항목을 참조.

## 요약

이번 diff는 이전 ai-review 라운드(2026-07-28, 14명 reviewer·3개 독립 수렴)가 지적한 원자 claim의 **삽입 위치 결함 2건**(claim이 손상 판정보다 늦게 실행되어 살아있는 delivery를 오판하는 문제, claim 성공 후 in-memory 미동기화로 stale `save()`가 DB의 원자 제거를 되돌리는 문제)을 코드·순서·in-memory 동기화 세 측면에서 독립적으로 재추적했고, 두 수정 모두 정확함을 확인했다 — `claimSpawnedRetryRow`의 단일 조건부 UPDATE(`status='running' AND jsonb_exists(...)`)가 진짜 레이스 결정자로 기능하고, 그 결과를 caller가 즉시 in-memory에 반영해 하위 `save()` 경로를 오염시키지 않는다. async/await 사용, `finalizeGuarded`의 낙관적 동시성(guarded UPDATE) 패턴에서도 새로운 결함은 발견되지 않았으며, 41개 unit 테스트가 전부 통과했다. 잔여 항목(orphan RUNNING row 백스톱 부재, 실 Postgres 동시성 미검증)은 이미 `plan/in-progress/retry-turn-terminal-guard.md`에 P2로 추적·defer된 기지정 갭이라 이번 리뷰의 신규 발견으로 청구하지 않는다.

## 위험도

LOW
