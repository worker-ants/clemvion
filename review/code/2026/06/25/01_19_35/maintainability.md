# 유지보수성(Maintainability) 리뷰

## 발견사항

### [WARNING] `handleSingleTurnConditionRoute` 파라미터 객체가 과도하게 비대함
- 위치: 새로 추출된 `handleSingleTurnConditionRoute` 메서드 (diff +187~+297)
- 상세: 단일 메서드가 20개 파라미터를 객체 args 로 받는다. `result`, `matchedCondition`, `messages`, `config`, `context`, `memoryStrategy`, `workspaceId`, `model`, `llmConfig`, `toolCallCount`, `ragAcc`, `turnRagAcc`, `mcpDiagnosticsAcc`, `presentationPayloads`, `presentationCalls`, `presentationSchemaViolations`, `llmCalls`, `toolCallTraces`, `singleTurnStartedAt`, `rawConfig` — 20개. 이 중 대부분은 accumulator 군으로 하나의 "출력 조립 컨텍스트" 개념에 속한다. 파라미터 수가 많을수록 호출 측에서 누락·순서 오류 추적이 어렵고, 향후 accumulator 종류 추가 시 시그니처 전파 범위가 넓다.
- 제안: `ragAcc`, `turnRagAcc`, `mcpDiagnosticsAcc`, `presentationPayloads`, `presentationCalls`, `presentationSchemaViolations`, `llmCalls`, `toolCallTraces` 를 별도 `TurnOutputAccumulators` 인터페이스로 묶는 것을 검토할 것. 이미 파일 내에 `RagAccumulatorGroup` 이라는 유사 패턴이 있으므로 일관성도 높아진다.

### [WARNING] `handleMultiTurnConditionRoute` 도 동일 파라미터 폭발 문제
- 위치: 새로 추출된 `handleMultiTurnConditionRoute` 메서드 (diff +620~+764)
- 상세: `handleSingleTurnConditionRoute` 와 거의 동일한 21개 파라미터 구조가 반복된다. 두 메서드의 파라미터 목록이 구조적으로 유사하므로 공통 accumulator 타입을 만들면 두 곳이 동시에 혜택을 받는다.
- 제안: 위와 동일하게 accumulator 군을 별도 타입으로 묶어 두 helper 가 공유하도록 리팩터링 검토.

### [INFO] `MultiTurnMemoryMeta` 타입 선언이 파일 내에 중복으로 존재
- 위치: diff +65~+75 (신규 type 선언) 및 전체 파일 컨텍스트 1741~1755 라인
- 상세: 전체 파일 컨텍스트를 보면 `type MultiTurnMemoryMeta` 가 두 곳에 동일하게 정의되어 있다. diff 가 기존 인라인 익명 타입을 `MultiTurnMemoryMeta` 로 추출하는 과정에서 상단에 type 을 추가했는데, 파일 내 이미 같은 이름·같은 구조가 남아있는 것으로 보인다.
- 제안: 파일 내 `MultiTurnMemoryMeta` 선언 개수를 확인하여 중복 제거. 단일 위치(파일 상단 또는 타입 전용 섹션)에만 위치하도록 정리.

### [INFO] `recordSingleTurnNonProviderToolResults` 와 `recordMultiTurnNonProviderToolResults` 간 구조적 중복
- 위치: diff +94~+177 (single-turn) 및 +518~+610 (multi-turn)
- 상세: 두 메서드는 거의 동일한 for 루프 구조(condition 도구 → deferral content, normal 도구 → budget 초과 시 budget_exceeded 또는 normal content) 를 가진다. 핵심 차이는 (1) thread push 방식, (2) condition 도구에서 single-turn 은 `toolCallCount` 미증가, multi-turn 은 증가라는 의도적 시맨틱 차이다. 이 차이가 JSDoc 에 명확히 문서화되어 있으나, `condDeferralContent` 와 `budgetContent` 의 하드코딩 JSON 문자열은 두 메서드에서 완전히 동일하게 반복된다.
- 제안: `condDeferralContent` 와 `budgetContent` 문자열을 파일 레벨 상수로 추출. 두 메서드를 합치는 것은 의도적 시맨틱 차이 때문에 지금 당장 권장하지 않는다.

### [INFO] 하드코딩된 한국어 deferral 문자열 상수화 미완료
- 위치: `recordSingleTurnNonProviderToolResults` +114~+116, `recordMultiTurnNonProviderToolResults` +536~+538
- 상세: `'확인되었습니다. 도구 실행 결과를 참고하여 최종 판단해주세요.'` 및 `'tool_call_budget_exceeded'` 문자열 리터럴이 두 메서드 본문에 직접 존재한다. 파일 내에 이미 `FORM_SUBMITTED_GUIDANCE_MESSAGE`, `KB_TOOL_GUIDANCE` 등 공유 문자열을 상수로 추출하는 패턴이 확립되어 있는데 이 문자열들만 예외다.
- 제안: `CONDITION_DEFERRAL_RESULT_MSG`, `TOOL_BUDGET_EXCEEDED_ERROR` 등으로 상수화해 파일 상단 상수 패턴과 일치시킬 것.

### [INFO] `handleSingleTurnConditionRoute` 에서 `Date.now()` 가 동일 컨텍스트 내 두 번 호출됨
- 위치: diff +281~+288 (`buildConditionOutput` 두 번째·세 번째 인수 내 `Date.now() - singleTurnStartedAt`)
- 상세: `totalDurationMs: Date.now() - singleTurnStartedAt` 이 동일 return 문 내의 두 다른 객체 리터럴에 각각 독립적으로 계산된다. 두 값이 근소하게 달라질 수 있으며, 의도가 "같은 완료 시점 기준" 이라면 한 번 캡처해야 일관성이 보장된다. `handleMultiTurnConditionRoute` 에도 동일 패턴이 있다.
- 제안: `const totalDurationMs = Date.now() - singleTurnStartedAt;` 으로 한 번만 계산 후 두 곳에서 재사용.

### [INFO] `applyMultiTurnTurnMemory` 의 `executionId` 파라미터 undefined 처리 책임이 불명확
- 위치: diff +788, +818 (`applyMultiTurnTurnMemory` 파라미터 `executionId: string | undefined`)
- 상세: 파라미터 타입은 `string | undefined` 이고 내부에서 `executionId ?? ''` 로 fallback 처리한다. caller 에서 이미 같은 값을 `executionId` 로 보유하고 있어 caller·helper 양쪽에서 fallback 로직이 분산될 가능성이 있다. 기존 코드베이스 패턴과 비교할 때 caller 에서 narrowing 후 `string` 으로 전달하는 방식이 더 일관적이다.
- 제안: caller 에서 `executionId: executionId ?? ''` 처리 후 `string` 타입으로 전달하거나, helper 파라미터를 `string` 으로 변경해 caller 책임을 명확히 할 것.

---

## 요약

이번 리팩터링은 768/545 라인 god-method 두 개를 6개 private helper 로 분해해 가독성·단일 책임 분리 측면에서 의미 있는 개선을 이뤘다. 메서드 추출 범위, JSDoc 품질, spec 참조 주석이 일관되고 명확하다. 다만 추출된 helper 들이 20개 안팎의 파라미터를 args 객체로 받는 패턴이 반복되어 있으며, 이는 accumulator 군을 별도 타입으로 묶는 2차 정리 없이 메서드만 분리한 결과다. 또한 `MultiTurnMemoryMeta` 타입 중복 선언, 한국어 deferral 문자열·에러 키 상수화 미완료, `Date.now()` 이중 호출 등 소규모 일관성 이슈가 남아있다. 전반적으로 복잡도는 낮아졌으나 파라미터 비대 문제가 다음 리팩터링 회차의 주요 대상이다.

## 위험도

LOW
