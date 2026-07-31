STATUS=success side_effect review complete — 1 WARNING, 0 CRITICAL
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — retry_last_turn 2차 claim 삽입 위치 수정 (414550a1d)

리뷰 대상: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
(HEAD `414550a1d` — 부모 `b351731f0` 대비 diff 기준으로 실제 소스 대조 완료).

## 발견사항

- **[WARNING]** 새로 앞당겨진 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 로 인해
  같은 메서드 뒤쪽의 `NODE_STARTED` WS 이벤트 `input` 필드 내용이 조용히 바뀐다 —
  커밋 메시지·주석 어디에도 이 이벤트 페이로드 변경은 언급되지 않고, 이를 잠그는
  테스트도 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:356`
    (`delete spawnedRow.inputData[RETRY_STATE_KEY];`) 이 같은 파일
    `:432` (`input: spawnedRow.inputData,` — `applyRetryLastTurn` 의
    `this.eventEmitter.emitNode(..., NodeEventType.NODE_STARTED, { ... })` 호출)
    보다 먼저 실행된다.
  - 상세: CRITICAL #2 수정(claim 이 원자 제거한 `_retryState` 를 이후 `save(spawnedRow)`
    가 stale in-memory 값으로 부활시키지 못하게 in-memory 도 즉시 동기화)의 의도는
    "이 메서드의 모든 하위 `save(spawnedRow)` 호출 보호"였다(주석 그대로). 그런데
    `spawnedRow.inputData` 는 `retryLastTurn` 이 스폰 시 `{ [RETRY_STATE_KEY]: retryState }`
    로만 채우므로 이 delete 이후 사실상 `{}` 가 된다. 이 객체가 그대로
    `emitNode(NODE_STARTED)` 의 `input` 필드로 전달되므로:
    - **이전**(부모 커밋 `b351731f0`, `git show b351731f0:...` 로 대조 확인): retry
      재진입의 `NODE_STARTED` 이벤트는 항상 `input: { _retryState: {...} }` 를 실었다
      (delete 가 없어 in-memory 가 그대로 살아있었음).
    - **이후**(본 커밋): 동일 이벤트의 `input` 이 사실상 항상 `{}` 로 바뀐다.
    이 변화 자체는 `spec/5-system/4-execution-engine.md:1467`("`_resumeState`/
    `_retryState` 는 ... internal-only — 후속 노드가 이전 노드의 재개 상태를 보면
    안 됨")·`spec/4-nodes/3-ai/1-ai-agent.md:459`(`_retryState` 는 expression
    resolver 비노출) 의 "internal 필드 비노출" 원칙과 방향은 일치해 유익할 가능성이
    높다. 그러나 (a) 이 PR 의 의도된 수정 범위(jsonb 부활 차단)와 무관하게 딸려온
    **부수적** 변화이고, (b) frontend 는 실제로 `NODE_STARTED` 등 실행 이벤트의
    `payload.input` 을 읽어 `NodeExecution.inputData` 로 스토어에 반영한다
    (`codebase/frontend/src/lib/websocket/use-execution-events.ts:729,779,872,977`
    의 `inputData: payload.input`) — 즉 실행 상세/타임라인 UI 가 이 필드를 그대로
    노출할 수 있는 경로가 있다. (c) `retry-turn.service.spec.ts` 어디에도
    `emitNode`/`NODE_STARTED` 호출의 `input` 인자를 단언하는 테스트가 없어(전체
    스펙 파일에서 `emitNode` 는 mock 선언 1곳뿐, 호출 인자 검증 0건) 이 변경은
    회귀 잠금이 전혀 없는 상태다 — 향후 누군가 delete 위치를 다시 옮기면(예:
    claim 직후가 아니라 try 블록 안으로) 아무 테스트도 깨지지 않은 채 이 필드
    구성이 다시 바뀔 수 있다.
  - 제안: (1) 의도된 변경이면 `retry-turn.service.spec.ts` 의
    `applyRetryLastTurn — re-entry outcome branches` 블록에
    `emitNode` mock 호출 인자에서 `input` 이 `_retryState` 를 포함하지 않음(또는
    `{}`)을 단언하는 회귀 테스트를 1건 추가해 명시적으로 잠근다. (2) 동시에
    JSDoc/주석에 "이 delete 는 NODE_STARTED 이벤트의 input 페이로드에도 영향을
    준다"는 한 줄을 남겨, 다음에 delete 위치를 옮기는 사람이 이 부수효과를
    인지하게 한다. (3) 더 근본적으로는 특정 delete 의 위치에 우연히 의존하기보다,
    `emitNode` 호출 직전에 `_`-prefix internal 필드를 명시적으로 strip 하는
    (또는 기존 strip 유틸을 재사용하는) 방어적 처리를 고려하면 이런 종류의
    "삭제 타이밍에 따라 payload 가 달라지는" 결합을 구조적으로 없앨 수 있다.

## 확인했으나 새 결함 아님 (참고)

- `delete spawnedRow.inputData[RETRY_STATE_KEY]` 의 크래시 안전성: `retryState`
  가 truthy 일 때만 이 줄에 도달하고, `retryState` 가 truthy 이려면
  `seededInput`(=`spawnedRow.inputData` 의 fallback-없는 참조)가 실제 객체여야
  하므로 `spawnedRow.inputData` 가 null/undefined 인 채로 이 줄에 도달하는
  경로는 없다 — TypeError 위험 없음.
- `retryState` 변수는 delete 이전에 값을 이미 추출해 보유하므로(참조 분리),
  `buildRetryReentryState(..., retryState, ...)` 호출은 delete 의 영향을 받지
  않는다 — 의도한 그대로 동작.
- `rehydrateContext(execution, spawnedRow)` (delete 이후 호출)는
  `waitingNodeExec.outputData` 만 참조하고 `.inputData` 는 읽지 않음
  (`execution-engine.service.ts:1554` `if (waitingNodeExec?.outputData)`) — delete
  가 rehydration 결과에 영향 없음.
- claim 실패/discard 시 `_retryState` 가 애초에 한 번도 seed 되지 않은 "진짜
  corruption" 케이스(구조적으로 발생하지 않는다고 문서화됨)의 RUNNING orphan
  row 잔류 리스크는 이미 `claimSpawnedRetryRow` JSDoc 과
  `plan/in-progress/retry-turn-terminal-guard.md` 에 별도 후속으로 명시
  등재돼 있어 본 리뷰에서 재-flag 하지 않음.
- `RETRY_STATE_KEY` 모듈 `const` 는 export 되지 않는 파일-scope 상수로, 전역
  변수가 아니며 docstring 도 "`retryLastTurn`/`applyRetryLastTurn`/
  `claimSpawnedRetryRow` 양쪽"(즉 이 파일 내부)으로 범위를 정확히 한정해
  서술한다 — 과장된 "전역 SoT" 주장 아님.
- 공개 시그니처(`retryLastTurn`, `applyRetryLastTurn`) 는 변경 없음.
  `claimSpawnedRetryRow` 는 신규 `private` 메서드로 추가돼 기존 호출자에
  영향 없음. `RetryEngineDriver`/DI 생성자도 diff 대상 밖(무변경).
  환경변수·파일시스템·신규 네트워크 호출 없음.

## 요약

이번 커밋(414550a1d)은 `applyRetryLastTurn` 의 2차 원자 claim 을 "손상 판정"보다
먼저 실행하도록 재배치하고 claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]`
를 추가해, 살아있는 delivery 오판(CRITICAL #1)과 stale `save()` 에 의한 jsonb 값
부활(CRITICAL #2) 두 결함을 정확히 겨냥해 닫는다 — 두 수정 모두 이후 코드 경로에
대한 영향(`retryState` 참조 분리, `rehydrateContext` 의 `outputData`-only 접근)까지
안전하게 확인됐다. 유일하게 실질적인 부작용은 CRITICAL #2 방어용 `delete` 가
`spawnedRow.inputData` 를 **더 이르게** 비워, 그 뒤에 있는 `NODE_STARTED` WS 이벤트의
`input` 페이로드가 (이전엔 `_retryState` 를 포함했던 것이) 이제 사실상 빈 객체로
바뀌는 것이다 — spec 의 "internal 필드 비노출" 원칙과는 부합하는 방향이라 유해할
가능성은 낮지만, PR 의 의도된 변경 목록에 없고 테스트로 잠겨 있지도 않은 부수효과라
WARNING 으로 보고한다. 그 외 전역 변수·시그니처·인터페이스·환경변수·파일시스템·
네트워크 호출 관점에서는 새로운 부작용을 찾지 못했다.

## 위험도

LOW
