# AI Agent output 개선안

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

대상 파일: `codebase/backend/src/nodes/ai/ai-agent/{ai-agent.handler.ts, ai-agent.schema.ts, ai-agent.handler.spec.ts, ai-agent.thread.spec.ts, ai-agent.cleanup.spec.ts, ai-agent.component.ts, tool-providers/*}`.

1. **spec §7 ↔ handler return 정합성**:
   - single-turn 정상 (`out`) — `ai-agent.handler.ts:1137-1190` 의 return 객체 `{ config, output: { result: { response, endReason:'out', turnCount:1 } }, meta, port:'out', status:'ended' }` 가 spec §7.1 과 일치.
   - condition 매칭 — `:1878-1933` `buildConditionOutput` 가 `output.result.{response, messages, turnCount, endReason:'condition', condition:{id,label,reason}}` 반환, `port: condition.id`. spec §7.2 / §7.6 와 일치.
   - multi-turn waiting — `:1283-1335` (`executeMultiTurn` 첫 진입) / `:1707-1751` (`processMultiTurnMessageInner` 후속 waiting) 모두 `output: { messages, message, turnCount, maxTurns }` 를 emit. **gap**: spec §7.4 JSON 예시는 `output.messages` 만 명시 — handler 는 추가로 `output.message` (단수)·`output.turnCount`·`output.maxTurns` 를 운반. ai-agent plan 의 기존 잔여 권고("output.messages ↔ output.result.messages 경로 통일") 외에, `output.maxTurns` / `output.message` / `output.turnCount` 의 Principle 1.1 직교 위반은 information-extractor 와 동일 패턴이지만 ai_agent spec 본문에는 명시되어 있지 않음.
   - multi-turn 종결 — `:1786-1847` `buildMultiTurnFinalOutput` 의 `output.result.{response, messages, turnCount, endReason}` 와 `:1820` `multiTurnPortForEndReason` 매핑이 spec §7.6~§7.8 과 일치.

2. **에러 컨트랙트 (Principle 3) — CRITICAL gap**:
   - handler 어디에도 `output.error.code: 'LLM_CALL_FAILED'` envelope 빌더가 없다 (`grep "LLM_CALL_FAILED\|buildErrorOutput" ai-agent.handler.ts` → 0 hits). `llmService.chat` 호출(`:900`, `:1089`, `:1429`, `:1629`) 은 모두 try/catch 없이 호출되어 throw 가 `execute()` 의 외부 boundary (`adaptHandlerReturn`) 로 전파됨. → 엔진은 `NodeExecutionStatus.FAILED` 로 마킹하나, **`port: 'error'` 라우팅과 `output.error` envelope 은 발생하지 않는다**.
   - spec §7.3 / §7.9 는 `LLM_CALL_FAILED` / `LLM_RATE_LIMITED` / `LLM_RESPONSE_INVALID` / `TOOL_EXECUTION_FAILED` 4종 코드를 명시하지만 handler 는 어느 것도 만들지 않는다. spec §10 표가 "예약/현재 발생 안 함" 라벨로 일부 완화되어 있으나 `LLM_CALL_FAILED` 만은 "runtime" 으로 명시되어 있어 spec ↔ impl 비일관.
   - 결과적으로 spec §7.3 / §7.9 의 `error` 포트 라우팅은 information-extractor 와 text-classifier 에서만 실동작하고, ai-agent 는 throw → engine fail 경로로 빠진다. 후속 노드가 `error` 포트로 분기할 수 없음.

3. **`status: 'resumed'` transient snapshot 미구현**:
   - spec §7.5 는 사용자 메시지 수신 직후 `status:'resumed'` + `output.interaction.{type:'message_received',data:{content,role:'user'},receivedAt}` 1회 emit 을 정의. handler `:1357-1752` `processMultiTurnMessageInner` 는 곧바로 LLM 호출 → 다음 waiting 또는 종결만 emit 하고, transient resumed snapshot 은 emit 하지 않는다.
   - engine `:2056-2227` `handleAiMessageTurn` 도 마찬가지 — `EXECUTION_WAITING_FOR_INPUT` 와 종결 두 분기만 처리하며 `status:'resumed'` 스냅샷을 만들지 않는다. (form: `execution-engine.service.ts:1709`, buttons: `:2612` 의 두 경로만 `status:'resumed'` 를 emit). → spec §7.5 는 documented but unimplemented.

4. **config echo 정합성 (Principle 7)**:
   - single-turn — `:1137-1152` 의 `config` echo 는 `rawConfig.mode/model/systemPrompt/userPrompt/responseFormat/conditions` 만 포함. **gap**: schema 정의(`ai-agent.schema.ts:85-385`) 의 `knowledgeBases` / `mcpServers` / `maxToolCalls` / `temperature` / `maxTokens` / `contextScope*` / `responseFormat` (있음) / `jsonSchema` / `includeToolTurns` / `excludeFromConversationThread` 가 echo 되지 않는다. spec §7.1 의 "표현식 `{{ }}` 보존" 의도와 일치하나 Principle 7 의 "UI 에서 설정한 비민감 값 항상 echo" 와 미세 불일치.
   - multi-turn waiting — `:1283-1302` / `:1707-1726` echo 는 `mode/model/systemPrompt/maxTurns/maxToolCalls/knowledgeBases/conditions` 만. `userPrompt` (multi-turn 무시 정책) 은 합리적이나 그 외 advanced 필드 echo 누락은 single-turn 과 동일 패턴.
   - condition / user_ended / max_turns 종결 — `:1942-1964` `buildMultiTurnConfigEcho` 가 `mode/model/systemPrompt/userPrompt/maxTurns/maxToolCalls/responseFormat/knowledgeBases/conditions` 까지 echo. waiting echo 와 종결 echo 의 필드 집합이 불일치 — `responseFormat` 은 종결만, advanced 필드는 양쪽 모두 누락.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0 (5필드): waiting/resumed 시 `_resumeState` 가 top-level 6번째 키로 위치. spec §7 head footnote 가 "expression resolver 비노출 / internal" 로 정당화.
   - Principle 1.1 (config↔output 직교): waiting 시 `output.maxTurns` 가 `config.maxTurns` 와 중복 (`:1311` `output.maxTurns = maxTurns` 직접 echo). information-extractor 와 동일 위반이며 ai_agent spec §7.4 본문에는 명시되어 있지 않다.
   - Principle 2: `meta.interactionType: 'ai_conversation'` 는 인터랙션 라벨이지 metric 이 아님 — Principle 1.1.4 "노드 판별자가 아닌 인터랙션 타입 라벨" 로 spec 이 정당화하지만, `meta` 의 "실행 메트릭" 정의와 미세 불일치. 옛 `output.metadata.tokens` 마이그레이션과 함께 정리 가능.
   - Principle 3: §2 의 critical gap 참조.
   - Principle 5: `port: string` 또는 condition.id. multi-turn 정상에는 `out` 포트가 없음 — spec §3.2 와 일치.
   - Principle 8.2: `output.result.*` wrapper 통일. 종결 시 정합. waiting/resumed 의 `output.messages` (top-level) ↔ 종결 `output.result.messages` 의 경로 비대칭 (현 plan 의 기존 권고).

6. **handler 테스트 (`ai-agent.handler.spec.ts`)**:
   - single-turn 정상 / KB tool / MCP tool / Conditions / waiting/resume / max_turns / user_ended / 도구 budget truncation / Promise.all 병렬·dedupe 까지 커버 (`:117-2697`, 약 100+ 케이스).
   - **결정적 누락**: LLM throw 케이스의 `error` 포트 라우팅 테스트 부재 (text-classifier `:331` / info-extractor `:287, :327` 와 대조). handler 가 error 빌더를 갖지 않으므로 테스트도 없음 — spec §7.3 / §7.9 의 실제 라우팅을 검증하는 케이스가 없다.
   - `status: 'resumed'` transient snapshot 테스트 부재 (spec §7.5 미구현 반영).

7. **횡단 일관성 (AI 3종)**:
   - LLM common wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 는 [common.md §5](../../../spec/4-nodes/3-ai/0-common.md#5-응답-형식-규약-principle-11) 의 정의이며 종결 시점만 부합. waiting 시점의 path 비대칭이 3종 공통 미흡.
   - text-classifier / information-extractor 는 `try/catch + buildErrorOutput` 패턴으로 `error` 포트 라우팅이 구현되어 있으나 ai-agent 는 미구현. **3 노드 횡단 일관성 결손**.
   - multi-turn `_resumeState` 패턴은 ai-agent / information-extractor 가 동일. token 누적 / turnDebug 누적 / rawConfig snapshot 까지 같은 구조.

8. **구현 품질**:
   - tool-providers (`kb-tool-provider.ts:312` / `mcp-tool-provider.ts:938` / `cafe24-mcp-tool-provider.ts:591`) 의 `Promise.all` 병렬 실행, chunkId dedup, sanitize 에러 패턴 모두 견고.
   - `MAX_RESUME_RAG_SOURCES = 200` / `MAX_TURN_DEBUG_HISTORY = 50` 의 cap 정책 명시 (`:157, :1670`). spec §7.4 의 trade-off 명시와 일치.
   - `TOOL_RESULT_PREVIEW_CHARS = 200` 의 WS preview 정책 (`:66`) — KB 청크·MCP 응답의 passive WS 노출 방지. 보안적 의도 명확.
   - dead code: `MAX_COLLECTION_RETRIES_EXCEEDED` 는 ai_agent 에는 없으나 spec §10 의 `MAX_TOOL_CALLS_EXCEEDED` 도 "예약" 상태 — handler 는 budget truncate 만 하고 `error` 코드는 발화하지 않는다 (`:1041, :1574`).

## 종합 개선안 (2026-05-16)

- [ ] (impl) **CRITICAL** `executeSingleTurn` / `executeMultiTurn` / `processMultiTurnMessageInner` 의 `llmService.chat` 호출을 `try/catch` 로 감싸 `output.error.{code:'LLM_CALL_FAILED', message, details?}` + `port:'error'` + `status:'ended'` 환경 반환. text-classifier `text-classifier.handler.ts:163-209` / info-extractor `information-extractor.handler.ts:241-313, :410-422, :490-511` 의 패턴을 따른다. 근거: `ai-agent.handler.ts:900, :1089, :1429, :1629` (현 throw 누락), spec §7.3 / §7.9.
- [ ] (impl) HTTP 429 (rate limit) provider 분류 시 `LLM_RATE_LIMITED` 코드 부여 — provider error 의 `status === 429` 분기. spec §10 의 코드 표와 정합.
- [ ] (impl) `responseFormat: 'json'` 인데 `JSON.parse` 실패 시 — 현재 `:1107-1112` 는 raw 문자열 fallback. spec §10 의 `LLM_RESPONSE_INVALID` 는 "예약" 으로 명시되어 있어 현 fallback 정책 유지 가능 — 단 spec 의 "예약" 표기와 핸들러의 fallback 정책을 spec §6 절에 명시화.
- [ ] (spec) §7 head footnote 또는 §7.4 표에 multi-turn waiting 시점의 추가 echo 필드 (`output.message`, `output.turnCount`, `output.maxTurns`) 명시. 현 spec 은 `output.messages` 만 예시 — handler 는 4 필드 emit. 권고 옵션: (a) spec JSON 예시를 4 필드로 갱신, (b) Principle 1.1 직교 위반인 `output.maxTurns` / `output.message` (단수) 제거 후 handler 도 정리 (information-extractor 와 동일 결정).
- [ ] (impl) `status: 'resumed'` transient snapshot 구현 또는 spec §7.5 폐기 결정. 현재 spec §7.5 / §3 색인 / 공통 §9 색인 3 곳이 resumed 케이스를 명시하지만 handler·engine 둘 다 emit 하지 않는다. 옵션: (a) engine `handleAiMessageTurn` (`execution-engine.service.ts:2056-2175`) 에 form/buttons 와 동일한 `setStructuredOutput(resumed)` 1회 emit 추가, (b) spec 에서 §7.5 제거 + 색인 갱신. (a) 가 conventions §4.4 / §4.5 의 통일성 강화.
- [ ] (impl) `executeSingleTurn` / `executeMultiTurn` waiting / `buildMultiTurnFinalOutput` / `buildConditionOutput` 의 `config` echo 객체에 spec §1 의 모든 비민감 필드 (`temperature`, `maxTokens`, `knowledgeBases`, `mcpServers`, `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`, `responseFormat`, `jsonSchema`) 를 추가. 근거: Principle 7 "UI 에서 설정한 비민감 값 항상 echo". 현재 single-turn `:1137-1152`, waiting `:1283-1302` / `:1707-1726`, 종결 `:1942-1964` 의 echo 필드 집합이 불일치.
- [ ] (spec) §7.1 / §7.4 / §7.6~§7.8 의 JSON 예시 `config` 블록을 위 결정에 맞춰 통일. 현재 §7.1 예시는 5 필드 / §7.4 는 7 필드 등 비대칭.
- [ ] (impl) `error` 포트 단위 테스트 추가 (`ai-agent.handler.spec.ts`): LLM provider throw 시 `port==='error'` & `output.error.code==='LLM_CALL_FAILED'` 검증 — single/multi 양쪽. 근거: text-classifier `text-classifier.handler.spec.ts:331-396` 의 동등 케이스.
- [ ] (spec, impl) Principle 5 의 multi-turn `out` 포트 부재가 spec §3.2 에 명시되어 있으나 schema (`ai-agent.schema.ts:459`) 는 정적 `outputs: [{ id: 'out', ... }]` 만 정의 — dynamic ports resolver 가 multi-turn 에 `out` 을 제거하는지 확인 필요. dynamic ports `kind: 'ai-agent-conditional'` 의 resolver (frontend) 가 mode 별로 다른 port set 을 산출하는 점이 spec §3.2 의 마이그레이션 노트와 일치하는지 검증.
