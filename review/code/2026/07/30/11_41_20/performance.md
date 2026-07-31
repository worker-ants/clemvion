# 성능(Performance) 리뷰 — retry_last_turn 2차 claim 삽입 위치 수정 (414550a1d)

## 리뷰 범위

`codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 전체와
`retry-turn.service.spec.ts` 를 검토했다. 현재 브랜치의 실질 변경분(커밋
`414550a1d`, origin/main 대비로는 `b351731f0` 포함 2건)은 `applyRetryLastTurn`
재진입 가드에서 기존에 이미 존재하던 원자 UPDATE claim(`claimSpawnedRetryRow`)의
**호출 순서를 재배치**하고, `RETRY_STATE_KEY` 상수화, in-memory 동기화를 위한
`delete` 한 줄 추가로 구성된 동시성 정합성 수정이다. 신규 루프·신규 DB 스키마·
신규 외부 호출은 도입되지 않았다.

## 발견사항

- **[INFO]** `applyRetryLastTurn` 가드 구간의 순차 DB 왕복 3회(SELECT → UPDATE claim → 병렬 SELECT×2)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:285`(초기 `findOneBy`), `:324`(`claimSpawnedRetryRow` 호출부, 구현은 `:520-533`), `:360-363`(execution/node `Promise.all`)
  - 상세: `applyRetryLastTurn` 은 spawned row 조회(SELECT) → 원자 claim(UPDATE) → execution/node 병렬 조회(SELECT×2) 순으로 최소 3회의 순차 DB 왕복을 거친 뒤에야 실제 재진입 작업(`rehydrateContext` 이하)을 시작한다. claim 실패 시 실행 흐름이 즉시 반환(`:325-336`)해 execution/node 조회가 아예 실행되지 않도록 이미 올바르게 배치돼 있어 낭비는 없다. 이 순차성 자체는 CAS(compare-and-swap) 정합성을 위해 불가피하며, claim 을 "손상 판정"보다 앞에 두어야 한다는 것이 바로 이번 커밋이 고친 CRITICAL 이므로 되돌릴 수 없는 제약이다.
  - 제안: 조치 불필요. 참고로 `claimSpawnedRetryRow` 의 UPDATE 에 `.returning(['inputData'])` 를 추가하면 claim 성공 시점의 최신 `inputData` 를 같은 왕복에서 회수해 이론상 왕복을 더 줄일 여지는 있으나, (a) 초기 SELECT(`:285`)는 claim 과 무관하게 "not found"/"not RUNNING" 조기 판정과 로그 메시지 구분을 위해 별도로 필요하고, (b) 이 경로는 사용자가 명시적으로 `retry_last_turn` 을 트리거한 뒤 워커가 1회 처리하는 저빈도 경로라 왕복 1회 절감의 실익이 낮다. 리팩토링 권장 대상 아님.

- **[INFO]** 이번 재배치는 성능 관점에서 중립~소폭 개선
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:337-348`(구코드의 `nodeExecutionRepository.save(spawnedRow)` 호출이 제거되고 로그 후 조기 반환으로 대체됨), `:356`(`delete spawnedRow.inputData[RETRY_STATE_KEY]`)
  - 상세: 이전 코드는 "`_retryState` 부재" 분기에서 FAILED 마킹 + 전체 엔티티 `save()`(DB 왕복 1회 추가)를 수행했다. 이번 커밋은 claim 을 그 판정보다 앞으로 옮기면서 해당 분기가 구조적으로 도달 불가능해졌고, 도달하더라도 로그만 남기고 `save()` 없이 반환하도록 바뀌었다 — 즉 이 분기에서는 오히려 쓰기 1회가 줄었다. 새로 추가된 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 는 순수 in-memory 프로퍼티 삭제(O(1))로 I/O 나 유의미한 메모리 비용이 없다.
  - 제안: 조치 불필요 — 정보성 확인.

- **[INFO]** `finalizeGuarded` 의 매 호출 시 Execution 재조회(SELECT)는 의도된 설계
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:561`(`this.executionRepository.findOneBy`)
  - 상세: `completeRetryExecution`/`failRetryExecution` 종결 경로마다 정본을 다시 읽는다. 루프 내 반복 호출이 아니라 종결 시점 1회 호출이므로 N+1 패턴은 아니며, 이 재조회를 생략하면 stale in-memory 상태로 이미 종결된 Execution 을 덮어쓰는 회귀(수 라운드의 concurrency 리뷰로 이미 확정된 CRITICAL)가 재발한다. 성능 관점에서 이 재조회 제거를 제안하지 않는다.
  - 제안: 조치 불필요.

## 요약
이번 diff(414550a1d, 및 그 위에 쌓인 b351731f0)는 `applyRetryLastTurn` 재진입 가드의 **배치 순서를 correctness 목적으로 재정렬**한 동시성 수정으로, 신규 루프·신규 DB 호출·N+1 패턴을 도입하지 않는다. 기존에 이미 존재하던 원자 UPDATE(`claimSpawnedRetryRow`)를 손상 판정보다 앞으로 옮기고, 예전에 있던 방어 분기의 `save()` 호출 하나를 제거했으며, in-memory 동기화를 위한 O(1) `delete` 한 줄을 추가했을 뿐이다. execution/node 조회는 이미 `Promise.all` 로 병렬화돼 있고(코드 주석의 W18, 이전 라운드 최적화 유지), `resumeGraphAfterRetry` 의 그래프 순회는 Set/Map 기반으로 그래프 크기에 선형 비례하며 새로운 이차 반복은 없다. `finalizeGuarded` 의 DB 재조회는 lost-update 방지를 위한 의도된 트레이드오프로 여러 라운드의 concurrency 리뷰를 거쳐 이미 정당화됐으므로 성능 관점에서 되돌리라고 제안하지 않는다. 전체적으로 이 경로는 사용자가 명시적으로 트리거하는 저빈도 재시도 경로이며, 조치가 필요한 성능 발견사항은 없다.

## 위험도
NONE
