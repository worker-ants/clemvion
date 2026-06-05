---
id: information-extractor
status: implemented
code:
  - codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts
  - codebase/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts
pending_plans:
  - plan/in-progress/exec-park-durable-resume.md
---

# Spec: Information Extractor

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec LLM Config](../../2-navigation/6-config.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

LLM 을 사용해 비정형 텍스트에서 `outputSchema` 에 정의된 구조화 필드를 추출한다. **Single Turn**(1 회 LLM 호출 + JSON 응답) 과 **Multi Turn**(블로킹 대화로 부족한 필드 보강 — `finalize_extraction` tool 호출 종결) 모드를 제공한다. AI 카테고리 3 노드는 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 컨트랙트를 공유한다 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| llmConfigId | UUID? |  |  | 사용할 LLM 프로바이더 설정. [공통 §1](./0-common.md#1-llm-모델config-선택) |
| model | String? |  | (LLMConfig 기본값) | 모델 ID (프로바이더별) |
| inputField | Expression? | (single 필수) |  | 추출 대상 텍스트 필드. `single_turn` 일 때 warningRule 강제. `multi_turn` 일 때는 비어있으면 첫 LLM 호출을 생략하고 곧바로 사용자 입력을 대기 |
| outputSchema | FieldDef[] | ✓ | `[]` | 추출할 필드 정의. 빈 배열일 때 warningRule 발생 |
| examples | ExampleDef[] |  | `[]` | Few-shot 예시 |
| instructions | String? |  | `''` | 추가 추출 지시사항 (system prompt 에 주입) |
| mode | `single_turn` / `multi_turn` | ✓ | `single_turn` | 실행 모드. `multi_turn` 차단 동작은 [공통 §4](./0-common.md#4-multi-turn-차단-모드) |
| maxTurns | Integer? |  | `10` | `multi_turn` 의 최대 대화 턴 수. `0` = 무제한 |
| maxCollectionRetries | Integer? |  | `3` | `multi_turn` 에서 LLM 이 `finalize_extraction` 을 호출했지만 required 필드가 비어있을 때 재질의를 강제하는 횟수. `0` = 무제한. 초과 시 `error` 포트 + `output.error.code: 'MAX_COLLECTION_RETRIES_EXCEEDED'` |
| contextScope | `none` / `thread` / `lastN` |  | `none` | ConversationThread 자동 주입 범위. [공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입) (세 노드 공통) |
| contextScopeN | Integer? | (lastN 시) | `20` | `lastN` 일 때 최근 N개 turn |
| contextInjectionMode | `messages` / `system_text` | (scope ≠ none 시) | `messages` | 주입 형식 — LLM messages 배열 prepend / system prompt 텍스트 첨부 |
| includeToolTurns | Boolean? |  | `false` | `ai_tool` turn 도 thread push 할지 (추출 노드의 `finalize_extraction` tool turn 은 push 대상 아님 — 주입 측 인터페이스 일관성용) |
| excludeFromConversationThread | Boolean? |  | `false` | 본 노드의 push turn 을 thread 에서 제외 (opt-out) |
| includeSystemContext | Boolean? |  | `true` | systemPrompt 앞에 시각·timezone prefix 자동 prepend. [공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix) |
| systemContextSections | String[]? |  | `['time', 'timezone']` | prefix 섹션. [공통 §11.1](./0-common.md#111-설정-필드-3-노드-공통) |

> Source of truth: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.schema.ts` (export `informationExtractorNodeConfigSchema`)
>
> `multi_turn` 모드에서 사용자 응답은 무제한 대기한다 (외부 cancel 외에는 타임아웃이 발생하지 않음).

> **Conversation Context (`contextScope` 외 5필드)** 는 AI Agent 와 **동일 인터페이스** ([공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입)) 로, 공유 fragment `buildConversationContextSchemaFields()` + 공유 주입 유틸 `injectConversationContext()` 를 통해 LLM 호출 직전에 ConversationThread 를 주입한다. `single_turn` 은 LLM 호출 직전, `multi_turn` 은 첫 진입(`executeMultiTurn`) 초기 messages 빌드 직후 1회 주입돼 이후 turn 의 `_resumeState.messages` 로 운반된다 (AI Agent multi-turn 과 동일 패턴). `memoryStrategy` 필드가 없으므로 항상 contextScope 가 적용되며, default `contextScope: 'none'` 이라 기존 워크플로 동작은 불변.

**FieldDef 구조** (`outputSchema[i]`):

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| name | String | ✓ |  | 필드 이름 (LLM 응답 JSON 의 키) |
| type | `string` / `number` / `boolean` / `array` / `object` | ✓ |  | 필드 타입. JSON Schema 로 변환되어 LLM 에 전달 |
| description | String | ✓ |  | LLM 에게 제공되는 필드 설명 |
| required | Boolean |  | `true` | 필수 여부. `multi_turn` 에서 `false` 인 필드는 누락되어도 종결 가능 |
| enumValues | String[]? |  |  | 허용 값 목록. JSON Schema 의 `enum` 으로 변환 (null 허용) |

**ExampleDef 구조** (`examples[i]`):

| 필드 | 타입 | 설명 |
|------|------|------|
| input | String | 예시 입력 텍스트 |
| output | Object | 예시 추출 결과 (스키마와 동일한 키 구성) |

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Information Extractor                   │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [Anthropic ▼]            │
│  Model:        [claude-sonnet-4-6 ▼]    │
│                                          │
│  Input Field: [{{ $input.emailBody }}]   │  (single_turn 시만 표시)
│                                          │
│  ── Output Schema ──                     │
│  ┌──────────────────────────────────────┐│
│  │ senderName    String   ✅ Required   ││
│  │ "발신자 이름"                         ││
│  ├──────────────────────────────────────┤│
│  │ orderNumber   String   ✅ Required   ││
│  │ "주문번호 (ORD-XXXXX)"                ││
│  ├──────────────────────────────────────┤│
│  │ issueType     String   ✅ Required   ││
│  │ "문제 유형" [refund, exchange, ...]  ││
│  ├──────────────────────────────────────┤│
│  │ amount        Number   ☐ Optional    ││
│  │ "관련 금액"                           ││
│  └──────────────────────────────────────┘│
│  [+ Add Field]                           │
│                                          │
│  ── Examples (Few-shot) ──               │
│  [+ Add Example]                         │
│                                          │
│  Instructions: [_____________________]   │
│                                          │
│  ── Mode ──                              │
│  ● Single Turn   ○ Multi Turn            │
│                                          │
│  ── Multi Turn Settings ── (mode=multi_turn 시) │
│  Max Turns:               [10__]         │
│  Max Collection Retries:  [3___]         │
└──────────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 추출 대상 데이터 (`inputField` expression 의 평가 컨텍스트) |

### 3.2 출력 포트 — `mode` 에 따라 동적

`isDynamicPorts: true`, `dynamicPorts.kind: 'info-extractor-mode'`. 프런트엔드 `resolveDynamicPorts` 가 `config.mode` 를 보고 다음 포트 셋을 산출한다.

**Single Turn (`mode === 'single_turn'`):**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | system | true (mode-derived) | 추출 성공 시 결과 라우팅 (`resolveDynamicPorts` 가 `system` 으로 발행) |
| `error` | Error | error | true (mode-derived) | LLM 호출 실패 / JSON 파싱 재시도 소진 시 |

**Multi Turn (`mode === 'multi_turn'`):**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `completed` | Completed | system | true (mode-derived) | 모든 required 필드가 채워져 자연 완료 (`resolveDynamicPorts` 가 `system` 으로 발행) |
| `user_ended` | User Ended | system | true (mode-derived) | 사용자가 `execution.end_conversation` 으로 명시 종료 |
| `max_turns` | Max Turns | system | true (mode-derived) | `turnCount >= maxTurns` (`maxTurns > 0` 일 때) |
| `error` | Error | error | true (mode-derived) | LLM 호출 실패 또는 `MAX_COLLECTION_RETRIES_EXCEEDED` |

> 동적 출력 포트는 `mode` 변경 시 즉시 재계산된다. 사용자가 정의하는 추출 필드(`outputSchema`) 는 포트가 아니라 결과 객체의 키가 된다. `out` / `completed` / `user_ended` / `max_turns` / `error` 는 [CONVENTIONS Principle 6](../../conventions/node-output.md#principle-6--동적-포트-id-네이밍) 의 시스템 포트 예약어이므로 사용자가 충돌하는 ID 를 설정할 수 없다.

## 4. 실행 로직

### 4.1 Single Turn (`mode === 'single_turn'`)

0.5. **System Context Prefix 빌드** ([공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)) — `includeSystemContext !== false` (default `true`) 면 `systemContextSections` 에 따라 prefix 를 생성해 다음 단계의 system prompt 앞에 prepend.
1. `outputSchema` 를 JSON Schema 로 변환 (`buildJsonSchema(schema, multiTurn=false)`). 각 필드는 `[type, 'null']` union 으로 선언되어 LLM 이 미수집 필드를 `null` 로 표현 가능.
2. system prompt 구성 — schema 설명 + `instructions` + `examples` + "JSON 으로만 응답" 지시.
2.5. **Conversation Context 주입** ([공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입)) — `contextScope ≠ none` 이면 공유 유틸 `injectConversationContext()` 로 ConversationThread (자기 노드 turn 제외) 를 `contextInjectionMode` 에 따라 messages prepend / systemPrompt append 한다. `contextScope: 'none'` (default) 이면 무변경.
3. `evaluatedConfig.inputField` 를 user message 로, `responseFormat: 'json'` + `jsonSchema` 옵션과 함께 LLM 호출 (`LlmService.chat`).
4. LLM 호출이 throw 하면 즉시 `error` 포트 + `output.error.code: 'LLM_CALL_FAILED'` (§5.3 참조).
5. 응답 content 를 JSON.parse. 성공 → 추출 결과를 `output.result.extracted` 에 담고 `out` 포트로 라우팅 (§5.1).
6. JSON.parse 실패 시 최대 2 회 재시도 (총 3 attempt). 모두 실패 시 `error` 포트 + `output.error.code: 'LLM_RESPONSE_INVALID'` (§5.3).

### 4.2 Multi Turn (`mode === 'multi_turn'`)

`finalize_extraction` tool 을 LLM 에 노출하고, LLM 이 모든 필드를 모은 시점에 tool call 을 트리거하면 종결한다. 자세한 system prompt 정책은 backend handler 의 `buildMultiTurnSystemPrompt` 참조. System Context Prefix ([공통 §11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)) 는 매 턴 systemPrompt 의 가장 앞에 유지된다 — `$now` 가 execution 단위 frozen 이므로 turn 마다 재계산해도 동일 값.

1. **첫 턴 진입**:
   - `inputField` 가 비어 있으면 LLM 호출을 건너뛰고 `turnCount: 0` 으로 즉시 `waiting_for_input` 반환 (§5.4). 사용자가 첫 메시지를 보낼 때까지 대기.
   - `inputField` 에 값이 있으면 그 값을 첫 user 메시지로 LLM 호출. 이 직전 **Conversation Context 주입** ([공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입)) — `contextScope ≠ none` 이면 공유 유틸 `injectConversationContext()` 로 초기 messages 빌드 직후 1회 주입한다. 주입된 turn 은 `_resumeState.messages` 로 운반돼 후속 turn 은 재주입하지 않는다 (AI Agent multi-turn 과 동일 패턴).
2. **턴 처리** (`runTurnWithCollectionRetries`):
   - LLM 응답이 `finalize_extraction` tool call 을 포함하면 args 를 파싱해 `partialResult` 와 merge (`null`/`undefined` 는 기존값 보존). 모든 required 가 채워졌으면 `completed`, 부족하면 `tool` role 메시지로 누락 필드를 알리고 `collectionRetryCount += 1` 후 동일 턴 내 재호출.
   - `collectionRetryCount > maxCollectionRetries` (0 제외) → `forcedEnd: 'max_retries'` (§5.6 max_retries — `error` 포트 + `output.error.code: 'MAX_COLLECTION_RETRIES_EXCEEDED'`).
   - tool call 없이 content 만 있으면 followup 질문으로 간주, `waiting_for_input` 반환 (§5.4).
3. **종결 판정** (각 턴 끝):
   - `forcedEnd` 가 있으면 그 사유로 종결.
   - 모든 required 충족 → `completed` 포트 (`endReason: 'completed'`).
   - `turnCount >= maxTurns` (`maxTurns > 0`) → `max_turns` 포트.
4. **`processMultiTurnMessage(userMessage, _resumeState)`** — engine 이 사용자 메시지 수신 시 호출. 메시지를 대화에 append 후 (2)~(3) 반복.
5. **`endMultiTurnConversation(_resumeState, endReason)`** — engine 이 사용자가 명시 종료(`execution.end_conversation`) 또는 timeout 등을 만났을 때 호출. `endReason` 에 따라 `user_ended` / `max_turns` / `error` 포트로 라우팅 (§5.6).
6. **재개 스냅샷** ([공통 §4](./0-common.md#4-multi-turn-차단-모드), [Stage 2 resume](../../conventions/node-output.md#44-resumed-상태의-output-내용)): 사용자 메시지를 받아 재개되었으나 종결 조건에 도달하지 않은 경우, 다음 `waiting_for_input` 으로 수렴하기 직전 `status: 'resumed'` + `output.interaction.{type, data, receivedAt}` 스냅샷이 1 회 emit 된다 (§5.5).

> Source of truth: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`. 시스템 프롬프트 / tool 정의는 동일 파일의 `buildMultiTurnSystemPrompt` / `buildFinalizationTool`.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level key 금지 (단 multi-turn waiting/resumed 는 Principle 4 에 따라 internal `_resumeState` 를 함께 운반 — expression 레이어에는 노출되지 않음).
>
> AI 3 노드 공통 wrapper: `output.result.*` / `output.error.{code, message, details?}` / `output.interaction.{type, data, receivedAt}` ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)). 옛 `output.output.extracted.*` 이중 중첩 포맷은 폐기 (Principle 8).
>
> **Config echo 정책 (Principle 7)**: 모든 종결·waiting·resumed 시점에서 `config` 는 사용자가 입력한 raw 값 (template `{{ ... }}` 보존) 을 echo 한다. multi-turn resumed 턴에서는 engine 이 `state.rawConfig` (frozen snapshot) 를 통해 동일 raw 값을 운반한다. 후속 노드는 `$node["X"].config.{mode, model, schema, instructions, examples, inputField, maxTurns, maxCollectionRetries}` 로 raw 를 읽고, 평가된 모델 식별자는 `meta.model` 에서 읽는다.
>
> **케이스 색인** ([공통 §9](./0-common.md#9-출력-구조-색인) 와 정합):
> - **Single**: §5.1 (정상 — `out`) · §5.3 (에러)
> - **Multi**: §5.4 (`waiting_for_input`) · §5.5 (`resumed`) · §5.6 (종결 4종 — `completed` / `user_ended` / `max_turns` / `max_retries`. multi-turn LLM 호출 실패도 `error` 포트로 §5.3 와 동일한 envelope 으로 라우팅됨)

### 5.1 Case: Single Turn 정상 (port `out`)

```json
{
  "config": {
    "mode": "single_turn",
    "model": "claude-sonnet-4-6",
    "schema": [
      { "name": "senderName", "type": "string", "description": "발신자", "required": true },
      { "name": "orderNumber", "type": "string", "description": "주문번호", "required": true },
      { "name": "issueType", "type": "string", "description": "문제 유형", "required": true },
      { "name": "amount", "type": "number", "description": "금액", "required": false }
    ],
    "instructions": "",
    "examples": [],
    "inputField": "{{ $input.emailBody }}"
  },
  "output": {
    "result": {
      "extracted": {
        "senderName": "김철수",
        "orderNumber": "ORD-12345",
        "issueType": "refund",
        "amount": 29900
      },
      "endReason": "out",
      "turnCount": 1,
      "originalInput": "환불 요청합니다. 주문번호 ORD-12345 …"
    }
  },
  "meta": {
    "durationMs": 810,
    "model": "claude-sonnet-4-6",
    "inputTokens": 450,
    "outputTokens": 80,
    "totalTokens": 530,
    "thinkingTokens": 0,
    "turnDebug": [
      { "turnIndex": 1, "llmCalls": [{ "requestPayload": {}, "responsePayload": {}, "durationMs": 810 }], "totalDurationMs": 810 }
    ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.mode` | `'single_turn'` | config echo (Principle 7) | 실행 모드 |
| `config.model` | string | config echo — raw | 사용자 입력 raw 값 (`{{ }}` 보존). evaluated 식별자는 `meta.model` |
| `config.schema` | FieldDef[] | config echo (= raw `outputSchema`) | 추출 스키마 정의 (raw) |
| `config.instructions` | string | config echo — raw | 추가 지시 raw 텍스트 |
| `config.examples` | ExampleDef[] | config echo — raw | few-shot 예시 raw |
| `config.inputField` | string | config echo — raw | 입력 표현식 raw |
| `output.result.extracted` | `Record<string, unknown>` | handler — runtime | LLM 이 추출한 필드. `outputSchema` 전 필드를 포함하며 미수집은 `null` |
| `output.result.endReason` | `'out'` | handler — runtime | single 정상 종료 사유 |
| `output.result.turnCount` | number | handler — runtime | single 은 항상 `1` |
| `output.result.originalInput` | string | handler — runtime | LLM 에 투입한 실제 입력 (디버그 / 후속 노드 참조) |
| `meta.durationMs` | number | handler / engine | 총 실행 시간 (ms) |
| `meta.model` | string | LLM response | 실제 호출된 모델 식별자 |
| `meta.{inputTokens, outputTokens, totalTokens, thinkingTokens}` | number | LLM usage | 토큰 회계 ([공통 §6](./0-common.md#6-토큰-회계-meta)) |
| `meta.turnDebug` | Array | handler — runtime | 턴별 LLM 호출 트레이스 (single 은 1 항목) |
| `port` | `'out'` | handler return | 정상 출력 |
| `status` | `'ended'` | handler return | 종결 상태 |

**Expression 접근 예**:
- `$node["X"].output.result.extracted.senderName` → `"김철수"`
- `$node["X"].output.result.extracted.amount` → `29900` (또는 `null`)
- `$node["X"].config.schema` → 사용자가 입력한 raw `outputSchema`
- `$node["X"].meta.totalTokens` → `530`
- `$node["X"].port` → `"out"`

### 5.3 Case: 에러 (port `error`)

`error` 포트는 single-turn 의 LLM 호출 실패 / JSON 파싱 재시도 소진, multi-turn 의 LLM 호출 실패 (`max_retries` 는 §5.6) 가 모두 라우팅된다. multi-turn 의 mid-conversation 실패에서는 `output.error` 와 함께 `output.result` 가 부분 수집 결과로 병존한다 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)).

```json
{
  "config": {
    "mode": "single_turn",
    "model": "claude-sonnet-4-6",
    "schema": [/* … */],
    "instructions": "",
    "examples": [],
    "inputField": "{{ $input.emailBody }}"
  },
  "output": {
    "error": {
      "code": "LLM_RESPONSE_INVALID",
      "message": "Failed to parse JSON after 3 attempts",
      "details": {
        "attempts": 3,
        "originalInput": "환불 요청합니다…",
        "lastResponse": "..."
      }
    }
  },
  "meta": {
    "durationMs": 3200,
    "model": "claude-sonnet-4-6",
    "turnDebug": [{ "turnIndex": 1, "llmCalls": [{}, {}, {}], "totalDurationMs": 3200 }]
  },
  "port": "error",
  "status": "ended"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일) | config echo | raw 값 |
| `output.error.code` | string | handler — runtime | 아래 `code` 예약어 표 참조 |
| `output.error.message` | string | handler — runtime | 사람이 읽는 원문 메시지 (i18n 없음) |
| `output.error.details.retryable` | `boolean` | handler — runtime | [CONVENTIONS Principle 3.2.1](../../conventions/node-output.md#321-details-의-공통-표준-필드-llm-계열-노드-한정-필수) 에 따라 handler 의 모든 error 경로가 `retryabilityDetails` 헬퍼로 채운다 ([handler](../../../codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts) `buildErrorOutput`). invariant: `LLM_CALL_FAILED` / `LLM_RATE_LIMIT` → `true`, `LLM_RESPONSE_INVALID` / `MAX_COLLECTION_RETRIES_EXCEEDED` → `false` (§6 에러 코드 표) |
| `output.error.details.retryAfterSec?` | `number?` | handler — runtime | provider 가 `Retry-After` 등 신호 제공 시 권장 대기 시간 (초). invariant: `retryable === true` 일 때만 set (Principle 3.2.1) |
| `output.error.details` (기타) | object? | handler — runtime | 노드별 부가 정보 (`attempts` / `originalInput` / `lastResponse` / `turnCount` / `collectionRetryCount` 등) |
| `output.result` | object? | handler — runtime | **multi-turn LLM_CALL_FAILED 한정** — `extracted` / `endReason: 'error'` / `turnCount` / `messages` 부분 수집 결과 보존 |
| `meta.durationMs` | number | handler / engine | 실행 시간 |
| `meta.model` | string? | LLM response | 호출이 일부라도 성공했을 때만 |
| `meta.collectionRetryCount` | number? | handler — runtime | multi-turn 에러 시 누적값 |
| `meta.turnDebug` | Array | handler — runtime | 턴별 트레이스 |
| `port` | `'error'` | handler return | 에러 라우팅 |
| `status` | `'ended'` | handler return | 종결 상태 |

**`output.error.code` 예약어**:

| code | 발생 조건 |
|------|-----------|
| `LLM_CALL_FAILED` | provider 네트워크 / 타임아웃 / 5xx / 기타 throw |
| `LLM_RATE_LIMIT` | 429 (provider 가 별도 분류 시) |
| `LLM_RESPONSE_INVALID` | single-turn JSON 파싱이 모든 재시도(기본 3 attempt) 실패 |
| `MAX_COLLECTION_RETRIES_EXCEEDED` | multi-turn `collectionRetryCount > maxCollectionRetries` 초과 (§5.6 max_retries) |

> **multi-turn `LLM_CALL_FAILED`**: 대화 도중 LLM 호출이 실패하면 `output.error` (LLM_CALL_FAILED) + `output.result` (부분 추출) 가 함께 emit 된다. 후속 노드는 `output.error` 존재 여부로 정상 / 에러를 판단하고, 부분 결과는 `output.result.extracted` 에서 회수한다. multi-turn `MAX_COLLECTION_RETRIES_EXCEEDED` 는 §5.6 (max_retries) 와 동일한 envelope 이지만 분류상 "재시도 한도 초과로 인한 종결" 이므로 그쪽에서 상세 기술.

**Expression 접근 예**:
- `$node["X"].output.error.code` → `"LLM_RESPONSE_INVALID"` 등
- `$node["X"].output.error.details.originalInput` → 디버그용 원문
- `$node["X"].output.result?.extracted` → multi-turn 에러 시 부분 결과 (single-turn 에러는 undefined)
- `$node["X"].port` → `"error"`

### 5.4 Case: Multi Turn 대기 (`status: 'waiting_for_input'`)

handler 가 `output: { result: {...}, partial?: {...} }` 런타임 필드와 `_resumeState` (internal) 를 함께 반환하고, engine 이 실행을 일시 중단한 상태. `output.result.*` 에는 **이 턴 시점의 대화 스냅샷** (`messages`/`message`/`turnCount`) 이 담기고 (`ai_agent` 와 단일 경로 통일 — D6; `maxTurns` 는 config 전용이라 echo 안 함, Principle 1.1), `output.partial.*` 에는 **부분 수집 진행 상태** 가 담긴다. `maxCollectionRetries`·`schema` 등 리터럴 config 는 echo 하지 않으며, UI / 후속 노드는 `$node["X"].config.*` 를 직접 참조한다.

```json
{
  "config": {
    "schema": [/* … */],
    "mode": "multi_turn",
    "maxCollectionRetries": 3
  },
  "output": {
    "result": {
      "messages": [
        { "role": "user", "content": "환불 요청합니다." },
        { "role": "assistant", "content": "주문번호를 알려주세요." }
      ],
      "message": "주문번호를 알려주세요.",
      "turnCount": 1
    },
    "partial": {
      "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": "refund", "amount": null },
      "missingFields": ["orderNumber"],
      "collectionRetryCount": 0
    }
  },
  "meta": {
    "interactionType": "ai_conversation"
  },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.schema` | FieldDef[] | config echo | 대기 시점의 스키마 raw |
| `config.mode` | `'multi_turn'` | config echo | |
| `config.maxCollectionRetries` | number | config echo | 대기 UI 진행률 표시용 (`output.partial.collectionRetryCount` 와 비교) |
| `output.result.messages` | `ChatMessage[]` | handler — runtime | 누적 대화 (**system 제외** — user + assistant + tool). `ai_agent` 와 동일 구조 / 동일 경로 (D6 통일, conversation-thread §1.4 의 system 제외 규칙 정합) |
| `output.result.message` | string | handler — runtime | 가장 최근 assistant followup. WS 페이로드 구성 편의용 |
| `output.result.turnCount` | number | handler — runtime | 현재까지 진행된 턴 수. 진행률 분모 `maxTurns` 는 `config.maxTurns` 에서 읽는다 (output echo 없음, Principle 1.1) |
| `output.partial.extracted` | `Record<string, unknown>` | handler — runtime | 스키마 전 필드 기준의 현재 스냅샷. 미수집은 `null` |
| `output.partial.missingFields` | `string[]` | handler — runtime | 아직 채워지지 않은 required 필드 이름 |
| `output.partial.collectionRetryCount` | number | handler — runtime | 누적 재질의 횟수 (UI 진행률용) |
| `meta.interactionType` | `'ai_conversation'` | handler — runtime | engine WS 페이로드 분류용 메타. 종결 시점에는 사용하지 않음 |
| `status` | `'waiting_for_input'` | handler return | 엔진 일시 중단 트리거 |
| `_resumeState` | object | handler internal | 다음 턴 처리에 필요한 internal state. expression 레이어에 노출되지 않음 (autocomplete/resolver 에서 숨김). DB 저장 시 strip — 단 **`information_extractor` 도 `_resumeCheckpoint` 재시작-재개([실행 엔진 §1.3 / §7.5](../../5-system/4-execution-engine.md#75-resume-after-restart-rehydration))를 지원한다**: credential-strip 부분집합(고유 runtime state `partialResult`/`collectionRetryCount` 포함)이 `NodeExecution.outputData._resumeCheckpoint` 에 영속되고, 재개 시 config 필드(outputSchema/examples/instructions/maxCollectionRetries)는 `node.config` 에서 재유도된다. checkpoint 부재/손상/미래 버전 시에만 graceful reset (`RESUME_INCOMPATIBLE_STATE`) |

**Expression 접근 예**:
- `$node["X"].output.result.messages[-1].content` → 마지막 assistant 메시지
- `$node["X"].output.partial.missingFields` → 누락 필드 목록
- `$node["X"].config.maxTurns` → raw 한도값 (Principle 1.1)
- `$node["X"].status` → `"waiting_for_input"`

> **D6 결정**: waiting 의 대화 상태 (`messages` / `message` / `turnCount`) 가 종결 시점 (`output.result.*`) 과 단일 경로로 통일. 다운스트림은 `$node["X"].output.result.messages` 처럼 단일 경로로 접근한다. `maxTurns` 는 config 전용 (`$node["X"].config.maxTurns`, Principle 1.1). `output.partial.*` 은 result/partial 의미 분리로 별도 슬롯 유지.

### 5.5 Case: Multi Turn 재개 (`status: 'resumed'`)

사용자 메시지를 받아 다음 턴을 처리한 직후 종결 조건에 도달하지 않은 경우, 다음 `waiting_for_input` 으로 수렴하기 직전에 1 회 emit 되는 observability-only 스냅샷. 그래프 엣지 라우팅을 발생시키지 않고 run history / timeline 에만 기록된다 ([공통 §4](./0-common.md#4-multi-turn-차단-모드), CONVENTIONS §4.4 / §4.5).

```json
{
  "config": {
    "schema": [/* … */],
    "mode": "multi_turn",
    "maxCollectionRetries": 3
  },
  "output": {
    "result": {
      "messages": [
        { "role": "system", "content": "..." },
        { "role": "user", "content": "환불 요청합니다." },
        { "role": "assistant", "content": "주문번호를 알려주세요." },
        { "role": "user", "content": "ORD-12345 입니다" }
      ]
    },
    "partial": {
      "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": "refund", "amount": null },
      "missingFields": ["orderNumber"],
      "collectionRetryCount": 0
    },
    "interaction": {
      "type": "message_received",
      "data": { "content": "ORD-12345 입니다", "role": "user" },
      "receivedAt": "2026-04-19T06:45:12.480Z"
    }
  },
  "meta": {
    "durationMs": 0,
    "interactionType": "ai_conversation"
  },
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.4와 동일) | config echo | 대기 시점과 동일 raw |
| `output.result.messages` | `ChatMessage[]` | handler — runtime | 사용자 메시지 append 직후 누적 (D6 — `output.result.*` 단일 경로) |
| `output.partial` | object | handler — runtime | 직전 대기 시점의 스냅샷 유지 (이 시점에는 새 LLM 호출 결과가 아직 없음) |
| `output.interaction.type` | `'message_received'` | engine | resume 트리거 종류 ([CONVENTIONS §4.5](../../conventions/node-output.md#45-interactiondata-payload-규격)). handler 는 `waiting_for_input` 만 emit 하며, `resumed` 스냅샷의 `output.interaction.*` 와 `status: 'resumed'` 는 engine (`execution-engine.service`) 이 주입 |
| `output.interaction.data.content` | string | engine | 사용자가 입력한 메시지 본문 |
| `output.interaction.data.role` | `'user'` | engine | 고정 |
| `output.interaction.receivedAt` | ISO8601 string | engine | 메시지 수신 시각 |
| `meta.durationMs` | number | engine inject | resumed 스냅샷은 별도 LLM 호출이 없으므로 보통 0 |
| `meta.interactionType` | `'ai_conversation'` | handler — runtime | 대기 / 재개 공통 분류 메타 |
| `status` | `'resumed'` | engine | observability transient — 그래프 라우팅 없음. handler 가 아니라 engine 이 주입 |
| `_resumeState` | object | handler internal | 다음 턴 처리에 필요한 internal state |

**Expression 접근 예**:
- `$node["X"].output.interaction.data.content` → `"ORD-12345 입니다"`
- `$node["X"].output.interaction.receivedAt` → ISO8601
- `$node["X"].status` → `"resumed"`

### 5.6 Case: Multi Turn 종결 (4 종)

multi-turn 의 4 가지 종결 사유. **공통 envelope** (`endReason` / `port` / `status` 만 다름):

```jsonc
{
  "config": { /* multiTurnConfigEcho — raw mode/model/schema/instructions/examples/inputField/maxTurns/maxCollectionRetries */ },
  "output": {
    "result": {
      "extracted": { /* outputSchema 전 필드, 미수집은 null */ },
      "endReason": "<completed|user_ended|max_turns|max_retries>",
      "turnCount": <number>,
      "messages": [/* 누적 대화 */]
    }
    // max_retries 의 경우 output.error 가 result 와 병존 (아래 참조)
  },
  "meta": {
    "durationMs": <number>,
    "model": "claude-sonnet-4-6",
    "inputTokens": <number>,
    "outputTokens": <number>,
    "totalTokens": <number>,
    "thinkingTokens": <number>,
    "collectionRetryCount": <number>,
    "turnDebug": [/* … */]
  },
  "port": "<completed|user_ended|max_turns|error>",
  "status": "ended"
}
```

#### 5.6.1 `completed` (port `completed`)

모든 required 필드가 채워져 LLM 의 `finalize_extraction` tool call 이 성공한 자연 완료.

```json
{
  "config": {
    "mode": "multi_turn",
    "model": "claude-sonnet-4-6",
    "schema": [/* … */],
    "instructions": "",
    "examples": [],
    "inputField": "{{ $input.emailBody }}",
    "maxTurns": 10,
    "maxCollectionRetries": 3
  },
  "output": {
    "result": {
      "extracted": {
        "senderName": "김철수",
        "orderNumber": "ORD-12345",
        "issueType": "refund",
        "amount": 29900
      },
      "endReason": "completed",
      "turnCount": 2,
      "messages": [/* … */]
    }
  },
  "meta": {
    "durationMs": 950,
    "model": "claude-sonnet-4-6",
    "inputTokens": 920,
    "outputTokens": 150,
    "totalTokens": 1070,
    "thinkingTokens": 0,
    "collectionRetryCount": 0,
    "turnDebug": [/* … */]
  },
  "port": "completed",
  "status": "ended"
}
```

#### 5.6.2 `user_ended` (port `user_ended`)

사용자가 `execution.end_conversation` 명령으로 명시 종료. `extracted` 는 수집된 만큼만 보존되고, 미수집은 `null`.

```json
{
  "config": { "mode": "multi_turn", "schema": [/* … */], "maxTurns": 10, "maxCollectionRetries": 3 },
  "output": {
    "result": {
      "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": null, "amount": null },
      "endReason": "user_ended",
      "turnCount": 2,
      "messages": [/* … */]
    }
  },
  "meta": {
    "durationMs": 4200,
    "model": "claude-sonnet-4-6",
    "inputTokens": 600,
    "outputTokens": 90,
    "totalTokens": 690,
    "thinkingTokens": 0,
    "collectionRetryCount": 0,
    "turnDebug": [/* … */]
  },
  "port": "user_ended",
  "status": "ended"
}
```

#### 5.6.3 `max_turns` (port `max_turns`)

`turnCount >= maxTurns` (`maxTurns > 0`) 도달.

```json
{
  "config": { "mode": "multi_turn", "schema": [/* … */], "maxTurns": 5, "maxCollectionRetries": 3 },
  "output": {
    "result": {
      "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": "refund", "amount": null },
      "endReason": "max_turns",
      "turnCount": 5,
      "messages": [/* … */]
    }
  },
  "meta": {
    "durationMs": 7320,
    "model": "claude-sonnet-4-6",
    "inputTokens": 800,
    "outputTokens": 240,
    "totalTokens": 1040,
    "thinkingTokens": 0,
    "collectionRetryCount": 1,
    "turnDebug": [/* … */]
  },
  "port": "max_turns",
  "status": "ended"
}
```

#### 5.6.4 `max_retries` (port `error`)

`collectionRetryCount > maxCollectionRetries` 초과. `error` 포트로 라우팅되며 **`output.error` 와 `output.result` 가 병존** — 부분 수집 결과를 후속 노드가 활용할 수 있도록 둘 다 보존한다 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)).

```json
{
  "config": { "mode": "multi_turn", "schema": [/* … */], "maxTurns": 10, "maxCollectionRetries": 3 },
  "output": {
    "error": {
      "code": "MAX_COLLECTION_RETRIES_EXCEEDED",
      "message": "LLM attempted finalize_extraction 4 times with missing required fields",
      "details": {
        "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": "refund", "amount": null },
        "missingFields": ["orderNumber"],
        "turnCount": 3,
        "collectionRetryCount": 3
      }
    },
    "result": {
      "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": "refund", "amount": null },
      "endReason": "max_retries",
      "turnCount": 3,
      "messages": [/* … */]
    }
  },
  "meta": {
    "durationMs": 5600,
    "model": "claude-sonnet-4-6",
    "inputTokens": 500,
    "outputTokens": 150,
    "totalTokens": 650,
    "thinkingTokens": 0,
    "collectionRetryCount": 3,
    "turnDebug": [/* … */]
  },
  "port": "error",
  "status": "ended"
}
```

**5.6 공통 필드**:

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (raw multiTurnConfigEcho) | config echo (Principle 7) | engine 이 운반한 `state.rawConfig` 에서 echo |
| `output.result.extracted` | `Record<string, unknown>` | handler — runtime | 스키마 전 필드, 미수집은 `null` |
| `output.result.endReason` | `'completed'` / `'user_ended'` / `'max_turns'` / `'max_retries'` | handler — runtime | 종결 사유 |
| `output.result.turnCount` | number | handler — runtime | 실제 진행 턴 수 |
| `output.result.messages` | `ChatMessage[]` | handler — runtime | 누적 대화 |
| `output.error` | object | handler — runtime | **`max_retries` 한정**. multi-turn LLM_CALL_FAILED 도 같은 envelope (§5.3 참조) |
| `meta.durationMs` | number | handler / engine | 누적 실행 시간 |
| `meta.model` | string | handler — runtime | LLM 호출에 사용된 모델 |
| `meta.{inputTokens, outputTokens, totalTokens, thinkingTokens}` | number | LLM usage 누적 | turn 별 합산 |
| `meta.collectionRetryCount` | number | handler — runtime | 재질의 누적 |
| `meta.turnDebug` | Array | handler — runtime | turn 별 LLM 트레이스. delta 합 = `meta.{ragSources, ragDiagnostics, mcpDiagnostics}` 누적 ([공통 §7](./0-common.md#7-진단-누적-provider-tool)) |
| `port` | `'completed'` / `'user_ended'` / `'max_turns'` / `'error'` | handler — `portForEndReason` | endReason → port 매핑 |
| `status` | `'ended'` | handler return | |

**Expression 접근 예**:
- `$node["X"].output.result.extracted.orderNumber` → `"ORD-12345"` 또는 `null`
- `$node["X"].output.result.endReason` → `"completed"` / `"user_ended"` / `"max_turns"` / `"max_retries"`
- `$node["X"].output.error?.code === "MAX_COLLECTION_RETRIES_EXCEEDED"` → max_retries 분기 판정
- `$node["X"].port` → `"completed"` / `"user_ended"` / `"max_turns"` / `"error"`
- `$node["X"].meta.collectionRetryCount` → `3`

## 6. 에러 코드

`output.error.code` 예약어 (Principle 3.2 표준 envelope `{code, message, details?}`):

| code | 발생 조건 | 포트 | 분류 |
|------|-----------|------|------|
| `LLM_CALL_FAILED` | provider 네트워크 / 타임아웃 / 5xx / 기타 throw | `error` | runtime — single 즉시 / multi 는 `result` 병존 |
| `LLM_RATE_LIMIT` | 429 (provider 가 별도 분류 시) | `error` | runtime |
| `LLM_RESPONSE_INVALID` | single-turn JSON 파싱이 모든 재시도(기본 3 attempt) 실패 | `error` | runtime |
| `MAX_COLLECTION_RETRIES_EXCEEDED` | multi-turn `collectionRetryCount > maxCollectionRetries` 초과 | `error` | runtime — `result` 와 병존 (§5.6 max_retries) |

Pre-flight 검증 (CONVENTIONS Principle 3.1 — throw):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `model` & `llmConfigId` 모두 누락 | `LLM provider or model must be selected (auto-handled by the canvas when a workspace default provider is configured).` ([AI_NO_LLM_PROVIDER_MESSAGE](../../../codebase/backend/src/nodes/ai/llm-provider-rule.ts)) | warningRule (캔버스 배지) + handler.validate |
| `outputSchema` 가 빈 배열 | `At least one extraction field must be defined.` | warningRule + handler.validate |
| `mode === 'single_turn'` 인데 `inputField` 가 비어있음 | `In Single Turn mode, Input Field must be entered.` | warningRule (캔버스 배지) |
| `outputSchema[i].name` / `outputSchema[i].type` 누락 | `Field {i+1}: name is required` / `type is required` | handler.validate |
| `mode === 'multi_turn'` 인데 `maxTurns` 가 음수 / 비숫자 | `maxTurns must be 0 (unlimited) or a positive integer` | handler.validate |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Info Extractor` 행 인용.

`{model} · {N} fields` (outputSchema 필드 수). `mode === 'multi_turn'` 이면 `Multi Turn` 접두어 추가.

- single 예: `claude-sonnet-4-6 · 4 fields`
- multi 예: `Multi Turn · claude-sonnet-4-6 · 4 fields`

## 8. Rationale

설계 결정의 SoT 는 다음 참조 (본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다):

- AI 카테고리 공통 규약: [공통 0-common.md](./0-common.md)
- 응답 wrapper / 토큰 회계 / Conversation Thread / System Context Prefix: [공통 §5](./0-common.md#5-응답-형식-규약-principle-11), [§6](./0-common.md#6-토큰-회계-meta), [§10](./0-common.md#10-conversation-context-자동-컨텍스트-주입), [§11](./0-common.md#11-ai-노드-시스템-프롬프트-자동-prefix-system-context-prefix)

`includeSystemContext` / `systemContextSections` config echo 는 default 값과 일치하면 생략한다 ([공통 §11.7](./0-common.md#117-config-echo)).

**알려진 결함 — 이연 (W-1)**: 본 노드는 config echo 를 `config.schema` 로 노출하지만 원본 config 필드명은 `outputSchema` 이다 ([CONVENTIONS Principle 7](../../conventions/node-output.md#principle-7--config-echo-원칙-nodehandleroutputconfig) — config echo 는 원본 필드명 그대로). doc 전반 ~15곳 + expression 접근 예에 걸쳐 있어 일괄 rename 은 후속 작업으로 이연한다.
