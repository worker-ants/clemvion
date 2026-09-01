# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 신규 테스트 2건이 동일한 "NOT_CALLED 심볼 + `updateExecutionStatus` mockImplementation 스냅샷" 10줄 블록을 그대로 복제
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` — `'자연 종결이 이전 시도의 error 를 비운다…'` 테스트(게이트 982~991) 와 `'fallback 종결(completeRetryExecution)도 이전 시도의 error 를 비운다'` 테스트(게이트 1054~1063)
  - 상세: 두 테스트가 `const NOT_CALLED = Symbol(...)` 선언부터 `mockDriver.updateExecutionStatus` 의 `mockImplementation` 본문까지 문자 그대로 동일하다. 이미 직전 리뷰 라운드(`review/code/2026/09/01/17_55_50/SUMMARY.md` INFO #7)에서 같은 성격의 mock-capture 중복이 지적됐고 W6 테스트 위생 백로그로 유예된 상태이며, 이번 두 건도 같은 백로그 대상이다 — 새로 악화된 것은 아니지만 범위가 넓어졌다.
  - 제안: 로컬 헬퍼(예: `captureErrorAtCompletion(mockDriver)`)로 추출하거나, plan 의 W6 테스트 위생 정리 항목에 이 두 건도 포함해 함께 처리.

- **[INFO]** `markSpawnedRowFailed` 가 인접한 두 `string` 매개변수(`logContext`, `errorMessage`)를 받아 호출부에서 순서를 바꿔도 컴파일러가 잡지 못한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `private async markSpawnedRowFailed(spawnedRow, logContext, errorMessage)` 선언부(주석 블록 포함 게이트 711~734)
  - 상세: 현재 두 호출부(`execution not found` / `node not found` 분기)는 인자 순서가 올바르다. 다만 두 매개변수가 모두 `string` 이라 타입 시스템이 실수를 걸러주지 못하고, JSDoc `@param` 설명만이 유일한 방어선이다. 호출부가 2곳뿐인 지금은 위험이 낮지만, 향후 호출부가 늘면 위험이 커진다.
  - 제안: 급하지 않음 — 호출부가 늘어나는 시점에 `{ logContext, errorMessage }` 객체 인자로 바꾸는 것을 고려.

- **[INFO]** `markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 태그가 빠져 있음 (다른 두 파라미터는 기재)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:718-721` 부근 JSDoc 블록
  - 상세: 직전 리뷰 라운드 SUMMARY(INFO #11)에서 이미 지적된 항목이 이번 diff 에서도 그대로 남아 있다. 기능 영향 없음.
  - 제안: 선택적. `@param spawnedRow` 한 줄 추가.

- **[INFO]** `ResponseExecution` 타입에서 `error` 필드가 이제 `Omit` 대상에서 빼도 되는 상태(엔티티와 동일 타입)인데도 여전히 재선언되어 있음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `export type ResponseExecution = Omit<Execution, 'error' | 'inputData' | 'outputData' | ...> & { error: Record<string, unknown> | null; ... }` 선언부(게이트 95~103 부근)
  - 상세: `Execution.error` 가 이번 diff 로 `Record<string, unknown> | null` 이 되어 `ResponseExecution` 의 `error` 재선언과 완전히 동일해졌다. 코드 자체는 JSDoc(게이트 84-87)에서 "그래서 `error` 에 한해 이 타입은 엔티티와 같다" 고 명시적으로 인지하고 있어 의도적 유지로 읽힌다. 지금은 문제 없으나, `error` 를 `Omit`/재선언 목록에서 완전히 빼면 "왜 셋 다 마스킹 대상인가" 라는 원래 논지가 두 필드(`inputData`/`outputData`)만 남아 더 명확해질 여지가 있다.
  - 제안: 급하지 않음. 이 필드를 다음에 손댈 때 `Omit` 목록에서 `error` 를 제거하는 정리를 고려(현재는 문서화된 의도적 유지이므로 조치 불요).

## 긍정적 관찰

- `markSpawnedRowFailed`/`prepareSuccessTermination` 추출은 실질적인 DRY 개선이다. 종전에 `applyRetryLastTurn` 진입부 두 not-found 분기와 두 성공 종결 경로(자연 종결·fallback)가 각각 로그·status·error·finishedAt 4단계를 문자 그대로 반복하던 것을 단일 헬퍼로 수렴시켰고, 각 헬퍼는 JSDoc 으로 "왜 존재하는가"(중복 회귀 방지)를 명확히 남겼다.
- `ai-turn-orchestrator.service.ts` 의 신규 `try`/`catch` 는 책임이 좁고(마킹 실패를 관측만 하고 분류는 바꾸지 않음) 중첩 깊이도 3단계(`if (shouldProceed) return` → `if (nodeExec)` → `try/catch`)로 과도하지 않다.
- `executeSync` timeout catch 의 `persisted` 값 소비 추가는 형제 종결 경로(`failFirstSegmentSetup`)와 로그 문구를 정확히 맞춰(`정본 상태 ... 전이 불가 — 동시 cancel 선점` 계열) 관측 일관성을 높였다 — 실제로 두 위치의 문자열을 대조 확인함.
- 직전 리뷰 라운드(`17_55_50`)가 지적한 JSDoc 오귀속(WARNING #1) 은 이번 세션 코드에서 이미 정정되어 있음을 소스에서 직접 확인했다 — `markSpawnedRowFailed`/`prepareSuccessTermination`/`completeRetryExecution` 각각 올바른 JSDoc 바로 위에 위치.

## 요약

이번 changeset 은 취소/retry 종결 경로의 관측성·정합성 잔여 결함을 닫는 방어적 리팩터로, 유지보수성 관점에서는 전반적으로 양호하다. 헬퍼 추출(`markSpawnedRowFailed`, `prepareSuccessTermination`)이 실제 중복을 제거했고, 신규 코드의 네이밍·JSDoc·중첩 깊이 모두 기존 코드베이스 컨벤션과 일관된다. Critical/Warning 급 발견은 없으며, 잔여 발견은 전부 INFO — 두 신규 테스트의 mock-capture 블록 중복(이미 W6 백로그 대상), private 헬퍼의 인접 `string` 매개변수 순서 위험, 사소한 JSDoc 태그 누락, `ResponseExecution` 타입의 의도된 최소 중복이다. 직전 리뷰 라운드가 지적한 JSDoc 오귀속 등 WARNING 5건은 소스 확인 결과 모두 정정된 상태다.

## 위험도
LOW
