---
id: "CLE-EIA-INBOUND"
title: "EIA 수신 API와 SSE"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-EIAIN-001", "REQ-EIAIN-002", "REQ-EIAIN-003", "REQ-EIAIN-004", "REQ-EIAIN-005", "REQ-EIAIN-006", "REQ-EIAIN-007", "REQ-EIAIN-008", "REQ-EIAIN-009", "REQ-EIAIN-010", "REQ-EIAIN-011", "REQ-EIAIN-012", "REQ-EIAIN-013", "REQ-EIAIN-014", "REQ-EIAIN-015", "REQ-EIAIN-016", "REQ-EIAIN-017", "REQ-EIAIN-018", "REQ-EIAIN-019", "REQ-EIAIN-020", "REQ-EIAIN-021", "REQ-EIAIN-022", "REQ-EIAIN-023", "REQ-EIAIN-024", "REQ-EIAIN-025", "REQ-EIAIN-026", "REQ-EIAIN-027", "REQ-EIAIN-028", "REQ-EIAIN-029", "REQ-EIAIN-030", "REQ-EIAIN-031", "REQ-EIAIN-032", "REQ-EIAIN-033", "REQ-EIAIN-034", "REQ-EIAIN-035", "REQ-EIAIN-036", "REQ-EIAIN-037", "REQ-EIAIN-038", "REQ-EIAIN-039", "REQ-EIAIN-040", "REQ-EIAIN-041", "REQ-EIAIN-042", "REQ-EIAIN-043", "REQ-EIAIN-044", "REQ-EIAIN-045", "REQ-EIAIN-046", "REQ-EIAIN-047", "REQ-EIAIN-048", "REQ-EIAIN-049"]
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "1728bd13c59fefb9c65b5bb29d20adf924cf6f7b6aaefcce54b16e7b3c265dc9"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/14-external-interaction-api.md"]
mirror_sha256: "e8b8e02f5bb77bbe0d31cbe0cd0c14fd4fc389ba1cef6dddde67d1ed9486e347"
etag: "sha256-81db53bfb0cce043888f5ba5ce821716ecbf60a139826717e7b0a6eb3c211c02"
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
- REQ-EIAIN-005 WHEN 인바운드 명령을 받아들이면 THE SYSTEM SHALL 즉시 `202 Accepted` 와 ack 본문(`executionId`·`accepted`·`currentStatus`)을 돌려주고 워크플로우 진행은 백그라운드에서 한다. (원본: EIA-NF-04, R16 · 큐에 넣지 못한 명령은 REQ-EIAIN-040)
- REQ-EIAIN-006 WHEN 클라이언트가 `GET /api/external/executions/:executionId/stream` 을 열면 THE SYSTEM SHALL SSE 스트림으로 실행 이벤트를 보내고 종료 이벤트(`completed`·`failed`·`cancelled`)를 보낸 뒤 연결을 닫는다. (원본: EIA-IN-03)
- REQ-EIAIN-007 WHEN SSE 이벤트를 보내면 THE SYSTEM SHALL `id:` 필드에 그 실행의 이벤트 순번(`seq`)을 싣는다. (원본: EIA-IN-07)
- REQ-EIAIN-008 WHEN 클라이언트가 `Last-Event-Id` 헤더나 `?lastEventId=` 로 다시 연결하면 THE SYSTEM SHALL 5분 재전송 버퍼에서 그 순번 뒤의 이벤트를 손실 없이 다시 보낸다. (원본: EIA-IN-07, EIA-NF-03)
- REQ-EIAIN-009 WHEN 첫 연결에 `?lastEventId=0` 을 명시하면 THE SYSTEM SHALL 버퍼에 있는 순번 1 이상의 이벤트를 모두 다시 보낸다. (원본: EIA-IN-07)
- REQ-EIAIN-010 IF 재전송 버퍼가 요청 범위를 다 채우지 못하면 THE SYSTEM SHALL 부분 재전송 대신 `execution.replay_unavailable` 을 한 번 보내고 연결을 유지한다. (원본: EIA-NF-03, R-replay-unavailable)
- REQ-EIAIN-011 WHEN 실행 순번을 배정받지 않는 제어 프레임(`execution.replay_unavailable`)을 보내면 THE SYSTEM SHALL SSE `id:` 줄을 생략한다. (원본: §5.2)
- REQ-EIAIN-012 WHILE SSE 연결이 열려 있는 동안 THE SYSTEM SHALL 15초마다 `: heartbeat` 주석 줄을 보낸다. (원본: EIA-IN-08)
- REQ-EIAIN-013 IF 한 실행의 SSE 동시 연결이 모든 서버 인스턴스를 합해 3개를 넘으면 THE SYSTEM SHALL `429 TOO_MANY_CONNECTIONS` 로 거부한다. (원본: EIA-IN-09)
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
- REQ-EIAIN-040 IF 토큰으로 인증한 HTTP 요청이 보낸 재개 명령 네 가지(`submit_form`·`click_button`·`submit_message`·`end_conversation`)나 입력 대기 실행의 `cancel`(별칭 `/cancel` 포함)을 재개 큐에 넣지 못하면 THE SYSTEM SHALL `503 EXECUTION_ENQUEUE_FAILED` 를 돌려주고 그 응답을 멱등 캐시에 넣지 않는다. (2026-10-09 결정 · [EIA 데이터와 흐름 「인바운드 명령과 재개」](CLE-EIA-DATA.md#인바운드-명령과-재개))
- REQ-EIAIN-041 WHEN 트리거 단위 토큰이 무효가 되거나 그 트리거의 인터랙션이 꺼지면 THE SYSTEM SHALL 그 토큰으로 연 SSE 스트림을 어느 서버 인스턴스에 붙어 있든 닫는다. 닫기 신호를 받지 못한 서버 인스턴스의 스트림은 60초마다 하는 토큰 재확인에서 닫는다. 재확인 조회가 실패하면 그 스트림을 유지한다. (2026-10-09 결정, 서버 인스턴스 범위는 2026-10-17 결정, 60초 재확인은 2026-11-05 결정 · [스트림 규칙](#스트림-규칙))
- REQ-EIAIN-042 WHILE Redis 를 쓸 수 있는 동안 THE SYSTEM SHALL SSE 클라이언트가 어느 서버 인스턴스에 연결해도 그 실행의 이벤트를 빠짐없이 보내고 다른 서버 인스턴스로 다시 연결해도 5분 재전송을 한다. 예외는 둘이다. 크기 상한을 넘은 이벤트(종료 이벤트 제외)는 그 이벤트를 낸 서버 인스턴스 밖의 클라이언트에게 `execution.replay_unavailable` 로 대신 알린다(REQ-EIAIN-048). 서버 인스턴스가 그 실행의 이벤트를 Redis 에 쓸지 판정하는 동안에는 다른 서버 인스턴스의 클라이언트가 그 이벤트를 최대 2초 늦게 받을 수 있다. (2026-10-17 결정, 예외는 2026-11-05 결정 · [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA.md#sse-스트림))
- REQ-EIAIN-043 IF SSE 전달에 쓰는 Redis 를 쓸 수 없으면 THE SYSTEM SHALL 서버 인스턴스 메모리로 SSE 전달과 재전송을 이어 가고 경고 로그를 남긴다. (2026-10-17 결정)
- REQ-EIAIN-044 WHEN 재전송과 실시간 전달이 같은 순번의 이벤트를 함께 가져오면 THE SYSTEM SHALL 한 스트림에 그 순번의 이벤트를 한 번만 보낸다. (2026-10-17 결정)
- REQ-EIAIN-045 IF 재전송 버퍼에 요청한 순번 뒤의 이벤트가 없고 버퍼가 비었거나 Redis 에서 읽지 못했으며 실행의 순번 카운터를 읽지 못하거나 카운터로 보아 클라이언트가 이벤트를 놓쳤을 수 있으면 THE SYSTEM SHALL `execution.replay_unavailable` 을 한 번 보내고 연결을 유지한다. (2026-10-17 결정 · [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA.md#sse-스트림))
- REQ-EIAIN-046 IF 연결을 준비하는 동안 모은 실시간 이벤트가 상한을 넘어 가장 오래된 것을 버렸으면 THE SYSTEM SHALL 실시간 전달로 바꾸기 전에 `execution.replay_unavailable` 을 한 번 보낸다. (2026-10-17 결정)
- REQ-EIAIN-047 IF 트리거 단위 토큰으로 SSE 를 열 때 구독을 등록한 뒤 다시 확인한 토큰이 무효이거나 그 사이 그 토큰의 닫기 신호가 오면 THE SYSTEM SHALL SSE 헤더를 보내지 않고 `401 TOKEN_INVALID` 로 거부한다. (2026-10-17 결정 · [스트림 연결 오류](#스트림-연결-오류))
- REQ-EIAIN-048 IF 다른 서버 인스턴스가 낸 이벤트가 크기 상한을 넘어 생략 표시만 오면 THE SYSTEM SHALL 그 순번을 아직 보내지 않은 스트림에 그 순번 자리에서 `execution.replay_unavailable` 을 한 번 보내고 그 스트림의 `lastEventId`(마지막으로 받은 순번)는 그대로 둔다. (2026-11-05 결정 · [스트림 규칙](#스트림-규칙) 5 번)
- REQ-EIAIN-049 WHEN 서버의 실시간 구독이 끊겼다가 다시 확정되면(구독 확인이 늦게 온 경우 포함) THE SYSTEM SHALL 공백이 있던 실행의 열린 스트림마다 그 사이 놓친 이벤트를 재전송 버퍼로 채우고 채울 수 없으면 `execution.replay_unavailable` 을 한 번 보낸다. (2026-11-05 결정 · [스트림 규칙](#스트림-규칙) 4 번)

## 하위 문서

- [EIA 수신 API — 명령 제출과 에러](CLE-EIA-INBOUND-COMMAND.md): 명령 형식, 명령 에러, `/cancel`, 동시성, 멱등 키. 맡는 요구사항: REQ-EIAIN-001 ~ 005, REQ-EIAIN-020, REQ-EIAIN-025 ~ 038, REQ-EIAIN-040
- [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md): 이벤트 종류, 재전송, 서버 인스턴스 간 전달, 스트림 닫기, 연결 오류. 맡는 요구사항: REQ-EIAIN-006 ~ 015, REQ-EIAIN-039(SSE 출구), REQ-EIAIN-041 ~ 049
- [EIA 수신 API — 상태 조회와 토큰 갱신](CLE-EIA-INBOUND-STATUS.md): 상태 조회 응답과 대기 표면 복원, `/refresh-token`. 맡는 요구사항: REQ-EIAIN-016 ~ 019, REQ-EIAIN-021 ~ 024, REQ-EIAIN-039(상태 조회 출구)

요구사항 REQ-EIAIN-039 는 출구가 둘이라 두 하위 문서가 나눠 맡는다. SSE 이벤트에서 디버그 필드를 빼는 규칙은 STREAM 의 「이벤트 종류」가, 상태 조회 응답의 출구 강제는 STATUS 가 정한다.

## 공통 규칙

- **전송 봉투**: 하위 문서의 성공 응답 JSON 은 논리 payload 다. 실제 응답은 전역 `TransformInterceptor` 가 응답 봉투(`{ "data": { ... } }`)로 감싼다([HTTP API 규약](../CLE-API/CLE-API-CONV.md)). 예를 들어 상태 조회 응답은 `{ "data": { "id", "status", ... } }`, 토큰 갱신은 `{ "data": { "token", "expiresAt" } }` 다. 클라이언트는 `res.data` 를 풀어 읽는다. SSE 프레임(`data: <payload>`)만 인터셉터를 거치지 않아 봉투가 없다.
- `interact`·`cancel` 은 비동기라 `202 Accepted` 로 답하지만 본문이 없는 응답이 아니다. 둘 다 `InteractAckDto`(`{ executionId, accepted, currentStatus }`)를 응답 봉투에 담아 돌려준다.
- **에러 응답**: `{ "error": { "code", "message", "requestId", "details" } }` 형태의 에러 응답 봉투를 따른다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 웹훅 진입점도 같은 봉투를 쓴다.
- **인증**: `Authorization: Bearer <iext_jwt | itk_token>` 을 쓴다. SSE 만 브라우저 `EventSource` 가 헤더를 못 보내므로 `?token=` 쿼리를 허용한다. 토큰 규칙은 [External Interaction API](CLE-EIA.md) 에서 정한다.
- **경로**: 모든 엔드포인트는 `/api/external/executions/:id` 아래에 있다. 기존 `/api/executions/*` 와 prefix·인증 계열이 다르다.

## 명령 에러

→ [EIA 수신 API — 명령 제출과 에러](CLE-EIA-INBOUND-COMMAND.md#명령-에러)

## 이벤트 종류

→ [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#이벤트-종류)

## 표시 메시지 이벤트

→ [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#표시-메시지-이벤트)

## 스트림 규칙

→ [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#스트림-규칙)

## 스트림 연결 오류

→ [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#스트림-연결-오류)

## 단발 상태 조회

→ [EIA 수신 API — 상태 조회와 토큰 갱신](CLE-EIA-INBOUND-STATUS.md#단발-상태-조회)

## 토큰 갱신

→ [EIA 수신 API — 상태 조회와 토큰 갱신](CLE-EIA-INBOUND-STATUS.md#토큰-갱신)

## WebSocket 명령·이벤트와의 대응

내부 WebSocket 명령·이벤트와 EIA 사이의 대응표는 [WebSocket 이벤트와 명령 §7](../CLE-API/CLE-API-WS-EVENTS.md#7-외부-표면-매핑-external-interaction-api) 이 권위이고 이 문서는 표를 따로 두지 않는다. 외부 클라이언트가 알아야 할 점만 정리하면 다음과 같다.

- 외부 REST 명령(`/interact` 의 `command`) 네 가지(`submit_form`·`click_button`·`submit_message`·`end_conversation`)는 같은 이름의 내부 `execution.*` 명령과 대응한다. 필드 이름만 `submit_form` 의 WS `formData` 가 REST 에서 `data` 로 다르다.
- `cancel`(와 별칭 `/cancel`)은 실행 중단이라는 개념만 대응한다. WS 명령은 채택하지 않았고 내부·외부 모두 REST 로 처리한다. 외부는 `force` 를 지원하지 않는다.
- 실행 시작은 외부에서 웹훅 트리거로만 한다. 디버깅 명령(`execution.continue`·`execution.step`)과 `execution.retry_last_turn` 은 외부에 노출하지 않는다.
- SSE 이벤트 이름은 내부 이벤트 이름과 같다(노드 취소 `execution.node.cancelled` 도 포함, [노드 취소](../CLE-EXEC/CLE-EXEC-CANCEL.md)). 알림 웹훅으로는 `waiting_for_input`·`ai_message`(선택 구독)·`completed`·`failed`·`cancelled` 다섯 종만 보낸다.
- 표시 메시지 이벤트 `execution.message` 는 SSE 로만 나가고 알림 웹훅으로는 보내지 않는다([표시 메시지 이벤트](CLE-EIA-INBOUND-STREAM.md#표시-메시지-이벤트)).
- `execution.replay_unavailable` 은 SSE 에서만 보낸다. 연결을 시작할 때와 스트림 도중 놓친 구간이 생겼을 때 보낸다([스트림 규칙](CLE-EIA-INBOUND-STREAM.md#스트림-규칙)). 내부 WS 에는 버퍼가 없고 실행 스냅샷 이벤트로 복구한다.

## 미결 사항

- **종료된 실행에 명령을 보냈을 때의 정상 응답 코드**: EIA-IN-12 는 `410 Gone` 이라 적는다. 한편 실행이 끝나면 실행 단위 토큰을 즉시 블랙리스트에 올리고(종료 시 폐기), 가드는 핸들러 전에 블랙리스트 토큰을 `401 TOKEN_REVOKED` 로 막는다. 그래서 실행 단위 토큰의 정상 경로는 `401` 이고 `410` 은 폐기가 빠졌을 때나 트리거 단위 토큰(종료 때 폐기되지 않음)일 때 나온다. [웹채팅 인증과 세션](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) 은 명령 응답 `410` 만 종료 신호로 다루고 명령 `401` 처리를 정하지 않는다. 정상 경로 코드를 하나로 정할지, 두 코드를 모두 종료 신호로 문서화할지 결정 필요.
- **`ai_form_render` 가 외부에서 어떻게 보이는가**: [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 참조.

## 구현 위치

- `codebase/backend/src/modules/external-interaction/interaction.controller.ts` (`/interact`·`/cancel`·`/refresh-token`·상태 조회)
- `codebase/backend/src/modules/external-interaction/interaction-stream.controller.ts` (SSE, 동시 연결 한도, `writeSseFrame`)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`interact`·`cancel`·`refreshToken`·`getStatus`)
- `codebase/backend/src/modules/external-interaction/interaction.guard.ts` (토큰 검증·`deny()`)
- `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts` (구독자 관리, 재전송 판정 `replayOrSignalUnavailable`, 트리거 단위 토큰 스트림 닫기)
- `codebase/backend/src/modules/external-interaction/sse-fanout.service.ts` (Redis Stream 재전송 버퍼, 실행별 실시간 채널, 전역 닫기 채널, 전역 동시 연결 상한)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/dto/interact.dto.ts`, `dto/cancel.dto.ts`
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`, `interact-ack-response.dto.ts`, `refresh-token-response.dto.ts`
- `codebase/channel-web-chat/src/lib/eia-client.ts`, `eia-events.ts`, `eia-types.ts` (참조 클라이언트와 파서)

## Rationale

이 절에는 수신 API 전체에 걸친 결정만 둔다. 명령 에러 · 토큰 401 통일 · 202 응답 · `STATE_MISMATCH` 결정은 [명령 제출과 에러](CLE-EIA-INBOUND-COMMAND.md#rationale)에, SSE 선택 · 표시 메시지 이벤트 · 멀티 인스턴스 · 스트림 닫기 결정은 [SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#rationale)에, 상태 조회 응답 결정은 [상태 조회와 토큰 갱신](CLE-EIA-INBOUND-STATUS.md#rationale)에 있다. 아래 연결 절은 기존 링크를 받기 위해 남긴 것이다.

### 외부 경로를 `/api/external/executions/*` 로 나눈다

외부 인터랙션 엔드포인트는 모두 `/api/external/executions/:id/*` 아래에 새로 둔다. 기존 `/api/executions/*`(워크스페이스 JWT, 에디터·UI 전용)와 경로 prefix·인증 계열을 모두 나눈다. prefix 가 다르면 컨트롤러 분리가 분명해지고, 가드·CORS·레이트 리밋을 prefix 단위로 걸 수 있고, Swagger 에서도 따로 묶인다.

- 경로 충돌(`GET /api/executions/:id` 의 응답 형태 차이, `POST /api/executions/:id/stop` 과 `cancel` 의 뜻 겹침)이 곧바로 풀린다.
- 외부 API 가 내부 API 와 별개라는 것을 URL 만 보고 알 수 있다. facade 원칙을 코드 수준에서 드러낸다.
- 앞으로의 확장(예: `/api/external/triggers/*`, `/api/external/workflows/:id/runs/*`)도 같은 prefix 아래에 둘 수 있다.

같은 경로 `/api/executions/:id/*` 에서 가드를 나눠 두 토큰 계열을 받는 안은 채택하지 않았다. (a) 계열마다 응답 형태가 다르면 명세가 모호해지고, (b) 한 가드가 매번 두 계열을 가르면 코드가 복잡해지며, (c) 외부용 가벼운 응답이 기존 UI 응답 형태를 바꿀 위험이 있다. 같은 경로에 컨트롤러를 따로 등록하는 안은 NestJS 라우터가 모호해져 런타임 에러가 날 수 있어 뺐다.

### 외부 WebSocket 채널은 보류한다

→ [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#외부-websocket-채널은-보류한다)

### 버퍼 만료를 명시 신호로 알린다

→ [EIA 수신 API — SSE 이벤트 스트림](CLE-EIA-INBOUND-STREAM.md#버퍼-만료를-명시-신호로-알린다)
