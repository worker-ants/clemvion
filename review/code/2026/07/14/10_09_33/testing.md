# 테스트(Testing) 리뷰 — AI Agent 도구 정의 payload 예산 가드레일

대상: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts`(신규) ·
`tool-payload-budget.spec.ts`(신규) · `ai-turn-executor.ts`(diff) ·
`ai-turn-executor.spec.ts`(diff, `describe('tool-definition payload budget (§4.2)')`
신규 블록). `npx jest ai-turn-executor.spec.ts tool-payload-budget.spec.ts` 실측—
48/48 통과, 회귀 없음 확인.

## 발견사항

- **[WARNING] JSDoc 이 명시한 "env=0 → fallback" 계약이 테스트로 고정되지 않음**
  - 위치: `tool-payload-budget.ts:24` (`readByteBudget` JSDoc "빈 문자열/비수치/**0**
    은 fallback 으로 방어된다") / `tool-payload-budget.spec.ts` `'falls back to
    defaults for empty / non-numeric env values'` (L530-535)
  - 상세: 구현이 `Number(process.env[envName]) || fallback` 이므로 `'0'` 은
    falsy 라 fallback 이 적용되는 것이 사실이지만, 테스트는 `''` 과
    `'not-a-number'` 두 케이스만 검증하고 문서가 명시적으로 언급한 `'0'` 케이스는
    검증하지 않는다. 이 줄이 향후 `Number.isNaN` 체크 등으로 리팩터될 때 "0 은
    방어된다"는 계약이 조용히 깨져도 잡아낼 테스트가 없다.
  - 제안: `process.env.AI_AGENT_TOOL_PAYLOAD_HARD_BYTES = '0'; expect(toolPayloadHardBytes()).toBe(262144);` 같은 케이스를 기존 `it` 에 추가.

- **[WARNING] 음수 env 값이 예산을 "항상 실패"로 고정시키는 동작이 문서화·테스트 모두 없음**
  - 위치: `tool-payload-budget.ts:24-30` (`readByteBudget`)
  - 상세: `Number('-5')` 는 `-5`(truthy) 라 fallback 을 우회하고 그대로 반환된다.
    `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES=-1` 같은 오설정이 들어오면 `estimate.bytes
    (항상 ≥ 2, `"[]"`) > -1` 이 항상 참이 되어 도구가 하나도 없어도
    `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 가 상시 throw 된다 — silent
    misconfiguration 이 전체 AI Agent 노드를 영구 차단하는 실전 위험 시나리오인데
    가드도 테스트도 없다.
  - 제안: 의도된 동작이면(예: ops 가 강제 차단용으로 음수를 쓸 수 있음) 최소
    회귀 테스트 1건으로 계약을 고정. 의도치 않은 것이면 `Math.max(0, ...)` 류
    방어 추가 후 테스트.

- **[WARNING] single-turn `buildTools` catch 블록의 rethrow 분기(`else { throw err; }`)가 테스트로 검증되지 않음**
  - 위치: `ai-turn-executor.ts:1531-1552` (`executeSingleTurn` 의 `catch (err)` —
    `ToolDefinitionPayloadExceededError` 가 아니면 `throw err;`)
  - 상세: 신규 `describe('tool-definition payload budget (§4.2)')` 3개 테스트는
    모두 `ToolDefinitionPayloadExceededError` 발생 경로만 다룬다. `buildTools`
    가 던질 수 있는 다른 예외(예: provider 내부 미처리 예외, 그러나 실제로는
    provider-loop 자체가 개별 provider 실패를 흡수하므로 발생 지점이 제한적임)
    가 실수로 이 새 catch 블록에 흡수돼 `error` 포트로 잘못 라우팅되는 회귀를
    잡을 안전망이 없다. 이 catch 블록은 이번 diff 로 새로 생긴 코드이므로
    "다른 에러는 rethrow" 라는 명시된 계약(코드 주석 L1522 "다른 에러는
    rethrow")을 직접 고정하는 테스트가 없으면, 향후 리팩터링 시 `instanceof`
    체크가 느슨해져도(예: 문자열 `err.code` 비교로 바뀌는 등) 감지되지 않는다.
  - 제안: `buildTools` 내부에서 임의 provider 를 `buildTools: jest.fn().mockRejectedValue(new Error('boom'))` 로 만들어 provider-loop 흡수 밖의 예외(예: `conditionEvaluator.buildConditionTools` mock 을 통해 강제 throw, 또는 `enforceToolPayloadBudget` 자체가 아닌 다른 임의 Error) 를 주입해 `executeSingleTurn` 이 그대로 rethrow 하는지 1건 추가.

- **[INFO] 멀티턴 테스트명이 암시하는 `extractAiTurnErrorPayload` 경유 검증이 실제로는 수행되지 않음**
  - 위치: `ai-turn-executor.spec.ts:1015` `it('throws out of buildTools so
    multi-turn resume can route via extractAiTurnErrorPayload', ...)`
  - 상세: 테스트는 `executor.processMultiTurnMessage(...)` 의 reject 가
    `{ code: 'TOOL_DEFINITION_PAYLOAD_EXCEEDED' }` 를 `toMatchObject` 하는지만
    본다 — 이는 `ToolDefinitionPayloadExceededError.code` 필드 정의만으로
    trivial 하게 참이며, 실제 `AiTurnOrchestrator.extractAiTurnErrorPayload`
    (`ai-turn-orchestrator.service.ts:1120`) 를 호출/검증하지 않는다.
    `extractAiTurnErrorPayload` 는 자체 spec(`ai-turn-orchestrator.service.spec.ts`)
    에 "명시 code + details 를 보존" 하는 동형 케이스(`LLM_API_ERROR` +
    `details.retryAfter` 보존, L427 근처)가 이미 있어 구조적으로는
    커버되지만, `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 고유 케이스(details 에
    `retryable:false` 가 이미 포함된 상태에서 `mergedDetails` 병합이
    `budgetBytes`/`culpritProvider`/`toolCount` 를 그대로 보존하는지)를 직접
    엔드투엔드로 고정하는 테스트는 없다. 테스트명이 주는 신뢰와 실제 검증
    범위 사이에 괴리가 있다.
  - 제안: 테스트명을 "raw error 를 그대로 rethrow (unwrap 하지 않음)" 등으로
    좁히거나, `ai-turn-orchestrator.service.spec.ts` 의
    `extractAiTurnErrorPayload` describe 에 `ToolDefinitionPayloadExceededError`
    인스턴스를 직접 넣어 `{ code, details: { retryable:false, budgetBytes,
    toolCount, culpritProvider } }` 이 그대로 보존되는 케이스 1건을 추가해
    두 스펙 사이의 계약을 명시적으로 봉합.

- **[INFO] `pickCulpritProvider` 의 "빈 perProvider → culpritProvider undefined" 분기 미검증**
  - 위치: `tool-payload-budget.ts:670-679` (`pickCulpritProvider`) /
    `ToolDefinitionPayloadExceededDetails.culpritProvider?: string` (optional)
  - 상세: `tool-payload-budget.spec.ts` 의 모든 hard-throw 케이스는 최소 1개
    이상의 tool 을 포함해 `culpritProvider` 가 항상 채워진 경로만 검증한다.
    `tools: []` 인 상태에서 hard 예산을 강제로 트리거(예:
    `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` 를 매우 낮게, 또는 위 음수 케이스)하면
    `culpritProvider` 가 `undefined` 인 `details` 가 만들어지는데, 이때
    `details` 객체에 `culpritProvider` 키 자체가 spread 로 생략되는 동작
    (`...(culpritProvider ? { culpritProvider } : {})`)이 테스트되지 않는다.
    이 shape 는 소비자(§7.3 output.error.details 소비 UI/로직)가 `'culpritProvider' in details` 로 존재 여부를 분기할 수 있어 실무적 의미가 있다.
  - 제안: `enforceToolPayloadBudget([], { warn: jest.fn() })` (hard 예산을
    `-1` 등으로 강제) → `expect(caught?.details).not.toHaveProperty('culpritProvider')` 케이스 1건 추가.

- **[INFO] `meta.model` 필드가 error-port 출력에서 값까지 검증되지 않음**
  - 위치: `ai-turn-executor.spec.ts:104` (`const meta = ...; expect(typeof meta.durationMs).toBe('number');`)
  - 상세: `ai-turn-executor.ts:1546` 의 error 반환 `meta.model` 은
    `model || llmConfig?.defaultModel` 로 계산되는데, 테스트는 `durationMs`
    타입만 확인하고 `meta.model` 값(예: mock `resolveConfig` 가 반환하는
    `defaultModel: 'gpt-4o'`)은 검증하지 않는다. 정상 `out` 종결 경로의 다른
    테스트들은 유사 필드를 값까지 확인하는 패턴이 있어(관례 일관성 측면) 누락이
    두드러진다.
  - 제안: `expect(meta.model).toBe('gpt-4o')` 한 줄 추가.

## 요약

새 `tool-payload-budget.ts`/`.spec.ts` 는 estimator·soft/warn·hard/throw·count 초과·
env override·NaN 방어를 촘촘히 단위 테스트로 고정했고, `ai-turn-executor.spec.ts`
의 신규 3건은 "LLM 호출 전 fail-fast + error 포트 반환(single-turn)"과
"multi-turn 은 throw 전파" 라는 핵심 비대칭 계약을 정확히 겨냥해 잘 설계됐다
(실측 `npx jest` 48/48 통과, 회귀 없음). 다만 이번 diff 로 새로 생긴
`executeSingleTurn` 의 `catch`-`else`-`rethrow` 분기가 미검증이라는 점,
JSDoc 이 명시한 `0`/음수 env 계약이 부분적으로만 테스트된다는 점, 멀티턴
테스트명이 실제로 검증하지 않는 `extractAiTurnErrorPayload` 경유를 암시한다는
점은 보강할 가치가 있다. 모두 CRITICAL 은 아니며 기존 기능 회귀 없이 안전하게
머지 가능한 수준이다.

## 위험도
LOW
