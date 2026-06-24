# 부작용(Side Effect) 리뷰 — ai-turn-executor.ts

## 발견사항

### [INFO] `messages` 배열 in-place 변이 — 의도된 계약, 명시 문서화됨
- 위치: `recordSingleTurnNonProviderToolResults`, `recordMultiTurnNonProviderToolResults`, `applyMultiTurnTurnMemory`
- 상세: 세 helper 모두 `messages` 배열을 in-place(`push`, `length = 0 + push(...)`)로 변이한다. 원본 god-method 도 동일 패턴이었으며, 각 helper JSDoc 에 "messages 를 in-place 변이한다"고 명시되어 있다. 반환값(toolCallCount 또는 MultiTurnMemoryMeta)과 in-place 변이의 dual-channel contract 은 추출 전후가 동일하다.
- 제안: 현행 유지. 다만 `handleMultiTurnUserMessageEntry` 는 `state` 도 in-place 변이(`delete state.pendingFormToolCall`)하는데, 이는 원본 코드도 동일하게 수행한 동작이므로 새로운 부작용이 아니다. 호출자는 이 변이를 의도적으로 의존하고 있으므로 문제없음.

### [INFO] `MultiTurnMemoryMeta` 타입 — 파일 내 중복 선언 가능성
- 위치: diff 패치 기준 509행 (클래스 외부 선언)과 전체 파일 컨텍스트 1745행 (export class 바로 앞 선언)
- 상세: 패치는 `MultiTurnMemoryMeta` type 을 클래스 정의 직전에 추가했다. 전체 파일 컨텍스트를 보면 동일한 type 이 1741~1755행에도 나타난다. 두 선언이 실제 파일에 공존하면 TypeScript 컴파일 오류(`Duplicate identifier`)가 발생한다. commit 메시지가 "lint·build(tsc)·unit·e2e PASS"를 명시하므로 실제 파일에서는 단일 선언일 가능성이 높고, diff 의 context 행이 겹쳐 보이는 것일 수 있다. 그러나 diff 읽기만으로는 두 선언의 실제 라인 번호 구분이 모호하다.
- 제안: `tsc --noEmit` 결과와 실제 파일 라인을 확인해 중복 선언이 없는지 검증. 빌드 PASS 확인됐으므로 실제 위험도는 낮다.

### [INFO] `handleMultiTurnConditionRoute` — caller scope 의 토큰 누적 변수 무효화
- 위치: `handleMultiTurnConditionRoute` (diff 620~764행)
- 상세: 원본에서는 `totalInputTokens += ...`, `totalOutputTokens += ...` 등 caller scope 변수를 직접 증가시킨 뒤 `buildConditionOutput` 에 넘겼다. 리팩터링 후 helper 는 지역 상수(`finalInputTokens`, `finalOutputTokens`, `finalThinkingTokens`)를 계산해 반환값으로 전달한다. 이 경로가 early-return 이므로 caller scope 의 `totalInputTokens` 등은 이후 코드에서 참조되지 않는다(정상). helper JSDoc 도 "이후 caller 가 재참조하지 않음"을 명시한다. 의도된 동작으로 부작용 없음.
- 제안: 현행 유지.

### [INFO] `pushAiThreadTurn` / `pushAiToolResultTurn` — 외부 서비스 호출 분산
- 위치: 모든 추출된 helper (recordSingleTurnNonProviderToolResults, recordMultiTurnNonProviderToolResults, handleSingleTurnConditionRoute, handleMultiTurnConditionRoute, handleMultiTurnUserMessageEntry)
- 상세: 각 helper 가 `conversationThreadService` 를 통한 thread push(네트워크/DB 부작용)를 자체적으로 수행한다. 원본 god-method 도 동일 위치에서 동일 호출을 했으므로 새로운 외부 호출이 아니다. 호출 순서(thread push 순서)는 추출 전후가 동일하다는 것이 JSDoc 에 명시되어 있다.
- 제안: 현행 유지. 단, helper 가 늘어날수록 side-effect 가 분산되므로 신규 helper 추가 시 thread push 순서 불변식을 명문화된 테스트로 보호하는 것을 향후 권장.

### [INFO] `applyMultiTurnTurnMemory` — `memoryManager.injectMemoryContext` LLM 호출 경로
- 위치: `applyMultiTurnTurnMemory` (diff 778~851행)
- 상세: `injectMemoryContext` 는 summary_buffer/persistent 전략에서 내부적으로 LLM 요약 호출을 할 수 있는 외부 서비스 호출이다. 원본도 동일 호출을 했으므로 새로운 네트워크 부작용이 아니다. caller 가드(`multiTurnMemoryStrategy !== 'manual'`)도 원본과 동일하게 유지된다. 의도된 동작.
- 제안: 현행 유지.

---

## 요약

이번 리팩터링은 `processMultiTurnMessage`(768→459줄)와 `executeSingleTurn`(545→395줄)의 god-method 를 6개의 `private` helper 로 behavior-preserving 하게 추출한 것이다. 부작용 관점에서 새로운 전역 변수·환경 변수·파일시스템·네트워크 호출은 도입되지 않았다. 공개 시그니처(`processMultiTurnMessage`, `executeSingleTurn`, `capFormDataBytes`, `FORM_SUBMITTED_GUIDANCE_MESSAGE`, `FORM_SUBMITTED_MAX_BYTES`, `ToolCallTrace`)는 변경되지 않아 기존 호출자에 영향이 없다. 추가된 `MultiTurnMemoryMeta` type 은 파일 내부 전용이며, 내부 helper 간 공유 계약을 명시한다. `messages` 배열과 `state.pendingFormToolCall` in-place 변이는 원본과 동일하게 유지되며 caller 가 의도적으로 의존한다. 한 가지 주의 사항은 diff 표현상 `MultiTurnMemoryMeta` 가 두 곳에 선언된 것처럼 보이는 점이나, 빌드 PASS 가 확인됐으므로 실제 파일에서는 단일 선언일 것으로 판단된다.

---

## 위험도

LOW
