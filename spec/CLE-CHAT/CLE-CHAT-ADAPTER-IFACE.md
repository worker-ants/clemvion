---
id: "CLE-CHAT-ADAPTER-IFACE"
title: "채팅 채널 어댑터 규약 — 인터페이스와 함수 책임"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-ADAPTER"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-ADAPTER"]
area: "CLE-CHAT"
content_hash: "8d5a3ea1d34937553c8ddcfe5c550388aa5451658432efd7da737c5d0bcfb019"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "ec92a37d3e2273b2e9f50b715072566fce3bbdb0f7c938ab3e45d1f849916c7d"
etag: "sha256-d693ed126564f82cce430324c98badda199235d35bbcf6fce34a0bb286a55c97"
---
## 개요

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 하위 문서로 채널 어댑터 인터페이스(`ChatChannelAdapter`)의 함수 시그니처, 함수별 책임, 인터랙션의 웹훅 HTTP 응답과 수신 확인을 정한다. 인터페이스가 쓰는 데이터 타입은 [이벤트와 데이터 타입](CLE-CHAT-ADAPTER-TYPES.md) 이 정한다.

## 채널 어댑터 인터페이스

```typescript
interface ChatChannelAdapter {
  /** 채널 프로바이더 식별자. config.chatChannel.provider 와 1:1. 소문자 kebab-case. */
  readonly provider: string;

  /**
   * 프로바이더가 네이티브 폼 UI(Slack `views.open` 모달, Discord MODAL)를 지원하는가.
   * true 이고 uiMapping.formMode 가 auto·native_modal 이며, 모든 필드가 그 프로바이더의
   * 모달 수용 타입이고 fields.length <= 5 면 네이티브 모달 경로를 탄다.
   * false(Telegram 등)면 늘 다단계 질문이다.
   * 값은 채널 어댑터 구현체가 선언한다. 모달 수용 타입 범위는 프로바이더 문서가 정한다(R-CCA-8, Form 입력 흐름 문서).
   */
  readonly supportsNativeForm: boolean;

  /**
   * 트리거 생성, chatChannel 이 실린 PATCH, 봇 토큰 재발급 때 부른다. 트리거를 켤 때는 부르지 않는다. 외부 메신저의 webhook·long-poll 등록.
   * @returns 채널 어댑터별 setup 결과(예: bot identity). 일부는 config 에 캐시한다.
   */
  setupChannel(config: ChatChannelConfig, callbackUrl: string): Promise<SetupResult>;

  /** 트리거 행을 없앨 때 부른다(트리거 · 워크플로우 · 워크스페이스 삭제, 등록하는 사이 행이 사라졌을 때의 보상). 트리거를 끌 때는 부르지 않는다. 외부 hook 해제. 부분 실패는 허용한다. */
  teardownChannel(config: ChatChannelConfig): Promise<void>;

  /**
   * 외부 메신저 update → 워크플로우 입력. 웹훅 진입점이 부른다.
   * 순수 함수(DB 미접근, 외부 API 미호출). 무시 대상(그룹 대화, 봇 자기 메시지 등)은 null.
   * 외부 API 로 알아내야 하는 정보는 enrichInbound 가 채운다.
   */
  parseUpdate(raw: unknown, config: ChatChannelConfig): Promise<ChannelUpdate | null>;

  /**
   * EIA 이벤트와 채팅 채널 내부 이벤트 → 외부 메신저 메시지. 순수 함수.
   * 단일 sink WebsocketService.executionEvents$ 를 구독하는 ChatChannelDispatcher 가 부른다.
   * 구현체는 event.type 판별 union 으로 나눈다(R-CCA-7, 이벤트 렌더와 실패 안내 문서).
   */
  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]>;

  /** 외부 메신저 API 호출(sendMessage, sendPhoto 등). API 호출 재시도·rate limit·에러 처리 책임. */
  sendMessage(message: ChannelMessage, config: ChatChannelConfig): Promise<SendResult>;

  /**
   * 인터랙션 후처리. HooksService 가 인바운드 명령 처리(interact 호출, /cancel, 새 실행 시작)를 마친 뒤 부른다.
   * 버린 update 에는 부르지 않는다(버린 버튼 탭은 ackDroppedUpdate).
   * Slack·Discord 의 3초 안 수신 확인은 웹훅 HTTP 응답(defaultInteractionResponse)이 맡고 이 함수는 하지 않는다.
   * 할 일이 없으면 빈 구현이어도 된다(Discord). 프로바이더별 동작은 「인터랙션 기본 응답과 수신 확인」 절.
   */
  ackInteraction(update: ChannelUpdate, config: ChatChannelConfig): Promise<void>;

  /**
   * 제어 안내 텍스트를 프로바이더 표면에 맞게 escape 한다. 순수 함수.
   * HooksService 가 renderNode 를 거치지 않고 sendMessage 로 바로 보내는 문구
   * (surfaceMismatch, executionStillRunning, groupChatRefusal, unsupportedMessageKind,
   * help, formValidationFailed, formNextField)에 발송 직전 적용한다.
   *   - telegram → MarkdownV2 escape(escapeMarkdownV2, renderNode 와 같은 규칙)
   *   - slack → mrkdwn escape(<, >, & 만)
   *   - discord → 그대로(렌더러도 escape 하지 않는다)
   * 그래서 languageHints 기본값과 덮어쓰기는 모두 평문으로 쓴다.
   */
  escapeControlText(text: string): string;

  /**
   * (선택) 봇 토큰 재발급과 관련해 이전 토큰을 외부 프로바이더에서 revoke 한다.
   * Slack auth.revoke 처럼 revoke API 가 있는 프로바이더만 구현하고 Telegram·Discord 는 구현하지 않는다(undefined).
   * 호출자는 존재 여부를 type-guard 로 확인하고 실패해도 흐름을 막지 않는다.
   * 호출자는 둘이다(R-CCA-10, 채널 등록 실패와 토큰 폐기 문서).
   *   - 24시간 유예가 끝난 정리 작업(TriggersService.cleanupRotatedChatChannelTokens): v2 참조(bot-token.v2)에 백업해 둔 이전 토큰을 폐기한다.
   *   - 재발급(TriggersService.rotateBotToken): 유예 안에 다시 교체해 v2 백업에서 덮인 토큰을 폐기한다.
   *     교체가 끝까지 성공한 뒤(설정 컬럼 갱신과 감사 기록 뒤)에만 부른다. 덮인 값이 비었거나 지금 토큰·새 토큰과 같으면 부르지 않는다.
   * 재발급이 방금 v2 로 백업한 이전 토큰은 재발급 시점에 폐기하지 않는다.
   * @param oldBotToken 폐기할 봇 토큰 평문. 유예가 끝난 v2 백업이거나 유예 중 재교체로 v2 에서 덮인 값이다.
   * @returns 외부 API 응답과 무관하게 void. 내부 에러는 호출자에 전파하지 않고 흡수한다(logger.warn).
   */
  revokeBotToken?(oldBotToken: string): Promise<void>;

  /**
   * (선택) parseUpdate 가 순수 함수라 부르지 못하는 외부 API 로 update 를 보강한다. 순수 함수가 아니다.
   * HooksService 가 parseUpdate, 인바운드 중복 제거, 분당 한도 검사를 마친 뒤 부른다.
   * Slack 은 file_upload 의 mimeType·filename·urlPrivate 를 files.info 한 번으로 채운다.
   * 받은 update 를 바꾸지 않고 보강한 새 객체를 돌려준다. 보강할 정보가 없는 프로바이더는 구현하지 않는다.
   */
  enrichInbound?(update: ChannelUpdate, config: ChatChannelConfig): Promise<ChannelUpdate>;

  /**
   * (선택) 인터랙션에 3초 안에 200 으로 돌려줄 기본 응답을 만든다. 순수 함수.
   * 프로바이더별 본문은 「인터랙션 기본 응답과 수신 확인」 절. 인터랙션이 아니면 undefined 이고 웹훅 응답은 202 다.
   * HooksService 가 서명 검증 직후, 트리거 활성 관문보다 먼저 부른다. 그래서 트리거가 비활성이어도 이 응답으로 답한다.
   * 경로가 따로 만든 응답 본문(openFormModal 의 httpResponse, buildFormSubmissionResponse)이 있으면 그것이 먼저다.
   * parseUpdate 보다 먼저 불리고 버린 update 에도 답해야 해서 raw body 를 받는다(R-CCA-14).
   */
  defaultInteractionResponse?(raw: unknown, config: ChatChannelConfig): InboundInteractionResponse | undefined;

  /**
   * (선택) 버린 update 의 수신 확인. 순수 함수가 아니다.
   * HooksService 가 update 를 버리는 여섯 경로(파싱 실패, 중복, 분당 한도 초과, 입력 대기가 아닌 실행 중,
   * 워크플로우 비활성, 워크플로우 없음)에서 부른다. 트리거가 비활성일 때는 부르지 않는다.
   * 실패는 HooksService 가 경고 로그만 남기고 삼키며 웹훅 HTTP 응답은 바뀌지 않는다.
   * 파싱하지 못한 update 에도 불러야 해서 raw body 를 받는다(R-CCA-14).
   */
  ackDroppedUpdate?(raw: unknown, config: ChatChannelConfig): Promise<void>;

  /**
   * (선택, supportsNativeForm=true 만) 네이티브 모달을 연다. 타입은 네이티브 모달 타입 절.
   * open_form_modal 명령이 오면 HooksService 가 부른다. modalKind 가 "form"(기본)이면 채널 대화 상태의
   * pendingFormModal(fields, nodeId, title)과 openContext(trigger_id·interaction token)로 모달을 만든다.
   * "reply" 는 AI 답장용 텍스트 입력 하나짜리 모달(Discord)이고 pendingFormModal 없이 fields 를 비워 부른다.
   * Slack 은 views.open 을 부르고 httpResponse 를 비운다. Discord 는 모달을
   * 웹훅 HTTP 응답 본문({ type: 9 })으로 돌려준다(OpenFormModalResult.httpResponse).
   * ackInteraction 에 넣지 않는 이유는 R-CCA-8 (b)(Form 입력 흐름 문서).
   */
  openFormModal?(params: OpenFormModalParams): Promise<OpenFormModalResult>;

  /**
   * (선택, supportsNativeForm=true 만) 모달 제출의 프로바이더 HTTP 응답을 만든다. 순수 함수.
   * EIA submit_form 호출은 HooksService 가 한다. 이 함수는 ack 나 검증 실패 재표시 본문만 만든다.
   */
  buildFormSubmissionResponse?(params: {
    config: ChatChannelConfig;
    validationError?: { field?: string; message: string };
  }): FormSubmissionResult;
}
```

## 함수 책임

| 함수 | 책임 | 부수 효과 | 멱등성 |
|---|---|---|---|
| `setupChannel` | 외부 메신저의 인바운드 hook 등록(Telegram `setWebhook`)과 bot identity 조회. 실패 사유를 `code` 로 선언한다 | 외부 API 호출 1회 이상 | 같은 설정으로 다시 불러도 된다. 뜻은 [setupChannel 멱등의 뜻](CLE-CHAT-ADAPTER-SETUP.md#setupchannel-멱등의-뜻) |
| `teardownChannel` | 외부 메신저의 hook 해제. 부분 실패 허용 | 외부 API 호출 | 멱등 |
| `parseUpdate` | raw body → `ChannelUpdate \| null`. `null` 은 "해석하지 않음" 하나의 뜻이다. 안내 발송 여부는 호출자가 정한다 | 없음 | 순수 |
| `renderNode` | `EiaEvent \| ChatChannelInternalEvent` → `ChannelMessage[]` | 없음 | 순수 |
| `sendMessage` | 외부 API 호출. API 호출 재시도·rate limit 책임 | 외부 API 호출 | 중복 제거 책임 미정([미결 사항](CLE-CHAT-ADAPTER.md#미결-사항)) |
| `ackInteraction` | 인바운드 명령을 처리한 뒤의 인터랙션 후처리. 처리한 Telegram 버튼 탭에는 `answerCallbackQuery` 를 보내고 인라인 키보드를 지운다. 버린 update 에는 부르지 않는다(버린 탭은 `ackDroppedUpdate?`). Slack·Discord 의 3초 안 수신 확인은 웹훅 HTTP 응답(`defaultInteractionResponse?`)이 맡고 이 함수는 하지 않는다. 필수지만 빈 구현이어도 된다(Discord). 프로바이더별 동작은 [인터랙션 기본 응답과 수신 확인](#인터랙션-기본-응답과-수신-확인) | 프로바이더에 따라 외부 API 호출 | 멱등 |
| `escapeControlText` | 제어 안내 텍스트를 프로바이더 표면에 맞게 escape | 없음 | 순수 |
| `revokeBotToken?` | 이전 봇 토큰의 외부 revoke(Slack `auth.revoke`). API 가 없으면 구현하지 않는다. 실패는 흡수한다. 호출자와 시점은 위 주석과 [R-CCA-10](CLE-CHAT-ADAPTER-SETUP.md#r-cca-10-이전-봇-토큰은-24시간-유예가-끝난-정리-작업이-폐기한다) | 프로바이더에 따라 외부 API 호출 | 멱등 |
| `enrichInbound?` | `parseUpdate` 결과를 외부 API 로 보강한다(Slack `files.info` 로 파일 이름·MIME·다운로드 URL). 호출자는 `HooksService` 이고 인바운드 중복 제거와 분당 한도 검사 뒤에 부른다. 보강할 정보가 없으면 구현하지 않는다 | 프로바이더에 따라 외부 API 호출 | 멱등 |
| `defaultInteractionResponse?` | 인터랙션의 3초 안 기본 응답 본문을 raw body 로 만든다. `undefined` 면 `202` 다. 비활성 트리거에도 쓴다([인터랙션 기본 응답과 수신 확인](#인터랙션-기본-응답과-수신-확인)) | 없음 | 순수 |
| `ackDroppedUpdate?` | 버린 update 의 수신 확인을 raw body 로 보낸다. 버리는 여섯 경로에서 부르고 비활성 트리거에서는 부르지 않는다. 실패는 호출자가 삼킨다 | 프로바이더에 따라 외부 API 호출 | 요구하지 않는다(실패해도 결과에 영향이 없다) |
| `openFormModal?` | `form_modal` 버튼 클릭(`open_form_modal` 명령) 때 모달을 연다. Slack 은 `views.open(trigger_id, view)`, Discord 는 웹훅 응답 본문 `{ type: 9 }`. 모달 합성에 채널 대화 상태의 `pendingFormModal.fields` 가 필요해 호출자는 `HooksService` 다. Discord 의 AI 답장 모달(`modalKind: "reply"`)도 이 함수로 열고, 이때는 `pendingFormModal` 없이 부른다 | 외부 API 호출 또는 HTTP 응답 본문 합성 | 멱등 |
| `buildFormSubmissionResponse?` | 모달 제출(`form_submission`)의 HTTP 응답 합성. ack(Slack 빈 200, Discord `{ type: 4 }` ephemeral)나 검증 실패 재표시(Slack `response_action: errors`)만 만든다. 제출을 재개 큐에 넣지 못하면 호출자는 이 함수를 부르지 않고 기본 응답으로 답한다([네이티브 모달 경로](CLE-CHAT-ADAPTER-FORM.md#네이티브-모달-경로)) | 없음 | 순수 |

## 인터랙션 기본 응답과 수신 확인

인터랙션의 웹훅 HTTP 응답과 수신 확인은 세 함수가 나눠 맡는다. `defaultInteractionResponse?` 는 3초 안에 돌려줄 응답 본문을 만들고, `ackInteraction` 은 처리한 인터랙션의 후처리를, `ackDroppedUpdate?` 는 버린 update 의 수신 확인을 한다.

| 프로바이더 | `defaultInteractionResponse?` | `ackInteraction`(처리한 인터랙션) | `ackDroppedUpdate?`(버린 update) |
|---|---|---|---|
| Telegram | 구현하지 않는다. 웹훅 응답은 늘 `202` 다 | 처리한 버튼 탭에 `answerCallbackQuery` 를 보내고 원본 메시지의 인라인 키보드를 지운다 | 본문에 `callback_query.id`(비어 있지 않은 문자열)가 있으면 `answerCallbackQuery` 만 보낸다. 인라인 키보드는 남겨 잠시 뒤 다시 누를 수 있다. 그 밖의 update 에는 아무것도 하지 않는다 |
| Slack | 본문에 문자열 `payload` 필드가 있으면(Interactivity: `block_actions`·`view_submission`) `{}` 를 돌려줘 `200` 빈 본문으로 답한다. 슬래시 명령은 본인에게만 보이는 `{ response_type: 'ephemeral', text }` 다. `help` 하위 명령이면 도움말을, 그 밖의 하위 명령이면 수신 문구를 싣는다. `text` 는 mrkdwn 으로 렌더되므로 `&` `<` `>` 를 escape 한다. `help` 는 실행으로 보내지 않고 이 응답 하나로 끝난다. Events API 와 URL Verification 은 `undefined`(`202`)다 | `response_url` 이 있으면 원본 메시지를 "선택 완료" 문구로 바꾼다 | 구현하지 않는다. 3초 응답이 수신 확인이다 |
| Discord | 컴포넌트·모달 제출은 `{ type: 6 }`, 슬래시 명령은 본인에게만 보이는 `{ type: 4 }`(도움말이나 수신 문구)다. PING, 자동완성, 알 수 없는 `type` 은 `undefined` 다 | 빈 구현 | 구현하지 않는다. 3초 응답이 수신 확인이다 |

- 웹훅 HTTP 응답은 이 순서로 정한다. (1) 경로가 만든 응답 본문(`openFormModal` 의 `httpResponse`, `buildFormSubmissionResponse`), (2) `defaultInteractionResponse?` 의 기본 응답, (3) 그 밖은 `202` 와 `{ data: { executionId } }`. 기본 응답에 `body` 가 있으면 `200` 과 그 본문을 `{ data }` 봉투 없이 보내고, `body` 가 없으면 `200` 빈 본문을 보낸다.
- 트리거가 비활성이면 `HooksService` 는 실행을 시작하지 않고 외부 API 도 부르지 않는다. `defaultInteractionResponse?` 는 외부 호출이 없어 이때도 쓰고, `ackDroppedUpdate?` 는 부르지 않는다.
- 핸드셰이크(Slack URL Verification, Discord PING)는 이 함수들이 아니라 `HooksService` 가 트리거 활성 관문 뒤에서 답한다. 그래서 트리거가 비활성이면 핸드셰이크는 `202` 다.
- 기본 응답이 있는 update 로 새 실행을 시작하면 그 실행의 `response_code` 는 실제로 보낸 응답 코드인 `'200'` 이고, 없으면 `'202'` 다.
- 응답 코드 계약은 [채팅 채널 「인바운드 HTTP 응답 계약」](CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다. 프로바이더별 응답 본문은 각 프로바이더 문서가 정한다. Slack 은 [Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK.md#인바운드-응답), Discord 는 [Discord 어댑터 「인바운드 응답」](CLE-CHAT-DISCORD.md#인바운드-응답) 이다.

### 인터랙션 기본 응답 타입

`defaultInteractionResponse?` 가 돌려주는 타입이다.

```typescript
interface InboundInteractionResponse {
  /**
   * 웹훅 HTTP 응답 본문. 있으면 200 과 이 본문을 { data } 봉투 없이 보낸다(Discord { type: 6 } 등).
   * 없으면 200 빈 본문이다(Slack Interactivity).
   */
  body?: unknown;
}
```

## Rationale

### R1 채널 어댑터 인터페이스의 책임 분리

`parseUpdate`·`renderNode` 는 순수 함수, `setupChannel`·`teardownChannel`·`sendMessage`·`ackInteraction` 은 부수 효과가 있는 함수로 나눈다. 이 분리가 테스트 가능성을 정한다. 순수 함수는 fixture 기반 단위 테스트로, 부수 효과 함수는 HTTP 클라이언트 mock 통합 테스트로 검증한다. Cafe24 메타데이터 규약([Cafe24 operation 메타데이터](CLE-C24-META))과 같은 층 분리다.

### R2 필수 함수에 ack 와 escapeControlText 를 따로 둔다

인터페이스 함수는 최소로 둔다. 함수를 하나 더하면 모든 프로바이더의 계약이 바뀌기 때문이다. 프로바이더 본질이라 공용 순수 helper 로 나누지 못하고 함수 안쪽 분기로도 흡수하지 못하는 동작만 함수로 둔다. 일부 프로바이더만 지원하는 기능은 선택(`?`) 함수로 두어 기존 필수 계약을 바꾸지 않는다([R-CCA-8](CLE-CHAT-ADAPTER-FORM.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나) (b)).

인터랙션 후처리는 프로바이더마다 다르다(Telegram 은 `callback_query` 에 `answerCallbackQuery` 가 의무, Slack 은 `response_url` 로 원본 메시지를 갱신, Discord 는 할 일이 없다). Slack · Discord 의 3초 안 수신 확인은 웹훅 HTTP 응답이 맡으므로 이 함수의 일이 아니다. 그 응답 본문은 선택 함수 `defaultInteractionResponse?` 가 만든다(R-CCA-14). `ackInteraction` 을 따로 두면 프로바이더가 구체 동작을 드러낼 수 있고 빈 구현도 된다. `sendMessage` 에 흡수하면 채널 어댑터마다 `sendMessage` 책임이 늘고, 옵션 플래그로 처리하면 시그니처가 여러 관심사를 섞는다.

`escapeControlText` 도 같은 이유로 따로 둔 순수 함수다. 제어 안내(`/help`, Form 검증 실패, 표면 불일치 등)는 `renderNode` 를 건너뛰고 raw 텍스트를 바로 `sendMessage` 로 보내는데, escape 규칙(Telegram MarkdownV2, Slack mrkdwn, Discord 평문)이 프로바이더마다 달라 발송 직전 escape 가 필요하다. `sendMessage` 에 넣으면 `renderNode` 가 이미 escape 한 출력을 다시 escape 해 이중 escape 가 된다("`renderNode` 출력은 `sendMessage` 가 escape 하지 않는다" 는 계약과 부딪친다). `renderNode` 에 넣으면 그것을 거치지 않는 제어 안내 경로가 escape 를 받지 못한다. 그래서 "발송 직전 raw 텍스트 escape" 만 하는 순수 함수를 인터페이스에 두고 우회 경로 호출자(`hooks.service`)가 명시적으로 쓴다. 위 최소주의의 정당한 예외다. escape 규칙이 프로바이더 본질이라 공용 순수 helper 로 나눌 수 없고, 함수 안쪽 분기로도 흡수할 수 없다.

선택 함수 `enrichInbound?` 도 이 최소주의를 지킨다. Slack 파일 첨부는 `files.info` 외부 호출로 보강해야 하는데, 그 호출을 `parseUpdate` 에 넣으면 순수 함수 계약(규칙 2)이 깨진다. 그래서 외부 API 보강만 떼어 선택 함수로 두었다. 지금은 Slack 만 구현하고, 다른 프로바이더의 필수 계약은 바뀌지 않는다([R-CCA-8](CLE-CHAT-ADAPTER-FORM.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나) (b)). 선택 함수 `defaultInteractionResponse?`·`ackDroppedUpdate?` 도 같은 방식으로 더했다(R-CCA-14).

### R-CCA-14 인터랙션 기본 응답과 버린 update 의 수신 확인은 선택 함수 둘로 둔다

2026-11-12 사람 결정 두 건을 구현하면서 정했다. 하나는 트리거가 비활성이어도 인터랙션에는 인터랙션 응답으로 답하고 외부 호출은 하지 않는다는 결정이다(NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f`). 다른 하나는 버린 Telegram 버튼 탭에 `answerCallbackQuery` 만 보내고 인라인 키보드는 남긴다는 결정이다(NERV 질문 `01a1d025-92b9-7782-8c6e-09705b4a117f`). 출처는 NERV Task `CLE-T-TSEP9G` · `CLE-T-FCBG91` · `CLE-T-K8Z2W0` 이다.

Slack · Discord 는 인터랙션에 3초 안에 정해진 모양으로 답해야 한다. 그 모양이 아니면 사용자 화면에 실패가 뜬다. 모양은 프로바이더마다 달라 공용 helper 로 나눌 수 없다(R2). 이 응답은 인터랙션을 버린 경로와 트리거가 비활성인 경우에도 같아야 한다. 그래서 `parseUpdate` 결과가 아니라 raw body 만 보고 외부 호출 없이 만드는 순수 함수 `defaultInteractionResponse?` 로 둔다. `HooksService` 는 서명 검증 직후, 트리거 활성 관문보다 먼저 이 값을 구한다. 외부 호출이 없으므로 비활성 트리거에서 외부 호출을 하지 않는다는 결정과 맞는다.

Telegram 은 웹훅 응답과 별개로 버튼 탭마다 `answerCallbackQuery` 를 보내야 버튼의 로딩 표시가 사라진다. 버린 탭에도 보내야 하는데 `ackInteraction` 은 처리를 마친 update(`ChannelUpdate`)를 받으므로 파싱하지 못한 update 에는 부를 수 없다. 그래서 버린 경로에서만 부르는 `ackDroppedUpdate?` 를 따로 둔다. 키보드를 남기는 이유는 분당 한도 초과나 실행 중이라 버린 탭을 잠시 뒤 다시 누를 수 있어야 하기 때문이다. 이 함수의 실패는 호출자가 삼키고 웹훅 HTTP 응답은 바꾸지 않는다. 비활성 트리거에서는 부르지 않는다.

두 함수 모두 선택(`?`)이라 다른 프로바이더의 필수 계약은 바뀌지 않는다([R-CCA-8](CLE-CHAT-ADAPTER-FORM.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나) (b)). 지금은 Slack · Discord 가 `defaultInteractionResponse?` 를, Telegram 이 `ackDroppedUpdate?` 를 구현한다.

기각한 대안은 다섯이다.

- Discord 응답 판단을 `HooksService` 의 프로바이더 분기(`discordDeferredUpdateAck`)로 두는 안: 프로바이더 본질이 호출자로 새고 프로바이더를 더할 때마다 분기가 는다. 지금 구현은 이 분기를 지웠다.
- `ackInteraction` 이 응답 본문을 돌려주게 하는 안: 이 함수는 처리를 마친 뒤 부르므로 버린 경로와 비활성 트리거에서는 불리지 않는다. 필수 함수의 시그니처도 모든 프로바이더에서 바뀐다.
- 버린 탭에도 `ackInteraction` 을 부르는 안: Telegram 구현이 키보드를 지운다. 파싱하지 못한 update 에는 `ChannelUpdate` 도 없다.
- 버린 Telegram 탭의 키보드도 지우는 안: 잠시 뒤 다시 누를 수 없다.
- 비활성 트리거에서도 버린 탭에 `answerCallbackQuery` 를 보내는 안: 비활성 트리거에서는 수신 확인을 포함해 외부 호출을 하지 않는다는 결정과 어긋난다.

Slack 슬래시 명령의 기본 응답은 2026-11-13 사람 결정(NERV 질문 `01a1d2f3-e188-7354-8298-243092419a3c`)으로 더했다. 출처는 NERV Task `CLE-T-MGZRRP` 다. Slack 슬래시 명령도 3초 안에 HTTP `200` 을 받아야 사용자 화면에 오류가 보이지 않는다. 전에는 슬래시 명령에 기본 응답이 없어 `202` 로 답했다. 응답 모양은 Discord 슬래시 명령 결정(2026-11-12)을 따랐다. 본인에게만 보이는 메시지(`response_type: 'ephemeral'`)이고 `help` 면 도움말을, 그 밖에는 수신 문구를 싣는다. 이 `text` 는 mrkdwn 으로 렌더되므로 `escapeControlText` 와 같은 규칙으로 escape 한다. Discord 응답 본문은 평문이라 escape 하지 않는다.
