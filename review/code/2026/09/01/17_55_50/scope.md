# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 리팩터 삽입 순서로 인해 `completeRetryExecution` 의 기존 JSDoc 이 `markSpawnedRowFailed` 위에 고아처럼 남는다 — 문서 귀속이 뒤바뀐다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711-731` (고아가 된 원본 JSDoc, "retry 성공 종결 시 Execution 을 직접 COMPLETED 로 마감하는 fallback... @internal 이 메서드는 `resumeGraphAfterRetry` 의 defensive fallback 에서만 호출된다"), 새로 삽입된 `markSpawnedRowFailed` JSDoc 은 바로 다음 줄(732)부터, 실제 `completeRetryExecution` 선언은 `:777`
  - 상세: diff 전에는 이 JSDoc 블록이 `private async completeRetryExecution(` 바로 위에 있어 그 메서드를 설명했다. 이번 diff 는 그 블록을 **컨텍스트(무변경)로 그대로 둔 채**, 그 사이에 `markSpawnedRowFailed`(W3 항목)와 `prepareSuccessTermination`(INFO 2 항목) 두 개의 새 메서드+JSDoc 블록을 통째로 끼워 넣고, `completeRetryExecution` 선언을 그 뒤로 밀었다. 결과적으로 "`@internal` 이 메서드는 `resumeGraphAfterRetry` 의 defensive fallback 에서만 호출된다" 라는 호출 제약 문구가 이제 `markSpawnedRowFailed` 바로 위에 붙어 있다 — 그러나 `markSpawnedRowFailed` 는 `resumeGraphAfterRetry` 가 아니라 `applyRetryLastTurn` 의 두 not-found 분기에서 호출된다(즉 그 문구는 틀린 대상에 붙어 있다). 반대로 `completeRetryExecution` 자신은 이제 직전에 아무 JSDoc 도 없이 나타난다(원래 설명·`@internal` 호출 제약이 모두 사라진 것처럼 읽힌다). TypeScript/JSDoc 툴링은 심볼 바로 위 블록만 해당 심볼의 문서로 인식하므로 IDE 호버 등 기능적 영향은 제한적이지만, 소스를 위에서 아래로 읽는 사람에게는 명백히 오귀속으로 읽힌다 — 이 PR 이 명시적으로 표방한 "diff 위생"(retry-turn-terminal-guard.md C-4 처분 표: "이번에 넣은 인자 포착 단언과 diff 가 뒤섞인다" 등 스코프 절제 서술)과 대비된다는 점에서 이 changeset 자체가 만든 부작용이다.
  - 제안: `completeRetryExecution` 의 원본 JSDoc 블록을 새로 삽입한 두 헬퍼 뒤, `completeRetryExecution` 선언 바로 위로 이동한다(또는 두 신규 헬퍼를 `completeRetryExecution` 뒤에 배치해 원래 인접 관계를 보존한다).

## 요약

이 changeset 은 두 개의 plan 트래커(`ie-resume-turn-boundary-cancel.md` C-4, `retry-turn-terminal-guard.md` C-4)가 명시적으로 번호를 매겨 등재한 잔여 항목만을 정확히 겨냥한다 — `markNodeCancelled` reject 미흡수(취소→FAILED 오분류), `updateExecutionStatus` 반환값 미소비(관측성 비대칭), `markSpawnedRowFailed`/`prepareSuccessTermination` 추출(W3·INFO2, 각 항목이 문서에 근거를 명시), `execution.error` 널 처리 + entity 타입 정정, 그리고 그 각각에 대응하는 신규 테스트. 손댄 파일 8개 전부가 이 두 트래커가 지목한 코드/plan 문서이고, 남긴 7건(W6 mock 팩토리 통합·W4 주석 정리·spec 문서 계약 등)은 diff 위생·권한 범위(spec은 planner 턴)를 근거로 plan 표에 명시적으로 defer 되어 있어 무단 방치가 아니다. 불필요한 포맷팅·주석·임포트·설정 변경은 발견되지 않았다. 유일한 흠은 `retry-turn.service.ts` 에서 두 헬퍼를 기존 메서드 사이에 삽입하면서 기존 JSDoc 블록 하나가 엉뚱한 메서드 위에 고아로 남은 것 — 실질 동작에는 영향 없는 문서 귀속 결함이다.

## 위험도
LOW
