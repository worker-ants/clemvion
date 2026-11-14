---
id: "CLE-CHAT-CORE"
title: "채팅 채널"
type: "feature"
version: 18
status: "approved"
requirements: ["REQ-CHAT-001", "REQ-CHAT-002", "REQ-CHAT-003", "REQ-CHAT-004", "REQ-CHAT-005", "REQ-CHAT-006", "REQ-CHAT-007", "REQ-CHAT-008", "REQ-CHAT-009", "REQ-CHAT-010", "REQ-CHAT-011", "REQ-CHAT-012", "REQ-CHAT-013", "REQ-CHAT-014", "REQ-CHAT-015", "REQ-CHAT-016", "REQ-CHAT-017", "REQ-CHAT-018", "REQ-CHAT-019", "REQ-CHAT-020", "REQ-CHAT-021", "REQ-CHAT-022", "REQ-CHAT-023", "REQ-CHAT-024", "REQ-CHAT-025", "REQ-CHAT-026", "REQ-CHAT-027", "REQ-CHAT-028", "REQ-CHAT-029", "REQ-CHAT-030", "REQ-CHAT-031", "REQ-CHAT-032", "REQ-CHAT-033", "REQ-CHAT-034", "REQ-CHAT-035", "REQ-CHAT-036", "REQ-CHAT-037", "REQ-CHAT-038", "REQ-CHAT-039", "REQ-CHAT-040", "REQ-CHAT-041", "REQ-CHAT-042", "REQ-CHAT-043", "REQ-CHAT-044", "REQ-CHAT-045", "REQ-CHAT-046", "REQ-CHAT-047", "REQ-CHAT-048", "REQ-CHAT-049", "REQ-CHAT-050", "REQ-CHAT-051", "REQ-CHAT-052", "REQ-CHAT-053", "REQ-CHAT-054", "REQ-CHAT-055", "REQ-CHAT-056", "REQ-CHAT-057", "REQ-CHAT-058", "REQ-CHAT-059", "REQ-CHAT-060", "REQ-CHAT-061", "REQ-CHAT-062", "REQ-CHAT-063", "REQ-CHAT-064", "REQ-CHAT-065", "REQ-CHAT-066", "REQ-CHAT-067", "REQ-CHAT-068", "REQ-CHAT-069", "REQ-CHAT-070", "REQ-CHAT-071", "REQ-CHAT-072", "REQ-CHAT-073", "REQ-CHAT-074", "REQ-CHAT-075", "REQ-CHAT-076", "REQ-CHAT-077", "REQ-CHAT-078", "REQ-CHAT-079", "REQ-CHAT-080", "REQ-CHAT-081", "REQ-CHAT-082"]
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "b77845ae026624640404b9f563db9842a24859be3c10b08ec9ec8d6c49e196a1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/7-trigger/providers/_overview.md", "spec/5-system/15-chat-channel.md"]
mirror_sha256: "094648425a234b49abba266877b4af95f2456be4e2acb6fee32410c017b2b001"
etag: "sha256-a231cf746e8dc85408deeb9f086375d5d6d47355435179c324fc19d9c74712fb"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/15-chat-channel.md` (Overview, §3 처리 흐름, §5–§8, Rationale), `spec/4-nodes/7-trigger/providers/_overview.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

채팅 채널(Chat Channel, `config.chatChannel`)은 워크플로우를 Telegram·Slack·Discord 같은 메신저 봇 위에서 챗봇처럼 돌리는 서버 쪽 변환 계층이다. 사용자는 봇 토큰(`botToken`)만 등록한다. update 를 워크플로우 입력으로, 워크플로우 응답을 메신저 메시지로 바꾸는 일은 채널 어댑터(`ChatChannelAdapter`)가 맡는다.

[External Interaction API](../CLE-IX/CLE-EIA.md)(EIA) 는 웹훅 · 알림 웹훅 · REST · SSE 를 제공하지만 메신저와 붙이려면 사용자가 변환 계층을 직접 운영해야 한다. 채팅 채널은 그 계층을 서버 안에 두고 EIA 의 소비자로 격리한 편의 계층이다. 새 트리거 유형 없이 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 트리거의 `config.chatChannel` 옵션 하나로 동작한다.

이 문서는 요구사항 전체를 정하고 세부 동작은 하위 문서가 정한다. 단독으로 쓴 「프로바이더」 는 채널 프로바이더다. 다른 문서가 정하는 주제는 다음과 같다.

- 설정 필드, `languageHints` 기본값, 트리거 컬럼, 대화 상태, Redis 키, 데이터 흐름: [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md)
- 어댑터 함수 계약, 렌더 매핑, 실행 실패 안내 분류 알고리즘, Form 입력 흐름: [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md)
- 메신저별 API 호출 · 명령 · UI 매핑: [Telegram](CLE-CHAT-TELEGRAM.md) · [Slack](CLE-CHAT-SLACK.md) · [Discord](CLE-CHAT-DISCORD.md) 어댑터 문서
- 웹채팅 위젯은 이 모듈을 거치지 않는다([웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md)).

## 요구사항

### 어댑터 라이프사이클

- REQ-CHAT-001 WHEN 웹훅 트리거에 `config.chatChannel` 이 있으면 THE SYSTEM SHALL `provider` 값으로 채널 어댑터를 고른다. (원본: CCH-AD-01)
- REQ-CHAT-002 WHEN 채팅 채널 트리거를 새로 만들거나 `chatChannel` 이 실린 일반 PATCH 를 받으면 THE SYSTEM SHALL 채널 어댑터의 `setupChannel()` 을 자동으로 부른다. (원본: CCH-AD-02)
- REQ-CHAT-003 WHEN 채팅 채널 트리거를 활성화하면(`chatChannel` 이 없는 PATCH 본문 `{ isActive: true }`) THE SYSTEM SHALL 채널 어댑터의 `setupChannel()` 을 부르지 않고 외부 프로바이더의 웹훅 등록과 저장된 봇 토큰 · 인바운드 서명 자료를 그대로 쓴다. (원본: CCH-AD-02) (R-CC-29)
- REQ-CHAT-004 WHEN 채팅 채널 트리거를 삭제하면 THE SYSTEM SHALL 채널 어댑터의 `teardownChannel()` 을 자동으로 부른다. (원본: CCH-AD-03)
- REQ-CHAT-005 WHEN 채팅 채널 트리거를 비활성화하면 THE SYSTEM SHALL 채널 어댑터의 `teardownChannel()` 을 부르지 않고 외부 프로바이더의 웹훅 등록과 트리거 단위 listener 레지스트리 항목을 그대로 둔다. (원본: CCH-AD-03) (R-CC-29)
- REQ-CHAT-070 WHEN 채팅 채널 트리거에 `isActive: true` 가 실린 PATCH 가 커밋되면 THE SYSTEM SHALL 그 트리거를 트리거 단위 listener 레지스트리(코드 `ChannelListenerRegistry`, [R8 트리거 단위 listener 정책](#r8-트리거-단위-listener-정책))에 항목으로 등록해 활성화 뒤 시작한 실행의 메시지를 채팅 채널로 보낸다. (R-CC-29)
- REQ-CHAT-071 WHEN 트리거 생성 · `chatChannel` 이 실린 PATCH · `isActive: true` 가 실린 PATCH · 트리거 행을 없애는 삭제로 트리거 단위 listener 레지스트리에 항목을 등록하거나 해제하면 THE SYSTEM SHALL 그 변경을 Redis pub/sub 채널 `chat-channel:listener` 로 다른 서버 인스턴스에 알려 각 서버 인스턴스의 레지스트리에도 반영한다. 다른 서버 인스턴스에서 받은 변경을 반영할 때와 일괄 등록(REQ-CHAT-072)은 알리지 않는다. (R-CC-30)
- REQ-CHAT-072 WHEN 서버 인스턴스가 시작하거나 `chat-channel:listener` 구독을 확립할 때마다(첫 연결과 다시 연결 모두) THE SYSTEM SHALL 활성 채팅 채널 트리거를 DB 에서 다시 읽어 그 서버 인스턴스의 레지스트리에 등록한다. (R-CC-30)
- REQ-CHAT-073 IF `chat-channel:listener` 의 발행이나 구독이 실패하거나 발행 응답을 2초 안에 받지 못하면 THE SYSTEM SHALL 로그를 남기고 트리거 생성 · 수정 · 삭제 요청을 실패시키지 않는다. (R-CC-30)
- REQ-CHAT-006 WHEN `config.chatChannel` 이 있는 트리거로 `POST /api/hooks/:endpointPath` 요청이 오면 THE SYSTEM SHALL raw body 를 `parseUpdate(raw)` 로 워크플로우 입력으로 바꾸고 `parseUpdate`, 트리거 조회, `202 Accepted` 반환 순서로 처리해 웹훅 200ms 응답 시한을 지킨다. (원본: CCH-AD-04)
- REQ-CHAT-007 WHILE 서버가 동작하는 동안 THE SYSTEM SHALL `ChatChannelDispatcher` 가 단일 sink `WebsocketService.executionEvents$` 를 `onModuleInit` 에서 직접 구독해 `execution.waiting_for_input`·`execution.ai_message`·`execution.completed`·`execution.failed`·`execution.cancelled` 를 `renderNode()` 와 `sendMessage()` 로 넘기게 한다. (원본: CCH-AD-05)
- REQ-CHAT-008 WHEN 메신저에서 인터랙션 응답(답장, 버튼 탭, 다단계 Form 답변)이 오면 THE SYSTEM SHALL EIA HTTP API 를 거치지 않고 `InteractionService.interact(ctx, dto)` 를 서버 안에서 직접 부른다. (원본: CCH-AD-06)
- REQ-CHAT-009 WHEN 표시 전용 Presentation 노드(`carousel`·`table`·`chart`·`template`)가 끝나 `execution.node.completed` 가 발행되면 THE SYSTEM SHALL 채팅 채널 내부 listener 로 그 결과를 받아 채팅 채널로 보낸다. (원본: CCH-AD-07)
- REQ-CHAT-010 IF Presentation 노드가 버튼 때문에 입력 대기(`outputData.status === 'waiting_for_input'`)로 들어갔으면 THE SYSTEM SHALL 그 노드의 `execution.node.completed` 를 걸러 입력 대기 이벤트 흐름으로만 보낸다. (원본: CCH-AD-07)

### 대화 매핑

- REQ-CHAT-011 WHEN 채팅 채널에서 대화가 시작되면 THE SYSTEM SHALL `(provider, conversationKey)` 를 채널 대화 상태 하나에 1:1 로 잇는다. (원본: CCH-CV-01)
- REQ-CHAT-012 WHEN 대화의 첫 메시지나 `/start` 명령이 오면 THE SYSTEM SHALL 채널 대화 상태를 만들고 워크플로우의 새 실행을 시작한다. (원본: CCH-CV-02)
- REQ-CHAT-013 WHEN 같은 대화의 다음 메시지가 오고 활성 실행이 입력 대기(`waiting_for_input`)이면 THE SYSTEM SHALL 그 메시지를 재개 명령으로 전달한다. (원본: CCH-CV-03)
- REQ-CHAT-014 WHEN 같은 대화의 다음 메시지가 오고 활성 실행이 `running` 이나 `pending` 이면 THE SYSTEM SHALL `languageHints.executionStillRunning` 안내를 보내고 update 를 큐에 쌓지 않고 버린 뒤 `202` 로 응답한다. (원본: CCH-CV-03)
- REQ-CHAT-015 WHEN 같은 대화의 다음 메시지가 오고 실행이 `completed`·`failed`·`cancelled` 이거나 대화가 없으면 THE SYSTEM SHALL 새 실행을 시작한다. (원본: CCH-CV-03)
- REQ-CHAT-016 WHEN 채팅 채널 대화를 저장하면 THE SYSTEM SHALL 채널 사용자 키(`channelUserKey`)를 대화 스레드가 아니라 Redis 채널 대화 상태에만 둔다. (원본: CCH-CV-04)
- REQ-CHAT-017 IF group·supergroup·channel 대화의 update 가 오면 THE SYSTEM SHALL `parseUpdate` 가 `null` 을 돌려주게 하고 호출자(`HooksService`)가 `languageHints.groupChatRefusal` 안내를 따로 보낸 뒤 update 를 버린다. (원본: CCH-CV-05)
- REQ-CHAT-062 WHEN 활성 실행(`running`·`pending`·`waiting_for_input`)이 있는 대화에 `/start` 명령이 오면 THE SYSTEM SHALL REQ-CHAT-013·014 의 실행 상태 분기보다 먼저 기존 실행을 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 새 실행을 시작해 채널 대화 상태를 새 실행에 잇는다. (R-CC-27)
- REQ-CHAT-063 IF `/start` 의 기존 실행 취소가 `INVALID_STATE`([에러 코드 규약과 카탈로그 §6.4](../CLE-API/CLE-API-ERRCODES.md#64-유효성-검증), `422`)나 `RESOURCE_NOT_FOUND`(`404`)로 실패하면 THE SYSTEM SHALL 그 실행이 이미 끝났거나 지워진 것으로 보고 취소 없이 새 실행을 시작한다. (R-CC-27)
- REQ-CHAT-064 IF `/start` 의 기존 실행 취소가 그 밖의 에러(취소를 큐에 넣지 못한 `503 EXECUTION_ENQUEUE_FAILED` 등)로 실패하면 THE SYSTEM SHALL 새 실행을 시작하지 않고 그 update 의 중복 제거 선점을 푼 뒤 그 에러로 응답한다. (R-CC-27)
- REQ-CHAT-065 WHEN `execution.completed`·`execution.failed`·`execution.cancelled` 가 오거나 `/cancel` 로 활성 실행을 취소하면 THE SYSTEM SHALL 채널 대화 상태의 `executionId` 가 그 실행을 가리킬 때만 비운다. (R-CC-27)
- REQ-CHAT-069 WHEN 폼 입력 대기(`interactionType=form`)의 `execution.waiting_for_input` 이 오면 THE SYSTEM SHALL 조회한 채널 대화 상태가 그 이벤트의 실행을 가리킬 때만 `pendingFormModal`·`formState` 를 갱신한다. (R-CC-27)

### 노드와 채널 UI 매핑

- REQ-CHAT-018 WHEN `execution.ai_message` 가 오면 THE SYSTEM SHALL 메시지를 프로바이더 길이 한도에 맞춰 나눈 텍스트 메시지 1건 이상으로 보낸다. (원본: CCH-MP-01)
- REQ-CHAT-019 WHEN `execution.ai_message` 의 `presentations[]` 가 비어 있지 않으면 THE SYSTEM SHALL 텍스트 뒤에 표시물마다 1차 범위 fallback 메시지를 하나씩 순서대로 `await` 하며 보내고 `Promise.all` 로 동시에 보내지 않는다. (원본: CCH-MP-01)
- REQ-CHAT-020 WHEN `presentations[*].type === 'form'`(`render_form`)이면 THE SYSTEM SHALL 필드 목록과 답변 안내를 담은 1차 범위 임시 텍스트로 보낸다. (원본: CCH-MP-01)
- REQ-CHAT-021 WHEN 버튼 입력 대기(`interactionType=buttons`)의 `execution.waiting_for_input` 이 오면 THE SYSTEM SHALL 채널 프로바이더의 인라인 키보드로 바꾸고 탭을 `click_button` 명령으로 전달한다. (원본: CCH-MP-02)
- REQ-CHAT-022 WHEN 폼 입력 대기(`interactionType=form`)의 `execution.waiting_for_input` 이 오면 THE SYSTEM SHALL 폼 모드 조건에 따라 네이티브 모달 하나나 다단계 질문으로 입력을 받는다. (원본: CCH-MP-03)
- REQ-CHAT-023 IF Form 제출 검증이 실패하면 THE SYSTEM SHALL 틀린 필드만 다시 묻거나 모달에 에러를 다시 표시한다. (원본: CCH-MP-03)
- REQ-CHAT-024 WHEN 시각형 노드(Carousel·Chart·Table)의 `execution.waiting_for_input` 이 오면 THE SYSTEM SHALL `uiMapping.visualNode` 값에 따라 채팅 채널 메시지로 바꾸고 1차 범위에서는 MarkdownV2 텍스트·monospace 표현으로 보낸다. (원본: CCH-MP-04)
- REQ-CHAT-025 IF 1차 범위에서 `visualNode` 가 `photo` 이면 THE SYSTEM SHALL 텍스트로 대신 보내고 warning 로그를 남기며 채널 건강도(`chat_channel_health`)는 바꾸지 않는다. (원본: CCH-MP-04)
- REQ-CHAT-026 WHEN `visualNode` 가 `auto` 이고 Carousel 카드에 이미지 URL 이 있으면 THE SYSTEM SHALL 그 카드를 이미지 메시지로 보낸다. (원본: CCH-MP-04) (미구현)
- REQ-CHAT-027 WHEN `visualNode` 가 `photo` 나 `auto` 이면 THE SYSTEM SHALL 후속 범위에서 채널 어댑터가 원본 데이터로 만든 SSR PNG 이미지를 보낸다. (원본: CCH-MP-04) (미구현)
- REQ-CHAT-028 WHEN 채팅 채널에서 Form 필드를 물으면 THE SYSTEM SHALL 필드 `type` 에 맞는 키보드 힌트(숫자 키패드, 연락처 공유, 파일 업로드 안내)를 붙이고 해당 키보드가 없으면 일반 텍스트 입력을 쓴다. (원본: CCH-MP-05) (부분 구현)
- REQ-CHAT-029 WHEN 표시 전용 Presentation 노드의 `execution.node.completed` 가 오면 THE SYSTEM SHALL 시각형은 `visualNode` 분기로, Template 은 `output.output.rendered` 텍스트로 채팅 채널 메시지를 보낸다. (원본: CCH-MP-06)
- REQ-CHAT-030 WHEN 노드 결과 텍스트를 채팅 채널로 보내면 THE SYSTEM SHALL 이벤트 발행 단계에서 자격 증명 패턴을 `***` 로 가린 값을 채널 어댑터에서 따로 가공하지 않고 보낸다. (원본: CCH-MP-06)

### 신뢰성과 보안

- REQ-CHAT-031 WHEN 채널 어댑터가 외부 API(`sendMessage` 등)를 부르면 THE SYSTEM SHALL 5초 타임아웃과 지수 백오프로 총 3회까지 시도한다. (원본: CCH-SE-01)
- REQ-CHAT-032 IF 외부 API 호출이 끝내 실패하면 THE SYSTEM SHALL 트리거의 `chat_channel_health` 를 `degraded` 로 바꾸고 트리거를 자동으로 비활성화하지 않는다. (원본: CCH-SE-01)
- REQ-CHAT-033 WHEN 인바운드 update 가 들어오면 THE SYSTEM SHALL 프로바이더 update id 로 만든 중복 제거 키(`idempotencyKey`)가 30초 안에 다시 오면 그 update 를 무시한다. (원본: CCH-SE-02)
- REQ-CHAT-034 IF 중복 제거에 쓰는 Redis 를 쓸 수 없으면 THE SYSTEM SHALL 중복 제거 없이 update 를 통과시킨다. (원본: CCH-SE-02)
- REQ-CHAT-035 WHEN 봇 토큰과 인바운드 서명 자료를 저장하면 THE SYSTEM SHALL `SecretResolver` 가 관리하는 시크릿 저장소에 AES-256-GCM 으로 암호화해 두고 `config.chatChannel` 에는 시크릿 참조(`botTokenRef`·`inboundSigningRef`)만 둔다. (원본: CCH-SE-03)
- REQ-CHAT-036 WHEN 봇 토큰 재발급(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)이 성공하면 THE SYSTEM SHALL 24시간 유예 동안 옛 봇 토큰도 함께 받는다. (원본: CCH-SE-04)
- REQ-CHAT-037 WHEN 봇 토큰 재발급 뒤 24시간이 지나면 THE SYSTEM SHALL 매시간 도는 `ChatChannelTokenRotatorService` 가 백업 참조(`bot-token.v2`)의 시크릿 저장소 행을 지우고 `chat_channel_token_v2`·`chat_channel_rotated_at` 을 NULL 로 만든다. (원본: CCH-SE-04-C)
- REQ-CHAT-060 WHEN 트리거 조회 · 생성 · 수정 응답이 `chatChannelLastError` 를 돌려주면 THE SYSTEM SHALL 저장값은 두고 응답에서 자격 증명 모양을 가린다. (R-CC-26)
- REQ-CHAT-061 IF 프로바이더 API 호출이 실패하면 THE SYSTEM SHALL 클라이언트가 만든 실패 문장을 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 지우고 프로바이더가 돌려준 4xx 본문은 바꾸지 않는다. (R-CC-26)

### 실행 실패 안내

- REQ-CHAT-038 WHEN `execution.failed` 를 받으면 THE SYSTEM SHALL 실행 실패 안내 분류(`classifyExecutionFailure`) 결과 키로 `languageHints[key]` 를 찾아 자리표시자를 채운 텍스트 메시지 1건을 보낸다. (원본: CCH-ERR-01)
- REQ-CHAT-039 IF `languageHints[key]` 가 설정되지 않았으면 THE SYSTEM SHALL `languageLocale` 의 기본 문구를 쓰고 locale 이 없으면 `ko` 를 쓴다. (원본: CCH-ERR-01)
- REQ-CHAT-040 WHEN 실패를 분류하면 THE SYSTEM SHALL `error.code` 와 `error.details.statusCode` 두 필드만 분류 입력으로 쓴다. (원본: CCH-ERR-02)
- REQ-CHAT-041 WHEN 실패 안내를 만들거나 기록하면 THE SYSTEM SHALL `error.message` 원문, `details.url`·`details.endpoint`·`details.query`·`details.stack`, `nodeId`·`executionId`·`workflowId` 를 메시지 본문, `info` 이상 로그, metric 어디에도 넣지 않는다. (원본: CCH-ERR-03)
- REQ-CHAT-042 IF `error.code` 가 분류 표에 없거나 `null` 이면 THE SYSTEM SHALL `executionFailedInternal` 로 안내하고 `level=warn` 구조화 로그를 남긴다. (원본: CCH-ERR-04)
- REQ-CHAT-043 IF 실패 안내 발송이 끝내 실패하면 THE SYSTEM SHALL 추가 안내를 시도하지 않고 로그만 남긴다. (원본: CCH-ERR-05)

### 비기능

- REQ-CHAT-044 WHEN 인바운드 update 를 변환하면 THE SYSTEM SHALL `parseUpdate` 부터 워크플로우 입력까지 평균 50ms 안에 끝낸다. (원본: CCH-NF-01)
- REQ-CHAT-045 WHEN 단일 sink 에서 이벤트를 받으면 THE SYSTEM SHALL 채널 어댑터의 `sendMessage` 호출까지 평균 200ms 안에 끝낸다. (원본: CCH-NF-02)
- REQ-CHAT-046 IF 대화 하나의 인바운드가 분당 한도(`rateLimitPerMinute`, 기본 60, 1–600)를 넘으면 THE SYSTEM SHALL 넘친 update 를 쌓거나 다시 보내지 않고 `202`·`{ executionId: 'ignored' }` 로 건너뛴 뒤 `chat_channel_health` 를 `degraded` 로 바꾼다. (원본: CCH-NF-03)
- REQ-CHAT-047 IF 분당 한도 카운터용 Redis 를 쓸 수 없으면 THE SYSTEM SHALL 한도를 적용하지 않고 정상 처리한다. (원본: CCH-NF-03)

### 봇 토큰과 PATCH

- REQ-CHAT-048 IF PATCH 본문의 `chatChannel.botTokenRef` 나 `chatChannel.botToken` 이 있으면 THE SYSTEM SHALL `400 VALIDATION_ERROR` 로 거부한다. (원본: 15-chat-channel §5.4.1)
- REQ-CHAT-049 IF `chatChannel` 이 없는 트리거에 PATCH 로 `chatChannel` 을 붙이려 하면 THE SYSTEM SHALL `400 VALIDATION_ERROR`(`details.field='chatChannel'`)로 거부한다. (원본: 15-chat-channel §5.4.1.2)
- REQ-CHAT-050 IF PATCH 가 `provider` 를 다른 값으로 바꾸려 하면 THE SYSTEM SHALL `400 VALIDATION_ERROR`(`details.field='provider'`)로 거부한다. (원본: 15-chat-channel §5.4.1.2)
- REQ-CHAT-051 IF PATCH 본문의 `chatChannel.inboundSigningPlaintext` 나 `chatChannel.inboundSigning` 이 있으면 THE SYSTEM SHALL `400 VALIDATION_ERROR` 로 거부한다. (원본: 15-chat-channel §5.4.1.1)
- REQ-CHAT-052 WHEN `chatChannel` 이 실린 PATCH 를 처리하면 THE SYSTEM SHALL 시크릿 저장소의 봇 토큰과 Slack·Discord 인바운드 서명 값을 바꾸지 않는다. (원본: 15-chat-channel §5.4.1, R-CC-21)
- REQ-CHAT-053 WHEN Telegram 트리거의 `setupChannel()` 이 새 `secret_token` 을 발급하면 THE SYSTEM SHALL 그 값을 `inboundSigningRef` 에 다시 저장한다. (원본: 15-chat-channel §5.4.1.1)
- REQ-CHAT-054 WHEN `GET /api/triggers/:id` 가 채팅 채널 설정을 돌려주면 THE SYSTEM SHALL `hasBotToken` 파생 필드만 싣고 `botTokenRef` · `inboundSigningRef` 와 `botToken` 평문은 싣지 않는다. (원본: 15-chat-channel §5.4.2)
- REQ-CHAT-055 IF 봇 토큰 재발급 중 `setupChannel` 이 실패하면 THE SYSTEM SHALL 자격 증명 거부는 `400 BOT_TOKEN_INVALID`, 그 밖은 `502 CHAT_CHANNEL_SETUP_FAILED` 로 돌려주고 프로바이더 원문은 그 에러 응답에 싣지 않는다. (원본: 15-chat-channel §5.4, R-CC-23)
- REQ-CHAT-077 IF 봇 토큰 입력(생성의 `chatChannel.botToken`, 재발급의 `newBotToken`)이 1~256자의 보이는 ASCII(U+0021~U+007E) 문자열이 아니면 THE SYSTEM SHALL 프로바이더를 부르거나 시크릿을 저장하기 전에 400 으로 거부한다(생성 `VALIDATION_ERROR`, 재발급 `INVALID_BOT_TOKEN`). (R-CC-32)
- REQ-CHAT-078 IF 트리거 생성이나 PATCH 본문의 `chatChannel` 에 `botTokenRef` 나 `inboundSigningRef` 가 있으면 THE SYSTEM SHALL 값이 그 트리거의 참조여도 `400 VALIDATION_ERROR` 로 거부한다.

### 인바운드 HTTP

- REQ-CHAT-056 WHEN 채팅 채널 경로의 웹훅 요청을 처리하면 THE SYSTEM SHALL 인증 실패(`401`), 엔드포인트 미존재(`404`), 서명 참조가 없는 채팅 채널 트리거의 전역 요청 한도 초과(`429`, REQ-CHAT-079), 프로바이더별 응답 예외(REQ-CHAT-058 · 080), `/start` 의 기존 실행 취소 실패(REQ-CHAT-064)를 뺀 모든 경우(`/cancel` 과 재개 명령의 큐 적재 실패 REQ-CHAT-074·076, 서명 검증 뒤 처리 중 예상하지 못한 오류 포함)에 `202 Accepted` 로 응답한다. (원본: 15-chat-channel §5.5, R-CC-12, R-CC-27, R-CC-31, R-CC-33)
- REQ-CHAT-057 WHEN 비활성 채팅 채널 트리거에 update 가 오면 THE SYSTEM SHALL 인바운드 서명을 먼저 검증하고 통과하면 실행을 시작하지 않고 외부 호출(수신 확인 포함)도 하지 않은 채 `202`·`{ executionId: 'ignored' }` 로 조용히 버리되 인터랙션(REQ-CHAT-080)에는 `200 OK` 와 채널 어댑터의 기본 응답으로 답한다. (원본: 15-chat-channel §5.5, WH-EP-07, R-CC-33)
- REQ-CHAT-058 IF 프로바이더가 특정 응답 형식만 성공으로 인정하고 그 사유와 응답 본문이 프로바이더 문서에 적혀 있으면 THE SYSTEM SHALL 그 경우에만 `202` 대신 `200 OK` 응답을 허용한다. (원본: 15-chat-channel §5.5.1)
- REQ-CHAT-059 IF 채팅 채널 트리거의 워크플로우가 트리거의 워크스페이스에 없으면 THE SYSTEM SHALL 실행을 만들지 않고 `202`·`{ executionId: 'ignored' }` 로 답하며 이미 `degraded` 가 아니면 `chat_channel_health` 를 `degraded` 로 바꾸고 `chat_channel_last_error` 에 고정 문구를 남긴다.
- REQ-CHAT-066 IF 활성 채팅 채널 트리거의 워크플로우가 비활성(`workflow.is_active=false`)이고 새 실행을 시작할 update(REQ-CHAT-012·015 의 메시지, REQ-CHAT-062 의 `/start`)가 오면 THE SYSTEM SHALL 실행을 시작하지 않고 기존 실행도 취소하지 않으며 `202`·`{ executionId: 'ignored' }` 로 답한다. (R-CC-28)
- REQ-CHAT-067 WHEN 워크플로우가 비활성인 활성 채팅 채널 트리거에 Slack `url_verification` 이나 Discord PING(`type: 1`)이 오면 THE SYSTEM SHALL 서명 검증 뒤 프로바이더별 handshake 응답(`200 OK`)을 돌려준다. (R-CC-28)
- REQ-CHAT-068 WHILE 활성 채팅 채널 트리거의 워크플로우가 비활성인 동안 THE SYSTEM SHALL 활성 실행이 있는 대화의 `/start` 가 아닌 메시지(답장, 버튼, 폼 제출)와 `/cancel`·`/help` 를 워크플로우가 활성일 때와 같이 처리한다. (R-CC-28)
- REQ-CHAT-074 IF `/cancel` 의 활성 실행 취소를 재개 큐에 넣지 못하면(`EXECUTION_ENQUEUE_FAILED`) THE SYSTEM SHALL 채널 대화 상태의 `executionId` 를 그대로 두고 경고 로그를 남기며 이미 `degraded` 가 아니면 `chat_channel_health` 를 `degraded` 로 바꾸고 `chat_channel_last_error` 에 고정 문구를 남긴 뒤 `202 Accepted` 로 응답한다. (R-CC-31)
- REQ-CHAT-075 IF `/cancel` 의 활성 실행 취소가 `INVALID_STATE` 나 `RESOURCE_NOT_FOUND` 로 실패하면 THE SYSTEM SHALL 그 실행이 이미 끝났거나 지워진 것으로 보고 REQ-CHAT-065 대로 `executionId` 를 비우며 채널 건강도는 바꾸지 않고 `202 Accepted` 로 응답한다. (R-CC-31)
- REQ-CHAT-076 IF 입력 대기 실행으로 보내는 재개 명령(답장, 버튼 탭, 폼 제출)을 내부 신뢰 호출로 재개 큐에 넣지 못하면(`queued:false`) THE SYSTEM SHALL 경고 로그를 남기고 이미 `degraded` 가 아니면 `chat_channel_health` 를 `degraded` 로 바꾸고 `chat_channel_last_error` 에 REQ-CHAT-074 와 같은 고정 문구를 남긴 뒤 `202 Accepted` 로 응답한다. 그 명령이 네이티브 폼 모달 제출이면 모달 대기(`pendingFormModal`)를 지우지 않고 양식 버튼을 다시 보내며 폼 제출 결과 응답 대신 채널 어댑터의 기본 응답(REQ-CHAT-080)으로 답한다. (R-CC-31)
- REQ-CHAT-079 WHEN 서명 참조(`inboundSigningRef`)가 저장된 채팅 채널 트리거로 웹훅 요청이 오면 THE SYSTEM SHALL 전역 요청 빈도 제한(`UserThrottlerGuard`)으로 그 요청을 세거나 `429` 로 거부하지 않는다. 서명 참조가 없는 채팅 채널 트리거의 요청은 일반 웹훅 요청과 같이 센다. (R-CC-12)
- REQ-CHAT-080 WHEN 서명 검증을 통과한 요청이 프로바이더가 3초 안의 `200 OK` 만 성공으로 인정하는 인터랙션(채널 어댑터가 기본 응답을 정한 요청)이면 THE SYSTEM SHALL 트리거 · 워크플로우 상태와 처리 경로에 상관없이 `202` 대신 `200 OK` 와 그 기본 응답으로 답하고 처리 경로가 정한 응답(모달 열기, 폼 제출 결과)이 있으면 그 응답을 쓴다. (R-CC-33)
- REQ-CHAT-081 WHEN 활성 채팅 채널 트리거의 update 를 실행 없이 버리면(파싱 결과 없음, 중복 update, 대화 단위 분당 한도 초과, 실행 중이라 입력 대기가 아님, 워크플로우 비활성, 워크플로우 없음, 처리 중 예상하지 못한 오류) THE SYSTEM SHALL 채널 어댑터의 선택 함수 `ackDroppedUpdate` 로 프로바이더에 수신 확인을 보내고 그 실패는 경고 로그만 남겨 HTTP 응답을 바꾸지 않는다. (R-CC-33)
- REQ-CHAT-082 IF 같은 채팅 채널 트리거와 같은 클라이언트 IP 쌍의 인바운드 서명 검증이 60초 고정 창 안에서 20번 `401` 로 실패하면 THE SYSTEM SHALL 그 창이 끝날 때까지 그 쌍의 요청을 시크릿 조회와 서명 계산 없이 `401`(`AUTH_FAILED`)로 거부하고 거부한 요청은 실패로 다시 세지 않는다. (R-CC-34)

## 하위 문서

요구사항 줄은 이 문서에만 있다. 하위 문서가 다루는 요구사항은 아래 번호(`REQ-CHAT-` 뒤 숫자)다.

- [처리 흐름과 대화](CLE-CHAT-CORE-FLOW.md): 시퀀스, 대화와 실행, `/start` 재시작, sink 구독, 보안, EIA 관계. 006–008, 011–017, 044–045, 062–065, 069
- [어댑터 라이프사이클과 listener 레지스트리](CLE-CHAT-CORE-LISTENER.md): 레지스트리 전파, 프로바이더 카탈로그, 호환성. 001–005, 009–010, 070–073
- [메시지 발송과 채널 건강도](CLE-CHAT-CORE-RENDER.md): UI 매핑, 재시도, 실행 실패 안내, 건강도, 미결 사항. 018–032, 038–043, 060–061
- [인바운드 관문](CLE-CHAT-CORE-GATE.md): 관문 순서, 서명 실패 한도, 중복 제거, 분당 한도, 워크플로우 활성 관문. 033–034, 046–047, 059, 066–068, 079, 082
- [인바운드 HTTP 응답 계약](CLE-CHAT-CORE-RESPONSE.md): 응답 코드와 프로바이더별 예외. 056–058
- [인터랙션 응답과 명령 실패](CLE-CHAT-CORE-INTERACT.md): 기본 응답, 수신 확인, 큐 적재 실패. 074–076, 080–081
- [봇 토큰 재발급](CLE-CHAT-CORE-TOKEN.md): 비밀 저장, 재발급 API, 입력 형식, `hasBotToken`. 035–037, 054–055, 077
- [봇 토큰 변경 경로와 PATCH 차단](CLE-CHAT-CORE-PATCH.md): 단일 경로, 차단 필드, 서명 자료 변경. 048–053, 078

## 공통 규칙

- 채팅 채널 경로의 실패는 트리거를 자동으로 비활성화하지 않는다([채널 건강도](CLE-CHAT-CORE-RENDER.md#채널-건강도)).
- 응답 · 로그 · 채팅 메시지에 봇 토큰, 서명 자료, 실행 에러 원문을 싣지 않는다. 예외는 진단 필드 `chat_channel_last_error` 다.

## 인바운드 관문 순서
→ [본문](CLE-CHAT-CORE-GATE.md#인바운드-관문-순서)

## 인바운드 HTTP 응답 계약
→ [본문](CLE-CHAT-CORE-RESPONSE.md#인바운드-http-응답-계약)

## 프로바이더별 응답 예외
→ [본문](CLE-CHAT-CORE-RESPONSE.md#프로바이더별-응답-예외)

## 인터랙션 기본 응답
→ [본문](CLE-CHAT-CORE-INTERACT.md#인터랙션-기본-응답)

## 채널 건강도
→ [본문](CLE-CHAT-CORE-RENDER.md#채널-건강도)

## 봇 토큰 변경 단일 경로
→ [본문](CLE-CHAT-CORE-PATCH.md#봇-토큰-변경-단일-경로)

## 인바운드 서명 자료 변경
→ [본문](CLE-CHAT-CORE-PATCH.md#인바운드-서명-자료-변경)

## 응답 파생 필드 hasBotToken
→ [본문](CLE-CHAT-CORE-TOKEN.md#응답-파생-필드-hasbottoken)

## Rationale

다른 문서가 링크하는 항목의 자리다.

### R2 채팅 채널을 EIA 의 소비자로만 둔다
→ [본문](CLE-CHAT-CORE-FLOW.md#r2-채팅-채널을-eia-의-소비자로만-둔다)

### R4 단일 sink 를 직접 구독한다
→ [본문](CLE-CHAT-CORE-FLOW.md#r4-단일-sink-를-직접-구독한다)

### R8 트리거 단위 listener 정책
→ [본문](CLE-CHAT-CORE-LISTENER.md#r8-트리거-단위-listener-정책)

### R9 처리 중 메시지는 큐에 쌓지 않고 바로 안내한다
→ [본문](CLE-CHAT-CORE-FLOW.md#r9-처리-중-메시지는-큐에-쌓지-않고-바로-안내한다)

### R-CC-10 봇 토큰 변경은 재발급 API 한 경로로만
→ [본문](CLE-CHAT-CORE-PATCH.md#r-cc-10-봇-토큰-변경은-재발급-api-한-경로로만)

### R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다
→ [본문](CLE-CHAT-CORE-RESPONSE.md#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)

### R-CC-15 실행 실패 안내의 입력과 자리표시자를 허용 목록으로 제한한다
→ [본문](CLE-CHAT-CORE-RENDER.md#r-cc-15-실행-실패-안내의-입력과-자리표시자를-허용-목록으로-제한한다)

### R-CC-19 분당 한도 초과분은 재발송 큐 대신 건너뛰고 degraded 로 표시한다
→ [본문](CLE-CHAT-CORE-GATE.md#r-cc-19-분당-한도-초과분은-재발송-큐-대신-건너뛰고-degraded-로-표시한다)

### R-CC-20 인바운드 중복 제거는 전용 서비스로 한다
→ [본문](CLE-CHAT-CORE-GATE.md#r-cc-20-인바운드-중복-제거는-전용-서비스로-한다)

### R-CC-21 PATCH 는 비밀을 쓰지 않는다
→ [본문](CLE-CHAT-CORE-PATCH.md#r-cc-21-patch-는-비밀을-쓰지-않는다)

### R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다
→ [본문](CLE-CHAT-CORE-TOKEN.md#r-cc-23-setupchannel-실패는-전송-방식이-아니라-원인으로-분류한다)

### R-CC-25 워크플로우가 다른 워크스페이스에 있으면 202 ignored 와 degraded 로 답한다
→ [본문](CLE-CHAT-CORE-GATE.md#r-cc-25-워크플로우가-다른-워크스페이스에-있으면-202-ignored-와-degraded-로-답한다)

### R-CC-26 마지막 오류 필드는 프로바이더 원문을 싣고 자격 증명 모양만 가린다
→ [본문](CLE-CHAT-CORE-RENDER.md#r-cc-26-마지막-오류-필드는-프로바이더-원문을-싣고-자격-증명-모양만-가린다)

### R-CC-27 활성 실행 중 /start 는 기존 실행을 취소하고 새로 시작한다
→ [본문](CLE-CHAT-CORE-FLOW.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다)

### R-CC-28 비활성 워크플로우는 채팅 채널로 새 실행을 시작하지 않는다
→ [본문](CLE-CHAT-CORE-GATE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)

### R-CC-29 트리거를 켜고 끌 때 외부 채널 등록은 건드리지 않는다
→ [본문](CLE-CHAT-CORE-LISTENER.md#r-cc-29-트리거를-켜고-끌-때-외부-채널-등록은-건드리지-않는다)

### R-CC-30 트리거 단위 listener 레지스트리의 변경을 Redis pub/sub 로 모든 서버 인스턴스에 알린다
→ [본문](CLE-CHAT-CORE-LISTENER.md#r-cc-30-트리거-단위-listener-레지스트리의-변경을-redis-pubsub-로-모든-서버-인스턴스에-알린다)

### R-CC-31 /cancel 과 재개 명령의 큐 적재 실패는 202 와 degraded 로 답한다
→ [본문](CLE-CHAT-CORE-INTERACT.md#r-cc-31-cancel-과-재개-명령의-큐-적재-실패는-202-와-degraded-로-답한다)

### R-CC-32 봇 토큰 입력은 보이는 ASCII 만 받는다
→ [본문](CLE-CHAT-CORE-TOKEN.md#r-cc-32-봇-토큰-입력은-보이는-ascii-만-받는다)

### R-CC-33 인터랙션은 어느 경로로 끝나도 기본 응답으로 답하고 버린 클릭에는 수신 확인을 보낸다
→ [본문](CLE-CHAT-CORE-INTERACT.md#r-cc-33-인터랙션은-어느-경로로-끝나도-기본-응답으로-답하고-버린-클릭에는-수신-확인을-보낸다)

### R-CC-34 서명 검증 실패는 트리거와 IP 쌍으로 세고 한도에 닿으면 401 로 답한다
→ [본문](CLE-CHAT-CORE-GATE.md#r-cc-34-서명-검증-실패는-트리거와-ip-쌍으로-세고-한도에-닿으면-401-로-답한다)
