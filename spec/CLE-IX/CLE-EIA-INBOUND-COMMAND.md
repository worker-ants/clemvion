---
id: "CLE-EIA-INBOUND-COMMAND"
title: "EIA 수신 API — 명령 제출과 에러"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-INBOUND"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-INBOUND"]
area: "CLE-IX"
content_hash: "046bdbe53ed87a2530639c0f19d624c9f25ee8175fed4efc80299c99abbc293e"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "b6b3a19f20f25016bfd478f4efcb8d1b8ab2ce9e6fea6ed8036164b02e04ec65"
etag: "sha256-273277ba62649f4957c47a570bb76211fc34c34b697831a5d607413171f5072a"
---
## 개요

이 문서는 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 하위 문서로 명령 제출(`/interact`)과 명시적 취소(`/cancel`)의 형식, 명령 에러, 동시성, 멱등 키를 정한다.

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

명령을 재개 큐에 넣지 못하면 202 대신 `503 EXECUTION_ENQUEUE_FAILED` 다([명령 에러](#명령-에러)).

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
| `401` | `TOKEN_INVALID` / `TOKEN_EXPIRED` | 토큰 위조·형식 오류·만료. 트리거 단위 토큰은 저장된 값과 다를 때(재발급으로 바뀌었거나 전략 변경으로 지워졌을 때)와 그 트리거의 인터랙션이 꺼졌을 때도 `TOKEN_INVALID` 다 |
| `401` | `TOKEN_REVOKED` | 실행 종료나 갱신으로 토큰이 즉시 무효가 됨(jti 블랙리스트). 실행이 이미 끝나 갱신으로 되살릴 수 없다 |
| `401` | `TOKEN_SCOPE_MISMATCH` | 토큰 범위가 그 실행과 다름(다른 실행의 토큰). 인가 실패지만 정보 노출을 줄이려고 403 대신 401 로 통일한다 |
| `401` | `TOKEN_AUDIENCE_MISMATCH` | 토큰 `aud` 가 `interaction` 이 아님(다른 용도 토큰) |
| `403` | `TOKEN_REFRESH_FORBIDDEN` | 토큰 갱신 전용. `itk_*` 는 영구 토큰이라 갱신 대상이 아니다. 검증을 통과한 토큰이 없는 기능을 부른 경우라 401 통일 대상이 아니다 |
| `404` | `EXECUTION_NOT_FOUND` | executionId 가 없음. 토큰 갱신은 예외로, 없는 실행도 `410` 이다. 트리거 단위 토큰으로 보낸 요청도 예외다. 실행이 없거나 그 실행의 트리거가 지워졌으면 가드가 핸들러 전에 이 코드를 `401` 로 돌려준다([에러 코드 규약과 카탈로그 §6.9](../CLE-API/CLE-API-ERRCODES.md#69-eia-rest-외부-표면-도메인-문서-참조)) |
| `409` | `STATE_MISMATCH` | 현재 노드·실행 상태와 명령이 맞지 않음. 예: 완료된 실행에 `submit_message`, 다른 `nodeId`, 대기 표면과 명령 불일치(`buttons` 대기에 `submit_form`, `form` 대기에 `end_conversation`). 대기 표면별 허용 명령은 `form`=`submit_form`, `buttons`=`click_button`, `ai_conversation`·`ai_form_render`=네 가지 모두다 |
| `409` | `IDEMPOTENCY_KEY_CONFLICT` | 같은 멱등 키에 다른 본문 |
| `410` | `EXECUTION_TERMINATED` | 실행이 이미 `completed`·`failed`·`cancelled`. 토큰 갱신에서도 같은 코드를 쓰고 거기선 없는 실행도 포함한다. 실행 단위 토큰은 종료 때 폐기되므로 명령의 정상 경로에서는 가드의 `401 TOKEN_REVOKED` 가 먼저 나온다. 어느 코드를 정상 응답으로 둘지는 [미결 사항](CLE-EIA-INBOUND.md#미결-사항) 참조 |
| `429` | `RATE_LIMITED` | 실행별 인바운드 한도 초과(`/interact` 분당 60, 상태 조회 분당 120). `InteractionRateLimitGuard` 가 `Retry-After`(남은 윈도우 초)와 함께 돌려준다. 시스템 전역 기본 코드를 그대로 쓰며, SSE 동시 연결 초과의 `TOO_MANY_CONNECTIONS` 와는 별개다. WS 의 같은 이름 코드와도 발행 위치가 다르다. 한도 값은 [External Interaction API](CLE-EIA.md) 에서 정한다 |
| `503` | `EXECUTION_ENQUEUE_FAILED` | 토큰으로 인증한 HTTP 요청의 명령을 재개 큐에 넣지 못함(발행 결과 `queued:false`). 네 재개 명령과 입력 대기 실행의 `cancel`(별칭 `/cancel` 포함)이 대상이다. 멱등 캐시에 넣지 않으므로 같은 멱등 키로 다시 보내면 새로 처리한다. 캐시에 있는 응답을 그대로 돌려주는 재요청은 큐에 넣지 않으므로 이 코드를 받지 않는다. 내부 신뢰 호출(`in_process_trusted`)로 부른 재개 명령은 이 코드 대신 `accepted: false` 인 ack 를 받는다. 코드 자체의 정의는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 있고 EIA 에서 이 코드를 받는 범위는 이 행이 정한다 |

- **`X-Refresh-Token-Url` 헤더**: 위의 `401 TOKEN_*` 응답에는 `InteractionGuard.deny()` 가 이 헤더를 항상 붙인다. 클라이언트가 갱신 엔드포인트를 한결같이 찾게 하려는 것이다. 다만 `TOKEN_REVOKED`(실행 종료)와 `TOKEN_SCOPE_MISMATCH`·`TOKEN_AUDIENCE_MISMATCH`(범위·용도 불일치)는 헤더를 따라가도 새 토큰을 받지 못할 수 있다. 되살릴 수 없다는 신호다.
- **토큰 실패의 401 통일**: `InteractionGuard` 가 핸들러 전에 판정하는 토큰 검증 실패 다섯 가지(`invalid`·`expired`·`revoked`·`scope`·`audience`)는 모두 `401` 이다. `403 TOKEN_REFRESH_FORBIDDEN` 은 이 통일 밖이다. 근거는 [토큰 검증 실패는 모두 401](#토큰-검증-실패는-모두-401) 참조.
- **코드 네임스페이스**:
  1. `TOKEN_INVALID`·`TOKEN_EXPIRED` 는 워크스페이스 JWT 계층의 코드와 문자열이 같다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). 여기서는 인터랙션 토큰(`iext_*`·`itk_*`) 검증 실패를 뜻하며, 진입 경로(`/api/external/*`)와 토큰 계열로 층을 가른다.
  2. `EXECUTION_NOT_FOUND`(404)는 순수한 부재만 뜻한다. 워크스페이스·범위 경계 위반은 먼저 `TOKEN_SCOPE_MISMATCH`(401)로 처리하므로 존재 여부가 새지 않는다. 트리거 단위 토큰 경로의 `401 EXECUTION_NOT_FOUND` 도 부재(실행이 없거나 트리거가 지워짐)를 뜻한다. 가드는 트리거 단위 토큰을 그 실행의 트리거에 저장된 값과 견줘 확인하므로 실행이나 트리거가 없으면 다른 토큰 검증 실패와 같은 `deny()`(401 전용)로 거부한다. 카탈로그 항목은 [에러 코드 규약과 카탈로그 §6.9](../CLE-API/CLE-API-ERRCODES.md#69-eia-rest-외부-표면-도메인-문서-참조) 에 있다.
  3. `VALIDATION_ERROR`·`details[]` 는 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 기본값을 따른다. `INVALID_COMMAND`·`MESSAGE_TOO_LONG`·`TOO_MANY_CONNECTIONS`·`STATE_MISMATCH`·`EXECUTION_TERMINATED`·`TOKEN_REFRESH_NOT_IN_WINDOW`·`TOKEN_REFRESH_FAILED`·`TOKEN_REFRESH_FORBIDDEN` 은 EIA 전용 코드로 규약 기본값을 일부러 덮는다. `EXECUTION_ENQUEUE_FAILED`(503)는 EIA 전용 코드가 아니고 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 표준 코드를 그대로 쓴다.

### 실행 엔진 에러와 EIA 코드의 대응

같은 publisher 쪽 명령 사전 검증을 WebSocket ack 와 EIA REST 가 함께 쓴다. 코드 이름은 각 경로의 관례를 따르고, 뜻이 같다는 관계를 아래 표로 고정한다. 검증 규칙 자체는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 가 정한다.

| 실행 엔진 typed error | WS ack `errorCode` | EIA REST |
|---|---|---|
| `InvalidExecutionStateError` | `INVALID_EXECUTION_STATE` | `409 STATE_MISMATCH` |
| `MessageTooLongError` | `EXECUTION_MESSAGE_TOO_LONG` | `400 MESSAGE_TOO_LONG` |
| `FormValidationError` | `VALIDATION_ERROR` | `400 VALIDATION_ERROR`(+ `details[]`) |

이 대응은 EIA REST 의 실행 상태·메시지 에러 코드에 한한다. 같은 뜻의 내부 REST 코드는 `INVALID_STATE`(422)를 쓴다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)). 토큰 인증 실패 코드(`TOKEN_*`)는 위 에러 표가 정한다.

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

`interact` 의 `command: "cancel"` 과 뜻이 같은 편의 별칭이다. 실제 취소가 비동기일 수 있어 `202 Accepted` 로 답한다. ack 는 `interact` 와 같은 `InteractAckDto` 다(`@ApiAcceptedWrappedResponse(InteractAckDto)`). 확정 상태는 SSE `execution.cancelled` 로 받는다. `/cancel` 은 인바운드 명령 레이트 리밋 버킷을 `/interact` 와 함께 쓴다. 입력 대기 실행의 취소 명령을 재개 큐에 넣지 못하면 `503 EXECUTION_ENQUEUE_FAILED` 다([명령 에러](#명령-에러)).

## 동시성

같은 실행의 같은 노드에 인바운드 명령 두 개가 동시에 오면 나중 명령은 `409 STATE_MISMATCH` 다. 첫 명령이 이미 입력 대기에서 재개로 전이를 일으켜 상태가 바뀌었기 때문이다. 경쟁 상태로 보지 않고 명시적 직렬화로 다룬다. 실행당 동시에 처리하는 명령은 하나다. 클라이언트는 멱등 키를 늘 함께 보내 첫 명령의 응답을 다시 조회해도 같은 결과를 받게 하는 것이 좋다.

## 멱등 키

멱등 키(`Idempotency-Key`)는 `/interact` 와 `/cancel` 에 적용한다(`idempotency.interceptor.ts`).

- **캐시 대상은 닫힌 목록이다**: `2xx`·`409`·`410` 만 캐시한다. `400 VALIDATION_ERROR` 는 캐시하지 않는다. 입력 대기가 유지돼 사용자가 폼을 고쳐 같은 키로 다시 보내는 것이 정상 흐름이기 때문이다. 그 밖의 `400` 과 `5xx` 도 캐시하지 않는다. 다시 시도할 가치가 있는 실패라 캐시하면 재시도 자체를 막는다. 구현에서 이 목록을 조건으로 옮길 때 한 번의 비교로 줄이면 안 된다. `statusCode === 400` 은 다른 400 코드와 5xx 를 캐시 대상으로 만들고, `statusCode >= 400` 은 반대로 `409`·`410` 을 빠뜨린다. 열거를 그대로 조건에 옮긴다.
- **큐 적재 실패(503)는 캐시하지 않는다**: `503 EXECUTION_ENQUEUE_FAILED` 는 위 목록 밖이다. 같은 멱등 키로 다시 보내면 새로 처리하고 재개 큐 적재를 다시 시도한다. 적재가 성공한 뒤의 `202` 는 캐시한다.
- **캐시 키 범위**: 헤더 값만 쓰지 않고 `interaction:idempotency:<executionId>:<route>:<key>` 로 묶는다. `<executionId>` 는 가드가 토큰을 검증한 뒤 합성한 값이고, `<route>` 는 `interact` 또는 `cancel` 이다. TTL 은 24시간이다. 키 형태는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 에 있다.
- **범위 단위는 실행이다**: 토큰이 갱신되든, 계열(`iext`·`itk`)이 다르든 같은 실행을 대상으로 한 두 요청은 같은 작업이다.
- **캐시 항목**: `{ bodyHash, responseJson, statusCode }` 다. 같은 키에 본문 해시가 다르면 `409 IDEMPOTENCY_KEY_CONFLICT` 다.
- **fail-open**: Redis 를 쓸 수 없거나(죽었다) 캐시 항목이 손상됐으면(살아 있는데 값이 오염됐다) 멱등성을 포기하고 새로 처리한다. 손상은 항목 형태 불일치나 안쪽 `responseJson` 파싱 실패로 나타나며, 손상 항목은 버리고 경고를 남긴다. `statusCode` 는 타입과 범위를 모두 검사한다. `isHttpStatusCode()` 가 `Number.isInteger` 와 `100`~`599` 를 본다. 이 검사가 없으면 `-1`·`600` 같은 값이 통과해 `res.status(-1)` 이 전송 때 `RangeError` 로 500 을 낸다.
- **경고 로그**: 인터셉터의 실패 경로 다섯 가지는 (1) 기동 때 Redis 미주입, (2) 조회 실패, (3) 적재 실패, (4) 직렬화 실패, (5) 항목·payload 손상이다. (1)만 경고하지 않는다. Redis 를 붙이지 않은 것은 장애로 보지 않고 설정 상태로 보기 때문이다.
- **컨텍스트가 없으면 건너뛴다**: `req.interaction` 이 없으면(가드 미적용 등) 캐시를 건너뛰고, 범위 없는 전역 키로 대신하지 않는다.
- **저하 구간**: 정상일 때도 GET 과 SET 이 원자적이지 않아 좁은 창이 있다. Redis 장애가 이어지는 동안에는 그 창이 장애 구간 전체로 넓어져 같은 키 재요청이 모두 캐시 미스가 되고 다운스트림이 중복 실행될 수 있다. "같은 응답 24시간 재현" 은 정상 경로의 계약이고 저하 구간의 멱등성은 최선 노력이다. 운영자는 Redis 실패율로 이 구간을 알아챌 수 있어야 한다.

## Rationale

### 멱등 캐시에서 폼 검증 실패를 뺀다

`submit_form` 필드 검증 실패를 캐시하면 사용자가 폼을 고쳐 같은 키로 다시 낼 때 낡은 에러를 돌려받는다. 이는 "검증 실패 → 입력 대기 유지 → 다시 제출" 흐름([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md))과 정면으로 부딪친다. `5xx` 를 캐시하지 않는 것도 같은 이유다. 일시적 서버 에러를 24시간 고정하면 같은 키로 다시 시도해도 계속 같은 실패를 받아, 정상 응답을 재현한다는 멱등의 취지와 정반대가 된다.

캐시 키를 실행과 경로로 묶는 이유는 두 축이다.

- 실행 축: 키를 헤더 값에만 묶으면 모든 실행·모든 토큰 보유자가 네임스페이스를 함께 쓴다. 요청자 B 가 자기 실행에 정당한 토큰으로 A 와 같은 키·같은 본문을 보내면 캐시에 걸려 B 의 명령이 서비스에 닿지 않은 채 A 의 응답이 B 에게 간다. B 는 `202 accepted` 를 받아 유실을 알아채지 못하고 A 의 응답 본문이 B 에게 노출된다. 가드가 인터셉터보다 먼저 돌므로 인증 우회는 없고, 깨지는 것은 그다음이다.
- 경로 축: 같은 인터셉터가 `interact` 와 `cancel` 두 곳에 붙는다. `CancelDto` 는 모든 필드가 선택이라 본문 `{}` 가 가능하고, 그때 본문 해시가 `{}` 인 `interact` 요청과 같아져 `cancel` 의 ack 가 `interact` 에 재생된다. `cancel` 이 `interact` 의 편의 별칭이라는 것은 응답 DTO 형태가 같다는 뜻이지 캐시 네임스페이스를 함께 쓴다는 뜻이 아니다.

범위를 토큰(jti)으로 잡으면 `refresh-token` 으로 토큰이 바뀐 뒤의 재시도가 다른 키로 떨어져, 멱등이 보장하려는 바로 그 재시도 시나리오를 깬다. 범위를 다시 전역으로 되돌리면 위 두 축이 다시 열린다. 실행 단위로 묶은 Redis 전역 키에는 선례가 있다. 실행 엔진의 `exec:seq:<executionId>`·`exec:cont:seq:<executionId>` 가 "executionId 가 이미 전역 유일 UUID" 라는 근거로 같은 형태를 쓴다([비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)).

손상 항목의 예외를 그대로 올리면 500 이 되어 fail-open 원칙과 정반대가 된다. `req.interaction` 이 없을 때 전역 키로 조용히 대신하면 이 결정이 닫은 문을 그대로 다시 연다. 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET 실패·직렬화 실패)가 모두 "멱등성을 포기하고 요청은 통과" 인 것과도 맞다.

### WS 코드와 EIA 코드는 경로마다 다르게 쓴다

같은 실행 엔진 사전 검증을 두 진입점이 함께 쓰지만, 에러 코드 이름은 각 경로의 관례를 따르고 뜻이 같다는 관계를 표로 고정한다. WS 채널은 실행 엔진 내부 코드 네임스페이스(`EXECUTION_*`, 시스템 수준 `INVALID_EXECUTION_STATE`, [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md))를 직접 드러낸다. EIA REST 는 공개 외부 API 라 HTTP 상태와 함께 간결한 코드(`STATE_MISMATCH`·`MESSAGE_TOO_LONG`)를 쓴다. 한 이름으로 강제로 맞추면 (a) WS 가 REST 식 코드를 써서 내부 enum 과 어긋나거나, (b) REST 가 `EXECUTION_*` 를 그대로 드러내 외부 API 가 내부 구현 식별자에 묶인다.

이 원칙은 실행 엔진 typed error 를 EIA 코드로 옮기는 경우에 한한다. `EXECUTION_NOT_FOUND`(404)와 `EXECUTION_ENQUEUE_FAILED`(503)는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 오른 표준 코드라 EIA 도 그대로 쓴다. 이름이 `EXECUTION_` 으로 시작해도 내부 구현 식별자가 아니므로 (b) 와 부딪치지 않는다.

### 토큰 검증 실패는 모두 401

인바운드 토큰 검증 실패(`TOKEN_INVALID`·`TOKEN_EXPIRED`·`TOKEN_REVOKED`·`TOKEN_SCOPE_MISMATCH`·`TOKEN_AUDIENCE_MISMATCH`)를 모두 `401 Unauthorized` 로 적고 코드는 모두 `TOKEN_*` 로 맞춘다. 구현(`interaction.guard.ts` 의 `deny()` = `UnauthorizedException`)과 e2e 가 이미 401 이라 명세를 구현에 맞췄다.

범위·용도 불일치를 HTTP 뜻 그대로 `403`(인증됐지만 인가 실패)으로 나누는 안은 기각했다. (1) `403` 은 "토큰은 유효하지만 권한만 모자라다" 는 정보를 밖에 알린다. 이는 알림 웹훅 서명 검증에서 누락·형식·시간 창·불일치를 모두 같은 401 로 묶어 알고리즘 노출을 막는 원칙과 어긋난다. (2) EIA 토큰은 실행 범위라 "다른 실행의 토큰" 은 사실상 그 리소스에 대한 인증 실패다. (3) `deny()` 가 401 전용이라 403 분기를 넣으려면 가드 리팩토링과 e2e 회귀 위험을 감수해야 하는데 보안 이득이 없다.

이 결정은 가드가 핸들러 전에 판정하는 검증 실패 다섯 가지에 한한다. `refresh-token` 의 `403 TOKEN_REFRESH_FORBIDDEN` 은 이 통일의 예외이고, 기각한 대안을 다시 들인 것이 아니다. 기각한 것은 "범위·용도 불일치를 403 으로 나누기" 였고 그 두 코드는 지금도 401 이다. 예외인 이유는 둘이다. (1) 판정 위치가 다르다. 가드를 통과한 유효 토큰이 갱신 경로를 잘못 쓴 경우이고, 판정은 서비스(`interaction.service.ts` 의 `refreshToken`)가 한다. (2) 노출 이득이 없다. 토큰 계열은 문자열 접두사(`iext_`·`itk_`)라 호출자가 이미 안다. 반면 범위·용도 불일치는 호출자가 스스로 확정할 수 없는 관계 정보라 성격이 다르다. `TOKEN_REFRESH_FORBIDDEN` 은 구현 첫 커밋부터 있었고, 이 결정의 근거도 처음부터 `deny()` 로 한정돼 있었다.

### `interact`·`cancel` 은 202 와 ack 본문

`interact`·`cancel` 은 비동기라 `202 Accepted` 로 답하되 빈 응답 대신 둘 다 `InteractAckDto` 를 돌려준다. `cancel` 은 `interact` 의 편의 별칭이라 같은 ack 를 쓰는 것이 자연스럽고, 클라이언트가 두 엔드포인트의 풀기 로직을 나누지 않아도 된다.

ack 본문을 돌려주는 이유는 셋이다. (1) 명령 직후 관측한 `currentStatus`(곧바로 다시 입력 대기에 들어갈 수 있음)를 SSE 구독 전에 한 번 확인할 수 있어 경험이 매끄럽다. (2) `accepted: true` 가 큐 적재 성공을 명시한다. (3) 다른 엔드포인트와 같은 응답 봉투로 한결같이 처리된다. `interact` 만 본문 없는 예외로 두면 클라이언트 풀기 로직이 갈린다. 본문이 비동기 진행의 확정 상태를 뜻하지 않는다는 점(202)은 그대로이고, 확정 상태는 SSE 나 상태 조회로 받는다.

큐에 넣지 못한 명령에는 202 를 내지 않고 `503 EXECUTION_ENQUEUE_FAILED` 로 응답한다(2026-10-09). 202 는 멱등 캐시에 들어가므로 적재 실패를 202 로 답하면 같은 키로 다시 보내도 캐시된 202 가 돌아오고 명령은 끝내 적재되지 않는다. 결정의 자세한 근거는 [EIA 데이터와 흐름 「재검토에서 갈린 EIA 동작을 정한다」](CLE-EIA-DATA.md#재검토에서-갈린-eia-동작을-정한다-2026-10-09) 에 있다.

### `STATE_MISMATCH` 를 구현에 강제했다

`409 STATE_MISMATCH` 의 두 사유인 대기 표면 불일치(`form`·`buttons` 대기 중 다른 종류 명령)와 `nodeId` 불일치(명령의 `nodeId` 가 실제 대기 노드와 다름)는 계약이 처음부터 정했다. 그런데 구현이 한동안 이 조합을 거부하지 않고 `202` 로 받았다. publisher 쪽 명령 사전 검증([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md))으로 두 사유를 모두 강제해 구현을 계약에 맞췄다(대기 표면 2026-07-10, `nodeId` 2026-07-14). 계약은 늘 `409` 였으므로 별도 호환성 깨짐 공지는 내지 않는다. 이전의 `202` 에 기댄 클라이언트는 문서화되지 않은 결함에 기댄 것이다. 진입점별 `nodeId` 검사 범위는 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 의 표가 정한다.
