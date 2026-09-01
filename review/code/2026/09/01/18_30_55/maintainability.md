# 유지보수성(Maintainability) 코드 리뷰

## 컨텍스트

이번 라운드(`18_30_55`)의 diff 는 실질적으로 두 라운드 전에 검토된 코드 변경(`59dd12869`)에
1차 리뷰 fix(`15374b657`, JSDoc 재배치·관측 로그 테스트 추가·CHANGELOG)와 2차 리뷰 fix
(`91c817608`, plan 트래커 수치 정합)가 누적된 것이다. 이전 두 라운드의 maintainability 리뷰가
이미 JSDoc 오귀속(W1, 해소됨)·mock-capture 중복(INFO, W6 백로그 이월)·`markSpawnedRowFailed`
인접 `string` 매개변수 위험(INFO, 낮은 우선순위)·`ResponseExecution` `Omit` 잔여 중복(INFO)을
지적·처분했다. 이번 라운드는 그 처분이 실제 소스에 반영돼 있는지 직접 재확인하고, 새로 추가된
표면(`review/code/2026/09/01/{17_55_50,18_13_45}/*` 리뷰 산출물 커밋)에 신규 결함이 있는지
점검했다.

## 발견사항

- **[INFO]** (재확인, 신규 아님) `retry-turn.service.spec.ts` 의 두 신규 테스트가 여전히 동일한
  10줄짜리 "NOT_CALLED sentinel + `updateExecutionStatus` mockImplementation 스냅샷" 블록을
  그대로 복제하고 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:982-996`
    (`'자연 종결이 이전 시도의 error 를 비운다…'`) 와 `:1054-1068`
    (`'fallback 종결도 이전 시도의 error 를 비운다'`) — `grep -n NOT_CALLED` 로 직접 대조.
  - 상세: `const NOT_CALLED = Symbol('completion-not-reached'); let errorAtCompletion: unknown =
    NOT_CALLED;` 부터 `mockDriver.updateExecutionStatus` 의 `mockImplementation` 본문까지
    두 테스트가 문자 그대로 동일하다. 이전 두 라운드(`17_55_50` INFO #7·`18_13_45` INFO)가 이미
    지적했고, plan(`retry-turn-terminal-guard.md` W6 테스트 위생 백로그)에 명시적으로 이월돼
    있다 — 이번 라운드에서 상태가 바뀌지 않았다.
  - 제안: 조치 불요(이미 우선순위 판단 완료). 로컬 헬퍼(`captureErrorAtCompletion(mockDriver)`)
    추출은 W6 일괄 정리 시점에.

- **[INFO]** (재확인, 신규 아님) `markSpawnedRowFailed` 가 인접한 두 `string` 매개변수
  (`logContext`, `errorMessage`)를 받아, 호출부에서 순서를 바꿔도 타입 시스템이 잡지 못한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:724-728`
    (`private async markSpawnedRowFailed(spawnedRow, logContext, errorMessage)` 선언부).
  - 상세: 현재 두 호출부(`:386-390` execution not found, `:394-398` node not found)는 인자
    순서가 올바름을 `Read` 로 직접 확인했다. 호출부가 2곳뿐인 지금은 위험이 낮다 — 이전
    라운드와 동일한 평가.
  - 제안: 급하지 않음. 호출부가 늘어나는 시점에 `{ logContext, errorMessage }` 객체 인자
    전환을 고려.

- **[INFO]** (재확인, 신규 아님) `ResponseExecution` 의 `error` 필드가 엔티티 타입 정정
  이후 `Omit`/재선언 대상에서 빠져도 되는 상태인데 여전히 유지되고 있다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:95-104`
    (`export type ResponseExecution = Omit<Execution, 'error' | 'inputData' | 'outputData' |
    ...> & { error: Record<string, unknown> | null; ... }`).
  - 상세: `execution.entity.ts:81` 의 `error: Record<string, unknown> | null` 정정으로
    `ResponseExecution` 의 `error` 재선언과 완전히 동일해졌다. JSDoc(`:84-87`)이 이를 스스로
    인지하고 있어 의도적 유지로 읽힌다 — 기능 문제 아님, 이전 라운드와 동일 평가.
  - 제안: 급하지 않음. `inputData`/`outputData` 도 엔티티가 nullable 로 정정되는 시점에 함께
    `Omit` 목록을 정리하는 것을 고려.

## 긍정적으로 확인한 점 (직접 재검증)

- **W1(JSDoc 오귀속) 완전 해소를 소스에서 재확인.** `retry-turn.service.ts:711-798` 을 직접
  읽어, `markSpawnedRowFailed`(JSDoc `:711-723`, 선언 `:724`)·`prepareSuccessTermination`
  (JSDoc `:738-750`, 선언 `:751`)·`completeRetryExecution`(JSDoc `:758-778`, 선언 `:779`)
  세 심볼이 각각 자기 바로 위에 정확한 JSDoc 을 갖고 있음을 확인했다. 1차 라운드가 지적한
  "문서가 46줄 아래 무관한 헬퍼 위로 밀렸다" 결함은 더 이상 재현되지 않는다.
- `markSpawnedRowFailed`/`prepareSuccessTermination` extract-method 는 실질적인 DRY 개선이다
  — 두 not-found 분기(로그·status·error·finishedAt+save 4단계)와 두 성공 종결 분기(error
  클리어+finishedAt/durationMs 세팅)가 각각 단일 소스로 수렴했고, 헬퍼 각각의 JSDoc 이 "왜
  존재하는가"(중복 회귀 방지)를 명확히 남긴다.
- 신규 로직(`ai-turn-orchestrator.service.ts` 의 `try/catch`, `execution-engine.service.ts`
  의 `persisted` 소비)은 기존 중첩 수준을 그대로 유지한다 — 전자는 `if → if → try/catch`
  3단, 후자는 `if → try/catch → if` 3단으로 과도하지 않다.
- 네이밍(`markSpawnedRowFailed`, `prepareSuccessTermination`)이 동사-목적어 형태로 목적을
  분명히 드러내고, 기존 클래스의 `finalizeGuarded`/`completeRetryExecution`/
  `failRetryExecution` 명명 관행과 일관된다.
- 매직 넘버·하드코딩된 상수 신규 도입 없음 — `RETRY_STATE_KEY` 등 기존 명명 상수를 그대로
  재사용한다.
- 신규 리뷰 산출물 커밋(`review/code/2026/09/01/{17_55_50,18_13_45}/*`)은 마크다운 보고서일
  뿐 실행 코드가 아니라 가독성·네이밍·복잡도 등 유지보수성 기준이 적용될 대상이 아니다 —
  별도 결함 없음.

## 요약

이번 changeset 은 취소/재시도 종결 경로의 관측성·정합성 결함을 닫는 소규모 방어적 리팩터이며,
1차 라운드가 지적한 유일한 WARNING(JSDoc 오귀속)이 소스 직접 재확인으로 실제 해소됐음을
확인했다. 잔여 발견은 모두 이전 두 라운드에서 이미 등재·우선순위 판단이 끝난 INFO 3건
(테스트 mock-capture 중복은 W6 백로그, private 헬퍼의 인접 `string` 매개변수 순서 취약성,
`ResponseExecution` 의 사소한 타입 재선언 중복)으로, 이번 라운드에서 상태 변화가 없다. 신규
CRITICAL/WARNING 급 유지보수성 결함은 발견하지 못했다.

## 위험도

NONE
