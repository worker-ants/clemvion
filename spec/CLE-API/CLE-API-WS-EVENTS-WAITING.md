---
id: "CLE-API-WS-EVENTS-WAITING"
title: "WebSocket 이벤트와 명령 — 입력 대기 이벤트"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-WS-EVENTS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-WS-EVENTS"]
area: "CLE-API"
content_hash: "caf9be2c62f662036326fe6289112d130a5b07b3a9f93c6c3c50e613ccc1ec37"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3692614414edc3aff8d8fa0dae3797c2667c1ff1c0be9eb06e20d983f80f998c"
etag: "sha256-5ff595744dbca3c4f395986db7f1624c9ee0bf488b572e00bc881e585662413a"
---
> 구현 상태: 구현됨 · 상위: [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)

## 개요

이 문서는 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 하위 문서로 입력 대기 이벤트 `execution.waiting_for_input` 의 대기 표면별 payload, wire 필드 주의, 대화 스레드 스냅샷을 정한다. AI 에이전트 멀티턴의 턴 이벤트는 [WebSocket 이벤트와 명령 — AI 대화 턴 이벤트](CLE-API-WS-EVENTS-AITURN.md) 가 정한다.

## 4. 입력 대기 이벤트 상세 (`execution.waiting_for_input`)

원문 §4 의 번호를 그대로 쓴다. §4.1~§4.4 와 §4.6 은 [WebSocket 이벤트와 명령 — AI 대화 턴 이벤트](CLE-API-WS-EVENTS-AITURN.md) 에 있다.

`interactionType`(대기 표면, `WaitingInteractionType`) 필드로 Form 노드, 버튼 Presentation 노드, AI 에이전트 멀티턴을 가른다.

**실제 wire 필드 이름 주의 (fanout 봉투)**: 아래 JSON 은 논리 구조 표기다.

- 서버가 보내는 평면 wire 는 대기 노드 ID 를 `nodeId` 가 아니라 **`waitingNodeId`**(대기 노드 ID)로 싣고 `waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt`(에디터 타임라인 관측용)을 평면으로 합친다.
- Form·AI 노드 설정은 최상위 `formConfig`·`conversationConfig` 가 아니라 **`nodeOutput`** 안에 중첩된다(예: `nodeOutput.conversationConfig`). `buttons` 는 최상위 `buttonConfig` 를 유지한다.
- 이 fanout 봉투는 내부 WebSocket store 와 EIA SSE 스트림이 함께 쓴다. 단 `nodeOutput`(과 `buttonConfig.nodeOutput`)의 키 집합은 함께 쓰지 않는다. 외부로 나가는 복제본에만 fail-closed 허용 목록이 걸려 엔진 내부 필드(`_retryState` 등)가 빠진다(2026-08-23). 내부 WebSocket 은 원문 그대로다. `execution.node.*` 의 `envelope.output` 도 2026-08-24 에 같은 목록으로 닫혔다. 허용 목록 표는 [응답 자격 증명 마스킹](CLE-API-EGRESS.md) 이 정본이다.
- **외부 클라이언트가 읽는 필드 매핑의 기준은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)**(와 위젯 파서 `parseWaitingForInput`)다. WebSocket 내부 부가 식별자(`waitingNodeType`, `waitingNodeLabel`, `nodeExecutionId`, `startedAt`)는 이 절이 정한다. 발행 기준은 `form-interaction`·`button-interaction`·`ai-turn-orchestrator` 서비스의 `emitExecution(EXECUTION_WAITING_FOR_INPUT, …)` 이다.

**Form 노드 (`interactionType: "form"`)**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "form",
    "interactionType": "form",
    "formConfig": {
      "title": "Approval Request",
      "description": "Please review...",
      "fields": [ ... ],
      "submitLabel": "Submit",
      "timeout": 300
    }
  }
}
```

**버튼 Presentation 노드 (`interactionType: "buttons"`)**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "carousel",
    "interactionType": "buttons",
    "buttonConfig": {
      "buttons": [
        { "id": "uuid-1", "label": "승인", "type": "port", "style": "primary" },
        { "id": "uuid-2", "label": "상세보기", "type": "link", "url": "https://...", "style": "outline" }
      ],
      "nodeOutput": {
        "config": { "items": [ "..." ], "buttonConfig": { "...": "..." } },
        "output": { "items": [ "..." ] },
        "status": "waiting_for_input"
      }
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `interactionType` | `form`: Form 노드. `buttons`: 버튼이 설정된 Presentation 노드. `ai_conversation`: AI 에이전트 멀티턴 일반 대화. `ai_form_render`: AI 에이전트가 `render_form` 도구로 사용자 폼 제출을 기다림. 값 집합의 기준은 [인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md) |
| `formConfig` | **`interactionType = form` 한정** 최상위 필드. 그래프 Form 노드의 폼 설정. `ai_form_render` 는 최상위에 없고 `conversationConfig.pendingFormToolCall.formConfig` 에 중첩된다(아래 행). 화면이 폼 출처를 한 위치에서 읽게 한다 |
| `buttonConfig` | `interactionType = buttons` 일 때 있다. 버튼 정의와 노드 렌더링 출력(`{ buttons, nodeOutput }`). 버튼을 누를 때까지 제한 없이 기다리며 타임아웃 필드가 없다([Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md)) |
| `buttonConfig.nodeOutput` | 노드의 구조화 출력(노드 출력 `{ config, output, meta?, port?, status }`). 클라이언트가 콘텐츠와 버튼을 함께 보인다. 노드 종류는 상위 `payload.nodeType` 으로 식별하고 `nodeOutput` 에 `type` 판별자 래퍼를 두지 않는다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)). `nodeOutput.nodeType` 도 이 금지 대상이다(아래) |
| `conversationConfig` | `interactionType ∈ {ai_conversation, ai_form_render}` 일 때 있다. AI 에이전트 멀티턴 대화 설정 |
| `nodeOutput.meta.turnDebug` | `interactionType ∈ {ai_conversation, ai_form_render}` 일 때 있다. **진행 중 누적 관측 델타**다. `_resumeState` 의 누적치를 `meta.*` 로 펼쳐 실행 결과 화면의 참조·LLM 사용량 탭이 **대기 중에도** 동작하게 한다(`_resumeState` 자체는 시스템 프롬프트·`llmConfigId` 같은 내부 필드를 담아 클라이언트로 보내지 않는다). 항목 형태: `{ turnIndex, ragSources[], ragDiagnostics?, llmCalls?, toolCalls?, totalDurationMs? }`. **소비 경계**: `ragSources` 는 대화 미리보기의 보조 관측 레인(🔎 `rag` 행, 📚 칩)도 쓸 수 있고([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)), **`llmCalls` 는 디버그 탭 전용**(원본 요청·응답)이다. 발행 기준은 `ai-turn-orchestrator.service.ts` 의 `buildConversationMetaFromResumeState` 이고 내역 대응물은 영속된 `outputData.meta` 다. 두 표면이 같은 형태라 화면이 분기하지 않는다 |
| `conversationConfig.pendingFormToolCall` | **`interactionType = ai_form_render` 한정**. 형태 `{ toolCallId: string, formConfig: object }`. `toolCallId` 는 화면이 렌더할 폼 페이로드를 찾는 매칭 키다(제출 때 클라이언트가 되돌려 보내는 필드가 아니다. `submit_form` payload 는 `{ executionId, formData }` 뿐이고 서버가 보관한 값으로 맞춘다). `formConfig` 는 LLM 페이로드에 `presentationTools[*].defaults` 를 덮어쓴 결과(Form 노드 입력 스키마 형태)다. 화면의 `AssistantPresentationsBlock` 이 assistant 턴의 `presentations[*]` 중 `payload.toolCallId === pendingFormToolCall.toolCallId` 인 폼 페이로드를 입력 가능한 `DynamicFormUI` 로 렌더한다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)) |

**`nodeOutput.nodeType` 에 대해 (2026-08-24)**: 엔진은 `nodeType` 을 `nodeOutput` 안에 넣지 않는다. `nodeOutput` 안의 `nodeType` 은 값 공간이 `chart`·`table`·`carousel` 로 payload 의 노드 종류와 같다. 즉 Rationale "`buttonConfig` 예시 정정" 의 C3 가 "상위에서 이미 식별되므로 불필요하고 중복" 이라며 기각한 바로 그 판별자다.

| 층 | 상태 |
|---|---|
| 엔진(발행·영속) | `nodeOutput` 안에 `nodeType` 을 **넣지 않는다**(C3 준수). `nodeType:` 대입은 모두 봉투 수준이고 실 DB 조회(e2e 285건, `node_execution.output_data` object 84행)에서도 최상위 `nodeType` 은 0행이다 |
| 채팅 채널 렌더러 | `nodeOutput?.nodeType` 을 **읽는다**(프로바이더 셋). 옛 평탄 형태를 만나도 죽지 않으려는 방어적 읽기다 |
| fanout 허용 목록 | `nodeType` 을 통과 목록에 둔다. 그 방어를 깨지 않으려는 예방적 허용이지 계약 편입이 아니다 |

읽는 쪽이 있다고 넣어도 된다는 뜻은 아니다. 새 코드가 `nodeOutput.nodeType` 을 **쓰는** 것은 여전히 C3 위반이다. 노드 종류를 읽어야 하면 봉투 쪽을 쓰되 소비자에 따라 갈린다.

- **내부(에디터 WebSocket 타임라인)**: 입력 대기 이벤트의 실제 wire 필드 `waitingNodeType`.
- **외부 클라이언트(SSE, 채팅 채널, SDK)**: **`interactionType` 으로 분기한다.** [External Interaction API](../CLE-IX/CLE-EIA.md) 는 `node.type` 에 외부 소비 매핑이 없고 `waitingNodeType` 은 WebSocket 내부 부가 식별자라고 정한다.

**AI 에이전트 멀티턴 노드 (`interactionType: "ai_conversation"`)**

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "nodeType": "ai_agent",
    "interactionType": "ai_conversation",
    "conversationConfig": {
      "message": "안녕하세요! 무엇을 도와드릴까요?",
      "messages": [
        { "role": "user", "content": "[from Template] clicked: 시작", "source": "injected" },
        { "role": "user", "content": "첫 번째 사용자 메시지", "source": "live" },
        { "role": "assistant", "content": "안녕하세요! 무엇을 도와드릴까요?", "source": "live" }
      ],
      "turnCount": 1,
      "maxTurns": 20
    }
  }
}
```

사용자 메시지 전송(`execution.submit_message`)과 대화 종료 요청(`execution.end_conversation`)의 payload 는 [실행 제어 명령](CLE-API-WS-EVENTS-COMMANDS.md#2-실행-제어-명령-client--server) 표에 있다.

### 4.5 대화 스레드 스냅샷 (`conversationThread`)

`conversationThread` 는 모든 대기 표면(`form`, `buttons`, `ai_conversation`, `ai_form_render`)의 payload 에 선택적으로 실린다. 화면의 라이브 대화 패널이 워크플로우 실행 도중 쌓이는 대화 스레드를 보일 때 쓴다.

```json
{
  "type": "execution.waiting_for_input",
  "payload": {
    "executionId": "uuid",
    "nodeId": "uuid",
    "interactionType": "ai_conversation",
    "conversationConfig": { },
    "conversationThread": {
      "id": "default",
      "nextSeq": 4,
      "turns": [
        { "seq": 0, "nodeId": "...", "nodeType": "form", "source": "presentation_user", "text": "name=Alice", "timestamp": "..." },
        { "seq": 1, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_user", "text": "주문 상태 확인해줘", "timestamp": "..." },
        { "seq": 2, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_assistant", "text": "어떤 주문 번호인가요?", "timestamp": "..." },
        { "seq": 3, "nodeId": "...", "nodeType": "ai_agent", "source": "ai_user", "text": "ORD-12345", "timestamp": "..." }
      ],
      "totalChars": 142
    }
  }
}
```

| 필드 | 설명 |
|------|------|
| `conversationThread.id` | v1 은 늘 `"default"` |
| `conversationThread.nextSeq` | 다음 항목에 붙을 순번. 평소에는 `turns.length` 와 같고 저장 상한 때문에 오래된 항목을 지운 뒤에는 더 클 수 있다(순번을 다시 쓰지 않으려고). 클라이언트는 `turns.length` 로 순번을 추정하지 않는다. 기준은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) |
| `conversationThread.turns[i]` | 대화 기록 항목(`ConversationTurn`). 형태 기준은 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) |
| `conversationThread.totalChars` | 누적 글자 수(상한 판정용 빠른 경로. 클라이언트는 표시할 때 무시해도 된다) |

Background 본문에는 따로 떨어진 대화 스레드가 있다. 메인 흐름의 `execution.waiting_for_input` payload 에는 Background 본문의 항목이 들어가지 않는다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)).

## Rationale

### `buttonConfig` 예시 정정: 타임아웃 제거와 `nodeOutput` 판별자 폐지 (2026-06-03, C2·C3)

초기 §4 `buttonConfig` 예시는 `timeout: 300`·`timeoutAction: "cancel"` 과 `nodeOutput: { "type": "carousel", ... }` 를 담았다. 둘 다 다른 기준과 모순되는 낡은 예시였다.

- **C2 타임아웃 제거**: [Presentation 노드 공통](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md) 은 버튼 클릭까지 "외부 취소·종료 외에는 제한 없이 대기" 를 정하고 엔진(`waitForButtonInteraction`)도 타이머 없이 무한 대기한다(`timeoutAction` 은 코드에 없다). 예시의 두 필드만 낡았으므로 지웠다. 기각한 대안: 공통 규약에 타임아웃 정책을 정식으로 들이기. 현 구현과 다른 문서가 모두 무제한 대기라 기각했다.
- **C3 `nodeOutput` 판별자 폐지**: 노드 출력 규약의 `type` 판별자 래퍼 금지에 따라 엔진은 `buttonConfig.nodeOutput` 으로 노드 출력(`{ config, output, meta?, port?, status }`)을 그대로 싣는다(`nodeOutputForEvent = structured ?? flatNodeOutput`). 노드 종류는 상위 `payload.nodeType` 으로 이미 식별되므로 `nodeOutput` 안의 `type` 판별자는 불필요하고 중복이다. 예시를 실제 다섯 필드 구조로 바꿨다. 기각한 대안: `nodeOutput` 전용 스키마를 따로 적기. 판별자 래퍼 금지와 충돌해 기각했다.
- 2026-08-24: `nodeOutput.nodeType` 을 "렌더 서브타입" 으로 따로 보는 구분은 코드에 없고 C3 를 되살리는 해석이라 §4 의 층별 사실 표로 적었다. 외부 클라이언트용 노드 종류는 EIA 정책에 맞춰 소비자별로 갈라 적었다.

### 입력 대기 wire 필드: 예시를 다시 쓰지 않고 주의 문구와 소유 분리로 (2026-07-14)

§4 JSON 예시(`nodeId`, 최상위 `formConfig`·`conversationConfig`)는 논리 구조 표기인데 실제 fanout wire 는 `waitingNodeId` 와 `nodeOutput` 중첩이라 어긋나 있었다. JSON 전체를 실제 wire 로 바꾸지 않고(가독성 저하, 두 문서 불일치) 머리에 wire 필드 주의 문구를 두었다. 메시지 형식 절과 EIA 쪽이 이미 쓰던 방식이다. 전체 매핑을 세 문서에 복제하지 않도록 외부 소비 매핑은 EIA 쪽에, WebSocket 내부 부가 식별자는 §4 에 두었다. EIA 쪽 서술은 외부 소비 필드만 다루도록 범위를 좁혔으므로 "전체 기준" 으로 올리지 않았다.

2026-08-13 갱신: 채널별 봉투의 일반 규칙은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 으로 올라갔고 입력 대기 쪽에는 필드 이름 매핑만 남았다. 종결 셋은 WebSocket 전용 부가 필드가 없어 단일 기준으로 모였다. 같은 규칙이 입력에 따라 다른 결론을 낸 것이지 번복이 아니다.

### `ai_form_render` 의 `formConfig` 위치를 하나로 모은 이유

`formConfig` 최상위 필드는 그래프 Form 노드(`interactionType: 'form'`)의 폼 설정을 싣는 자리다. AI 에이전트 멀티턴의 `render_form` 블로킹 흐름에서는 `interactionType: 'ai_form_render'` 의 폼 페이로드를 `conversationConfig.pendingFormToolCall.formConfig` 에 중첩한다(`execution-engine.service.ts` 발행, 프론트엔드도 같은 위치에서 읽는다). 화면이 폼 출처를 한 위치에서 읽게 하려는 것이고 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md) 의 store 변환 표와 맞는다. `pendingFormToolCall.formConfig` 로 중첩하면 `toolCallId` 와 함께 하나의 원자 단위로 운반돼 뜻이 분명하다. 근거는 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 `render_form` 타임라인 인라인 표현 절이다.
