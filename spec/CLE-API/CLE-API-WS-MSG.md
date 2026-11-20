---
id: "CLE-API-WS-MSG"
title: "WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러"
type: "design"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-WS"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-WS"]
area: "CLE-API"
content_hash: "fde9e69e9ae98db5422565fff8ed11715acbbc3a634d4dac631659b70afcc943"
read_as: "approved_fallback"
task: "CLE-T-DV6PN7"
source_paths: ["spec/5-system/6-websocket-protocol.md"]
mirror_sha256: "38d843d8965f5cccd0227225e06728978f7f32e56fc8436da6f979153f93d2cf"
etag: "sha256-50c3e6b0057200fb2b5b6cc62286bb512150b973f15ddf587af0cb537ce02247"
---
> 구현 상태: 구현됨 (raw WebSocket 전제 항목 일부는 비채택) · 원문: `spec/5-system/6-websocket-protocol.md` (§3 · §4 · §7 · §8, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [WebSocket 연결과 채널 구독](CLE-API-WS.md) 의 하위 문서로 메시지 형식과 서버 이벤트 봉투, 구독 채널 패턴 · 구독 · 구독 인가 · 구독 한도, 전송 계층 에러 코드와 에러 메시지 형식, close 코드(비채택)를 정한다. 전송 계층(§1)은 부모 문서, 연결 · 인증 · heartbeat · 재연결(§2 · §5 · §6 · §9)은 [WebSocket 연결과 채널 구독 — 연결 · 인증 · 재연결](CLE-API-WS-CONN.md) 이 정한다. 절 번호는 부모 문서의 번호를 그대로 쓴다.

## 3. 메시지 형식

메시지의 `type` 은 별도 JSON 필드가 아니라 **Socket.IO 이벤트 이름**으로 전달한다. 서버는 `socket.emit(eventType, envelope)`, 클라이언트는 `socket.on(eventType, handler)` 를 쓴다. 그래서 아래 `{ type, id, payload }` 표기는 논리 구조이고 실제 wire 는 "이벤트 이름 = `type`" 과 "payload = 봉투" 다. 명령의 응답도 같은 방식으로 온다. 핸들러가 돌려준 `{ event, data }` 의 `event` 값이 ack 이벤트 이름이고 payload 는 `data` 다([§1](CLE-API-WS.md#1-전송-계층)). 요청과 응답은 `id` 필드 대신 ack 이벤트 이름으로 짝짓는다.

### 3.1 기본 프레임 (논리 구조)

```json
{
  "type": "string",
  "id": "string (optional)",
  "payload": {}
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | String | ✓ | 이벤트·명령 종류(네임스페이스.액션 형태). wire 에서는 Socket.IO 이벤트 이름이다 |
| `id` | String | 선택 | 메시지 고유 ID. 계획이며 일부 미구현이다. 구현된 명령 응답은 `id` echo 대신 ack 이벤트 이름(`subscribed`, `<명령>.ack` 등)으로 짝짓는다 |
| `payload` | Object | ✓ | 이벤트·명령별 데이터 |

### 3.2 서버 → 클라이언트 이벤트 봉투

서버가 보내는 실행·노드 이벤트의 wire 이벤트 봉투는 `type`·`payload` 를 중첩하지 않는다. `executionId`(노드 이벤트는 `nodeId` 도), payload 필드, `seq`, `timestamp` 를 **평면으로 합친** 객체다(`emitExecutionEvent`, `emitNodeEvent`). 이벤트 이름은 Socket.IO 이벤트 이름으로 따로 간다.

```js
// Socket.IO event name: "execution.node.completed"
{
  "executionId": "550e8400-...",
  "nodeId": "...",
  /* ...payload 필드 평면 병합... */
  "seq": 42,
  "timestamp": "2026-03-29T14:00:01.234Z"
}
```

| 추가 필드 | 설명 |
|-----------|------|
| `executionId` | 채널의 실행 ID. 봉투 최상위에 자동으로 붙는다 |
| `timestamp` | 서버 이벤트 발생 시각 (ISO 8601) |
| `seq` | 채널 안 이벤트 순번. 재연결 때 놓친 이벤트를 감지하는 데 쓴다. 자세한 규칙은 아래 |

`kb:`·`background:run:` 채널의 봉투는 이 표와 다르다. 실행 ID 대신 채널 키(`documentId`·`backgroundRunId`)와 `timestamp` 가 붙고 `seq` 는 없다. 필드는 [WebSocket 이벤트와 명령 — 채널별 부가 이벤트](CLE-API-WS-EVENTS-CHANNELS.md) 의 지식 저장소 문서 이벤트 절(§3)과 Background 본문 실행 이벤트 절(§8)이 정한다.

**이벤트 순번 `seq`**

- `execution:{executionId}` 채널에서는 실행 안에서 1씩 늘어나는 카운터다(`ExecutionSeqAllocator`, Redis `INCR exec:seq:<executionId>`). 키 정의와 TTL 은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 에 있다. 슬라이딩 TTL 은 환경 변수 `EXECUTION_SEQ_TTL_SECONDS`(기본 86400)다.
- 외부 SSE 의 `id:` 와 EIA 알림 웹훅의 `seq` 가 같은 값을 쓴다([External Interaction API 「이벤트 순번을 SSE 와 알림이 같이 쓴다」](../CLE-IX/CLE-EIA.md#이벤트-순번을-sse-와-알림이-같이-쓴다)).
- **저장 정책은 Redis 전용이다(2026-06-02 결정, DB 폴백 없음).** Redis 를 쓸 수 없으면 인스턴스별 메모리 카운터로 내려가 발행을 멈추지 않는다. 그 구간에는 인스턴스 사이 단조 증가를 보장하지 않는다(받아들인 trade-off, `logger.warn` 기록). 정상 경로에서도 자기 인스턴스가 발급한 값을 미러링해 장애 전환 때 최고값을 이어받는다.
- **메모리 미러의 회수**: 메모리 미러는 종료 이벤트를 보낸 서버 인스턴스에서 풀린다. 실행을 park 한 서버 인스턴스와 끝낸 서버 인스턴스가 다르면 park 한 쪽에 미러가 남는다. 그래서 유휴 TTL 과 서버 인스턴스당 상한으로도 회수한다. 유휴 TTL 은 Redis 키의 슬라이딩 TTL 과 같은 `EXECUTION_SEQ_TTL_SECONDS`(기본 86400초)이고 마지막으로 값을 읽거나 쓴 시각부터 잰다. 같은 값을 쓰는 것은 미러가 Redis 키보다 먼저 사라지지 않게 하려는 것이다. 상한은 10,000건이다. 넘치면 가장 오래 만지지 않은 항목부터 지우고 경고 로그를 남긴다. 정리는 타이머 없이 값을 넣을 때 한다. Redis 를 쓸 수 없는 구간에 상한 때문에 미러를 잃은 실행은 `seq` 가 1부터 다시 나갈 수 있다. 그 구간에 인스턴스 사이 단조 증가를 보장하지 않는 위 trade-off 와 같은 범주다.


## 4. 채널 구독

### 4.1 채널 개념

클라이언트는 관심 있는 리소스의 **구독 채널을 구독**해야 이벤트를 받는다. 구독하지 않은 리소스의 이벤트는 보내지 않는다.

### 4.2 채널 패턴

| 채널 | 패턴 | 설명 |
|------|------|------|
| 워크플로우 실행 | `execution:{executionId}` | 특정 실행의 모든 이벤트 |
| 워크플로우 편집 | `workflow:{workflowId}` | 서버가 보내는 이벤트가 없다. 구독 인가(§4.4)만 있다. 경위는 [「`workflow:`·`notifications:` 채널 인가를 더한 이유」](#workflownotifications-채널-인가를-더한-이유) |
| 지식 저장소 문서 상태 | `kb:{documentId}` | 지식 저장소 문서별 임베딩·그래프 추출 상태. 지식 저장소 ID 가 아니라 **문서 ID** 가 키다 |
| 인앱 알림 | `notifications:{userId}` | 사용자 인앱 알림 실시간 수신 |
| Background 본문 실행 | `background:run:{id}` | Background 노드 본문 실행의 시작·완료 이벤트. 이벤트와 봉투 필드는 [WebSocket 이벤트와 명령 — 채널별 부가 이벤트 「8. Background 본문 실행 이벤트」](CLE-API-WS-EVENTS-CHANNELS.md#8-background-본문-실행-이벤트-server--client), 동작 규칙은 [Background 노드 — 본문 실행 모니터링 「실시간 갱신 (WebSocket 구독 채널)」](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND-RUNS.md#실시간-갱신-websocket-구독-채널) 이 정한다 |

`workflow:` 를 뺀 각 채널의 이벤트 목록은 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 에 있다.

### 4.3 구독과 구독 해제

구독과 해제는 Socket.IO 이벤트 `subscribe`·`unsubscribe` 로 보낸다. 서버 핸들러가 돌려준 `{ event, data }` 는 `subscribed`·`unsubscribed` ack 이벤트로 나가고 payload 는 `data` 다([§1](CLE-API-WS.md#1-전송-계층)).

```js
// 구독 요청 (클라이언트)
socket.emit("subscribe", { channel: "execution:550e8400-e29b-41d4-a716-446655440000" });

// 구독 확인: 핸들러 반환(논리 형태)
{ "event": "subscribed", "data": { "success": true, "channel": "execution:550e8400-e29b-41d4-a716-446655440000" } }
// wire: Socket.IO 이벤트 "subscribed", payload { "success": true, "channel": "execution:550e8400-e29b-41d4-a716-446655440000" }

// 구독 해제
socket.emit("unsubscribe", { channel: "execution:550e8400-e29b-41d4-a716-446655440000" });
// 핸들러 반환: { "event": "unsubscribed", "data": { "success": true, "channel": "..." } }
// wire: Socket.IO 이벤트 "unsubscribed", payload { "success": true, "channel": "..." }
```

클라이언트는 구독 ack 를 `socket.on('subscribed', …)` 로 받는다. ack callback 과의 관계는 [§1](CLE-API-WS.md#1-전송-계층) 이 정한다.

### 4.4 구독 인가

서버는 구독할 때 해당 리소스에 대한 접근 권한을 확인한다(IDOR 차단). 채널별 인가 전략(`channelAuthorizers`)은 배열에 항목을 더해 넓히는 구조다.

| 채널 | 검증 |
|------|------|
| `execution:{executionId}` | 워크스페이스 소유 검증 (UUID 가 아니면 먼저 차단) |
| `workflow:{workflowId}` | 워크스페이스 소유 검증 (`WorkflowsService.findById(workflowId, workspaceId)`, UUID 가 아니면 먼저 차단). 서버 발행은 없다(§4.2) |
| `kb:{documentId}` | 워크스페이스 문서 소유 검증 |
| `background:run:{id}` | 워크스페이스 소유 검증 (UUID 가 아니면 먼저 차단) |
| `notifications:{userId}` | **사용자 단위**. JWT `sub` 와 채널의 `userId` 가 같은지 검증한다(fail-closed). `notification.new` 발행은 `emitNotificationEvent` 로 구현됐다 |

- 워크스페이스 소유를 보는 구독 채널 인가기는 토큰 클레임의 워크스페이스가 그 리소스를 소유하는지만 확인한다(예: `execution:` 의 `verifyOwnership(executionId, workspaceId)`). 멤버십을 DB 에서 다시 확인하지 않는다([§2.2](CLE-API-WS-CONN.md#22-인증)).
- `execution:` 구독 인가는 워크스페이스 소유만 보고 역할을 구분하지 않는다. 그래서 이 채널의 수신 인구는 `GET /api/executions/:id` 와 같고 이벤트 페이로드 마스킹 범위가 이 사실에서 나온다([응답 자격 증명 마스킹](CLE-API-EGRESS.md)).
- `kb:`·`background:run:` 구독 인가도 워크스페이스 소유만 보고 역할을 구분하지 않는다. 뷰어도 받으므로 수신 인구가 `execution:` 과 같다. 그래서 두 채널의 발행에도 `execution:` wire 와 같은 값 마스킹(`maskWireEnvelope`)을 건다([응답 자격 증명 마스킹](CLE-API-EGRESS.md) §3.11).
- 권한이 없으면 별도 `error` 메시지가 아니라 같은 `subscribed` ack 에 `success: false`, 평문 `error` 문자열, 구조화 `code` 를 실어 돌려준다. `code` 는 평문 `error` 에 **더해** 붙는 확장이라 옛 클라이언트는 계속 `error` 로 동작한다. 새 클라이언트는 `code` 로 분기한다. 실패 응답에도 요청한 `channel` 을 싣는다. 요청의 `channel` 이 문자열이면 형식이 틀렸거나 빈 문자열이어도 그대로 돌려준다. 문자열이 아니거나 없으면 `channel` 필드를 뺀다. 클라이언트는 이 값으로 어느 구독의 실패인지 가린다. `channel` 이 없는 실패 응답(옛 서버)은 클라이언트가 자기 구독의 실패로 본다. 아래는 핸들러 반환 형태이고 wire 에는 `data` 만 `subscribed` ack 이벤트로 간다(§4.3).

```json
{ "event": "subscribed", "data": { "success": false, "error": "Not authorized for this execution", "code": "FORBIDDEN", "channel": "execution:550e8400-e29b-41d4-a716-446655440000" } }
```

**거부 코드 매핑** (`handleSubscribe`, §7.1)

| 상황 | `code` |
|---|---|
| 채널이 유효하지 않거나 필수 필드 누락 | `INVALID_MESSAGE` |
| 인증되지 않음 | `UNAUTHENTICATED` |
| 인가 실패 | `FORBIDDEN`. IDOR 차단 핸들러의 `NOT_FOUND` 관례와 다르다. [미결 사항](CLE-API-WS.md#미결-사항) 참조 |
| 구독 한도(20) 초과 | `SUBSCRIPTION_LIMIT_EXCEEDED` (§4.5) |
| join 실패 | `INTERNAL_ERROR` |

표의 모든 거부 응답에 같은 규칙으로 `channel` 이 실린다.

### 4.5 최대 구독 수

- 연결당 최대 동시 구독은 **20개**다(`MAX_SUBSCRIPTIONS_PER_CONNECTION`).
- 넘으면 구독 ack 에 `{ success: false, error: "Maximum subscriptions (20) reached", code: "SUBSCRIPTION_LIMIT_EXCEEDED", channel: "<요청한 채널>" }` 를 돌려준다. 평문 `error` 에 더해 구조화 `code` 를 싣는다.
- 한도는 소켓 단위라 그 소켓이 붙은 서버 인스턴스가 센다. 다른 서버 인스턴스와 맞추지 않는다(§4.6).

### 4.6 여러 서버 인스턴스에서의 전달

백엔드는 서버 인스턴스 여럿으로 돈다. 실행 세그먼트와 재개는 아무 서버 인스턴스의 워커에서나 돌므로 이벤트를 만든 서버 인스턴스와 구독 소켓이 붙은 서버 인스턴스가 다를 수 있다. 그래도 구독자는 그 채널의 이벤트를 받는다.

- **전달 방식**: 게이트웨이(namespace `/ws`)에 Socket.IO Redis adapter(`@socket.io/redis-adapter`)를 건다. 채널 발행(`server.to(channel).emit()`)은 자기 서버 인스턴스의 구독 소켓에 보내고 같은 패킷을 Redis pub/sub 로 PUBLISH 한다. 다른 서버 인스턴스는 받은 패킷을 자기 쪽의 같은 채널 구독 소켓에 보낸다. §4.2 의 모든 채널이 이 경로를 지난다.
- **Redis 채널**: 이름은 라이브러리가 정하는 형식이고 접두는 `ws:sio` 다(예: 채널 하나로 보내는 패킷은 `ws:sio#/ws#<채널>#`). 모든 서버 인스턴스가 이 접두의 채널을 모두 구독하므로 구독자가 없는 서버 인스턴스도 패킷을 받는다. Redis 트래픽은 이벤트 수에 서버 인스턴스 수를 곱한 만큼이다.
- **보내는 것은 wire 봉투뿐이다.** 다른 서버 인스턴스로 가는 것은 클라이언트가 받는 이벤트 봉투(§3.2)다. 같은 서버 인스턴스 안의 외부 fanout(SSE · 채팅 채널 · EIA 알림 웹훅이 받는 내부 스트림)과 그쪽 이벤트에만 붙는 실행 라우팅 정보는 이 경로로 보내지 않는다. SSE 의 서버 인스턴스 사이 전달은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 정한다.
- **실행 라우팅 정보의 회수**: 외부 fanout 이벤트에 붙는 실행 라우팅 정보(payload 의 `triggerId` · `workflowId` 와 별도 필드 `routing` 의 `chatChannel`)는 서버 인스턴스 메모리에 두고 종료 이벤트를 보낸 서버 인스턴스에서 푼다. `routing` 은 서버 안 채팅 채널 dispatcher 만 읽고 SSE 와 EIA 알림 웹훅에는 실리지 않는다([응답 자격 증명 마스킹 — 재제출 거부와 마스커 좌표계 「6. 호출 순서」](CLE-API-EGRESS-PIPELINE.md#6-호출-순서-마스킹은-한-번이다)). 실행을 park 한 서버 인스턴스와 끝낸 서버 인스턴스가 다르면 park 한 쪽에 항목이 남는다. 남은 항목은 §3.2 의 `seq` 메모리 미러와 같은 유휴 TTL · 상한으로 회수한다. park 뒤 재개는 늘 rehydration 경로이고 재개한 서버 인스턴스가 라우팅 정보를 다시 등록한다([장애 복구와 안전 종료 — 체크포인트와 rehydration 「재개 절차」](../CLE-EXEC/CLE-EXEC-RECOVERY-REHYDRATE.md#재개-절차) 3단계). 그래서 park 동안 회수돼도 재개 뒤 fanout 이벤트에는 영향이 없다. 진행 중인 실행의 항목이 상한 때문에 지워지면 그 뒤 외부 fanout 이벤트에 `triggerId` · `routing.chatChannel` 이 빠진다. 그러면 이 값으로 대상을 찾는 외부 알림 fanout 과 채팅 채널 응답은 그 이벤트를 건너뛴다. EIA SSE 이벤트를 Redis 에 쓸지는 `triggerId` 가 없으면 DB 로 판정하므로 영향이 없다([EIA 데이터와 흐름 — SSE 스트림 「SSE 의 Redis 쓰기를 줄이고 구독 공백을 메운다」](../CLE-IX/CLE-EIA-DATA-SSE.md#sse-의-redis-쓰기를-줄이고-구독-공백을-메운다-2026-11-05)). wire 봉투는 바뀌지 않는다.
- **서버 인스턴스 로컬로 두는 것**: 소켓, 구독 목록(join · leave), 구독 한도(§4.5), 명령 빈도 제한(§7.1 `RATE_LIMITED`), 토큰 만료 타이머([WebSocket 연결과 채널 구독 — 연결 · 인증 · 재연결 「2.2 인증」](CLE-API-WS-CONN.md#22-인증))는 소켓이 붙은 서버 인스턴스에만 둔다. 모두 소켓 단위라 다른 서버 인스턴스와 맞출 필요가 없다. WebSocket 연결 상태는 Redis 에 두지 않고 옛 `ws:{wsId}:session:{connId}` 키도 되살리지 않는다.
- **sticky session 에 기대지 않는다.** transport 가 websocket 하나라([WebSocket 연결과 채널 구독 — 연결 · 인증 · 재연결 「2.1 엔드포인트」](CLE-API-WS-CONN.md#21-엔드포인트)) 소켓 하나는 연결한 서버 인스턴스를 떠나지 않는다.
- **Redis 가 없거나 끊겼을 때**: Redis 설정이 없으면 adapter 를 걸지 않고 메모리 adapter 로 돈다(서버 인스턴스 하나 전제). 돌던 중 Redis 에 닿지 못하면 다른 서버 인스턴스로 가는 전달만 멈춘다. 자기 서버 인스턴스의 구독자는 계속 받고 발행하는 쪽 처리도 멈추지 않는다. 그동안 다른 서버 인스턴스의 구독자가 놓친 이벤트는 다시 보내지 않는다. 화면은 다음 이벤트나 다음 구독 때 받는 `execution.snapshot`([WebSocket 연결과 채널 구독 — 연결 · 인증 · 재연결 「6.2 놓친 이벤트 복구」](CLE-API-WS-CONN.md#62-놓친-이벤트-복구))으로 상태를 맞춘다.


## 7. 에러 처리

### 7.1 에러 코드

`ws-error-codes.ts` 의 `WsErrorCode` enum 이 전송·인증·소유 코드(`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`)와 메시지 검증·구독 한도·빈도 제한 코드(`INVALID_MESSAGE`, `UNKNOWN_TYPE`, `SUBSCRIPTION_LIMIT_EXCEEDED`, `RATE_LIMITED`)를 담는다. 코드별 전달 형태는 §7.2 에 있다. 코드의 카탈로그 등재는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 WebSocket 절에 있다.

| 코드 | 구현 | 설명 |
|------|------|------|
| `UNAUTHENTICATED` | ✅ | 소켓에 사용자 ID 가 없음. `retry_last_turn` 의 중첩 `error.code` 로도 쓴다 |
| `FORBIDDEN` | ✅ (구독 인가 실패) | 권한 없음(일반). IDOR 차단 핸들러는 존재 추론을 막으려고 일부러 `NOT_FOUND` 를 쓴다 |
| `NOT_FOUND` | ✅ | 리소스가 없거나 소유 검증 실패 (`verifyOwnership` 으로 통일). `retry_last_turn` 의 중첩 `error.code` 로도 쓴다 |
| `INTERNAL_ERROR` | ✅ | 서버·전송 내부 실패(큐 적재 실패 등). `retry_last_turn` 의 중첩 `error.code` 같은 `WsErrorCode` 전송 수준 코드다. 재개 명령 평면 ack 의 `EXECUTION_INTERNAL_ERROR`(`ErrorCode` enum)와 **별개 범위**다 |
| `INVALID_EXECUTION_STATE` | ✅ | 재개 명령의 평면 `errorCode`. 발행 쪽 사전 검증 실패 |
| `RETRY_*`·`RESUME_*` | ✅ | 마지막 턴 재시도와 재개의 도메인 코드. `nodes/core/error-codes.ts` 의 `ErrorCode` enum. 뜻과 전달 방식은 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) |
| `INVALID_MESSAGE` | ✅ | 채널이 유효하지 않거나 필수 필드가 없을 때 구독 ack 의 `code` (§4.4) |
| `UNKNOWN_TYPE` | ✅ | 등록되지 않은 이벤트. 게이트웨이 `onAny` 가 잡아 `error` 이벤트 `{ code, message }` 를 보낸다(Socket.IO 가 조용히 버리는 것을 보완). 소켓 예산이 남아 있을 때만 보낸다. 예산을 넘은 등록되지 않은 이벤트는 응답 없이 버린다 |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | ✅ | 구독 한도(20) 초과 시 구독 ack 의 `code` (§4.5) |
| `RATE_LIMITED` | ✅ | WebSocket 명령 빈도 제한(**소켓당 분당 60건**, 메모리 fixed-window). `WsRateLimitGuard` 가 넘으면 `WsException` 을 던지고 클라이언트는 `exception` 이벤트 `{ code, message }` 로 받는다. 처리되지 않은 서버 예외도 같은 `exception` 이름으로 나가고 `code` 가 없을 수 있다. **클래스 수준 가드**라 `ping` 을 포함한 모든 `@SubscribeMessage` 핸들러에 걸리고 등록되지 않은 이벤트(`onAny` 경로)도 같은 소켓 예산을 쓴다(우회 차단). 소켓 단위 제한이고 소켓은 연결한 서버 인스턴스를 떠나지 않으므로 서버 인스턴스 로컬 카운터로 충분하다(§4.6). Redis 가 필요 없다. 사용자·워크스페이스 단위 총량 제한이 아니라 소켓당 명령 폭주 방지다 |

**전역 요청 빈도 제한은 HTTP 요청만 센다.** WebSocket 메시지는 위 `RATE_LIMITED` 의 `WsRateLimitGuard` 만 센다. 규칙과 근거는 [HTTP API 규약 「요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한) 에 있다.

### 7.2 에러 메시지 형식

- 명령 ack 의 실패도 성공과 같은 ack 이벤트(`<명령>.ack` 등)로 온다. 핸들러 반환은 `{ event, data }` 이고 wire payload 는 `data` 다. 재개 명령 넷은 평면 `{ success: false, error, errorCode? }`, `retry_last_turn` 은 중첩 `{ success: false, ..., error: { code, message } }` 를 쓴다([WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)).
- 구독 거부는 `subscribed` 이벤트의 payload `{ success: false, error, code, channel? }` 다. `channel` 을 싣는 규칙은 §4.4 가 정한다.
- **빈도 제한 초과(`RATE_LIMITED`)와 등록되지 않은 이벤트(`UNKNOWN_TYPE`)** 는 ack 이벤트가 아니라 각각 NestJS `exception` 이벤트와 `error` 이벤트의 `{ code, message }` 로 나간다.
- `error` 이벤트는 페이로드가 두 가지다. 핸드셰이크 에러는 `{ message }` 이고 `UNKNOWN_TYPE` 은 `{ code, message }` 다. 클라이언트는 `code` 가 있는지로 둘을 가른다.

```js
// retry_last_turn 실패 ack (nested error.code). 핸들러 반환(논리 형태)이고 wire 는 이벤트 "execution.retry_last_turn.ack" 의 payload 로 data 만 간다
{ "event": "execution.retry_last_turn.ack", "data": { "success": false, "executionId": "...", "nodeExecutionId": "...", "resumed": false, "error": { "code": "NOT_FOUND", "message": "Execution not found" } } }
```

초안의 독립 범용 프로토콜 에러 프레임 `{ type: 'error', id, payload: { code, message } }` 는 계획이며 미구현이다. 보내지 않는다.


## 8. WebSocket close 코드 (비채택)

raw WebSocket close code(1000·1001·1008·4000·4001 등)를 애플리케이션 수준에서 드러내는 것은 **비채택**이다. Socket.IO 전송은 close code 협상을 애플리케이션에 드러내지 않고 구현은 인증 실패나 에러 때 `error` 이벤트를 보낸 뒤 `socket.disconnect()` 를 부른다(close code 매핑 없음). 클라이언트는 close code 가 아니라 Socket.IO 의 `disconnect`·`connect_error` 이벤트로 재연결을 판단한다([§6.1](CLE-API-WS-CONN.md#61-클라이언트-재연결-socketio-내장)). 아래 표는 raw WebSocket 전제의 참고 설계이며 전송을 raw WebSocket 으로 바꾸지 않는 한 도입하지 않는다.

| 코드 | 설명 | 재연결 |
|------|------|--------|
| 1000 | 정상 종료 | 안 함 |
| 1001 | 서버 종료·유지보수 | 함 |
| 1008 | 인증 실패·토큰 만료 | 토큰 갱신 후 함 |
| 1011 | 서버 내부 에러 | 함 |
| 4000 | 빈도 제한 초과 | 30초 후 함 |
| 4001 | 비정상 메시지 반복 | 안 함 |


## 구현 위치

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (구독·인가, `onAny`)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (이벤트 봉투 조립과 발행)
- `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts` (`seq` 발급)
- `codebase/backend/src/modules/websocket/ws-error-codes.ts` (`WsErrorCode`)
- `codebase/backend/src/modules/websocket/ws-rate-limit.guard.ts` (`WsRateLimitGuard`. 소켓당 명령 빈도 제한)
- `codebase/backend/src/modules/websocket/ws-redis-adapter.ts` (§4.6 Redis adapter 연결)
- `codebase/backend/src/modules/websocket/execution-memory.policy.ts` (실행 단위 메모리 항목의 유휴 TTL · 상한)
- `codebase/backend/src/modules/websocket/idle-expiring-map.ts` (유휴 TTL 과 상한이 있는 Map)

## Rationale

### `workflow:`·`notifications:` 채널 인가를 더한 이유

§4.4 의 소유 검증 채널 목록에 `workflow:{workflowId}`(워크스페이스 소유 검증, `execution:` 과 같은 형태)와 `notifications:{userId}`(JWT `sub` 일치 검증)를 더했다. `channelAuthorizers` 는 배열에 항목을 더하는 것만으로 따로따로 넓힐 수 있는 구조다.

- **`workflow:` 는 발행이 있다고 보고 인가를 더했으나 발행은 처음부터 없었다**: 2026-06-12 에 에디터 실행 알림 발행(`workflow:{workflowId}`)이 있다고 보고 인가를 더했다. 다른 워크스페이스의 `workflowId` 를 추측한 사용자가 이벤트를 받는 IDOR 를 막으려는 것이었다. 그러나 서버에는 이 채널로 보내는 코드가 처음부터 없었고 프론트엔드도 이 채널을 구독한 적이 없다(2026-11-13 확인, NERV Task `CLE-T-P5BDNX`). 인가는 fail-closed 로 남긴다. 아래 `notifications:` 와 같이 나중에 발행을 들일 때 인가가 빠지는 일을 막는다. `WorkflowsService.findById(workflowId, workspaceId)`(소유하지 않았거나 없으면 NotFound. ID 열거 차단)로 join 전에 막는다.
- **`notifications:` 는 발행을 도입하기 전에 인가를 먼저 두었다(fail-closed)**: `notification.new` 발행 경로가 없던 시점에 인가를 **먼저** 배치했다. 발행이 뒤 단계에서 들어올 때 인가가 빠지면 사용자 사이 알림 유출로 바로 이어지는 패턴(집행 비대칭)을 구조적으로 막기 위해서다. "발행이 없을 때 인가 먼저" 가 fail-closed 원칙에 맞고 JWT `sub` 비교라 구현 비용도 몇 줄이었다. **기각한 대안**: 발행을 구현할 때 인가를 함께 더하기. 발행 작업이 인가 추가를 기억해야 하는 절차 의존이라 누락이 재발할 위험이 커서 기각했다. 이후 발행(`emitNotificationEvent`)이 실제로 들어오면서 이 선제 배치가 의도대로 인가를 갖춘 채 활성화됐다.

### 여러 서버 인스턴스 전달에 Socket.IO Redis adapter 를 쓴 이유 (2026-11-14)

NERV Task `CLE-T-4YT18G` 에서 사람이 정한 결정이다. 그 전에는 채널 발행이 자기 서버 인스턴스의 소켓에만 닿았다. k8s 배포는 서버 인스턴스를 여럿 띄우고(기본 매니페스트 2, prod 3) sticky session 설정이 없으며 실행 세그먼트는 아무 서버 인스턴스의 워커에서나 돈다. 그래서 에디터가 붙은 서버 인스턴스와 세그먼트를 돈 서버 인스턴스가 다르면 실시간 실행 이벤트가 오지 않았다. 인앱 알림도 같았다.

- **결정**: 게이트웨이에 Socket.IO Redis adapter 를 건다(§4.6). 채널 발행 코드와 실행 엔진은 바꾸지 않는다.
- **기각한 대안**: EIA SSE 와 같은 방식의 자체 Redis 중계(채널에 로컬 구독자가 있는 동안만 SUBSCRIBE). 구독자가 있는 서버 인스턴스만 패킷을 받아 트래픽이 적다. 대신 채널별 참조 수를 구독 · 해제 · 연결 끊김마다 맞춰야 해서 코드와 테스트가 크다. 새 의존성을 받는 대신 라이브러리 표준 경로를 골랐다.
- **기각한 대안**: sticky session. 이벤트를 만드는 곳은 소켓이 붙은 서버 인스턴스가 아니라 세그먼트를 가져간 워커라 sticky 로는 이벤트가 구독자에게 모이지 않는다. [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md) 의 EIA SSE 결정과 같은 이유다.
- **받아들인 비용**: 모든 서버 인스턴스가 모든 채널 패킷을 받는다. 서버 인스턴스가 늘어 Redis 트래픽이 문제가 되면 채널별 구독 방식을 다시 검토한다.
- **채널 등재**: `ws:sio` 접두를 [비동기 큐와 Redis 키 목록 「pub/sub 채널」](../CLE-PLAT/CLE-PLAT-QUEUE.md#pubsub-채널) 의 채널 목록과 [Redis 키 명명 규약 「라이브러리가 이름을 정하는 것」](../CLE-ENG/CLE-ENG-REDIS.md#라이브러리가-이름을-정하는-것) 에 올렸다(NERV Task `CLE-T-GDR39Z`). 채널 이름은 라이브러리가 정하는 `#` 구분 형식이라 명명 규약의 키 형태 규칙(규칙 1)을 따르지 않는다. websocket 모듈은 이미 `exec:seq` 접두를 쓰므로 접두를 늘리지 않는다는 규칙 6 의 예외이기도 하다. 두 예외는 명명 규약의 「라이브러리가 이름을 정하는 것」 절과 규칙 6 에 적었다.

### 실행 단위 메모리 항목을 유휴 TTL 과 상한으로 회수하는 이유

결정일: 2026-11-15

NERV Task `CLE-T-4J965H` 가 구현했고 `CLE-T-7PTJAS` 가 스펙에 적었다. `seq` 메모리 미러(§3.2)와 실행 라우팅 정보(§4.6)는 종료 이벤트를 보낸 서버 인스턴스에서만 풀린다. 실행 세그먼트와 재개는 아무 서버 인스턴스에서나 돌므로 실행을 park 한 서버 인스턴스와 끝낸 서버 인스턴스가 다를 수 있다. 그러면 park 한 쪽의 항목은 풀리지 않고 쌓인다.

- **유휴 TTL 을 Redis 키의 TTL 과 같게 둔 이유**: 미러가 Redis 키보다 먼저 사라지면 Redis 를 쓸 수 없게 됐을 때 이어받을 최고값을 잃는다. 두 값이 같으면 유휴 TTL 이 지났을 때 Redis 키도 이미 만료됐으므로 미러를 잃어 생기는 차이가 없다.
- **상한을 둔 이유**: 유휴 TTL 만으로는 그 시간(기본 24시간) 안에 쌓이는 항목 수를 묶지 못한다. 상한이 서버 인스턴스 하나가 붙드는 항목 수를 묶는다.
- **받아들인 비용**: 상한 때문에 항목을 지우면 두 가지를 잃을 수 있다. Redis 를 쓸 수 없는 구간에 미러를 잃은 실행은 `seq` 가 1부터 다시 나갈 수 있다. 진행 중인 실행의 라우팅 정보를 잃으면 그 뒤 이벤트의 외부 전달이 빠진다. 상한은 서버 인스턴스 하나가 동시에 붙드는 실행 수보다 훨씬 크게 잡았으므로 두 경우 모두 드물다.

### 구독 실패 응답에 요청한 채널을 싣는 이유 (2026-11-19)

NERV Task `CLE-T-A338CH` 에서 정한 결정이다. 같은 소켓이 실행 채널과 Background 카드 채널을 함께 구독한다. 그런데 실패 응답에는 채널이 없었다. 그래서 에디터는 다른 채널의 실패를 이 실행의 실패로 읽고 REST 폴링을 켰다. 예를 들면 `background:run:` 구독이 한도(20)나 인가로 거부된 경우다.

- **결정**: 실패 응답에도 요청한 `channel` 을 싣는다(§4.4). 성공 응답 형식 `{ success: true, channel }` 과 `error` 문자열, `code` 는 바꾸지 않는다.
- **옛 클라이언트**: 추가 필드라 옛 클라이언트에는 영향이 없다.
- **형식이 틀린 문자열도 그대로 돌려주는 이유**: 클라이언트는 자기가 보낸 값과 응답의 `channel` 을 비교한다.
- **문자열이 아닌 값을 빼는 이유**: 문자열이 아닌 값은 채널로 돌려줄 수 없다.
- **`channel` 이 없는 응답을 자기 실패로 보는 이유**: 서버와 클라이언트를 어느 순서로 배포해도 옛 서버와 함께 동작하게 하려는 것이다.
- **받아들인 비용**: 클라이언트는 `channel` 이 없는 실패 응답을 자기 실패로 본다. 그래서 옛 서버와 새 클라이언트가 함께 도는 동안에는 다른 채널의 실패로 폴링이 켜지는 일이 남는다. 이 실행의 데이터가 오면 폴링이 꺼지므로 이 비용을 받아들인다.
- **존재 추론**: 돌려주는 `channel` 은 클라이언트가 보낸 값 그대로다. 서버가 아는 정보를 더하지 않으므로 리소스가 있는지 드러내지 않는다. 거부 사유는 지금처럼 `code` 와 `error` 로만 알린다.
