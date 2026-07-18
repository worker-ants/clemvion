# Information Extractor output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: net 변화 — (1) **D6 단일화 (#PR 78594c71, 2026-05-17) 로 `output.maxTurns` (waiting) 제거 + `output.message`/`output.messages` 를 top-level → `output.result.{message,messages,turnCount}` 로 통일** → 종합 개선안 ①②⑧ 해소 (handler `buildWaitingResponse` `:1461-1492`, 주석 `:1473-1475` 가 Principle 1.1 분모는 `config.maxTurns` 임을 명시). (2) **multi-turn 4 종결 분기 ConversationThread push 구현 (#484, 2026-06-05)** → ⑤ 해소 (`buildMultiTurnFinalOutput` `:1190-1213` 가 `pushExtractorTurnTo` 호출, 테스트 신규 파일 `information-extractor.memory.spec.ts:254-396`). (3) **여전히 잔여**: `status:'resumed'` transient snapshot 미emit (③, 엔진 경로 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 로 이동했으나 AI 대화 turn 은 `message_received` interaction 을 emit 안 함), waiting `config` echo 3 필드 vs 종결 8 필드 비대칭 (④ — 단 spec §5.4 가 D6 로 lean echo 를 의도된 결정으로 재문서화함), `turnDebugHistory` cap 부재 (⑥, `:919-922`; ai-agent cap 은 `ai-agent/ai-turn-executor.ts:2412` 로 이동·존속). (4) stale ref 정정: 핸들러가 memory v2(#484)/contextScope(#480)/Models 통합(#541) 로 70KB 로 비대해져 §7 의 거의 모든 `:NNN` 라인 인용을 현재 값으로 교체. ai-agent 는 `AiTurnExecutor` 등으로 분할됐고 IE 핸들러는 단일 파일 유지.

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

대상 파일: `codebase/backend/src/nodes/ai/information-extractor/{information-extractor.handler.ts, information-extractor.schema.ts, information-extractor.handler.spec.ts, information-extractor.schema.spec.ts, information-extractor.thread.spec.ts, information-extractor.memory.spec.ts, information-extractor.component.ts}`. (2026-06-25: handler 는 여전히 단일 파일이나 memory v2(#484)/contextScope(#480)/Models 통합(#541) 로 ~70KB 로 비대 — 아래 라인 인용은 현재 값으로 갱신. ai-agent 와 달리 IE 는 미분할. `information-extractor.memory.spec.ts` 는 #484 가 추가한 persistent 메모리 + multi-turn 종결 push 테스트 신규 파일. 엔진 멀티턴 AI turn 경로는 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` 로 이동.)

1. **spec §5 ↔ handler return 정합성**:
   - single-turn 정상 (`out`) — `information-extractor.handler.ts:563-590` 의 return `{ config: configEcho, output: { result: { extracted, endReason:'out', turnCount:1, originalInput } }, meta: {...}, port:'out', status:'ended' }` 가 spec §5.1 과 일치.
   - single-turn 에러 — `:600-608` `LLM_RESPONSE_INVALID` (총 3 attempt 후 모두 실패) + `:519-530` `LLM_CALL_FAILED` (provider throw 즉시) 양쪽 모두 `buildErrorOutput` (`:1397-1437`) 으로 `{ output:{error:{code,message,details}}, port:'error', status:'ended' }` 반환. spec §5.3 정합.
   - multi-turn waiting — `:1443-1493` `buildWaitingResponse` 가 **D6 단일화 후** `output: { result:{ messages, message:<followUp>, turnCount }, partial:{extracted, missingFields, collectionRetryCount} }` + `meta:{interactionType:'ai_conversation'}` + `status:'waiting_for_input'` + `_resumeState` 운반. → (2026-06-25) 해소: `output.maxTurns` 제거됨, `message`/`messages` 가 `output.result.*` 로 통일 (주석 `:1471-1476`) — **Principle 1.1 직교 위반 해소 (PR #78594c71)**. spec §5.4 (line 334·370-372) 정합.
   - multi-turn 종결 — `:1166-1311` `buildMultiTurnFinalOutput` 의 4 분기 (`completed`/`user_ended`/`max_turns` (`:1297-1310`) + `max_retries` (`:1234-1267`)/`error` (`:1271-1295`) 의 `output.error + output.result` 병존) 가 spec §5.6.1~§5.6.4 와 일치. `:1880` `portForEndReason` 의 endReason→port 매핑이 spec §3.2 와 정합.

2. **`status: 'resumed'` transient snapshot 미구현 — ai-agent 와 동일**:
   - spec §5.5 는 `processMultiTurnMessage` 직후 `waiting_for_input` 으로 수렴 직전에 `status:'resumed'` + `output.interaction.{type:'message_received',data,receivedAt}` 1회 emit 을 정의. handler `:839-942` `processMultiTurnMessage` 는 곧바로 `runTurnWithCollectionRetries` → `buildWaitingResponse` 또는 `buildMultiTurnFinalOutput` 두 분기로 수렴하며 transient resumed snapshot 을 만들지 않는다.
   - (2026-06-25) 엔진 멀티턴 AI turn 경로가 `modules/execution-engine/ai-turn-orchestrator.service.ts` 로 이동했으나 동일 — `processAiResumeTurn` (`:250-291`) 이 `ai_message`/`form_submitted` 를 받아 `handleAiMessageTurn` (`:520`) → 종결 또는 re-park (`reparkAiResumeTurn`) 두 분기만 처리하고 `message_received` interaction / `resumed` status 를 emit 안 함. `resumed` emit 은 form (`form-interaction.service.ts:262`) / button (`button-interaction.service.ts:300`) 경로에만 존재. → spec §5.5 는 여전히 documented but unimplemented (ai-agent §7.5 와 동일 미흡).

3. **schema ↔ spec config 정합성**:
   - `informationExtractorNodeConfigSchema` (`information-extractor.schema.ts:36-167`) 의 모든 필드 (`llmConfigId`, `model`, `inputField`, `outputSchema`, `examples`, `instructions`, `mode`, `maxTurns`, `maxCollectionRetries`) 가 spec §1 표와 동일. default 일치 (`maxTurns:10`, `maxCollectionRetries:3`, `mode:'single_turn'`). (2026-06-25: #480/#484 가 `memoryStrategy`(manual|persistent) + contextScope 계열 필드를 추가, #642/#647 이 model 을 등록 ModelConfig select 위젯으로 전환 — output 컨트랙트엔 무영향, spec §1·§10·§12 정합.)
   - `fieldDefSchema` (`:11-`) 의 `name`/`type`/`description`/`required(default:true)`/`enumValues` 가 spec §1 의 FieldDef 와 정합.
   - **gap 없음(정합)**: spec §1 의 inputField "`multi_turn` 일 때는 비어있으면 첫 LLM 호출을 생략" 정책은 handler `:702-721` 가 구현 — `inputField` 누락 시 빈 messages + immediate waiting (`buildWaitingResponse(state, '')`). spec ↔ impl 정합.

4. **validate 일관성**:
   - `:378-` `handler.validate()` = `evaluateMetadataBlockingErrors` SSOT.
   - warningRules (`schema.ts:322-339`) 의 `no-llm-provider` / `no-output-schema` / `single-turn-needs-input-field` + `validateInformationExtractorConfig` (`:266-`) 의 per-field name/type + multi-turn maxTurns ≥ 0 (`:285-290`) 가 spec §6 표와 일치.

5. **에러 컨트랙트 (Principle 3)**:
   - 4 코드 모두 발화 가능 — `LLM_CALL_FAILED` (single `:519-530`, multi `:788-797`, multi mid-conv `:886-892`) / `LLM_RESPONSE_INVALID` (single `:600-608`, 3 attempt 후) / `MAX_COLLECTION_RETRIES_EXCEEDED` (`:1243` multi `max_retries` 종결 envelope `:1234-1267`).
   - multi-turn `max_retries` 의 `output.error + output.result` 병존 (`:1234-1267`) 은 spec §5.6.4 / `[공통 §5](../../../spec/4-nodes/3-ai/0-common.md#5-응답-형식-규약)` 의 부분 보존 패턴 정합. 부합.
   - multi-turn `LLM_CALL_FAILED` (종결 경로 `:1271-1295`) 도 `output.error + output.result` 병존 — spec §5.3 footnote ("multi-turn LLM_CALL_FAILED: result 와 병존") 정합.
   - **retryability 신규(2026-06-25)**: `retryabilityDetails` (`:1384-1395`) 가 모든 LLM 에러 envelope 에 `details.retryable` (+ retryable 시 provider Retry-After 기반 `retryAfterSec`) 를 첨부 (spec §5.3 / Principle 3.2.1). `extractRetryAfterMs` 는 #661 로 `shared/utils/retry-after` 공통화. transient(`LLM_CALL_FAILED`/`LLM_RATE_LIMIT`) = retryable, deterministic(`LLM_RESPONSE_INVALID`/`MAX_COLLECTION_RETRIES_EXCEEDED`) = non-retryable.
   - **LLM_RATE_LIMIT**: spec §6 표에 "예약" 명시 — handler 는 429 도 catch-all `LLM_CALL_FAILED` 로 분류. ai-agent / text-classifier 와 동일 정책. 정합 (예약 상태).

6. **conventions Principle 0–11 위반 패턴**:
   - Principle 0 (5필드): waiting 시 `_resumeState` top-level 6번째 키. spec §5.4 footnote 가 정당화.
   - **Principle 1.1 (config↔output 직교)**: → (2026-06-25) 해소: D6 (PR #78594c71) 로 waiting `output.maxTurns` 제거 + `output.message`/`output.messages` 가 `output.result.*` (`:1477-1482`) 로 통일돼 더 이상 직교 위반 아님. `config.maxTurns` 가 진행률 분모의 단일 출처.
   - Principle 2: `meta.{durationMs, model, *Tokens, collectionRetryCount, turnDebug}` 부합 (종결 `:1215-1230`). waiting `meta` 는 `interactionType` 만 (`:1489`) — 진행 중 메트릭은 `_resumeState` 에 누적되고 `meta` 에 비노출. 종결 시점에서만 `meta.*Tokens` 등 누적. (2026-06-25 추가: `meta.contextInjection` 이 contextScope≠none 시 echo — `:1226-1229`, #480.)
   - Principle 3: 표준 envelope 부합.
   - Principle 5: `port: 'out' | 'completed' | 'user_ended' | 'max_turns' | 'error'`. 정합.
   - Principle 7: `:481-493` configEcho (single) / `:1329-1358` multiTurnConfigEcho (종결) 가 rawConfig 우선 + state fallback. spec §5.1 / §5.6 의 raw echo 정책 (`{{ }}` 보존) 부합. **gap (잔여)**: waiting `:1466-1470` 의 config echo 는 `schema/mode/maxCollectionRetries` 3 필드만 — 종결 echo 8 필드와 비대칭. `model`/`inputField`/`maxTurns`/`instructions`/`examples` 등이 waiting echo 에서 누락. ai-agent 와 동일 패턴 (waiting echo 빈약). 단 spec §5.4 (line 334·367-369) 가 D6 로 "리터럴 config 는 echo 안 함, `$node["X"].config.*` 직접 참조" 라는 의도된 lean echo 결정으로 재문서화 — 비대칭이 의도 vs 갭인지 spec 관점 정리됨.
   - Principle 8: `output.result.extracted` 통일 wrapper, 옛 `output.output.extracted.*` 폐기 명시 — 부합.
   - Principle 10: `mergePartial` (`:1772-`) 가 null/undefined 를 "no new information" 으로 처리해 기존값 보존 — 빈/null 입력 fallback 정책 정합.

7. **handler 테스트 (`information-extractor.handler.spec.ts`)**:
   - validate / single-turn extract·retry·LLM_CALL_FAILED·LLM_RESPONSE_INVALID / multi-turn first-turn complete / waiting / inputField 누락 / optional null 처리 / processMultiTurnMessage complete·waiting·max_turns / collection retry loop·max_retries / `buildMultiTurnFinalOutput` rawConfig echo·fallback / D6 단일화 후 waiting `output.result.*` 경로 (`:868`) 까지 폭넓게 커버.
   - 에러 envelope 의 `output.error.details` 필드 검증까지 명시.
   - **누락(잔여)**: spec §5.5 (`status: 'resumed'`) snapshot 검증 케이스 부재 — ai-agent 와 동일하게 미구현 반영.
   - ConversationThread push: `information-extractor.thread.spec.ts` 가 single-turn `appendAiAssistantMessage(JSON.stringify(extracted))` + single/multi contextScope 주입을 검증. → (2026-06-25) 해소: **multi-turn 종결 4분기 push hook 구현됨** — `buildMultiTurnFinalOutput` `:1190-1213` 의 `pushExtractorTurnTo` 호출, 신규 테스트 `information-extractor.memory.spec.ts:254-396` (manual/persistent 모두 종결 push 동작 + waiting 미push). single-turn `out` 분기 push 는 `:544` 그대로. handler 주석 `:193-198` 가 "multi-turn push resolved in memory-strategy-extend-ie" 로 갱신. PR #484.

8. **횡단 일관성 (AI 3종)**:
   - LLM common wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 부합.
   - → (2026-06-25) 해소: waiting `output.messages` (옛 top-level) ↔ 종결 `output.result.messages` 비대칭이 D6 (PR #78594c71) 로 양쪽 `output.result.messages` 단일 경로 통일. ai-agent §7.4↔§7.6 도 같은 D6 로 동시 해소.
   - → (2026-06-25) 해소: `output.maxTurns` / `output.message` 직교 위반은 D6 가 AI 3종 (ai-agent/info-extractor/text-classifier) 을 한 번에 정리 — info-extractor 측은 위 §7.1·§7.6 근거 참조.
   - error 코드 다양성 — info-extractor (4 코드 발화) > text-classifier (1 코드 발화, 3 reserved) > ai-agent. (2026-06-25: 4 코드 모두 `details.retryable`/`retryAfterSec` 동반 — Principle 3.2.1 정합.)
   - ConversationThread v2 push — → (2026-06-25) 해소: info-extractor 도 이제 single + multi-turn 종결 4분기 **모두 push** (#484). text-classifier·ai-agent 와 횡단 일관성 확보. waiting 시 미push 정책 (push=종결 1회) 도 3 노드 정합.

9. **구현 품질**:
   - `defined()` helper (`:67-`) 가 undefined 키 strip — JSON snapshot 안정성.
   - `buildExtractedSnapshot` (`:1317-1327`) 가 누락 required 필드를 `null` 로 채워 다운스트림 참조 안정성 확보. spec §5.6 공통 정의와 일치.
   - `runTurnWithCollectionRetries` (`:963-`) 의 무한 루프 + budget 체크 + `mergePartial` (`:1772-`) + `computeMissingFields` (`:1834-`) 분리. 견고.
   - dead code: `MultiTurnState.toolCalls` / `ragSources` / `lastTurnRequest` 등 (`:171-176`) 은 "engine 의 generic state 통과용" 으로 주석 명시 — handler 는 사용 안 함. legacy 호환성.
   - **잔여**: `MAX_TURN_DEBUG_HISTORY` cap 은 info-extractor 에는 여전히 없음 (`turnDebugHistory` 누적 무제한, `processMultiTurnMessage` `:919-922` 의 `[...state.turnDebugHistory, ...]`) — ai-agent 분할 후 `ai-agent/ai-turn-executor.ts:2412` 의 `MAX_TURN_DEBUG_HISTORY = 50` 와 비대칭 존속. 장기 대화 시 outputData JSONB 비대 가능성.
   - (2026-06-25 추가) persistent 메모리(#484): single (`:549-561`) / multi-turn 종결 (`:1200-1212`) push 직후 `scheduleMemoryExtraction` fire-and-forget enqueue. `manual` default 는 100% no-op (회귀 invariant). 첫 진입 recall (`:453-`) 이 contextScope 주입과 별개로 동작.

## 종합 개선안 (2026-05-16)

- [x] (spec, impl) waiting 시점 `output.maxTurns` 제거 — Principle 1.1 직교 위반. 다운스트림은 `$node["X"].config.maxTurns` 사용. — ✅ (2026-06-25) D6 단일화로 `buildWaitingResponse` (`information-extractor.handler.ts:1461-1492`) 의 `output` 객체에 `maxTurns` 키 없음. 주석 `:1473-1475` 가 "`maxTurns` 는 static config 값이라 output 에 echo 안 함 (Principle 1.1 — UI 진행률 분모는 config.maxTurns)" 명시. spec §5.4 표·예시도 갱신됨. PR #78594c71 (D6 — AI 3종 multi-turn waiting/error 출력 경로 단일화).
- [x] (spec, impl) waiting 시점 `output.message` (단수) 제거/통일 — `output.messages` 가 SSOT. — ✅ (2026-06-25) D6 로 `output.message`/`output.messages` 가 top-level → `output.result.{message,messages,turnCount}` 로 통일 (`:1477-1482`). 종결 `output.result.*` 와 단일 경로라 더 이상 직교 위반 아님 (result snapshot 의 일부). spec §5.4 line 371 정합. PR #78594c71.
- [ ] (impl) `status: 'resumed'` transient snapshot 구현 또는 spec §5.5 폐기 — engine 에 form/buttons 와 동일한 `resumed` 1회 emit 추가. 여전히 미구현 (`ai-turn-orchestrator.service.ts` `processAiResumeTurn` `:250-291` → `handleAiMessageTurn` `:520` 는 `message_received` interaction / `resumed` status 를 AI 대화 turn 에서 emit 안 함; form/button 만 `form-interaction.service.ts:262` / `button-interaction.service.ts:300` 에서 emit). ai-agent 와 동시 처리 권고.
- [ ] (impl) waiting 시점 `config` echo 보강 — `:1466-1470` 의 3 필드 (`schema/mode/maxCollectionRetries`) 를 종결 echo `multiTurnConfigEcho` (`:1329-1358`) 의 8 필드 (`mode/model/schema/instructions/examples/inputField/maxTurns/maxCollectionRetries`) 와 통일. ai-agent 와 동일 패턴. (단 spec §5.4 line 334·367-369 는 D6 로 lean 3 필드 echo 를 "리터럴 config 는 echo 안 하고 `$node["X"].config.*` 직접 참조" 라는 의도된 결정으로 재문서화함 — 본 항목은 종결 echo 와의 비대칭 관점에서만 잔여.)
- [x] (impl) multi-turn 종결 4분기 (`completed`/`max_retries`/`max_turns`/`user_ended`) 의 ConversationThread push 구현 — ✅ (2026-06-25) `buildMultiTurnFinalOutput` (`:1166`) 의 종결 push 블록 `:1190-1213` 가 `threadHolderFromState(state)` 로 thread 를 얻어 `pushExtractorTurnTo` (`:234`) 호출. `error` endReason 만 제외. state-carried thread ref (`MultiTurnState.conversationThreadRef` `:140`) 로 운반. 테스트 신규 파일 `information-extractor.memory.spec.ts:254-396` (multi-turn 종결 push 동작 + waiting 미push). PR #484 (information_extractor persistent 메모리 recall+extract).
- [ ] (impl) `turnDebugHistory` cap 추가 — ai-agent `MAX_TURN_DEBUG_HISTORY = 50` (`ai-agent/ai-turn-executor.ts:2412`, ai-agent 분할로 이동) 과 동일 정책 적용해 장기 대화의 outputData JSONB 비대 방지. info-extractor `processMultiTurnMessage` `:919-922` 의 `[...state.turnDebugHistory, ...]` 가 여전히 무제한 누적 (cap 상수 부재).
- [ ] (spec) §5.5 의 resumed snapshot 이 위 impl 결정에 따라 spec 본문에서 제거되면 `_product-overview.md` / `0-common.md` §9 출력 구조 색인의 info_extractor multi 행 "Waiting / Resumed" 도 갱신. (2026-06-25: spec §5.5 resumed 는 여전히 documented-but-unimplemented 로 존속 — 위 ③ 미해결과 짝.)
- [x] (impl) `output.message` (단수) 위치 결정에 따라 단위 테스트 assert 갱신 — ✅ (2026-06-25) D6 로 통일됐고 단위 테스트 `information-extractor.handler.spec.ts:868` 가 "D6 — resumed waiting `output.result.*` 단일 경로" 로 갱신 완료. PR #78594c71.
