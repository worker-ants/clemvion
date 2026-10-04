---
id: "CLE-GLOSSARY-IX"
title: "용어 사전 — 외부 상호작용과 채널"
type: "convention"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "f466c35a699417c743ebd60093930cc84f9f244bb3a08edfb44db1c8dc589890"
read_as: "approved_fallback"
task: "CLE-T-V22XN8"
source_paths: []
mirror_sha256: "f40290e4a871d09c7c35a6009092ad16bdf95c5c12ebc53ab9104efba1e91839"
etag: "sha256-4afbf5aa84c6fa941951ed4e9c35861456fbf98ec46890a0691c28bf9bbb6101"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「외부 상호작용과 채널」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기와 표의 열 순서는 [용어 사전](CLE-GLOSSARY.md) 에 있다. 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| External Interaction API | External Interaction API, EIA, `/api/external/*` | 실행 중인 워크플로우와 외부 시스템이 주고받는 공개 API. 나가는 EIA 알림 웹훅과 들어오는 REST·SSE 두 채널로 되어 있다. 화면 라벨은 "외부 인터랙션" 이다. | 외부 상호작용 API, 외부 표면(이 뜻으로), 트리거-원격 인터랙션 채널 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| EIA 알림 웹훅 | Outbound Notification Webhook, `config.notification` | 실행 이벤트 다섯 종류를 트리거에 등록한 외부 URL 로 HMAC 서명해 보내는 채널. 인앱 알림과 다르다. | notification webhook, outbound notification, 알림(단독) | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 인바운드 인터랙션 | Inbound Interaction | 외부 클라이언트가 REST 로 명령을 보내고 SSE 로 이벤트를 받는 채널. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 인터랙션 명령 | interaction commands | `submit_form`, `click_button`, `submit_message`, `end_conversation`, `cancel`. 앞의 넷은 재개 명령이다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 인터랙션 토큰 | interaction token | EIA 인바운드 요청을 인증하는 토큰. 실행 단위 토큰과 트리거 단위 토큰이 있다. | 없음 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 실행 단위 토큰 | per_execution token, `iext_*` | 실행 하나에만 쓰는 수명이 짧은 JWT. 실행이 끝나면 무효가 된다. | Per Execution(본문), per-execution, 단명 토큰, 위젯 토큰 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 트리거 단위 토큰 | per_trigger token, `itk_*` | 트리거 설정에 저장하는 영구 토큰. | Per Trigger(본문), per-trigger | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 토큰 전략 | `tokenStrategy` | 두 토큰 중 무엇을 쓸지 정하는 트리거 설정. 기본값은 실행 단위다. | 없음 | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 트리거 단위 토큰 재발급 | `revoke-token` | 트리거 단위 토큰을 새로 발급하고 옛 토큰을 바로 무효로 만드는 동작. 엔드포인트 이름과 달리 폐기만 하지 않는다. | 토큰 폐기(이 동작 이름으로) | [External Interaction API](CLE-IX/CLE-EIA.md) |
| 알림 서명 시크릿 | notification signing secret, `wsk_*` | EIA 알림 웹훅의 HMAC 서명 비밀. | signing secret(단독) | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 시크릿 교체 | `rotate-secret` | 알림 서명 시크릿을 새로 발급하고 24시간 유예 동안 두 서명을 함께 싣는 동작. | secret 회전 | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 발송 건강도 | `notification_health` | EIA 알림 웹훅의 발송 상태. 저하돼도 트리거를 끄지 않는다. 값과 화면 라벨은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 없음 | [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md) |
| 멱등 키 | `Idempotency-Key` | 같은 EIA 요청을 다시 보내도 같은 응답을 받게 하는 헤더. 채팅 채널의 중복 제거 키와 다른 장치다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| SSE 재전송 버퍼 | SSE replay buffer | SSE 가 다시 연결될 때 놓친 이벤트를 정한 기간 동안 다시 보내는 버퍼. 채우지 못하면 `execution.replay_unavailable` 을 보낸다. | 5분 이벤트 버퍼 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 내부 신뢰 호출 | `in_process_trusted` | 채팅 채널 어댑터처럼 HTTP 를 거치지 않고 EIA 서비스를 부르는 서버 내부 호출. 토큰 검증을 건너뛴다. | 없음 | [EIA 데이터와 흐름](CLE-IX/CLE-EIA-DATA.md) |
| 실행 토큰 테이블 | `ExecutionToken`, `execution_token` | 발급한 실행 단위 토큰을 실행별로 추적하는 테이블. | 없음 | [EIA 데이터와 흐름](CLE-IX/CLE-EIA-DATA.md) |
| 표시 메시지 이벤트 | `execution.message` | 버튼 없는 Presentation 노드 결과를 SSE 로 알리는 이벤트. AI 응답 이벤트(`execution.ai_message`)와 다르다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 대기 노드 ID | `waitingNodeId` | 입력 대기 중인 노드를 가리키는 wire 필드. 문서의 논리 표기 `node.id` 와 같은 값이다. | 없음 | [EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) |
| 대기 표면 | `WaitingInteractionType` | 입력 대기 노드가 무엇을 기다리는지 나타내는 값. EIA 밖으로 나가는 값이 따로 있다. 값과 본문 표기는 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | interactionType(이 뜻으로 단독), 인터랙션 표면 | [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) |
| 사용자 행동 기록 | `interaction_data.interactionType` | 사용자가 실제로 한 행동(form_submitted, button_click, button_continue). 대기 표면과 이름만 같은 별개 값이다. | interactionType(이 뜻으로 단독) | [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) |
| 인터랙션 유형 레지스트리 | interaction type registry | 여러 계층이 함께 쓰는 인터랙션 값의 단일 목록. | 없음 | [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) |
| 대화 스레드 | ConversationThread | 실행 동안 사용자 인터랙션과 AI 대화를 시간순으로 쌓는 기록. park 할 때 실행에 저장한다. | Conversation Thread, conversation thread, thread(본문) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 대화 기록 항목 | `ConversationTurn` | 대화 스레드에 쌓이는 바뀌지 않는 기록 한 건. AI 대화 턴 하나가 항목 여러 개를 만든다. | turn(이 뜻으로) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 항목 출처 | `ConversationTurnSource` | 대화 기록 항목이 어디서 왔는지 나타내는 값. 화면은 백엔드 값에 두 값을 더한다. 값은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | source(단독) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 사용자 입력 마커 | `[user-input]` | 사용자 텍스트를 감싸 프롬프트 주입을 막는 표시. 화면에서는 지운다. | 마커(단독) | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 출처 접두 | `[from <nodeLabel>]` | LLM 에 보낼 때만 붙이는 노드 출처 표시. | 없음 | [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 채팅 채널 | Chat Channel, `config.chatChannel` | Telegram·Slack·Discord 봇을 웹훅 트리거에 연결해 워크플로우를 대화로 돌리는 기능. 새 트리거 유형이 아니라 웹훅 트리거 설정이다. 화면 라벨은 "Chat Channel" 이다. | 챗 채널, chat channel(본문), Chat Channel(본문), 채널(단독) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 프로바이더 | `provider` | 채팅 채널이 붙는 외부 메신저. 만든 뒤 바꿀 수 없다. 값과 화면 라벨은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | provider(본문 단독) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 어댑터 | `ChatChannelAdapter` | 채널 프로바이더마다 있는 변환·발송 구현. 진입 어댑터·SSE 어댑터와 다르다. | 어댑터(단독), provider 어댑터 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 봇 토큰 | bot token, `botToken`, `botTokenRef` | 채널 봇의 외부 API 자격 증명. 평문은 시크릿 저장소에만 두고 트리거 설정에는 참조만 둔다. | Bot Token(본문), bot token(본문) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 봇 토큰 재발급 | `rotate-bot-token` | 봇 토큰을 바꾸는 유일한 경로. 24시간 유예 동안 옛 토큰도 받는다. | 봇 토큰 회전 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 인바운드 서명 자료 | `inboundSigning` | 메신저 요청의 출처를 확인하는 자료. Telegram 은 서버가 발급하고 Slack·Discord 는 사용자가 입력한다. | signing secret(단독) | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| UI 매핑 | `uiMapping` | 노드 출력을 채널 메시지로 바꾸는 옵션 묶음(폼 모드, 시각형 노드 표시, 버튼 배치). | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 폼 모드 | `uiMapping.formMode` | 채널에서 Form 을 받는 방식. 값과 본문 표기는 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 다단계 텍스트 시퀀스, 다단계 prompt 시퀀스 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 안내 문구 | `languageHints`, `languageLocale` | 봇이 스스로 보내는 안내 메시지와 그 기본 언어. 웹채팅 위젯 언어(`locale`)와 다르다. | 없음 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 건강도 | `chat_channel_health` | 채널 어댑터의 외부 호출 상태. 저하돼도 트리거를 끄지 않는다. 값과 화면 라벨은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 없음 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 채널 대화 상태 | `ChannelConversation` | 채팅방과 진행 중인 실행을 잇는 만료가 있는 Redis 값. 대화 스레드와 다르다. | conversation thread(이 뜻으로), 대화 상태(단독) | [채팅 채널 데이터와 흐름](CLE-CHAT/CLE-CHAT-DATA.md) |
| 대화 키·채널 사용자 키 | `conversationKey`, `channelUserKey` | 채널 안의 대화와 사용자를 구분하는 키. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 채널 업데이트·채널 메시지 | `ChannelUpdate`, `ChannelMessage` | 어댑터의 입력과 출력을 공통 형태로 정한 타입. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 중복 제거 키 | `idempotencyKey` | 메신저가 같은 update 를 다시 보낼 때 짧은 기간 안에 다시 온 것을 거르는 키. EIA 멱등 키와 다르다. | 없음 | [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| 실행 실패 안내 분류 | `classifyExecutionFailure` | 실패 원인을 채널 안내 문구 키 가운데 하나로 고르는 함수. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 제어 안내 | control-plane message | 도움말·그룹 채팅 거절처럼 노드 렌더를 거치지 않고 바로 보내는 봇 안내. | 없음 | [채팅 채널 어댑터 규약](CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| 웹채팅 | Web Chat, `channel-web-chat` | 고객 사이트에 넣는 임베드형 채팅 위젯과 그 SDK·운영 콘솔 전체. 사이드바 메뉴 이름과 같다. | 웹챗, Web Chat(본문), Channel Web Chat, 채팅 위젯 | [웹채팅](CLE-WEBCHAT/CLE-WEBCHAT.md) |
| 웹채팅 위젯 | web chat widget | iframe 안에서 도는 채팅 화면 SPA. | 위젯 SPA, 동봉 위젯, 공개 위젯, 임베드 위젯, 익명 위젯 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 웹채팅 SDK | `@workflow/web-chat`, `ClemvionChat` | 호스트 페이지가 위젯을 넣고 조작하는 SDK. | 위젯 SDK | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 스니펫 로더 | `loader.js` | 설치 스크립트가 불러오는 SDK 파일. | 없음 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| EIA 클라이언트 SDK | `@workflow/sdk` | EIA HTTP·SSE 를 직접 부르는 별도 클라이언트. 웹채팅 SDK 와 다르다. | SDK(단독), headless client | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| 웹채팅 운영 콘솔 | admin console, `/web-chat` | 제품 안에서 웹채팅을 만들고 외형·설치 스크립트·미리보기를 다루는 화면. | admin 콘솔, 콘솔(단독) | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 웹채팅 인스턴스 | web chat instance | 인터랙션이 켜진 웹훅 트리거와 연결 워크플로우 한 쌍. 새 엔티티를 만들지 않는다. | 인스턴스(단독) | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 제어 인스턴스 | `ChatInstance` | SDK `boot()` 가 돌려주는 JS 제어 객체. | 공개 인스턴스 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 부팅 설정 | `BootConfig` | 위젯을 띄울 때 넘기는 설정 객체. 인증 토큰은 넣지 않는다. | boot 옵션 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 외형 | appearance, `config.interaction.appearance` | 운영 콘솔이 저장하는 위젯 색·위치·봇 이름·환영 메시지 같은 표시 설정. 화면 라벨은 "외형 · 콘텐츠" 다. | 외형/콘텐츠 | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 설치 스크립트 | install snippet | 호스트 사이트 `</body>` 앞에 붙이는 설치 코드. 큐 스텁과 로더 두 블록이다. | 설치 스니펫, 스니펫(단독) | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 라이브 미리보기 | live preview | 운영 콘솔 안에서 위젯을 실제로 띄워 대화까지 해 보는 기능. 대화 미리보기와 다르다. | 없음 | [웹채팅 운영 콘솔](CLE-WEBCHAT/CLE-WEBCHAT-CONSOLE.md) |
| 런처·패널 | launcher, panel | 위젯이 접혔을 때의 진입 버튼과 펼쳤을 때의 대화창. | 없음 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 위젯 대화 상태 | widget state | 위젯의 로컬 상태 값(`collapsed`, `panel`, `booting`, `streaming`, `awaiting_user_message`, `ended`, `blocked`). | 없음 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 즉시 시작 | eager start | 패널을 열자마자 실행을 시작하는 방식. | eager 시작 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 새 대화 | new chat, `resetSession` | 현재 대화를 버리고 새 실행을 시작하는 동작. | 새 세션, restart, new chat(본문) | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 대화 종료 | end conversation | 사용자가 위젯 대화를 끝내는 동작. AI 대화를 기다리는 중이면 `end_conversation`, 아니면 `cancel` 을 보낸다. | 채팅 종료 | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 위젯 세션 | widget session | 위젯이 sessionStorage 에 보관하는 대화 한 건(실행 ID·토큰·API 주소). 로그인 세션과 다르다. | 저장 세션, 세션(단독) | [웹채팅 인증과 세션](CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) |
| 임베드 허용 도메인 | `interactionAllowedOrigins` | 위젯을 넣을 수 있는 호스트 origin 이면서 EIA CORS 추가 허용 목록인 워크스페이스 설정. | CORS allowlist, 임베드 allowlist | [웹채팅 보안](CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) |
| 임베드 검증 | embed check, `embed-config` | 위젯이 뜰 때 호스트 origin 을 임베드 허용 도메인과 비교하는 클라이언트 검증. 맞지 않으면 차단(`blocked`) 상태가 된다. | soft 검증 | [웹채팅 보안](CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) |
| 위젯 배포 주소 | widget CDN base | 위젯 SPA 와 로더를 서빙하는 origin. 기본값은 배포 자신의 주소다. | 위젯 CDN(기본 배포를 가리킬 때) | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| 동봉 배포 | co-deploy | 위젯을 제품과 같은 릴리스로 묶어 같은 origin 에서 서빙하는 배포 방식. | 동봉(이 뜻으로 단독) | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| 호스트 페이지 | host page | 위젯을 올리는 고객 웹페이지. | 호스트(단독), 고객 사이트 | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| postMessage 프로토콜 | `wc:*` | 호스트 페이지와 위젯 iframe 사이의 메시지 규약. | 브리지(단독) | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |
| 위젯 고유 문구 | widget chrome | 위젯이 스스로 그리는 UI 문자열. 운영자가 넣은 콘텐츠와 AI 응답은 빠진다. | chrome, 위젯 chrome | [웹채팅 위젯](CLE-WEBCHAT/CLE-WEBCHAT-WIDGET.md) |
| 유휴 실행 회수 | `WEBCHAT_IDLE_TIMEOUT` | 버려진 웹채팅 위젯 실행을, 토큰이 모두 만료되고 유예 시간이 지나면 취소하는 장치. | idle reaper, backstop, B-2 | [웹채팅 인증과 세션](CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md) |
| 사용 모드 | Hosted iframe, BYO-UI | 위젯 iframe 을 쓰는 방식과, 고객이 자기 UI 로 EIA 를 직접 부르는 방식. | M1, M2 | [웹채팅 구조](CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) |
| API 기준 주소 | `apiBase` | 위젯이 EIA 를 부를 서버 주소. | API origin | [웹채팅 SDK](CLE-WEBCHAT/CLE-WEBCHAT-SDK.md) |

## Rationale

2026-10-02 에 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「외부 상호작용과 채널」 절에서 옮겼다. 나눈 이유와 표준을 고른 기준은 그 문서의 Rationale 에 있다.

### 정의 보정 (2026-10-03)

NERV Task `CLE-T-V22XN8` 가 정한 정의 보정을 반영했다.

- 개요의 안내 문단(영역 소개 · 열 순서)과 Rationale 의 분할 설명을 색인을 가리키는 한 줄로 줄였다. 같은 문단이 하위 문서 열 곳에 복사돼 있었다.
- 정의에서 기준 문서의 수치(토큰 수명 · 재전송 기간 · Redis 수명 · 중복 제거 창 · 회수 대기)를 뺐다(색인 표기 원칙 14). 비밀을 함께 받는 기간은 표준 용어 「24시간 유예」 로 부른다.
- 「폼 모드」 · 「대기 표면」 · 「발송 건강도」 · 「채널 건강도」 · 「채널 프로바이더」 · 「항목 출처」: 값 목록을 지우고 색인 「상태값과 enum 표기」 를 가리킨다. 「실행 실패 안내 분류」 는 안내 문구 키의 개수를 지웠다. 키가 늘 때마다 정의가 낡는다. 「사용자 행동 기록」(`interactionType`)은 색인 표에 없는 값이라 목록을 둔다.

### 분할 검토에서 고친 행 (2026-10-02)

- 「유휴 실행 회수」 정의의 「공개 위젯」 은 이 사전이 쓰지 않는 표기라 「웹채팅 위젯」 으로 바꿨다.
