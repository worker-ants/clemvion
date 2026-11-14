---
id: "CLE-API-WS"
title: "WebSocket 연결과 채널 구독"
type: "design"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API"
ancestors: ["CLE-VISION", "CLE-API"]
area: "CLE-API"
content_hash: "dd35ba92930d13ab1cf4f0175e0118312eef82a3a6720cfaf90ba40b6ea48834"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/6-websocket-protocol.md"]
mirror_sha256: "4cc88b77313f3e2a6b1a035dccb163f67d94fe90e9d4b341c42e4d1ad20b8111"
etag: "sha256-417e7c52302a5f425033d80d5801711a827c899ba7c4506ba316a39e84883cc8"
---
> 구현 상태: 구현됨 (raw WebSocket 전제 항목 일부는 비채택) · 원문: `spec/5-system/6-websocket-protocol.md` (Overview, §1~§3, §5~§9, Rationale 일부) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 서버와 프론트엔드 사이의 양방향 실시간 채널인 WebSocket(`/ws`)의 연결 방식을 정한다. 전송 계층, 게이트웨이에서 전역 enhancer 가 동작하는 방식, 인증과 토큰 만료, 메시지 형식과 서버 이벤트 봉투, 구독 채널(subscription channel) 구독과 인가, heartbeat, 재연결과 놓친 이벤트 복구, 전송 계층 에러, 클라이언트 구현 지침이 대상이다. 이 문서는 전송 계층(§1)과 공통 결정을 맡고 나머지 절은 하위 문서가 맡는다.

채널의 무게중심은 실행이다. 서버가 실행 진행 상황을 밀어 보내고 클라이언트가 실행 제어 명령을 보내고 노드가 사용자 입력을 기다릴 때 그 왕복을 중개한다. 실행 밖에 지식 저장소 문서 처리 상태와 인앱 알림도 같은 채널 위에 있다. 이벤트는 구독한 리소스에 대해서만 전달되고 구독 채널은 `execution:`·`workflow:`·`kb:`·`notifications:`·`background:run:` 다섯 종이다. 그중 `workflow:` 는 구독 인가만 있고 서버가 이 채널로 보내는 이벤트는 없다. 끊긴 동안 놓친 것은 다시 구독할 때 받는 1회성 실행 스냅샷 이벤트(`execution.snapshot`)로 맞춘다. 이벤트 순번(`seq`) 기반 재전송 버퍼는 native WebSocket 에 없고 SSE 어댑터에 있다.

읽기 전에 두 가지를 알아야 한다.

- **전송 계층은 Socket.IO 다.** 문서의 `{ type, id, payload }` 프레임 표기는 논리적 메시지 형태를 보이는 추상화다. raw WebSocket 프레이밍을 전제한 항목 중 서브프로토콜 인증([§2.2](CLE-API-WS-CONN.md#22-인증))과 close 코드([§8](CLE-API-WS-MSG.md#8-websocket-close-코드-비채택))는 비채택이다. 다만 "raw WebSocket 전제니까 모두 비채택" 으로 뭉치지 않는다. 시스템 이벤트 가운데 `system.maintenance` 발행은 비채택이지만 서버가 보내는 `auth.token_expired` 는 구현됐다. 어느 항목이 어느 갈래인지는 §1 이 정한다.
- **같은 실행을 두 표면이 보고한다.** 내부 WebSocket 과 외부 EIA 의 REST·SSE·EIA 알림 웹훅이다. 명령·이벤트 매핑의 권위와 두 표면의 비대칭 규칙은 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 이 정한다.

이 문서가 정하지 않는 것은 아래 문서가 정한다.

- 서버 이벤트와 클라이언트 명령 목록, 명령별 ack 필드, EIA 매핑: [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md). ack 가 전송에서 어떻게 보이는지는 이 문서 §1 이 정한다
- 실행 상태 전이(실행·노드 실행 상태 머신, 블로킹·재개 계약): [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md)
- 외부 호출자용 표면(REST·SSE·EIA 알림 웹훅): [External Interaction API](../CLE-IX/CLE-EIA.md), [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md)
- 에러 코드 이름 규칙과 카탈로그: [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md). [§7](CLE-API-WS-MSG.md#7-에러-처리) 은 그중 전송 계층의 `WsErrorCode` 가 wire 에서 어떤 프레임으로 보이는지만 다룬다
- 이벤트 페이로드의 자격 증명 마스킹: [응답 자격 증명 마스킹](CLE-API-EGRESS.md)
- HTTP API 규약 쪽 요약: [HTTP API 규약](CLE-API-CONV.md) 의 WebSocket 절

## 하위 문서

절 번호(§2~§9)는 하위 문서에서도 원래 번호를 그대로 쓴다. 본문의 "§n" 은 아래 표로 찾는다. 이 문서에는 요구사항 줄이 없다.

| 문서 | 맡는 절 | 내용 | 요구사항 |
|---|---|---|---|
| [연결 · 인증 · 재연결](CLE-API-WS-CONN.md) | §2 · §5 · §6 · §9 | 엔드포인트, 인증, 토큰 만료 · 갱신, heartbeat, 재연결 · 복구, 클라이언트 지침 | 없음 |
| [메시지 · 구독 · 에러](CLE-API-WS-MSG.md) | §3 · §4 · §7 · §8 | 프레임 · 이벤트 봉투 · `seq`, 채널 · 구독 · 인가 · 한도, 에러 코드 · 형식, close 코드(비채택) | 없음 |

## 1. 전송 계층

채널은 **Socket.IO** 로 구현한다(`@WebSocketGateway({ namespace: '/ws' })`, 클라이언트 `socket.io-client`).

- 메시지는 Socket.IO 의 이벤트 모델을 따른다. 클라이언트는 `socket.emit('<event>', data)` 로 보낸다.
- 명령과 구독의 응답도 Socket.IO 이벤트로 온다. 게이트웨이 핸들러는 `{ event, data }` 를 돌려주고 Nest 어댑터(`@nestjs/platform-socket.io` 의 `IoAdapter`)는 `event` 필드 값을 이름으로 하는 Socket.IO 이벤트로 `data` 만 보낸다. `{ event, data }` 형태는 wire 에 없다. 클라이언트는 그 이벤트 이름을 `socket.on` 으로 구독해 받는다([§4.3](CLE-API-WS-MSG.md#43-구독과-구독-해제), [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md)). 이 문서에서 ack 는 핸들러가 돌려준 `{ event, data }` 가 나가는 명령 응답 이벤트(ack 이벤트. `subscribed`, `<명령>.ack` 등)를 가리키며 Socket.IO ack callback 이 아니다.
- ack 이벤트는 Socket.IO ack callback 으로 오지 않는다. 어댑터는 핸들러 반환값에 `event` 가 없을 때만 클라이언트가 넘긴 callback 을 부른다. 지금 핸들러는 모두 `event` 를 돌려주므로 `socket.emit('<event>', data, callback)` 의 callback 은 불리지 않는다. 같은 이유로 클라이언트는 Socket.IO 내장 `Socket#emitWithAck` 를 쓰지 않는다. 내장은 ack callback 을 기다리므로 응답을 받지 못한다.
- `{ type, id, payload }` JSON 프레임 표기는 논리 구조의 추상화다. 실제 wire 는 Socket.IO 가 감싼다. raw WebSocket 프레임, `Sec-WebSocket-Protocol` 서브프로토콜, raw close code 를 직접 다루지 않는다.
- **HTTP 전용 전역 enhancer(전역 가드 · 파이프 · 인터셉터)는 WebSocket 핸들러에서 동작하지 않는다.** NestJS 12 부터 전역 `APP_GUARD`·`APP_PIPE`·`APP_INTERCEPTOR` 가 게이트웨이 핸들러에도 붙는다. 전역 예외 필터는 붙지 않는다.
  - HTTP 요청을 전제한 `LoggingInterceptor`·`TransformInterceptor`·`UserThrottlerGuard` 는 HTTP 요청이 아닌 호출(NestJS `ExecutionContext.getType()` 이 `'http'` 가 아닌 호출. 판정은 `isHttpContext`)을 건너뛴다. 세 enhancer 가 같은 판정 함수(`common/utils/http-context.ts`)를 쓴다. 그래서 전역 요청 빈도 제한은 WebSocket 메시지를 세지 않는다([HTTP API 규약 「요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한)).
  - `CustomValidationPipe` 는 커스텀 데코레이터 인자(`@ConnectedSocket()` 소켓)를 검증하지 않는다. 이 제외(`ArgumentMetadata.type === 'custom'`)는 HTTP 의 커스텀 파라미터 데코레이터에도 걸리는 전역 동작이다(NestJS 기본 `ValidationPipe` 의 `validateCustomDecorators: false` 와 같다). 파이프는 NestJS `ExecutionContext` 를 받지 못해서 `isHttpContext` 대신 인자 종류로 가른다. `@MessageBody()` 는 DTO 클래스 타입이면 검증한다. 지금 게이트웨이 핸들러의 `@MessageBody()` 는 모두 인라인 객체 타입이라 검증 대상이 아니다. DTO 클래스를 쓰는 `@MessageBody()` 의 검증 실패 wire 는 [미결 사항](#미결-사항) 에 있다.
  - `JwtAuthGuard` 는 게이트웨이의 `@Public()` 으로 통과한다. WebSocket 인증은 `handleConnection` 의 JWT 검증이 맡는다([§2.2](CLE-API-WS-CONN.md#22-인증)).
  - `RolesGuard` 는 `@Public()` 을 보지 않는다. 소켓은 핸드셰이크에서 검증한 사용자 ID 를 소켓 속성 `userId` 에 두고 `request.user` 는 채우지 않는다. 그래서 소켓 요청은 `request.user` 가 없어 `!userId` 분기로 통과한다. 이 분기는 `@Roles()` 가 없는 핸들러만 통과시킨다. 그래서 게이트웨이 핸들러에 `@Roles()` 를 붙이면 모든 요청이 거부된다. 구독 채널 접근 인가는 `handleConnection` 과 구독 채널 인가기(`channelAuthorizers`, [§4.4](CLE-API-WS-MSG.md#44-구독-인가))가 맡는다. 이 동작은 [워크스페이스와 멤버 「멤버십 검증은 가드가 무조건 한다」](../CLE-ACCT/CLE-ACCT-WS.md#멤버십-검증은-가드가-무조건-한다) 의 제외 대상 (a) 가운데 `request.user` 가 없는 미인증 요청의 경우에 준한다. 소켓은 인증된 연결이지만 가드가 보는 자리에 사용자가 없다. 인증 판정은 `handleConnection` 이 맡고 멤버십은 토큰 클레임을 그대로 쓴다([§2.2](CLE-API-WS-CONN.md#22-인증)).
  - 새 전역 enhancer 는 저장소 가드 `global-enhancer-ws-safety.spec.ts` 에 WebSocket 처리 방식을 분류해야 등록할 수 있다. 분류 없이 들어오면 그 가드가 실패한다. 경위는 [「ack 이벤트 wire 와 HTTP 전용 전역 enhancer 를 바로잡은 경위 (2026-10-22)」](#ack-이벤트-wire-와-http-전용-전역-enhancer-를-바로잡은-경위-2026-10-22) 에 있다.

raw WebSocket 을 전제했던 초안 항목은 다음 갈래로 처분했다.

| 갈래 | 항목 | 상태 | 근거 |
|---|---|---|---|
| raw WebSocket 전제 (전송 계층에 구조적으로 맞지 않음) | 서브프로토콜 인증([§2.2](CLE-API-WS-CONN.md#22-인증)), raw close 코드([§8](CLE-API-WS-MSG.md#8-websocket-close-코드-비채택)) | **비채택** | Rationale "raw WebSocket 전제·REST 대체 항목 비채택" |
| REST 로 충분 (중복 경로 회피) | in-band 토큰 갱신([§2.3](CLE-API-WS-CONN.md#23-토큰-갱신-연결-유지)), WebSocket 실행 시작·중단 명령 | **비채택** | 같은 Rationale |
| 발화 주체 없음 또는 전송 계층이 이미 채움 | 서버 발신 app ping([§5.2](CLE-API-WS-CONN.md#52-애플리케이션-수준-ping)), `system.maintenance` 발행 | **비채택** | [Rationale 「`system.maintenance` 발행과 서버 발신 app ping 비채택」](CLE-API-WS-CONN.md#systemmaintenance-발행과-서버-발신-app-ping-비채택-2026-09-02) |
| 실재하는 인가 틈 | 서버 발신 `auth.token_expired` 발행 | **구현됨** (2026-09-02) | [Rationale 「소켓 수명을 토큰 수명에 묶는다」](CLE-API-WS-CONN.md#소켓-수명을-토큰-수명에-묶는다-2026-09-02) |

이 갈래에 남은 미구현은 없다.


## 하위 문서로 옮긴 절

다른 문서가 링크하는 앵커를 받으려고 제목만 남긴 자리다. 절 본문은 각 줄의 링크가 가리키는 하위 문서에 있고 이 문서에는 없다.

### 3.1 기본 프레임 (논리 구조)

→ [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러](CLE-API-WS-MSG.md#31-기본-프레임-논리-구조)

### 6.2 놓친 이벤트 복구

→ [WebSocket 연결과 채널 구독 — 연결 · 인증 · 재연결](CLE-API-WS-CONN.md#62-놓친-이벤트-복구)

### 7. 에러 처리

→ [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러](CLE-API-WS-MSG.md#7-에러-처리)

### 7.1 에러 코드

→ [WebSocket 연결과 채널 구독 — 메시지 · 구독 · 에러](CLE-API-WS-MSG.md#71-에러-코드)

### 소켓 수명을 토큰 수명에 묶는다 (2026-09-02)

→ [WebSocket 연결과 채널 구독 — 연결 · 인증 · 재연결](CLE-API-WS-CONN.md#소켓-수명을-토큰-수명에-묶는다-2026-09-02)

## 미결 사항

- **구독 인가 실패 코드 `FORBIDDEN` 과 IDOR 차단 `NOT_FOUND` 관례**: [§4.4](CLE-API-WS-MSG.md#44-구독-인가) 는 구독 인가 실패(IDOR 차단 목적)에 `FORBIDDEN` 을 돌려준다고 적는다. [§7.1](CLE-API-WS-MSG.md#71-에러-코드) 은 IDOR 차단 핸들러가 존재 추론을 막으려 일부러 `NOT_FOUND` 를 쓴다고 적는다. 구독 경로만 예외인지, 그렇다면 왜 존재 추론 방지를 적용하지 않는지 문서에 이유가 없다. 구독 경로를 `NOT_FOUND` 로 맞출지, 예외로 두고 이유를 적을지 결정이 필요하다. 결정이 나면 [WebSocket 이벤트와 명령 「마지막 턴 재시도」](CLE-API-WS-EVENTS.md#24-마지막-턴-재시도-executionretry_last_turn) 의 §2.4 코드 표와 [에러 코드 규약과 카탈로그 「WebSocket 전송」](CLE-API-ERRCODES.md#68-websocket-전송-도메인-문서-참조) 의 §6.8 도 함께 고친다.
- **소켓의 멤버십 재검증**: 워크스페이스에서 제거된 멤버의 소켓은 액세스 토큰 `exp`(최대 15분)까지 그 워크스페이스의 구독 채널을 구독하고 이벤트를 받는다. HTTP 는 요청마다 멤버십을 다시 읽는다. 이것은 관측된 현재 동작이고 사람이 승인한 수용이 아니다. 즉시 재검증을 둘지는 사람이 정한다(후속 NERV Task `CLE-T-KYPH36`). 경위는 [「소켓 수명을 토큰 수명에 묶는다 (2026-09-02)」](CLE-API-WS-CONN.md#소켓-수명을-토큰-수명에-묶는다-2026-09-02) 의 「닫지 않는 것」에 있다.
- **DTO 클래스 `@MessageBody()` 의 검증 실패 wire**: 지금 게이트웨이 핸들러의 `@MessageBody()` 는 모두 인라인 객체 타입이라 `CustomValidationPipe` 가 검증하지 않는다(§1). 검증 실패가 wire 에서 어떻게 보이는지는 아직 정하지 않았다. 게이트웨이에 DTO 클래스 타입의 `@MessageBody()` 를 처음 들일 때 이 wire 와 `INVALID_MESSAGE` 와의 매핑을 먼저 정한다.


## 구현 위치

각 하위 문서가 자기 범위의 구현 위치를 적는다. 여기에는 전송 계층(§1)의 것만 둔다.

- `codebase/backend/src/common/utils/http-context.ts` (`isHttpContext`. HTTP 전용 전역 enhancer 가 HTTP 가 아닌 호출을 건너뛰는 판정)
- `codebase/backend/src/common/guards/user-throttler.guard.ts` (`UserThrottlerGuard`. HTTP 가 아닌 호출을 건너뛴다)
- `codebase/backend/src/common/interceptors/logging.interceptor.ts` (`LoggingInterceptor`. HTTP 가 아닌 호출을 건너뛴다)
- `codebase/backend/src/common/interceptors/transform.interceptor.ts` (`TransformInterceptor`. HTTP 가 아닌 호출을 건너뛴다)
- `codebase/backend/src/common/pipes/validation.pipe.ts` (`CustomValidationPipe`. 커스텀 데코레이터 인자를 검증하지 않는다)
- `codebase/backend/src/repo-guards/__tests__/global-enhancer-ws-safety.spec.ts` (전역 enhancer 의 WebSocket 처리 분류 가드)

## Rationale

### 전송 계층을 Socket.IO 로 바로잡은 경위 (2026-06-03)

초안은 native·raw WebSocket 프로토콜을 전제로 `{ type, id, payload }` 프레임, `Sec-WebSocket-Protocol` 서브프로토콜 인증, `auth.refresh`·`auth.refreshed` in-band 갱신, `execution.start`·`execution.stop` WebSocket 명령, 서버 발신 30s/10s app ping, raw close code(1000·1001·1008·4000·4001), `{type:'error',code}` 프레임을 약속했다. 그러나 구현(`websocket.gateway.ts`, `websocket.service.ts`, 프론트엔드 `ws-client.ts`)은 Socket.IO(namespace `/ws`) 기반이고 위 표면 다수가 없거나 형태가 달랐다.

- **구현에 맞춰 바로잡은 사실**: 전송(Socket.IO), 인증 위치(`handshake.query.token || handshake.auth.token`, 서브프로토콜 경로 없음), 구독 ack `{ event:'subscribed', data:{ success, channel?, error? } }`(2026-10-22 정정: ack callback 이 아니라 `subscribed` ack 이벤트로 `data` 만 간다. 아래 절), 스냅샷 페이로드 `{ executionId, execution, timestamp }`, app ping 방향(클라이언트 → 서버), heartbeat · 재연결(Socket.IO 내장), 토큰 갱신(REST refresh 와 재연결), 서버 이벤트 wire(`{ executionId, ...payload, seq, timestamp }` 평면, 이벤트 이름 분리). 각 값은 본문 해당 절에 있다.
- **미구현으로 나눴던 약속의 처분**: 2026-07-07 에 WebSocket 에러 처리 강화(전용 에러 코드 넷 `INVALID_MESSAGE`·`UNKNOWN_TYPE`·`SUBSCRIPTION_LIMIT_EXCEEDED`·`RATE_LIMITED`, 소켓당 분당 60건 빈도 제한)를 구현했다. 구독 ack 는 평문 `error` 에 구조화 `code` 를 더했고 빈도 제한은 `WsRateLimitGuard`(클래스 수준, 메모리, 소켓별), 등록되지 않은 이벤트는 `onAny` → `error{code}` 다. `notification.new` 발행도 이후 구현됐다. 나머지는 §1 의 갈래 표대로 비채택하거나(2026-07-08, 2026-09-02) 구현했다(`auth.token_expired`, 2026-09-02). 남은 항목은 없다.
- 재개·재시도 코드(`INVALID_EXECUTION_STATE`, `RESUME_*`, `RETRY_*`)는 처음부터 코드와 맞았다.

### ack 이벤트 wire 와 HTTP 전용 전역 enhancer 를 바로잡은 경위 (2026-10-22)

실행 패널이 비는 장애를 고치면서(NERV Task `CLE-T-A3W8B8`) 두 가지를 바로잡았다. 하나는 문서가 적은 ack 이벤트 wire 이고 다른 하나는 NestJS 12 가 게이트웨이에 붙인 전역 enhancer 다. 짝 문서 [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) 의 ack 서술도 같은 Task 에서 함께 고쳤다.

**ack 이벤트 wire 정정**

- 2026-06-03 정정부터 이 문서는 명령과 구독의 응답을 «Socket.IO ack callback 의 `{ event, data }`» 로 적었다. 코드는 그렇게 동작하지 않는다.
- `@nestjs/platform-socket.io` 12.1.2 의 `IoAdapter.bindMessageHandlers` 는 핸들러 반환값에 `event` 가 있으면 `socket.emit(response.event, response.data)` 를 부른다. `event` 필드 값을 이름으로 하는 Socket.IO 이벤트로 `data` 만 보내는 것이다. 이때 ack callback 은 부르지 않는다. 반환값에 `event` 가 없고 클라이언트가 callback 을 넘긴 경우에만 `ack(response)` 를 부른다.
- 게이트웨이 핸들러는 모두 `{ event, data }` 를 돌려준다. 그래서 wire 는 ack 이벤트 이름(`event` 값)과 payload `data` 이고 `{ event, data }` 형태는 wire 에 없다.
- 프론트엔드는 이 wire 로 받아 왔다. 구독 결과는 `subscribed` 이벤트 구독으로 받는다. 재개 명령은 프론트엔드 로컬 헬퍼 `emitWithAck`(`use-execution-interaction-commands.ts`)가 ack 이벤트 이름(`execution.click_button.ack` 등)을 한 번 기다린다. 이 헬퍼는 Socket.IO 내장 `Socket#emitWithAck` 와 다르다(§1). e2e `ws-execution-subscribe.e2e-spec.ts` 는 callback 없이 `subscribe` 를 보내고 `subscribed` 이벤트 payload 가 `{ success: true, channel }` 임을 단언한다.
- 문서를 믿고 구현할 클라이언트가 callback 을 넘겨 기다리면 응답을 받지 못한다. 그래서 문서를 코드에 맞췄다. 이벤트 이름과 payload 필드는 그대로라 지금 클라이언트에는 영향이 없다.
- [§7.2](CLE-API-WS-MSG.md#72-에러-메시지-형식) 에서 `error` 이벤트 `{ message }` 를 쓰는 경우를 연결 핸드셰이크 에러로 좁혔다. 연결된 소켓도 등록되지 않은 이벤트를 보내면 `error` 이벤트로 `{ code: 'UNKNOWN_TYPE', message }` 를 받는다([§7.1](CLE-API-WS-MSG.md#71-에러-코드)). 범위를 좁히지 않으면 §7.2 가 §7.1 과 어긋난다.
- **기각한 대안**
  - 핸들러가 `event` 없이 `data` 만 돌려 ack callback 으로 맞추기: 프론트엔드(`ws.on('subscribed')` 와 로컬 헬퍼 `emitWithAck`)와 새 e2e 가 이미 이벤트 wire 에 기대고 있어 호환만 깨진다. 이미 굳은 wire 이름을 바꾸지 않은 판단은 [WebSocket 이벤트와 명령 「`submit_form`·`click_button` payload 와 ack 를 구현에 맞춘 이유 (2026-06-10)」](CLE-API-WS-EVENTS.md#submit_formclick_button-payload-와-ack-를-구현에-맞춘-이유-2026-06-10) 의 폼 제출 ack 이름에도 있다.
  - callback 과 이벤트를 함께 보내기(이번 Task 에서 검토만 한 안): 택하지 않은 이유는 지금 callback 을 기다리는 소비자가 없고 응답이 두 번 나가는 표면만 늘기 때문이다.

**NestJS 12 전역 enhancer 장애**

- NestJS 12(`@nestjs/websockets` 12.1.2)부터 전역 `APP_GUARD`·`APP_PIPE`·`APP_INTERCEPTOR` 가 게이트웨이 핸들러에도 붙는다. 끄는 옵션은 없다. 전역 예외 필터는 붙지 않는다. 이 동작은 NestJS 12 상향(NERV Task `CLE-T-3X627J`)과 함께 들어왔다.
- HTTP 요청을 전제한 `LoggingInterceptor` 가 소켓 요청에서 던졌다(소켓에는 `url` 이 없다). 그래서 `subscribe` 가 `exception` 으로 끝났고 구독이 성립하지 않아 실행 패널이 비었다.
- 같은 원인으로 `CustomValidationPipe` 는 `@ConnectedSocket()` 소켓을 검증 대상으로 보고 변환했다. `UserThrottlerGuard` 는 소켓에 `user`·`ip` 가 없어서 모든 사용자의 WebSocket 메시지를 한 버킷(`unknown`)으로 셌다.
- 단위 테스트는 핸들러를 직접 불러 이 파이프라인을 지나지 않았다. 장애는 e2e 에서야 드러났다.

**결정**

- HTTP 전용 전역 enhancer 는 한 술어로 HTTP 가 아닌 호출을 건너뛴다. 술어는 `isHttpContext`(`common/utils/http-context.ts`) 하나이고 `LoggingInterceptor`·`TransformInterceptor`·`UserThrottlerGuard` 가 이 술어를 쓴다. enhancer 마다 `getType()` 비교를 따로 쓰면 어느 것이 WebSocket 을 거르는지 한눈에 보이지 않는다.
- 파이프는 NestJS `ExecutionContext` 를 받지 못해 이 술어를 쓰지 못한다. 그래서 `CustomValidationPipe` 는 인자 종류(`ArgumentMetadata.type === 'custom'`)로 가른다. 검증 범위는 §1 에 있다.
- `JwtAuthGuard` 와 `RolesGuard` 는 고치지 않았다. 두 가드가 소켓 요청을 통과시키는 방식과 `@Roles()` 를 붙이면 모든 요청이 거부되는 이유는 §1 에 있다. 인증 판정은 `handleConnection` 이 맡고 멤버십은 토큰 클레임을 그대로 쓴다.
- `JwtAuthGuard` 를 `@Public()` 으로 우회하는 것은 2026-09-02 결정 [「소켓 수명을 토큰 수명에 묶는다」](CLE-API-WS-CONN.md#소켓-수명을-토큰-수명에-묶는다-2026-09-02) 와 같은 선이다. 그 결정은 명령마다 다시 검증하는 안을 기각했고 만료 집행은 `armExpiryTimers` 하나다.
- 그 절의 실측 «게이트웨이에 인증 가드 0건» 은 NestJS 12 상향 전(2026-09-02) 기준이다. 지금은 전역 `JwtAuthGuard` 가 게이트웨이 핸들러에도 붙지만 `@Public()` 으로 통과한다.
- 저장소 가드 `global-enhancer-ws-safety.spec.ts` 가 이 분류를 고정한다. 전역 enhancer 는 «HTTP 가 아니면 건너뜀»(`skips-non-http`) 이나 «WebSocket 핸들러에서 통과하도록 설계됨»(`ws-safe-by-design`) 중 하나로 분류돼야 한다. 지금은 `JwtAuthGuard`·`RolesGuard` 가 뒤쪽이고 나머지 넷이 앞쪽이다. 분류 없이 새 enhancer 를 등록하면 가드가 실패한다. 분류가 사실인지는 WebSocket 호출 모양으로 enhancer 를 직접 불러 확인한다.
- 그 결과 WebSocket 빈도 제한은 소켓당 `WsRateLimitGuard`(분당 60건) 하나다. 전역 요청 빈도 제한은 WebSocket 메시지를 세지 않는다([§7.1](CLE-API-WS-MSG.md#71-에러-코드)). 이 규칙의 핵심 결정은 [HTTP API 규약 「요청 빈도 제한」](CLE-API-CONV.md#7-요청-빈도-제한) 에 있다.

**기각한 대안 (전역 enhancer)**

- 전역 등록을 컨트롤러 단위로 옮기기(이번 Task 에서 검토만 한 안): 택하지 않은 이유는 새 컨트롤러가 등록을 빠뜨리기 쉽고 바꿀 표면이 크기 때문이다.
- Nest 쪽 옵트아웃: `@nestjs/websockets` 12.1.2 에는 게이트웨이에서 전역 enhancer 를 끄는 옵션이 없다.
- 검증 파이프에서 `instanceof Socket` 으로 소켓을 가려내기: `@nestjs/platform-socket.io` 가 고정한 socket.io 사본과 backend 가 설치한 사본이 다르다. 그래서 런타임 소켓이 `instanceof` 검사에 걸리지 않는다. e2e 에서 확인했다.

### raw WebSocket 전제·REST 대체 항목 비채택 (2026-07-08)

전송 계층을 바로잡은 뒤 미구현으로 나눠 둔 항목 가운데 **넷을 정식 비채택**으로 종결했다. "언젠가 구현할 backlog" 가 아니라 현 아키텍처에서 도입하지 않기로 결정한 항목이다.

- **raw WebSocket 전제(전송 계층에 구조적으로 맞지 않음)**: 전송이 Socket.IO 인 한 애플리케이션에 드러나지 않는 표면이다.
  - `Sec-WebSocket-Protocol: bearer, {token}` 서브프로토콜 인증: Socket.IO 는 서브프로토콜 협상을 앱에 드러내지 않는다. query·auth 두 핸드셰이크 위치가 인증을 마치므로 대체도 필요 없다.
  - raw close code 매핑: Socket.IO 는 close code 를 앱 수준에 드러내지 않는다. 클라이언트는 `disconnect`·`connect_error` 이벤트로 재연결을 판단한다.
  - 전송을 raw WebSocket 으로 바꾸지 않는 한 구현할 대상이 없다. 바꾸는 것은 Socket.IO 의 재연결·멀티플렉싱·폴백 이점을 버리는 큰 결정이라 계획에 없다.
- **REST 로 충분(중복 경로 회피)**: 정식 REST 경로가 같은 기능을 이미 마친다.
  - in-band `auth.refresh`·`auth.refreshed`: 토큰이 만료되면 REST `/api/auth/refresh` 와 Socket.IO 재연결이 세션을 유지한다. in-band 갱신의 이득(짧은 재연결 창 제거)은 별도 WebSocket 인증 프로토콜(핸들러, 발행, 재생 공격 방어, 테스트) 유지 비용에 못 미친다.
  - `execution.start`·`execution.stop`·`execution.start.ack` WebSocket 명령: 실행 시작은 REST `POST /api/workflows/:id/execute`, 중단은 REST `POST /api/executions/:id/stop` 이 정식 경로다. WebSocket 시작·중단은 REST 와 순수하게 중복되는 표면이라 유지 부채만 늘린다(진행 상황은 `execution:{id}` 구독으로 받으므로 시작을 WebSocket 으로 둘 이점이 없다).
- **폐기한 대안**: 넷을 계속 "계획" 으로 두는 안. 전송이 Socket.IO 로 정해진 이상 raw WebSocket 둘은 영구히 도입하지 않고 REST 대체 둘은 의도적으로 도입하지 않으므로 "계획" 표기는 언젠가 구현한다는 잘못된 기대를 남긴다. 명시적 비채택이 정직하다.
- 당시 이 결정은 서버 발신 `auth.token_expired`, `system.maintenance`, app ping 을 범위 밖으로 두었다. "트리거 소스 설계가 필요한 실제 기능 backlog" 로 보았기 때문이다. 이 셋은 뒤의 두 결정으로 처분됐다.
