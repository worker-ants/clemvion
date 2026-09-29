---
id: "CLE-EIA-INBOUND"
title: "EIA 수신 API와 SSE"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-EIAIN-001", "REQ-EIAIN-002", "REQ-EIAIN-003", "REQ-EIAIN-004", "REQ-EIAIN-005", "REQ-EIAIN-006", "REQ-EIAIN-007", "REQ-EIAIN-008", "REQ-EIAIN-009", "REQ-EIAIN-010", "REQ-EIAIN-011", "REQ-EIAIN-012", "REQ-EIAIN-013", "REQ-EIAIN-014", "REQ-EIAIN-015", "REQ-EIAIN-016", "REQ-EIAIN-017", "REQ-EIAIN-018", "REQ-EIAIN-019", "REQ-EIAIN-020", "REQ-EIAIN-021", "REQ-EIAIN-022", "REQ-EIAIN-023", "REQ-EIAIN-024", "REQ-EIAIN-025", "REQ-EIAIN-026", "REQ-EIAIN-027", "REQ-EIAIN-028", "REQ-EIAIN-029", "REQ-EIAIN-030", "REQ-EIAIN-031", "REQ-EIAIN-032", "REQ-EIAIN-033", "REQ-EIAIN-034", "REQ-EIAIN-035", "REQ-EIAIN-036", "REQ-EIAIN-037", "REQ-EIAIN-038", "REQ-EIAIN-039"]
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "259ef776b4dc25f78790ffde53195428f100af22ab60a44264863e8cdfef7818"
read_as: "approved"
task: null
source_paths: ["spec/5-system/14-external-interaction-api.md"]
mirror_sha256: "7483876c5b8f3318a7d1e0d64fb2ee688631428b9d318d9da21735de3a58b0c5"
etag: "sha256-d4c1539ed06ca72161c1686bc6f45e2eebfdd470bf95a39cd827210cf51777da"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/14-external-interaction-api.md` (§3.2, §5, §11, Rationale R3·R5·R8·R11·R13·R14·R16·R17 앞부분·R18·R-replay-unavailable) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

인바운드 인터랙션(Inbound Interaction)은 외부 클라이언트가 실행 중인 워크플로우에 명령을 보내고 실행 이벤트를 받는 채널이다. 명령은 REST 로 보내고, 이벤트는 SSE(Server-Sent Events) 스트림으로 받는다. 현재 상태가 필요하면 단발 조회를 쓴다.

이 문서는 `/api/external/executions/:executionId` 아래 다섯 엔드포인트를 정한다.

| 엔드포인트 | 용도 |
|---|---|
| `POST /api/external/executions/:executionId/interact` | 인터랙션 명령 제출 |
| `GET /api/external/executions/:executionId/stream` | SSE 이벤트 스트림 |
| `GET /api/external/executions/:executionId` | 현재 상태 단발 조회 |
| `POST /api/external/executions/:executionId/cancel` | 명시적 취소(`interact` 의 `cancel` 별칭) |
| `POST /api/external/executions/:executionId/refresh-token` | 실행 단위 토큰 갱신 |

여기에 멱등 키 규칙, 동시성, 내부 WebSocket 명령·이벤트와의 대응을 함께 적는다.

범위 밖: 인터랙션 토큰의 종류·발급·폐기와 레이트 리밋·CORS 는 [External Interaction API](CLE-EIA.md), 알림 웹훅과 이벤트 봉투·종결 이벤트 필드는 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md), 저장소와 데이터 흐름은 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 외부로 나가는 값의 자격 증명 가리기는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다. 내부 WebSocket 명령·이벤트의 권위 있는 정의와 대응표는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 에 있다.

## 요구사항

- REQ-EIAIN-001 WHEN 외부 클라이언트가 `POST /api/external/executions/:executionId/interact` 로 요청하면 THE SYSTEM SHALL 본문의 `command` 를 인터랙션 명령으로 처리한다. (원본: EIA-IN-01)
- REQ-EIAIN-002 WHEN `/interact` 가 `submit_form`·`click_button`·`submit_message`·`end_conversation` 을 받으면 THE SYSTEM SHALL 같은 이름의 WebSocket 명령과 같은 뜻으로 처리한다. (원본: EIA-IN-02)
- REQ-EIAIN-003 WHEN `/interact` 가 `cancel` 을 받으면 THE SYSTEM SHALL REST 취소 경로로 실행을 멈춘다. (원본: EIA-IN-02)
- REQ-EIAIN-004 IF `/interact` 가 지원하지 않는 명령(`retry_last_turn` 포함)이나 필수 필드가 빠진 명령을 받으면 THE SYSTEM SHALL `400 INVALID_COMMAND` 로 거부한다. (원본: EIA-IN-02, §5.1)
- REQ-EIAIN-005 WHEN 인바운드 명령을 받으면 THE SYSTEM SHALL 즉시 `202 Accepted` 와 ack 본문(`executionId`·`accepted`·`currentStatus`)을 돌려주고 워크플로우 진행은 백그라운드에서 한다. (원본: EIA-NF-04, R16)
- REQ-EIAIN-006 WHEN 클라이언트가 `GET /api/external/executions/:executionId/stream` 을 열면 THE SYSTEM SHALL SSE 스트림으로 실행 이벤트를 보내고 종료 이벤트(`completed`·`failed`·`cancelled`)를 보낸 뒤 연결을 닫는다. (원본: EIA-IN-03)
- REQ-EIAIN-007 WHEN SSE 이벤트를 보내면 THE SYSTEM SHALL `id:` 필드에 그 실행의 이벤트 순번(`seq`)을 싣는다. (원본: EIA-IN-07)
- REQ-EIAIN-008 WHEN 클라이언트가 `Last-Event-Id` 헤더나 `?lastEventId=` 로 다시 연결하면 THE SYSTEM SHALL 5분 재전송 버퍼에서 그 순번 뒤의 이벤트를 손실 없이 다시 보낸다. (원본: EIA-IN-07, EIA-NF-03)
- REQ-EIAIN-009 WHEN 첫 연결에 `?lastEventId=0` 을 명시하면 THE SYSTEM SHALL 버퍼에 있는 순번 1 이상의 이벤트를 모두 다시 보낸다. (원본: EIA-IN-07)
- REQ-EIAIN-010 IF 재전송 버퍼가 요청 범위를 다 채우지 못하면 THE SYSTEM SHALL 부분 재전송 대신 `execution.replay_unavailable` 을 한 번 보내고 연결을 유지한다. (원본: EIA-NF-03, R-replay-unavailable)
- REQ-EIAIN-011 WHEN 실행 순번을 배정받지 않는 제어 프레임(`execution.replay_unavailable`)을 보내면 THE SYSTEM SHALL SSE `id:` 줄을 생략한다. (원본: §5.2)
- REQ-EIAIN-012 WHILE SSE 연결이 열려 있는 동안 THE SYSTEM SHALL 15초마다 `: heartbeat` 주석 줄을 보낸다. (원본: EIA-IN-08)
- REQ-EIAIN-013 IF 한 실행의 SSE 동시 연결이 3개를 넘으면 THE SYSTEM SHALL `429 TOO_MANY_CONNECTIONS` 로 거부한다. (원본: EIA-IN-09)
- REQ-EIAIN-014 WHEN 백엔드가 이벤트를 내면 THE SYSTEM SHALL 같은 리전의 SSE 클라이언트가 평균 100ms 안에 받게 한다. (원본: EIA-NF-02)
- REQ-EIAIN-015 WHEN 버튼 없이 자동으로 진행하는 Presentation 노드(`carousel`·`table`·`chart`·`template`)가 완료되면 THE SYSTEM SHALL SSE 로 `execution.message` 를 보낸다. (원본: §5.2, R18)
- REQ-EIAIN-016 WHEN 클라이언트가 `GET /api/external/executions/:executionId` 를 부르면 THE SYSTEM SHALL `status`·`currentNode`·`context`·`result`·`error`·`durationMs`·`seq`·`updatedAt` 를 담은 현재 상태를 돌려준다. (원본: EIA-IN-04)
- REQ-EIAIN-017 WHILE 실행이 입력 대기인 동안 THE SYSTEM SHALL 상태 조회의 `currentNode` 와 `context` 를 대기 중인 노드 실행 출력에서 복원해 SSE `waiting_for_input` 과 같은 형식으로 채운다. (원본: §5.3)
- REQ-EIAIN-018 WHILE 실행이 입력 대기인 동안 THE SYSTEM SHALL 상태 조회 `context.conversationThread` 에 영속 대화 스레드 스냅샷을 싣고, 스냅샷이 없으면 키를 생략한다. (원본: §5.3)
- REQ-EIAIN-019 WHEN 상태 조회에 응답하면 THE SYSTEM SHALL `seq` 에 항상 `0` 을 싣는다. (원본: §5.3)
- REQ-EIAIN-020 WHEN `POST /cancel` 을 받으면 THE SYSTEM SHALL `interact` 의 `command: "cancel"` 과 같게 처리하고 같은 ack 본문을 돌려준다. (원본: EIA-IN-05, §5.4)
- REQ-EIAIN-021 WHEN 실행 단위 토큰으로 `POST /refresh-token` 을 부르고 만료까지 30분 이내이면 THE SYSTEM SHALL 옛 jti 를 폐기하고 새 토큰과 `expiresAt` 을 돌려준다. (원본: §5.5)
- REQ-EIAIN-022 IF 트리거 단위 토큰(`itk_*`)으로 `refresh-token` 을 부르면 THE SYSTEM SHALL `403 TOKEN_REFRESH_FORBIDDEN` 으로 거부한다. (원본: §5.5)
- REQ-EIAIN-023 IF 만료까지 30분 넘게 남은 토큰으로 `refresh-token` 을 부르면 THE SYSTEM SHALL `400 TOKEN_REFRESH_NOT_IN_WINDOW` 로 거부한다. (원본: §5.5)
- REQ-EIAIN-024 IF `refresh-token` 대상 실행이 종료됐거나 없으면 THE SYSTEM SHALL `410 EXECUTION_TERMINATED` 를 돌려준다. (원본: §5.5)
- REQ-EIAIN-025 WHEN 인바운드 요청이 오면 THE SYSTEM SHALL 인터랙션 토큰으로 인증한다. (원본: EIA-IN-06)
- REQ-EIAIN-026 IF 토큰 검증이 실패(위조·형식 오류·만료·폐기·범위 불일치·용도 불일치)하면 THE SYSTEM SHALL 핸들러 전에 `401` 과 `TOKEN_*` 코드로 거부한다. (원본: §5.1, R14)
- REQ-EIAIN-027 WHEN 토큰 검증 실패로 401 을 돌려주면 THE SYSTEM SHALL `X-Refresh-Token-Url` 응답 헤더로 갱신 경로를 알린다. (원본: EIA-AU-06)
- REQ-EIAIN-028 IF `submit_form` 의 필드 검증이 실패하면 THE SYSTEM SHALL 실행 상태를 입력 대기로 유지하고 `400 VALIDATION_ERROR` 와 `details[]`(`{ field, message, code }`)를 돌려준다. (원본: EIA-IN-10, EIA-RL-03)
- REQ-EIAIN-029 IF `submit_message` 의 `message` 가 10000자를 넘으면 THE SYSTEM SHALL 내부 길이 값을 밝히지 않는 고정 메시지로 `400 MESSAGE_TOO_LONG` 을 돌려준다. (원본: §5.1)
- REQ-EIAIN-030 IF 이미 종료된 실행에 명령을 보내면 THE SYSTEM SHALL `410 EXECUTION_TERMINATED` 를 돌려준다. (원본: EIA-IN-12 · 정상 경로 코드는 [미결 사항](#미결-사항))
- REQ-EIAIN-031 IF 명령이 현재 실행·노드 상태나 대기 노드의 대기 표면과 맞지 않거나 `nodeId` 가 실제 대기 노드와 다르면 THE SYSTEM SHALL `409 STATE_MISMATCH` 를 돌려준다. (원본: EIA-IN-13)
- REQ-EIAIN-032 WHEN 같은 실행의 같은 노드에 명령 두 개가 동시에 오면 THE SYSTEM SHALL 먼저 온 명령만 처리하고 나중 명령에 `409 STATE_MISMATCH` 를 돌려준다. (원본: EIA-NF-05)
- REQ-EIAIN-033 WHEN 명령에 `Idempotency-Key` 헤더가 있으면 THE SYSTEM SHALL 같은 실행·같은 경로 안에서 그 키의 응답을 24시간 캐시하고 같은 키의 재요청에 같은 응답을 돌려준다. (원본: EIA-IN-11, EIA-RL-02)
- REQ-EIAIN-034 IF 같은 멱등 키로 다른 본문을 보내면 THE SYSTEM SHALL `409 IDEMPOTENCY_KEY_CONFLICT` 를 돌려준다. (원본: EIA-IN-11)
- REQ-EIAIN-035 WHEN 토큰이 갱신된 뒤 같은 실행에 같은 멱등 키로 다시 보내면 THE SYSTEM SHALL 갱신 전과 같은 응답을 돌려준다. (원본: EIA-RL-02)
- REQ-EIAIN-036 WHEN 명령 응답을 캐시할지 정하면 THE SYSTEM SHALL `2xx`·`409`·`410` 만 캐시하고 `400 VALIDATION_ERROR`·그 밖의 `400`·`5xx` 는 캐시하지 않는다. (원본: R8)
- REQ-EIAIN-037 IF 멱등 캐시용 Redis 를 쓸 수 없거나 캐시 항목이 손상됐으면 THE SYSTEM SHALL 멱등성을 포기하고 요청을 새로 처리하며 경고 로그를 남긴다. (원본: R8)
- REQ-EIAIN-038 IF 가드가 합성한 요청 컨텍스트(`req.interaction`)가 없으면 THE SYSTEM SHALL 멱등 캐시를 건너뛰고 전역 키로 대신하지 않는다. (원본: R8)
- REQ-EIAIN-039 WHEN SSE·상태 조회로 노드 출력과 대화 스레드를 내보내면 THE SYSTEM SHALL 디버그 전용 필드(`llmCalls` 등)를 깊이와 관계없이 빼고 자격 증명 값을 가린다. (원본: §6.2, R17)

## 공통 규칙

- **전송 봉투**: 아래 성공 응답 JSON 은 논리 payload 다. 실제 응답은 전역 `TransformInterceptor` 가 응답 봉투(`{ "data": { ... } }`)로 감싼다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)). 예를 들어 상태 조회 응답은 `{ "data": { "id", "status", ... } }`, 토큰 갱신은 `{ "data": { "token", "expiresAt" } }` 다. 클라이언트는 `res.data` 를 풀어 읽는다. SSE 프레임(`data: <payload>`)만 인터셉터를 거치지 않아 봉투가 없다.
- `interact`·`cancel` 은 비동기라 `202 Accepted` 로 답하지만 본문이 없는 응답이 아니다. 둘 다 `InteractAckDto`(`{ executionId, accepted, currentStatus }`)를 응답 봉투에 담아 돌려준다.
- **에러 응답**: `{ "error": { "code", "message", "requestId", "details" } }` 형태의 에러 응답 봉투를 따른다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 웹훅 진입점도 같은 봉투를 쓴다.
- **인증**: `Authorization: Bearer <iext_jwt | itk_token>` 을 쓴다. SSE 만 브라우저 `EventSource` 가 헤더를 못 보내므로 `?token=` 쿼리를 허용한다. 토큰 규칙은 [External Interaction API](CLE-EIA.md) 에서 정한다.
- **경로**: 모든 엔드포인트는 `/api/external/executions/:id` 아래에 있다. 기존 `/api/executions/*` 와 prefix·인증 계열이 다르다.

## 인터랙션 명령 제출

```
POST /api/external/executions/{executionId}/interact
Authorization: Bearer <iext_jwt | itk_token>
Content-Type: application/json
Idempotency-Key: <client-uuid>   // 권장
```

본문 필드는 명령마다 다르다.

| `command` | 추가 필드 | 적용 노드 | 대응 WebSocket 명령 |
|---|---|---|---|
| `submit_form` | `nodeId`, `data: { [field]: value }` | Form | `execution.submit_form`(WS 의 `formData` 가 REST 의 `data`) |
| `click_button` | `nodeId`, `buttonId` | Carousel·Table·Chart·Template(버튼) | `execution.click_button` |
| `submit_message` | `nodeId`, `message` | AI Agent·정보 추출기 노드(멀티턴) | `execution.submit_message` |
| `end_conversation` | `nodeId`, `reason?` | AI Agent·정보 추출기 노드(멀티턴) | `execution.end_conversation` |
| `cancel` | `reason?` | 실행 전체 | `execution.stop` 개념. WS 명령은 채택하지 않았으므로 REST 취소로 처리한다. 외부에서는 `force` 옵션을 지원하지 않는다 |

`retry_last_turn` 은 내부 UI 전용이라 포함하지 않는다. 외부에 열려면 `per_execution` 토큰 권한 매트릭스, 알림 흐름과의 정합, 재시도 횟수 제한 정책을 따로 정해야 한다.

폼 제출 예시:

```json
POST /api/external/executions/550e8400-.../interact
{
  "command": "submit_form",
  "nodeId":  "f7b9c1d2-...",
  "data":    { "approver": "alice", "amount": 1000, "comment": "OK" }
}
```

성공 응답(`202 Accepted`):

```json
{
  "executionId": "uuid",
  "accepted":    true,
  "currentStatus": "running"
}
```

명령을 받은 직후 다음 노드가 곧바로 다시 입력 대기에 들어갈 수 있다. 최신 상태는 SSE 스트림이나 상태 조회로 확인한다.

### 명령 에러

폼 검증 실패 예시:

```jsonc
{
  "error": {
    "code":    "VALIDATION_ERROR",
    "message": "Form validation failed",
    "requestId": "3f2a…",
    "details": [
      { "field": "amount", "message": "must be >= 100 (got 50)", "code": "INVALID_FIELD" }
    ]
  }
}
```

| 상태 | 코드 | 조건 |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `submit_form` 필드 검증 실패. `error.details[]`(`{ field, message, code: "INVALID_FIELD" }`)를 본다. 실행은 입력 대기 그대로라 다시 제출할 수 있다. 필드 검증(필수·type(email·number)·`validation.minLength`/`maxLength`·`min`/`max`·`pattern`·select/radio 선택지·`type:'file'` MIME·크기·개수)은 publisher 쪽 `continueExecution` 에서 노드 설정의 필드 정의로 한다. `FormValidationError` 를 이 코드로 바꾼다. EIA·WS·UI 세 경로가 같다([Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md)) |
| `400` | `INVALID_COMMAND` | 지원하지 않는 명령, 필수 필드 누락 |
| `400` | `MESSAGE_TOO_LONG` | `submit_message` 의 `message` 가 10000자 초과. publisher 쪽 동기 검증(`MessageTooLongError`)을 EIA 로 옮긴 것이다. WS 의 `EXECUTION_MESSAGE_TOO_LONG` 과 같은 뜻이다. 내부 길이 값은 응답에 싣지 않고 고정 메시지만 돌려준다 |
| `400` | `TOKEN_REFRESH_NOT_IN_WINDOW` | 토큰 갱신 전용. 만료까지 30분(`IEXT_REFRESH_WINDOW_SEC`) 넘게 남아 아직 갱신할 때가 아니다. `message` 에 사유(`reason`)를 싣는다 |
| `400` | `TOKEN_REFRESH_FAILED` | 토큰 갱신 전용. 갱신이 토큰을 돌려주지 못함(앞 분기에서 걸렀어야 하는 경로의 안전망) |
| `401` | `TOKEN_INVALID` / `TOKEN_EXPIRED` | 토큰 위조·형식 오류·만료 |
| `401` | `TOKEN_REVOKED` | 실행 종료나 갱신으로 토큰이 즉시 무효가 됨(jti 블랙리스트). 실행이 이미 끝나 갱신으로 되살릴 수 없다 |
| `401` | `TOKEN_SCOPE_MISMATCH` | 토큰 범위가 그 실행과 다름(다른 실행의 토큰). 인가 실패지만 정보 노출을 줄이려고 403 대신 401 로 통일한다 |
| `401` | `TOKEN_AUDIENCE_MISMATCH` | 토큰 `aud` 가 `interaction` 이 아님(다른 용도 토큰) |
| `403` | `TOKEN_REFRESH_FORBIDDEN` | 토큰 갱신 전용. `itk_*` 는 영구 토큰이라 갱신 대상이 아니다. 검증을 통과한 토큰이 없는 기능을 부른 경우라 401 통일 대상이 아니다 |
| `404` | `EXECUTION_NOT_FOUND` | executionId 가 없음. 토큰 갱신은 예외로, 없는 실행도 `410` 이다 |
| `409` | `STATE_MISMATCH` | 현재 노드·실행 상태와 명령이 맞지 않음. 예: 완료된 실행에 `submit_message`, 다른 `nodeId`, 대기 표면과 명령 불일치(`buttons` 대기에 `submit_form`, `form` 대기에 `end_conversation`). 대기 표면별 허용 명령은 `form`=`submit_form`, `buttons`=`click_button`, `ai_conversation`·`ai_form_render`=네 가지 모두다 |
| `409` | `IDEMPOTENCY_KEY_CONFLICT` | 같은 멱등 키에 다른 본문 |
| `410` | `EXECUTION_TERMINATED` | 실행이 이미 `completed`·`failed`·`cancelled`. 토큰 갱신에서도 같은 코드를 쓰고 거기선 없는 실행도 포함한다. 실행 단위 토큰은 종료 때 폐기되므로 명령의 정상 경로에서는 가드의 `401 TOKEN_REVOKED` 가 먼저 나온다. 어느 코드를 정상 응답으로 둘지는 [미결 사항](#미결-사항) 참조 |
| `429` | `RATE_LIMITED` | 실행별 인바운드 한도 초과(`/interact` 분당 60, 상태 조회 분당 120). `InteractionRateLimitGuard` 가 `Retry-After`(남은 윈도우 초)와 함께 돌려준다. 시스템 전역 기본 코드를 그대로 쓰며, SSE 동시 연결 초과의 `TOO_MANY_CONNECTIONS` 와는 별개다. WS 의 같은 이름 코드와도 발행 위치가 다르다. 한도 값은 [External Interaction API](CLE-EIA.md) 에서 정한다 |

- **`X-Refresh-Token-Url` 헤더**: 위의 `401 TOKEN_*` 응답에는 `InteractionGuard.deny()` 가 이 헤더를 항상 붙인다. 클라이언트가 갱신 엔드포인트를 한결같이 찾게 하려는 것이다. 다만 `TOKEN_REVOKED`(실행 종료)와 `TOKEN_SCOPE_MISMATCH`·`TOKEN_AUDIENCE_MISMATCH`(범위·용도 불일치)는 헤더를 따라가도 새 토큰을 받지 못할 수 있다. 되살릴 수 없다는 신호다.
- **토큰 실패의 401 통일**: 토큰 검증 실패 다섯 가지(`invalid`·`expired`·`revoked`·`scope`·`audience`)는 모두 `401` 이다. 여기서 검증 실패는 `InteractionGuard` 가 핸들러 전에 판정하는 것을 말한다. `403 TOKEN_REFRESH_FORBIDDEN` 은 검증을 통과한 토큰이 갱신 경로를 잘못 쓴 경우라 이 통일 밖이다. 근거는 [토큰 검증 실패는 모두 401](#토큰-검증-실패는-모두-401) 참조.
- **코드 네임스페이스**:
  1. `TOKEN_INVALID`·`TOKEN_EXPIRED` 는 워크스페이스 JWT 계층의 코드와 문자열이 같다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). 여기서는 인터랙션 토큰(`iext_*`·`itk_*`) 검증 실패를 뜻하며, 진입 경로(`/api/external/*`)와 토큰 계열로 층을 가른다.
  2. `EXECUTION_NOT_FOUND`(404)는 순수한 부재만 뜻한다. 워크스페이스·범위 경계 위반은 먼저 `TOKEN_SCOPE_MISMATCH`(401)로 처리하므로 존재 여부가 새지 않는다.
  3. `VALIDATION_ERROR`·`details[]` 는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 기본값을 따른다. `INVALID_COMMAND`·`MESSAGE_TOO_LONG`·`TOO_MANY_CONNECTIONS`·`STATE_MISMATCH`·`EXECUTION_TERMINATED`·`TOKEN_REFRESH_NOT_IN_WINDOW`·`TOKEN_REFRESH_FAILED`·`TOKEN_REFRESH_FORBIDDEN` 은 EIA 전용 코드로 규약 기본값을 일부러 덮는다.

### 실행 엔진 에러와 EIA 코드의 대응

같은 publisher 쪽 명령 사전 검증을 WebSocket ack 와 EIA REST 가 함께 쓴다. 코드 이름은 각 경로의 관례를 따르고, 뜻이 같다는 관계를 아래 표로 고정한다. 검증 규칙 자체는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 가 정한다.

| 실행 엔진 typed error | WS ack `errorCode` | EIA REST |
|---|---|---|
| `InvalidExecutionStateError` | `INVALID_EXECUTION_STATE` | `409 STATE_MISMATCH` |
| `MessageTooLongError` | `EXECUTION_MESSAGE_TOO_LONG` | `400 MESSAGE_TOO_LONG` |
| `FormValidationError` | `VALIDATION_ERROR` | `400 VALIDATION_ERROR`(+ `details[]`) |

이 대응은 EIA REST 의 실행 상태·메시지 에러 코드에 한한다. 같은 뜻의 내부 REST 코드는 `INVALID_STATE`(422)를 쓴다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). 토큰 인증 실패 코드(`TOKEN_*`)는 위 에러 표가 정한다.

## SSE 이벤트 스트림

```
GET /api/external/executions/{executionId}/stream
Authorization: Bearer <iext_jwt | itk_token>   # 브라우저 EventSource 는 ?token=<jwt> 허용
Accept: text/event-stream
Last-Event-Id: 42                              # 다시 연결할 때(선택)
```

스트림 형식 예시:

```text
event: execution.started
id: 1
data: {"executionId":"550e8400-...","workflowId":"...","mode":"production","startedAt":"..."}

event: execution.node.started
id: 2
data: {"executionId":"...","nodeId":"...","nodeType":"manual_trigger"}

event: execution.waiting_for_input
id: 3
data: { ... 알림 웹훅과 같은 안쪽 객체 ... }

: heartbeat

event: execution.resumed
id: 4
data: {"executionId":"...","nodeId":"..."}

event: execution.completed
id: 99
data: { ... 알림 웹훅과 같은 안쪽 객체 ... }
```

`: heartbeat` 는 15초마다 보내는 주석 줄이다. 이벤트가 아니며, 프록시의 유휴 연결 끊김을 막는다.

### 이벤트 종류

SSE 는 알림 웹훅 이벤트(`execution.waiting_for_input`·`completed`·`failed`·`cancelled`·`ai_message`)에 더해 다음 이벤트도 보낸다.

- 노드 이벤트: `execution.node.started`·`execution.node.completed`·`execution.node.failed`·`execution.node.cancelled`·`execution.node.skipped`
- 대화·진행 이벤트: `execution.message`·`execution.user_message`·`execution.tool_call_started`·`execution.tool_call_completed`·`execution.resumed`
- 실행 시작 `execution.started`, 제어 프레임 `execution.replay_unavailable`

각 이벤트의 필드는 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 과 같다. SSE 는 봉투 차원에서 WS 와 같은 평면 객체에 `triggerId`·`workflowId` 를 더하고, 알림 웹훅의 `payload` 래퍼는 없다. 채널별 봉투 차이와 종결 이벤트 필드 집합, `waiting_for_input` 의 실제 필드 이름은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 이 정한다.

디버그 전용 필드(`nodeOutput.meta.turnDebug[].llmCalls` 같은 원본 LLM 요청·응답)는 필드 이름 기준으로 깊이와 관계없이 빠진다. 인증된 내부 WS(에디터)에만 남는다. 노드 출력 키 허용 목록과 자격 증명 값 가리기의 적용 범위는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

### 표시 메시지 이벤트

표시 메시지 이벤트(`execution.message`)는 버튼 없이 자동으로 진행하는(non-blocking) Presentation 노드(`carousel`·`table`·`chart`·`template`)가 완료될 때 보내는 실행 수준 이벤트다. AI 가 만든 `execution.ai_message` 와 뜻이 다른 정적 표시 메시지다.

```json
{
  "executionId": "550e8400-...",
  "nodeId": "<graph uuid>",
  "nodeType": "template",
  "presentations": [{ "config": { "outputFormat": "markdown" }, "output": { "rendered": "..." } }],
  "seq": 12,
  "timestamp": "..."
}
```

- `presentations[i]` 는 `{ config, output }` 평면 객체다. AI Agent `render_*` 의 표시물 페이로드(`PresentationPayload`, [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md))와 같은 위젯 렌더 경로(`classifyPresentation`)를 탄다. 다만 `PresentationPayload` 의 `{ type, toolCallId, renderedAt, payload }` 래핑 없이 핸들러 구조 출력(`adaptHandlerReturn` 의 config·output)을 그대로 싣는다.
- 5분 재전송 대상이다(`id`=순번). 노드 수준 `execution.node.completed` 와 별개다. 후자는 모든 비차단 노드의 디버깅용 전체 이벤트이고, `execution.message` 는 Presentation 네 종류만 싣는 EIA 표시 이벤트다. EIA 클라이언트가 전체 이벤트를 직접 구독하지 않게 하려는 것이다.
- 불변식: 위젯·EIA 클라이언트는 비차단 Presentation 노드의 렌더를 `execution.message` 에서만 받고 `execution.node.completed` 는 무시한다. 반대로 채팅 채널 어댑터는 계속 `execution.node.completed` 를 받는다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)). 그래서 두 경로가 같은 내용을 두 번 보내지 않는다.
- 이 이벤트는 SSE 에만 더한 것이다. 서버 간 알림 웹훅 화이트리스트에는 없다.
- 참조 구현: `codebase/channel-web-chat/src/lib/eia-events.ts` 의 `parseMessage`.

### 스트림 규칙

- `id` 필드는 그 실행의 이벤트 순번(`seq`)이다. WebSocket 이벤트 래퍼의 순번, 알림 웹훅의 `seq` 와 같은 값이다.
- `Last-Event-Id` 헤더나 `?lastEventId=` 쿼리로 다시 연결하면 5분 재전송 버퍼(SSE replay buffer)에서 놓친 이벤트를 다시 보낸다.
- 첫 연결에서 `?lastEventId=0` 을 명시하면 버퍼의 순번 1 이상 이벤트를 모두 다시 보낸다. 구독 전에 지나간 이벤트를 채울 수 있고, 상태 조회 시드와 함께 쓴다.
- 버퍼가 요청 범위를 다 채우지 못하면(만료나 상한 초과로 중간 순번 유실) `execution.replay_unavailable` 을 한 번 보낸다. 클라이언트는 상태 조회로 현재 상태를 다시 읽는다. 구현은 `sse-adapter.service.ts` 의 `replayOrSignalUnavailable` 이다. 다시 보낼 수 있는 가장 이른 순번이 `Last-Event-Id + 1` 이 아니면 부분 재전송 대신 이 신호를 보낸다. payload 는 `{ executionId, lastEventId, message }` 이고 `lastEventId` 는 클라이언트가 마지막으로 받은 순번이다. 버퍼 안의 연속 구간 재전송은 손실 없이 동작한다.
- `execution.replay_unavailable` 은 내부 WS 의 `replay.unavailable` 과 뜻이 같다. SSE 이벤트 이름 규칙(`execution.*`)에 맞추려고 이름만 다르게 했다.
- `execution.replay_unavailable` 은 실행 순번을 배정받지 않는 재연결 응답 전용 제어 프레임이다. 순번 자리에 `0` 을 쓰고 SSE `id:` 줄을 생략한다(`writeSseFrame` 은 순번이 0 이하면 쓰지 않는다). 브라우저 `EventSource` 의 Last-Event-Id 가 `0` 으로 바뀌어 다음 자동 재연결이 전체 재전송을 일으키는 것을 막는다.
- 신호를 보낸 뒤에도 스트림은 닫지 않는다. 위젯은 이 신호를 받으면 상태 조회 스냅샷으로 다시 맞춘다. 스냅샷이 이미 종료 상태면 공백 사이에 종료 이벤트까지 잃은 것이므로 종료를 확정한다. 소비 규칙은 [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) 이 정한다.
- 종료 이벤트(`execution.completed`·`failed`·`cancelled`)를 보낸 뒤 서버가 연결을 닫는다.
- 동시 연결 한도를 넘으면 `429 TOO_MANY_CONNECTIONS` 다.
- 알려진 한계: 버퍼는 서버 메모리에 있어 프로세스가 재시작하면 사라진다. 재시작 직후 새 이벤트가 쌓이기 전에 `lastEventId=N` 으로 다시 연결하면 `seq > N` 이벤트가 버퍼에 없어 최신까지 받은 것으로 잘못 판단하고 신호를 보내지 못할 수 있다. 누락분은 다음 이벤트·스냅샷·상태 조회로 맞춰진다. 영속·분산 버퍼는 분산 SSE fan-out 후속 작업에서 함께 다룬다. 버퍼 크기(5분·최대 1000건)와 단일 인스턴스 한계는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 에 있다.

## 단발 상태 조회

`GET /api/external/executions/:executionId` 는 현재 상태를 한 번 돌려준다.

- `id`·`workflowId`·`status`·`result`·`error`·`updatedAt` 는 실제 값으로 채운다.
- 입력 대기 상태에서는 `currentNode`(id·type·interactionType)와 `context` 도 채운다. 지금 대기 중인 노드 실행 출력(`NodeExecution.outputData` 의 `meta.interactionType` 과 구조화된 `config.buttonConfig`)에서 복원한다. 버튼은 `context.buttonConfig{ buttons, nodeOutput }`, 폼·AI 대화는 `context.nodeOutput` 에 싣는다. SSE `waiting_for_input` 과 같은 형식이라 위젯이 `parseWaitingForInput` 으로 그대로 시드할 수 있다. 빠른 첫 노드(버튼·캐러셀)가 SSE 구독 전에 발행되는 경쟁에서 현재 대기 표면을 되살리는 1차 경로다(`interaction.service.ts` 의 `getStatus()`).
- `context.conversationThread` 에는 영속 대화 스레드 스냅샷(`Execution.conversation_thread`, [대화 스레드](CLE-IX-THREAD.md))을 SSE `waiting_for_input` 과 같은 형식으로 싣는다. 새로고침 복원이 5분 버퍼에 기대지 않고, 버퍼 만료·서버 재시작·인스턴스 전환과 관계없이 전체 기록을 되살리게 하려는 것이다.
- 스냅샷이 없으면(배포 전 행, park 이력 없음) `context.conversationThread` 키를 생략한다. 형제 필드가 `null` 을 쓰는 것과 다르다. SSE 도 있을 때만 싣고, 위젯은 부재를 빈 기록으로 처리한다. 두 부재 표현의 선택 기준은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 부재 표현 규칙이고, 이 필드는 다른 경로와의 형식 일치 사례다.
- `seq` 는 항상 `0` 이다. 단발 응답은 메모리의 순번 카운터에 닿지 않으므로 순번은 SSE 재전송(`Last-Event-Id`, 첫 연결 `lastEventId=0`)이 권위다.

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

## 명시적 취소

```jsonc
POST /api/external/executions/{executionId}/cancel
Authorization: Bearer <iext_jwt | itk_token>
{
  "reason": "user_aborted"   // 선택
}

202 Accepted
{
  "executionId":   "uuid",
  "accepted":      true,         // 명령을 큐에 넣었다
  "currentStatus": "running"     // 선택. 명령을 받은 직후 관측한 상태. 곧 바뀔 수 있어 확정값이 아니다
}
```

`interact` 의 `command: "cancel"` 과 뜻이 같은 편의 별칭이다. 실제 취소가 비동기일 수 있어 `202 Accepted` 로 답한다. ack 는 `interact` 와 같은 `InteractAckDto` 다(`@ApiAcceptedWrappedResponse(InteractAckDto)`). 확정 상태는 SSE `execution.cancelled` 로 받는다. `/cancel` 은 인바운드 명령 레이트 리밋 버킷을 `/interact` 와 함께 쓴다.

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

## 동시성

같은 실행의 같은 노드에 인바운드 명령 두 개가 동시에 오면 나중 명령은 `409 STATE_MISMATCH` 다. 첫 명령이 이미 입력 대기에서 재개로 전이를 일으켜 상태가 바뀌었기 때문이다. 경쟁 상태로 보지 않고 명시적 직렬화로 다룬다. 실행당 동시에 처리하는 명령은 하나다. 클라이언트는 멱등 키를 늘 함께 보내 첫 명령의 응답을 다시 조회해도 같은 결과를 받게 하는 것이 좋다.

## 멱등 키

멱등 키(`Idempotency-Key`)는 `/interact` 와 `/cancel` 에 적용한다(`idempotency.interceptor.ts`).

- **캐시 대상은 닫힌 목록이다**: `2xx`·`409`·`410` 만 캐시한다. `400 VALIDATION_ERROR` 는 캐시하지 않는다. 입력 대기가 유지돼 사용자가 폼을 고쳐 같은 키로 다시 보내는 것이 정상 흐름이기 때문이다. 그 밖의 `400` 과 `5xx` 도 캐시하지 않는다. 다시 시도할 가치가 있는 실패라 캐시하면 재시도 자체를 막는다. 구현에서 이 목록을 조건으로 옮길 때 한 번의 비교로 줄이면 안 된다. `statusCode === 400` 은 다른 400 코드와 5xx 를 캐시 대상으로 만들고, `statusCode >= 400` 은 반대로 `409`·`410` 을 빠뜨린다. 열거를 그대로 조건에 옮긴다.
- **캐시 키 범위**: 헤더 값만 쓰지 않고 `interaction:idempotency:<executionId>:<route>:<key>` 로 묶는다. `<executionId>` 는 가드가 토큰을 검증한 뒤 합성한 값이고, `<route>` 는 `interact` 또는 `cancel` 이다. TTL 은 24시간이다. 키 형태는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 에 있다.
- **범위 단위는 실행이다**: 토큰이 갱신되든, 계열(`iext`·`itk`)이 다르든 같은 실행을 대상으로 한 두 요청은 같은 작업이다.
- **캐시 항목**: `{ bodyHash, responseJson, statusCode }` 다. 같은 키에 본문 해시가 다르면 `409 IDEMPOTENCY_KEY_CONFLICT` 다.
- **fail-open**: Redis 를 쓸 수 없거나(죽었다) 캐시 항목이 손상됐으면(살아 있는데 값이 오염됐다) 멱등성을 포기하고 새로 처리한다. 손상은 항목 형태 불일치나 안쪽 `responseJson` 파싱 실패로 나타나며, 손상 항목은 버리고 경고를 남긴다. `statusCode` 는 타입과 범위를 모두 검사한다. `isHttpStatusCode()` 가 `Number.isInteger` 와 `100`~`599` 를 본다. 이 검사가 없으면 `-1`·`600` 같은 값이 통과해 `res.status(-1)` 이 전송 때 `RangeError` 로 500 을 낸다.
- **경고 로그**: 인터셉터의 실패 경로 다섯 가지는 (1) 기동 때 Redis 미주입, (2) 조회 실패, (3) 적재 실패, (4) 직렬화 실패, (5) 항목·payload 손상이다. (1)만 경고하지 않는다. Redis 를 붙이지 않은 것은 장애로 보지 않고 설정 상태로 보기 때문이다.
- **컨텍스트가 없으면 건너뛴다**: `req.interaction` 이 없으면(가드 미적용 등) 캐시를 건너뛰고, 범위 없는 전역 키로 대신하지 않는다.
- **저하 구간**: 정상일 때도 GET 과 SET 이 원자적이지 않아 좁은 창이 있다. Redis 장애가 이어지는 동안에는 그 창이 장애 구간 전체로 넓어져 같은 키 재요청이 모두 캐시 미스가 되고 다운스트림이 중복 실행될 수 있다. "같은 응답 24시간 재현" 은 정상 경로의 계약이고 저하 구간의 멱등성은 최선 노력이다. 운영자는 Redis 실패율로 이 구간을 알아챌 수 있어야 한다.

## WebSocket 명령·이벤트와의 대응

내부 WebSocket 명령·이벤트와 EIA 사이의 대응표는 [WebSocket 이벤트와 명령 §7](../CLE-API/CLE-API-WS-EVENTS.md#7-외부-표면-매핑-external-interaction-api) 이 권위이고 이 문서는 표를 따로 두지 않는다. 외부 클라이언트가 알아야 할 점만 정리하면 다음과 같다.

- 외부 REST 명령(`/interact` 의 `command`) 네 가지(`submit_form`·`click_button`·`submit_message`·`end_conversation`)는 같은 이름의 내부 `execution.*` 명령과 대응한다. 필드 이름만 `submit_form` 의 WS `formData` 가 REST 에서 `data` 로 다르다.
- `cancel`(와 별칭 `/cancel`)은 실행 중단이라는 개념만 대응한다. WS 명령은 채택하지 않았고 내부·외부 모두 REST 로 처리한다. 외부는 `force` 를 지원하지 않는다.
- 실행 시작은 외부에서 웹훅 트리거로만 한다. 디버깅 명령(`execution.continue`·`execution.step`)과 `execution.retry_last_turn` 은 외부에 노출하지 않는다.
- SSE 이벤트 이름은 내부 이벤트 이름과 같다(노드 취소 `execution.node.cancelled` 도 포함, [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). 알림 웹훅으로는 `waiting_for_input`·`ai_message`(선택 구독)·`completed`·`failed`·`cancelled` 다섯 종만 보낸다.
- 표시 메시지 이벤트 `execution.message` 는 SSE 로만 나가고 알림 웹훅으로는 보내지 않는다([표시 메시지 이벤트](#표시-메시지-이벤트)).
- `execution.replay_unavailable` 은 SSE 재연결 응답 전용이다. 내부 WS 에는 버퍼가 없고 실행 스냅샷 이벤트로 복구한다.

## 미결 사항

- **종료된 실행에 명령을 보냈을 때의 정상 응답 코드**: EIA-IN-12 는 `410 Gone` 이라 적는다. 한편 실행이 끝나면 실행 단위 토큰을 즉시 블랙리스트에 올리고(종료 시 폐기), 가드는 핸들러 전에 블랙리스트 토큰을 `401 TOKEN_REVOKED` 로 막는다. 그래서 실행 단위 토큰의 정상 경로는 `401` 이고 `410` 은 폐기가 빠졌을 때나 트리거 단위 토큰(종료 때 폐기되지 않음)일 때 나온다. [웹채팅 인증과 세션](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) 은 명령 응답 `410` 만 종료 신호로 다루고 명령 `401` 처리를 정하지 않는다. 정상 경로 코드를 하나로 정할지, 두 코드를 모두 종료 신호로 문서화할지 결정 필요.
- **`ai_form_render` 가 외부에서 어떻게 보이는가**: [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/modules/external-interaction/interaction.controller.ts` (`/interact`·`/cancel`·`/refresh-token`·상태 조회)
- `codebase/backend/src/modules/external-interaction/interaction-stream.controller.ts` (SSE, 동시 연결 한도)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`interact`·`cancel`·`refreshToken`·`getStatus`)
- `codebase/backend/src/modules/external-interaction/interaction.guard.ts` (토큰 검증·`deny()`)
- `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` (재전송 버퍼·`replayOrSignalUnavailable`·`writeSseFrame`)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/dto/interact.dto.ts`, `dto/cancel.dto.ts`
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`, `interact-ack-response.dto.ts`, `refresh-token-response.dto.ts`
- `codebase/channel-web-chat/src/lib/eia-client.ts`, `eia-events.ts`, `eia-types.ts` (참조 클라이언트와 파서)

## Rationale

### SSE 를 이벤트 채널로 고른다

외부 인바운드 이벤트 스트림의 1차 채널로 SSE 를 쓴다. 고른 기준은 다음과 같다.

- HTTP/1.1 호환이라 CDN·리버스 프록시·모바일 환경에 잘 맞는다.
- 브라우저 표준 `EventSource` API 가 있다.
- 자동 재연결과 `Last-Event-Id` 기반 누락 복구가 표준에 들어 있다.
- 서버리스·에지 환경에서도 구현할 수 있다.

Long-polling 은 실시간 채팅·멀티턴에서 지연이 커 사용 경험이 나빠지므로 뺐다. 외부 WebSocket 은 아래 결정에 따라 보류했다.

### 외부 WebSocket 채널은 보류한다

v1 에서 외부 WebSocket 채널을 새로 만들지 않는다. SSE 와 REST 조합으로 충분하다.

1. 구현이 둘로 갈린다: 이미 내부 `/ws` 게이트웨이가 있다. 외부 WS 를 따로 만들면 인증 흐름·이벤트 발행 경로·재연결 정책이 두 곳에 생겨 백엔드 유지 부담이 두 배가 된다.
2. 양방향 이점이 작다: 외부 WS 의 저지연 양방향 이점은 인바운드 REST POST 로 충분히 대신한다. 멀티턴 AI 채팅도 SSE 수신과 REST 제출로 동작한다(실측 지연 100ms 대로 사람이 느끼는 임계 아래).
3. 인프라 제약: WS 는 CDN·서버리스·모바일에서 까다롭고 일부 기업 방화벽이 막기도 한다. SSE 는 표준 HTTP 응답이라 막힐 일이 사실상 없다.
4. 호환성 모델 단순화: 외부 클라이언트가 SSE 와 WS 중 고를 수 있으면 SDK·문서·테스트 매트릭스가 두 배로 는다. v1 은 SSE+REST 하나로 맞춰 학습 부담을 낮춘다.

다시 검토할 계기는 다음 중 하나다.

- SSE 동시 연결 한계(브라우저당 HTTP/1.1 연결 6개)가 실제 병목으로 측정된다.
- 인바운드 REST 왕복 지연이 사용 경험을 해치는 수준(평균 300ms 초과)으로 측정된다.
- 요청 빈도가 높아(분당 60 이상) 실행별 REST 부하가 SSE 대비 비효율임이 입증된다.
- 외부 WS 를 명시적으로 요구하는 대형 통합 파트너가 생긴다.

다시 도입한다면 기존 `/ws` 게이트웨이를 그대로 쓰고 인증 단계에서 `iext_*`·`itk_*` 도 받게 넓힌다. 새 URL 은 만들지 않는다. 명령·이벤트 형식은 [WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md) 과 완전히 같게 해 구현이 갈라지지 않게 한다.

### 외부 경로를 `/api/external/executions/*` 로 나눈다

외부 인터랙션 엔드포인트는 모두 `/api/external/executions/:id/*` 아래에 새로 둔다. 기존 `/api/executions/*`(워크스페이스 JWT, 에디터·UI 전용)와 경로 prefix·인증 계열을 모두 나눈다. prefix 가 다르면 컨트롤러 분리가 분명해지고, 가드·CORS·레이트 리밋을 prefix 단위로 걸 수 있고, Swagger 에서도 따로 묶인다.

- 경로 충돌(`GET /api/executions/:id` 의 응답 형태 차이, `POST /api/executions/:id/stop` 과 `cancel` 의 뜻 겹침)이 곧바로 풀린다.
- 외부 API 가 내부 API 와 별개라는 것을 URL 만 보고 알 수 있다. facade 원칙을 코드 수준에서 드러낸다.
- 앞으로의 확장(예: `/api/external/triggers/*`, `/api/external/workflows/:id/runs/*`)도 같은 prefix 아래에 둘 수 있다.

같은 경로 `/api/executions/:id/*` 에서 가드를 나눠 두 토큰 계열을 받는 안은 채택하지 않았다. (a) 계열마다 응답 형태가 다르면 명세가 모호해지고, (b) 한 가드가 매번 두 계열을 가르면 코드가 복잡해지며, (c) 외부용 가벼운 응답이 기존 UI 응답 형태를 바꿀 위험이 있다. 같은 경로에 컨트롤러를 따로 등록하는 안은 NestJS 라우터가 모호해져 런타임 에러가 날 수 있어 뺐다.

### 멱등 캐시에서 폼 검증 실패를 뺀다

`submit_form` 필드 검증 실패를 캐시하면 사용자가 폼을 고쳐 같은 키로 다시 낼 때 낡은 에러를 돌려받는다. 이는 "검증 실패 → 입력 대기 유지 → 다시 제출" 흐름([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md))과 정면으로 부딪치고 폼 수정·재제출 경험을 깨뜨린다. `5xx` 를 캐시하지 않는 것도 같은 이유다. 일시적 서버 에러를 24시간 고정하면 같은 키로 다시 시도해도 계속 같은 실패를 받아, 정상 응답을 재현한다는 멱등의 취지와 정반대가 된다.

캐시 키를 실행과 경로로 묶는 이유는 두 축이다.

- 실행 축: 키를 헤더 값에만 묶으면 모든 실행·모든 토큰 보유자가 네임스페이스를 함께 쓴다. 요청자 B 가 자기 실행에 정당한 토큰으로 A 와 같은 키·같은 본문을 보내면 캐시에 걸려 B 의 명령이 서비스에 닿지 않은 채 A 의 응답이 B 에게 간다. B 는 `202 accepted` 를 받아 유실을 알아채지 못하고 A 의 응답 본문이 B 에게 노출된다. 가드가 인터셉터보다 먼저 돌므로 인증 우회는 없고, 깨지는 것은 그다음이다.
- 경로 축: 같은 인터셉터가 `interact` 와 `cancel` 두 곳에 붙는다. `CancelDto` 는 모든 필드가 선택이라 본문 `{}` 가 가능하고, 그때 본문 해시가 `{}` 인 `interact` 요청과 같아져 `cancel` 의 ack 가 `interact` 에 재생된다. `cancel` 이 `interact` 의 편의 별칭이라는 것은 응답 DTO 형태가 같다는 뜻이지 캐시 네임스페이스를 함께 쓴다는 뜻이 아니다.

범위를 토큰(jti)으로 잡으면 `refresh-token` 으로 토큰이 바뀐 뒤의 재시도가 다른 키로 떨어져, 멱등이 보장하려는 바로 그 재시도 시나리오를 깬다. 범위를 다시 전역으로 되돌리면 위 두 축이 다시 열린다. 실행 단위로 묶은 Redis 전역 키에는 선례가 있다. 실행 엔진의 `exec:seq:<executionId>`·`exec:cont:seq:<executionId>` 가 "executionId 가 이미 전역 유일 UUID" 라는 근거로 같은 형태를 쓴다([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)).

손상 항목의 예외를 그대로 올리면 500 이 되어 fail-open 원칙과 정반대가 된다. `req.interaction` 이 없을 때 전역 키로 조용히 대신하면 이 결정이 닫은 문을 그대로 다시 연다. 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET 실패·직렬화 실패)가 모두 "멱등성을 포기하고 요청은 통과" 인 것과도 맞다.

### WS 코드와 EIA 코드는 경로마다 다르게 쓴다

같은 실행 엔진 사전 검증을 두 진입점이 함께 쓰지만, 에러 코드 이름은 각 경로의 관례를 따르고 뜻이 같다는 관계를 표로 고정한다. WS 채널은 실행 엔진 내부 코드 네임스페이스(`EXECUTION_*`, 시스템 수준 `INVALID_EXECUTION_STATE`, [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md))를 직접 드러낸다. EIA REST 는 공개 외부 API 라 HTTP 상태와 함께 간결한 코드(`STATE_MISMATCH`·`MESSAGE_TOO_LONG`)를 쓴다. 한 이름으로 강제로 맞추면 (a) WS 가 REST 식 코드를 써서 내부 enum 과 어긋나거나, (b) REST 가 `EXECUTION_*` 를 그대로 드러내 외부 API 가 내부 구현 식별자에 묶인다.

### 토큰 검증 실패는 모두 401

인바운드 토큰 검증 실패(`TOKEN_INVALID`·`TOKEN_EXPIRED`·`TOKEN_REVOKED`·`TOKEN_SCOPE_MISMATCH`·`TOKEN_AUDIENCE_MISMATCH`)를 모두 `401 Unauthorized` 로 적고 코드는 모두 `TOKEN_*` 로 맞춘다. 구현(`interaction.guard.ts` 의 `deny()` = `UnauthorizedException`)과 e2e 가 이미 401 이라 명세를 구현에 맞췄다.

범위·용도 불일치를 HTTP 뜻 그대로 `403`(인증됐지만 인가 실패)으로 나누는 안은 기각했다. (1) `403` 은 "토큰은 유효하지만 권한만 모자라다" 는 정보를 밖에 알린다. 이는 알림 웹훅 서명 검증에서 누락·형식·시간 창·불일치를 모두 같은 401 로 묶어 알고리즘 노출을 막는 원칙과 어긋난다. (2) EIA 토큰은 실행 범위라 "다른 실행의 토큰" 은 사실상 그 리소스에 대한 인증 실패다. (3) `deny()` 가 401 전용이라 403 분기를 넣으려면 가드 리팩토링과 e2e 회귀 위험을 감수해야 하는데 보안 이득이 없다.

이 결정은 가드가 핸들러 전에 판정하는 검증 실패 다섯 가지에 한한다. `refresh-token` 의 `403 TOKEN_REFRESH_FORBIDDEN` 은 이 통일의 예외이고, 기각한 대안을 다시 들인 것이 아니다. 기각한 것은 "범위·용도 불일치를 403 으로 나누기" 였고 그 두 코드는 지금도 401 이다. 예외인 이유는 둘이다. (1) 판정 위치가 다르다. 가드를 통과한 유효 토큰이 갱신 경로를 잘못 쓴 경우이고, 판정은 서비스(`interaction.service.ts` 의 `refreshToken`)가 한다. (2) 노출 이득이 없다. 토큰 계열은 문자열 접두사(`iext_`·`itk_`)라 호출자가 이미 안다. 반면 범위·용도 불일치는 호출자가 스스로 확정할 수 없는 관계 정보라 성격이 다르다. `TOKEN_REFRESH_FORBIDDEN` 은 구현 첫 커밋부터 있었고, 이 결정의 근거도 처음부터 `deny()` 로 한정돼 있었다.

### `interact`·`cancel` 은 202 와 ack 본문

`interact`·`cancel` 은 비동기라 `202 Accepted` 로 답하되 빈 응답 대신 둘 다 `InteractAckDto` 를 돌려준다. `cancel` 은 `interact` 의 편의 별칭이라 같은 ack 를 쓰는 것이 자연스럽고, 클라이언트가 두 엔드포인트의 풀기 로직을 나누지 않아도 된다.

ack 본문을 돌려주는 이유는 셋이다. (1) 명령 직후 관측한 `currentStatus`(곧바로 다시 입력 대기에 들어갈 수 있음)를 SSE 구독 전에 한 번 확인할 수 있어 경험이 매끄럽다. (2) `accepted: true` 가 큐 적재 성공을 명시한다. (3) 다른 엔드포인트와 같은 응답 봉투로 한결같이 처리된다. `interact` 만 본문 없는 예외로 두면 클라이언트 풀기 로직이 갈린다. 본문이 비동기 진행의 확정 상태를 뜻하지 않는다는 점(202)은 그대로이고, 확정 상태는 SSE 나 상태 조회로 받는다.

### 상태 조회가 현재 대기 표면과 대화 스레드를 싣는다

처음 v1 은 상태 조회의 `currentNode`·`context` 를 늘 `null`, `seq` 를 `0` 으로 두고 상세 정보는 SSE `waiting_for_input` 을 권위로 삼았다.

- **경쟁 창**: 웹훅 즉시 시작(`202` 비동기) 직후 빠른 첫 노드(버튼·캐러셀)의 `waiting_for_input` 이 위젯의 SSE 구독보다 먼저 나가는 경쟁이 확인됐다. 위젯이 `lastEventId` 없이 첫 연결하면 5분 버퍼가 있어도 재전송을 받지 못하고 heartbeat 만 받아 첫 화면(캐러셀)이 그려지지 않았다. 그래서 위젯은 (a) `openStream(lastEventId=0)` 으로 버퍼의 놓친 이벤트를 다시 받고, (b) 시작·복원 직후 상태 조회로 현재 대기 표면을 한 번 시드한다. 후자를 위해 상태 조회가 입력 대기일 때 `currentNode`·`context` 를 실제 값으로 돌려주도록 좁게 넓혔다.
- **SSE 와의 역할 분담**: 상태 조회는 현재 대기 표면 시드와 새로고침 기록 복원을 맡는다. SSE 는 순번과 이후 실시간 증분 이벤트(`waiting_for_input`·`ai_message`)의 권위다. `context` 를 SSE `waiting_for_input` 과 같은 형식으로 만들어 위젯이 `parseWaitingForInput` 을 다시 쓴다. 순번만은 `SSE_SEQ_PLACEHOLDER=0` 으로 두고 SSE 가 권위로 바로잡는다. 위젯의 시드는 `404`·`401`·`410` 을 종료·갱신 분기로 처리하고 그 밖의 HTTP 에러는 경고만 남기고 진행한다. 분기 규칙은 [웹채팅 인증과 세션](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) 이 정한다. 시드가 실패해도 SSE 재전송이 버퍼 안에서 보강한다.
- **대화 스레드도 싣도록 조정**: 처음에는 `conversationThread` 를 SSE 전용 권위로 두고 상태 조회에서 뺐다(5분 버퍼 재전송으로 보정한다는 전제). 그러나 버퍼 만료(5분 초과)·서버 재시작·인스턴스 전환 뒤 새로고침하면 재전송이 불가능해 위젯이 기록을 잃었다. 영속 스냅샷(`Execution.conversation_thread`)은 이미 손실 없이 저장돼 있는데도 내보낼 길이 없어 복원하지 못했다. [웹채팅 위젯](../CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) 도 "버퍼 만료 때 상태 조회 스냅샷으로 다시 맞춘다" 를 계약으로 두고 있어 이 생략과 모순이었다. 그래서 상태 조회가 입력 대기일 때 영속 스레드를 싣도록 좁게 넓혀 새로고침 복원이 버퍼·재시작과 무관하게 되게 했다. 이미 SSE `waiting_for_input` 으로 공개 중인 `conversationThread` 를 REST 단발 응답에도 읽기 전용으로 싣는 것뿐이라 새로운 민감 데이터 노출이 아니다.
- **부재 표현이 형제 필드와 다르다**: `conversationThread` 는 값이 없으면 키를 생략한다(형제 `currentNode`·`result`·`error` 는 `null`). SSE 도 있을 때만 싣는 형식이라, REST 만 `null` 로 맞추면 위젯의 `parseWaitingForInput` 재사용이 깨진다. 두 표현의 선택 기준은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 이 정한다.
- **기각한 대안**: (a) SSE 전용을 유지하고 버퍼 만료 때 위젯이 다시 조회하는 안. 그 재조회(상태 조회)가 스레드를 주지 않으므로 만료 때 되살릴 원천이 없어 문제를 풀지 못한다. (b) 노드 실행 출력에 흩어진 값으로 스레드를 다시 만드는 안. `runningSummary` 같은 스레드 메타가 노드별로 저장되지 않아 손실 없이 되살릴 수 없다([대화 스레드](CLE-IX-THREAD.md) 가 같은 이유로 기각). 영속 컬럼을 그대로 내보내는 것이 손실 없고 단순하다.

### 표시 메시지 이벤트를 새로 둔다

버튼 없이 자동으로 진행하는 Presentation 노드(캐러셀·표·차트·템플릿)는 핸들러가 `status` 없이 `{ config, output }` 만 돌려주고, 엔진은 노드 수준 `execution.node.completed` 만 냈다. 이 이벤트는 SSE 까지 가지만 웹채팅 위젯에는 노드 수준 핸들러가 없어 무시했다. 그 결과 노드 사이의 표시 메시지(예: 캐러셀 다음 템플릿 메시지)가 미리보기에서 빠졌다(2026-06-25 운영 미리보기 보고). 입력 대기(차단)와 `ai_message`(AI 생성)는 보였지만, 자동 진행 표시 노드의 출력을 싣는 실행 수준 이벤트가 없었다.

그래서 Presentation 네 종류가 차단 없이 완료되면 실행 수준 `execution.message` 를 새로 낸다. `presentations` 는 `{ config, output }` 평면 객체라 위젯의 기존 렌더 경로(`classifyPresentation`)를 그대로 쓴다. 위젯은 이 이벤트를 기존 `AI_MESSAGE` reducer 로 보내되 텍스트를 비워 표시물만 그린다. 텍스트와 표시물이 겹쳐 말풍선이 두 번 생기는 것을 막기 위해서다.

기각한 대안:

- 위젯이 `execution.node.completed` 를 직접 구독하는 안: 모든 비차단 노드(code·llm·logic 등)의 전체 이벤트라 내부 라이프사이클 필드가 EIA 로 새고 걸러 내기가 약하다. Presentation 전용 이벤트가 경계를 분명히 한다.
- `execution.ai_message` 를 다시 쓰는 안: 정적 표시 노드 출력을 "AI 생성 메시지" 로 부르면 뜻이 헷갈리고, AI 턴 전용 불변식(`turnCount`·`messages` 스냅샷 등)과 부딪친다.

이 변경은 SSE·서버 안 fan-out 에만 이벤트를 더한다. 채팅 채널이 기각한 대상(외부 HTTP 알림 웹훅 화이트리스트 확장)과는 별개이고, 알림 웹훅 다섯 종은 그대로다. 엔진은 여전히 단일 싱크로만 내므로 단일 싱크 원칙도 유지된다. 채팅 채널은 계속 `execution.node.completed` 를 받으므로 메신저에 같은 내용이 두 번 가지 않는다.

### 버퍼 만료를 명시 신호로 알린다

SSE 재연결 재전송(`Last-Event-Id`) 때 5분 버퍼가 요청 범위를 다 채우지 못하면(만료나 `MAX_BUFFER_PER_EXEC` 상한 초과로 중간 순번 유실) 부분 재전송 대신 `execution.replay_unavailable` 을 한 번 보낸다. 이전의 "만료분을 조용히 버림" 을 명시 신호로 바꿨다.

- **공백 판정**: 순번은 단조 증가라 만료·폐기는 늘 앞쪽부터 일어난다. 다시 보낼 수 있는 가장 이른 순번이 `Last-Event-Id + 1` 이 아니면 그 사이가 유실된 것이다. 다시 보낼 수 있는 구간 안에 구멍이 있어도(상류 순번 유실·중복 같은 비정상) 공백으로 본다. 이 기능이 없애려는 조용한 누락을 놓치지 않으려는 전 구간 연속성 방어다(`replayable.every`). `seq > Last-Event-Id` 인 이벤트가 버퍼에 하나도 없으면 클라이언트가 최신까지 받은 것이므로 신호를 보내지 않고 실시간 스트림으로 이어 간다.
- **`id: 0` 을 싣는 안은 기각했다**: WHATWG `EventSource` 는 `id:` 를 받으면 내부 Last-Event-Id 를 바꾼다. 그러면 다음 브라우저 자동 재연결이 `Last-Event-Id: 0` 을 보내 전체 재전송을 뜻하지 않게 일으킨다. `id:` 를 생략하면 클라이언트의 실제 위치가 보존된다. 순번 자리의 `0` 은 상태 조회의 `SSE_SEQ_PLACEHOLDER` 관례와 같은 영역이다.
- **내부 WS 에는 두지 않는다**: 내부 WS 는 순번 버퍼 없이 재구독 때 실행 스냅샷 이벤트(`execution.snapshot`) 한 번으로 복구하므로 만료 신호가 구조상 필요 없다([WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md)). 양쪽에 함께 둔다는 초기 문구는 WS 에 버퍼가 있다는 전제였고 그 전제가 없어졌다. 그래서 이 신호는 SSE 에만 있다.
- **신호 뒤에도 연결을 유지한다**: 신호를 보낸 뒤에도 구독자를 활성 목록에 둔다. 클라이언트는 상태 조회로 현재 상태만 함께 보정하고 이후 이벤트는 열린 스트림으로 계속 받는다. 상태 조회의 순번은 늘 `0` 이라 재연결 근거가 없다. 그래서 다시 연결하지 않고 함께 보정하는 것이 유일하게 맞는 흐름이다.

### `STATE_MISMATCH` 를 구현에 강제했다

`409 STATE_MISMATCH` 의 두 사유인 대기 표면 불일치(`form`·`buttons` 대기 중 다른 종류 명령)와 `nodeId` 불일치(명령의 `nodeId` 가 실제 대기 노드와 다름)는 계약이 처음부터 정했다. 그런데 구현이 한동안 이 조합을 거부하지 않고 `202` 로 받았다. publisher 쪽 명령 사전 검증([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md))으로 두 사유를 모두 강제해 구현을 계약에 맞췄다(대기 표면 2026-07-10, `nodeId` 2026-07-14). 문서화된 동작은 바뀌지 않았으므로(계약은 늘 `409` 였다) 별도 호환성 깨짐 공지는 내지 않는다. 이전의 `202` 에 기댄 클라이언트는 문서화되지 않은 결함에 기댄 것이다. 진입점별 `nodeId` 검사 범위는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 표가 정한다.
