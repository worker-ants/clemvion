# 성능(Performance) Review

## 발견사항

### [INFO] JSON.stringify 반복 호출 — 루프 내 동일 상수 직렬화
- 위치: `ai-turn-executor.ts` — `recordSingleTurnNonProviderToolResults` (조건 도구 루프) 및 `recordMultiTurnNonProviderToolResults` (조건 도구 루프)
- 상세: `conditionToolCalls` 루프에서 매 반복마다 `JSON.stringify({ result: CONDITION_DEFERRAL_RESULT_MSG })` 를 호출한다. `CONDITION_DEFERRAL_RESULT_MSG` 는 모듈 상수이고 객체 형태도 불변이므로 직렬화 결과가 항상 동일하다. 루프 횟수가 클 경우(조건 도구가 여러 개) 불필요한 객체 생성과 직렬화가 반복된다.
- 제안: `condDeferralContent` 를 루프 밖으로 호이스팅하거나, 모듈 레벨 상수로 미리 캐시한다. 두 동명 헬퍼에 동일 패턴이 복사되어 있으므로 단일 모듈 상수로 통일하면 중복도 줄어든다.

### [INFO] `buildAiNodeRefFromContext` / `buildAiNodeRefFromState` 루프 내 반복 생성
- 위치: `ai-turn-executor.ts` `recordSingleTurnNonProviderToolResults` 내 `isToolTurnsEnabled` 분기, `recordMultiTurnNonProviderToolResults` 동일 패턴
- 상세: NodeRef 객체(`{ id, label, type, config }`)는 하나의 실행 루프 내에서 불변이다. 루프 내 각 조건·일반 도구 호출마다 `buildAiNodeRefFromContext` / `buildAiNodeRefFromState` 를 재실행해 동일한 객체를 반복 생성한다. 단일 실행에서 도구 수만큼 불필요한 객체 생성이 발생한다.
- 제안: 루프 진입 전 `nodeRef` 를 1회 계산해 재사용한다.

### [INFO] `capFormDataBytes` 내 복수 직렬화
- 위치: `ai-turn-executor.ts` `capFormDataBytes` 함수
- 상세: 함수 내에서 `JSON.stringify` + `Buffer.byteLength` 가 최대 3회(전체 측정, nonString 측정, cap 후 결과 측정) 실행된다. cap 범위가 10 KB로 제한되어 있어 실용 영향은 미미하다. `bytesAfterCap` 계산(결과 재직렬화)은 잘린 필드별 바이트 누적으로 대체하면 직렬화 1회를 절약할 수 있다.
- 제안: 현 구현 유지 무방. 추후 리팩터 고려 항목으로 기록.

### [INFO] `Date.now()` 이중 호출 제거 — 이번 커밋에서 수정됨 (양호)
- 위치: `handleSingleTurnConditionRoute`, `handleMultiTurnConditionRoute`
- 상세: 이번 변경에서 `Date.now() - startedAt` 를 두 번 호출하던 것을 `condRouteDurationMs` 변수 단일 캡처로 통일했다. 두 호출 사이 오차가 제거되어 `totalDurationMs` 와 `turnDebug[].totalDurationMs` 가 항상 동일 시각을 참조한다. 성능·정합성 모두 개선된 올바른 수정이다.

### [INFO] `RagAccumulator.fromState` 스프레드 push — 현 상한 내 안전
- 위치: `ai-turn-executor.ts` `RagAccumulator.fromState` (L1299)
- 상세: multi-turn 재개 시 `existingSources` 를 스프레드로 push 하나, `MAX_RESUME_RAG_SOURCES = 200` 상한이 이미 배열 크기를 제어한다. 현재 설계상 안전하다.
- 제안: 현 설계 유지.

## 요약

이번 커밋은 multi-turn condition 도구의 toolCallCount 미합산 통일 버그픽스와 JSDoc 정확성 개선이 주목적이며, 성능에 직접 영향을 주는 알고리즘 변경은 없다. 가장 주목할 성능 관련 개선은 `Date.now()` 이중 호출을 단일 캡처로 수정한 것으로 타이밍 일관성과 코드 명확성이 함께 향상되었다. 소규모 개선 여지로는 `CONDITION_DEFERRAL_RESULT_MSG` JSON 직렬화 결과를 루프 밖 상수로 캐시하는 것과 루프 내 `buildAiNodeRefFromContext/State` 재호출 제거가 있으나, 실제 조건 도구 수가 극히 소량인 현실적 사용 패턴에서는 측정 가능한 영향이 없다. 전반적으로 성능상 심각한 문제는 없다.

## 위험도

NONE
