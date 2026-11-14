---
id: "CLE-NODE-AGENT-OUTPUT-DEBUG"
title: "AI 에이전트 노드 출력 — 표시물과 LLM 호출 기록"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-AGENT-OUTPUT"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-AI", "CLE-NODE-AGENT-OUTPUT"]
area: "CLE-NODE-AI"
content_hash: "843e0174cc8dbc57af903b7f75409618cefc54847b0af65cf9d6253bd19d2cd6"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "46959fdb0566c1396507e2f84a6b7ab8a0f6d71e3c7f2a6e26f7765c7d7102e7"
etag: "sha256-6a8508a6820c3a10e0335fcc27088d715a9b8cefcf2cf55e06f3126da7801f9c"
---
## 개요

이 문서는 [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md) 의 하위 문서로 표시 도구 페이로드 운반과 턴별 LLM 호출 기록(`meta.turnDebug`)을 정한다.

## 표시물 페이로드 운반

`presentationTools` 가 설정되고 LLM 이 표시 도구를 부른 턴에서 나오는 페이로드 구조다. 표시 도구 호출이 성공한 턴에서는 해당 `ai_assistant` 대화 기록 항목의 최상위 `presentations[]` 에 페이로드가 쌓이고, WebSocket `execution.ai_message` 누적 스냅샷에도 같은 구조가 나온다. 어떤 종결 케이스에서도(단일 턴·멀티턴 무관) 같게 나오며, 대화 기록 항목의 최상위 `presentations[]` 한 경로로 운반한다. `data?` 필드 안이 아니다. `data?` 는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 의 `interaction.data` 스냅샷 단일 기준이라 뜻이 다른 데이터를 넣지 않는다.

**PresentationPayload 타입 (단일 기준)**

```ts
type PresentationPayload = {
  type: 'table' | 'chart' | 'carousel' | 'template' | 'form';
  toolCallId: string;               // LLM 의 tool_use block id — meta.presentationCalls[] 와 join key
  renderedAt: string;               // ISO 8601 UTC — server side timestamp
  payload: object;                  // 해당 presentation 노드 input schema 와 동일 shape (defaults overlay 후 최종값)
  truncation?: {                    // Carousel/Table 의 tail truncate 적용 시에만 set
    itemsTruncated?: boolean;
    rowsTruncated?: boolean;
    itemsTotalCount?: number;
    rowsTotalCount?: number;
  };
};
```

이 타입의 단일 기준 정의는 이 절이다. [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 는 교차 참조만 둔다.

```json
{
  "config": { "...": "(다른 케이스와 같음)" },
  "output": {
    "result": {
      "response": "비교 결과 표로 정리했어요. 영업이익률이 가장 높은 분기는 Q3 입니다.",
      "endReason": "out",
      "turnCount": 1,
      "presentations": [
        { "type": "table", "toolCallId": "call_t1", "renderedAt": "2026-05-22T03:00:00.000Z", "payload": { "...": "(table input schema 동일 shape)" } },
        { "type": "chart", "toolCallId": "call_c1", "renderedAt": "2026-05-22T03:00:00.500Z", "payload": { "...": "(chart input schema 동일 shape)" } }
      ]
    }
  },
  "meta": {
    "...": "(다른 케이스의 일반 메타)",
    "presentationCalls": [
      { "toolName": "render_table", "toolCallId": "call_t1", "status": "rendered", "bytes": 4823 },
      { "toolName": "render_chart", "toolCallId": "call_c1", "status": "rendered", "bytes": 12039 }
    ]
  },
  "port": "out",
  "status": "ended"
}
```

| 필드 | 타입 | 위치 | 설명 |
|---|---|---|---|
| `output.result.response` | string | 핸들러 반환 | LLM 텍스트 응답. 표시 도구 호출이 있어도 비어 있을 수 있다(예: 차트만 냄). 비면 `response: ""` |
| `output.result.presentations[]` | `PresentationPayload[]?` | 핸들러 반환 | 실행 내역 화면 복원용 에코. 종결 출력에 `metadata.allPresentations` 가 있을 때만 싣고, 없으면 키 자체를 뺀다. 단일 턴 정상 완료(위 예시), 멀티턴 종결(`buildMultiTurnFinalOutput`), 조건 출력(`buildConditionOutput`)이 모두 싣는다. |
| `meta.presentationCalls[]` | Array | 핸들러 누적 | 표시 도구 호출 기록. `[{ toolName, toolCallId, status: 'rendered' \| 'schema_violation' \| 'dropped' \| 'form_pending' \| 'form_submitted', bytes? }]` (Principle 2 메트릭) |
| `meta.presentationSchemaViolations[]` | Array? | 핸들러 누적 | 스키마 위반으로 조용히 버린 경우만 싣는다. `[{ toolName, toolCallId, issues, attempts }]` |
| 대화 기록 항목 `presentations[]` | `PresentationPayload[]` | 스레드 누적(1차 단일 기준) | 최상위 독립 필드이며 `data?` 가 아니다. 실제 페이로드 |

**복원용 에코**: 페이로드 본문의 1차 단일 기준은 대화 기록 항목의 최상위 `presentations[]` 다. 그래도 `output.result.presentations[]` 에 같은 데이터를 에코한다. 라이브 스레드 스냅샷을 싣지 않는 REST 경로(`/executions/:id` → NodeExecution.outputData)에서 실행 내역 화면이 페이로드를 복원하려면 NodeExecution 행 안에 데이터가 있어야 하기 때문이다. 스레드는 영속 때 NodeExecution 에 나눠 저장돼 복원할 수는 있지만 노드 간 조회가 N+1 이라 비용이 크다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). 두 위치는 의도한 에코이며 Principle 1.1 직교성의 예외다. 백엔드는 한 누적기(`metadata.allPresentations`)에서 두 표면으로 함께 넣어 어긋남을 막는다. `meta.presentationCalls[]` 는 기록·메트릭만이며 이 에코와 무관하다.

**다운스트림 접근**

- `$thread.turns` 에서 `source === 'ai_assistant'` 인 턴의 `presentations` 로 접근한다.
- 보통은 `output.result.response` 텍스트만 보면 된다. 후속 노드(예: Send Email)가 페이로드를 직접 다루려면 스레드 접근이 1차다.

**`render_form` 의 멀티턴 운반**: `render_form` 이 불린 턴은 입력 대기 형식을 따르되 `output.interaction` 이 폼 미리보기를 싣고 `_resumeState.pendingFormToolCall.toolCallId` 가 설정된다. 사용자가 제출하면 재개 스냅샷이 `output.interaction.{type:'form_submitted', data, receivedAt}` 로 나오고, 다음 턴의 대화 기록 항목에 `source: 'presentation_user'` 누적이 일어난다(`ai_user` 가 아님).

## LLM 호출 기록 (`meta.turnDebug`)

실행 결과의 `meta.turnDebug` 배열에 들어가는 턴별 LLM 호출 기록이다. 프런트엔드 대화 인스펙터와 실행 상세의 Response·Request·LLM Usage 탭이 각 LLM 호출의 요청·응답·토큰 사용량을 보여 줄 때 쓴다. 탭 구성은 [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md) 이 정한다.

```json
"meta": {
  "turnDebug": [
    {
      "turnIndex": 1,
      "llmCalls": [
        {
          "requestPayload": { "model": "gpt-4o", "messages": [], "tools": [] },
          "responsePayload": { "model": "gpt-4o", "usage": { "inputTokens": 500, "outputTokens": 120 }, "toolCalls": [] },
          "durationMs": 1250
        },
        {
          "requestPayload": { "...tool result 포함...": "..." },
          "responsePayload": { "...최종 응답...": "..." },
          "durationMs": 800
        }
      ],
      "totalDurationMs": 2050,
      "toolCalls": [
        {
          "toolCallId": "call_abc123",
          "name": "kb_workspace_main",
          "providerKey": "kb",
          "status": "success",
          "durationMs": 1240
        }
      ],
      "ragSources": [
        { "documentId": "uuid", "chunkId": "uuid", "documentName": "Refund Policy", "content": "14-day refund window…", "score": 0.92 }
      ],
      "ragDiagnostics": {
        "attempted": true,
        "searchedKbCount": 1,
        "queriesUsed": ["refund window"],
        "resultCount": 1
      }
    }
  ]
}
```

- 한 턴에서 function calling 이 일어나면 `llmCalls` 에 항목이 여러 개 생긴다. 항목 하나가 LLM API 호출 하나다.
- 프런트엔드는 각 assistant 메시지를 그 턴의 N번째 LLM 호출과 짝지어 디버그 정보를 보여 준다.
- 실행 결과에 늘 들어간다. 워크플로우 소유자만 실행 결과를 조회할 수 있어 따로 접근 제어를 두지 않는다.
- `requestPayload` 에 시스템 프롬프트와 전체 대화 이력이 들어갈 수 있다. 자격 증명은 나가는 응답(REST·WS)에서 자동으로 마스킹한다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)). DB 와 표현식에는 원문이 남는다.
- 각 턴 항목의 `ragSources` 는 그 턴에 부른 지식 저장소 도구의 청크 delta, `ragDiagnostics` 는 그 턴 한정 진단이다. 노드 전체 누적은 `meta.ragSources`·`meta.ragDiagnostics` 이며 턴 delta 의 합이 전체 누적과 같다.
- MCP 도구를 부른 턴에는 같은 delta·누적 관계로 `mcpDiagnostics` 도 턴 단위로 싣는다. 노드 전체 누적은 `meta.mcpDiagnostics` 다.
- `toolCalls`(선택)는 그 턴에 실행한 provider 도구(지식 저장소·MCP)별 기록 `{ toolCallId, name, providerKey, status: 'success' | 'error', durationMs, startedAt?, finishedAt?, error? }` 다. `startedAt?`·`finishedAt?` 는 도구 실행 시작·종료 절대 시각(ISO8601, 둘 다 선택)이다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 과 맞춤). 타입 단일 기준은 `ai-agent/ai-turn-executor.ts` 의 `interface ToolCallTrace` 다. 조건 도구와 일반 도구 stub 은 바로 결과를 만들어 넣지 않는다. provider 가 예외를 던져도 핸들러가 받아 `'error'` 로 표시하고, LLM 에는 정리한 에러 내용을 그대로 넘기며 턴은 계속한다. 대화 인스펙터 도구 항목의 성공·에러 배지의 권위 출처이며, WS `execution.tool_call_started`·`execution.tool_call_completed` 가 유실돼도 클라이언트는 이 데이터로 복구한다.
- 멀티턴의 `turnDebugHistory` 는 최근 `MAX_TURN_DEBUG_HISTORY = 50` 턴만 둔다(DB JSONB 비대화 방지).
- 공통 타입: 각 `llmCalls[]` 항목은 공통 `LlmCallRecord`(`codebase/backend/src/shared/llm-tracing/llm-call-record.ts`, AI 에이전트와 정보 추출기 공유)다. `requestPayload`·`responsePayload`·`durationMs` 외에 `startedAt?`·`finishedAt?`(ISO 8601 wall-clock)도 가질 수 있고 모든 필드가 선택이다. 턴 항목은 기본 `TurnDebugEntry`(`{ turnIndex, llmCalls?, totalDurationMs? }`)에 진단 delta(`toolCalls?`·`ragSources?`·`ragDiagnostics?`·`mcpDiagnostics?`)를 더한 상위 집합이다([AI 노드 공통](CLE-NODE-AI-COMMON.md)).
