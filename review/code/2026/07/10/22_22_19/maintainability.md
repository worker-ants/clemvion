# 유지보수성(Maintainability) Review

## 스코프

`llm_usage_log` attribution 배선 하드닝 diff (backend 4개 소스/스펙 파일 + 3개 spec.ts 테스트 + CHANGELOG + plan 2건). 핵심 변경은 `AiMemoryManager.injectMemoryContext` / `buildSummaryBufferUpdate` 에 `llmContext?: LlmCallContext` 옵션 필드를 추가하고, `ai-turn-executor.ts` 의 single-turn/multi-turn resume 두 caller 가 각각 `context.*`/`state.*` 로 조립해 forward 하는 것.

## 발견사항

- **[INFO]** `llmContext: { workflowId, executionId, nodeExecutionId }` 형태의 attribution 객체가 `ai-turn-executor.ts` 안에서 3곳(단발 `applySingleTurnMemoryInjection` L1163-1167, multi-turn resume 메모리 주입 `applyMultiTurnTurnMemory` L2298-2302, multi-turn resume 메인 chat L2614-2618) 수작업으로 반복 조립된다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1163`, `:2298`, `:2614`
  - 상세: 세 곳 모두 동일한 3-필드 shape 을 서로 다른 소스(`context.*` vs `state.*` cast)에서 조립한다. 이 정확한 shape 는 이번 PR 이전에도 `text-classifier.handler.ts`, `information-extractor.handler.ts` 등에서 반복되는 기존 코드베이스 컨벤션이라 이 diff 가 새로 만든 패턴은 아니다. 다만 바로 이 shape 의 필드 오사입/누락이 이번 하드닝의 근본 원인(선행 리뷰 Critical#1, INFO#1)이었던 점을 감안하면, 반복될수록 동일 클래스의 회귀 위험이 늘어난다.
  - 제안: 당장 조치는 불필요(기존 컨벤션 준수, 스코프 확대 지양). 다만 이 shape 이 4번째로 등장하는 시점엔 `buildLlmCallContextFromExecutionContext(context)` / `buildLlmCallContextFromState(state, executionId)` 같은 얇은 factory 로 추출을 고려할 만하다.

- **[INFO]** 3곳의 `llmContext` 객체 리터럴 중 명시적 `: LlmCallContext` 타입 주석이 붙은 곳은 L2614 한 곳뿐이다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1163`, `:2298` (미주석) vs `:2614` (`const llmContext: LlmCallContext = {...}`, 주석 有)
  - 상세: L1163/L2298 은 `injectMemoryContext(...)` 호출 인자 객체 리터럴에 직접 중첩되어 있어 TS 의 fresh-literal 규칙상 excess-property check 가 컨텍스트로 전이돼 오늘 시점엔 오탈자를 여전히 컴파일 타임에 잡아준다(문제 없음). 반면 L2614 은 `const` 로 먼저 바인딩한 뒤 값으로 전달하는 형태라 literal freshness 를 잃어 명시 타입 주석이 필요했고, 실제로 그렇게 되어 있다(주석에 "ai-review INFO#1" 근거 명시). 즉 세 곳의 보호 수준이 코드 형태(inline literal vs 로컬 변수)에 암묵적으로 의존한다 — 이후 누군가 L1163/L2298 을 L2614 처럼 `const` 로 리팩터링하면서 타입 주석 추가를 깜빡하면, 이번에 하드닝한 것과 동일 클래스의 오탈자 회귀가 조용히 재발할 수 있다.
  - 제안: 필수는 아니나, 세 곳 모두 `const llmContext: LlmCallContext = {...}` 형태 + 명시 주석으로 통일하면 코드 형태 변화에 안전한(refactor-safe) 방어가 된다.

- **[INFO]** `AiMemoryManager.injectMemoryContext` 의 args 객체 타입이 이번 diff 로 필드 하나(`llmContext?`)가 더 늘어 15개 이상의 named field 를 가진 대형 파라미터 bag 이 되었다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts:780-834`
  - 상세: 이 함수/시그니처는 이번 diff 이전부터 이미 크며, 새 필드는 관련 필드(`workspaceId`/`executionId`) 근처에 잘 배치되고 JSDoc 도 충실하다 — diff 자체가 만든 새 문제는 아니다. 다만 attribution 관련 필드가 이번에 1개 늘었으니, 유사 필드가 더 추가될 경우 `{ workflowId, executionId, nodeExecutionId }` 를 단일 `llmContext: LlmCallContext` 형태로만 받고 개별 `executionId` 필드는 제거/통합하는 정리가 향후 가치 있을 수 있다(현재는 `executionId` 가 이 메서드의 다른 로직(recall scopeKey 등)에도 독립적으로 쓰이므로 지금 통합은 과도한 스코프).
  - 제안: 지금 조치 불필요. 참고용 메모.

- **[INFO]** 세 테스트 파일(`ai-agent.memory.spec.ts`, `ai-memory-manager.spec.ts`, `agent-memory-injection.spec.ts`) 이 각각 다른 레이어에서 동일 attribution 배선을 검증한다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts:85-92`, `ai-memory-manager.spec.ts:124-166`, `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts:1176-1202`
  - 상세: 언뜻 중복 테스트로 보이지만 실제로는 서로 다른 호출 경로(단발 caller / multi-turn resume caller / 공유 순수 함수)를 각각 고정하는 의도된 대칭 커버리지이며, 각 테스트 주석이 "WARNING#2 대칭 커버" 등으로 그 의도를 명확히 남겨 향후 독자가 중복으로 오인해 하나를 지우는 실수를 방지하고 있다. 문제 아님, 오히려 좋은 관행으로 평가.

## 요약

변경 폭이 작고(핵심 로직은 4개 소스 파일, 대부분 옵션 필드 1개 추가 + forward 한 줄) 각 필드·분기에 spec 인용(`[Spec 7-llm-usage §1.3]`)과 근거 주석이 충실히 달려 있어 가독성·의도 전달이 우수하다. 네이밍(`llmContext`/`LlmCallContext`)과 하위호환 처리(`llmContext` 미전달 시 `undefined` 로 안전 폴백, 관련 회귀 테스트 존재)도 일관적이다. 함수 길이·중첩 깊이·복잡도 측면에서 이 diff 자체가 새로 추가하는 분기나 중첩은 없으며, 기존에 이미 크던 `injectMemoryContext`/`buildSummaryBufferUpdate` 를 악화시키지도 않는다. 유일하게 눈에 띄는 점은 `{workflowId, executionId, nodeExecutionId}` attribution 객체를 파일 내 3곳(및 코드베이스 전반의 다른 노드 핸들러들)에서 손으로 반복 조립하는 기존 컨벤션이 이번에도 그대로 이어졌다는 것과, 그중 타입 주석에 의한 명시적 보호가 1곳에만 있다는 점인데, 둘 다 즉각 조치가 필요한 수준은 아니고 향후 동일 shape 이 더 늘어날 때 재검토할 만한 메모 수준이다.

## 위험도

LOW
