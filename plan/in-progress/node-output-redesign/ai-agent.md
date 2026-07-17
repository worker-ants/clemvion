# AI Agent output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: god-handler 분할(#665 AiConditionEvaluator / #668 AiMemoryManager / #669 AiTurnExecutor)·엔진 C-1 분할(#622·#625·#627·#630 → `modules/execution-engine/ai-turn-orchestrator.service.ts`)로 본 plan 의 `파일:라인` 인용 거의 전부가 stale → 전면 재확정. 실제 turn 로직은 이제 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 에 있고 `ai-agent.handler.ts` 는 facade(9.7KB). **해소**: (1) D6(2026-05-17) — waiting/resumed 의 `output.{messages,message,turnCount}` 가 종결과 단일 경로 `output.result.*` 로 통일되고 top-level `output.maxTurns`/단수 `output.message`(top-level) 제거 + spec §7.4 표·§7.5 D6 노트 정합 → Principle 1.1 직교 위반 항목 전부 해소(`ai-turn-executor.ts:1764-1770`·`:2478-2489`, spec L698-701/L759). (2) **multi-turn error 컨트랙트** — 엔진 `handleAiTurnError`+`classifyLlmError`(429→`LLM_RATE_LIMIT` retryable, 5xx/network→`LLM_CALL_FAILED` retryable, 401/403→non-retryable, 미분류 code passthrough)가 `endMultiTurnConversation(state,'error',errorPayload)`→`buildMultiTurnFinalOutput` 로 `output.error`+부분 `output.result.*` 병존·`port:'error'`·retryable 시 `_retryState` 까지 emit, 단위테스트 다수(`ai-turn-orchestrator.service.spec.ts:364~552`, `ai-agent.handler.spec.ts:3004~3207`). `LLM_RATE_LIMIT` 코드도 구현(`ai-turn-orchestrator.service.ts:1039-1082`). (3) **§7.5 resumed** — `status:'resumed'` structured 스냅샷은 여전히 AI 메시지 경로에선 setStructuredOutput 으로 emit 안 하되, 라이브 조기노출은 `USER_MESSAGE` WS 신호(`ai-turn-orchestrator.service.ts:491-507`)로 구현되고 spec §7.5 가 "비권위 라이브 신호 + run-history observability 한정" 으로 재정의되어 갭 완화. **잔여**: single-turn(`executeSingleTurn`) 의 `llmService.chat`(`ai-turn-executor.ts:1209`·`:1439`)은 여전히 try/catch 미적용 → spec §7.3 `error` 포트 라우팅 미발생(single throw → engine FAILED). config echo 는 spec L449 가 정의한 echo 셋(memory 필드 등 non-default 시)에 대해 single-turn 이 `memoryStrategy`/`memoryTokenBudget`/`memoryKey`/`memoryTopK`/`memoryThreshold`/`memoryTtlDays`/`embedding·summary·extractionModelConfigId` 미echo(`ai-turn-executor.ts:1507-1525` 는 mode/model/systemPrompt/userPrompt/responseFormat/conditions + system-context만). `LLM_RESPONSE_INVALID`(json parse 실패)는 여전히 raw-string fallback(`ai-turn-executor.ts:1464-1469`)이며 spec §10 은 이를 "runtime" 으로 격상 → 갭. 참고: 옛 plan 의 "temperature/maxTokens/mcpServers/contextScope echo" 요구는 spec L449 echo 셋에서 빠져 superseded.

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 옛 `output.metadata.*` → `meta.*` 마이그레이션 완료, ConversationThread 자동 컨텍스트 주입(`contextScope`, `meta.contextInjection`) + deprecated `conversationHistory`/`historyCount` 제거(PR 머지)까지 반영된 상태. 2026-05-16 구현 분석에서 spec ↔ handler critical gap 다수 신규 검출 — 아래 잔여 권고에 반영.
> 잔여 권고 항목:
> - waiting/resumed 시점의 `output.messages` ↔ 종결 시점의 `output.result.messages` 의 경로 차이로 다운스트림 표현식 분기 비대칭. 시멘틱 의도(진행 상태 vs 도메인 결과) 가 강해 호환성 영향 평가 후 통일 검토.
> - **(2026-05-16 신규)** handler 가 `output.error` envelope + `port:'error'` 빌더를 보유하지 않음 — `llmService.chat` throw 시 spec §7.3 / §7.9 정의의 라우팅이 발생하지 않고 engine FAILED 로만 처리. text-classifier / information-extractor 와 횡단 일관성 결손.
> - **(2026-05-16 신규)** waiting 시점 `output.message` (단수) / `output.turnCount` / `output.maxTurns` 가 spec §7.4 JSON 예시 (`output.messages` 만) 를 초과해 emit — information-extractor 와 동일한 Principle 1.1 직교 위반 패턴.
> - **(2026-05-16 신규)** spec §7.5 의 `status:'resumed'` transient snapshot 이 handler·engine 어느 쪽에서도 emit 되지 않음 — documented but unimplemented.
> - **(2026-05-16 신규)** `config` echo 가 single-turn / waiting / 종결 세 경로에서 필드 집합 불일치 (single 5 / waiting 7 / 종결 9). spec §1 의 비민감 필드 전체 echo 로 통일 필요.

> 대상 spec: `spec/4-nodes/3-ai/1-ai-agent.md` (§7 출력 구조)

## 현재 output (spec 인용)

AI Agent 의 출력은 7 케이스로 분기된다 (spec §7.1~§7.9). 대표 케이스 발췌:

`spec/4-nodes/3-ai/1-ai-agent.md:296-356` — §7.1 Single Turn 정상 (`out` 포트):

```json
{
  "config": { "mode": "single_turn", "model": "{{ vars.model }}", "systemPrompt": "...", "userPrompt": "{{ $input.message }}", "responseFormat": "text" },
  "output": {
    "result": {
      "response": "AI 의 텍스트 응답 또는 JSON 객체",
      "endReason": "out",
      "turnCount": 1
    }
  },
  "meta": {
    "durationMs": 1234, "model": "gpt-4o",
    "inputTokens": 1250, "outputTokens": 350, "totalTokens": 1600,
    "thinkingTokens": 0, "toolCalls": 2,
    "ragSources": [...], "ragDiagnostics": {...}, "mcpDiagnostics": {...},
    "turnDebug": [{...}]
  },
  "port": "out", "status": "ended"
}
```

§7.4 Multi Turn waiting:

```json
{
  "config": { "mode": "multi_turn", "model": "...", "systemPrompt": "...", "maxTurns": 20, ... },
  "output": { "messages": [{role, content}, ...] },
  "meta": { ..., "interactionType": "ai_conversation", "turnDebug": [...] },
  "status": "waiting_for_input",
  "_resumeState": { /* internal — expression resolver 비노출 */ }
}
```

§7.5 Multi Turn resumed (transient):

```json
{
  "output": {
    "messages": [...],
    "interaction": { "type": "message_received", "data": { "content": ..., "role": "user" }, "receivedAt": ISO8601 }
  },
  "status": "resumed",
  "_resumeState": {...}
}
```

§7.6/§7.7/§7.8 multi-turn 종결: `output.result.{response, endReason, turnCount, messages, condition?}`.

§7.3/§7.9 에러: `output.error.{code, message, details?}` + `port: 'error'`.

## 진단

AI Agent 는 매우 복잡한 노드 — single/multi turn × 정상/조건매칭/사용자종료/최대턴/에러 = 7 케이스. 단계도 multi-turn 에서 waiting → resumed → 종결로 다단계.

전반적 평가: **현 spec 은 conventions 와 매우 잘 정합** — AI 카테고리의 LLM 공통 wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 가 통일되어 있고, `output.metadata.*` 같은 옛 패턴은 명시적으로 폐기됨 (spec §7 head footnote).

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.result.response` / `endReason` / `turnCount` (LLM 정상 결과) | 적절 (output) | Principle 8.2 — LLM 계열 도메인 결과는 `output.result.*` |
| `output.result.condition.{id, label, reason}` (조건 매칭) | 적절 (output) | 조건 도구 호출 결과 |
| `output.result.messages` (multi-turn) | 적절 (output) | 누적 대화 |
| `output.error.{code, message, details?}` | 적절 | Principle 3.2 표준 envelope |
| `output.messages` (waiting/resumed 시 — `output.result` 밖) | **약간 일관성 미흡** | 종결 시 `output.result.messages`, 진행 중 `output.messages` — 두 위치. spec 이 의도적 분리 (Principle 1.1 / 4.3: waiting 시점은 result 가 아닌 진행 상태) |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `meta.{durationMs, model, *Tokens, toolCalls, ragSources, ragDiagnostics, mcpDiagnostics, turnDebug}` | 적절 (meta) | Principle 2 — LLM 메트릭. 옛 `output.metadata.tokens` → `meta.tokens` 마이그레이션 완료 (spec §0 footnote) |
| `_resumeState` (top-level) | 적절 — internal | Principle 4.2 — credential / 누적 메모리 비대화 우려로 expression autocomplete 비노출 |
| `config` raw echo (모든 단계 frozen snapshot 통해 동일 raw 보장) | 적절 | Principle 7 — multi-turn frozen snapshot 으로 일관 보장 |

핵심 점검:

1. **`output.messages` (waiting/resumed) ↔ `output.result.messages` (종결) 의 일관성**:
   - waiting 시점: `output.messages` (LLM 호출 전·진행 중 대화 누적)
   - resumed 시점: `output.messages` + `output.interaction`
   - 종결 시점: `output.result.messages` (`output.result` wrapper 안)
   - spec 이 의도적: waiting/resumed 는 진행 상태 (run-results UI 의 References / LLM Usage 탭에 노출), 종결은 도메인 결과. 그러나 다운스트림 표현식 입장에서는 같은 `messages` 데이터를 다른 경로로 접근 — `$node["X"].output.messages` (waiting) vs `$node["X"].output.result.messages` (종결).
   - **개선 제안**: 종결 시 `output.messages` 도 함께 두어 경로 통일 (output.result.* 와 별개로). 또는 waiting 시 `output.result.messages` 로 통합. 현 spec 의 분리는 시멘틱 의도가 강하므로 변경 영향 평가 필요.

2. **multi-turn `error` + `result` 병존** (§7.9 footnote): 부분 수집 결과 보존을 위해 의도적. Principle 3 변형 (정상 envelope + error envelope 병존) — Information Extractor 와 동일 패턴. 합리적.

3. **`meta.turnDebug[*]` 의 RAG/MCP delta** — 각 turn 의 ragSources delta 와 노드 전체 누적 (`meta.ragSources`) 의 합 관계가 spec §8 마지막 줄에 명시. 일관성 OK.

4. **`_resumeState` top-level 노출** — 5필드 invariant 의 예외이지만 spec 명시: "internal 전달 필드, expression resolver 에서는 노출하지 않는다" (§7 footnote). DB 저장 시 strip 정책도 명시. 합리적.

## 개선안 — 정리된 output

대부분 conventions 부합. 미시 보강:

- waiting/resumed 시점의 `output.messages` 와 종결 시점의 `output.result.messages` 의 경로 통일 검토 (spec 변경 영향 평가 후).

```json
// Single Turn 정상
{
  "config": { "mode": "single_turn", ... },
  "output": { "result": { "response": ..., "endReason": "out", "turnCount": 1 } },
  "meta": { "durationMs": ..., "model": ..., "*Tokens": ..., "toolCalls": ..., "ragSources"?, "ragDiagnostics"?, "mcpDiagnostics"?, "turnDebug": [...] },
  "port": "out", "status": "ended"
}

// Multi Turn waiting
{
  "config": { "mode": "multi_turn", ... },
  "output": { "messages": [...] },              // ⚠ 검토: output.result.messages 로 통일?
  "meta": { ..., "interactionType": "ai_conversation", "turnDebug": [...] },
  "status": "waiting_for_input",
  "_resumeState": { ... }
}

// Multi Turn 종결 (조건매칭 / user_ended / max_turns)
{
  "config": {...},
  "output": { "result": { "response": ..., "endReason": ..., "turnCount": ..., "messages": [...], "condition"? } },
  "meta": { ... },
  "port": "<condition.id>" | "user_ended" | "max_turns",
  "status": "ended"
}

// 에러 (single/multi)
{
  "config": {...},
  "output": { "error": { "code": ..., "message": ..., "details"? }, "result"? /* multi-turn 부분 보존 */ },
  "meta": { ... },
  "port": "error", "status": "ended"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (대부분 정리되어 있음) | — | 옛 `output.metadata.*` 는 `meta.*` 로 마이그레이션 완료 |
| `output.messages` (waiting/resumed) ↔ `output.result.messages` (종결) | 경로 통일 검토 | 다운스트림 표현식의 일관성 — 단 시멘틱 분리 의도가 강해 변경 영향 평가 필요 |

## Rationale

- AI Agent 의 7 케이스는 LLM single/multi turn × 종결 사유 조합으로 본질적 — 단순화 불가.
- LLM 공통 wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 는 ai_agent / text_classifier / information_extractor 3 노드에서 통일되어 다운스트림 표현식 일관성 제공.
- `_resumeState` top-level 노출은 5필드 invariant 위반이지만 multi-turn internal state 의 보존 요구를 만족하는 유일한 방법 — expression autocomplete 비노출로 사용자 인터페이스에서는 invariant 유지.
- waiting/종결 시점의 `messages` 위치 차이는 시멘틱 의도지만, 다운스트림 분기 코드의 복잡성을 키움 — 통일 검토 가치 있음.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/ai/ai-agent/{ai-agent.handler.ts (facade), ai-turn-executor.ts (turn 실행 엔진 — single/multi 루프·출력 조립), ai-condition-evaluator.ts, ai-memory-manager.ts, ai-agent.schema.ts, ai-agent.handler.spec.ts, ai-turn-executor.spec.ts, ai-memory-manager.spec.ts, ai-condition-evaluator.spec.ts, ai-agent.thread.spec.ts, ai-agent.cleanup.spec.ts, ai-agent.component.ts, tool-providers/*}` + 엔진 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`. **(2026-06-25)** 아래 라인 인용은 god-handler 분할(#665/#668/#669) 후 `ai-turn-executor.ts` / `ai-turn-orchestrator.service.ts` 기준으로 재확정됨.

1. **spec §7 ↔ handler return 정합성**:
   - single-turn 정상 (`out`) — `ai-turn-executor.ts:1507-1581` (`executeSingleTurn` return) 의 객체 `{ config, output: { result: { response, endReason:'out', turnCount:1 } }, meta, port:'out', status:'ended' }` 가 spec §7.1 과 일치.
   - condition 매칭 — `ai-turn-executor.ts:2844-2931` `buildConditionOutput` 가 `output.result.{response, messages, turnCount, endReason:'condition', condition:{id,label,reason}}` 반환, `port: condition.id`. spec §7.2 / §7.6 와 일치.
   - multi-turn waiting — `ai-turn-executor.ts:1738-1794` (`executeMultiTurn` 첫 진입) / `:2456-2552` (`processMultiTurnMessage` 후속 waiting) 모두 `output: { result: { messages, message, turnCount } }` 를 emit. → **(2026-06-25) 해소**: D6(2026-05-17) 로 `messages`/`message`/`turnCount` 가 `output.result.*` 하위로 통일되고 top-level `output.maxTurns` 제거 (`:1758-1770` 의 D6 주석·`:2476-2489`). spec §7.4 표(L698-701)·§7.5 D6 노트(L759)도 정합 — 옛 Principle 1.1 직교 위반(`output.maxTurns`/단수 top-level `output.message`/`output.turnCount`) 항목 전부 close.
   - multi-turn 종결 — `ai-turn-executor.ts:2606-2745` `buildMultiTurnFinalOutput` 의 `output.result.{response, messages, turnCount, endReason}` 와 `:2825-2839` `multiTurnPortForEndReason` 매핑이 spec §7.6~§7.8 과 일치.

2. **에러 컨트랙트 (Principle 3)** — → **(2026-06-25) multi-turn 해소 / single-turn 잔여**:
   - **multi-turn 해소**: 엔진 `ai-turn-orchestrator.service.ts:520-596` `handleAiMessageTurn` 가 `processMultiTurnMessage` throw 를 catch → `:931-1003` `handleAiTurnError` → handler `endMultiTurnConversation(state,'error',errorPayload)` → `ai-turn-executor.ts:2606-2745` `buildMultiTurnFinalOutput` 가 `output.error.{code,message,details}` + 부분 `output.result.*` 병존 (`:2692-2694`)·`port:'error'`(`:2825-2839`)·retryable 시 top-level `_retryState`(`:2768-2823`) 까지 emit. 에러 분류는 `:1037-1082` `classifyLlmError`(429→`LLM_RATE_LIMIT` retryable / 5xx·network·timeout→`LLM_CALL_FAILED` retryable / 401·403→non-retryable / 미등록 code passthrough / 미분류 fallback→`LLM_CALL_FAILED` non-retryable) — spec §10 표(L1094-1108)·§7.9 와 정합. 회귀가드 단위테스트: `ai-turn-orchestrator.service.spec.ts:364-552`, `ai-agent.handler.spec.ts:3004-3207`.
   - **single-turn 잔여 (spec §7.3)**: `ai-turn-executor.ts` `executeSingleTurn` 의 `llmService.chat` 호출(`:1209` 첫 호출 / `:1439` tool-loop)은 **여전히 try/catch 미적용** — single-turn throw 는 그대로 boundary 로 전파되어 engine `FAILED` 로만 처리되고 `output.error` envelope·`port:'error'` 라우팅이 발생하지 않는다. spec §7.3 (`LLM_CALL_FAILED` single-turn error 포트) 미충족.
   - `LLM_RATE_LIMIT` 는 multi-turn 경로에서 구현됨(위). `LLM_RESPONSE_INVALID`(json parse 실패)는 single-turn `:1464-1469` 가 raw-string fallback 으로만 처리 — spec §10(L1099)은 이를 "runtime" 으로 명시하나 실제 발화 없음 → 잔여 갭.

3. **`status: 'resumed'` transient snapshot** — → **(2026-06-25) 갭 완화 (spec 재정의 + 라이브 신호 구현)**:
   - structured `status:'resumed'` 스냅샷(setStructuredOutput)은 AI 메시지 경로에서 **여전히 emit 안 함** — 엔진 `ai-turn-orchestrator.service.ts:599-` `handleAiMessageTurn` 은 `EXECUTION_WAITING_FOR_INPUT`(`:771`)와 종결 `AI_MESSAGE`(`:835`) 두 분기만 처리. (form: `form-interaction.service.ts:262` `status:'resumed'`, buttons: `button-interaction.service.ts:300` 만 structured resumed emit.)
   - 단, spec §7.5(L723-757)·§7.5 라이브노트(L727)가 **재정의**되어 `status:'resumed'` structured 스냅샷은 "run-history / timeline observability 한정", 사용자 발화 조기노출은 별도 `execution.user_message` **비권위 라이브 WS 신호**로 정의됨 — 엔진 `ai-turn-orchestrator.service.ts:491-507` `emitUserMessageLiveSignal`(`USER_MESSAGE` event, `:560-567` 게이팅)가 이를 구현. 즉 "사용자 발화 조기노출" 의도는 충족되고, 남은 것은 transient resumed의 structured 스냅샷을 AI 경로에도 emit 할지의 선택지(§8 항목 참조).

4. **config echo 정합성 (Principle 7)** — → **(2026-06-25) spec 재정의로 일부 superseded, 잔여 좁혀짐**:
   - spec §7 Config echo 정책(L449)이 **echo 셋을 명시**: `{mode, model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat, includeSystemContext?, systemContextSections?, memoryStrategy?, memoryTokenBudget?, memoryKey?, memoryTopK?, memoryThreshold?, memoryTtlDays?, embeddingModelConfigId?, summaryModelConfigId?, extractionModelConfigId?}` — optional/memory·system-context 필드는 default 일치 시 생략. 옛 plan 이 요구하던 `temperature`/`maxTokens`/`mcpServers`/`contextScope*` 는 이 echo 셋에서 빠짐 → **해당 요구는 superseded**.
   - single-turn — `ai-turn-executor.ts:1507-1525` echo = `mode/model/systemPrompt/userPrompt/responseFormat/conditions` + `pickNonDefaultSystemContext`(`shared/system-context-schema.ts:97` — `includeSystemContext`/`systemContextSections` 만). **잔여 gap**: spec echo 셋의 memory 필드(`memoryStrategy`·`memoryTokenBudget`·`memoryKey`·`memoryTopK`·`memoryThreshold`·`memoryTtlDays`·`embedding/summary/extractionModelConfigId`)가 single-turn config echo 에 미포함 (non-default 시에도).
   - multi-turn waiting — `:1738-1757` / `:2456-2475` echo 는 `mode/model/systemPrompt/maxTurns/maxToolCalls/knowledgeBases/conditions`. 종결 — `:2940-2964` `buildMultiTurnConfigEcho` 가 `mode/model/systemPrompt/userPrompt/maxTurns/maxToolCalls/responseFormat/knowledgeBases/conditions` + `pickNonDefaultSystemContext` echo. 세 경로 모두 memory 필드 echo 누락 — single-turn 과 동일 잔여 패턴.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0 (5필드): waiting/resumed 시 `_resumeState` 가 top-level 6번째 키로 위치 (`ai-turn-executor.ts:1782`·`:2502`). retryable error 종결 시 `_retryState` 도 top-level (`:2722`). spec §7 head footnote 가 "expression resolver 비노출 / internal" 로 정당화.
   - Principle 1.1 (config↔output 직교): → **(2026-06-25) 해소** — D6 로 `output.maxTurns` top-level echo 제거, waiting/resumed 의 `messages`/`message`/`turnCount` 가 `output.result.*` 로 이동 (`:1764-1770`·`:2478-2489`). `config.maxTurns` 만 진행률 분모로 노출 (spec L700).
   - Principle 2: `meta.interactionType: 'ai_conversation'` 는 인터랙션 라벨이지 metric 이 아님 — Principle 1.1.4 "노드 판별자가 아닌 인터랙션 타입 라벨" 로 spec(L701) 이 정당화. (`ai-turn-executor.ts:1772`·`:2726`·`:2903`)
   - Principle 3: §2 참조 — multi-turn 해소 / single-turn 잔여.
   - Principle 5: `port: string` 또는 condition.id. multi-turn 정상에는 `out` 포트가 없음 — spec §3.2 와 일치.
   - Principle 8.2: `output.result.*` wrapper 통일 — → **(2026-06-25) 해소** D6 으로 waiting/resumed/종결 전 경로가 `output.result.*` 단일 경로 (interaction 페이로드만 `output.interaction.*` 로 의미 분리, spec L759).

6. **handler 테스트 (`ai-agent.handler.spec.ts` + `ai-turn-executor.spec.ts` + `ai-turn-orchestrator.service.spec.ts`)**:
   - single-turn 정상 / KB tool / MCP tool / Conditions / waiting/resume / max_turns / user_ended / 도구 budget truncation / Promise.all 병렬·dedupe 커버 (분할 후 `ai-agent.handler.spec.ts` + `ai-turn-executor.spec.ts` 로 분산).
   - **multi-turn error 포트 테스트** → **(2026-06-25) 추가됨**: `ai-agent.handler.spec.ts:3004-3207` (`output.error`+`port:'error'`·부분 result 병존·errorPayload 부재 시 미부착·`_retryState` 운반) + `ai-turn-orchestrator.service.spec.ts:364-552` (`classifyLlmError` 429/5xx/401·403/network/미분류 전수).
   - **잔여**: single-turn LLM throw → `port:'error'` 검증 테스트 부재 (single-turn error 미구현 반영, §2 잔여). AI 메시지 경로의 structured `status:'resumed'` 스냅샷 테스트 부재 (라이브 `USER_MESSAGE` 신호는 별도 커버).

7. **횡단 일관성 (AI 3종)**:
   - LLM common wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 는 [common.md §5](../../../spec/4-nodes/3-ai/0-common.md#5-응답-형식-규약-principle-11) 의 정의 — → **(2026-06-25) D6 으로 waiting 시점도 `output.result.*` 로 통일**되어 3종 path 대칭성 회복.
   - error 포트 라우팅: multi-turn 은 엔진 `handleAiTurnError`(node-type 비의존 공통 경로)로 ai-agent·information_extractor 양쪽 통일 구현 → **(2026-06-25) multi-turn 횡단 일관성 회복**. single-turn 의 error 포트는 text-classifier / information-extractor(`try/catch + buildErrorOutput`) 대비 ai-agent single-turn 만 여전히 미구현 (§2 잔여).
   - multi-turn `_resumeState` / `_resumeCheckpoint` / `_retryState` 생명주기는 ai-agent / information_extractor 가 동일 패턴 (`buildRetryReentryState` 재구성 로직 공유, spec §7.4 비교표).

8. **구현 품질**:
   - tool-providers (`tool-providers/*`) 의 `Promise.all` 병렬 실행, chunkId dedup, sanitize 에러 패턴 모두 견고 (`ai-turn-executor.ts:794-931` `executeProviderToolBatch` 단일 진입점).
   - `MAX_RESUME_RAG_SOURCES = 200`(`ai-turn-executor.ts:165`) / `MAX_TURN_DEBUG_HISTORY = 50` cap 정책. spec §7.4 의 trade-off 명시와 일치.
   - `TOOL_RESULT_PREVIEW_CHARS = 200`(`ai-turn-executor.ts:85`) WS preview 정책 — KB 청크·MCP 응답의 passive WS 노출 방지. 보안적 의도 명확.
   - budget truncate: tool_use 초과분은 `'tool_call_budget_exceeded'` tool_result 로 회신만 하고 별도 `error` 코드(spec §10 `MAX_TOOL_CALLS_EXCEEDED` "예약") 는 발화하지 않는다 (`ai-turn-executor.ts:919-925`).
   - `_retryState` TTL: `DEFAULT_RETRY_STATE_TTL_MINUTES=60`, env `AI_RETRY_STATE_TTL_MINUTES` override (`ai-turn-executor.ts:173-187`). `failedUserMessage` 는 `truncateForErrorDetails`(500자) cap 후 영속 (`:2814-2817`).

## 종합 개선안 (2026-05-16)

- [ ] (impl) **CRITICAL (single-turn 잔여)** `executeSingleTurn` 의 `llmService.chat` 호출을 `try/catch` 로 감싸 `output.error.{code:'LLM_CALL_FAILED', message, details?}` + `port:'error'` + `status:'ended'` 환경 반환. text-classifier / info-extractor 의 `try/catch + buildErrorOutput` 패턴을 따른다. 근거: `ai-turn-executor.ts:1209` (첫 chat) · `:1439` (tool-loop chat) — 현 throw 미캡처, spec §7.3.
  - **(2026-05-21 부분 완료 / 2026-06-25 재확인)** multi-turn 경로는 engine `ai-turn-orchestrator.service.ts:520-596` `handleAiMessageTurn` catch → `:931-1003` `handleAiTurnError` → handler `endMultiTurnConversation(state,'error',errorPayload)` → `ai-turn-executor.ts:2606-2745` `buildMultiTurnFinalOutput` 의 `errorPayload` 인자로 spec §7.9 shape (`port='error'`, `status='ended'`, `output.error` + 부분 `output.result.*` 병존, `:2692-2694`) 으로 finalize — ✅ 유효 (PR #209→C-1 분할 후 #625/#627 로 이동). handler 빌더는 engine catch 가 주입한 `errorPayload` 에 의존 — handler 내부 자체 try/catch 패턴은 아님. **잔여는 single-turn (spec §7.3) 경로뿐.**
  - **(2026-07-17 frontend 파급 — 교차 참조)** 본 잔여 CRITICAL 은 frontend 대화 미리보기에 파급된다: single-turn `llmService.chat` throw 가 엔진 FAILED 로 직행해 `execution.node.failed` (`nodeType: 'ai_agent'`) 를 발사하는데, frontend `isMultiTurnAiContext` ([`use-execution-events.ts:143-146`](../../codebase/frontend/src/lib/websocket/use-execution-events.ts)) 는 turn mode 를 모른 채 `nodeType === 'ai_agent' && conversationMessages.length > 0` 로만 게이트하므로 single-turn 실패에도 `system_error` 가 APPEND 된다. 본 CRITICAL 이 해소되면 (`port:'error'` 라우팅) `node.failed` 표면이 multi-turn 으로 축소돼 그 파급도 자연 해소된다. 관련 plan: [`ai-node-failed-conversation-preview.md`](../../complete/ai-node-failed-conversation-preview.md) (완료 — PR #959) (실패 대화 미리보기 도달성 — Inv-8).
- [x] (impl) HTTP 429 (rate limit) provider 분류 시 `LLM_RATE_LIMIT` 코드 부여 — ✅ (2026-06-25) `ai-turn-orchestrator.service.ts:1037-1082` `classifyLlmError` 가 429→`LLM_RATE_LIMIT`(retryable) 분기, 단위테스트 `ai-turn-orchestrator.service.spec.ts:391`. spec §10 표(L1098) 정합. (PR #625/#630)
- [ ] (impl) `responseFormat: 'json'` 인데 `JSON.parse` 실패 시 — 현재 `ai-turn-executor.ts:1464-1469` 는 raw 문자열 fallback. spec §10(L1099)은 `LLM_RESPONSE_INVALID` 를 **"runtime"** 으로 격상 — 현 fallback 정책과 spec 표기가 불일치. (a) single-turn 에 `LLM_RESPONSE_INVALID` 발화 구현 또는 (b) spec §10 을 fallback 정책으로 재정합 결정 필요.
- [x] (spec) §7.4 표에 multi-turn waiting 시점 echo 필드 명시 — ✅ (2026-06-25) D6 으로 `output.result.{messages, message, turnCount}` 로 통일 + top-level `output.maxTurns` 제거, spec §7.4 표(L698-701)·§7.5 D6 노트(L759) 정합. handler `ai-turn-executor.ts:1764-1770`·`:2478-2489`. (옵션 (b) — Principle 1.1 직교 위반 제거 — 채택됨)
- [ ] (impl) `status: 'resumed'` transient snapshot — spec §7.5(L723-757) 재정의로 갭 완화: structured `resumed` 스냅샷은 "run-history observability 한정", 사용자 발화 조기노출은 `execution.user_message` 라이브 신호로 정의 → 후자는 engine `ai-turn-orchestrator.service.ts:491-507` `emitUserMessageLiveSignal` 로 구현됨. 잔여 선택지: AI 메시지 경로에도 form/buttons(`form-interaction.service.ts:262`·`button-interaction.service.ts:300`)처럼 structured `setStructuredOutput(resumed)` 1회 emit 을 추가할지 (conventions §4.4/§4.5 통일성) — 미결정.
- [ ] (impl) `config` echo 에 spec §7(L449) echo 셋의 **memory 필드** (`memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays`, `embeddingModelConfigId`, `summaryModelConfigId`, `extractionModelConfigId`) 를 non-default 시 추가. 현재 single-turn `ai-turn-executor.ts:1507-1525`, waiting `:1738-1757`/`:2456-2475`, 종결 `:2940-2964` 모두 memory 필드 미echo (system-context 필드는 `pickNonDefaultSystemContext` 로 echo 됨). 참고: 옛 항목의 `temperature`/`maxTokens`/`mcpServers`/`contextScope*` 는 spec L449 echo 셋에서 빠져 **superseded**.
- [x] (spec) §7.1 / §7.4 / §7.6~§7.8 의 JSON 예시 `config` 블록 통일 — ✅ (2026-06-25) spec L449 가 echo 셋을 단일 정책으로 명시(종결/waiting/resumed 공통 + optional 필드 default 시 생략 규약)해 비대칭 정리됨.
- [x] (impl) `error` 포트 단위 테스트 추가 — ✅ (2026-06-25) multi-turn: `ai-agent.handler.spec.ts:3004-3207` (`port==='error'` & `output.error.code` LLM_RATE_LIMIT/LLM_CALL_FAILED, 부분 result 병존, `_retryState` 운반) + `ai-turn-orchestrator.service.spec.ts:364-552` (classify 전수). **잔여**: single-turn throw → `port:'error'` 검증 테스트 (single-turn 미구현 반영, 위 첫 항목과 연동).
- [ ] (spec, impl) Principle 5 의 multi-turn `out` 포트 부재가 spec §3.2 에 명시되어 있으나 schema (`ai-agent.schema.ts:568`) 는 정적 `outputs: [{ id: 'out', label: 'Output', type: 'data' }]` 만 정의 — dynamic ports resolver(`:689-690` `dynamicPorts.kind:'ai-agent-conditional'`)가 multi-turn 에서 `out` 을 제거하고 `user_ended`/`max_turns`/`{condition.id}` 를 산출하는지 frontend resolver 검증 필요. spec §3.2 의 마이그레이션 노트와 일치 여부 미확인.
