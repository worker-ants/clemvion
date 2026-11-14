---
id: "CLE-NODE-EXTRACTOR-OUTPUT"
title: "정보 추출기 노드 — 출력 구조와 에러"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-EXTRACTOR"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-EXTRACTOR"]
area: "CLE-NODE-AI"
content_hash: "a2a238528fbd4ea4f935da185656e1b6de60c633635aa602d0931e195ab2f3d3"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "0f0f39b405a91c21ccd94f524b23257693e8d9ce972efc06f5f9f09bf3a2cbd2"
etag: "sha256-6058be0eeb6ee99e5e9d1bebd2b4df68ff7cd283f10716a885dd239199721fcd"
---
## 개요

이 문서는 [정보 추출기 노드](CLE-NODE-EXTRACTOR.md) 의 하위 문서로 케이스별 출력 구조, 설정 에코, 에러 코드를 정한다. 실행 전 검증은 부모 문서가 정한다. 각 출력이 나오는 실행 흐름은 [실행 로직과 메모리](CLE-NODE-EXTRACTOR-EXEC.md) 가 정한다.

## 출력 구조

출력은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 11 형식을 따른다. JSON 예시는 `undefined` 필드를 빼고 최상위 키는 5필드만 쓴다. 멀티턴 입력 대기·재개는 Principle 4 에 따라 내부 `_resumeState` 를 함께 싣고 표현식 계층에는 노출하지 않는다. 옛 `output.output.extracted.*` 이중 중첩 형식은 폐기했다(Principle 8).

**설정 에코 정책** (Principle 7): 모든 종결·입력 대기·재개 시점에서 `config` 는 사용자가 입력한 원본 값(`{{ ... }}` 보존)을 에코한다. 멀티턴 재개 턴에서는 엔진이 `state.rawConfig` 로 같은 원본을 운반한다. 고정 범위는 한 턴이고, 매 턴 재개 때 현재 `node.config` 에서 새로 유도해 다시 고정한다(D3 fresh-per-turn, [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md)). 후속 노드는 `$node["X"].config.{mode, model, schema, instructions, examples, inputField, maxTurns, maxCollectionRetries}` 로 원본을 읽고, 평가된 모델 ID 는 `meta.model` 에서 읽는다. 출력 스키마는 원본 필드명 `outputSchema` 가 아니라 `schema` 키로 에코된다. 정의가 갈린다. [미결 사항](CLE-NODE-EXTRACTOR.md#미결-사항) 참조. `includeSystemContext`·`systemContextSections` 는 기본값과 같으면 뺀다.

| 케이스 | 포트 | status |
|------|------|------|
| 단일 턴 정상 | `out` | `ended` |
| 에러(단일 턴·멀티턴 LLM 실패) | `error` | `ended` |
| 멀티턴 입력 대기 | 없음 | `waiting_for_input` |
| 멀티턴 재개 | 없음 | `resumed`(일시) |
| 멀티턴 종결 4종 | `completed` / `user_ended` / `max_turns` / `error`(`max_retries`) | `ended` |
| 노드 취소 | 없음 | - |

노드 취소는 출력을 내지 않는다. 엔진이 노드 실행을 `cancelled` 로 기록하고 출력을 쓰지 않으므로 `output.error` · `output.result` 가 모두 없다([노드 취소 신호 처리](CLE-NODE-EXTRACTOR-EXEC.md#노드-취소-신호-처리)).

### 단일 턴 정상 (`out`)

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
| `config.mode` | `'single_turn'` | 설정 에코 | 실행 모드 |
| `config.model` | string | 설정 에코(원본) | `{{ }}` 보존. 평가 값은 `meta.model` |
| `config.schema` | FieldDef[] | 설정 에코(= 원본 `outputSchema`) | 추출 스키마 원본 |
| `config.instructions`·`config.examples`·`config.inputField` | | 설정 에코(원본) | |
| `output.result.extracted` | `Record<string, unknown>` | 핸들러 | LLM 이 추출한 필드. 출력 스키마 전 필드를 담고 미수집은 `null` |
| `output.result.endReason` | `'out'` | 핸들러 | 단일 턴 정상 종료 사유. 종료 사유 패키지 밖 값이다([인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md)) |
| `output.result.turnCount` | number | 핸들러 | 단일 턴은 늘 `1` |
| `output.result.originalInput` | string | 핸들러 | LLM 에 넣은 실제 입력 |
| `meta.durationMs` | number | 핸들러·엔진 | 총 실행 시간(ms) |
| `meta.model` | string | LLM 응답 | 실제 모델 ID |
| `meta.{inputTokens, outputTokens, totalTokens, thinkingTokens}` | number | LLM 사용량 | 토큰 회계([AI 노드 공통](CLE-NODE-AI-COMMON.md)) |
| `meta.turnDebug` | Array | 핸들러 | 턴별 LLM 호출 기록(단일 턴은 1항목). 필드 의미는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) |
| `meta.contextInjection` | object? | 핸들러 | `contextScope ≠ 'none'` 이고 스레드가 비지 않았을 때만. `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }`. 적용 결과이지 설정 에코가 아니다 |
| `port` | `'out'` | 핸들러 | |
| `status` | `'ended'` | 핸들러 | |

표현식 접근 예: `$node["X"].output.result.extracted.senderName` → `"김철수"`, `$node["X"].output.result.extracted.amount` → `29900` 또는 `null`, `$node["X"].config.schema` → 원본 출력 스키마, `$node["X"].port` → `"out"`.

### 에러 (`error`)

단일 턴 LLM 호출 실패·JSON 파싱 재시도 소진, 멀티턴 LLM 호출 실패가 모두 이 포트로 간다(`max_retries` 는 종결 절). 멀티턴 대화 중 실패하면 `output.error` 와 함께 `output.result` 가 부분 수집 결과로 남는다. 노드 취소 신호가 켜진 뒤 실패한 LLM 호출은 이 포트로 오지 않는다.

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
        "retryable": false,
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
| `output.error.code` | string | 핸들러 | 에러 코드 표 참조 |
| `output.error.message` | string | 핸들러 | 사람이 읽는 원문 메시지(국제화 없음) |
| `output.error.details.retryable` | boolean | 핸들러 | 모든 에러 경로가 `retryabilityDetails` 헬퍼(`buildErrorOutput`)로 채운다. 원문 불변식은 `LLM_CALL_FAILED`·`LLM_RATE_LIMIT` 은 `true`, `LLM_RESPONSE_INVALID`·`MAX_COLLECTION_RETRIES_EXCEEDED` 는 `false` 다. 인증 실패(401·403)도 `true` 가 되어 다른 노드와 정의가 갈린다. [미결 사항](CLE-NODE-EXTRACTOR.md#미결-사항) 참조 |
| `output.error.details.retryAfterSec` | number? | 핸들러 | provider 신호가 있을 때 권장 대기(초). `retryable === true` 일 때만 |
| `output.error.details`(기타) | object? | 핸들러 | `attempts`·`originalInput`·`lastResponse`·`turnCount`·`collectionRetryCount` 등 |
| `output.result` | object? | 핸들러 | 멀티턴 `LLM_CALL_FAILED` 한정. `extracted`·`endReason: 'error'`·`turnCount`·`messages` 부분 결과. 노드 취소로 끝난 멀티턴에는 출력 자체가 없다 |
| `meta.durationMs` | number | 핸들러·엔진 | 실행 시간 |
| `meta.model` | string? | LLM 응답 | 호출이 일부라도 성공했을 때만. 공통 규약과 다르다([AI 노드 공통](CLE-NODE-AI-COMMON.md) 미결 사항) |
| `meta.collectionRetryCount` | number? | 핸들러 | 멀티턴 에러 때 누적값 |
| `meta.turnDebug` | Array | 핸들러 | 턴별 기록 |
| `port` | `'error'` | 핸들러 | |
| `status` | `'ended'` | 핸들러 | |

후속 노드는 `output.error` 가 있는지로 판단하고 부분 결과는 `output.result.extracted` 에서 가져온다. 표현식 접근 예: `$node["X"].output.error.code`, `$node["X"].output.error.details.originalInput`, `$node["X"].output.result?.extracted`(단일 턴 에러면 `undefined`).

정보 추출기는 마지막 턴 재시도(`execution.retry_last_turn`)를 지원하지 않는다. 재시도 가능 에러여도 `_retryState` 를 만들지 않으므로 실패 사용자 메시지(`failedUserMessage`)도 담지 않는다(근거: `information-extractor.handler.ts` 주석). 화면은 실시간 `system_error` 를 `ai_agent` 에만 붙이므로 [다시 시도] 버튼이 보이지 않는다([대화 미리보기 §다시 시도 버튼 조건](../CLE-EXEC/CLE-EXEC-PREVIEW.md#다시-시도-버튼-조건)). 이 상태가 버튼 노출 규약과 어긋나는 문제는 [미결 사항](CLE-NODE-EXTRACTOR.md#미결-사항), [노드 출력 규약 미결 사항](../CLE-NODE/CLE-NODE-OUTPUT.md#미결-사항) 참조.

### 멀티턴 입력 대기 (`status: 'waiting_for_input'`)

핸들러가 `output: { result: {...}, partial?: {...} }` 와 내부 `_resumeState` 를 돌려주고 엔진이 실행을 멈춘 상태다. `output.result.*` 에는 이 턴 시점의 대화 스냅샷(`messages`·`message`·`turnCount`)이 AI 에이전트와 같은 경로로, `output.partial.*` 에는 부분 수집 진행 상태가 들어간다. 리터럴 설정(`maxTurns` 등)은 출력에 에코하지 않고 화면과 후속 노드는 `$node["X"].config.*` 를 직접 읽는다(Principle 1.1).

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
| `config.schema`·`config.mode`·`config.maxCollectionRetries` | | 설정 에코 | `maxCollectionRetries` 는 대기 화면 진행률 표시용(`output.partial.collectionRetryCount` 와 비교) |
| `output.result.messages` | `ChatMessage[]` | 핸들러 | 누적 대화(system 제외, user·assistant·tool). AI 에이전트와 같은 구조 |
| `output.result.message` | string | 핸들러 | 가장 최근 assistant 후속 질문 |
| `output.result.turnCount` | number | 핸들러 | 지금까지 진행한 턴 수. 분모 `maxTurns` 는 `config.maxTurns` 에서 읽는다 |
| `output.partial.extracted` | `Record<string, unknown>` | 핸들러 | 스키마 전 필드 기준 현재 스냅샷. 미수집은 `null` |
| `output.partial.missingFields` | `string[]` | 핸들러 | 아직 채우지 않은 필수 필드 이름 |
| `output.partial.collectionRetryCount` | number | 핸들러 | 누적 재질의 횟수 |
| `meta.interactionType` | `'ai_conversation'` | 핸들러 | 엔진 WS 페이로드 분류용. 종결 때는 쓰지 않는다 |
| `status` | `'waiting_for_input'` | 핸들러 | 엔진 일시 정지 계기 |
| `_resumeState` | object | 핸들러 내부 | 다음 턴 처리용 내부 상태. 표현식 계층에 노출하지 않고 DB 저장 때 지운다. `_resumeCheckpoint` 기반 턴 재개를 쓴다(턴 단위 park, 재시작·다른 인스턴스 포함, [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)). 자격 증명을 뺀 부분집합(고유 상태 `partialResult`·`collectionRetryCount` 포함)을 `NodeExecution.outputData._resumeCheckpoint` 에 영속한다. 재개 때 조작 필드(`outputSchema`·`examples`·`instructions`·`maxCollectionRetries`)는 `node.config` 에서, 식별 필드(`workflowId`·`nodeExecutionId`)는 호출 측 컨텍스트에서 다시 유도한다. 식별 필드는 재개 턴 `llmContext` 로 쓰여 `llm_usage_log` 귀속을 성립시킨다. provider 도구가 없는 정보 추출기의 유일한 귀속 경로다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md)). checkpoint 가 없거나 손상되거나 미래 버전일 때만 초기화한다(`RESUME_INCOMPATIBLE_STATE`) |

`meta.contextInjection` 은 대기 · 재개 스냅샷에 일부러 싣지 않는다. 첫 진입 때 주입한 결과는 `state.contextInjection` 으로 운반해 종결 출력에서만 에코한다(`buildWaitingOutput` 은 `meta.interactionType` 만 낸다).

표현식 접근 예: `$node["X"].output.result.messages[-1].content`, `$node["X"].output.partial.missingFields`, `$node["X"].config.maxTurns`, `$node["X"].status` → `"waiting_for_input"`.

### 멀티턴 재개 (`status: 'resumed'`)

사용자 메시지를 받으면 엔진이 다음 턴 LLM 호출 전에 한 번 내는 관찰 전용 스냅샷이다. 연결선 라우팅은 없다. LLM 응답이 오면 대기나 종결 출력이 이 스냅샷을 덮는다. 저장 범위와 만드는 규칙은 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 의 재개 절과 같다.

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
| `config.*` | | 설정 에코 | 대기 시점과 같은 원본 |
| `output.result.messages` | `ChatMessage[]` | 엔진 | 직전 대기의 누적 대화(system 제외) 끝에 사용자 메시지를 더한 값 |
| `output.partial` | object | 엔진 | 직전 대기 값을 그대로 잇는다(새 LLM 결과가 아직 없음) |
| `output.interaction.type` | `'message_received'` | 엔진 | 재개 계기 종류([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 4.5). 핸들러는 `waiting_for_input` 만 내고 `output.interaction.*` 와 `status: 'resumed'` 는 엔진이 넣는다 |
| `output.interaction.data.content` | string | 엔진 | 사용자 메시지 |
| `output.interaction.data.role` | `'user'` | 엔진 | 고정 |
| `output.interaction.receivedAt` | ISO8601 string | 엔진 | 수신 시각. 같은 턴 `execution.user_message` 의 `receivedAt` 과 같다 |
| `meta.durationMs` | number | 엔진 | 늘 `0`. LLM 호출 전에 내기 때문이다 |
| `meta.interactionType` | `'ai_conversation'` | 엔진 | 늘 `'ai_conversation'` 이다. 대기·재개 공통 분류 |
| `status` | `'resumed'` | 엔진 | 관찰용 일시 표지 |
| `_resumeState` | object | 엔진 | 다음 턴 처리용 내부 상태. 저장본에는 싣지 않는다 |

표현식 접근 예: `$node["X"].output.interaction.data.content`, `$node["X"].output.interaction.receivedAt`, `$node["X"].status` → `"resumed"`.

### 멀티턴 종결 4종

종료 사유 값 목록의 단일 기준은 패키지 `@workflow/ai-end-reason` 의 `InformationExtractorEndReason` 이다([인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md)). 이 문서는 값의 뜻과 포트 매핑을 정하고 값 목록은 패키지가 정한다. 값을 더하거나 빼려면 패키지 유니온을 고친다(프런트엔드가 목록을 손으로 베끼면 어긋날 때 대화 미리보기가 사라진다).

유니온 6값 중 이 절은 4값(`completed`·`user_ended`·`max_turns`·`max_retries`)을 다룬다. `error` 는 에러 절에서 다룬다. `timeout` 은 유니온에 선언만 있고 만드는 곳이 없는 휴면 값이다(`portForEndReason` 에 case 도 없어 기본값 `error` 로 간다). 휴면이어도 선언된 이상 대화 UI 허용 목록에는 들어간다(살아나는 순간 미리보기가 사라지지 않게). 단일 턴 `endReason: "out"` 은 AI 에이전트와 같은 이유로 패키지 밖이다.

공통 형태(`endReason`·`port`·`status` 만 다르다):

```jsonc
{
  "config": { /* multiTurnConfigEcho — 원본 mode/model/schema/instructions/examples/inputField/maxTurns/maxCollectionRetries */ },
  "output": {
    "result": {
      "extracted": { /* 출력 스키마 전 필드, 미수집은 null */ },
      "endReason": "<completed|user_ended|max_turns|max_retries>",
      "turnCount": <number>,
      "messages": [/* 누적 대화 */]
    }
    // max_retries 는 output.error 가 result 와 함께 있다
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

| 종료 사유 | port | 뜻 | 예시 값 |
|------|------|------|------|
| `completed` | `completed` | 필수 필드를 모두 채워 `finalize_extraction` 이 성공한 자연 완료 | `extracted` 전 필드 채움, `turnCount: 2`, `collectionRetryCount: 0` |
| `user_ended` | `user_ended` | 사용자가 `execution.end_conversation` 으로 명시 종료. `extracted` 는 수집한 만큼만 남고 나머지는 `null` | `{ "senderName": "김철수", "orderNumber": null, "issueType": null, "amount": null }` |
| `max_turns` | `max_turns` | `turnCount >= maxTurns`(`maxTurns > 0`) 도달 | `turnCount: 5`, `collectionRetryCount: 1` |
| `max_retries` | `error` | `collectionRetryCount > maxCollectionRetries` 초과. `output.error` 와 `output.result` 가 함께 있다 | 아래 예시 |

`max_retries` 예시:

```json
{
  "config": { "mode": "multi_turn", "schema": [/* … */], "maxTurns": 10, "maxCollectionRetries": 3 },
  "output": {
    "error": {
      "code": "MAX_COLLECTION_RETRIES_EXCEEDED",
      "message": "LLM attempted finalize_extraction 4 times with missing required fields",
      "details": {
        "retryable": false,
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

**종결 공통 필드**

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | 원본 `multiTurnConfigEcho` | 설정 에코 | 엔진이 운반한 `state.rawConfig` 에서 에코 |
| `output.result.extracted` | `Record<string, unknown>` | 핸들러 | 스키마 전 필드, 미수집은 `null` |
| `output.result.endReason` | `'completed'` / `'user_ended'` / `'max_turns'` / `'max_retries'` | 핸들러 | 종료 사유 |
| `output.result.turnCount` | number | 핸들러 | 실제 진행 턴 수 |
| `output.result.messages` | `ChatMessage[]` | 핸들러 | 누적 대화 |
| `output.error` | object | 핸들러 | `max_retries` 한정. 멀티턴 `LLM_CALL_FAILED` 도 같은 형태(에러 절) |
| `meta.durationMs` | number | 핸들러·엔진 | 누적 실행 시간 |
| `meta.model` | string | 핸들러 | 사용한 모델 |
| `meta.{inputTokens, outputTokens, totalTokens, thinkingTokens}` | number | LLM 사용량 누적 | 턴별 합산 |
| `meta.collectionRetryCount` | number | 핸들러 | 재질의 누적 |
| `meta.turnDebug` | Array | 핸들러 | 턴별 LLM 호출 기록 |
| `meta.contextInjection` | object? | 핸들러 | `contextScope ≠ 'none'` 이고 스레드가 비지 않았을 때만. 첫 진입 때 한 번 주입한 결과를 상태로 운반해 종결 출력에 에코한다 |
| `port` | `'completed'` / `'user_ended'` / `'max_turns'` / `'error'` | 핸들러(`portForEndReason`) | 종료 사유 → 포트 |
| `status` | `'ended'` | 핸들러 | |

표현식 접근 예: `$node["X"].output.result.extracted.orderNumber`, `$node["X"].output.result.endReason`, `$node["X"].output.error?.code === "MAX_COLLECTION_RETRIES_EXCEEDED"`(max_retries 분기 판정), `$node["X"].port`, `$node["X"].meta.collectionRetryCount`.

## 에러 코드

`output.error.code` 예약어다(Principle 3.2 표준 형태 `{code, message, details?}`).

| code | 발생 조건 | 포트 | 분류 |
|------|-----------|------|------|
| `LLM_CALL_FAILED` | provider 네트워크·타임아웃·5xx·기타 예외. 노드 취소 신호가 켜진 뒤의 실패는 빠진다 | `error` | 실행 중. 단일 턴은 바로, 멀티턴은 `result` 와 함께 |
| `LLM_RATE_LIMIT` | 429(provider 가 따로 분류할 때) | `error` | 실행 중 |
| `LLM_RESPONSE_INVALID` | 단일 턴 JSON 파싱이 모든 재시도(기본 3회)에서 실패 | `error` | 실행 중 |
| `MAX_COLLECTION_RETRIES_EXCEEDED` | 멀티턴 `collectionRetryCount > maxCollectionRetries` | `error` | 실행 중. `result` 와 함께(`max_retries`) |

노드 취소는 이 표의 코드를 쓰지 않는다. 엔진이 `NodeExecution.error` 에 `{ code: 'AbortError', message }` 를 남긴다([노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md#취소-에러-분류) 규칙 19).

## Rationale

### 설정 에코 기본값 생략

`includeSystemContext`·`systemContextSections` 는 기본값과 같으면 설정 에코에서 뺀다([AI 노드 공통](CLE-NODE-AI-COMMON.md)).

### 재개 스냅샷을 구현하고 시점을 LLM 호출 전으로 고친다 (2026-11-12)

재개 스냅샷은 AI 에이전트와 같은 엔진 코드가 만든다. 결정과 근거는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) Rationale 의 2026-11-12 항목에 있다.

고치기 전의 재개 스냅샷 요구사항은 「종결 조건에 닿지 않으면 다음 `waiting_for_input` 직전에」 낸다고 적었다. 그 시점에는 LLM 응답이 이미 와 있어 대기 출력이 곧바로 덮으므로 사용자 입력을 받은 순간이 남지 않는다. 그래서 시점을 다음 턴 LLM 호출 전으로 고쳤다. 이 시점에는 종결 여부를 아직 모르므로 조건 구절도 뺐다.
