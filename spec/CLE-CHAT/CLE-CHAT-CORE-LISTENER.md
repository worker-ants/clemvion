---
id: "CLE-CHAT-CORE-LISTENER"
title: "채팅 채널 — 어댑터 라이프사이클과 listener 레지스트리"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-CORE"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-CORE"]
area: "CLE-CHAT"
content_hash: "f63dece504eb5be625546e2811daa1df0792766c27b0edebbb622d0e82b5fae7"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "1bbb036eebf5b63f1e02e841142d5b2ee61971c7a25abb46c1e0f80f94d82e8d"
etag: "sha256-12305e19f605d232af8689d3e34fdc2c73ee094d8412c1c8f05f2bd49e195f72"
---
## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 의 하위 문서로 채널 어댑터의 라이프사이클(`setupChannel()` · `teardownChannel()` 을 부르는 경로), 트리거 단위 listener 레지스트리(코드 `ChannelListenerRegistry`)와 그 변경을 서버 인스턴스 사이에 알리는 방식, 채널 프로바이더 카탈로그, 호환성을 정한다. 단일 sink 구독은 [처리 흐름과 대화](CLE-CHAT-CORE-FLOW.md#단일-sink-구독) 가 정한다.

## 어댑터 라이프사이클

- **어댑터 선택**: 지원 목록은 [채널 프로바이더 카탈로그](#채널-프로바이더-카탈로그) 가 정한다(1차 범위: `telegram`·`slack`·`discord`).
- **`setupChannel()` 호출 경로**: 부르는 경로와 그때 바뀌는 자격 증명의 기준은 [봇 토큰 변경 단일 경로](CLE-CHAT-CORE-PATCH.md#봇-토큰-변경-단일-경로) 다. `setupChannel()` 은 멱등이라 다시 불러도 된다([R8](#r8-트리거-단위-listener-정책)). Telegram 은 이때 `setWebhook` 을 부른다. 트리거를 켜고 끄는 PATCH 는 외부 등록을 건드리지 않는다. 켤 때는 트리거 단위 listener 레지스트리에만 등록한다([R-CC-29](#r-cc-29-트리거를-켜고-끌-때-외부-채널-등록은-건드리지-않는다)).
- **켤 때의 등록**: 커밋된 PATCH 에 `isActive: true` 가 실렸고 저장된 트리거에 `config.chatChannel.provider` 가 있으면 등록한다. `chatChannel` 이 함께 실렸는지와 그 PATCH 의 `setupChannel()` 이 성공했는지는 보지 않는다. 그래서 채널 설정이 실패해 `degraded` 가 된 트리거도 켰으면 레지스트리에 들어간다. 재시작 때의 일괄 등록도 건강도를 보지 않으므로 같은 규칙이다. 같은 트리거를 다시 등록하면 항목을 덮어쓴다. 저장이 실패하거나 다른 워크스페이스의 트리거라 PATCH 가 거절되면 등록하지 않는다.
- **표시 전용 Presentation 노드 listener**: 이 listener 는 채팅 채널 안에서만 쓰며 EIA 알림 웹훅 이벤트 허용 목록(다섯 가지)은 그대로다. 커밋 뒤 호출([External Interaction API 「트랜잭션과 발송 순서」](../CLE-IX/CLE-EIA.md#트랜잭션과-발송-순서))과 트리거 단위 listener 레지스트리 가드(R8)가 그대로 적용된다. 입력 타입은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 `ChatChannelInternalEvent` 다.

## 레지스트리 변경의 전파

- 등록과 그 변경 메시지는 등록을 낳은 행 쓰기가 커밋된 뒤에 한다. 생성과 `chatChannel` 이 실린 PATCH 에서는 `setupChannel()` 결과를 쓰는 잠금 안 재기록이 커밋된 뒤다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 재기록이 행이 없어 쓰지 못하면 등록하지 않는다. 켜는 PATCH 에서는 그 PATCH 의 쓰기가 커밋된 뒤다.
- 해제와 그 변경 메시지는 행을 지우기 전의 외부 해제 단계에서 `teardownChannel()` 다음에 한다. 해제하는 트리거는 `config.chatChannel` 이 있거나 삭제 요청을 받은 서버 인스턴스의 레지스트리에 항목이 있는 트리거뿐이다.
- 받은 서버 인스턴스는 자기 레지스트리에만 반영하고 다시 알리지 않는다. 변경 메시지에는 보낸 프로세스의 id 가 실려 자기 메시지는 건너뛴다.
- 재시작 때와 다시 연결 뒤의 일괄 등록은 알리지 않는다. 서버 인스턴스마다 스스로 하기 때문이다. 구독을 확립할 때마다 구독 응답을 받은 뒤에 DB 를 한 번은 읽는다. 응답 전에만 읽으면 그 사이에 커밋하고 발행한 등록을 놓친다. 서버가 시작할 때 이 순서를 지키는 방법은 R-CC-30 「놓친 메시지」 에 있다.
- 놓친 해제는 보정하지 않는다. dispatcher 의 현재 순서에서는 레지스트리를 확인한 다음 DB 에서 트리거를 읽으므로 지운 트리거의 항목이 남아도 트리거를 찾지 못해 건너뛴다.
- 발행 · 구독 실패의 로그는 warn 수준이고 구독 연결의 `error` 이벤트만 error 수준으로 남긴다. 발행 · 구독 실패나 2초 안에 발행 응답이 없어도 트리거 요청을 실패시키지 않는다.
- 메시지 형식은 [채팅 채널 데이터와 흐름 「Redis 키」](CLE-CHAT-DATA.md#redis-키) 가 정한다.

## 채널 프로바이더 카탈로그

웹훅 트리거의 `config.chatChannel.provider` 로 고를 수 있는 외부 메신저 목록이다. 각 프로바이더의 API 매핑, UI 매핑, 명령 처리는 프로바이더 문서가 정한다.

### 지원 프로바이더(v1)

「지원」(`supported`)은 프로바이더 문서, 채널 어댑터 구현체, 레지스트리 등록, 종단 간 테스트를 모두 마친 상태다.

| `provider` 식별자 | 문서 | 상태 |
|---|---|---|
| `telegram` | [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) | 지원 |
| `slack` | [Slack 어댑터](CLE-CHAT-SLACK.md) | 지원 |
| `discord` | [Discord 어댑터](CLE-CHAT-DISCORD.md) | 지원 |

### 명세만 있는 프로바이더

문서는 있으나 채널 어댑터 구현체가 아직 등록되지 않은 프로바이더다. 1차 범위에는 없다.

### 향후 후보(문서 없음)

사용자 요청이 있으면 문서부터 만든다.

- `kakao-talk`: Kakao i Open Builder 와 KakaoTalk Channel 채팅
- `whatsapp`: WhatsApp Business Cloud API

### 새 프로바이더 추가 절차

1. 문서 작성: 기존 프로바이더 문서와 같은 구성(개요, API 호출 매핑, 명령 매핑, 노드 UI 매핑, 보안, 명령 처리, 비기능, Rationale)으로 쓴다. 이 카탈로그의 "명세만 있는 프로바이더" 에 올린다.
2. 구현: 채널 어댑터 구현, 레지스트리 등록, 종단 간 테스트를 마친다. 프로바이더 API 클라이언트는 `providers/<프로바이더>/<프로바이더>-client.ts` 에 두고 실패 문장에 [채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10 의 알려진 비밀 치환을 건다. 클라이언트별 fetch · 알려진 비밀 치환 지점 수를 세는 테스트의 표에도 더한다. 등록 절차는 [채팅 채널 어댑터 규약 「채널 어댑터 레지스트리」](CLE-CHAT-ADAPTER.md#채널-어댑터-레지스트리) 를 따른다.
3. 지원 승격: "명세만 있는 프로바이더" 에서 빼고 "지원 프로바이더" 에 「지원」 으로 올린다. 프로바이더 문서의 구현 위치에 코드 경로를 적는다.

### `provider` 식별자 규칙

- 소문자
- kebab-case(단어 사이 `-`)
- 외부 플랫폼 브랜드를 알아보기 쉽게 쓴다(예: `telegram`, `kakao-talk`, `whatsapp`)

`provider` 문자열의 기준은 위 지원 목록과 채널 어댑터 구현체의 `ChatChannelAdapter.provider` 필드다.

## 호환성

- `Trigger.config.chatChannel` 이 없으면 일반 웹훅 트리거다. 기존 트리거에는 영향이 없다.
- `chat_channel_*` 컬럼 5개를 더했다. NOT NULL 컬럼에는 DEFAULT 가 있어 기존 행에 영향이 없다.
- `POST /api/triggers/:id/chat-channel/rotate-bot-token` 을 더했다. 기존 엔드포인트는 바뀌지 않았다.
- 내부 `InteractionService.interact()` 의 시그니처는 그대로다. `InteractionRequestContext` 는 판별 union 이며 타입 정의는 [External Interaction API](../CLE-IX/CLE-EIA.md) 가 정한다. 외부 HTTP guard 의 ctx 조립은 바뀌지 않았다.
- `ChatChannelDispatcher` 가 기존 단일 sink `WebsocketService.executionEvents$` 를 하나 더 구독한다(`onModuleInit`). 기존 sink, EIA 알림 웹훅 발송기, SSE 발송 경로는 바뀌지 않는다. listener 가 늘었을 뿐 새 sink 는 없다.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/**`: 모듈, 채널 어댑터 레지스트리(`channel-adapter.registry.ts`), 트리거 단위 listener 레지스트리(`channel-listener.registry.ts`)와 그 변경을 다른 서버 인스턴스에 알리는 pub/sub(`channel-listener.bus.ts`), 재시작 · 다시 구독 때의 일괄 등록과 그 읽기 합치기(`channel-listener.restorer.ts` 의 `ChannelListenerRestorer`), 프로바이더별 adapter·client·parser·renderer(`providers/telegram/`, `providers/slack/`, `providers/discord/`, Slack·Discord 는 `*-signing.ts`·`*.types.ts` 추가)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`: 채널 어댑터 setup·teardown, 시크릿 쓰기와 참조 보존, 켤 때의 레지스트리 등록 `registerListenerOnActivation`
- `codebase/backend/src/modules/triggers/triggers.service.ts`(켜는 PATCH 커밋 뒤 레지스트리 등록), `trigger-resource-releaser.service.ts`(트리거 행을 없앨 때의 외부 해제와 채팅 채널 트리거의 레지스트리 해제)
- `codebase/backend/src/modules/triggers/trigger-callback-url*.ts`: 웹훅 콜백 URL 조립 순수 함수
- 테스트: `codebase/backend/test/chat-channel-listener-activation.e2e-spec.ts`(켠 뒤 등록, 켤 때와 삭제 때의 변경 메시지 발행, 다른 서버 인스턴스가 보낸 변경 메시지 반영, 다시 구독 뒤 복원), `codebase/backend/src/modules/chat-channel/channel-listener.bus.spec.ts`, `codebase/backend/src/modules/chat-channel/channel-listener.registry.spec.ts`, `codebase/backend/src/modules/chat-channel/channel-listener.restorer.spec.ts`(첫 연결의 SUBSCRIBE 응답 순서, 복원 읽기 합치기), `codebase/backend/src/modules/chat-channel/chat-channel.module.spec.ts`(세 프로바이더의 채널 어댑터 등록), `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(켜고 끌 때의 레지스트리), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts`(삭제 때 해제를 알리는 트리거)

`chat-channel/` 모듈은 `external-interaction/` 모듈과 같은 facade 계층이고 둘 다 엔진 밖이다. 후속 계획(미구현): Discord Gateway, Slack Socket Mode, 시각형 SSR PNG.

## Rationale

### R1 새 트리거 유형을 만들지 않는다

웹훅 트리거와 `chatChannel` 설정을 택했다. 트리거 유형(수동·웹훅·스케줄)은 그대로 두고 채널 어댑터는 설정 한 갈래로 둔다. 사용자 멘탈 모델은 "Telegram 어댑터를 켠 웹훅 트리거" 다. 새 노드로 두면 트리거 종류가 늘고 웹훅 트리거와 90% 가 겹친다. 채널 어댑터 인터페이스 없이 Telegram 을 1급 모듈로 두면 Slack·Kakao 를 더할 때 같은 모듈이 반복된다. 사용자가 명시한 입장이고 EIA facade 원칙과 맞다. 스케줄 트리거는 cron 으로 시작하므로 이 옵션을 쓰지 않는다.

### R5·R6 문서를 세 층으로 나눈다

| 문서 | 역할 |
|---|---|
| [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) | 모든 프로바이더 어댑터가 따르는 함수 시그니처와 데이터 타입 계약 |
| [채팅 채널](CLE-CHAT-CORE.md) 과 그 하위 문서 | 시스템 동작, 라이프사이클, EIA 관계, 요구사항 |
| 프로바이더 문서 | 프로바이더별 API 매핑, 명령, UI 매핑 |

채널 어댑터 규약은 노드 출력 규약·대화 스레드 규약처럼 "여러 구체 구현이 따르는 공통 계약" 층이다. Cafe24 의 형식 규약·노드 정의·endpoint 카탈로그 3분할([Cafe24 operation 메타데이터](CLE-C24-META), [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md))과 같은 구조다. 프로바이더 문서는 카탈로그와 Telegram 하나로 시작해 카탈로그를 갱신하며 늘렸다.

### R8 트리거 단위 listener 정책

fan-out 원천은 `executionEvents$` 이고 listener 는 셋이다. (1) `NotificationDispatcher`: EIA 알림 웹훅 HTTP POST. (2) SSE 어댑터: SSE fan-out, 구독 방식은 [External Interaction API 「단일 싱크와 외부 facade」](../CLE-IX/CLE-EIA.md#단일-싱크와-외부-facade) 가 정한다. (3) `ChatChannelDispatcher`: 서버 안 구독, 채팅 채널 전담.

`ChatChannelDispatcher` 는 모듈 단위 1회 구독을 유지하면서 트리거 단위 listener 레지스트리(`ChannelListenerRegistry`)로 다음을 보장한다.

- 생성과 `chatChannel` 이 실린 PATCH 는 `setupChannel()` 이 성공했을 때만 그 결과의 잠금 안 재기록이 커밋된 뒤 등록한다. 설정이 실패하면 등록하지 않는다(R-CC-29 「남은 한계」). 같은 `triggerId` 항목이 있으면 덮어쓴다(멱등, 키는 `triggerId`, 값은 `(triggerId, provider)`). 프로바이더 변경은 지원하지 않고 재생성으로 처리한다.
- 트리거 행을 없애는 네 경로(트리거 화면 삭제, 스케줄 화면 삭제, 워크플로우 삭제, 워크스페이스 삭제. [트리거 관리 「자원 정리」](../CLE-TRIG/CLE-TRIG-MANAGE.md#자원-정리))의 행 삭제 전 외부 해제 단계에서 항목을 반드시 해제한다. `teardownChannel()` 은 이 경로와 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 의 쓰기 보상에서만 불린다. 쓰기 보상은 행을 쓰지 못한 요청이 만든 프로바이더 등록을 되돌리는 것이다. 그 요청은 레지스트리에 등록하지 않았으므로 해제할 항목도 변경 메시지도 없다. 스케줄 트리거에는 채팅 채널을 둘 수 없어 등록되지 않는다. 해제하는 트리거의 범위는 [레지스트리 변경의 전파](#레지스트리-변경의-전파) 가 정한다.
- `handle()` 은 DB 조회 전에 `registry.has(triggerId)` 로 거르고 미등록 트리거는 경고 로그를 남기고 건너뛴다. 레지스트리에 항목이 있어도 DB 에 트리거가 없으면 경고 로그를 남기고 건너뛴다. 이 DB 조회는 `is_active` 로 거르지 않는다. 끈 트리거의 항목을 남기는 것은 끄기 전에 시작한 실행의 메시지를 보내려는 것이라서 활성 여부로 거르면 그 메시지가 나가지 않는다.
- 서버 인스턴스가 시작할 때와 `chat-channel:listener` 구독이 확립될 때마다 `isActive=true AND config.chatChannel IS NOT NULL` 트리거를 DB 에서 한 번에 등록한다.
- 트리거를 켜는 PATCH 는 `setupChannel()` 을 부르지 않으므로 커밋 뒤 그 자리에서 따로 등록한다. 끄는 PATCH 는 항목을 해제하지 않는다. 근거는 R-CC-29 다.
- 레지스트리는 서버 인스턴스마다 따로 있다. 등록 · 해제는 Redis pub/sub 채널 `chat-channel:listener` 로 다른 서버 인스턴스에 알린다. 근거는 R-CC-30 이다.

효과는 (a) 삭제 뒤 들어오는 이벤트 차단, (b) 재시작 직후 미등록 race 회피, (c) DB 왕복 절감이다. 다른 서버 인스턴스가 해제 메시지를 놓치면 (a) 는 레지스트리 대신 dispatcher 의 DB 조회가 맡는다(R-CC-30). 라우팅은 여전히 `handle()` 안에서 한다. `executionEvents$` 를 EventEmitter 로 바꾸는 식의 분리는 범위 밖이다.

레지스트리는 이벤트를 거르는 가드다. 끈 트리거의 항목도 남으므로 활성 트리거 목록과 같지 않다. 트리거가 켜져 있는지의 기준은 인바운드 관문의 트리거 활성 관문이다([인바운드 관문](CLE-CHAT-CORE-GATE.md#인바운드-관문-순서)). 그래서 꺼진 트리거의 항목이 남아도 새 실행은 생기지 않는다.

### R-CC-29 트리거를 켜고 끌 때 외부 채널 등록은 건드리지 않는다

**결정.** 2026-10-10 결정이다. 그전 요구사항은 켤 때 `setupChannel()`, 끌 때 `teardownChannel()` 을 부른다고 적어 구현과 어긋났다. 구현은 트리거 생성, `chatChannel` 이 실린 PATCH, 봇 토큰 재발급에서만 `setupChannel()` 을 부르고, `teardownChannel()` 은 트리거 행을 없애는 경로와 쓰기 보상에서만 부른다. 인바운드 응답 계약도 비활성 트리거에 update 가 계속 온다고 보고 서명 검증 뒤 `202` 로 버린다. 끌 때 웹훅을 해제했다면 그 update 는 오지 않는다. 그래서 현행 동작을 기준으로 삼았다. 켜고 끄는 PATCH 는 프로바이더 등록을 건드리지 않는다.

**기각한 대안.** 켤 때마다 다시 등록하고 끌 때마다 해제하는 안. 켜고 끌 때마다 외부 API 를 불러야 해서 프로바이더 재등록이 실패할 수 있는 지점이 늘어난다.

**켤 때의 레지스트리 등록(2026-10-15).** 일괄 등록은 활성 트리거만 고르므로 꺼진 채 서버가 재시작된 뒤 켠 트리거는 레지스트리에 없었다. 인바운드는 실행을 시작하는데 dispatcher 가 그 이벤트를 건너뛰어 다음 재시작까지 채팅 채널로 아무것도 나가지 않았다. 종단 간 테스트(`chat-channel-listener-activation.e2e-spec.ts`)의 대조 시나리오가 이 상태를 재현한다. 켤 때 외부 등록은 하지 않고 레지스트리 항목만 등록한다. 레지스트리 등록은 서버 안의 일이고 Redis 로 보내는 변경 메시지가 실패해도 요청은 실패하지 않으므로 위에서 기각한 외부 호출 실패 지점을 늘리지 않는다. 다만 레지스트리는 서버 인스턴스마다 따로 있어서 켠 요청을 받은 서버 인스턴스에만 등록하면 같은 빈틈이 다른 서버 인스턴스에 남는다. 그래서 등록을 모든 서버 인스턴스에 알린다(R-CC-30).

켤 때는 채널 건강도(`degraded`)를 보지 않고 등록한다. 건강도는 채팅 채널의 동작 상태를 보여 줄 뿐 켜진 트리거 실행의 메시지를 채팅 채널로 보낼지 정하지 않는다. `degraded` 트리거도 인바운드 관문을 지나 실행을 시작한다. dispatcher 는 보내기에 성공하면 건강도를 `healthy` 로 되돌린다([채널 건강도](CLE-CHAT-CORE-RENDER.md#채널-건강도)). 건강도로 거르면 그 실행의 메시지가 나가지 않고 건강도가 돌아올 기회도 없다. 등록 메시지를 잃어 다른 서버 인스턴스의 dispatcher 가 아웃바운드를 건너뛰어도 `chat_channel_health` 는 바꾸지 않는다. 원인이 그 트리거가 아니라 서버 인스턴스 사이 전파라서 트리거의 `chat_channel_last_error` 에 담을 문구가 없다.

**끌 때.** 레지스트리 항목을 해제하지 않는다. 비활성 트리거의 update 는 인바운드 관문에서 버리므로 새 실행이 생기지 않는다. 끄기 전에 시작한 실행의 메시지는 채팅 채널로 나간다. 해제하면 그 메시지가 아무 표시 없이 사라진다.

**남은 한계.** 재시작 때의 일괄 등록은 활성 트리거만 고른다. 그래서 트리거가 꺼진 동안 새로 뜨거나 다시 시작한 서버 인스턴스에서 이어지는 실행의 메시지는 나가지 않는다. 이 결정은 재시작을 넘는 진행 중 실행까지 보장하지 않는다. 끈 동안에도 외부 등록이 남아 있어 프로바이더는 update 를 계속 보낸다. 비활성 트리거는 Slack `url_verification` 과 Discord PING 에 `202` ignored 로 답한다. 2026-11-12 결정으로 이 동작을 유지한다([트리거 데이터와 흐름 「미결 사항」](../CLE-TRIG/CLE-TRIG-DATA.md#미결-사항) 에 올라 있던 항목이다). 같은 결정으로 인터랙션에는 트리거가 비활성이어도 `200` 과 기본 응답으로 답한다([R-CC-33](CLE-CHAT-CORE-INTERACT.md#r-cc-33-인터랙션은-어느-경로로-끝나도-기본-응답으로-답하고-버린-클릭에는-수신-확인을-보낸다)). 껐다 켜도 `setupChannel()` 을 다시 부르지 않으므로 채널 설정이 실패해 `degraded` 가 된 트리거를 껐다 켜서 다시 설정할 수는 없다. 다시 설정하려면 `chatChannel` 이 실린 PATCH 를 보내거나 봇 토큰을 재발급한다.

레지스트리에 넣는 기준이 경로마다 다르다. 켜는 PATCH 와 일괄 등록은 건강도를 보지 않는다. 생성과 `chatChannel` 이 실린 PATCH 는 `setupChannel()` 이 성공했을 때만 등록한다. 그래서 생성 때 채널 설정이 실패해 `degraded` 가 된 활성 트리거는 처음에는 어느 서버 인스턴스의 레지스트리에도 없다. 구독을 다시 확립하거나 다시 시작한 서버 인스턴스만 일괄 등록으로 그 트리거를 넣는다. 그동안 같은 트리거의 실행 메시지가 일괄 등록을 거친 서버 인스턴스에서는 나가고 거치지 않은 서버 인스턴스에서는 경고 로그와 함께 버려진다. `chatChannel` 이 실린 PATCH 의 설정이 실패하면 새로 등록하지 않을 뿐 이미 있던 항목은 그대로 둔다. 2026-11-05 에 동작을 바꾸지 않고 한계로 적기로 했다. 설정이 실패한 트리거도 생성 때 등록하게 바꾸는 안은 코드를 바꿔야 해서 이번에 하지 않았다.

### R-CC-30 트리거 단위 listener 레지스트리의 변경을 Redis pub/sub 로 모든 서버 인스턴스에 알린다

**결정.** 2026-10-15 결정이다. 켤 때의 등록이 프로세스 안 레지스트리에만 들어가면 여러 서버 인스턴스에서 증상이 남는다. 단일 서버 인스턴스 전제를 요구사항에 적는 안과 dispatcher 가 레지스트리에 없는 트리거를 DB 에서 확인하는 안 대신 사용자가 Redis pub/sub 로 모든 서버 인스턴스에 알리는 안을 골랐다. 레지스트리는 프로세스 안 `Map` 이고 `executionEvents$` 도 그 프로세스 안에서만 전달된다. 플랫폼은 여러 서버 인스턴스를 전제한다([시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md)). 한 서버 인스턴스가 받은 요청으로만 등록하면 실행을 맡은 다른 서버 인스턴스의 dispatcher 는 그 실행의 이벤트를 건너뛴다. 그래서 레지스트리가 자기 `Map` 에 반영한 뒤 Redis pub/sub 채널 `chat-channel:listener` 로 변경을 보낸다. 다른 서버 인스턴스는 받은 변경을 자기 `Map` 에만 반영하고 다시 보내지 않는다. 본보기는 통합 자격 증명 캐시를 비우는 pub/sub 채널(`IntegrationCacheBus`)이다. 구독은 전용 복제 연결로 하고 발행은 공유 연결로 한다. 등록과 해제를 언제 하는지는 [레지스트리 변경의 전파](#레지스트리-변경의-전파) 가 정한다. 생성과 `chatChannel` 이 실린 PATCH 의 등록을 잠금 안 재기록이 커밋된 뒤에 하는 이유는 재기록이 행이 없어 쓰지 못했을 때 레지스트리 항목과 변경 메시지를 만들지 않기 위해서다. 그래서 쓰기 보상이 되돌릴 항목과 메시지가 없다.

**알리는 범위.** 켜는 PATCH 의 등록만이 아니라 생성 · `chatChannel` 이 실린 PATCH 의 등록과 트리거 행을 없앨 때의 해제도 알린다. 프로세스 안에서만 바꾸면 생성 경로에 같은 빈틈이 남는다. 지운 트리거가 다른 서버 인스턴스의 레지스트리에 남으면 그 서버 인스턴스는 그 트리거의 이벤트마다 DB 를 읽는다. 삭제 뒤 이벤트 차단은 DB 조회로 유지된다. 잃는 것은 R8 의 DB 왕복 절감뿐이다. 스케줄 트리거와 채팅 채널이 없는 웹훅 트리거는 레지스트리에 든 적이 없으므로 그 삭제 요청에는 Redis 왕복을 더하지 않는다. 레지스트리도 함께 보는 것은 `config.chatChannel` 이 없는데 항목이 남은 트리거도 해제하기 위해서다.

**선행 기준의 예외.** pub/sub 를 쓸 신호의 기준은 선행 결정 둘이 정했다. [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) Rationale 「풀 캐시 무효화에 Redis pub/sub 방송 채택」 은 «캐시 무효화는 유실돼도 해시 비교로 정합성이 보장되는 best-effort 라 가벼운 pub/sub 가 맞다» 고 적었다. [실행 복구](../CLE-EXEC/CLE-EXEC-RECOVERY.md) Rationale 「영속 재개 큐와 안전 종료」 는 재개 신호를 BullMQ 영속 큐로 옮겼다. pub/sub 를 유지하는 안을 기각한 이유는 «at-most-once 한계를 돌아갈 뿐 근본 해결이 아니다» 였다. 이 결정은 두 기준보다 느슨하다. 등록 메시지를 잃으면 그 서버 인스턴스의 dispatcher 가 그 트리거 실행의 이벤트를 건너뛰어 채팅 채널로 메시지가 나가지 않는다. 실행은 그대로 진행되고 결과도 저장된다. 다만 채팅 채널로 입력을 묻는 실행이면 사용자가 질문을 받지 못해 대기 상태가 이어질 수 있다. 유실을 메우는 장치는 구독이 다시 붙을 때의 일괄 등록(「놓친 메시지」)뿐이다. 해제 메시지를 잃으면 R8 의 DB 왕복 절감만 잃는다. 그래도 선행 기준의 예외를 받아들인다. 예외의 범위는 구독 연결이 이어진 동안의 발행 실패와 유실이다. 구독이 끊긴 사이의 변경은 일괄 등록이 메운다. 근거는 둘이다. 첫째, Redis 서버가 응답하지 않으면 같은 서버를 쓰는 실행 시작 큐(`execution-run`)에도 작업을 넣지 못해 새 실행이 시작되지 않는다. 그래서 그 장애 동안에는 빠진 항목 때문에 메시지를 놓칠 새 실행도 생기지 않는다. 둘째, 발행 실패는 warn 로그로 남아 운영에서 볼 수 있다. 실행 복구 Rationale 「영속 재개 큐와 안전 종료」 의 「best-effort 교환」 도 채팅 채널 안내 실패가 실행 재개를 막지 않게 했다. BullMQ 큐는 작업 하나를 워커 하나가 가져가므로 모든 서버 인스턴스에 같은 변경을 알리는 데 맞지 않는다. 연결이 이어진 동안의 유실이 실제로 관찰되면 다시 본다. 관찰 수단은 dispatcher 가 레지스트리에 없는 트리거를 건너뛸 때 남기는 `listenerRegistry miss` warn 로그다. 지금은 채팅 채널이 아닌 트리거 실행(일반 웹훅 · 스케줄)의 이벤트에도 같은 경고가 찍힌다. 둘을 가르는 일은 NERV Task `CLE-T-0VHD0T` 가 맡는다.

**R4 와의 관계.** [R4](CLE-CHAT-CORE-FLOW.md#r4-단일-sink-를-직접-구독한다) 는 실행 이벤트를 Redis pub/sub 로 돌리지 않는다고 정했다. 이 결정도 실행 이벤트는 그대로 프로세스 안 `executionEvents$` 로 받는다. pub/sub 로 오가는 것은 레지스트리의 등록 · 해제뿐이고 트리거를 만들고 켜고 지울 때만 생긴다.

**기각한 대안.** dispatcher 가 레지스트리에 없는 트리거를 만나면 DB(`is_active AND config.chatChannel`)를 한 번 확인하는 안. 레지스트리의 용도 하나가 레지스트리에 없는 트리거의 이벤트를 DB 를 거치지 않고 건너뛰는 것이다(R8 의 효과 (c)). 채팅 채널이 아닌 실행의 이벤트도 모두 레지스트리에 없으므로 이벤트마다 DB 조회가 생긴다. 코드를 다시 보면 이 근거는 약하다. 이벤트 `payload` 의 `chatChannel` 은 채팅 채널 인바운드로 시작한 실행에만 실린다(`HooksService` 가 실행 입력에 넣고 `WebsocketService` 가 라우팅 문맥으로 이벤트에 붙인다). dispatcher 가 `payload.chatChannel.conversationKey` 를 먼저 보면 채팅 채널이 아닌 실행은 DB 를 읽지 않고 거를 수 있다. 결정은 바꾸지 않는다. 「선행 기준의 예외」 의 재검토 조건이 생기면 이 안도 다시 본다. 주기적 일괄 등록(`bulkRegister` 를 일정 간격으로 부르는 안)도 기각했다. 바뀐 것이 없어도 모든 서버 인스턴스가 주기마다 DB 를 읽고, 그래도 다음 주기까지는 빈틈이 남는다. 레지스트리를 Redis 집합 같은 공유 저장소로 옮기는 안은 미뤘다. 그러면 dispatcher 가 이벤트마다 Redis 를 읽는다. Redis 가 응답하지 않는 동안에는 레지스트리로 거르지도 못한다. 연결이 이어진 동안의 유실이 관찰되면 그때 함께 본다.

**놓친 메시지.** pub/sub 는 메시지를 저장하지 않아서 구독 연결이 끊긴 사이의 변경은 사라진다. 통합 자격 증명 캐시를 비우는 pub/sub 채널은 핸들러가 자격 증명 해시를 비교해 놓친 메시지를 메우지만 레지스트리에는 그런 보정이 없다. 그래서 구독이 확립될 때마다 활성 트리거를 DB 에서 다시 일괄 등록한다. DB 를 구독 응답 뒤에 읽는 이유는 구독이 확립되기 전에만 읽으면 그 사이 커밋하고 발행한 등록을 둘 다 놓칠 수 있어서다. 서버 인스턴스가 시작할 때는 복원 서비스(`ChannelListenerRestorer`)가 구독 확립 handler 를 먼저 등록하고 곧바로 일괄 등록을 시작한다. 첫 구독 응답이 handler 를 등록하기 전에 오면 시작 때의 일괄 등록이 응답 뒤에 DB 를 읽는다. 나중에 오면 handler 가 응답 뒤에 읽는다. 그래서 어느 쪽이든 응답 뒤에 DB 를 한 번은 읽는다. 놓친 해제를 보정하지 않는 이유는 [레지스트리 변경의 전파](#레지스트리-변경의-전파) 에 있다. 메시지에는 보낸 프로세스의 id 를 싣고 자기 메시지는 건너뛴다. 자기 변경은 이미 반영했고 등록 뒤 곧바로 해제했을 때 늦게 돌아온 자기 등록 메시지가 항목을 되살릴 수 있기 때문이다.

**실패 정책.** 발행 · 구독 실패는 로그만 남기고 트리거 요청을 실패시키지 않는다. 발행 응답은 2초(`PUBLISH_WAIT_TIMEOUT_MS`)까지만 기다린다. 공유 연결이 끊겨 있으면 ioredis 는 명령을 쌓아 두었다가 재연결 시도가 거듭된 뒤에야 거부한다. 상한이 없으면 그동안 트리거 요청도 기다린다. 변경은 이미 커밋됐고 자기 `Map` 에도 반영했으므로 더 기다려도 요청만 늦어진다. Redis 가 응답하지 않을 때 트리거 요청이 늦어지는 최댓값은 이 상한으로 정해진다. 생성과 `chatChannel` · `isActive: true` 중 하나가 실린 PATCH 는 발행을 한 번 기다려 최대 2초 늦어진다. 둘이 함께 실린 PATCH 는 발행을 차례로 두 번 기다려 최대 4초 늦어진다. 트리거 행을 없애는 요청은 해제 메시지 발행을 트리거마다 기다리지 않고 모아 두었다가 한 번에 기다리므로 트리거가 많아도 최대 2초다. Redis 가 없으면 그 서버 인스턴스의 레지스트리만 바뀐다. 서버 인스턴스가 하나면 그것으로 충분하다. 구독이 반복해서 끊기면 다시 붙을 때마다 복원 요청이 온다. 복원 서비스는 읽기가 진행 중일 때 온 요청을 모아 그 읽기가 끝난 뒤 한 번만 더 읽는다. 이 합치기는 한 서버 인스턴스 안의 일이고 서버 인스턴스끼리 같은 순간에 읽는 것은 막지 않는다.

**남은 한계.** 해제는 행을 지우기 전에 알린다. 그 뒤 행 삭제가 실패하면 그 트리거는 모든 서버 인스턴스의 레지스트리에서 빠지고 `teardownChannel()` 도 이미 불린 채로 남는다. 다음 재구독이나 재시작 때의 일괄 등록이 항목을 다시 넣는다. 켜는 PATCH 가 커밋된 뒤 등록하기 전에 그 트리거가 지워지면 항목이 모든 서버 인스턴스에 남을 수 있다. 일괄 등록은 항목을 더하기만 하므로 이 항목은 그 서버 인스턴스가 재시작할 때까지 빠지지 않는다. dispatcher 가 DB 에서 트리거를 찾지 못해 건너뛰므로 메시지가 잘못 나가지는 않는다. 연결이 이어진 동안의 발행 실패와 유실은 보정하지 않는다. DB 에서 메우는 것은 구독이 끊겼다 다시 붙을 때뿐이다. 이 한계를 받아들인 근거와 재검토 조건은 「선행 기준의 예외」 에 있다.

### 카탈로그를 1차 범위부터 둔 이유

프로바이더가 Telegram 하나뿐일 때도 카탈로그를 만들었다. 두 번째 프로바이더 때 카탈로그 도입을 미루면 빠뜨리기 쉽고, 미리 자리를 잡아 두면 갱신만 하면 된다. Cafe24 API 카탈로그와 같은 패턴이고 짧아서 비용도 거의 없다.

### 지원·명세만·후보 세 단계를 둔 이유

명세만 있는 프로바이더와 동작하는 프로바이더를 한 표에 두면 사용자가 명세만 있는 것을 고를 수 있다고 오해한다. 사용자 가이드에서도 두 단계를 나눠야 하고, 카탈로그가 단계를 드러내지 않으면 문서와 실제가 어긋난다. 문서 단위의 구현 단계는 머리 줄의 구현 상태(구현됨 · 부분 구현 · 미구현)가 맡는다([스펙과 구현 근거 규약](../CLE-ENG/CLE-ENG-SPECEVIDENCE.md)). 옛 스펙 트리의 `status: spec-only` 와 같은 생각이다. 그 상태 값은 전환 단계 5 에서 옛 트리와 함께 걷었고 문서 단위 구현 단계는 머리 줄의 구현 상태로 이어졌다. `spec-only` 와 `backlog` 를 가르는 세분은 없다. 프로바이더 행 단위의 세 단계는 이 카탈로그가 따로 맡는다.
