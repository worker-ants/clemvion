---
id: "CLE-CHAT-DATA-STORE"
title: "채팅 채널 데이터와 흐름 — 저장 모델과 상태"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-DATA"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-DATA"]
area: "CLE-CHAT"
content_hash: "6335cf59dee1bb7514fb8e17405859b00f7ad3e5ae7bba78a1c56cf9e045e8c5"
read_as: "approved_fallback"
task: "CLE-T-CC3GPN"
source_paths: []
mirror_sha256: "ef88bc4ffa9fa2bcbee21baff633133994664565416f2bdb5a728649cec1f18c"
etag: "sha256-b5bf374f2d69ee8f60603ed19c3b32bcc6850f87f0d1c37f6a977f9829ec9fff"
---
## 개요

이 문서는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 의 하위 문서로 채팅 채널의 영속 데이터(`trigger` 의 `chat_channel_*` 컬럼)와 Redis 데이터(채널 대화 상태 · 키 · pub/sub 채널), 채널 대화 상태와 채널 건강도의 상태 전이를 정한다.

## 트리거 컬럼

`trigger` 테이블에 다음 컬럼 5개가 있다. 엔티티 전체는 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 을 보고, 채팅 채널 컬럼의 정의는 그 문서가 이 절로 위임한다.

```sql
ALTER TABLE trigger
  ADD COLUMN chat_channel_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',  -- 'unknown'|'healthy'|'degraded'
  ADD COLUMN chat_channel_last_error TEXT NULL,
  ADD COLUMN chat_channel_setup_at   TIMESTAMPTZ NULL,
  ADD COLUMN chat_channel_token_v2   TEXT NULL,   -- 24시간 유예 동안 옛 봇 토큰을 백업한 시크릿 참조(secret://triggers/{id}/bot-token.v2). 토큰이 아니라 참조만 둔다. primary 로 올리는 단계는 없다(채팅 채널 「신뢰성과 보안」)
  ADD COLUMN chat_channel_rotated_at TIMESTAMPTZ NULL;

ALTER TABLE trigger
  ADD CONSTRAINT chk_trigger_chat_channel_health
  CHECK (chat_channel_health IN ('unknown', 'healthy', 'degraded'));
```

- `chat_channel_health` 는 `VARCHAR(16)` 이고 CHECK 제약 `chk_trigger_chat_channel_health` 가 `unknown`/`healthy`/`degraded` 세 값만 받는다(마이그레이션 V062). EIA 알림 웹훅의 `notification_health` 도 같은 세 값을 같은 방식으로 막는다(`VARCHAR(16)` 과 CHECK 제약 `chk_trigger_notification_health`, 마이그레이션 V059). 두 컬럼이 함께 쓰는 DB 타입은 없다. 두 제약은 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 의 제약 목록에도 있다.
- `chat_channel_token_v2` 는 24시간 뒤 `ChatChannelTokenRotatorService` 가 참조와 시크릿 저장소 행을 함께 정리한다. 이름 패턴은 `notification_secret_v2` 와 같다. 근거는 [Rationale](CLE-CHAT-DATA-TOKEN.md#rationale) 의 「R-K chat_channel_token_v2 이름을 notification_secret_v2 와 같은 패턴으로 둔다」 에 있다.

컬럼과 설정 JSON 의 읽기·쓰기는 다음과 같다.

| 저장소 | 흐름 | 읽기·쓰기 |
|---|---|---|
| `trigger` | setup·설정 | `config.chatChannel` JSON(`provider`, `botTokenRef`, `inboundSigningRef`, `botIdentity`, `uiMapping`, `rateLimitPerMinute`, `languageLocale`, `languageHints`). 평문 비밀 필드는 저장 전에 지운다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 규칙 14) |
| `trigger` | setup 완료 | UPDATE `chat_channel_setup_at` |
| `trigger` | 채널 건강도 | UPDATE `chat_channel_health`(`healthy`/`degraded`), `chat_channel_last_error`(1024자에서 자른다. 봇 토큰은 프로바이더 API 클라이언트가 먼저 지운다) |
| `trigger` | 봇 토큰 재발급 | UPDATE `chat_channel_token_v2`(v2 시크릿 참조 문자열, 토큰 아님), `chat_channel_rotated_at`. 정리 때 둘 다 NULL |
| `trigger` | 인바운드로 새 실행 시작 | UPDATE `last_triggered_at` |
| `secret_store` | setup·재발급·정리 | `secret://triggers/{id}/bot-token`(primary), `.../bot-token.v2`(유예 슬롯), `.../inbound-signing`(서명 검증 자료) |
| `execution` | 새 대화 | INSERT. 입력에 `chatChannel:{provider, conversationKey, channelUserKey}` 를 찍는다([실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md)) |

## 채널 대화 상태

채널 대화 상태는 "이 채팅방이 지금 어느 실행에 이어져 있는가" 를 담는 Redis 값이다. 대화 스레드([대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 의 `ConversationThread`)와 다르다. `ChannelConversation` 은 이 값의 개념 이름이다. 코드의 타입은 `ChannelConversationState`(`chat-channel/types.ts`)이고 읽고 쓰는 서비스는 `ChannelConversationService` 다.

```text
key:    chat-channel:{triggerId}:{conversationKey}
value:  {
  executionId:      string | null,   // 활성 실행. 종결되면 null
  threadId:         string,          // 대화 스레드 id(1차 범위에서는 "default")
  channelUserKey:   string,          // 채널 사용자 키(Telegram: user_id)
  startedAt:        ISO8601,
  lastUpdateAt:     ISO8601,
  formState?:       object,          // 다단계 질문 진행 상태
  pendingFormModal?: object          // 네이티브 모달 입력 대기 상태(fields 등)
}
TTL: 7일(저장할 때마다 다시 건다)
```

- 대화 키(`conversationKey`)는 프로바이더마다 다르다. Telegram 은 `chat_id`, Slack 은 DM 채널 ID(`channel_id`, 1:1 DM 이라 `thread_ts` 는 쓰지 않는다, [Slack 어댑터](CLE-CHAT-SLACK.md)), 후보인 Kakao 는 `user_id` 다.
- 같은 `triggerId + conversationKey` 의 다음 메시지는 활성 실행이 있으면 전달하고 없으면 새 실행을 시작한다. `/start` 는 예외로 활성 실행이 있어도 그 실행을 취소하고 새 실행을 시작한다([채팅 채널](CLE-CHAT-CORE.md)).
- 키는 콜론으로 나눈 계층형이라 다른 모듈 접두와 겹치지 않는다.
- TTL 은 저장할 때만 다시 건다. 새 실행 시작, Form 입력 대기 이벤트의 갱신, 네이티브 모달 제출 처리, 다단계 질문 단계 처리, `executionId` 정리가 저장한다. 활성 실행에 입력을 전달(`interact`)하기만 할 때는 저장하지 않는다. 만료 뒤 남는 입력 대기 실행은 [Rationale](#rationale) 의 「채널 대화 상태를 Redis 에만 둔다」 에 적었다.
- `channelUserKey` 는 이 Redis 값에만 둔다. `ConversationThread` 에는 필드를 더하지 않는다. 여러 사용자 대화는 후속 범위에서 다시 논의한다.
- `formState` 와 `pendingFormModal` 은 서로 배타적이다([상태 전이](#상태-전이)).

## Redis 키

| key·큐 | 쓰는 쪽 | 읽는 쪽 | 내용 |
|---|---|---|---|
| `chat-channel:{triggerId}:{conversationKey}` | `HooksService`(저장, `/cancel` 의 `executionId` 정리), `ChatChannelDispatcher`(그 실행을 가리킬 때만 `pendingFormModal`·`formState` 갱신, 종결 이벤트의 `executionId` 정리) | 양쪽 조회 | 채널 대화 상태 JSON. TTL 7일(저장마다 갱신). Redis 가 없으면 기능을 낮춘다. `executionId` 를 비우는 쓰기는 compare-and-set 이다([아웃바운드 흐름](CLE-CHAT-DATA-FLOW.md#아웃바운드-흐름)) |
| `chat-channel-lock:{triggerId}:{conversationKey}:formsubmit` | `form_submission` 처리(`SET NX EX 30`) | 같다 | 네이티브 모달 중복 제출 방지 잠금. Lua 로 소유권을 확인하고 푼다. Redis 가 없으면 통과 |
| `cc:dedup:{triggerId}:{idempotencyKey}` | `HooksService.handleChatChannelWebhook`(`SET NX EX 30`), `/start` 의 기존 실행 취소 실패 때 `ChatChannelDedupService.release`(`DEL`) | 같다(반환값이 곧 판정) | 인바운드 중복 제거([채팅 채널 「신뢰성과 보안」](CLE-CHAT-CORE.md#신뢰성과-보안)). `parseUpdate` 직후이자 분당 한도 앞이다. 재도착은 같은 트래픽이라 한도를 쓰지 않는다. TTL 30초. Redis 가 없으면 통과하고 warn. `/start` 의 기존 실행 취소가 실패해 에러로 응답할 때는 그 키를 지워 프로바이더의 재전송을 받는다. 지우지 못하면 warn 을 남기고 TTL 로 풀린다. `/cancel` 의 취소나 재개 명령을 재개 큐에 넣지 못했을 때는 `202` 로 답하므로 키를 지우지 않는다([Rationale](CLE-CHAT-DATA-FLOW.md#rationale) 의 「`/cancel` 과 재개 명령의 큐 적재 실패에서 중복 제거 키를 지우지 않는다 (2026-10-17)」) |
| `cc:rl:{triggerId}:{conversationKey}` | `ChatChannelRateLimiterService.consume`(`INCR`+`EXPIRE NX` 를 한 pipeline 으로) | 같다 | 대화 단위 분당 한도([채팅 채널 「비기능」](CLE-CHAT-CORE.md#비기능)). TTL 60초(fixed-window). 넘치면 건너뛰고 `degraded`. Redis 가 없으면 통과 |
| `cc:sigfail:{triggerId}:{clientIp}` | `ChatChannelSignatureFailureLimiterService.recordFailure`(Lua 스크립트 하나로 `INCR` 과 TTL 확인을 함께 한다). `ChatChannelInboundAuthenticator.verify` 가 서명 검증이 `UnauthorizedException`(401)으로 실패했을 때만 부른다 | `ChatChannelSignatureFailureLimiterService.isBlocked`(`GET`). 같은 `ChatChannelInboundAuthenticator.verify` 가 서명 검증 앞에서 부른다 | 인바운드 서명 검증 실패 한도([채팅 채널 「서명 검증 실패 한도」](CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도), NERV Task `CLE-T-ZC34Y0`). (트리거, 클라이언트 IP) 쌍마다 센다. 첫 실패이거나 TTL 이 없는 키면 60초 TTL 을 건다. 이미 TTL 이 있으면 늘리지 않는다(fixed-window). 값이 20 이상이면 창이 끝날 때까지 그 쌍의 요청에 시크릿 조회와 서명 계산 없이 `401`(`AUTH_FAILED`)로 답한다. 한도에 닿으면 창마다 warn 로그를 한 번 남긴다. 이 로그에는 트리거 id 만 싣고 IP 는 싣지 않는다. 막힌 요청은 세지 않으므로 창이 늘어나지 않는다. 서명이 맞는 요청과 401 이 아닌 오류도 세지 않는다. 클라이언트 IP 는 `extractUnspoofableClientIp` 로 `CF-Connecting-IP`(신뢰 설정일 때), `req.ip` 순서로 읽는다. `X-Forwarded-For` 첫 값은 쓰지 않는다. IP 를 읽지 못하면 세지도 막지도 않는다. Redis 가 없거나 오류면 막지 않는다(fail-open). 오류는 warn 로그로 남긴다 |
| `chat-channel-token-rotator`(BullMQ) | repeatable job scheduler(`0 * * * *`) | `ChatChannelTokenRotatorService` | payload 없음. 매시간 정리 |

| pub/sub 채널 | 보내는 쪽 | 받는 쪽 | 내용 |
|---|---|---|---|
| `chat-channel:listener` | `ChannelListenerRegistry` 의 `register`·`unregister`. 자기 레지스트리에 반영한 뒤 `ChannelListenerBus.publish` 가 공유 연결로 보낸다 | 다른 서버 인스턴스의 `ChannelListenerBus`(전용 복제 연결로 구독) | 트리거 단위 listener 레지스트리의 변경 한 건. JSON `{ v: 1, origin, op, triggerId, provider }` 이고 `op` 는 `register` 나 `unregister` 다. `provider` 는 `register` 에만 있다. `origin` 은 보낸 프로세스의 id 이고(HTTP `Origin` 헤더와 무관하다) 받는 쪽이 자기 메시지를 건너뛰는 데 쓴다. 형식이 맞지 않거나 `v` 를 모르면 버린다. 메시지를 저장하지 않는다(TTL 없음). 등록은 그 등록을 낳은 행 쓰기가 커밋된 뒤에 보낸다. 생성 · `chatChannel` PATCH 는 `setupChannel()` 결과의 잠금 안 재기록, 켜는 PATCH 는 그 PATCH 의 쓰기다. 해제는 행을 지우기 전의 외부 해제 단계에서 보낸다. 구독이 확립될 때마다 구독 응답 뒤에 활성 트리거를 DB 에서 다시 일괄 등록해 끊긴 사이 놓친 등록을 메운다. 실패 정책과 전파 규칙은 [채팅 채널](CLE-CHAT-CORE.md) 이 정한다 |

pub/sub 채널 이름은 키 공간과 따로라 같은 접두의 `chat-channel:{triggerId}:{conversationKey}` 키와 겹치지 않는다.

위 다섯 Redis 키와 pub/sub 채널의 용도·TTL·실패 정책은 이 두 표가 기준이다. 키 모양 규칙은 [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md), 전역 목록은 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 가진다. 새 키나 pub/sub 채널을 만들면 양쪽을 함께 고친다.

## 상태 전이

### 채널 대화 상태 전이

| 전이 | 계기 |
|---|---|
| 없음 → 활성 | 새 대화에서 `execute()` 직후 저장(`executionId` 설정) |
| `executionId` → 새 실행 | 활성 실행이 있는 대화의 `/start` 가 기존 실행을 취소하고 새 실행을 시작한 직후 다시 저장 |
| `executionId` → null | 종결 이벤트(completed·failed·cancelled)가 오면 dispatcher 가, `/cancel` 을 처리하면 `HooksService` 가 비운다. 둘 다 `executionId` 가 그 실행을 가리킬 때만 비운다(compare-and-set). `/cancel` 의 취소를 재개 큐에 넣지 못하면 실행이 그대로라 비우지 않는다 |
| `formState` ↔ `pendingFormModal` | 서로 배타적이다. Form 입력 대기 이벤트가 오고 조회한 채널 대화 상태가 그 이벤트의 실행을 가리킬 때만 바꾼다. 렌더 결과가 `form_modal` 이면 `pendingFormModal` 을 저장하고 `formState` 를 지운다. 다단계 질문(`form_prompt`)이면 `formState` 를 초기화하고 `pendingFormModal` 을 지운다 |
| 소멸 | 마지막 저장에서 7일이 지나 TTL 이 만료된다. `ChannelConversationService.clear` 도 키를 지우지만 지금 코드에서 부르는 곳이 없다 |

상태가 남아 있는 동안 같은 `conversationKey` 의 다음 update 는 같은 실행의 재개(서버 안 `interact`)로 흐르고, 만료되거나 실행이 끝나면 새 실행이 시작된다. 키가 만료돼도 그 키가 가리키던 입력 대기 실행은 끝나지 않는다([Rationale](#rationale) 의 「채널 대화 상태를 Redis 에만 둔다」). `/start` 는 예외로 기존 실행을 취소하고 새 실행으로 바꾼다. 멀티턴 대화의 park·재개를 잇는 고리다. 실행 쪽 대기·재개 모델은 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 을 본다.

### 채널 건강도

| 상태 | 전이 |
|---|---|
| `unknown` | 컬럼 기본값. 아직 setup·발송 결과가 없다 |
| `healthy` | setup·재발급 성공 때, 또는 아웃바운드 첫 성공 때 올린다(`chat_channel_last_error=null`). 인바운드 처리가 성공해도 올리지 않는다 |
| `degraded` | 원인은 [채팅 채널 「채널 건강도」](CLE-CHAT-CORE.md#채널-건강도) 가 정한다. 인바운드에서 생기는 원인(분당 한도 초과, 워크플로우 없음, `/cancel` 과 재개 명령의 큐 적재 실패)은 이미 `degraded` 면 다시 쓰지 않는다. 그래서 `chat_channel_last_error` 에는 먼저 `degraded` 가 된 원인의 문구가 남는다. 트리거를 자동으로 끄지 않는다([채팅 채널 「신뢰성과 보안」](CLE-CHAT-CORE.md#신뢰성과-보안)). 다음 성공 때 다시 `healthy` |

## 구현 위치

- `codebase/backend/src/modules/chat-channel/channel-conversation.service.ts`: Redis 채널 대화 상태 CRUD, `executionId` 의 compare-and-set 정리(`clearExecutionIdIfMatches`), Form 제출 잠금
- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts`: 인바운드 중복 제거 선점(`claim`)과 해제(`release`)
- `codebase/backend/src/modules/chat-channel/chat-channel-signature-failure-limiter.service.ts`: 서명 검증 실패 한도(`cc:sigfail:` 키의 판정 `isBlocked` 와 기록 `recordFailure`). 기록은 Lua 스크립트 `RECORD_SIGNATURE_FAILURE_LUA` 로 한다. 부르는 쪽은 `chat-channel-inbound-authenticator.ts` 의 `verify` 다

## Rationale

### 채널 대화 상태를 Redis 에만 둔다

채널 대화 상태는 "지금 이 채팅방이 어느 실행에 이어져 있는가" 라는 휘발성 라우팅 정보다. Redis 를 쓸 수 없어도 워크플로우 실행 자체는 막지 않는다. update 마다 새 실행으로 넘어가는 것이 의도한 기능 저하다. 영속이 필요한 것은 채팅 채널 설정, 토큰 참조, 건강도뿐이라 `trigger` 컬럼으로 충분하다.

TTL 7일이 지나면 사용자가 떠난 대화의 라우팅 값이 지워진다. 지워지는 것은 이 값뿐이다. 그 값이 가리키던 입력 대기 실행은 그대로 남는다. 실행 엔진은 입력 대기 실행을 기한 없이 보존한다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)). 키가 만료된 뒤 같은 대화의 다음 메시지는 새 실행을 시작한다. 옛 실행으로 다시 이어지는 경로는 없다. 웹채팅 위젯 유휴 실행 회수도 토큰 행이 없는 채팅 채널 실행을 대상에서 뺀다([External Interaction API 「공개 위젯의 방치된 입력 대기 회수」](../CLE-IX/CLE-EIA.md#공개-위젯의-방치된-입력-대기-회수)). 그래서 지금은 그 실행을 끝내는 경로가 없다.

지워지는 것은 라우팅 값뿐이고 입력 대기 실행을 회수하는 경로가 없으므로 7일 TTL 을 이탈한 대화의 정리 정책으로 보지 않는다. 7일이라는 값을 고른 근거는 기록에 없다. [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 는 입력 대기 실행과 재개 체크포인트에 TTL 을 두지 않기로 했다. 이 키에만 TTL 을 둔 이유도 기록에 없다. TTL 은 저장할 때만 다시 걸리므로 대화가 이어지는 중에도 마지막 저장에서 7일이 지나면 키가 사라질 수 있다. 이 문단은 지금 동작만 적는다. 정할 일은 [미결 사항](CLE-CHAT-DATA.md#미결-사항) 에 있다.

### executionId 는 그 실행을 가리킬 때만 비운다

2026-10-10 결정이다(NERV Task `CLE-T-V4WVF2`). `/start` 가 기존 실행을 취소하고 새 실행을 대화에 이으면 옛 실행의 `execution.cancelled` 가 그 뒤에 올 수 있다. 종결 이벤트가 `executionId` 를 무조건 비우면 새 실행의 매핑이 지워지고, 다음 메시지는 입력 대기 실행인 새 실행에 가지 않고 또 다른 실행을 시작한다. 그래서 읽은 값의 `executionId` 가 그 실행일 때만 비운다. 읽은 뒤 다른 요청이 대화를 새 실행에 이었을 수 있으므로 저장된 값이 읽은 문자열과 같을 때만 바꾸고, 다르면 다시 읽는다. JSON 을 Lua 안에서 다시 만들지 않고 문자열 그대로 비교한다. Redis Lua 의 cjson 은 빈 배열을 객체로 바꿔 `pendingFormModal.fields` 같은 값을 망가뜨린다. 결정의 근거는 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다.

Form 입력 대기의 대화 상태 갱신도 같은 이유로 그 실행을 가리킬 때만 한다. 옛 실행의 늦은 Form 입력 대기 이벤트가 `pendingFormModal`·`formState` 를 덮어쓰면 새 실행의 다음 폼 제출이 옛 실행의 노드 id 를 싣고 간다. compare-and-set 이 아니라서 남는 경합은 [채팅 채널 「R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다」](CLE-CHAT-CORE.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 의 미룬 문제에 있다.

### `chat_channel_health` 의 공용 DB 타입 검토 문구를 거둔다 (2026-10-17)

NERV Task `CLE-T-EMB0YG` 의 승인본 동기화다. 이 문서는 `chat_channel_health` 와 `notification_health` 를 공용 DB 타입으로 합치는 것을 나중에 검토한다고 적었다. 두 컬럼은 이미 같은 방식으로 값을 막는다. 둘 다 `VARCHAR(16)` 이고 세 값만 받는 CHECK 제약이 있다(마이그레이션 V059 · V062). 이 저장소의 마이그레이션에서 Postgres enum 타입(`CREATE TYPE`)은 V001 에만 있다. 검토를 맡은 Task 도 없었다. 그래서 검토 문구를 지우고 지금 저장 형태를 [트리거 컬럼](#트리거-컬럼) 에 적었다.

기각한 대안은 공용 enum 타입으로 합치는 것이다. 값을 더할 때 `ALTER TYPE` 이 필요하다. 두 컬럼은 이미 같은 값 집합을 각자의 CHECK 제약으로 막고 있어 합쳐서 막을 수 있는 잘못된 값이 없다.
