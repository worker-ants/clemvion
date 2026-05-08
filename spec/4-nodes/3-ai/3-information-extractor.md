# Spec: Information Extractor

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec LLM Config](../../2-navigation/6-config.md)

LLM을 사용하여 비정형 텍스트에서 구조화된 정보 추출.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정. [공통 §1](./0-common.md#1-llm-모델config-선택) |
| model | String | 모델 ID |
| inputField | Expression | 추출 대상 텍스트 필드 |
| outputSchema | FieldDef[] | 추출할 필드 정의 |
| examples | ExampleDef[] | Few-shot 예시 (선택) |
| instructions | String? | 추가 추출 지시사항 |
| mode | Enum | `single_turn` (기본) / `multi_turn`. multi-turn 차단 동작은 [공통 §4](./0-common.md#4-multi-turn-차단-모드) |
| maxTurns | Number? | `multi_turn`에서 최대 대화 턴 수. 0 = 제한 없음 (기본 10) |
| maxCollectionRetries | Number? | `multi_turn`에서 LLM이 `_missingFields: []`로 완료를 보고했지만 실제로 필수 필드가 비어 있을 때 재리포트를 요청하는 최대 횟수. 0 = 무제한 (기본 3). 초과 시 `error` 포트로 라우팅. "Retry Settings" 섹션에서 설정 |

> `multi_turn` 모드에서 사용자 응답은 무제한 대기합니다. (외부 cancel 외에는 타임아웃이 발생하지 않습니다.)

**FieldDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 필드 이름 |
| type | Enum | string / number / boolean / array / object |
| description | String | 필드 설명 (LLM에게 제공) |
| required | Boolean | 필수 여부. 설정 UI에서 체크박스로 토글 (기본 true) |
| enumValues | String[]? | 허용 값 목록 (있을 경우) |

**ExampleDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| input | String | 예시 입력 텍스트 |
| output | Object | 예시 추출 결과 |

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Information Extractor                   │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [Anthropic ▼]            │
│  Model:        [claude-sonnet-4-6 ▼]  │
│                                          │
│  Input: [{{ $input.emailBody }}]         │
│                                          │
│  ── Output Schema ──                     │
│  ┌──────────────────────────────────────┐│
│  │ senderName    String   ✅ Required   ││
│  │ "발신자 이름"                         ││
│  ├──────────────────────────────────────┤│
│  │ orderNumber   String   ✅ Required   ││
│  │ "주문 번호 (ORD-XXXXX 형식)"         ││
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
└──────────────────────────────────────────┘
```

## 3. 포트
- 입력: `in` (1개)
- 출력 (모드별 동적):
  - **single_turn**:
    - `out` (정적) — 정상 완료 시 (데이터 타입)
    - `error` (정적) — LLM API 오류, JSON 파싱 재시도 소진 시 (에러 타입)
  - **multi_turn**:
    - `completed` — 모든 필수 필드가 수집되어 자연 완료 (데이터 타입)
    - `user_ended` — 사용자가 대화 종료 (데이터 타입)
    - `max_turns` — `maxTurns` 도달 (데이터 타입)
    - `error` — LLM API 오류, 또는 `maxCollectionRetries` 초과 (`endReason: 'max_retries'`) (에러 타입)

## 4. 실행 로직

**Single Turn (기본)**
1. outputSchema를 JSON Schema로 변환
2. 추출 프롬프트 구성 (스키마 + 예시 + 지시사항)
3. LLM 호출 (JSON 응답 형식 강제) — LLM API 호출 실패 시 `error` 포트 + `output.error.code: 'LLM_CALL_FAILED'`
4. 응답 파싱 및 스키마 검증
5. 검증 통과 시 추출 결과를 `output.result.extracted` 에 담고 `out` 포트로 라우팅
6. 검증 실패 시 재시도 (최대 2회). 재시도 소진 시 `error` 포트 + `output.error.code: 'LLM_RESPONSE_INVALID'`

**Multi Turn**
1. `inputField`가 비어있으면 LLM을 호출하지 않고 system prompt만 준비한 뒤 바로 사용자 입력을 대기(`turnCount: 0`). 값이 있으면 그 값을 첫 user 메시지로 LLM에 전달한다. 설정 UI는 `multi_turn`일 때 Input Field 항목을 숨겨 이 UX를 강제한다.
2. LLM은 `finalize_extraction` 도구를 호출해 수집이 완료되었음을 알리거나, content-only 응답으로 후속 질문을 제시한다. 도구 인자에는 스키마에 정의된 모든 추출 필드가 포함되어야 한다.
3. 도구 인자를 파싱하여 `partialResult`에 누적. LLM이 `null`을 반환한 필드는 기존 값을 보존.
4. **재수집 판정**: 도구 호출이 왔지만 실제로 required 필드가 비어 있는 경우:
   - `collectionRetryCount`를 1 증가시키고, `tool` role 의 피드백 메시지를 대화 스레드에 append 하여 누락 필드를 알린다
   - 동일 턴 내에서 LLM을 다시 호출 (재시도 루프). 각 iteration 의 LLM 트레이스는 `meta.turnDebug[turnIndex].llmCalls` 에 누적
   - `maxCollectionRetries`(0 제외)를 초과하면 **error 포트** + `output.error.code: 'MAX_COLLECTION_RETRIES_EXCEEDED'`
5. 종료 조건 평가:
   - 모든 `required: true` 필드가 채워졌으면 → `completed` 포트 (`endReason: 'completed'`)
   - `turnCount >= maxTurns` (0이 아닐 때) → `max_turns` 포트 (`endReason: 'max_turns'`)
   - 사용자가 대화 종료 → `user_ended` 포트 (`endReason: 'user_ended'`)
   - 재수집 한도 초과 → `error` 포트 (`endReason: 'max_retries'`)
6. 종료 조건을 만족하지 않으면 `status: 'waiting_for_input'` 반환. waiting 시 `output` 에는 런타임 계산 값만 담는다 (Principle 1.1): `messages` 와 `partial.{extracted, missingFields, collectionRetryCount}`. `maxTurns` / `maxCollectionRetries` / `schema` 등 리터럴 설정값은 `output` 에 echo 하지 않으며 후속 노드 / UI 는 `$node["X"].config.*` 를 참조한다.
7. 프론트엔드는 AI Agent multi-turn과 동일한 `ConversationInspector` UI로 대화를 렌더하고, Output 탭에서 `ExtractedFieldsCard`로 수집된 필드를 구조화해 보여준다.

## 5. 출력 구조 (Principle 11 포맷)

LLM 3 노드는 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 를 공유한다 ([공통 §5](./0-common.md#5-응답-형식-규약-principle-11)). Information Extractor 의 **결과 wrapper 1차 필드**:

| 필드 | 위치 | 설명 |
| --- | --- | --- |
| `output.result.extracted` | 성공 | schema 에 정의된 모든 필드. 미수집 required 필드는 `null` |
| `output.result.endReason` | 성공 | `'out'`(single) / `'completed'`(multi) / `'user_ended'` / `'max_turns'` |
| `output.result.turnCount` | 성공 | single 은 항상 1, multi 는 실제 진행한 턴 수 |
| `output.result.messages` | 성공 (multi) | 누적 대화 스냅샷 |
| `output.result.originalInput` | 성공 (single) | LLM 에 투입된 실제 입력 |
| `output.error.code` | 에러 | `LLM_CALL_FAILED` / `LLM_RATE_LIMITED` / `LLM_RESPONSE_INVALID` / `MAX_COLLECTION_RETRIES_EXCEEDED` |
| `output.error.message` | 에러 | 사람이 읽는 원문 메시지 |
| `output.error.details` | 에러? | 노드별 부가 정보 (attempts, originalInput, missingFields 등) |
| `meta.durationMs` | 필수 | 실행 소요 시간 |
| `meta.{model, inputTokens, outputTokens, totalTokens, thinkingTokens}` | 필수 | 모델 / 토큰 사용량 |
| `meta.collectionRetryCount` | multi | 재수집 누적 횟수 |
| `meta.turnDebug` | 필수 | `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics? }, ...]` 디버그 트레이스. `toolCalls` 는 해당 턴에서 실행된 provider tool 의 status / durationMs / error 메타, `ragSources` / `ragDiagnostics` 는 해당 턴에서 호출된 KB tool 결과 delta — 노드 전체 누적은 `meta.ragSources` / `meta.ragDiagnostics` 를 사용 |

> 멀티턴에서 `max_retries` 로 종료 시에는 `output.error` 와 `output.result` 가 **병존**한다. 에러지만 부분 수집 결과가 있어 후속 노드가 활용할 수 있도록 둘 다 보존한다. `output.error` 존재 여부로 에러/정상을 판단한다.

### 5.1 Case: Single Turn 성공

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
    ]
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
    "turnDebug": [{ "turnIndex": 1, "llmCalls": [/* … */], "totalDurationMs": 810 }]
  },
  "port": "out",
  "status": "ended"
}
```

### 5.2 Case: Multi Turn 완료 (`completed`)

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxTurns": 10, "maxCollectionRetries": 3 },
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

### 5.3 Case: Multi Turn 대기 (`waiting_for_input`)

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxTurns": 10, "maxCollectionRetries": 3 },
  "output": {
    "messages": [{ "role": "assistant", "content": "주문번호를 알려주세요" }],
    "partial": {
      "extracted": { "senderName": "김철수", "orderNumber": null, "issueType": null, "amount": null },
      "missingFields": ["orderNumber", "issueType"],
      "collectionRetryCount": 0
    }
  },
  "meta": {
    "durationMs": 1500,
    "model": "claude-sonnet-4-6",
    "inputTokens": 100,
    "outputTokens": 20,
    "totalTokens": 120,
    "thinkingTokens": 0,
    "turnDebug": [/* … */]
  },
  "status": "waiting_for_input"
}
```

> Waiting output 에는 런타임 값만 담는다 (Principle 1.1 / 4.3). `maxTurns`·`maxCollectionRetries`·`schema` 는 `config.*` 에서 읽는다. 노드 판별용 `type` / `interactionType` / `view` 래퍼는 사용하지 않는다 (Principle 1.1.4).

### 5.4 Case: Multi Turn 재개 (`resumed`, Stage 2 에서 구현)

사용자 메시지 수신 직후 종료 조건에 미도달 시 1회 emit 되는 observability-only 스냅샷. Stage 2 의 공통 resume 컨트랙트에서 도입된다.

```json
{
  "output": {
    "messages": [/* 사용자 메시지 append 직후 누적 */],
    "partial": { /* 직전 대기 시점 스냅샷 */ },
    "interaction": {
      "type": "message_received",
      "data": { "content": "ORD-12345 입니다", "role": "user" },
      "receivedAt": "2026-04-19T06:45:12.480Z"
    }
  },
  "status": "resumed"
}
```

### 5.5 Case: Single Turn 에러 (LLM 호출/파싱 실패)

```json
{
  "config": { "mode": "single_turn", "schema": [...] },
  "output": {
    "error": {
      "code": "LLM_RESPONSE_INVALID",
      "message": "Failed to parse JSON after 3 attempts",
      "details": {
        "attempts": 3,
        "originalInput": "환불 요청합니다…",
        "lastResponse": "…"
      }
    }
  },
  "meta": {
    "durationMs": 3200,
    "model": "claude-sonnet-4-6",
    "turnDebug": [/* … */]
  },
  "port": "error",
  "status": "ended"
}
```

### 5.6 Case: Multi Turn 에러 (`max_retries`)

```json
{
  "config": { "mode": "multi_turn", "schema": [...], "maxCollectionRetries": 3 },
  "output": {
    "error": {
      "code": "MAX_COLLECTION_RETRIES_EXCEEDED",
      "message": "LLM attempted finalize_extraction 3 times with missing required fields",
      "details": {
        "extracted": { "senderName": "김철수", "orderNumber": null },
        "missingFields": ["orderNumber"],
        "turnCount": 3,
        "collectionRetryCount": 3
      }
    },
    "result": {
      "extracted": { "senderName": "김철수", "orderNumber": null },
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
    "collectionRetryCount": 3,
    "turnDebug": [/* … */]
  },
  "port": "error",
  "status": "ended"
}
```

다운스트림 노드는 `$node["Info Extractor"].output.result.extracted.<필드명>` 으로 추출 결과에 접근하고, `$node["Info Extractor"].output.error?.code` 로 에러 분기를 수행한다.
