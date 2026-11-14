---
id: "CLE-API-CONV-RESP"
title: "HTTP API 규약 — 응답 형식과 상태 코드"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-CONV"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-CONV"]
area: "CLE-API"
content_hash: "66cb3ba4be33c6bb985f33e5dbfc62d4fda9d13aced6cfb5c283756443799882"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "3b183798524898428bff6415087c9e651096ee63f06fa3b59d943db02a02e94f"
etag: "sha256-c0cc2a764609c3acf17a97f84a6648e47efc3b9c219fb7956a83c5f64e9f24c0"
---
## 개요

이 문서는 [HTTP API 규약](CLE-API-CONV.md) 의 하위 문서로 성공 응답 봉투와 목록 형태, 값이 없을 때의 부재 표현과 그 검증 층, HTTP 상태 코드, 페이지네이션, 파일 업로드를 정한다. 절 번호(§)와 「규칙 n」 은 부모 문서의 번호를 그대로 쓴다. 에러 응답 봉투와 에러 코드는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 와 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 가 정한다.

## 5. 응답 형식

### 5.1 단일 리소스

```json
{
  "data": {
    "id": "uuid",
    "name": "My Workflow",
    "...": "..."
  }
}
```

### 5.2 목록 응답

```json
{
  "data": [
    { "id": "uuid-1", "...": "..." },
    { "id": "uuid-2", "...": "..." }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3
  }
}
```

- `data`(배열)와 `pagination` 은 최상위 형제다. 중첩하지 않는다.
- 목록 핸들러는 공용 `PaginatedResponseDto`(`{ data, pagination }`)를 돌려준다. 전역 `TransformInterceptor` 는 이미 `data` 키가 있는 객체를 더 감싸지 않고 그대로 통과시킨다(pass-through). 그래서 §5.1 단일 리소스의 `{ data: <obj> }` 와 달리 `data` 가 한 겹 더 감싸이지 않는다. 통과 분기의 동작과 데코레이터 표기는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 응답 wrapping 절이 정한다.

### 5.3 고정 목록 응답

페이지를 나누는 의미가 없는 작은 본인 소유 목록(활성 로그인 세션 목록, WebAuthn credential 목록)은 고정 목록 응답(non-paginated collection)을 쓴다. `pagination` 없이 `items` 배열 하나를 `data` 아래에 중첩한 `{ "data": { "items": [ ... ] } }` 형태다.

- 핸들러가 `{ data: { items } }` 를 직접 돌려주면 이미 최상위 `data` 키가 있으므로 `TransformInterceptor` 가 그대로 통과시킨다. §5.2 와 같은 `'data' in data` 통과 경로다.
- §5.2 페이지 목록(`data` 가 배열 자체이고 `pagination` 이 형제)과 형태가 다르다.
- [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 레거시 패턴 절이 버그로 지목한 `{ data: { items, totalItems, page, limit } }`(페이지 메타를 `items` 옆에 섞은 오용)과도 다르다. 이 형태에는 `pagination` 필드가 아예 없다.
- 이 형태를 유지하는 근거는 Rationale 의 "고정 목록 응답을 `{ data: { items } }` 로 유지" 에 있다.

### 5.4 에러 응답

HTTP 에러 응답은 에러 응답 봉투(error envelope) `{ "error": { "code", "message", "requestId", "details"? } }` 형식이다. 봉투 필드의 뜻, 상태 코드별 기본 에러 코드, `details` 를 싣는 규칙은 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 가 정한다.

### 5.5 부재 표현: `null` 과 키 생략

**적용 범위는 응답 바디다.** 이 절은 서버가 내보내는 표현을 정한다. 요청 바디는 대상이 아니다.

- 특히 PATCH 부분 수정은 키 생략(값 유지)·`null`(초기화)·값(설정)이 각각 뜻을 갖는 PATCH 삼중 상태 계약이다. 아래 "DTO 선언 형태" 규칙을 요청 DTO 에 그대로 적용하면 `?` 가 사라져 "필드를 생략하면 값이 유지된다" 는 계약이 깨진다.
- 요청 DTO 에서는 `@ApiPropertyOptional({ nullable: true })` 와 `field?: T | null` 조합이 정당하다. 선례는 `UpdateAssistantSessionDto.llmConfigId` 다("null 전달 시 workspace default 로 폴백").

값이 없음을 나타내는 방식은 두 가지다. 한 응답 안에 섞여도 되지만 필드마다 근거가 있어야 한다.

| 표현 | 뜻 | 선택 기준 |
|------|------|----------|
| `null` (키는 있음) | 이 필드는 응답 계약에 늘 있고 지금은 값이 없다 | **기본값.** 소비자가 키가 있다고 전제하고 값만 분기하면 되는 스칼라·객체 필드 |
| **키 생략** | 값이 있을 때만 싣는다(present-when-available) | (a) 같은 데이터를 싣는 다른 표면(SSE·WebSocket wire)과 형식을 맞춰야 할 때. (b) 선택적인 부가 맥락이라 소비자가 부재를 정상 경로로 다룰 때 |

- **기본은 `null` 이다.** 키 생략은 (a)나 (b)에 해당할 때만 쓰고 그 필드를 문서화하는 절에 사유를 적는다.
- **DTO 선언이 wire 를 반영해야 한다.** 데코레이터 예시는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 DTO 패턴 절에 있다. 판정 기준과 선언 형태는 이 절이 단일 기준이다.
  - 키를 생략하는 필드: `@ApiPropertyOptional()` 과 `field?: T` (`| null` 금지)
  - `null` 을 쓰는(늘 있는) 필드: `@ApiProperty({ nullable: true })` 와 `field: T | null`
  - TS 타입이 `| null` 인데 `nullable: true` 를 선언하지 않는 것은 어느 쪽에서도 틀리다. OpenAPI 가 null 가능성을 감춰 소비자가 null 이 올 수 없다고 믿게 된다.
- **`null` 필드에 `@ApiPropertyOptional` 을 쓰지 않는 이유**: 그 데코레이터는 `ApiProperty({ required: false })` 의 별칭이다(`@nestjs/swagger` 구현). 늘 있는 필드에 쓰면 OpenAPI 에 `required: false` 로 나가 "늘 있다" 는 정의와 모순된다. 생성기가 그 필드를 optional 로 만들어 소비자가 키 부재 분기를 쓰게 된다.
- 클라이언트는 두 표현을 모두 안전하게 다뤄야 한다. optional chaining(`a?.b`)은 `undefined` 와 `null` 을 함께 건너뛰므로 대개 가드 하나로 충분하다.
- **소급 적용하지 않는다.** 표현 선택과 DTO 선언 형태 모두 앞으로 도입하거나 바꾸는 필드에 적용한다. 이미 문서화된 키 생략 필드(`mcpDiagnostics`, Cafe24 `status`·`requiresCafe24Approval`, 채팅 채널 `details.statusCode` 등)는 기준 (b)를 충족하는 것으로 보고 사유 문구를 소급해 요구하지 않는다.

이 절은 새로 만든 규칙이 아니라 이미 쓰던 관행을 문서로 옮긴 것이다. 기존 선례는 아래와 같다.

| 표현 | 선례 |
|------|------|
| `null` | §8.2 `nextCursor`("없으면 `null`") · EIA 단발 상태 조회 `currentNode`·`result`·`error` ([EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)) |
| 키 생략 | 에러 응답의 `details`("있을 때만 싣는다", [에러 응답과 클라이언트 처리](CLE-API-ERROR.md)) · EIA 단발 상태 조회 `context.conversationThread` |

실사례: EIA 단발 상태 조회(`GET /api/external/executions/:id`) 응답은 `currentNode`·`result`·`error` 를 `null` 로 두고 `context.conversationThread` 는 키를 생략한다. 뒤의 것은 기준 (a) 때문이다. 근거는 Rationale 의 "`conversationThread` 를 `null` 로 정규화하지 않는 이유" 에 있다.

#### 검증 층: 이 규칙을 무엇이 강제하는가

이 절은 선언과 실제가 같아야 한다고 정한다. 그런데 컨트롤러가 엔티티를 그대로 돌려주는 경로에서는 `tsc` 가 대조할 지점이 없다. 그 자리를 아래 검증자들이 나눠 맡는다. 이름이 비슷하니 어느 쪽인지 먼저 가려야 한다.

| 검증자 | 무엇과 무엇을 대조하나 | 언제 | 못 보는 것 |
|---|---|---|---|
| `swagger-dto-contract-guard.ts` (repo-guard) | **선언과 선언**: `@ApiProperty` 데코레이터와 TS 타입 | 정적 (AST) | 선언이 양쪽 다 틀린 경우. 실제 응답 값 |
| `response-contract.ts` (testing) | **값과 선언**: 실제 HTTP 응답과 생성된 OpenAPI 스키마 | 런타임 (e2e) | 배선되지 않은 엔드포인트 |
| `user-entity-exposure-guard.ts` (repo-guard) | **구조**: `User` 엔티티를 투영 없이 관계로 싣는 자리를 센다 | 정적 (AST) | 엔티티를 거치지 않고 손으로 조립한 유출 |
| `user-secret-absence.ts` (testing) | **이름**: 응답 바디 어디에도 `User` 민감 컬럼 이름이 없다(응답 노출 금지 민감 컬럼 목록은 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)) | 런타임 (e2e) | 이름이 다른 새 비밀 컬럼. 목록(`USER_SECRET_KEYS`)에 넣어야 걸린다 |

- **개수를 세지 않는다.** 축이 늘 때마다 숫자가 낡는다. 문장은 나열을 가리키고 인벤토리는 위 표에 둔다.
- **두 축이 서로 다른 규칙을 시행한다.** `response-contract.ts` 의 판정 중 required/nullable 축은 이 절을 시행하고 "스키마에 선언하지 않은 키가 응답에 있다" 축은 [OpenAPI 문서화](CLE-API-SWAGGER.md) 의 응답 DTO 위치 절(엔티티를 그대로 노출하지 않는다)을 시행한다. 그래서 그 검증자는 두 문서의 구현 위치에 모두 등재한다. 한쪽에만 등재하면 다른 축의 변경이 재검토를 부르지 못한다.
- 판정 규칙의 상세 표는 코드 JSDoc 이 단일 기준이다. 여기에 옮겨 적으면 어긋날 원천이 하나 더 생길 뿐이다.
- `swagger-probe.ts` 는 스키마 생성 자체를 맡으므로 이 절과 무관한 이유로도 바뀔 수 있다. 그 변경이 이 문서를 재검토 대상으로 만드는 것은 의도한 과포함이다(판정 근거가 바뀌기 때문이다).

## 6. HTTP 상태 코드

| 코드 | 의미 | 사용 상황 |
|------|------|-----------|
| 200 | OK | 조회, 수정 성공 |
| 201 | Created | 생성 성공 |
| 202 | Accepted | **비동기 수락.** 큐에 넣고 바로 돌아오며 결과는 별도 채널(실행 상세·WebSocket·SSE)로 전한다. 웹훅 수신([§11](CLE-API-CONV-HOOK.md#11-웹훅-수신-엔드포인트))·실행 트리거·재임베딩 같은 긴 작업에 쓴다. no-content 가 아니다. `{ data: { executionId, ... } }` ack 본문을 싣는다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md), [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)) |
| 204 | No Content | 삭제 성공 |
| 400 | Bad Request | 잘못된 요청 (유효성 검증 실패) |
| 401 | Unauthorized | 인증 필요 또는 토큰 만료. EIA 트리거 단위 토큰 경로에서 실행이 없을 때도 `401`(`EXECUTION_NOT_FOUND`)이다(`404` 행) |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음. **예외**: EIA 의 트리거 단위 토큰(`itk_*`)으로 보낸 요청과 연 스트림은 실행이 없거나 그 실행의 트리거가 지워졌으면 `401 EXECUTION_NOT_FOUND` 를 받는다. 가드(`InteractionGuard`)가 핸들러 전에 부재를 판정해 다른 토큰 검증 실패와 같은 `401` 로 거부하기 때문이다([EIA 수신 API와 SSE 「명령 에러」](../CLE-IX/CLE-EIA-INBOUND.md#명령-에러), [에러 코드 규약과 카탈로그 §6.9](CLE-API-ERRCODES.md#69-eia-rest-외부-표면-도메인-문서-참조)). EIA 토큰 갱신에서 실행이 없을 때는 `410` 이다(`410` 행) |
| 409 | Conflict | 리소스 충돌 (중복 생성 등) |
| 410 | Gone | 리소스가 존재했으나 사라졌거나 비활성이다. 처음부터 없는 `404` 와 구분한다. 비활성 웹훅 트리거 `TRIGGER_INACTIVE`([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)) · 트리거의 워크플로우가 비활성인 웹훅 `WORKFLOW_INACTIVE`([트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문)) · 종료된 실행에 대한 명령 `EXECUTION_TERMINATED`([EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)) · 만료되거나 사용된 초대 `invitation_expired`·`invitation_already_used`([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)). **예외**: EIA 토큰 갱신(`POST /api/external/executions/:id/refresh-token`)은 존재한 적 없는 실행에도 `410 EXECUTION_TERMINATED` 를 돌려준다. 실행이 있었는지를 응답으로 가르지 않아 정보 노출을 줄인다([EIA 수신 API와 SSE 「토큰 갱신」](../CLE-IX/CLE-EIA-INBOUND.md#토큰-갱신)). **예외**: `config.chatChannel` 트리거는 `410` 대신 `202` 와 `{ executionId: 'ignored' }` 를 돌려준다. 워크플로우가 비활성일 때는 새 실행을 시작하는 인입만 그렇다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문)). 인터랙션 요청은 `200` 과 채널 프로바이더가 정한 인터랙션 응답을 받는다([채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)). `410` 에는 기본 에러 코드가 없다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md)) |
| 413 | Payload Too Large | 요청 본문이 body-parser 한도를 넘었다. 코드 `PAYLOAD_TOO_LARGE`. 웹훅 본문 크기 정책은 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 422 | Unprocessable Entity | 비즈니스 로직 에러 |
| 429 | Too Many Requests | 요청 빈도 제한 초과 |
| 500 | Internal Server Error | 서버 에러 |
| 502 | Bad Gateway | **외부 제3자 API**(채팅 채널 provider 등) 호출 실패. 다시 시도할 수 있다. 코드: `CHAT_CHANNEL_SETUP_FAILED`(채팅 채널 `setupChannel` 실패, [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)). 아래 `503` 과 구분한다. `502` 는 외부 제3자, `503` 은 우리 인프라다. `WEBAUTHN_DISABLED` 의 `503` 예외는 `503` 행에 있다. 노드 출력 안의 `statusCode` 와는 다른 축이다. 그쪽은 HTTP Request 노드가 받은 응답 상태이고 이 표는 우리 API 가 클라이언트에 주는 상태다 |
| 503 | Service Unavailable | 상위 의존성(Redis 등)의 일시 장애로 요청을 받을 수 없다. 다시 시도할 수 있다. 다만 이 행 끝의 `WEBAUTHN_DISABLED` 는 다시 시도해도 회복되지 않는다. 코드: `SERVER_SHUTTING_DOWN`(SIGTERM 뒤 새 실행 거부)·`EXECUTION_ENQUEUE_FAILED`(재개 메시지 발행 실패로 취소·재개 명령 미수락)·`SERVICE_UNAVAILABLE`(로그인 2단계 Passkey 인증 검증에서 Passkey 인증 챌린지를 기록하지 못함, [가입과 로그인 「Passkey 등록·인증 흐름」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름)). 채팅 채널 인바운드의 `/start` 도 기존 실행 취소가 `EXECUTION_ENQUEUE_FAILED` 로 실패하면 `202` 대신 이 `503` 을 그대로 돌려주고 새 실행을 시작하지 않는다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)). 채팅 채널 인바운드의 `/cancel` 과 진행 중인 대화의 입력(재개 명령)은 큐에 넣지 못해도 이 `503` 을 돌려주지 않는다. `202` 로 답하고 채널 건강도를 `degraded` 로 둔다([채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)). 코드 정의는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 WebSocket 명령 절이고 `SERVICE_UNAVAILABLE` 은 시스템 절이다. 예외로 `WEBAUTHN_DISABLED`(Passkey 환경 변수 미설정, [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능-켜기와-환경-변수))도 이 상태를 쓴다. 일시 장애가 아니라 서버 설정으로 꺼진 기능의 응답이다. 이 코드는 운영자가 설정을 바꿀 때까지 회복되지 않는다. 로그인(`POST /api/auth/login`)도 Passkey 만 등록하고 TOTP 가 꺼진 계정을 이 코드로 거부한다. 클라이언트는 다시 시도하지 않는다. Passkey 설정 화면은 가용성 조회 결과로 기능을 숨긴다. 로그인 화면은 이 코드를 받으면 안내 문구를 보여 준다 |

자원을 만들지 않는 POST 액션의 성공 코드를 정하는 행은 아직 없다. [미결 사항](CLE-API-CONV.md#미결-사항) 참조.

## 8. 페이지네이션

### 8.1 Offset 방식 (기본)

```
GET /api/workflows?page=2&limit=20
```

### 8.2 Cursor 방식 (대량 노드 실행 목록 등)

Background 노드 본문의 노드 실행(NodeExecution) 목록처럼 대량으로 쌓이는 데이터는 cursor 페이지네이션을 쓴다.

```
GET /api/executions/{executionId}/background-runs/{backgroundRunId}?cursor=eyJ...&limit=20
```

응답의 `nodeExecutions` 묶음이 cursor 페이지를 담는다. 키는 `nextCursor`(opaque base64, 없으면 `null`)와 `hasMore`(다음 페이지가 있는지)다.

```json
{
  "data": {
    "nodeExecutions": {
      "data": [...],
      "nextCursor": "eyJ...",
      "hasMore": true
    }
  }
}
```

워크플로우별 실행 목록(`GET /api/executions/workflow/:workflowId`)은 cursor 방식이 아니라 §8.1 offset 방식(`{ page, limit, totalItems, totalPages }`)이다. Background 본문 조회 API 의 전체 계약은 [Background 노드](../CLE-NODE-LOGIC/CLE-NODE-BACKGROUND.md) 에 있다.

## 9. 파일 업로드

| 항목 | 규칙 |
|------|------|
| 형식 | `multipart/form-data` (필드명 `file`) |
| 최대 크기 | 엔드포인트마다 다르다. 지식 저장소 문서 50MB, 아바타 2MB (각 `FileInterceptor` 의 `limits.fileSize`) |
| 허용 타입 | 엔드포인트마다 제한한다. 지식 저장소 문서는 PDF·Markdown·텍스트 등, 아바타는 `png`·`jpg`·`jpeg`·`webp`·`gif`(SVG 제외) |
| 응답 | 엔드포인트마다 다르다. 지식 저장소 문서는 올린 파일 메타데이터(id, status 등), 아바타는 `PATCH /users/me` 와 같은 프로필 응답([내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md)) |

파일 업로드 엔드포인트는 지식 저장소 문서 업로드(`POST /api/knowledge-bases/:id/documents`)와 아바타 업로드(`POST /api/users/me/avatar`, [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md))다. 아바타는 `PATCH /api/users/me` 의 `avatarUrl` 로 외부 URL 을 넣는 경로도 함께 유지한다. 두 경로가 같은 컬럼을 쓴다.

## 구현 위치

§5.5 「검증 층」 의 검증자와 대조군이다. 공통 구현 위치(응답 래핑 · 에러 필터 · DTO)는 [HTTP API 규약](CLE-API-CONV.md#구현-위치) 에 있다.

- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` (선언과 선언 대조)
- `codebase/backend/src/shared/testing/response-contract*.ts` (값과 선언 대조)
- `codebase/backend/src/shared/testing/swagger-probe*.ts`
- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure*.ts`
- `codebase/backend/src/shared/testing/user-secret-absence*.ts`
- 대조군(negative fixture). 위 가드가 강제하는 위반 형태의 실례다. 없으면 술어가 죽어도 테스트가 통과한다(실제로 그 상태로 한 라운드를 지났다).
  - `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-eager-relation*.ts`
  - `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load*.ts`

## Rationale

### 고정 목록 응답을 `{ data: { items } }` 로 유지

활성 로그인 세션과 WebAuthn credential 목록은 페이지를 나눌 의미가 없는 작은 본인 소유 목록이고 `{ data: { items: [...] } }` 를 돌려준다. §5.2 페이지 목록과 중첩 형태가 달라 일관성 면에서 이상적이지 않다. 그래도 이 형태를 유지하는 이유는 두 가지다.

1. 두 엔드포인트의 백엔드(`sessions.controller.ts`, `webauthn.controller.ts`, `WebAuthnCredentialListDto`, `SessionListDto`)와 프론트엔드(`lib/api/sessions.ts`, `passkey-card.tsx` 가 `res.data.data.items` 를 읽음)가 이미 이 계약에 기대고 있다.
2. 배열 하나로 평탄화하면 백엔드 2곳과 프론트엔드 2곳을 한꺼번에 바꾸는 호환성 파괴 변경이라 얻는 것에 비해 비용이 크다.

고정 목록을 `{ data: [] }` 로 정규화하는 대안은 호환성을 깨므로 별도 결정이 날 때까지 미룬다. 이 형태는 [OpenAPI 문서화](CLE-API-SWAGGER.md) 가 기각한 페이지네이션 이중 래핑 버그(`{ data: { items, totalItems, page, limit } }`)와 무관하다. `pagination` 필드가 전혀 없는 고정 목록에만 해당한다.

### `conversationThread` 를 `null` 로 정규화하지 않는 이유 (§5.5)

`GET /api/external/executions/:id` 한 응답 안에서 `currentNode`·`result`·`error` 는 `null` 이고 `context.conversationThread` 는 키를 생략한다. 한 응답에 부재 표현이 섞이면 결함처럼 보이므로 정규화하지 않는 이유를 남긴다.

SSE `execution.waiting_for_input` 이벤트도 `conversationThread` 를 값이 있을 때만 싣는다. [External Interaction API](../CLE-IX/CLE-EIA.md) 는 REST `context` 를 SSE wire 와 같은 형식으로 유지하는 것을 명시 계약으로 두고 웹채팅 위젯이 두 표면에 같은 파서(`parseWaitingForInput`)를 쓰는 것이 그 계약 위에 서 있다. `conversationThread` 만 REST 에서 `null` 로 정규화하면 두 표면의 형식이 갈려 파서를 함께 쓸 수 없다. 응답 안의 겉보기 일관성을 얻는 대신 표면 사이의 실제 일관성을 잃는 교환이다.

그래서 이 경우는 §5.5 기준 (a)(다른 표면과의 wire 일치)의 원형 사례이고 정규화 대상이 아니라 규칙의 근거 사례로 둔다. 소비 쪽 안전성은 따로 확인했다. 위젯의 `threadToMessages` 가 optional chaining(`!thread?.turns?.length`)으로 `undefined` 와 `null` 을 함께 건너뛴다.

### 410 행과 웹훅 처리 흐름에 `WORKFLOW_INACTIVE` 를 더했다 (2026-10-10)

NERV Task `CLE-T-XRWFMJ` 의 결정이다. 웹훅 트리거가 활성이어도 그 워크플로우가 비활성이면 `410 Gone` 과 `WORKFLOW_INACTIVE` 를 돌려준다. §6 의 `410` 행과 §11.3 의 요약 흐름([WebSocket 과 웹훅 수신](CLE-API-CONV-HOOK.md#113-요청-처리-흐름))에 그 분기를 더했다. 관문 규칙이 여러 문서에 같은 문장으로 풀리지 않게 두 자리에는 이 규약이 다루는 HTTP 응답만 한 줄로 남겼다. 경로별 규칙과 근거, 기각한 대안은 [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문) 과 그 문서의 Rationale 에 있다.

### `503` 행에 채팅 채널 `/start` 의 취소 실패를 더했다 (2026-10-10)

NERV Task `CLE-T-V4WVF2` 의 결정이다. 채팅 채널 `/start` 는 활성 실행을 취소할 때 `ExecutionsService.stop` 을 직접 부른다. 취소를 큐에 넣지 못하면 `503 EXECUTION_ENQUEUE_FAILED` 를 그대로 돌려주고 새 실행을 시작하지 않는다. 채팅 채널 인바운드는 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 의 `202` 고정 정책을 따른다. 이 경우는 프로바이더가 요구하지 않는데도 `202` 대신 `503` 을 돌려주는 예외라서 §6 의 `503` 행에 적었다. 프로바이더는 이 응답을 받고 같은 update 를 다시 보낼 수 있다. `5xx` 를 받아들인 이유는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 의 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」 Rationale 에 있다.

### Passkey 기능이 꺼졌을 때의 `503` 을 예외로 적었다 (2026-10-17)

NERV Task `CLE-T-D331TT` 에서 정했다. Passkey 환경 변수가 없으면 가용성 조회와 credential 목록 조회를 뺀 Passkey 엔드포인트는 503 `WEBAUTHN_DISABLED` 를 돌려준다([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능-켜기와-환경-변수)). 규칙 11 은 `503` 을 인프라 의존성의 일시 장애에 쓴다고만 적어 이 응답이 규칙 밖에 있었다. 같은 날 사람 결정으로 Passkey 만 등록하고 TOTP 가 꺼진 계정의 로그인(`POST /api/auth/login`)도 이 응답으로 막게 됐다([가입과 로그인 「Passkey 기능이 꺼지면 Passkey 만 등록한 계정의 로그인을 막는다」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-기능이-꺼지면-passkey-만-등록한-계정의-로그인을-막는다-2026-10-17)). 예외의 범위는 코드 하나 그대로다.

- 상태 코드는 그대로 두고 규칙 11 과 §6 의 `503` 행에 예외로 적었다. [채팅 채널 「setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-23-setupchannel-실패는-전송-방식이-아니라-원인으로-분류한다) 는 4xx · 5xx 경계를 누가 고칠 수 있는가로 정했다. 같은 결정은 `503` 사용처에 `WEBAUTHN_DISABLED` 를 이미 들었다. 서버 설정은 운영자만 고칠 수 있으므로 5xx 가 맞다.
- 저장소 안에서는 로그인 화면만 이 코드로 분기해 안내 문구를 고른다(`codebase/frontend/src/components/auth/login-form.tsx`). Passkey 설정 화면은 가용성 조회로 기능을 미리 숨기고 이 코드로 분기하지 않는다. 저장소 밖 호출자가 이 상태에 기대는지는 배제할 수 없어 상태 코드를 바꾸지 않았다.
- 클라이언트는 이 응답을 다시 시도하지 않는다. Passkey 엔드포인트의 이 응답은 설정이 바뀐 직후의 요청에서만 난다. 화면이 가용성 조회(`GET /api/auth/2fa/webauthn/availability`)로 기능을 미리 숨기기 때문이다. 로그인의 이 응답은 기능이 꺼져 있는 동안 계속 난다.
- 예외는 `WEBAUTHN_DISABLED` 하나로 한정했다. 같은 부류인 `OAUTH_CONFIG_MISSING`(서버 OAuth 설정 없음)은 500 이다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md)). "서버 설정으로 꺼진 기능은 `503`" 을 일반 규칙으로 적으면 이 코드와 부딪친다. 두 코드를 한 상태로 맞출지는 이번에 정하지 않았다([미결 사항](CLE-API-CONV.md#미결-사항)).
- **기각: 다른 상태 코드로 바꾼다.** 403 은 권한 부족으로 읽혀 사용자가 고칠 수 있는 것처럼 보이지만 사용자는 고칠 수 없다. 409 는 요청과 자원 상태의 충돌이라 서버 설정 상태와 맞지 않는다. 500 은 `OAUTH_CONFIG_MISSING` 과 맞출 수 있지만 발행 중인 상태를 바꾸는 일이라 위 불릿의 이유로 하지 않았다.
- **감시 영향**: 로그인의 이 응답은 기능이 꺼져 있는 동안 Passkey 만 등록한 사용자가 로그인할 때마다 난다. 5xx 비율로 경보를 거는 감시는 이 응답도 센다. 운영자가 변수를 설정하면 그치는 응답이라 이 위험은 받아들였다.
- 설정 상태로 `503` 을 내는 곳은 전에도 있었다. `GET /api/health` 는 Redis 가 설정되지 않은 경우(`unconfigured`)에도 503 이다([로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md)). 그 응답은 에러 봉투를 쓰지 않는 probe 응답이라 이 규칙의 예외로 적지 않았다.

### 채팅 채널 `/cancel` 의 큐 적재 실패는 `503` 으로 돌려주지 않는다 (2026-10-17)

NERV Task `CLE-T-EQDYC1` 의 사람 결정이다. 채팅 채널 인바운드의 `/cancel` 은 `ExecutionsService.stop` 을 바로 부른다. 취소를 큐에 넣지 못하면 `stop` 이 `503 EXECUTION_ENQUEUE_FAILED` 를 던진다. 그전에는 이 응답이 채널 프로바이더에 그대로 나가 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 의 `202` 고정 정책과 어긋났다.

이제 `/cancel` 은 `202` 로 답하고 채널 건강도를 `degraded` 로 둔다. 진행 중인 대화의 입력이 재개 큐에 들어가지 못한 경우도 같다. 사람은 분당 한도 초과 · 워크스페이스 불일치 때와 같은 처리를 골랐다. 실패는 채널 건강도와 경고 로그로 운영자에게 보인다. §6 의 `503` 행에는 이 사실을 한 줄로 적었다. 채팅 채널 인바운드가 `503` 을 돌려주는 경우는 `/start` 의 기존 실행 취소 실패 하나로 남는다. 처리 규칙과 근거의 기준은 채팅 채널 문서다.

기각한 대안: `/start` 처럼 `/cancel` 도 `503` 을 돌려주는 안. non-2xx 가 이어지면 프로바이더가 웹훅을 끌 수 있다([채팅 채널 「R-CC-12」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)). `/start` 는 실패를 숨기면 사용자의 새 시작 요청이 사라져서 이 위험을 받아들였다. `/cancel` 은 그 사정이 없다.

### `503` 행의 `SERVICE_UNAVAILABLE` 은 규칙 11 의 일시 장애다 (2026-11-01)

NERV Task `CLE-T-H9QJTA` 에서 더했다. §6 `503` 행은 로그인 2단계 Passkey 인증 검증의 `SERVICE_UNAVAILABLE` 을 적는다. 그 검증은 Passkey 인증 챌린지를 기록하지 못하면 이 코드로 거부한다(NERV Task `CLE-T-GK9J2B`). 기록을 두는 Redis 는 우리 인프라라서 이 응답은 규칙 11 의 일시 장애에 든다. 새 코드를 만들지 않은 이유와 상태 코드를 고른 근거는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 「구현 반영 (2026-10-30, NERV Task `CLE-T-GK9J2B`)」 Rationale 에 있다.

- 그래서 `WEBAUTHN_DISABLED` 처럼 규칙 11 의 예외로 적지 않았다. `WEBAUTHN_DISABLED` 는 장애가 아니라 서버 설정으로 기능이 꺼진 상태라서 예외로 적었다([Passkey 기능이 꺼졌을 때의 `503` 을 예외로 적었다](#passkey-기능이-꺼졌을-때의-503-을-예외로-적었다-2026-10-17)).

### EIA 인바운드의 세 예외를 §6 · §7 에 적었다 (2026-11-05)

NERV Task `CLE-T-VJQZSW` 다. [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 승인본에는 근거와 함께 있는 예외 세 가지가 이 규약에는 없었다. 그래서 그 문서를 검토할 때마다 이 규약과 어긋난다는 경고가 다시 나왔다. 동작은 바꾸지 않았다. 지금 구현과 그 문서의 내용을 이 규약에 옮겨 적었다.

- **트리거 단위 토큰 경로의 `401 EXECUTION_NOT_FOUND`**: 규칙 10 과 `404` 행만 보면 없는 실행은 `404` 다. 트리거 단위 토큰 경로에서는 가드가 핸들러 전에 실행과 그 트리거를 찾아 토큰을 견준다. 그래서 부재도 다른 토큰 검증 실패와 같은 `401` 로 거부한다. 코드의 뜻과 두 상태를 하나로 맞추지 않은 이유는 [에러 코드 규약과 카탈로그 「트리거 단위 토큰 경로의 부재는 401 `EXECUTION_NOT_FOUND` 로 적는다 (2026-10-17)」](CLE-API-ERRCODES.md#트리거-단위-토큰-경로의-부재는-401-execution_not_found-로-적는다-2026-10-17) 에 있다. 이 문서의 `401` · `404` 행은 그쪽을 가리키기만 한다.
- **토큰 갱신의 `410`**: 토큰 갱신은 없는 실행에도 `410 EXECUTION_TERMINATED` 를 돌려준다. 규칙 10 대로라면 처음부터 없던 실행은 `404` 다. 클라이언트에게는 어느 쪽이든 그 실행을 더 이을 수 없다는 같은 결론이다. 있고 없음을 가르지 않는 편이 정보 노출도 줄인다. 그래서 `410` 행의 예외 목록에 더했다.
- **`/cancel` 과 `/refresh-token` 의 한도**: `/cancel` 은 `interact` 의 `command: "cancel"` 과 뜻이 같은 별칭이고 `/interact` 와 같은 실행 단위 카운터를 센다. `/refresh-token` 에는 실행 단위 한도가 없고 전역 기본값만 걸린다. 수치는 규칙 12 대로 [§7](CLE-API-CONV-RATE.md#7-요청-빈도-제한) 표에만 적는다. [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 는 두 사실을 수치 없이 적고 있어 고치지 않았다.
