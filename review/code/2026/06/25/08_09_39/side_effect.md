# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `recordMultiTurnNonProviderToolResults` — `toolCallCount++` 제거로 인한 숫자 감소
- 위치: `ai-turn-executor.ts` diff hunk `@@ -1988 @@` (조건 도구 루프 내 `toolCallCount++` 삭제)
- 상세: 이전에는 condition deferral 마다 `toolCallCount` 가 1씩 증가했으나 이번 변경으로 증가하지 않는다. 이 값은 `_resumeState.toolCalls` 에 기록되고 최종적으로 `meta.toolCalls` 로 노출된다. 외부 API 계약상 `meta.toolCalls` 는 "조건 도구 제외"가 spec 명문이므로 **버그 수정**이며, 호출자가 condition 도구 수를 포함한 `toolCalls` 숫자에 의존하지 않는 한 부작용이 아니다. 단, **기존 데이터와의 숫자 불연속**: 이전 실행 결과의 `meta.toolCalls` 는 condition 도구를 포함한 수치였으므로 히스토리 데이터와 신규 데이터 간 수치 의미가 달라진다.
- 제안: 운영 모니터링 대시보드나 분석 쿼리가 `meta.toolCalls` 임계값을 기준으로 알림을 설정하는 경우 기존 임계값 재검토 필요. 코드 자체는 올바르다.

### [INFO] `condRouteDurationMs` 단일 캡처로 인한 미세한 값 변경 (single-turn / multi-turn 양쪽)
- 위치: `ai-turn-executor.ts` diff hunk `@@ -1300 @@` (single-turn condition route) 및 `@@ -2138 @@` (multi-turn condition route)
- 상세: 이전에는 `buildConditionOutput` 인자의 `totalDurationMs` 와 `turnDebug[0].totalDurationMs` 각자 `Date.now()` 를 독립 호출해 두 값이 미세하게 달랐다. 변경 후 단일 캡처 `condRouteDurationMs` 를 공유하므로 두 필드가 항상 동일한 값을 가진다. 이는 일관성 개선이며 실질 부작용은 없다.
- 제안: 없음 (의도된 개선).

### [INFO] `TOOL_BUDGET_EXCEEDED_ERROR` 상수화 — 값 자체는 동일
- 위치: `ai-turn-executor.ts` diff hunk `@@ -963 @@` (`executeProviderToolBatch` 내 `'tool_call_budget_exceeded'` → 상수 참조)
- 상세: 문자열 리터럴 `'tool_call_budget_exceeded'` 를 상수 `TOOL_BUDGET_EXCEEDED_ERROR` 로 교체했다. 값은 동일하므로 런타임 동작·LLM-facing tool_result 페이로드 변화 없음.
- 제안: 없음.

### [INFO] JSDoc 주석 변경 — 코드 동작 영향 없음
- 위치: `ai-turn-executor.ts` 여러 JSDoc hunk
- 상세: `§3.f-g` → `§6.1.f-g` 경로 수정, INVARIANT 제거 및 새 INVARIANT 추가, `multi-turn 과 의도적으로 다름` → `동일 정책` 변경. 코드 실행에 영향 없음.
- 제안: 없음.

### [INFO] 테스트 파일 — 프로덕션 부작용 없음
- 위치: `ai-turn-executor.spec.ts` — 새 테스트 케이스 추가 (line 64–97)
- 상세: `processMultiTurnMessage` 를 직접 호출하는 테스트만 추가. 전역 변수, 파일시스템, 네트워크, 환경 변수에 대한 부작용 없음. `beforeEach` 로 mock 을 매 테스트마다 초기화하므로 테스트 간 상태 오염 없음.
- 제안: 없음.

## 요약

이번 변경은 `recordMultiTurnNonProviderToolResults` 에서 condition 도구에 대한 `toolCallCount++` 를 제거하는 버그 수정이 핵심이다. 전역 변수 도입, 파일시스템 조작, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트·콜백 변경은 없다. 공개 메서드 시그니처(`processMultiTurnMessage`, `executeSingleTurn`, `endMultiTurnConversation`, `buildMultiTurnFinalOutput`, `capFormDataBytes`)는 모두 불변이다. 유일하게 관찰되는 외부 부작용은 `meta.toolCalls` 숫자의 의미 변경(이전: condition 도구 포함, 이후: 미포함)으로, 이는 spec 준수를 위한 의도된 수정이다. 히스토리 데이터와의 수치 연속성이 깨질 수 있으나 spec 위반 버그 수정의 필연적 결과이며 코드 레벨 부작용으로 분류되지 않는다.

## 위험도

LOW
