---
id: "CLE-CHAT-CORE-INTERACT"
title: "채팅 채널 — 인터랙션 응답과 명령 실패"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-CORE"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-CORE"]
area: "CLE-CHAT"
content_hash: "9ff3e7b04fd482a5a2f0c305532008964774a22e9c9e49022119bf414efe66c9"
read_as: "approved_fallback"
task: "CLE-T-0JEQRY"
source_paths: []
mirror_sha256: "0ea324be80b352fcb49fb8374b724380ae632bce4a360f86b8e85249f0f67328"
etag: "sha256-f0c13ceefd417b32366df22d9b1d8735391336a71ecb6dda236f2762f19f2889"
---
## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 의 하위 문서로 메신저 인터랙션(버튼 클릭, 모달 제출, 슬래시 명령)의 기본 응답, 실행 없이 버린 update 의 수신 확인, `/cancel` 과 재개 명령을 재개 큐에 넣지 못했을 때의 처리를 정한다. 그 밖의 응답은 [인바운드 HTTP 응답 계약](CLE-CHAT-CORE-RESPONSE.md) 이, 두 선택 함수의 계약은 [채팅 채널 어댑터 규약 「인터랙션 기본 응답과 수신 확인」](CLE-CHAT-ADAPTER.md#인터랙션-기본-응답과-수신-확인) 이 정한다.

## 인터랙션 기본 응답

메신저의 인터랙션은 프로바이더가 3초 안에 정해진 모양의 `200` 응답을 받아야 성공으로 본다. `202` 를 받거나 응답이 늦으면 사용자 화면에 실패 표시가 남는다. 그래서 서명 검증을 통과한 인터랙션에는 처리 경로와 트리거 · 워크플로우 상태에 상관없이 `200` 과 기본 응답으로 답한다. 이 규칙은 `202` 를 적은 다른 규칙(실행 중 안내, 분당 한도 초과, 비활성 트리거, 워크플로우 없음, 비활성 워크플로우, 큐 적재 실패)보다 먼저다. 그 규칙들의 `202` 는 인터랙션이 아닌 update 의 응답이다.

- 인터랙션인지와 기본 응답의 모양은 채널 어댑터의 선택 함수 `defaultInteractionResponse(raw, config)` 가 정한다. 외부 호출이 없는 순수 함수이고 서명 검증 직후 트리거 활성 관문보다 먼저 부른다. 인터랙션이 아니면 값이 없고 그 요청은 지금처럼 `202` 다.
- 처리 경로가 응답을 정하면(Discord 모달 열기 `{ type: 9 }`, Form 모달 제출 결과 `{ type: 4 }`, Slack `{ response_action }`) 그 응답이 먼저다. 그 밖의 경로는 기본 응답을 쓴다.
- 응답 본문은 응답 봉투로 감싸지 않는다. 기본 응답에 본문이 없으면 빈 본문이다.
- `/start` 의 기존 실행 취소 실패는 인터랙션이어도 그 에러로 답한다.
- 서명 검증 전에 끝나는 `401` · `404` · `429`(서명 참조가 없는 트리거의 전역 요청 한도 초과)는 예외다. 기본 응답을 정하기 전에 끝나므로 인터랙션이어도 그 에러로 답한다.
- 처리 중 예상하지 못한 오류로 버린 인터랙션은 기본 응답으로 답한다.

| 프로바이더 · 요청 | 트리거가 활성일 때 | 트리거가 비활성일 때 |
|---|---|---|
| Discord 컴포넌트 클릭(`type: 3`) · 모달 제출(`type: 5`) | `200` `{ type: 6 }`. 처리 경로가 정한 응답이 있으면 그 응답 | `200` `{ type: 6 }` |
| Discord 슬래시 명령(`type: 2`) | `200` `{ type: 4, data: { content, flags: 64 } }`. `help` 는 도움말, 나머지는 `languageHints.commandReceived` | 같다 |
| Discord PING(`type: 1`) | `200` `{ type: 1 }`(핸드셰이크) | `202` ignored |
| Discord 자동완성(`type: 4`) · 알 수 없는 `type` | `202`(기본 응답 없음) | `202` ignored |
| Slack Interactivity(`payload` 필드가 있는 요청) | `200` 빈 본문. 처리 경로가 정한 `{ response_action }` 이 있으면 그 응답 | `200` 빈 본문 |
| Slack 슬래시 명령 | `200` `{ response_type: 'ephemeral', text }`. `help` 는 도움말, 나머지는 `languageHints.commandReceived` | 같다 |
| Slack `url_verification` | `200` `{ challenge }`(핸드셰이크) | `202` ignored |
| Slack Events API | `202` | `202` ignored |
| Telegram 모든 update | `202` | `202` ignored |

Discord 도움말은 `languageHints.help` 가 있으면 그 문구, 없으면 등록한 명령 이름(`languageHints.slashPrefix`, 기본 `workflow`)을 넣은 기본 도움말 네 줄이다. Slack 도움말도 `languageHints.help` 가 있으면 그 문구를 그대로 쓴다(`{prefix}` 를 바꾸지 않는다). 없으면 Discord 와 같은 locale 기본 도움말에 요청의 `command`(앞의 `/` 를 뗀 값, 비었으면 `workflow`)를 넣는다. Slack 은 명령 이름을 앱 manifest 에서 정하므로 `languageHints.slashPrefix` 를 쓰지 않는다. Slack `help` 는 별도 메시지를 보내지 않고 이 응답 하나로 끝난다. Slack 응답의 `text` 는 mrkdwn 으로 렌더되므로 `&` `<` `>` 를 escape 한다. Discord 응답 본문은 escape 하지 않는다. 공통 수신 문구 `languageHints.commandReceived` 의 기본값은 [채팅 채널 데이터와 흐름 「안내 문구 기본값」](CLE-CHAT-DATA.md#안내-문구-기본값) 이 정한다. 프로바이더별 세부는 [Discord 어댑터 「인바운드 응답」](CLE-CHAT-DISCORD.md#인바운드-응답) 과 [Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK.md#인바운드-응답) 이 정한다.

인터랙션으로 새 실행을 시작하면 그 실행에 남기는 `response_code` 는 실제로 보낸 `'200'` 이다. 인터랙션이 아니면 `'202'` 다.

## 버린 update 의 수신 확인

인터랙션 응답과 별개로 활성 트리거에서 update 를 실행 없이 버리면(파싱 결과 없음, 중복 update, 대화 단위 분당 한도 초과, 실행 중이라 입력 대기가 아님, 워크플로우 비활성, 워크플로우 없음, 처리 중 예상하지 못한 오류) 채널 어댑터의 선택 함수 `ackDroppedUpdate(raw, config)` 로 프로바이더에 수신 확인을 보낸다.

- 지금 이 함수가 있는 프로바이더는 Telegram 하나다. 버튼 클릭(`callback_query`)이면 `answerCallbackQuery` 만 보내 버튼의 로딩 표시를 끝낸다. 같은 `callback_query.id` 에는 처리한 클릭의 응답(`ackInteraction`)과 합쳐 한 번만 보낸다([채팅 채널 어댑터 규약 「인터랙션 기본 응답과 수신 확인」](CLE-CHAT-ADAPTER-IFACE.md#인터랙션-기본-응답과-수신-확인)). 인라인 키보드는 지우지 않는다. 사용자가 잠시 뒤 같은 버튼을 다시 누를 수 있어야 하기 때문이다. 그 밖의 update 에는 아무것도 보내지 않는다.
- Discord 와 Slack 은 3초 안의 `200` 응답이 수신 확인이라 이 함수가 없다.
- 수신 확인은 보내기만 하고 끝나기를 기다리지 않아 웹훅 응답을 늦추지 않는다. 실패는 경고 로그만 남기고 HTTP 응답(`202`)은 바뀌지 않는다.
- `/help` 의 도움말 경로와 비활성 트리거에서는 부르지 않는다. 비활성 트리거에서 부르지 않는 것은 비활성 트리거의 외부 호출 금지 때문이다.

근거는 [R-CC-33](#r-cc-33-인터랙션은-어느-경로로-끝나도-기본-응답으로-답하고-버린-클릭에는-수신-확인을-보낸다) 에 있다.

## 큐 적재 실패

큐 적재 실패는 둘이다. `/cancel` 이 부른 `ExecutionsService.stop` 의 `EXECUTION_ENQUEUE_FAILED` 와 내부 신뢰 호출 재개 명령(답장, 버튼 탭, 폼 제출)의 `queued:false` 다. 둘 다 `202 Accepted` 로 답하고, 경고 로그를 남기며, 이미 `degraded` 가 아니면 `chat_channel_health` 를 `degraded` 로 바꾸고 `chat_channel_last_error` 에 고정 문구를 남긴다.

- `running`·`pending` 실행의 취소는 원자 UPDATE 라 큐를 쓰지 않으므로 `/cancel` 의 큐 적재 실패는 입력 대기 실행의 `/cancel` 에서만 생긴다. 이때 채널 대화 상태의 `executionId` 는 그대로 둔다.
- `/cancel` 은 `/start` 와 같이 HTTP 상태가 아닌 에러 코드로 가른다. `INVALID_STATE`·`RESOURCE_NOT_FOUND` 면 그 실행이 이미 끝났거나 지워진 것으로 보고 `executionId` 를 그 실행을 가리킬 때만 비우며 채널 건강도는 바꾸지 않고 `202` 로 답한다. `EXECUTION_ENQUEUE_FAILED` 면 위의 큐 적재 실패다.
- `chat_channel_last_error` 의 고정 문구(원인 종류를 알 수 있는 짧은 문장)는 두 경우가 같다. 문구에는 실행 id 와 트리거 id 를 싣지 않고 경고 로그에만 남긴다.
- `/start` 와 달리 그 update 의 중복 제거 선점을 풀지 않는다. 실행은 입력 대기에 그대로 남으므로 사용자는 같은 명령을 다시 보낼 수 있다. 다시 보낸 명령은 새 update id 로 오므로 중복 제거에 걸리지 않는다.
- 네이티브 폼 모달 제출을 큐에 넣지 못하면 모달 대기(`pendingFormModal`)를 지우지 않고 「양식 작성하기」 버튼을 다시 보낸다. 인터랙션 응답은 폼 제출 결과가 아니라 채널 어댑터의 기본 응답이라 모달만 닫힌다. 사용자는 버튼을 다시 눌러 같은 양식을 다시 낸다.
- 프로바이더별 응답 예외는 이때도 그대로다.
- `healthy` 로 돌아가는 전이는 [채팅 채널 데이터와 흐름 「채널 건강도」](CLE-CHAT-DATA.md#채널-건강도) 가 정한다.

근거는 [R-CC-31](#r-cc-31-cancel-과-재개-명령의-큐-적재-실패는-202-와-degraded-로-답한다) 에 있다.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/types.ts`: 인터랙션 기본 응답 `defaultInteractionResponse` 와 버린 update 의 수신 확인 `ackDroppedUpdate` 선택 함수
- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`: 공통 수신 문구 `COMMAND_RECEIVED_DEFAULTS` 와 Discord · Slack 공용 기본 도움말 `SLASH_HELP_DEFAULTS`
- 프로바이더별: Discord 인터랙션 기본 응답은 `providers/discord/discord-interaction-response.ts`, Slack 인터랙션 기본 응답은 `providers/slack/slack.adapter.ts` 의 `defaultInteractionResponse` 와 슬래시 명령 판정 `providers/slack/slack-update.parser.ts` 의 `readSlackSlashInvocation`, Telegram 버린 클릭의 수신 확인은 `providers/telegram/telegram.adapter.ts` 의 `ackDroppedUpdate`(모두 `codebase/backend/src/modules/chat-channel/` 아래)
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.controller.ts`: 인터랙션 기본 응답 적용(`withDefaultInteractionResponse`, 컨트롤러가 결과의 `providerResponse` 로 보내는 `200` 응답), 버린 update 의 수신 확인(`ackDroppedUpdateAndIgnore`), 폼 모달 제출의 큐 적재 실패 때 버튼 재전송(`reNoiseFormModal`)
- 테스트: `codebase/backend/test/chat-channel-telegram-dropped-callback.e2e-spec.ts`(버린 버튼 클릭의 수신 확인), `codebase/backend/src/modules/hooks/hooks.service.spec.ts`(「인터랙션 기본 응답」, 「버린 update 의 수신 확인」), `codebase/backend/src/modules/hooks/hooks.controller.spec.ts`(인터랙션의 `200` 응답), `codebase/backend/src/modules/chat-channel/providers/discord/discord-interaction-response.spec.ts`, `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.spec.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.spec.ts`

## Rationale

### R-CC-31 /cancel 과 재개 명령의 큐 적재 실패는 202 와 degraded 로 답한다

2026-10-17 결정이다. 사용자가 방식을 정했다.

**그전 동작.** `/cancel` 은 `ExecutionsService.stop` 의 에러를 잡지 않았다. 입력 대기 실행의 취소를 재개 큐에 넣지 못하면 `503` `EXECUTION_ENQUEUE_FAILED` 가 그대로 프로바이더로 나가 R-CC-12 의 `202` 고정 정책에 어긋났다. 내부 신뢰 호출로 보낸 재개 명령은 재개 큐에 넣지 못해도 `InteractionService` 가 에러를 던지지 않는다(`queued:false`). 그래서 응답은 `202` 였지만 로그도 채널 건강도 신호도 남지 않았다.

**결정.** 두 경우 모두 `202` 로 답한다. 경고 로그를 남기고 `chat_channel_health` 를 `degraded` 로 바꾼다. `chat_channel_last_error` 에는 원인 종류를 알 수 있는 짧은 고정 문구를 남긴다. 분당 한도 초과(R-CC-19)와 워크스페이스 불일치(R-CC-25)의 `degraded` 처리와 같은 방식이다. 이미 `degraded` 면 다시 쓰지 않는다. `healthy` 로 돌아가는 규칙은 바꾸지 않는다.

**`503` 대신 `202` 인 이유.** 메신저 프로바이더는 non-2xx 를 받으면 같은 update 를 다시 보낸다([R-CC-12](CLE-CHAT-CORE-RESPONSE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)). 그러면 같은 명령이 되풀이된다. non-2xx 가 이어지면 프로바이더가 웹훅을 끌 수도 있다. 큐 적재 실패는 채널 건강도와 «마지막 오류» 에 드러나고 사용자와 운영자는 트리거 상세에서 그 값을 본다.

**`/start` 를 그대로 두는 이유.** `/start` 의 같은 실패는 지금 규칙대로 에러로 답한다. 이번 결정은 그 규칙을 다시 열지 않았다. `/start` 는 재전송으로 같은 `/start` 를 다시 처리하려고 중복 제거 선점까지 푼다([R-CC-27](CLE-CHAT-CORE-FLOW.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다)). `/cancel` 과 재개 명령은 새 실행을 시작하지 않는다. 실패해도 실행은 입력 대기에 그대로 있고 채널 대화 상태도 그 실행을 가리킨다. 사용자가 같은 명령을 다시 보내면 다시 처리된다.

**중복 제거 선점.** `/start` 와 달리 풀지 않는다. `202` 를 받은 프로바이더는 같은 update 를 다시 보내지 않으므로 풀어도 다시 처리될 update 가 없다. 사용자가 다시 보낸 명령은 새 update id 로 오므로 30초 중복 제거에 걸리지 않는다.

**이미 끝난 실행.** `/cancel` 이 상태를 읽은 뒤 실행이 먼저 끝났거나 지워지면 `stop` 이 `INVALID_STATE` 나 `RESOURCE_NOT_FOUND` 로 거부한다. 이미 끝난 실행을 취소하려 한 것뿐이라 채팅 채널의 이상이 아니다. 그래서 `202` 로 답하고 `degraded` 로 바꾸지 않는다. 판정은 `/start` 와 같이 HTTP 상태가 아닌 에러 코드로 한다.

**고정 문구.** `chat_channel_last_error` 는 워크스페이스 멤버에게 보이는 진단 필드다. 큐 적재 실패는 우리 쪽 인프라의 일시 장애라 사용자가 고칠 원인이 아니다. 그래서 R-CC-25 처럼 원인 종류만 알리는 고정 문구를 쓰고 실행 id 와 트리거 id 는 경고 로그에만 남긴다. 프로바이더 원문을 싣는 채널 어댑터 실패(R-CC-26)와 다른 점이다. 문구 원문은 기존 `degraded` 문구의 관례를 따라 구현에서 정하고 이 문서에는 적지 않는다.

**폼 모달 제출의 큐 적재 실패(2026-11-13).** 네이티브 폼 모달 제출의 재개 명령을 큐에 넣지 못하면 모달 대기를 지우지 않고 「양식 작성하기」 버튼을 다시 보낸다. 검증 실패 때 버튼을 다시 보내는 경로와 같다. HTTP 응답은 채널 어댑터의 기본 응답이다(Discord `{ type: 6 }`, Slack 빈 본문). 그래서 모달만 닫히고 «제출했다» 는 문구는 보이지 않는다. 입력이 실행에 닿지 않았는데 제출 결과로 답하면 사용자는 다시 낼 까닭을 모른다. 모달 대기를 지우면 다시 낼 버튼도 없다. `202` 와 `degraded` 처리는 위 결정 그대로다. 이 경로는 채널 대화 상태를 바꾸지 않으므로 대화 상태의 TTL 도 늘리지 않는다. 여러 단계 폼(`formState`)의 마지막 답변을 큐에 넣지 못한 경우는 이 복구가 없고 `formState` 가 지워진다.

**기각한 대안.**

- (a) `503` 을 그대로 둔다(그전 `/cancel` 동작). 프로바이더가 같은 `/cancel` 을 다시 보내고 non-2xx 가 이어지면 웹훅이 꺼질 수 있다. 실패가 채널 건강도에 남지 않아 운영자가 알 수 없다.
- (b) `degraded` 없이 `202` 로 넘긴다(그전 재개 명령 동작). 사용자의 입력이 실행에 닿지 않았는데 로그도 건강도 신호도 남지 않는다.
- (c) `/start` 처럼 중복 제거 선점을 풀고 `202` 로 답한다. `202` 에는 재전송이 오지 않으므로 풀어도 다시 처리될 update 가 없다.

### R-CC-33 인터랙션은 어느 경로로 끝나도 기본 응답으로 답하고 버린 클릭에는 수신 확인을 보낸다

2026-11-12 결정이다. 사람이 질문 셋(Discord 슬래시 명령의 응답, 비활성 트리거의 인터랙션 응답, Telegram 의 버린 버튼 클릭)에 답했다.

**그전 동작.** 인터랙션의 `200` 응답은 일부 경로에만 있었다. Discord 컴포넌트 클릭 · 모달 제출의 `{ type: 6 }` 은 HooksService 가 Discord 전용 코드로 만들었다. Discord 슬래시 명령과 Slack `block_actions` 는 `202` 와 봉투를 받았다. 트리거가 비활성이면 인터랙션도 `202` 였다. 프로바이더는 이런 응답을 인터랙션 실패로 보고 사용자 화면에 실패 표시를 남긴다. Telegram 은 버린 버튼 클릭에 `answerCallbackQuery` 를 보내지 않아 버튼의 로딩 표시가 시간 초과까지 남았다.

**어댑터 함수로 둔 이유.** 인터랙션인지와 어떤 모양으로 답해야 하는지는 프로바이더가 정한다. HooksService 에 프로바이더 분기를 두면 프로바이더를 더할 때마다 관문 코드를 고쳐야 하고 경로마다 응답을 빠뜨리기 쉽다. 그래서 채널 어댑터에 선택 함수 둘(`defaultInteractionResponse`, `ackDroppedUpdate`)을 두고 HooksService 는 프로바이더를 모른 채 부르기만 한다. `defaultInteractionResponse` 는 외부 호출이 없는 순수 함수라 처리 전에 한 번 구해 두고 어느 경로로 끝나든 그 값을 쓴다. 응답을 보내는 것은 지금처럼 HooksService 와 컨트롤러다. 어댑터가 응답을 직접 보내는 함수(`ackInteraction`)를 기각한 [Discord 어댑터 「R-D-11 컴포넌트와 모달 제출은 어느 경로로 끝나도 type 6 으로 답한다」](CLE-CHAT-DISCORD.md#r-d-11-컴포넌트와-모달-제출은-어느-경로로-끝나도-type-6-으로-답한다) 와 어긋나지 않는다. `ackDroppedUpdate` 는 외부 호출이 있으므로 버리는 자리에서만 부르고 끝나기를 기다리지 않으며 실패를 삼킨다. 분당 한도를 넘은 버튼 클릭이 몰리면 버린 클릭마다 한 번씩 부르므로 프로바이더 호출도 클릭 수만큼 는다. 프로바이더가 이 호출을 거절해도 경고 로그만 남기고 응답과 다른 처리는 막지 않는다. `{ type: 6 }` 은 원본 메시지가 없는 슬래시 명령에 쓸 수 없어 슬래시 명령은 `{ type: 4 }` 로 답한다.

**꺼진 트리거도 인터랙션에 답하는 이유.** 트리거를 꺼도 프로바이더 등록은 남아 update 가 계속 온다([R-CC-29](CLE-CHAT-CORE-LISTENER.md#r-cc-29-트리거를-켜고-끌-때-외부-채널-등록은-건드리지-않는다)). 인터랙션에 `202` 로 답하면 사용자는 버튼을 누르거나 명령을 보낼 때마다 실패 표시를 본다. 봇이 고장 난 것처럼 보이고 사용자는 같은 동작을 되풀이한다. 기본 응답은 외부 호출 없이 HTTP 응답에 실리므로 꺼진 트리거가 프로바이더에 하는 일은 늘지 않는다. 실행을 시작하지 않는 것은 그대로다.

**꺼진 트리거는 외부 호출을 하지 않는다.** 수신 확인과 안내 발송은 봇 토큰으로 프로바이더 API 를 부른다. 트리거를 끈 사용자는 그 봇이 아무것도 보내지 않기를 기대한다. 그래서 꺼진 트리거에서는 HTTP 응답만 돌려주고 프로바이더 API 를 부르지 않는다. 이때 Telegram 버튼 클릭의 로딩 표시는 시간 초과까지 남는다.

**응답 우선순위.** 처리 경로가 정한 응답(모달 열기, 폼 제출 결과, Slack `response_action`)이 먼저이고 없으면 기본 응답이다. 기본 응답은 처리 전에 정하므로 어느 경로로 끝났는지에 따라 문구가 달라지지 않는다. 서명 검증 전에 끝나는 `401` · `404` · `429` 는 기본 응답을 정하기 전에 끝나므로 인터랙션이어도 그 에러로 답한다.

**Slack 슬래시 명령(2026-11-13).** 이 결정 때 남겨 둔 Slack 슬래시 명령의 응답도 같은 방식으로 정했다(사람 결정). 3초 안에 `200` 과 본인에게만 보이는 `{ response_type: 'ephemeral', text }` 로 답한다. 처리 경로와 트리거 · 워크플로우 상태에 상관없이 같다. Discord 슬래시 명령과 같이 `help` 는 도움말을 싣고 나머지는 공통 수신 문구를 싣는다. `help` 는 실행으로 보내지 않고 별도 메시지도 보내지 않는다. Slack 은 명령 이름을 앱 manifest 에서 정하고 요청마다 `command` 로 보내므로 기본 도움말에는 `languageHints.slashPrefix` 대신 그 값을 넣는다.

**남은 범위.** 새 실행의 시작 안내는 NERV Task `CLE-T-0400J6` 가 다룬다. Discord 와 Slack 의 공통 수신 문구는 그 안내를 대신하지 않는다.

**기각한 대안.**

- (a) 꺼진 트리거에서도 Discord PING · Slack `url_verification` 에 `200` 으로 답하는 안. 꺼진 트리거는 handshake 전에 버린다는 기존 동작([R-CC-28](CLE-CHAT-CORE-GATE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다))을 사람 결정이 그대로 두었다. handshake 는 사용자의 인터랙션이 아니라 실패 표시가 남지 않는다.
- (b) 버린 버튼 클릭의 인라인 키보드를 지우는 안(`editMessageReplyMarkup`). 한도 초과나 실행 중이라 버린 클릭은 잠시 뒤 다시 누르면 처리될 수 있다. 키보드를 지우면 다시 누를 수 없다.
- (c) Discord 슬래시 명령에 지연 응답(`{ type: 5 }`)으로 답하는 안. 사용자 화면에 «생각 중» 표시가 남고 그 표시를 닫으려면 원본 응답 메시지를 따로 고치는 후속 호출이 필요하다. 그 호출을 맡을 자리가 없다.
- (d) 경로마다 다른 문구로 답하는 안(새 실행, 취소, 중복, 한도 초과 등). 기본 응답을 처리 전에 정하는 구조와 맞지 않고 경로가 늘 때마다 문구도 늘어난다.
