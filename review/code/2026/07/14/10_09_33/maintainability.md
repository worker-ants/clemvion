# Maintainability Review — AI Agent tool-definition payload budget guardrail

대상: `codebase/backend/src/nodes/ai/ai-agent/{ai-turn-executor.ts, ai-turn-executor.spec.ts, tool-payload-budget.ts, tool-payload-budget.spec.ts}`
(plan/*.md, review/consistency/**, spec/**.md 는 소스 코드가 아니므로 유지보수성 관점 대상에서 제외)

## 발견사항

- **[WARNING]** `executeSingleTurn` 이 436줄(`ai-turn-executor.ts:1401`~`1836`)에 달하는 단일 함수이며, 이번 diff가 여기에 `buildTools` try/catch + `singleTurnConfigEcho` 조립 블록(약 50줄, `1406-1551`)을 추가로 얹어 이미 큰 함수의 책임을 더 늘렸다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1401-1551`
  - 상세: 하나의 메서드가 config 파싱, system prompt 조립, memory injection, config-echo 조립, tool-payload 예산 오류 처리, LLM 호출, 결과 조립까지 모두 담당한다. 이번 변경은 기능적으로는 올바르지만(pre-flight fail-fast 를 정상 흐름과 같은 위치에 삽입) 함수 길이 문제를 완화하지 않고 심화시킨다.
  - 제안: 신규로 추가된 "`buildTools` 호출 + `ToolDefinitionPayloadExceededError` 캐치 + error-port output 조립" 블록을 `private buildSingleTurnTools(config, workspaceId, executionId, mcpDiagnosticsAcc, configEcho, enteredAt, model, llmConfig): Promise<ToolDef[] | NodeHandlerOutput>` 같은 private 헬퍼로 추출하면 `executeSingleTurn` 본문 길이를 줄이고, 향후 세 번째 호출부가 생기더라도 동일 에러 라우팅 로직을 재사용할 수 있다.

- **[WARNING]** 신규 변수 `singleTurnEnteredAt`(`ai-turn-executor.ts:1409`)과 기존 변수 `singleTurnStartedAt`(`ai-turn-executor.ts:1560`)의 이름이 거의 동일해 의미(메서드 진입 시각 vs LLM 턴 시작 시각) 혼동 위험이 있다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1406-1409` (신규) vs `:1560` (기존)
  - 상세: 두 변수 모두 `Date.now()` 를 담고, 스코프가 겹치며(둘 다 `executeSingleTurn` 로컬), 접두어 `singleTurn` 이 동일해 자동완성/코드리뷰 시 실수로 바뀌어 쓰이기 쉽다. 작성자 스스로 "`singleTurnStartedAt`(아래)와 별개로 method 진입 시점을 잡는다" 라는 주석을 남겨야 했다는 점 자체가 이름만으로는 구분이 안 된다는 신호다.
  - 제안: `singleTurnEnteredAt` → `methodEnteredAt` 또는 `preflightStartedAt` 등으로 개명해 "LLM 턴 자체의 시작 시각"과 명확히 구분한다.

- **[INFO]** `tool-payload-budget.ts` 의 `readByteBudget` 헬퍼가 이름은 "byte" 를 특정하지만 실제로는 `toolCountMax()`(바이트가 아닌 "개수" 예산) 파싱에도 재사용된다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:28-45`
  - 상세: `readByteBudget('AI_AGENT_TOOL_COUNT_MAX', 128)` 호출은 함수명과 실제 의미(범용 numeric env 파서)가 어긋난다. 기능상 문제는 없으나 이름이 오해를 유발할 수 있다.
  - 제안: `readByteBudget` → `readNumericEnvBudget` / `readEnvNumber` 등 범용 이름으로 개명.

- **[INFO]** hard 초과 메시지(`buildExceededMessage`)와 soft 초과 warn 메시지(`enforceToolPayloadBudget` 내부)가 거의 동일한 문구 템플릿("... tool definitions serialize to N bytes across M tools, exceeding the ... budget of B bytes ...")을 독립적으로 각각 작성한다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts:152-163` (hard) vs `:193-203` (soft)
  - 상세: 두 메시지는 culprit 표기 형식(`Largest contributor: "X".` vs `(largest contributor: "X")`)만 다르고 나머지 어휘가 사실상 중복이다. 향후 문구를 손볼 때 한쪽만 수정하고 다른 쪽을 누락할 drift 위험이 있다.
  - 제안: 공통 부분(`"... serialize to {bytes} bytes across {count} tools, exceeding the {kind} budget of {budget} bytes"`)을 파라미터화한 헬퍼로 통합하고 hard/soft 는 접미사(마감 문구·culprit 포맷)만 다르게 조립.

- **[INFO]** `buildTools`(`ai-turn-executor.ts:3462`) 에 `ToolDefinitionPayloadExceededError` 를 throw할 수 있다는 계약이 JSDoc으로 명시돼 있지 않다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3462-3505`
  - 상세: 두 호출부(단일턴은 catch, 멀티턴은 propagate)가 이 에러를 다르게 처리하는데, 그 비대칭성 설명은 오직 단일턴 호출부의 주석에만 있다. `buildTools` 정의 자체를 먼저 읽는 개발자는 이 계약을 놓치기 쉽다.
  - 제안: `buildTools` 위에 `@throws {ToolDefinitionPayloadExceededError}` 한 줄과 "호출부가 처리 방식을 결정해야 한다" 는 짧은 안내를 추가.

- **[INFO]** 신규 에러 반환 경로에서 `llmConfig?.defaultModel`(옵셔널 체이닝, `ai-turn-executor.ts:1543`)을 쓰지만, 바로 위 `singleTurnConfigEcho` 조립부(`:1503`)는 동일 스코프의 같은 `llmConfig` 를 `llmConfig.defaultModel`(옵셔널 아님)로 접근한다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1503` vs `:1543`
  - 상세: `llmConfig` 는 `resolveConfig` 가 실패 시 throw 하는 계약이라 non-null 로 보이는데, 새 코드만 방어적으로 `?.` 를 붙여 null 가능성에 대한 판단이 두 곳에서 다르다는 인상을 준다. 실질 버그는 아니지만 독자에게 "여기선 null 이 될 수 있나?" 라는 불필요한 의문을 남긴다.
  - 제안: 기존 코드와 동일하게 `llmConfig.defaultModel` 로 통일(또는 정말 null 가능성이 있다면 그 이유를 주석으로 남김).

## 요약

새로 추가된 `tool-payload-budget.ts`/`tool-payload-budget.spec.ts` 는 단일 책임 함수, 명확한 네이밍, 풍부한 spec 참조 주석, 촘촘한 단위 테스트(estimator, enforce, env override 분리)를 갖춘 모범적인 구현으로 유지보수성이 높다. 반면 `ai-turn-executor.ts` 쪽 변경은 기능적으로 타당하지만(§4.2 pre-flight를 §7.3 error 포트로 라우팅) 이미 436줄에 달하는 `executeSingleTurn` 함수를 더 확장했고, `singleTurnEnteredAt`/`singleTurnStartedAt` 처럼 구분이 어려운 변수명을 새로 도입했다. 이는 즉각적인 버그를 유발하진 않지만 다음 변경자가 실수할 표면을 넓힌다. 나머지 지적(네이밍 미스매치, 메시지 템플릿 중복, JSDoc 계약 누락)은 모두 사소하며 opportunistic 하게 고칠 수 있는 수준이다.

## 위험도
LOW
