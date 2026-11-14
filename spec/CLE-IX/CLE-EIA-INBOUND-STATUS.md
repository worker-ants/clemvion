---
id: "CLE-EIA-INBOUND-STATUS"
title: "EIA 수신 API — 상태 조회와 토큰 갱신"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-INBOUND"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-INBOUND"]
area: "CLE-IX"
content_hash: "630b81bbbcf6eb63d72929a3d32f57822b2a4873e8452af5023dbed2df5753cf"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "b7822fc44f6ccd7693008e18f1093a9b183fe32323018ac909c69b521a6e3140"
etag: "sha256-fd76ba70d7bba0c35da9d6969dfaa6bc57fdea261fa9bec70d54f62f5abe6c80"
---
## 개요

이 문서는 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 하위 문서로 단발 상태 조회와 실행 단위 토큰 갱신(`/refresh-token`)을 정한다. 에러 코드 전체 표는 [EIA 수신 API — 명령 제출과 에러](CLE-EIA-INBOUND-COMMAND.md#명령-에러) 에 있다.

## 단발 상태 조회

`GET /api/external/executions/:executionId` 는 현재 상태를 한 번 돌려준다.

- `id`·`workflowId`·`status`·`result`·`error`·`updatedAt` 는 실제 값으로 채운다.
- 입력 대기 상태에서는 `currentNode`(id·type·interactionType)와 `context` 도 채운다. 지금 대기 중인 노드 실행 출력(`NodeExecution.outputData` 의 `meta.interactionType` 과 구조화된 `config.buttonConfig`)에서 복원한다. 버튼은 `context.buttonConfig{ buttons, nodeOutput }`, 폼·AI 대화는 `context.nodeOutput` 에 싣는다. SSE `waiting_for_input` 과 같은 형식이라 위젯이 `parseWaitingForInput` 으로 그대로 시드할 수 있다. 빠른 첫 노드(버튼·캐러셀)가 SSE 구독 전에 발행되는 경쟁에서 현재 대기 표면을 되살리는 1차 경로다(`interaction.service.ts` 의 `getStatus()`).
- `context.conversationThread` 에는 영속 대화 스레드 스냅샷(`Execution.conversation_thread`, [대화 스레드](CLE-IX-THREAD.md))을 SSE `waiting_for_input` 과 같은 형식으로 싣는다. 새로고침 복원이 5분 버퍼에 기대지 않고, 버퍼 만료·서버 재시작·인스턴스 전환과 관계없이 전체 기록을 되살리게 하려는 것이다.
- 스냅샷이 없으면(배포 전 행, park 이력 없음) `context.conversationThread` 키를 생략한다. 형제 필드가 `null` 을 쓰는 것과 다르다. SSE 도 있을 때만 싣고, 위젯은 부재를 빈 기록으로 처리한다. 두 부재 표현의 선택 기준은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 부재 표현 규칙이고, 이 필드는 다른 경로와의 형식 일치 사례다.
- `seq` 는 항상 `0` 이다. 단발 응답은 순번 카운터를 읽지 않으므로 순번은 SSE 재전송(`Last-Event-Id`, 첫 연결 `lastEventId=0`)이 권위다.

```jsonc
GET /api/external/executions/{executionId}
Authorization: Bearer <iext_jwt | itk_token>

200 OK
{
  "id":         "uuid",
  "workflowId": "uuid",
  "status":     "waiting_for_input" | "running" | "pending"
              | "completed" | "failed" | "cancelled",
  "currentNode": {
    "id": "uuid",
    "type": "form" | "carousel" | "ai_agent" | ...,
    "interactionType": "form" | "buttons" | "ai_conversation" | null
  } | null,
  "context": {
    "interactionType": "form" | "buttons" | "ai_conversation",
    "waitingNodeId":   "uuid",
    "conversationThread": { ... },  // 있을 때만. 형식은 WebSocket 이벤트의 conversationThread 와 같다

    // 아래 두 키 중 정확히 하나만 있다(SSE waiting_for_input 과 같음)
    "buttonConfig": { "buttons": [ ... ], "nodeOutput": { ... } },  // buttons 이고 buttonConfig 복원에 성공했을 때
    "nodeOutput":   { ... }         // 그 밖. form·ai_conversation, 그리고 buttonConfig 를 복원하지 못한 buttons.
                                    // formConfig·conversationConfig 는 이 nodeOutput 안에 있다(top-level 아님)
  } | null,
  "result":  { ... } | null,        // completed 일 때
  "error":   { ... } | null,        // failed 일 때
  "durationMs": 4242 | null,        // 종결 시. 영속 컬럼 값을 그대로 싣는다(다시 계산하지 않음).
                                    // 종결 이벤트의 같은 이름 필드와 같은 값이다.
                                    // 종결 전에는 null(키는 있다).
                                    // 취소·타임아웃 경로에서는 대기 경과 시간이다
  "seq":     0,                     // 항상 0. 실제 순번은 SSE 가 권위
  "updatedAt": "ISO8601"
}
```

- `context` 는 판별자 없는 닫힌 2-variant union 이다. `interactionType` 은 판별자가 아니다. `buttons` 는 `buttonConfig` 변형과, 복원에 실패해 넘어온 `nodeOutput` 변형 양쪽에 나온다. 소비자는 키 존재(`'buttonConfig' in context`)로 가른다. OpenAPI 스키마는 `discriminator` 없이 `oneOf` 로 적는다([OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md)).
- `conversationThread.turns[].source` 는 대화 기록 항목의 항목 출처(`ConversationTurnSource`) 값이다. WebSocket 메시지의 전송 출처 표시(`live`·`injected`)와 그 누락 시 `live` 로 보는 폴백은 `nodeOutput.conversationConfig.messages[].source` 에만 해당하고 `turns[]` 에는 해당하지 않는다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md), [대화 스레드](CLE-IX-THREAD.md)).
- `currentNode.interactionType` 과 `context.interactionType` 은 외부로 세 값(`form`·`buttons`·`ai_conversation`)을 싣는다. 엔진 내부의 `ai_form_render` 가 여기서 어떻게 보이는지는 [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 의 미결 사항이다.
- 상태 조회와 SSE 는 노드 출력(`nodeOutput`)과 대화 스레드를 공개 경로로 내보낸다. 노드 핸들러는 여기에 민감한 중간 결과(시크릿·내부 토큰 등)를 남기지 않아야 한다. 이 불변식은 출구에서 강제한다. 대화 스레드는 `redactThreadForPublic` 가, 입력 대기 `nodeOutput` 은 고정 키 허용 목록과 값 가리기가, 종결 `result`·`error` 는 디버그 필드 제거와 값 가리기가 맡는다. 적용 범위와 남은 갭은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 토큰 갱신

```jsonc
POST /api/external/executions/{executionId}/refresh-token
Authorization: Bearer <expiring_iext_jwt>

200 OK
{
  "token":     "iext_<new_jwt>",
  "expiresAt": "ISO8601"
}

400 Bad Request    // TOKEN_REFRESH_NOT_IN_WINDOW: expiresAt 까지 30분 넘게 남음
400 Bad Request    // TOKEN_REFRESH_FAILED: 갱신 실패(안전망)
401 Unauthorized   // TOKEN_*: 토큰 자체가 무효·만료·블랙리스트(가드가 먼저 막음)
403 Forbidden      // TOKEN_REFRESH_FORBIDDEN: itk_*(per_trigger)는 영구 토큰이라 갱신 대상 아님
410 Gone           // EXECUTION_TERMINATED: 실행이 종료됐거나 없음
```

- `401` 은 `InteractionGuard` 가 핸들러 전에 내는 토큰 검증 실패 전용이다. 종료는 `410`(`GoneException`), 갱신 창 밖은 `400` 이다. 판정 순서는 `interaction.service.ts` 의 `refreshToken` 기준 `TOKEN_REFRESH_FORBIDDEN` → `TOKEN_REFRESH_NOT_IN_WINDOW` → `EXECUTION_TERMINATED` 다.
- 만료된 토큰은 가드가 401 로 막으므로 갱신 핸들러에 닿지 못한다. 갱신은 만료 전 30분 창에서만 된다.
- `410` 은 없는 실행도 포함한다. 종료 판정 쿼리가 `!execution` 을 같은 분기로 묶기 때문이다. 다른 엔드포인트의 `404 EXECUTION_NOT_FOUND` 와 다르다. 클라이언트에게는 어느 쪽이든 "이 실행은 더 이을 수 없다" 는 같은 결론이라 구분할 이득이 없고, 있고 없음을 가르지 않는 편이 정보 노출을 줄인다.
- `410` 을 받았을 때 옛 토큰은 이미 무효다. 종료 검사가 토큰 회전(`refreshPerExecution` = 옛 jti 블랙리스트 + 새 발급) 뒤에 오기 때문이다. 따라서 옛 토큰으로 다시 시도할 수 없고, 어차피 종료된 실행의 토큰은 종료 시 폐기 규칙으로 이미 일괄 폐기된다. 클라이언트는 `410` 을 되살릴 수 없는 종료 신호로 다룬다([웹채팅 인증과 세션](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md)).
- `/refresh-token` 은 실행별 레이트 리밋 밖이고 전역 스로틀만 받는다.

## Rationale

### 상태 조회가 현재 대기 표면과 대화 스레드를 싣는다

처음 v1 은 상태 조회의 `currentNode`·`context` 를 늘 `null`, `seq` 를 `0` 으로 두고 상세 정보는 SSE `waiting_for_input` 을 권위로 삼았다.

- **경쟁 창**: 웹훅 즉시 시작(`202` 비동기) 직후 빠른 첫 노드(버튼·캐러셀)의 `waiting_for_input` 이 위젯의 SSE 구독보다 먼저 나가는 경쟁이 확인됐다. 위젯이 `lastEventId` 없이 첫 연결하면 5분 버퍼가 있어도 재전송을 받지 못하고 heartbeat 만 받아 첫 화면(캐러셀)이 그려지지 않았다. 그래서 위젯은 (a) `openStream(lastEventId=0)` 으로 버퍼의 놓친 이벤트를 다시 받고, (b) 시작·복원 직후 상태 조회로 현재 대기 표면을 한 번 시드한다. 후자를 위해 상태 조회가 입력 대기일 때 `currentNode`·`context` 를 실제 값으로 돌려주도록 좁게 넓혔다.
- **SSE 와의 역할 분담**: 상태 조회는 현재 대기 표면 시드와 새로고침 기록 복원을 맡는다. SSE 는 순번과 이후 실시간 증분 이벤트(`waiting_for_input`·`ai_message`)의 권위다. 순번만은 `SSE_SEQ_PLACEHOLDER=0` 으로 두고 SSE 가 권위로 바로잡는다. 위젯의 시드는 `404`·`401`·`410` 을 종료·갱신 분기로 처리하고 그 밖의 HTTP 에러는 경고만 남기고 진행한다. 분기 규칙은 [웹채팅 인증과 세션](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) 이 정한다. 시드가 실패해도 SSE 재전송이 버퍼 안에서 보강한다.
- **대화 스레드도 싣도록 조정**: 처음에는 `conversationThread` 를 SSE 전용 권위로 두고 상태 조회에서 뺐다(5분 버퍼 재전송으로 보정한다는 전제). 그러나 버퍼 만료(5분 초과)·서버 재시작·인스턴스 전환 뒤 새로고침하면 재전송이 불가능해 위젯이 기록을 잃었다. 영속 스냅샷(`Execution.conversation_thread`)은 이미 손실 없이 저장돼 있는데도 내보낼 길이 없었다. [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) 도 "버퍼 만료 때 상태 조회 스냅샷으로 다시 맞춘다" 를 계약으로 두고 있어 이 생략과 모순이었다. 그래서 상태 조회가 입력 대기일 때 영속 스레드를 싣도록 좁게 넓혀 새로고침 복원이 버퍼·재시작과 무관하게 되게 했다. 이미 SSE `waiting_for_input` 으로 공개 중인 `conversationThread` 를 REST 단발 응답에도 읽기 전용으로 싣는 것뿐이라 새로운 민감 데이터 노출이 아니다.
- **부재 표현이 형제 필드와 다르다**: `conversationThread` 만 키를 생략하는 것은 SSE 도 있을 때만 싣기 때문이다. REST 만 `null` 로 맞추면 위젯의 `parseWaitingForInput` 재사용이 깨진다.
- **기각한 대안**: (a) SSE 전용을 유지하고 버퍼 만료 때 위젯이 다시 조회하는 안. 그 재조회(상태 조회)가 스레드를 주지 않으므로 만료 때 되살릴 원천이 없어 문제를 풀지 못한다. (b) 노드 실행 출력에 흩어진 값으로 스레드를 다시 만드는 안. `runningSummary` 같은 스레드 메타가 노드별로 저장되지 않아 손실 없이 되살릴 수 없다([대화 스레드](CLE-IX-THREAD.md) 가 같은 이유로 기각). 영속 컬럼을 그대로 내보내는 것이 손실 없고 단순하다.
