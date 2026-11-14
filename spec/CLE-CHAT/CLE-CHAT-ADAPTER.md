---
id: "CLE-CHAT-ADAPTER"
title: "채팅 채널 어댑터 규약"
type: "convention"
version: 15
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "a2445c606e210b456b16be81b678da2b7ba776b2da30f54a59502ac93c80f93a"
read_as: "approved_fallback"
task: "CLE-T-E90KGZ"
source_paths: ["spec/conventions/chat-channel-adapter.md"]
mirror_sha256: "b0170219a81e52c4338ed87fd04e5688d397bb6d2e4d71fa18ee45014783d5c5"
etag: "sha256-79d3dc305386a1660761e6d3f464e40d7640616fda9af3683448a72678d939b8"
---
> 구현 상태: 부분 구현 · 원문: `spec/conventions/chat-channel-adapter.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 외부 메신저(Telegram, Slack, Kakao 등)마다 있는 채널 어댑터(`ChatChannelAdapter`)가 구현해야 하는 함수 시그니처와 데이터 타입 계약을 정한다. 모든 채널 어댑터가 이 인터페이스를 지키면 [채팅 채널](CLE-CHAT-CORE.md) 의 시스템 동작과 저절로 맞는다.

채널 어댑터가 여러 채널 프로바이더에 공통으로 따르는 동작도 여기서 정한다. 이벤트별 렌더 매핑, 실행 실패 안내 분류 알고리즘, Form 입력 흐름(네이티브 모달과 다단계 질문)이다. 프로바이더별 API 호출, 길이 한도, escape, 모달 수용 필드 타입 같은 세부는 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md), [Slack 어댑터](CLE-CHAT-SLACK.md), [Discord 어댑터](CLE-CHAT-DISCORD.md) 가 정한다. 이 문서에서 단독으로 쓴 「프로바이더」 는 채널 프로바이더를 뜻한다.

다음은 다른 문서가 정한다. `Trigger.config.chatChannel` 필드 계약과 안내 문구 기본값은 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이, 요구사항·봇 토큰 재발급 API·인바운드 응답 계약은 [채팅 채널](CLE-CHAT-CORE.md) 이, External Interaction API(EIA) 이벤트 페이로드는 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 정한다.

## 규칙

1. 모든 채널 어댑터는 [채널 어댑터 인터페이스](#채널-어댑터-인터페이스) 의 필수 함수를 구현한다. 선택 함수(`revokeBotToken?`, `enrichInbound?`, `defaultInteractionResponse?`, `handshakeResponse?`, `ackDroppedUpdate?`, `openFormModal?`, `buildFormSubmissionResponse?`)는 프로바이더가 해당 기능을 지원할 때만 구현한다.
2. `parseUpdate`, `renderNode`, `escapeControlText`, `defaultInteractionResponse`, `handshakeResponse`, `buildFormSubmissionResponse` 는 순수 함수다. DB 에 접근하지 않고 외부 API 를 부르지 않는다. 부수 효과는 `setupChannel`, `teardownChannel`, `sendMessage`, `ackInteraction`, `ackDroppedUpdate`, `revokeBotToken`, `enrichInbound`, `openFormModal` 이 맡는다. 외부 API 로 알아내야 하는 update 정보는 `parseUpdate` 뒤에 `enrichInbound` 가 채운다.
3. `parseUpdate` 는 해석할 수 없거나 무시할 update 에 `null` 을 돌려준다. `null` 의 뜻은 "채널 어댑터가 해석하지 않음" 하나뿐이다. 안내 메시지를 보낼지는 호출자(`HooksService`)가 raw body 의 프로바이더 메타(예: Telegram `chat.type`, `from.is_bot`)를 보고 정한다.
4. `setupChannel` 은 같은 설정으로 다시 불러도 등록이 깨지지 않아야 한다(멱등). 이 멱등은 발급 시크릿 값이 그대로라는 뜻이 아니다([setupChannel 멱등의 뜻](#setupchannel-멱등의-뜻)).
5. `setupChannel`·`teardownChannel` 이 자격 증명 거부로 실패하면 던지는 `Error` 에 `code: 'BOT_TOKEN_INVALID'` 를 싣는다. 호출자는 `err.code === 'BOT_TOKEN_INVALID'` 정확 일치로만 분류하고 `message` 를 해석하지 않는다([setupChannel 실패 판별](#setupchannel-실패-판별)).
6. `renderNode` 의 입력은 `EiaEvent | ChatChannelInternalEvent` union 이다. 구현체는 `event.type` 으로 나눈다. 새 이벤트를 받으려면 새 함수가 아니라 union variant 를 더한다(R-CCA-7).
7. 제어 안내(control-plane message)를 `renderNode` 를 거치지 않고 보낼 때 호출자는 발송 직전 `escapeControlText` 로 escape 한다. `renderNode` 출력은 렌더러가 이미 escape 했으므로 `sendMessage` 가 다시 escape 하지 않는다.
8. 실행 실패 안내는 프로바이더와 무관한 순수 함수 `classifyExecutionFailure` 하나로 분류한다. 입력은 `error.code` 와 `error.details.statusCode` 뿐이다([실행 실패 안내 분류](CLE-CHAT-ADAPTER-RENDER.md#실행-실패-안내-분류)).
9. Form 입력 대기는 [Form 입력 흐름](#form-입력-흐름) 을 따른다. 네이티브 모달 조건에 맞지 않으면 모든 채널 어댑터가 같은 다단계 질문을 쓴다.
10. 봇 토큰과 인바운드 서명 자료는 시크릿 저장소 참조로만 들고 다닌다. 평문을 설정 JSON, 로그, metric 에 내놓지 않는다. `SetupResult.issuedInboundSigning` 한 번만 예외다. 클라이언트가 만든 실패 문장은 `chat_channel_last_error` 에 저장되고 로그에도 남는다. 그래서 프로바이더 API 클라이언트(`providers/<프로바이더>/<프로바이더>-client.ts`)는 그 문장(fetch 예외, API 호출 재시도 소진 사유)을 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 지운다(알려진 비밀 치환, `replaceKnownSecret`, [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) §1.1). 지우는 대상은 토큰과 글자 그대로 같은 부분과 양끝 공백을 뗀 토큰이다(fetch 는 헤더 값 양끝 공백을 떼고 원문에 싣는다). 프로바이더가 돌려준 4xx 본문은 실패 판별(규칙 5, 「setupChannel 실패 판별」)의 입력이라 바꾸지 않는다. 호출자가 `message` 를 해석하지 않는다는 규칙과는 다른 층이다(클라이언트가 `code` 를 정하는 단계다).
11. `sendMessage` 는 프로바이더별 고정 URL 만 부른다. 사용자가 정하는 URL 은 쓰지 않는다(SSRF(Server-Side Request Forgery) 차단).
12. 채널 프로바이더 식별자(`provider`)는 소문자 kebab-case 이고 [채널 어댑터 레지스트리](#채널-어댑터-레지스트리) 에 등록한다.
13. 인터페이스를 바꾸면 관련 문서를 함께 고친다([변경 관리](#변경-관리)).
14. 프로바이더 API 클라이언트는 실패를 `ok: false` 표지로 돌려주고 채널 어댑터는 이 표지로 실패를 판정한다. 실패한 `sendMessage` 는 throw 하고 `setupChannel` 의 하위 호출 실패는 `setupChannel` 실패다([클라이언트 실패 판정](#클라이언트-실패-판정), [R-CCA-11](CLE-CHAT-ADAPTER-SETUP.md#r-cca-11-클라이언트-실패는-okfalse-표지로-판정한다)).

## 하위 문서

이 규약은 다음 하위 문서로 나뉜다. 이 문서에는 요구사항 줄이 없어 요구사항 번호 목록은 비어 있다.

| 하위 문서 | 맡는 내용 | 요구사항 |
|---|---|---|
| [인터페이스와 함수 책임](CLE-CHAT-ADAPTER-IFACE.md) | `ChatChannelAdapter` 시그니처, 함수 책임 표, 인터랙션 기본 응답과 수신 확인, 인터랙션 기본 응답 타입 | 없음 |
| [채널 등록 실패와 토큰 폐기](CLE-CHAT-ADAPTER-SETUP.md) | `setupChannel` 멱등의 뜻, 실패 판별(`BOT_TOKEN_INVALID`), 클라이언트 실패 판정(`ok: false`), 이전 봇 토큰 폐기 | 없음 |
| [이벤트와 데이터 타입](CLE-CHAT-ADAPTER-TYPES.md) | `EiaEvent`, `ChatChannelInternalEvent`, `ChannelUpdate`, `ChannelMessage`, `ChatChannelConfig`, `SetupResult`·`SendResult` | 없음 |
| [이벤트 렌더와 실패 안내](CLE-CHAT-ADAPTER-RENDER.md) | 이벤트별 렌더 매핑, 시각형 렌더 입력, 실행 실패 안내 분류 | 없음 |
| [Form 입력 흐름](CLE-CHAT-ADAPTER-FORM.md) | 네이티브 모달 경로, 다단계 질문, 네이티브 모달 타입 | 없음 |

## 채널 어댑터 인터페이스

→ [채팅 채널 어댑터 규약 — 인터페이스와 함수 책임](CLE-CHAT-ADAPTER-IFACE.md#채널-어댑터-인터페이스)

### 인터랙션 기본 응답과 수신 확인

→ [채팅 채널 어댑터 규약 — 인터페이스와 함수 책임](CLE-CHAT-ADAPTER-IFACE.md#인터랙션-기본-응답과-수신-확인)

### setupChannel 멱등의 뜻

→ [채팅 채널 어댑터 규약 — 채널 등록 실패와 토큰 폐기](CLE-CHAT-ADAPTER-SETUP.md#setupchannel-멱등의-뜻)

### setupChannel 실패 판별

→ [채팅 채널 어댑터 규약 — 채널 등록 실패와 토큰 폐기](CLE-CHAT-ADAPTER-SETUP.md#setupchannel-실패-판별)

#### 클라이언트 실패 판정

→ [채팅 채널 어댑터 규약 — 채널 등록 실패와 토큰 폐기](CLE-CHAT-ADAPTER-SETUP.md#클라이언트-실패-판정)

## Form 입력 흐름

→ [채팅 채널 어댑터 규약 — Form 입력 흐름](CLE-CHAT-ADAPTER-FORM.md#form-입력-흐름)

## 채널 어댑터 레지스트리

```typescript
interface ChannelAdapterRegistry {
  register(adapter: ChatChannelAdapter): void;
  get(provider: string): ChatChannelAdapter;
  has(provider: string): boolean;
}
```

`provider` 문자열은 소문자 kebab-case 다(예: `"telegram"`, `"slack"`, `"kakao-talk"`). 새 채널 어댑터를 더하는 절차는 다음과 같다.

1. 프로바이더 문서를 만든다(구체 명세).
2. `codebase/backend/src/modules/chat-channel/providers/<name>/<name>.adapter.ts` 에 `ChatChannelAdapter` 를 구현한다.
3. `ChatChannelModule` 생성자에서 `registry.register(adapter)` 로 레지스트리에 등록한다.
4. [채팅 채널](CLE-CHAT-CORE.md) 의 채널 프로바이더 카탈로그에 행을 더한다.
5. 채널 어댑터 구현체에 `supportsNativeForm` 값을 선언한다. 지원하면 모달 수용 필드 타입 범위를 프로바이더 문서에 적는다.

## 보안

- 자격 증명은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 참조만 둔다([채팅 채널 「신뢰성과 보안」](CLE-CHAT-CORE.md#신뢰성과-보안) 의 자격 증명 저장 요구사항). 평문 노출 금지와 그 예외는 규칙 10, 고정 URL(SSRF 차단)은 규칙 11 이 정한다.
- `parseUpdate` 는 raw body 의 출처를 검증한 뒤에 부른다. 진입점 핸들러가 프로바이더별 인바운드 서명(Telegram `X-Telegram-Bot-Api-Secret-Token` 등)을 먼저 검증한다. 저장된 `inboundSigningRef` 가 없는 행에서 이 검증을 건너뛰는 임시 동작은 [미결 사항](#미결-사항) 에 적었다.

## 변경 관리

이 규약은 [채팅 채널](CLE-CHAT-CORE.md) 의 시스템 동작과 함께 바뀐다. 인터페이스를 바꾸면 [채팅 채널](CLE-CHAT-CORE.md) 과 영향받는 모든 프로바이더 문서([Telegram 어댑터](CLE-CHAT-TELEGRAM.md), [Slack 어댑터](CLE-CHAT-SLACK.md), [Discord 어댑터](CLE-CHAT-DISCORD.md))를 함께 고친다. 채널 프로바이더 목록이나 지원 상태가 바뀌면 [채팅 채널](CLE-CHAT-CORE.md) 의 채널 프로바이더 카탈로그도 고친다. "영향받는 모든" 의 해석은 [R-CCA-9](CLE-CHAT-ADAPTER-SETUP.md#r-cca-9-실패-사유를-message-가-아니라-code-로-선언한다) 를 본다.

## 미결 사항

- **시각형 렌더러 입력 모양과 노드 출력의 불일치**: 세 프로바이더 문서의 시각형 매트릭스는 Chart 입력을 `output.payload.{title, series, labels}`, Carousel 카드를 `imageUrl` 로 적고 "노드가 무엇을 만드나" 기준이라고 못박았다. 그러나 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md) 출력은 `output.data`(`{ x, y? }[]`, 제목은 `config.title`)이고, [Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md) 출력은 `output.items[].image`(동적 모드, 정적 모드는 `config.items`)다. 현재 구현(렌더러)도 `series`·`labels`·`imageUrl` 을 찾으므로 그래프의 Chart 노드 출력이 채팅 채널에서 비어 보일 수 있다. 노드 출력 계약에 맞춰 매트릭스와 렌더러를 고칠지, 렌더러 앞에 변환 층을 둘지 정해야 한다. 같은 충돌이 [Presentation 노드 공통 §미결 사항](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#미결-사항) 에도 올라 있다.
- **버튼 달린 Template 의 입력 대기 처리**: Template 도 버튼이 있으면 입력 대기로 들어간다([Template 노드](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md)). 그런데 [이벤트별 렌더 매핑](CLE-CHAT-ADAPTER-RENDER.md#이벤트별-렌더-매핑) 의 버튼 입력 대기 행과 [채팅 채널 「노드와 채널 UI 매핑」](CLE-CHAT-CORE.md#노드와-채널-ui-매핑) 의 시각형 노드 요구사항은 시각형 앞 메시지를 carousel·table·chart 로만 열거한다. 현재 구현(Telegram 렌더러)은 template 도 처리한다. 두 곳에 template 을 더할지 정해야 한다. 같은 충돌이 [Template 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md#미결-사항) 에도 올라 있다.
- **Form 필드 `description`**: 다단계 질문의 둘째 줄과 Discord 모달 placeholder 가 `field.description` 을 쓰지만 [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 의 필드 정의와 `formFieldSchema` 에는 없다. 현재 구현은 스키마 passthrough 로 통과한 값을 `form-mode.ts` 가 읽는다. 설정 화면에서 넣을 방법도 없다. 정식 필드로 둘지 프로바이더 문서에서 뺄지 정해야 한다.
- **`revokeBotToken` 이 `code` 를 던지는지**: 실패 판별 절은 `revokeBotToken` 도 `BOT_TOKEN_INVALID` 를 실어 던진다고 적었고, 인터페이스와 함수 책임 표는 내부 에러를 흡수해 호출자에 전파하지 않는다고 적었다. 흡수로 정리해 판별 대상에서 뺄지 정해야 한다.
- **`sendMessage` 의 중복 제거 책임**: 옛 규약은 "호출자가 EIA `seq` 와 `X-Clemvion-Delivery` 로 중복을 거른다" 고 적었다. 채널 어댑터는 서버 안 `executionEvents$` 를 받아 웹훅 헤더가 없다. 현재 구현(chat-channel 모듈)에서 해당 헤더 참조는 0건이고 `seq` 는 전달만 된다. 중복 제거는 [채팅 채널 「R-CC-20 인바운드 중복 제거는 전용 서비스로 한다」](CLE-CHAT-CORE.md#r-cc-20-인바운드-중복-제거는-전용-서비스로-한다) 가 인바운드 쪽만 정했다. [채팅 채널](CLE-CHAT-CORE.md) 의 미결 사항과 함께 정해야 한다.
- **`WORKER_HEARTBEAT_TIMEOUT` 등 분류 표에 없는 코드**: EIA 는 `execution.failed` 가 `WORKER_HEARTBEAT_TIMEOUT` 을 실을 수 있다고 적었다. 그런데 분류 표에 행이 없어 매번 알 수 없는 코드(`executionFailedInternal` 과 warn 로그)로 처리된다. 이 코드는 stalled 재배달을 모두 소진한 워커 쪽 최종 실패다([장애 복구와 안전 종료 「운영 중 stalled 재배달」](../CLE-EXEC/CLE-EXEC-RECOVERY.md#운영-중-stalled-재배달)). [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 `SUB_WORKFLOW_NOT_FOUND`·`SUB_WORKFLOW_TIMEOUT`·`SUB_WORKFLOW_QUEUE_FAILED`·`EMAIL_HOST_BLOCKED` 도 분류 표에 없어 같은 경로를 탄다. 지금 구현(`execution-failure-classifier.ts`)도 이 다섯 코드를 따로 매핑하지 않는다. 행을 더할지와 어느 키로 보낼지(`SUB_WORKFLOW_TIMEOUT` 은 시간 초과 안내 후보) 정해야 한다.
- **인바운드 서명 자료 참조가 없는 행의 검증 생략**: 1차 범위의 세 채널 프로바이더는 규약상 모두 서명 자료가 필수다. 그런데 지금 구현은 저장된 `inboundSigningRef` 가 없는 행에서 인바운드 서명 검증을 건너뛴다. 현행 동작은 [채팅 채널 데이터와 흐름 §인바운드 서명 자료 참조가 없는 행](CLE-CHAT-DATA.md#인바운드-서명-자료-참조가-없는-행) 에 적었다. 401 로 막을지는 NERV Task `CLE-T-AAGZRW` 가 운영 데이터에서 그런 행 수를 잰 뒤 정한다. 0건이면 401(fail-closed)로 바꾼다. 1건이라도 있으면 현행 유지를 스펙 결정으로 올린다.
- **`render_form` 임시 텍스트의 답변 안내**: 임시 텍스트는 "답변을 메시지로 보내주세요." 로 끝난다. 이 안내를 따른 답은 늘 폼 호출 취소 경로를 탄다([AI 에이전트 노드 「멀티턴」](../CLE-NODE-AI/CLE-NODE-AGENT.md#멀티턴)). LLM 이 취소를 보고 폼을 다시 부르는 반복도 생길 수 있다. 안내 문구를 이 의미에 맞출지 정해야 한다(R-CCA-13 (b)).

## 구현 위치

- `codebase/backend/src/modules/chat-channel/**`
- `codebase/backend/src/modules/chat-channel/types.ts`: 채널 어댑터 인터페이스와 데이터 타입(`InboundInteractionResponse` 포함)
- `codebase/backend/src/modules/hooks/hooks.service.ts`: 인터랙션 기본 응답 적용(`withDefaultInteractionResponse`), 버린 update 의 수신 확인(`ackDroppedUpdateAndIgnore`), 처리한 인터랙션의 `ackInteraction` 호출
- `codebase/backend/src/modules/hooks/hooks.controller.ts`: 인터랙션 응답 본문과 빈 본문의 `200` 전송

관련 후속 계획(미구현): 401/403 message fallback 제거 판정(NERV Task `CLE-T-PDWFV8`), Discord Gateway, Slack Socket Mode, 시각형 SSR PNG.

## Rationale

이 규약의 결정 근거는 주제를 맡은 하위 문서 끝 `Rationale` 에 있다.

| 하위 문서 | Rationale 항목 |
|---|---|
| [인터페이스와 함수 책임](CLE-CHAT-ADAPTER-IFACE.md#rationale) | R1 책임 분리, R2 ack 와 escapeControlText, R-CCA-14 인터랙션 기본 응답과 버린 update 수신 확인 |
| [채널 등록 실패와 토큰 폐기](CLE-CHAT-ADAPTER-SETUP.md#rationale) | R-CCA-9 실패 사유를 code 로 선언, R-CCA-10 이전 봇 토큰 폐기 시점, R-CCA-11 클라이언트 실패 `ok:false` 판정 |
| [이벤트와 데이터 타입](CLE-CHAT-ADAPTER-TYPES.md#rationale) | R3 EiaEvent 를 EIA 에 맡긴다 |
| [이벤트 렌더와 실패 안내](CLE-CHAT-ADAPTER-RENDER.md#rationale) | R-CCA-5 실행 실패 분류 함수, R-CCA-6 ai_conversation 입력 대기, R-CCA-7 renderNode union, R-CCA-12 uiMapping.visualNode, R-CCA-13 render_form 임시 텍스트 |
| [Form 입력 흐름](CLE-CHAT-ADAPTER-FORM.md#rationale) | R4 다단계 질문 강제, R-CCA-8 네이티브 폼 모달 예외 |

다른 문서가 가리키는 항목은 다음과 같다.

### R-CCA-7 renderNode 시그니처를 union 으로 넓혀 내부 이벤트를 받는다

→ [채팅 채널 어댑터 규약 — 이벤트 렌더와 실패 안내](CLE-CHAT-ADAPTER-RENDER.md#r-cca-7-rendernode-시그니처를-union-으로-넓혀-내부-이벤트를-받는다)

### R-CCA-8 네이티브 폼 모달 예외: 필드 5개 이하 모달 하나

→ [채팅 채널 어댑터 규약 — Form 입력 흐름](CLE-CHAT-ADAPTER-FORM.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나)

### R-CCA-10 이전 봇 토큰은 24시간 유예가 끝난 정리 작업이 폐기한다

→ [채팅 채널 어댑터 규약 — 채널 등록 실패와 토큰 폐기](CLE-CHAT-ADAPTER-SETUP.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다)

### R-CCA-12 uiMapping.visualNode 를 세 값으로 바꾼다

→ [채팅 채널 어댑터 규약 — 이벤트 렌더와 실패 안내](CLE-CHAT-ADAPTER-RENDER.md#r-cca-12-uimappingvisualnode-를-세-값으로-바꾼다)

### R-CCA-13 render_form 1차 범위 임시 텍스트와 렌더러 입력 모양

→ [채팅 채널 어댑터 규약 — 이벤트 렌더와 실패 안내](CLE-CHAT-ADAPTER-RENDER.md#r-cca-13-render_form-1차-범위-임시-텍스트와-렌더러-입력-모양)
