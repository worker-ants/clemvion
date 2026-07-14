# 정식 규약 준수 검토 결과

대상: `spec/4-nodes/3-ai/` (impl-done, diff-base=origin/main)
실제 diff 범위: `spec/4-nodes/3-ai/1-ai-agent.md` (§4.2·§10·§12.15 신설 + frontmatter `code`/`pending_plans` 갱신), 동반 갱신 `spec/conventions/cross-node-warning-rules.md`, `spec/5-system/11-mcp-client.md §5.8`.

## 발견사항

- **[WARNING]** §4.2 "single-turn 은 try/catch 가 없다" 서술이 실제 구현과 정반대
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §4.2 "런타임 판정 위치" 단락 마지막 문장 — `"single-turn 경로(executeSingleTurn)는 현재 이 throw 를 감싸는 try/catch 가 없으므로 (multi-turn handleAiMessageTurn 과 비대칭) 본 에러코드가 output.error+error 포트로 귀결되도록 라우팅을 보장한다."`
  - 위반 규약: `spec/conventions/node-output.md` Principle 3 (에러 컨트랙트 통일) — 에러가 `error` 포트로 귀결되는 메커니즘을 spec 이 정확히 서술해야 한다는 전제. 또한 `spec/conventions/spec-impl-evidence.md` 의 "`code:`(frontmatter) 가 가리키는 구현과 본문 서술이 정합해야 한다" 원칙과 충돌.
  - 상세: 실제 구현은 정반대다. `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:576-591` 의 클래스 JSDoc(`ToolDefinitionPayloadExceededError 전파 계약`)이 명시적으로 "`executeSingleTurn` — try/catch 로 잡아 §7.3 error 포트 output 을 그대로 **return** 한다(throw 전파 아님)" / "multi-turn(`processMultiTurnMessage`/`handleAiMessageTurn`) — 잡지 않고 그대로 **throw** 전파한다"고 선언하며, `buildSingleTurnToolsOrError`(같은 파일 1464-1522행)가 `catch (err) { if (err instanceof ToolDefinitionPayloadExceededError) { return { errorOutput: {...} } } throw err; }` 로 **single-turn 쪽에 명시적 try/catch 를 두고 있다**. 즉 spec 문장의 "어느 경로에 try/catch 가 있는가"가 뒤바뀌어 있다. 이 문장은 spec-first 커밋(`98e728ba9`)에서 작성된 뒤, 같은 PR 안의 "spec 정합 정정" 커밋(`c0acc6337`, 커밋 메시지: "§10 error details.retryable 를 details 안으로 정정" 등)이 인접 문장들을 고쳤음에도 이 문장은 그대로 남았다.
  - 제안: 문장을 실제 구현에 맞춰 정정 — "single-turn 경로(`buildSingleTurnToolsOrError`)는 이 throw 를 try/catch 로 흡수해 §7.3 error output 을 직접 조립·반환하고, multi-turn 경로는 throw 를 orchestrator 까지 전파시켜 `extractAiTurnErrorPayload` 가 동일 shape 을 조립한다"로 교체 권장. 결과적으로 두 경로 모두 `error` 포트로 귀결되는 최종 계약 자체는 유지되므로(코드 JSDoc 도 "두 경로 모두 최종적으로 동일한 error 포트 output 이 도달"이라 명시) CRITICAL 은 아니다.

- **[WARNING]** §10 "도구 정의 payload 예산 경고 (저장 시점)" 단락에 Planned 마커 누락
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §10 "도구 정의 payload 예산 경고 (저장 시점)" 단락 (신설)
  - 위반 규약: 같은 문서군 `spec/4-nodes/3-ai/0-common.md` §8 "캔버스 요약"이 이미 확립한 로컬 컨벤션 — 미구현 기능은 `> ⚠ **구현 현황**: ... (Planned)` 인라인 마커로 본문에 명시한다. 아울러 `spec/conventions/spec-impl-evidence.md` 의 spec 약속 surface ↔ 실제 구현 정합 원칙.
  - 상세: 이 단락은 `getGraphWarnings`/`saveCanvas`/`GRAPH_VALIDATION_FAILED` 승격을 모두 현재형으로 서술해 이미 동작하는 기능처럼 읽힌다. 그러나 같은 PR 이 동반 갱신한 `spec/conventions/cross-node-warning-rules.md` §8 은 동일 rule(`ai_agent:tool-payload-budget`)을 "**⚠ 구현 예정(Planned)** — 런타임 fail-fast 는 구현됨, config-time graph warning 은 후속 `plan/in-progress/ai-agent-tool-payload-budget-followups.md`"로 명시하며, 실제로 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE` 는 `codebase/backend/src/` 전체에서 참조 0건(grep 확인) — config-time 저장 경고 기능 자체가 아직 미구현이다. `1-ai-agent.md` 만 읽는 독자는 이 사실을 알 수 없다. 같은 문서군 `0-common.md §8`이 정확히 이런 상황(Text Classifier 만 구현, 나머지 Planned)을 인라인 ⚠ 박스로 이미 표시하고 있어 로컬 선례와 어긋난다.
  - 제안: §10 해당 단락 서두에 "⚠ 구현 현황: 런타임 fail-fast(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`)만 구현됨 — 아래 저장 시점 config-time graph warning 은 미구현(Planned), `plan/in-progress/ai-agent-tool-payload-budget-followups.md`" 같은 인라인 마커 추가.

- **[INFO]** `11-mcp-client.md §5.8` 신규 cross-reference에 anchor 누락
  - target 위치: `spec/5-system/11-mcp-client.md` §5.8 (신설) — `[AI Agent §4.2](../4-nodes/3-ai/1-ai-agent.md)`, `[AI Agent §4.2/§10](../4-nodes/3-ai/1-ai-agent.md)`
  - 위반 규약: 명문화된 conventions 규칙은 아니나, 이 문서군 전반의 지배적 관행 — 예: `0-common.md`의 대다수 cross-ref는 `...9-rag-search.md#34-동적-점수-컷-생성-주입-모든-모드-공통` 처럼 절 anchor를 포함해 정밀 링크한다.
  - 상세: 신규 두 링크는 파일 최상단으로만 연결되어 §4.2/§10 절로 바로 스크롤되지 않는다. `spec-link-integrity.test.ts` 가드는 anchor가 없으므로 통과하지만(빌드 비차단), 문서군 내 링크 정밀도 관행과는 어긋난다.
  - 제안: `#42-도구-정의-payload-예산-tool-definition-payload-budget` / `#10-에러-코드` anchor 추가.

## 검증 완료(정합 확인, 위반 아님) 항목 — 참고용

- 에러 코드 `TOOL_DEFINITION_PAYLOAD_EXCEEDED` — `UPPER_SNAKE_CASE`, `node-output.md §3.2` 준수. `details.retryable: false` 고정(§3.2.1 LLM 계열 필수) + `retryAfterSec` 미포함(invariant: `retryable===true`일 때만 set) 정확히 준수.
- graphWarningRule id `ai_agent:tool-payload-budget` — 기존 `parallel:nested-depth-exceeded`/`ai_agent:no-llm-provider`/`ai_agent:too-many-conditions`와 동일한 `<node_type>:<kebab-rule>` 패턴 준수.
- env var 명명(`AI_AGENT_TOOL_PAYLOAD_SOFT_BYTES`/`_HARD_BYTES`/`AI_AGENT_TOOL_COUNT_MAX`/`AI_AGENT_TOOL_BUDGET_STRICT_SAVE`) — 기존 `AI_RETRY_STATE_TTL_MINUTES` 등과 일관된 `AI_*`/`AI_AGENT_*` prefix. 코드(`tool-payload-budget.ts`)의 실제 기본값(98304/262144/128)과 spec 표 수치 일치.
- frontmatter `code:` 신규 경로(`tool-payload-budget.ts`) 및 `pending_plans:` 신규 경로(`ai-agent-tool-payload-budget-followups.md`) 모두 실재 파일로 확인 — `spec-impl-evidence.md` §2.1/§4 가드 통과 형태.
- `cross-node-warning-rules.md`가 이번 PR에서 "backend-only async rule" 예외 조항(§5)과 §8 rule 등재를 **동반 신설**해, 신규 backend-only 패턴 도입과 규약 확장이 같은 PR 안에서 정합하게 이루어짐 — 정석적인 "규약 갱신 동반" 사례.
- `estimateAgentToolPayload(tools) → { bytes, approxTokens, toolCount, perProvider? }` 시그니처 — 실제 구현(`tool-payload-budget.ts:99-101`)과 정확히 일치.
- `GRAPH_VALIDATION_FAILED`/`getGraphWarnings` 재사용 — 기존 API 계약 재사용(신규 응답 필드 미신설)으로 `cross-node-warning-rules.md §5` 원칙 그대로 따름.

## 요약

이번 diff(§4.2/§10/§12.15 신설 + frontmatter 갱신, `cross-node-warning-rules.md`·`11-mcp-client.md §5.8` 동반 갱신)는 명명 규약(에러코드 UPPER_SNAKE_CASE, graphWarningRule id `<type>:<kebab>`, env var prefix), `node-output.md` Principle 3.2.1(`details.retryable` 필수·위치)·Principle 7 계열, `spec-impl-evidence.md`의 frontmatter `code`/`pending_plans` 실존 요건을 정확히 준수하며, 특히 `cross-node-warning-rules.md`에 신규 "backend-only async rule" 예외 조항을 같은 PR에서 동반 신설해 규약과 spec 확장이 정합하게 이루어진 모범적인 사례다. 다만 §4.2의 "single-turn 에 try/catch 가 없다" 서술이 실제 구현(정반대 — multi-turn 이 throw 를 전파하고 single-turn 이 흡수)과 어긋나고, §10의 저장 시점 config-time graph warning 서술이 실제로는 미구현(Planned)임에도 같은 문서군의 로컬 관행(`0-common.md §8`의 ⚠ 인라인 마커)을 따르지 않은 채 현재형으로 서술되어 있다. 두 건 모두 최종 계약(에러 포트 귀결, backend-only 평가·3중 가드 구조) 자체를 깨뜨리지는 않으므로 CRITICAL 로 격상하지 않으나, 독자가 문서만 보고 잘못된 멘탈모델(구현 메커니즘·구현 완료 여부)을 가질 수 있어 WARNING 으로 보고한다.

## 위험도

LOW
