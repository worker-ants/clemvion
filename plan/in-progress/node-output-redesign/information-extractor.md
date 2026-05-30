# Information Extractor output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 옛 `output.output.extracted.*` 이중 중첩 폐기 + `output.result.extracted` 통일 + multi-turn `LLM_CALL_FAILED + result` 병존 패턴까지 반영. 2026-05-16 구현 분석에서 신규 gap 검출 (resumed 미구현 / waiting echo 빈약 / multi-turn ConversationThread push 미구현).
> 잔여 권고 항목:
> - waiting 시점 `output.maxTurns` 제거 — `config.maxTurns` 와 동일 값(Principle 1.1 직교 위반).
> - waiting 시점 `output.message` (단수) 제거 — `output.messages[-1].content` 와 의미 중복 (`output.messages` 가 SSOT).
> - waiting `output.messages` ↔ 종결 `output.result.messages` 경로 통일 — ai_agent 와 동일 이슈.
> - **(2026-05-16 신규)** spec §5.5 의 `status:'resumed'` transient snapshot 이 handler·engine 어느 쪽에서도 emit 되지 않음 — ai-agent §7.5 와 동일 미구현.
> - **(2026-05-16 신규)** waiting `config` echo 는 3 필드 (`schema/mode/maxCollectionRetries`), 종결 9 필드 — waiting/종결 echo 필드 집합 불일치.
> - **(2026-05-16 신규)** ConversationThread v2 multi-turn push hook 미구현 — `pushExtractorTurn` 은 single-turn `out` 분기만 호출, 4 종결 분기는 handler 주석에 "v2 follow-up" 으로 명시 보류.
> - **(2026-05-16 신규)** `turnDebugHistory` 누적 cap 부재 — ai-agent 의 `MAX_TURN_DEBUG_HISTORY = 50` 와 비대칭, 장기 대화 시 outputData JSONB 비대 가능.

> 대상 spec: `spec/4-nodes/3-ai/3-information-extractor.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/3-ai/3-information-extractor.md:160-204` — §5.1 Single Turn 정상 (`out`):

```json
{
  "config": { "mode": "single_turn", "model": "...", "schema": [...], ... },
  "output": {
    "result": {
      "extracted": { "senderName": "김철수", "orderNumber": "ORD-12345", ... },
      "endReason": "out",
      "turnCount": 1,
      "originalInput": "환불 요청합니다…"
    }
  },
  "meta": { "durationMs": 810, "model": "...", "*Tokens": ..., "turnDebug": [{...}] },
  "port": "out", "status": "ended"
}
```

§5.4 Multi Turn waiting:

```json
{
  "config": {...},
  "output": {
    "messages": [{role, content}, ...],
    "message": "<latest assistant>",
    "turnCount": 1,
    "maxTurns": 10,
    "partial": { "extracted": {...}, "missingFields": [...], "collectionRetryCount": 0 }
  },
  "meta": { "interactionType": "ai_conversation" },
  "status": "waiting_for_input"
}
```

§5.5 Multi Turn resumed (transient):

```json
{
  "output": {
    "messages": [...],
    "partial": {...},
    "interaction": { "type": "message_received", "data": { "content": ..., "role": "user" }, "receivedAt": ISO8601 }
  },
  "status": "resumed"
}
```

§5.6.1~§5.6.4 종결 (4 종): `completed` / `user_ended` / `max_turns` / `max_retries`. 종결은 `output.result.{extracted, endReason, turnCount, messages}`. `max_retries` 는 `output.error` + `output.result` 병존.

## 진단

Information Extractor 는 ai_agent 와 매우 유사한 구조 (single/multi turn × 종결 사유). 단계는 single 1개, multi 는 waiting → resumed → 종결.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `output.result.extracted` | 적절 | Principle 8.2 — `output.result.extracted` 통일. 옛 `output.output.extracted.*` 이중 중첩 폐기 (spec §5 head footnote) |
| `output.result.{endReason, turnCount, originalInput, messages}` | 적절 | LLM 도메인 결과 |
| `output.error.{code, message, details?}` | 적절 | Principle 3.2 |
| `output.error + output.result 병존` (§5.3 multi-turn LLM_CALL_FAILED, §5.6.4 max_retries) | 적절 | 부분 수집 결과 보존 — ai_agent 와 동일 패턴 |
| `output.messages` (waiting/resumed) | **약간 일관성 미흡** | 종결 시 `output.result.messages`, 진행 중 `output.messages`. ai_agent 와 동일 미흡 |
| `output.partial.{extracted, missingFields, collectionRetryCount}` (waiting) | 적절 (output) | 진행 중 추출 스냅샷 — 다운스트림 UI 진행률 표시. `output.result.extracted` 와 위치 다름 (의도) |
| `output.maxTurns` (waiting snapshot) | **약간 부적절** | `config.maxTurns` 와 의미 중복. spec footnote: "대기 UI 진행률 표시용으로 함께 노출되는 turn budget 스냅샷" — 사용자 편의 echo 명분이지만 Principle 1.1 직교 위반 가능성 |
| `output.message` (waiting, latest assistant followup) | 적절 (output) | WS 페이로드 구성 편의용 — `output.messages[-1].content` 와 의미 중복이지만 1개 message 만 빠르게 접근 |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.5 |
| `meta.{durationMs, model, *Tokens, collectionRetryCount, turnDebug}` | 적절 (meta) | Principle 2 |
| `config.*` (raw echo, frozen snapshot) | 적절 | Principle 7 |
| `_resumeState` (internal) | 적절 — Principle 4.2 | DB strip + autocomplete 비노출 |

핵심 점검:

1. **`output.maxTurns` 중복** — `config.maxTurns` 와 같은 값. spec footnote: "raw 는 `config.maxTurns`" 라고 명시하지만 동시에 `output.maxTurns` 로도 노출. 다운스트림은 `config.maxTurns` 만 사용하면 충분. 제거 또는 `output.partial.maxTurns` 같은 wrapper 안으로 이동 검토.

2. **`output.message` (단수) ↔ `output.messages[-1].content`** — 같은 값을 두 곳에 두는 것은 다운스트림 표현식 안정성에는 좋으나 일관성 위반. 한쪽 유지 권장 — `output.messages` 가 SSOT.

3. **`output.partial` 위치** — waiting 시점에 진행 중 추출 결과 별도 wrapper. 종결 시 `output.result.extracted` 와 통합. 의도된 분리 (진행 vs 종결) 이지만 위치 통일 검토 가치.

4. **multi-turn `LLM_CALL_FAILED` + `result` 병존** (§5.3 footnote): 부분 수집 결과 보존. 합리적.

## 개선안 — 정리된 output

```json
// Single Turn 정상
{
  "config": {...},
  "output": { "result": { "extracted": {...}, "endReason": "out", "turnCount": 1, "originalInput": ... } },
  "meta": { ... },
  "port": "out", "status": "ended"
}

// Multi Turn waiting (정리안)
{
  "config": {...},
  "output": {
    "messages": [...],                           // SSOT
    // ⚠ "message": <latest> — 제거 검토 ($node["X"].output.messages[-1].content 사용)
    "turnCount": <number>,
    // ⚠ "maxTurns": <number> — 제거 검토 ($node["X"].config.maxTurns 사용)
    "partial": { "extracted": {...}, "missingFields": [...], "collectionRetryCount": ... }
  },
  "meta": { "interactionType": "ai_conversation" },
  "status": "waiting_for_input",
  "_resumeState": {...}
}

// Multi Turn resumed (transient)
{
  "config": {...},
  "output": {
    "messages": [...],
    "partial": {...},
    "interaction": { "type": "message_received", "data": {...}, "receivedAt": ISO8601 }
  },
  "meta": { "durationMs": 0, "interactionType": "ai_conversation" },
  "status": "resumed"
}

// Multi Turn 종결 (completed / user_ended / max_turns / max_retries)
{
  "config": {...},
  "output": {
    "result": { "extracted": {...}, "endReason": ..., "turnCount": ..., "messages": [...] },
    "error"?: { "code": "MAX_COLLECTION_RETRIES_EXCEEDED", ... }    // max_retries 만
  },
  "meta": { ... },
  "port": "completed" | "user_ended" | "max_turns" | "error",
  "status": "ended"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `output.maxTurns` (waiting) | 제거 — `$node["X"].config.maxTurns` 사용 | Principle 1.1 직교 |
| `output.message` (waiting, 단수) | 제거 — `$node["X"].output.messages[-1].content` 사용 | 중복. 제거 시 다운스트림 영향 평가 |
| `output.messages` (waiting) ↔ `output.result.messages` (종결) | 위치 통일 검토 (ai_agent 와 동일 이슈) | 일관성 |

## Rationale

- ai_agent 와 동일한 LLM wrapper 패턴 — 의도된 통일.
- `output.maxTurns` 같은 "사용자 편의 echo" 는 conventions Principle 1.1 의 핵심 위반 — 후속 노드는 `config.maxTurns` 가 raw 값으로 echo 되어 있으므로 그쪽을 사용해야 한다.
- `output.partial` 분리는 진행 중 단계에서 부분 추출 가시화 의도 — 종결 시 `output.result.extracted` 로 통합되는 패턴이 명확하므로 유지.
- `_resumeState` top-level 노출은 internal 컨트랙트 — autocomplete 비노출 + DB strip 으로 방어. 합리적.
- (2026-05-18) ConversationThread v2 연동 (conversation-thread §2.3 / §7 v2 로드맵) 도입 시 final-assistant push 인터페이스 (`information_extractor` final → `JSON.stringify(extracted)` text 변환, §1.4 v2 표기 행) 와 충돌하지 않도록 output 재설계 — `output.result.extracted` 단일 SoT 유지가 v2 push hook 의 안전한 진입점.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/ai/information-extractor/{information-extractor.handler.ts, information-extractor.schema.ts, information-extractor.handler.spec.ts, information-extractor.schema.spec.ts, information-extractor.thread.spec.ts, information-extractor.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - single-turn 정상 (`out`) — `information-extractor.handler.ts:270-291` 의 return `{ config: configEcho, output: { result: { extracted, endReason:'out', turnCount:1, originalInput } }, meta: {...}, port:'out', status:'ended' }` 가 spec §5.1 과 일치.
   - single-turn 에러 — `:301-312` `LLM_RESPONSE_INVALID` (총 3 attempt 후 모두 실패) + `:244-255` `LLM_CALL_FAILED` (provider throw 즉시) 양쪽 모두 `buildErrorOutput` (`:918-958`) 으로 `{ output:{error:{code,message,details}}, port:'error', status:'ended' }` 반환. spec §5.3 정합.
   - multi-turn waiting — `:964-1010` `buildWaitingResponse` 가 `output: { messages, message:<followUp>, turnCount, maxTurns, partial:{extracted, missingFields, collectionRetryCount} }` + `meta:{interactionType:'ai_conversation'}` + `status:'waiting_for_input'` + `_resumeState` 운반. spec §5.4 와 일치하나 **`output.maxTurns` (`:999`) / `output.message` (`:997`) 가 Principle 1.1 직교 위반** — 기존 plan 잔여 권고 그대로 검증됨.
   - multi-turn 종결 — `:757-857` `buildMultiTurnFinalOutput` 의 4 분기 (`completed`/`user_ended`/`max_turns` + `max_retries`/`error` 의 `output.error + output.result` 병존) 가 spec §5.6.1~§5.6.4 와 일치. `:1378-1389` `portForEndReason` 의 endReason→port 매핑이 spec §3.2 와 정합.

2. **`status: 'resumed'` transient snapshot 미구현 — ai-agent 와 동일**:
   - spec §5.5 는 `processMultiTurnMessage` 직후 `waiting_for_input` 으로 수렴 직전에 `status:'resumed'` + `output.interaction.{type:'message_received',data,receivedAt}` 1회 emit 을 정의. handler `:456-547` `processMultiTurnMessage` 는 곧바로 `runTurnWithCollectionRetries` → `buildWaitingResponse` 또는 `buildMultiTurnFinalOutput` 두 분기로 수렴하며 transient resumed snapshot 을 만들지 않는다.
   - engine `execution-engine.service.ts:2056-2227` `handleAiMessageTurn` 도 마찬가지 — `EXECUTION_WAITING_FOR_INPUT` 와 종결 두 분기만 처리. → spec §5.5 는 documented but unimplemented (ai-agent §7.5 와 동일 미흡).

3. **schema ↔ spec config 정합성**:
   - `informationExtractorNodeConfigSchema` (`information-extractor.schema.ts:33-119`) 의 모든 필드 (`llmConfigId`, `model`, `inputField`, `outputSchema`, `examples`, `instructions`, `mode`, `maxTurns`, `maxCollectionRetries`) 가 spec §1 표와 동일. default 일치 (`maxTurns:10`, `maxCollectionRetries:3`, `mode:'single_turn'`).
   - `fieldDefSchema` (`:8-24`) 의 `name`/`type`/`description`/`required(default:true)`/`enumValues` 가 spec §1 의 FieldDef 와 정합.
   - **gap**: spec §1 의 inputField "`multi_turn` 일 때는 비어있으면 첫 LLM 호출을 생략" 정책은 handler `:368-384` 가 구현 — `inputField` 누락 시 빈 messages + immediate waiting. spec ↔ impl 정합.

4. **validate 일관성**:
   - `:159-165` `handler.validate()` = `evaluateMetadataBlockingErrors` SSOT.
   - warningRules (`schema.ts:274-290`) 의 `no-llm-provider` / `no-output-schema` / `single-turn-needs-input-field` + `validateInformationExtractorConfig` (`:218-247`) 의 per-field name/type + multi-turn maxTurns ≥ 0 가 spec §6 표와 일치.

5. **에러 컨트랙트 (Principle 3)**:
   - 4 코드 모두 발화 가능 — `LLM_CALL_FAILED` (single `:244-255`, multi `:411-422`, multi mid-conv `:490-511`) / `LLM_RESPONSE_INVALID` (single `:301-312`, 3 attempt 후) / `MAX_COLLECTION_RETRIES_EXCEEDED` (`:790-794` multi `max_retries` 종결 envelope).
   - multi-turn `max_retries` 의 `output.error + output.result` 병존 (`:787-813`) 은 spec §5.6.4 / `[공통 §5](../../../spec/4-nodes/3-ai/0-common.md#5-응답-형식-규약-principle-11)` 의 부분 보존 패턴 정합. 부합.
   - multi-turn `LLM_CALL_FAILED` (`:490-511`) 도 `output.error + output.result` 병존 — spec §5.3 footnote ("multi-turn LLM_CALL_FAILED: result 와 병존") 정합.
   - **LLM_RATE_LIMIT**: spec §6 표에 "예약" 명시 — handler 는 429 도 catch-all `LLM_CALL_FAILED` 로 분류. ai-agent / text-classifier 와 동일 정책. 정합 (예약 상태).

6. **conventions Principle 0–11 위반 패턴**:
   - Principle 0 (5필드): waiting 시 `_resumeState` top-level 6번째 키. spec §5.4 footnote 가 정당화.
   - **Principle 1.1 (config↔output 직교)**: waiting 시 `output.maxTurns` (`:999`) 가 `config.maxTurns` 와 직접 중복. `output.message` (`:997`) 가 `output.messages[-1].content` 와 의미 중복. 기존 plan 잔여 권고 그대로.
   - Principle 2: `meta.{durationMs, model, *Tokens, collectionRetryCount, turnDebug}` 부합. waiting `meta` 는 `interactionType` 만 (`:1006`) — 진행 중 메트릭은 `_resumeState` 에 누적되고 `meta` 에 비노출. 종결 시점에서만 `meta.*Tokens` 등 누적.
   - Principle 3: 표준 envelope 부합.
   - Principle 5: `port: 'out' | 'completed' | 'user_ended' | 'max_turns' | 'error'`. 정합.
   - Principle 7: `:218-227` configEcho (single) / `:875-902` multiTurnConfigEcho (종결) 가 rawConfig 우선 + state fallback. spec §5.1 / §5.6 의 raw echo 정책 (`{{ }}` 보존) 부합. **gap**: waiting `:986-991` 의 config echo 는 `schema/mode/maxCollectionRetries` 3 필드만 — 종결 echo 9 필드와 비대칭. `model`/`inputField`/`maxTurns`/`instructions`/`examples` 등이 waiting echo 에서 누락. ai-agent 와 동일 패턴 (waiting echo 빈약).
   - Principle 8: `output.result.extracted` 통일 wrapper, 옛 `output.output.extracted.*` 폐기 명시 — 부합.
   - Principle 10: `mergePartial` (`:1289-1302`) 가 null/undefined 를 "no new information" 으로 처리해 기존값 보존 — 빈/null 입력 fallback 정책 정합.

7. **handler 테스트 (`information-extractor.handler.spec.ts`)**:
   - validate / single-turn extract·retry·LLM_CALL_FAILED·LLM_RESPONSE_INVALID / multi-turn first-turn complete / waiting / inputField 누락 / optional null 처리 / processMultiTurnMessage complete·waiting·max_turns / collection retry loop·max_retries / `buildMultiTurnFinalOutput` rawConfig echo·fallback 까지 942 줄로 폭넓게 커버.
   - 에러 envelope 의 `output.error.details` 필드 검증 (`:287-352`) 까지 명시.
   - **누락**: spec §5.5 (`status: 'resumed'`) snapshot 검증 케이스 부재 — ai-agent 와 동일하게 미구현 반영.
   - ConversationThread push 는 `information-extractor.thread.spec.ts` (108 줄) 가 spec §1.4 v2 의 single-turn `appendAiAssistantMessage(JSON.stringify(extracted))` 검증. **multi-turn 종결 4분기 (`completed`/`max_retries`/`max_turns`/`user_ended`) 의 push hook 은 handler 주석 `:130-134` 가 "v2 follow-up" 으로 명시 미구현** — `pushExtractorTurn` 은 single-turn `out` 분기만 호출 (`:268`).

8. **횡단 일관성 (AI 3종)**:
   - LLM common wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 부합.
   - waiting `output.messages` (top-level) ↔ 종결 `output.result.messages` (wrapper inside) 비대칭 — ai-agent §7.4 ↔ §7.6 와 동일 패턴.
   - `output.maxTurns` / `output.message` 직교 위반 — ai-agent 도 동일 (`ai-agent.handler.ts:1307-1312` / `:1727-1731`). **두 노드 모두 동일 케이스를 갖고 있으므로 spec 결정 시 동시 처리 권고**.
   - error 코드 다양성 — info-extractor (4 코드 발화) > text-classifier (1 코드 발화, 3 reserved) > ai-agent (0 코드 발화, handler 미구현). LLM 3 노드 횡단 일관성 결손은 ai-agent 의 미구현이 핵심.
   - ConversationThread v2 push — text-classifier (single/multi 모두) > info-extractor (single 만) > ai-agent (multi-turn 도 모두 push). v2 로드맵 정합성 확인 필요.

9. **구현 품질**:
   - `defined()` helper (`:44-50`) 가 undefined 키 strip — JSON snapshot 안정성.
   - `buildExtractedSnapshot` (`:863-873`) 가 누락 required 필드를 `null` 로 채워 다운스트림 참조 안정성 확보. spec §5.6 공통 정의와 일치.
   - `runTurnWithCollectionRetries` (`:568-719`) 의 무한 루프 + budget 체크 + `mergePartial` + `computeMissingFields` 분리. 견고.
   - dead code: `MultiTurnState.toolCalls` / `ragSources` / `lastTurnRequest` 등 (`:108-112`) 은 "engine 의 generic state 통과용" 으로 주석 명시 — handler 는 사용 안 함. legacy 호환성.
   - `MAX_TURN_DEBUG_HISTORY` cap 은 info-extractor 에는 없음 (`turnDebugHistory` 누적 무제한) — ai-agent `:1670` 의 50 turn cap 과 비대칭. 장기 대화 시 outputData JSONB 비대 가능성.

## 종합 개선안 (2026-05-16)

- [ ] (spec, impl) waiting 시점 `output.maxTurns` (handler `:999`) 제거 — Principle 1.1 직교 위반. 다운스트림은 `$node["X"].config.maxTurns` 사용. spec §5.4 표·JSON 예시 갱신 + `buildWaitingResponse` 의 `output` 객체에서 `maxTurns` 키 제거. 기존 잔여 권고와 동일.
- [ ] (spec, impl) waiting 시점 `output.message` (단수, handler `:997`) 제거 — `output.messages[-1].content` 가 SSOT. WebSocket 페이로드 편의용 시멘틱이라면 `meta.lastAssistantMessage` 로 이동 검토. ai-agent 와 동시 결정 필요 (동일 패턴).
- [ ] (impl) `status: 'resumed'` transient snapshot 구현 또는 spec §5.5 폐기 — engine `handleAiMessageTurn` (`execution-engine.service.ts:2056-2175`) 에 form/buttons 와 동일한 `setStructuredOutput(resumed)` 1회 emit 추가. ai-agent 와 동시 처리 권고 (§9 색인의 다른 두 노드도 동일).
- [ ] (impl) waiting 시점 `config` echo 보강 — `:986-991` 의 3 필드 (`schema/mode/maxCollectionRetries`) 를 종결 echo `:875-902` 의 9 필드 (`mode/model/schema/instructions/examples/inputField/maxTurns/maxCollectionRetries`) 와 통일. waiting/종결 양쪽 raw echo 일관성. ai-agent 와 동일 패턴.
- [ ] (impl) multi-turn 종결 4분기 (`completed`/`max_retries`/`max_turns`/`user_ended`) 의 ConversationThread push 구현 — `pushExtractorTurn` (`:141-157`) 을 `buildMultiTurnFinalOutput` (`:757`) 에서 호출. 현재 single-turn `out` 분기 (`:268`) 만 push. handler 주석 `:130-134` 의 "v2 follow-up" 미해결. state-carried thread reference 패턴은 ai-agent multi-turn `threadHolderFromState` (`ai-agent.handler.ts:399-404`) 와 동일하게 구현.
- [ ] (impl) `turnDebugHistory` cap 추가 — ai-agent `MAX_TURN_DEBUG_HISTORY = 50` (`:1670`) 과 동일 정책 적용해 장기 대화의 outputData JSONB 비대 방지. info-extractor `:524-528` 의 `[...state.turnDebugHistory, ...]` 가 무제한 누적.
- [ ] (spec) §5.5 의 resumed snapshot 이 위 impl 결정에 따라 spec 본문에서 제거되면 `_product-overview.md` / `0-common.md` §9 출력 구조 색인의 info_extractor multi 행 "Waiting / Resumed" 도 갱신.
- [ ] (impl) `output.message` (단수) 위치 결정에 따라 단위 테스트 `:408-468` (`enters waiting_for_input when required fields are missing`) 의 assert 갱신.
