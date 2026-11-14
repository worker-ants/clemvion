---
id: "CLE-CHAT-CORE-RENDER"
title: "채팅 채널 — 메시지 발송과 채널 건강도"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-CORE"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-CORE"]
area: "CLE-CHAT"
content_hash: "5bd820334124d28d863263f7c735683fe84cfeaec7d3cbb537f803496805d4f9"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4d7dd47eddb7d67bae42dd8411ea7f93058ac8966e2e6320c16382410ac50dca"
etag: "sha256-b8803aad0869de3dafef56b8828ec664ff844b995f76f7c1a046054fcaa8fea7"
---
## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 의 하위 문서로 실행 이벤트를 채팅 채널 메시지로 바꿔 보내는 규칙(노드와 채널 UI 매핑), 외부 API 호출의 재시도, 실행 실패 안내, 채널 건강도와 마지막 오류 필드를 정한다. 함수 계약은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 이 정한다.

## 노드와 채널 UI 매핑

- **AI 메시지와 표시물**: `presentations?: PresentationPayload[]` 는 AI 에이전트가 표시 도구(`render_*`)를 부른 턴에만 실린다([AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md)). 표시 전용 네 가지는 시각형 노드의 1차 범위 fallback 을 다시 쓴다. `render_form` 텍스트는 후속 범위의 네이티브 모달·Mini App 전까지의 임시 정책이다. 디버그 전용 `llmCalls` 는 fanout 에서 지워져 dispatcher 에 오지 않으므로 변환은 `message`·`presentations` 만 쓴다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)).
- **폼 입력**: 폼 모드 조건과 흐름은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 이 정한다. 네이티브 모달은 모달 지원 프로바이더(`supportsNativeForm`), 모든 필드가 모달 수용 타입, 필드 5개 이하, `formMode ≠ multi_step` 일 때만 쓴다(Slack `views.open`, Discord MODAL). 그 밖(Telegram, 6개 이상, 미수용 타입, `multi_step`)은 필드마다 묻는 다단계 질문이다. 틀린 필드만 다시 묻는 동작은 [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) 의 `submit_form` 검증 실패 규칙(실행을 입력 대기로 유지)에 기댄다.
- **시각형 노드**: `visualNode` 는 `"text" | "photo" | "auto"`, 기본 `"auto"` 다. 1차 범위에서 Chart 는 monospace 미니 막대 차트, Table 은 열을 맞춘 monospace 표(행 상한), Carousel 은 카드 N장을 차례로 보낸다. `text` 는 이미지 URL 을 무시한다. 후속 범위에서는 `output.rendered` 스냅샷이 폐기된 뒤라 채널 어댑터가 원본 데이터로 SSR 을 맡는다. 매트릭스는 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 가 정한다. Carousel 카드의 이미지 메시지 발송은 세 프로바이더 모두 현재 텍스트 카드만 보낸다(Telegram·Discord 는 문서 기준 미구현, Slack 은 렌더러 코드 기준). `text` 에서 시각 메시지를 실제로 보내는지는 [미결 사항](#미결-사항) 참조. 버튼 달린 Template 도 이 대상에 넣을지는 [Template 노드 §미결 사항](../CLE-NODE-PRES/CLE-NODE-TEMPLATE.md#미결-사항) 에서 정한다.
- **키보드 힌트**: `phone` → 연락처 공유(`share_contact`)는 미구현이다. Form 의 `validation.preset`(`ValidationPreset`)이 [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 기준 아직 없어 동작하지 않는다.
- **표시 전용 노드 결과**: wire `output` 은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md)(`NodeHandlerOutput`) 전체라 도메인 값은 `output.output` 에 있다. "따로 가공하지 않는다" 는 DB 원문과 같다는 뜻이 아니다. 발행 시점에 자격 증명 패턴이 `***` 로 바뀌므로 `Bearer …` 같은 텍스트는 채팅 채널에서도 가려져 보인다([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md)). AI 메시지의 표시물과 시각형 노드도 같고, `execution.ai_message` 가 이미 받아들인 trade-off 와 같은 방향이다.

## 외부 API 호출과 재시도

대기 간격은 1초, 2초 두 번이고 세 번째 실패 뒤에는 기다리지 않는다. `degraded` 로 바꾸는 원인은 [채널 건강도](#채널-건강도) 가 정하고 모두 자동 비활성화하지 않는다([웹훅 「요구사항」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요구사항), [EIA 알림 웹훅 「재시도와 실패 처리」](../CLE-IX/CLE-EIA-NOTIFY.md#재시도와-실패-처리) 와 같은 정책).

## 실행 실패 안내

`execution.failed` 를 받으면 채널 어댑터는 채널 사용자에게 일반 안내 메시지 1건을 보낸다. 분류 알고리즘과 입력 허용 목록은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 이 정한다. 안내 키 여섯 개의 한국어·영어 기본 문구는 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 정한다.

- 허용 자리표시자는 `{statusCode}` 한 가지다. 정수라서 개인정보나 비밀이 아니다.
- 책임은 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 구분을 따른다. 분류 함수 호출과 문구 합성은 `renderNode`(순수 함수)가 맡고, 발송 재시도와 타임아웃은 `sendMessage`(부수 효과)가 맡는다.
- 안내 발송이 끝내 실패하면 외부 API 호출 실패의 일반 정책에 따라 `chat_channel_health` 가 `degraded` 가 된다. 이때 원인은 `sendMessage` 의 외부 API 호출 실패다. `execution.failed` 를 받은 것 자체는 건강도를 바꾸지 않는다(R-CC-15 (d)).

실행 실패 안내 정책과 채널 어댑터의 외부 API 호출 실패는 뜻이 다르다. 앞쪽의 자원은 실행 결과의 `output.error.code`(엔진·노드 핸들러 결과)이고, 뒤쪽의 자원은 `chat_channel_health`([채널 건강도](#채널-건강도))다.

## 채널 건강도

채널 건강도(`chat_channel_health`)는 채팅 채널의 동작 상태다([용어 사전 — 외부 상호작용과 채널](../CLE-GLOSSARY-IX.md)). `degraded` 가 되는 원인은 아래 넷이고 이 표가 기준이다. 어느 원인도 트리거를 자동으로 비활성화하지 않는다. 다음 성공 때 `healthy` 로 돌아가는 전이는 [채팅 채널 데이터와 흐름 「채널 건강도」](CLE-CHAT-DATA.md#채널-건강도) 가 정한다. 각 원인의 요구사항 번호는 [채팅 채널 「하위 문서」](CLE-CHAT-CORE.md#하위-문서) 에 있다.

| 원인 | 정하는 곳 | `chat_channel_last_error` |
| --- | --- | --- |
| 채널 어댑터 실패(렌더 `renderNode` 실패, 채널 설정 `setupChannel` 실패, 발송 재시도 뒤에도 실패) | [외부 API 호출과 재시도](#외부-api-호출과-재시도)(렌더 실패는 요구사항 줄이 없는 구현 동작) | 그 에러 메시지(1024자에서 자른다). 봇 토큰은 프로바이더 API 클라이언트가 자기 실패 문장에서 지운다(프로바이더 4xx 본문은 그대로). 실패할 때마다 덮어쓴다. 봇 토큰 재발급 API 의 `setupChannel` 실패는 4xx · 5xx 응답으로 돌려주고([봇 토큰 재발급 API](CLE-CHAT-CORE-TOKEN.md#봇-토큰-재발급-api)) 건강도를 바꾸지 않는다 |
| 대화 단위 분당 한도 초과 | [중복 제거와 분당 한도](CLE-CHAT-CORE-GATE.md#중복-제거와-분당-한도) | 서버가 정한 문구 `Inbound rate limit exceeded (N/min)`(한도 값이 낀다). 이미 `degraded` 면 쓰지 않는다 |
| 트리거의 워크플로우가 트리거의 워크스페이스에 없음 | [인바운드 관문 순서](CLE-CHAT-CORE-GATE.md#인바운드-관문-순서) | 서버 고정 문구 `Workflow not found for this trigger`. 이미 `degraded` 면 쓰지 않는다 |
| `/cancel` 의 취소나 입력 대기 실행으로 보내는 재개 명령을 재개 큐에 넣지 못함 | [큐 적재 실패](CLE-CHAT-CORE-INTERACT.md#큐-적재-실패) | 서버 고정 문구(원인 종류를 알 수 있는 짧은 문장, 두 경우가 같다). 이미 `degraded` 면 쓰지 않는다 |

뒤의 셋이 이미 `degraded` 면 쓰지 않는 것은 한도 초과나 큐 적재 실패가 몰릴 때 같은 쓰기를 되풀이하지 않으려는 것이다. 그래서 한도 초과, id 참조 교차 행, 큐 적재 실패가 나중에 와도 `chat_channel_last_error` 는 먼저 `degraded` 가 된 원인의 문구로 남는다. 채널 어댑터 실패는 그때마다 덮어쓴다. 서명 검증 뒤 처리 중 예상하지 못한 오류로 버린 update 는 건강도를 바꾸지 않는다([인바운드 HTTP 응답 계약](CLE-CHAT-CORE-RESPONSE.md#인바운드-http-응답-계약)).

`chat_channel_last_error` 는 트리거 상세를 볼 수 있는 워크스페이스 멤버에게 보이는 진단 필드다. 화면은 이 값을 번역하지 않고 원문으로 보여 준다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md#규칙) 규칙 3). 트리거 응답은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05) 으로 자격 증명 모양만 가리고 그 밖의 원문은 진단을 위해 워크스페이스 멤버에게 보인다. 새로 저장되는 값에는 그 호출에 쓴 봇 토큰이 글자 그대로 남지 않는다. 프로바이더 API 클라이언트가 자기가 만든 실패 문장에서 지운다([채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10). 프로바이더가 돌려준 4xx 본문은 바꾸지 않는다. 한계는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05) 에 있다. 재발급 API 의 에러 응답이 원문을 싣지 않는 것([R-CC-23](CLE-CHAT-CORE-TOKEN.md#r-cc-23-setupchannel-실패는-전송-방식이-아니라-원인으로-분류한다))과의 관계는 [R-CC-26](#r-cc-26-마지막-오류-필드는-프로바이더-원문을-싣고-자격-증명-모양만-가린다) 에 있다. 화면 도움말과 사용자 가이드는 원인을 나열하지 않고 «마지막 오류» 를 가리킨다. 원인이 늘 때마다 화면 문구가 낡지 않게 하려는 것이다.

## 미결 사항

- **`visualNode=text` 에서 시각 메시지 발송 여부**: 시각형 노드 요구사항과 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 매트릭스는 `text` 에서도 Chart·Table·Carousel 을 텍스트로 보낸다고 정한다([채팅 채널 어댑터 규약 「R-CCA-12 uiMapping.visualNode 를 세 값으로 바꾼다」](CLE-CHAT-ADAPTER.md#r-cca-12-uimappingvisualnode-를-세-값으로-바꾼다) 의 (e) 는 "텍스트만" 을 뜻한다). 현재 구현(Telegram 렌더러)은 `visualNode !== 'text'` 일 때만 시각 메시지를 만들어, 버튼 대기에서 `text` 를 고르면 시각 내용이 빠진다. 결정 필요.
- **아웃바운드 `seq` 정렬과 `X-Clemvion-Delivery` 중복 제거**: 옛 스펙 §6 과 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 은 채널 어댑터가 이 둘을 내장한다고 적었다. 채널 어댑터는 서버 안 `executionEvents$` 를 받으므로 웹훅 헤더 `X-Clemvion-Delivery` 가 없고, 데이터 흐름에도 그런 단계가 없다. 현재 구현(chat-channel 모듈)에서 해당 헤더 참조는 0건이고 `seq` 는 전달만 된다. 보장을 지울지 미구현으로 남길지 결정 필요.

## 구현 위치

- `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`, `shared/form-mode.ts`: 실행 실패 분류와 폼 모드 판정
- `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx`, `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`, `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`(채널 건강도와 «마지막 오류» 표시), `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts`

## Rationale

### R-CC-11 uiMapping.visualNode 를 세 값으로 바꾼다

근거는 [채팅 채널 어댑터 규약 「R-CCA-12 uiMapping.visualNode 를 세 값으로 바꾼다」](CLE-CHAT-ADAPTER.md#r-cca-12-uimappingvisualnode-를-세-값으로-바꾼다) 에 있다.

### R-CC-13 Discord 1차 범위는 일반 DM 텍스트 입력을 미룬다

Discord 1차 범위는 Interactions Webhook 만 써서 `MESSAGE_CREATE` 를 받지 못한다([Discord 어댑터 「R-D-3 v1 은 Interactions Webhook 만, Gateway 는 v2」](CLE-CHAT-DISCORD.md#r-d-3-v1-은-interactions-webhook-만-gateway-는-v2)). 아웃바운드는 `POST /channels/{id}/messages` 로 `execution.ai_message` 와 `presentations[]` 를 보낼 수 있어 AI 메시지와 표시물 요구사항을 모두 만족한다. 인바운드 답장은 (a) `/<prefix> reply <message>` slash command 나 (b) `Reply` 버튼 뒤의 Modal TEXT_INPUT 으로만 가능하고 일반 DM 텍스트는 받지 못한다. 그래서 첫 메시지로 대화를 시작하는 것과 일반 텍스트 답장(대화 매핑 요구사항)을 Discord 는 slash command 와 모달로 채운다. 요구사항 정의는 바꾸지 않는다. 프로바이더가 의무를 채우는 방식의 차이이고 Discord 문서가 유예를 규범으로 적는다. 완전한 자연 대화는 후속 범위의 Gateway 때 해결된다. 요구사항 줄에 "Gateway 없는 프로바이더는 모달·slash 허용" 예외를 넣으면 프로바이더 한계가 시스템 문서로 새어 나온다([Discord 어댑터 「R-D-9 file 필드 한계는 프로바이더 문서에 적고 Form 은 바꾸지 않는다」](CLE-CHAT-DISCORD.md#r-d-9-file-필드-한계는-프로바이더-문서에-적고-form-은-바꾸지-않는다) 와 같은 생각). 1차 범위에 Gateway 를 들이면 앞의 R-D-3 이 든 기각 사유(오래 유지되는 연결 관리)가 그대로 적용된다.

### R-CC-15 실행 실패 안내의 입력과 자리표시자를 허용 목록으로 제한한다

`error.code` 와 `details.statusCode` 만 분류 입력으로 쓰고 자리표시자는 `{statusCode}` 하나만 둔다. 분류 결정과 메시지 본문 두 경로가 모두 허용 목록이 되고, 분류가 enum 이라 `switch` exhaustive check 로 정적 검증된다. `{statusCode}` 는 공개 정보인 정수다.

`error.message` 원문은 URL, query, DB 컬럼명, stack, API 키 일부를 흘릴 수 있다. 대표 사례는 `HTTP_TRANSPORT_FAILED` 의 `"ENOTFOUND api.internal.example.com"` 이다. 문서로 가림을 강제하려면 모든 노드 핸들러 message 를 감사해야 해 현실적이지 않다. `nodeId`·`nodeLabel` 은 작성자가 정한 내부 라벨이라 외부 사용자에게 의미가 없고 구조가 드러난다. `executionId` 는 UUID 라 입력하기 부담스럽고 `traceCode` 는 매핑 테이블이 필요해 후속 검토로 미룬다. 안내의 효용보다 누출 위험이 훨씬 크다. 자세한 정보는 운영자에게 묻고, 운영자는 백엔드 로그에서 원문을 본다.

- (a) 분류 입력 enum 의 기준은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 이고 이 영역은 매핑 규칙만 정한다.
- (b) 알 수 없는 코드를 조용히 넘기지 않는 것은 새 노드 분류가 빠졌을 때 로그에서 바로 알기 위해서다.
- (c) 모르는 자리표시자(`{nodeId}` 등)는 DTO validator 가 등록 때 `400 VALIDATION_ERROR` 로 거부한다. `CustomValidationPipe.flattenErrors` 는 `details[].code` 를 모든 제약 위반에 `INVALID_FIELD` 로 고정하고, validator 의 `UNKNOWN_PLACEHOLDER:<field>:<placeholder>` 문자열을 `details[].message` 에 그대로 넣는다. 그래서 `UNKNOWN_PLACEHOLDER` 는 `details[].message` 접두로만 드러나고 최상위 코드 목록에는 올리지 않는다.
- (d) `chat_channel_health` 는 채팅 채널의 동작 상태이고(원인은 [채널 건강도](#채널-건강도). 이 결정 때는 외부 호출 실패뿐이었고 R-CC-19 · R-CC-25 · R-CC-31 이 원인을 더했다) 실패 안내는 실행 실패 안내라 서로 직교한다. 안내 발송 자체가 끝내 실패하면 외부 호출 실패이므로 `degraded` 가 된다.
- (e) MCP 전용 에러 코드는 아직 없다. 생기면 분류 표에 행과 안내 키를 더하고, 입력 허용 목록은 그대로 쓴다.

### R-CC-16 표시 전용 Presentation 노드와 AI 표시물을 채널로 보낸다

(1) 요구사항(지금의 표시 전용 listener 와 표시 전용 노드 결과 요구사항)을 만들어 `execution.node.completed` 의 표시 전용 완료를 채팅 채널 내부 listener 로 받는다. EIA 알림 웹훅 허용 목록은 그대로라 EIA 클라이언트 SDK 영향이 없다. (2) AI 메시지 요구사항을 보강해 `ai_message` 의 `presentations[]` 를 1차 범위 fallback 으로 차례로 보낸다. 처음에는 표시 전용 네 가지만 대상이었고 [채팅 채널 어댑터 규약 「R-CCA-13 render_form 1차 범위 임시 텍스트와 렌더러 입력 모양」](CLE-CHAT-ADAPTER.md#r-cca-13-render_form-1차-범위-임시-텍스트와-렌더러-입력-모양) 에서 `render_form` 을 더해 다섯 가지가 됐다.

EIA 알림 웹훅 허용 목록에 `node.completed` 를 더하는 안은 EIA 클라이언트 SDK 에 깨지는 변경이라 과하다. 표시 전용 노드에 가짜 `continue` 버튼을 강제하면 본문만 보여 주는 UX 를 막는다. `render_*` 를 별도 이벤트로 보내면 같은 턴의 텍스트와 표시물의 도착 순서가 어긋날 수 있어 한 payload 에 담는다.

- (a) 새 함수 대신 `renderNode(event: EiaEvent | ChatChannelInternalEvent)` 로 시그니처만 넓힌다. 뒤에 생긴 필수 함수 `escapeControlText` 는 프로바이더별 escape 규칙 때문에 인정한 예외다([채팅 채널 어댑터 규약 「R-CCA-7 renderNode 시그니처를 union 으로 넓혀 내부 이벤트를 받는다」](CLE-CHAT-ADAPTER.md#r-cca-7-rendernode-시그니처를-union-으로-넓혀-내부-이벤트를-받는다)).
- (b) 버튼 때문에 입력 대기로 들어간 노드는 버튼 입력 대기 흐름이 처리하므로 미리 걸러 중복 발송을 막는다.
- (c) `render_form` 은 1차 범위에서 폼의 존재조차 알리지 못하면 메시지가 0건이라 임시 텍스트로 보낸다(위 R-CCA-13).
- (d) 텍스트 → presentations[0] → presentations[1] 순서로 하나씩 `await` 한다. 비기능 요구사항의 200ms 는 시작 지연 기준이다.
- (e) 시각형 1차 범위 fallback 은 [Telegram 어댑터](CLE-CHAT-TELEGRAM.md) 매트릭스를 다시 쓰고 후속 범위의 SSR PNG 는 대상이 아니다.
- (f) 발행 함수 `WebsocketService.emitToExecution` 은 커밋 뒤 불리고 그 값이 `executionEvents$` 로 나간다([External Interaction API 「트랜잭션과 발송 순서」](../CLE-IX/CLE-EIA.md#트랜잭션과-발송-순서)). [R8](CLE-CHAT-CORE-LISTENER.md#r8-트리거-단위-listener-정책) 가드가 그대로 적용된다.
- (g) listener 가 늘 뿐 새 sink 는 없다.

### R-CC-17 render_form v1 임시 텍스트와 렌더러 입력 모양

근거는 [채팅 채널 어댑터 규약 「R-CCA-13 render_form 1차 범위 임시 텍스트와 렌더러 입력 모양」](CLE-CHAT-ADAPTER.md#r-cca-13-render_form-1차-범위-임시-텍스트와-렌더러-입력-모양) 에 있다.

### R-CC-26 마지막 오류 필드는 프로바이더 원문을 싣고 자격 증명 모양만 가린다

2026-10-05 결정이다(NERV Task `CLE-T-H0GF4K`). `chat_channel_last_error` 는 채널 어댑터 실패의 원문(프로바이더 응답 포함)을 담는다. 트리거 응답은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05) 으로 자격 증명 모양만 가리고 봇 토큰은 프로바이더 API 클라이언트가 자기 실패 문장에서 지운다([채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 10).

같은 `setupChannel` 실패 원문이 재발급 API 의 에러 응답에는 실리지 않는데(R-CC-23) 최초 설정 · 수정 경로에서는 이 필드에 저장돼 트리거 조회로 보인다. 받는 사람도 이 필드 쪽이 넓다. 트리거 조회는 뷰어도 한다. 그래도 원문을 싣는 근거는 넷이다.

- (a) 대상이 다르다. R-CC-15 는 봇 대화 상대에게 가는 실행 실패 안내를 다루고 실행의 `error.message` 를 그 입력에서 뺐다. R-CC-23 은 재발급 API 의 에러 응답 봉투를 다룬다. 에러 응답 봉투는 고정 `message` 와 `code` 를 싣고 원문은 서버 로그에 둔다([에러 응답과 클라이언트 처리](../CLE-API/CLE-API-ERROR.md)). 이 필드는 요청에 대한 응답이 아니라 비동기 실패의 원인을 뒤에 보여 주는 도메인 진단 필드다. [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) §3.5 가 적은 대로 에러 응답 봉투와 도메인 데이터의 응답 마스킹은 강도와 대상이 다르다.
- (b) 뷰어는 같은 종류의 원문을 이미 본다. 실행 상세도 역할 게이트 없이 노드 에러 원문(프로바이더 응답 포함)을 보여 주고 나가는 시점에 자격 증명 모양만 가린다(같은 문서 §2.1). 이 필드는 같은 사람들에게 같은 종류의 텍스트를 같은 방식으로 내보낸다.
- (c) 이 필드에 들어오는 원문의 출처는 셋이고 어느 것도 내부 호스트를 싣지 않는다. 프로바이더 호출 실패는 클라이언트마다 고정된 API 호스트만 부른 결과다(Slack `slack.com/api`, Discord `discord.com/api/v10`, Telegram `api.telegram.org`. `sendMessage` 는 [채팅 채널 어댑터 규약 「규칙」](CLE-CHAT-ADAPTER.md#규칙) 11 이 정한다). R-CC-15 가 예로 든 `ENOTFOUND api.internal.example.com` 같은 내부 호스트가 나오지 않는다. `setupChannel` 이 프로바이더에 넘기는 콜백 URL 은 트리거 상세에 이미 보이는 공개 웹훅 주소다. 렌더 실패(`renderNode`)와 채널 설정 중 우리 쪽 단계(시크릿 저장, 설정 갱신)의 실패는 우리 코드나 DB 가 만든 원문이라 속성 이름 같은 내부 구조가 실릴 수 있다. 같은 워크스페이스 멤버가 실행 상세에서 보는 종류의 텍스트라 (b) 에 따라 받아들인다. R-CC-25 가 고정 문구를 고른 것은 다른 워크스페이스의 워크플로우를 가리키는 정보(워크스페이스 경계를 넘는 정보)를 막으려는 것이다. 여기 원문은 그 트리거의 워크스페이스 안 정보다.
- (d) 진단 가치가 크다. 프로바이더 에러 코드(`channel_not_found`, `missing_scope`, `not_in_channel` 등)가 사용자가 고칠 수 있는 원인을 알려 준다.

가리는 범위는 자격 증명 모양까지다. 프로바이더 에러 문구와 호스트는 남는다. 기각한 대안: 원인 분류 코드와 고정 문구로 좁히는 안(R-CC-25 방식)은 (d) 를 잃어 고르지 않았다. NERV Task `CLE-T-H0GF4K` 의 점검에서 검토했다.
