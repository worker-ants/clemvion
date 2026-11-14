---
id: "CLE-CHAT-TELEGRAM-UI"
title: "Telegram 어댑터 — 노드 UI 매핑"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-TELEGRAM"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-TELEGRAM"]
area: "CLE-CHAT"
content_hash: "65676b0ccb7db952e7a25d708d7ee2c15187b95ff8a85a48508088c9b31424df"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d2a4bf1662a47e58fb44815325fc1ac9d58cec1af42c13580df198639f6a7a8b"
etag: "sha256-60674ee398dccbd9f07efa0c8921929b20243e3fc3ec2ccfc6c63c311c2ec8dd"
---
## 개요

이 문서는 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 의 하위 문서로 노드 출력과 실행 이벤트를 Telegram UI(메시지 · 인라인 키보드 · 키보드 힌트)로 바꾸는 규칙을 정한다. 멀티턴 AI, 버튼, Form, 시각형 매트릭스, 실행 실패 · 재개 실패 취소 · 표면 불일치 안내가 대상이다. Bot API 호출 매핑, 명령 매핑, 보안, 재시도 · 중복 제거는 부모 문서가 정한다.

시각형 노드 × `visualNode` × 범위(1차·후속) 매트릭스는 이 문서가 기준이고 [Slack 어댑터](CLE-CHAT-SLACK.md)·[Discord 어댑터](CLE-CHAT-DISCORD.md) 가 같은 정책을 쓴다.

## 멀티턴 AI

- `execution.ai_message.message` 를 `sendMessage`(`parse_mode=MarkdownV2`, Bot API 규칙대로 escape)로 보낸다.
- 4096자(Telegram 메시지 한도)를 넘으면 단어·문장 경계로 나눈다. 마지막 조각 전까지 `\n_(continued…)_` 를 붙인다.
- 응답 직전에 `sendChatAction(action=typing)` 을 한 번 보낸다(5초 뒤 자동 만료). `telegram-message.renderer.ts` 의 `renderAiMessage` 가 본문이 있는 `ai_message` 에서 텍스트 앞에 `{ kind: 'typing' }` 메시지를 넣고, 어댑터 `sendMessage` 의 `typing` 분기가 `sendChatAction` 으로 보낸다. 긴 실행 동안 주기적으로 보내는 typing 은 [채팅 채널 「R9 처리 중 메시지는 큐에 쌓지 않고 바로 안내한다」](CLE-CHAT-CORE.md#r9-처리-중-메시지는-큐에-쌓지-않고-바로-안내한다) 의 후속 범위 검토 항목이다.
- 사용자 답장(`text_message`)은 EIA `submit_message` 로 보낸다.

## 버튼

- `buttonConfig.buttons[]` 를 `inline_keyboard` 2차원 배열로 만든다. `uiMapping.buttonLayout` 에 따라 나눈다.
  - `auto`(기본): 라벨 길이 합이 24자 이하인 버튼은 같은 행, 넘으면 새 행.
  - `vertical`: 1열 N행.
  - `horizontal`: 1행 N열(8개까지, 넘으면 줄바꿈).
- `callback_data` 에 `buttonId`(UUID)를 그대로 넣는다. 64바이트 한도 안에 UUID 가 들어간다([R2 callback_data 에 buttonId UUID 를 그대로 넣는다](#r2-callback_data-에-buttonid-uuid-를-그대로-넣는다)).
- `style: 'primary'` 는 ✅ 접두, `'danger'` 는 ⚠️ 접두, 그 밖은 그대로.
- 노드가 시각형이면 시각 메시지를 먼저 보내고 인라인 키보드는 다음 메시지로 붙인다([시각형 매트릭스](#시각형-매트릭스)). 현재 구현은 버튼 달린 Template 도 이렇게 처리한다. [채팅 채널 「노드와 채널 UI 매핑」](CLE-CHAT-CORE.md#노드와-채널-ui-매핑) 의 시각형 요구사항에 Template 을 넣을지는 [Template 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md#미결-사항) 에서 정한다.
- `callback_query` 를 처리하면 다음 순서를 따른다.
  1. EIA `click_button` 요청을 큐에 넣는다. 처리는 기다리지 않는다.
  2. `ackInteraction` 이 `answerCallbackQuery(callback_query_id)` 를 부른다. Telegram 의무이고, 부르지 않으면 모바일 클라이언트에 로딩 표시가 계속 남는다.
  3. `ackInteraction` 이 이어서 원본 메시지를 `editMessageReplyMarkup`(빈 `inline_keyboard`)으로 바꿔 키보드를 지워 중복 클릭을 막는다. `ChannelUpdate.command.messageId` 로 부르고, 메시지 만료(48시간)나 이미 편집된 경우 같은 실패는 로그만 남긴다. `messageId` 가 없으면 부르지 않는다.
  4. 웹훅 HTTP 응답 `202` 를 돌려준다.
- 클릭을 버리면(재도착, 대화 단위 분당 한도 초과, 실행이 입력 대기가 아님, 워크플로우 비활성 등) `ackDroppedUpdate` 가 `answerCallbackQuery(callback_query_id)` 만 부르고 키보드는 남긴다. 사용자가 잠시 뒤 다시 누를 수 있게 하려는 것이다([R7 버린 버튼 클릭에는 answerCallbackQuery 만 보내고 키보드는 남긴다](#r7-버린-버튼-클릭에는-answercallbackquery-만-보내고-키보드는-남긴다)). 호출이 실패해도 로그만 남기고 웹훅 HTTP 응답은 `202` 다. 트리거가 비활성이면 외부 호출을 하지 않으므로 수신 확인도 보내지 않는다. 버리는 경로 여섯 가지는 [부모 문서](CLE-CHAT-TELEGRAM.md#요구사항) 의 보충 설명에 있다.

## Form

Telegram 은 `supportsNativeForm = false`(네이티브 모달 미지원, Mini App 은 별도 작업)라 늘 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 다단계 질문을 쓴다. 필드 `type` 별 키보드 힌트는 다음과 같다.

| `field.type`([Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md)) | Telegram 키보드 |
|---|---|
| `text`·`textarea`·`email` | `force_reply`(기본 입력) |
| `number` | `reply_keyboard` 숫자 패드(1~0 과 ".") |
| `select`·`radio` | `inline_keyboard` 로 선택지 노출(버튼과 같은 방식) |
| `checkbox` | 다중 선택. 선택지마다 `inline_keyboard` 와 완료 버튼 |
| `date` | `force_reply` 와 형식 안내(`YYYY-MM-DD`). 1차 범위는 네이티브 날짜 선택기를 쓰지 않는다 |
| `file` | `force_reply` 뒤 `file_upload` 대기. `allowedMimeTypes` 는 어댑터가 1차 검증한다 |
| `text` + `validation.preset: 'phone'` | `request_contact: true` 버튼(연락처 공유). 받으면 어댑터가 번호를 폼 데이터에 채운다. 미구현(Form 에 preset 이 아직 없다). preset 없는 일반 `text` 는 첫 행처럼 처리한다 |

질문 본문 형식과 서버 쪽 검증 실패 때 그 필드만 다시 묻는 동작은 어댑터 규약을 따른다. 질문 둘째 줄에 쓰는 `field.description` 은 Form 노드의 필드 정의에 없다([Form 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-FORM.md#미결-사항)).

## 시각형 매트릭스

버튼 대기의 `buttonConfig.nodeOutput`, 표시 전용 완료(`execution.node.completed`), AI 표시물(`ai_message.presentations[]`) 세 진입점이 이 매트릭스를 함께 쓴다. 1차 범위는 MarkdownV2 텍스트·monospace 표현이다(의존성 추가 없이 바로 동작). SSR PNG 는 후속 범위다. `visualNode` 값의 뜻은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 을 본다.

| 노드 유형 | `text`(1차·후속 범위) | `photo` 1차 범위 | `photo` 후속 범위 | `auto` 1차 범위 | `auto` 후속 범위 |
|---|---|---|---|---|---|
| `chart` | `output.payload.{title, series, labels}` → monospace 미니 막대 차트(24칸 가로 막대, MarkdownV2 code block, 4096자 넘으면 분할). 입력 모양은 [미결 사항](#미결-사항) 참조 | 텍스트로 대신(warning 로그) | satori SVG → PNG `sendPhoto` | 텍스트(차트는 텍스트가 더 읽기 쉬워 `auto` 도 텍스트 우선) | 텍스트(후속 범위에서도 텍스트 우선) |
| `carousel` | `output.items[]` → 카드를 차례로 보낸다. 이미지 URL 을 무시하고 늘 `sendMessage`(굵은 제목, 설명, `🖼 {imageUrl}` 텍스트 줄). 카드 10장 상한과 "외 N장" | `auto` 1차 범위로 대신(warning 로그) | 카드 1~5장 collage PNG `sendPhoto` 1회 | 현재는 `text` 와 같다(`renderCarouselFallback` 이 모든 카드를 `sendMessage` 로 보내고 이미지 URL 은 `🖼 {url}` 텍스트). 카드별 이미지 URL 이 있으면 `sendPhoto`(caption 은 제목과 설명)로 나누는 것은 미구현. 카드 10장 상한과 "외 N장", 전역 버튼은 마지막 카드 뒤 별도 메시지 | 카드별 분기와 5장 collage PNG 시도 |
| `table` | `output.{rows, columns}` → monospace MarkdownV2 표(열 너비 자동 정렬, 셀 패딩, 헤더 구분선, 행 20개 상한, 16자 넘는 셀 말줄임, code block, 4096자 분할) | 텍스트로 대신(warning 로그) | 표 PNG `sendPhoto` | 텍스트(표도 텍스트 우선) | 텍스트 |
| `template` | `output.rendered` 를 MarkdownV2 escape 해 `sendMessage`(4096자 분할). HTML·Markdown·Text 세 모드 모두 텍스트로 보낸다(1차 범위는 HTML 을 렌더하지 않고 escape 한 평문). HTML·Markdown 서식 렌더는 후속 범위다 | 텍스트로 대신 | HTML → SSR PNG | 텍스트 | HTML → SSR PNG |

표의 필드 경로는 노드가 무엇을 만드는지를 적은 것이고 렌더러가 읽는 순서와 wire 모양은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 시각형 렌더 입력이 정한다. 다만 `chart`·`carousel` 행의 입력 필드(`payload.{title, series, labels}`, `imageUrl`)는 노드 출력과 정의가 갈린다. [미결 사항](#미결-사항) 참조.

- **버튼**: 모든 시각형에서 `buttonConfig.buttons[]` 가 있으면 시각 메시지 다음 메시지로 `inline_keyboard` 를 보낸다. 사용자가 내용을 본 뒤 고르게 하려는 것이다.
- **옛 `text_only`**: 어댑터가 입력 단계에서 `visualNode === "text_only"` 를 `"text"` 로 바꾼다(마이그레이션 전 과도기).

## 실행 실패

`execution.failed` 는 어댑터 규약의 `classifyExecutionFailure(event)` 가 정한 `(key, placeholders)` 로 문구를 찾아 채운 뒤 `sendMessage` 한 번으로 보낸다. 민감 정보 제외는 [채팅 채널 「실행 실패 안내」](CLE-CHAT-CORE.md#실행-실패-안내) 의 요구사항을 따른다.

| 항목 | Telegram 매핑 |
|---|---|
| API 호출 | `POST /bot{token}/sendMessage` 1회. 안내는 한 줄이라 나누지 않는다 |
| 본문 | `languageHints[key]` 에 `{statusCode}` 를 채운 결과. MarkdownV2 escape([R4 MarkdownV2 escape 는 어댑터가 맡는다](#r4-markdownv2-escape-는-어댑터가-맡는다) 의 예약 문자 모두 backslash), `parse_mode: "MarkdownV2"` |
| `reply_markup` | 붙이지 않는다(종결 이벤트라 인터랙션 컨트롤이 없다) |
| `reply_to_message_id` | 붙이지 않는다(1:1 DM) |
| ack | 관계없다(callback 이 아니다) |
| 타임아웃·재시도 | 5초 타임아웃, 총 3회 시도. 끝내 실패하면 `degraded` |

## 멀티턴 재개 실패 취소

멀티턴 AI 대화를 서버 재시작이나 체크포인트 부재로 재개할 수 없으면 엔진이 실행을 `cancelled` 로 표시하고 `execution.cancelled` 에 `error.code`(`RESUME_INCOMPATIBLE_STATE`·`RESUME_CHECKPOINT_MISSING`·`RESUME_FAILED`)를 실어 보낸다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)).

| 항목 | Telegram 매핑 |
|---|---|
| 분기 | `error.code` 가 `RESUME_` 로 시작하면 일반 취소 안내 대신 `languageHints.sessionExpired` 를 보낸다. 그 밖의 취소(사용자 `/cancel` 등)는 일반 취소 안내다 |
| 본문 | `sessionExpired` 문구, MarkdownV2 escape, `sendMessage` 한 번 |
| 이후 | 사용자의 다음 메시지는 새 실행으로 시작한다(`getActiveExecutionStatus` 가 cancelled 를 비활성으로 본다) |

이 안내가 없으면 재개 실패가 채널에 아무 소리 없이 끝난다(DB 만 cancelled 로 바뀐다). AI 에이전트의 정상 재개([실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 의 `_resumeCheckpoint`)가 동작하므로 실제로는 배포 전에 들어간 대기 행, 정보 추출기 노드, 손상된 경우에만 보인다.

## 표면 불일치

인바운드 명령이 현재 대기 노드의 표면과 맞지 않아 재개 명령 발행기가 `STATE_MISMATCH` 로 거부하면(예: Form·버튼 대기 중 자유 텍스트), `HooksService` 가 거부를 흡수하면서 `languageHints.surfaceMismatch` 를 보낸다.

| 항목 | Telegram 매핑 |
|---|---|
| 분기 | 서버 안 전달(`forwardToInteractionService`)이 `STATE_MISMATCH` 를 흡수할 때 `sendSurfaceMismatchNotice` 로 보낸다. 발송 실패는 흡수하고 warn 을 남겨 재시도 루프를 만들지 않는다 |
| 본문 | `surfaceMismatch` 문구(평문). `renderNode` 를 거치지 않으므로 발송 직전 `adapter.escapeControlText`(Telegram 은 `escapeMarkdownV2`)로 escape 한다 |

제어 안내 일곱 개의 escape 규칙은 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다. 예전에는 이 경로가 escape 를 거치지 않아 Telegram 기본 문구에 `\.` 를 미리 넣었고, 그 문구가 Slack·Discord 에서 그대로 보였다. 운영자 덮어쓰기는 등록 검증으로 막았다. 발송 직전 escape 로 근본을 고쳐 기본 문구와 덮어쓰기 모두 평문으로 쓴다.

## 미결 사항

- **`visualNode=text` 의 시각 메시지**: 이 문서의 매트릭스는 `text` 에서도 Chart·Table·Carousel 을 텍스트로 보낸다고 정한다. 현재 구현(`telegram-message.renderer.ts`)은 `visualNode !== 'text'` 일 때만 시각 메시지를 만들어, 버튼 대기에서 `text` 를 고르면 시각 내용이 빠진다. [채팅 채널](CLE-CHAT-CORE.md) 의 미결 사항과 함께 결정 필요.
- **Chart·Carousel 입력 모양**: 매트릭스의 Chart 입력(`output.payload.{title, series, labels}`)과 Carousel 카드 `imageUrl` 이 [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md)(`output.data`, `{ x, y?, series? }[]`)·[Carousel 노드](../CLE-NODE-PRES/CLE-NODE-CAROUSEL.md)(`output.items[].image`) 출력과 다르다. 현재 구현(렌더러)도 `series`·`labels`·`imageUrl` 을 찾는다. [Presentation 노드 공통 §미결 사항](../CLE-NODE-PRES/CLE-NODE-PRES-COMMON.md#미결-사항) 과 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md#미결-사항) 의 미결 사항과 함께 결정 필요.
- **Chart `series` 의 모양 차이**: [Chart 노드](../CLE-NODE-PRES/CLE-NODE-CHART.md#출력-구조) 의 `series` 는 `output.data` 의 포인트마다 붙는 시리즈 이름 문자열이다(긴 형식). Telegram 렌더러가 받는 `series` 는 `{ name?, data? }[]` 배열이라 모양이 다르다. 현재 렌더러(`telegram-message.renderer.ts` 의 `renderChartFallback`)는 `payload.{title, labels, series}` 를 읽는다. `labels` 는 X 값 문자열 배열이고 시리즈마다 `data` 는 인덱스로 `labels` 와 짝을 짓는 숫자 배열이다. 시리즈가 여럿이면 첫 시리즈만 그리고 나머지 시리즈를 생략했다는 안내 줄을 붙인다. 그래서 렌더러의 `series[]` 는 변환 층이나 렌더러가 포인트를 시리즈별로 묶어 만든다. 어느 쪽에서 묶을지는 위 항목에서 렌더러를 노드 출력에 맞추느냐, 변환 층을 두느냐에 따른다.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts`
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`: 처리한 클릭의 수신 확인과 키보드 제거(`ackInteraction`), 버린 클릭의 수신 확인(`ackDroppedUpdate`)

## Rationale

### R2 callback_data 에 buttonId UUID 를 그대로 넣는다

`callback_data` 64바이트 한도 안에 UUID v4(36자)가 넉넉히 들어가 별도 매핑 테이블이 필요 없다. 짧은 id 와 Redis 매핑은 64바이트가 모자라지 않으니 과한 설계다. `callback_data` 에 타임스탬프 같은 메타를 더 넣으면 64바이트가 모자랄 수 있어, 메타는 어댑터가 채널 대화 상태에서 보강한다.

### R3 시각형은 1차 범위에서 텍스트로 보낸다

처음에는 "1차 범위는 Chart 만 PNG, Carousel·Table 은 SSR 인프라가 필요해 후속" 으로 정했다. Chart 는 이미 SVG 렌더가 있어 PNG 변환만 더하면 된다는 근거였다. 이후 1차 범위를 의존성 없이 바로 동작하는 MarkdownV2 텍스트·monospace 표현으로 통일했고([시각형 매트릭스](#시각형-매트릭스)), 백엔드는 차트 SVG 를 만들지 않으므로(노드 출력 스냅샷 폐기) 그 근거도 성립하지 않는다. 이미지 발송(SSR PNG)은 세 시각형 모두 후속 범위로 미룬다. SSR 인프라(headless chromium 이나 satori)는 Send Email 통합 같은 다른 노드에도 영향을 준다.

### R4 MarkdownV2 escape 는 어댑터가 맡는다

LLM 응답은 일반 Markdown 이지만 Telegram MarkdownV2 는 추가 escape(`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`)가 필요하다. 어댑터가 보내기 직전에 escape 한다. 워크플로우 노드는 일반 Markdown 으로 쓰면 되고 채널별 특이점은 어댑터가 흡수한다.

### R7 버린 버튼 클릭에는 answerCallbackQuery 만 보내고 키보드는 남긴다

2026-11-12 결정이다(NERV Task `CLE-T-K8Z2W0`, NERV 질문 `01a1d025-92b9-7782-8c6e-09705b4a117f` 의 사람 답). 그전에는 클릭을 버리는 경로(재도착, 대화 단위 분당 한도 초과, 실행이 입력 대기가 아님, 워크플로우 비활성)에서 `ackInteraction` 을 부르지 않았다. Telegram 클라이언트는 `answerCallbackQuery` 를 받지 못하면 로딩 표시를 시간 초과까지 남긴다. 그래서 버린 클릭에도 `answerCallbackQuery` 를 보낸다.

키보드는 남긴다. 실행이 아직 입력 대기에 닿지 않았거나 분당 한도에 걸린 클릭은 잠시 뒤 다시 누르면 처리될 수 있다. 키보드를 지우면 사용자가 다시 누를 방법이 없다.

수신 확인을 보낼지는 채널 어댑터의 `ackDroppedUpdate` 가 정한다. `HooksService` 는 프로바이더를 가리지 않고 버린 update 마다 이 함수를 부른다. Slack 과 Discord 는 웹훅 HTTP 응답이 수신 확인이라 이 함수가 없다.

비활성 트리거는 예외다. 꺼진 트리거에서는 수신 확인을 포함한 외부 호출을 하지 않는다(NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f` 의 사람 답). 그래서 그 클릭의 진행 표시는 시간 초과까지 남는다.

검토한 다른 선택은 처리한 클릭처럼 키보드까지 지우는 안이다. 다시 누르면 처리될 클릭까지 막혀 택하지 않았다.
