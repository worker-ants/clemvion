# RESOLUTION — retry-turn 종결 terminal 가드

`review/code/2026/07/27/21_07_03` — Critical 2 / Warning 3.

## 조치 항목

| SUMMARY # | 분류 | 처분 | 비고 |
|---|---|---|---|
| Critical #1 (architecture/side_effect) | **전제 반증 + 회귀 테스트 추가** | 코드 변경 없음 | 아래 §반증 참조. 지적의 부수 논점("이 경로를 덮는 테스트가 없다")은 옳아 회귀 테스트를 추가했다 |
| Critical #2 (documentation/maintainability) | 코드 | 수정 | `finalizeGuarded` 추출 시 고아가 된 `completeRetryExecution` JSDoc 을 원 소유 메서드 위로 되돌림 |
| Warning #1 (concurrency) | plan 이관 | 코드 변경 없음 | 비원자 `spawnedRow` claim — **이 PR 이 겨냥한 레이스와 별개**이고 그쪽은 닫혔다. CAS 강화는 별도 범위 |
| Warning #2 (documentation) | 코드 | 수정 | `CHANGELOG.md` 에 7번 항목 추가 |
| Warning #3 (maintainability) | plan 이관 | 코드 변경 없음 | "spawn row FAILED 마감" 3중 반복 → `markSpawnedRowFailed` 추출은 별도 리팩터 |
| INFO 7 (testing) | 코드 | 수정 | `completeRetryExecution` 쪽 대칭 테스트 2건 추가(row 부재 / 멱등 no-op) |
| INFO 1·2 | plan 이관 | 코드 변경 없음 | forwardRef 주석 stale 여부, `finalizeGuarded` 의 파라미터 in-place 변이 명시 |
| 나머지 INFO | 조치 불요 | — | 선재 부채·의도된 트레이드오프 |

## 반증 — Critical #1

> 지적: "자연 종결(happy-path) 경로가 신규 가드를 우회해 stale `failed` 로
> `FAILED→COMPLETED` 자기전이 throw 를 일으키고, retry 성공이 **구조적으로 항상**
> FAILED 로 오분류된다."

**실측 결과 전제가 성립하지 않는다.** `applyRetryLastTurn` 은
`processAiResumeTurn(execution, …)` 에 **자신의 `execution` 객체를 그대로** 넘긴다.
성공 턴이면 orchestrator 의 `finalizeAiNode` else 분기가
`updateExecutionStatus(savedExecution, RUNNING, …)` 를 호출하고, 실제 choke point 는
`execution.status = newStatus` 로 **그 객체를 변이**한다. 따라서 `resumeGraphAfterRetry`
도달 시점의 상태는 `running` 이고 `running → completed` 는 정상 전이다.

> 참고로 이 PR 이전에도 그 호출부는 `updateExecutionStatus` 를 직접 쓰고 있었다 — 지적대로라면
> 이 PR 과 무관하게 이미 항상 깨져 있었어야 하는데, 그렇지 않다는 것이 반증의 방증이다.

다만 **"이 경로를 실제로 도달시키는 회귀 테스트가 없다" 는 부수 지적은 옳았다.** 성공 턴 +
그래프 완주 케이스를 도달시켜 `COMPLETED` 마감과 `EXECUTION_FAILED` 미발행을 함께 단언하는
테스트를 추가해, 이 불변식이 조용히 깨지지 않도록 고정했다.

## TEST 결과

- lint  : 통과
- unit  : 통과 (execution-engine 41 suite / 1,100 — 신규 3건 포함)
- build : 통과
- e2e   : 통과 (260 passed)

### mutation

가드를 한 줄씩 무력화해 RED 확인 — **5/5**:
`canTransition` 가드 / guarded UPDATE 반환값 / DB 재조회 결과 / row 부재 / 멱등 no-op 분기.

> 1차에서는 3개가 **미검출**이었다(핵심인 `canTransition` 포함). `updateExecutionStatus → false`
> 경로만 테스트하고 "정본이 이미 다른 terminal 인 경우" 를 안 짰던 탓이다. 테스트를 보강해 닫았다.

## 보류·후속 항목

전부 [`plan/in-progress/retry-turn-terminal-guard.md`](../../../../../plan/in-progress/retry-turn-terminal-guard.md)
"후속(본 PR 밖)" 절에 등재 — `review/**` 는 SoT 가 아니다.
