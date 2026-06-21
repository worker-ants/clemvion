# Testing Review — AiTurnExecutor (M-1 3단계)

## 발견사항

### [WARNING] capFormDataBytes 단위 테스트 누락
- 위치: `ai-turn-executor.spec.ts` — `capFormDataBytes` export 함수 미커버
- 상세: `capFormDataBytes`는 `ai-turn-executor.ts`에서 `export function`으로 직접 노출되어 있고, spec §12.7 바이트 cap 로직 전체(string 필드 균등 truncate, 비-string 필드 보존, zero-budget clamp, `FORM_DATA_TRUNCATED_MARKER` 부착, `formDataTruncation` 메타 반환 등)를 담당하는 복잡한 순수 함수다. 해당 경로의 테스트는 `ai-agent.handler.spec.ts`의 "formData 크기 cap" describe 블록(라인 2060~2200)에만 존재하며, 이 테스트들은 여전히 `AiAgentHandler`를 통한 통합 경로를 사용하고 있다. `ai-turn-executor.spec.ts`에는 동일 함수에 대한 직접 단위 테스트가 존재하지 않다. 엣지 케이스(모든 필드가 비-string인 경우의 `truncatedFields: []` 메타 반환, 멀티바이트 UTF-8 경계 truncate, budget이 MARKER 길이보다 작은 경우의 clamp 동작)는 기존 통합 테스트에서도 검증되지 않는다.
- 제안: `ai-turn-executor.spec.ts`에 `capFormDataBytes` 직접 단위 테스트 추가. 최소 3 케이스: (1) cap 미만 → 변경 없음, (2) cap 초과 + string 필드 → truncate + 메타, (3) cap 초과 + 비-string 필드만 → `truncatedFields: []`.

### [WARNING] processMultiTurnMessage의 form_submitted/bypass 분기 executor 직접 테스트 없음
- 위치: `ai-turn-executor.spec.ts` — `processMultiTurnMessage` describe 블록
- 상세: `processMultiTurnMessage`의 form 관련 세 분기 (`form_submitted + pendingFormToolCall`, `ai_message + pendingFormToolCall bypass`, `fallback no-pending`) 테스트가 `ai-agent.handler.spec.ts`에는 상세히 존재(라인 1708~2230)하지만, 새 `ai-turn-executor.spec.ts`에는 없다. 신규 spec의 목적이 "executor를 직접 구성해 collaborator 주입·graceful degrade·출력 포트 shape·`_retryState` 생명주기를 격리 검증"이라고 주석에 명시되어 있음에도 불구하고, 이 핵심 분기들이 executor 레벨에서 직접 테스트되지 않는다. 특히 `delete state.pendingFormToolCall` 부작용(state mutation)이 테스트되지 않아, executor가 form bypass 시 state를 올바르게 클리어하는지 격리 검증이 불가하다.
- 제안: executor 직접 구성 후 `pendingFormToolCall`이 담긴 state를 전달해 각 분기(form_submitted splice, ai_message bypass cancelled, fallback)를 격리 테스트. state.pendingFormToolCall 클리어 부작용도 검증.

### [WARNING] resolveRetryStateTtlMinutes 환경변수 엣지 케이스 executor 직접 테스트 누락
- 위치: `ai-turn-executor.spec.ts` — `endMultiTurnConversation` describe 블록
- 상세: `resolveRetryStateTtlMinutes`는 `ai-turn-executor.ts` 모듈 스코프 함수로 이동했고, 환경변수 파싱 로직(`non-numeric`, `negative`, `zero` fallback)을 포함한다. 기존 테스트는 `ai-agent.handler.spec.ts` 라인 3219~3245에 `it.each`로 존재하지만, 이 테스트들은 `AiAgentHandler.endMultiTurnConversation`을 통한 간접 호출이다. 신규 `ai-turn-executor.spec.ts`의 `endMultiTurnConversation` describe에서는 `AI_RETRY_STATE_TTL_MINUTES` 환경변수 영향을 검증하지 않는다. `process.env` 오염 방지를 위한 `afterEach` cleanup도 없다.
- 제안: `ai-turn-executor.spec.ts`의 `endMultiTurnConversation` describe에 TTL 환경변수 케이스 추가. `afterEach(() => { delete process.env.AI_RETRY_STATE_TTL_MINUTES; })` cleanup 포함.

### [INFO] RagAccumulator 내부 로직 단위 테스트 없음
- 위치: `ai-turn-executor.ts` — `RagAccumulator` 클래스 (라인 790~900)
- 상세: `RagAccumulator`의 `skipReason` 판정 로직(`empty_kb_list` → `kb_unsearchable` → `no_results` 우선순위), `seenChunkIds` 중복 제거, `fromState` hydrate는 executor 통합 경로에서만 간접적으로 검증된다. `kb_unsearchable` 판정 조건(`unsearchableKbCallCount === kbCallCount > 0`)은 경계값이 섬세하여 별도 단위 테스트 효과가 크다. 다만 이 클래스는 private이 아닌 모듈 내부 클래스라 직접 export가 필요하므로 INFO로 분류한다.
- 제안: `RagAccumulator`를 export하거나, handler.spec에서 이미 ragDiagnostics를 통해 간접 검증하는 현황이 충분하다면 현 상태 유지도 무방. 단, `kb_unsearchable` 경계값(호출된 KB 중 일부만 unsearchable인 경우)은 추가 통합 테스트 권장.

### [INFO] executeProviderToolBatch의 budget 초과 truncated 경로 executor 직접 테스트 없음
- 위치: `ai-turn-executor.spec.ts` — `executeProviderToolBatch` (private 메서드)
- 상세: `executeProviderToolBatch`는 `remainingBudget` 초과 tool_call을 `tool_call_budget_exceeded`로 회신하는 로직을 포함하며, Anthropic의 tool_use↔tool_result 페어링 요건 충족에 중요하다. 이 경로는 `ai-agent.handler.spec.ts`에서 통합 테스트되지만, executor 직접 테스트에서는 tool provider 주입 없이 LLM mock만 사용하므로 검증되지 않는다. private 메서드이므로 INFO로 분류하나, tool provider를 mock으로 주입하는 확장이 가능한 구조다.
- 제안: 필요 시 mock tool provider를 `buildExecutor({ toolProviders: [mockProvider] })`로 주입하고 LLM이 tool_call을 반환하도록 mock을 설정해 budget 초과 경로 검증 가능. 현재 우선순위는 낮으나 향후 tool provider 기능 확장 시 추가 권장.

### [INFO] 테스트 격리 — baseContext가 describe 스코프 밖에 선언됨
- 위치: `ai-turn-executor.spec.ts` 라인 163~167
- 상세: `baseContext`가 `const` 선언으로 `describe` 최상위에 정의되어 있어 각 `it` 블록에서 공유된다. `ExecutionContext`는 참조 타입이므로 한 테스트가 context 내부를 mutate하면 후속 테스트에 영향을 줄 수 있다. 현재 코드에서 실제 mutation은 발생하지 않는 것으로 보이나, `makeExecutionContext`의 반환 형태에 따라 잠재적 위험이 있다.
- 제안: `baseContext`를 `beforeEach`에서 생성하거나 각 `it` 블록에서 spread하는 패턴 적용. 현재 테스트 구조에서 실제 문제가 발생하지 않으므로 낮은 우선순위.

### [INFO] buildMultiTurnFinalOutput 테스트가 단일 it에 3개 포트를 검증 — 의도 불명확
- 위치: `ai-turn-executor.spec.ts` 라인 235~377, `buildMultiTurnFinalOutput` describe
- 상세: "maps max_turns / user_ended / error to their ports" 단일 `it` 블록 안에서 3개의 포트 검증을 순차 수행한다. 하나가 실패해도 나머지가 실행되지 않고, 실패 메시지가 어느 포트인지 즉시 파악하기 어렵다. 또한 `condition`이 `error`로 fallback하는 defensive 라우팅(코드 라인 3166)은 별도 `it`으로 분리되어 있지 않다.
- 제안: `it.each` 또는 개별 `it` 분리로 가독성 개선. 현재 동작 자체는 문제없으나 테스트 의도 표현의 명확성 측면.

## 요약

신규 `ai-turn-executor.spec.ts`는 executor의 5대 공개 메서드(executeSingleTurn, executeMultiTurn, processMultiTurnMessage, endMultiTurnConversation, buildMultiTurnFinalOutput)를 모두 커버하고 의존성 주입·graceful degrade·출력 포트 shape·`_retryState` 생명주기를 격리 검증한다는 점에서 1·2단계(AiConditionEvaluator, AiMemoryManager) 선례와 동형 구조를 잘 따른다. 그러나 신규 파일에서 executor 직접 테스트를 목표로 선언했음에도 불구하고, `capFormDataBytes`의 복잡한 byte-level 로직, form_submitted/bypass 분기의 state mutation, 환경변수 기반 TTL 로직이 executor 레벨에서 직접 검증되지 않고 기존 handler.spec 통합 경로에만 의존한다. 이는 향후 handler에서 executor 간 경계가 변경될 때 테스트가 올바른 계층을 커버하지 못하는 위험을 남긴다. 또한 `capFormDataBytes`의 멀티바이트 UTF-8 경계 처리, `RagAccumulator`의 `kb_unsearchable` 경계값 같은 엣지 케이스는 기존 통합 테스트에서도 검증이 미흡하다. 전반적으로 테스트 구조는 건전하나, executor 직접 테스트 파일로서의 커버리지 완결성 측면에서 보강이 필요하다.

## 위험도

MEDIUM
