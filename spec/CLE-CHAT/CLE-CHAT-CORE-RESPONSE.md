---
id: "CLE-CHAT-CORE-RESPONSE"
title: "채팅 채널 — 인바운드 HTTP 응답 계약"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-CORE"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-CORE"]
area: "CLE-CHAT"
content_hash: "0e2783e53373e17acdfcd8d0c0227e96000cca894600f5aeb7e89469704bcffb"
read_as: "approved_fallback"
task: "CLE-T-G2JRMF"
source_paths: []
mirror_sha256: "fd8c2b647fbe7e5068b1b63834ea07170b931c0d304032e327c3079279f7a4f5"
etag: "sha256-e8402d11ca4a309dd7d61050f3a3d6cd6f77cb9f1c02306694b5ff516fae129e"
---
## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 의 하위 문서로 `config.chatChannel` 이 설정된 트리거의 `POST /api/hooks/:endpointPath` 응답 정책을 정한다. `chatChannel` 이 없는 일반 웹훅 경로는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 을 따른다. 두 경로의 응답 정책을 나눈 것은 프로바이더 특성 차이 때문이다([R-CC-12](#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다)). 관문 순서는 [인바운드 관문](CLE-CHAT-CORE-GATE.md#인바운드-관문-순서), 인터랙션 응답은 [인터랙션 응답과 명령 실패](CLE-CHAT-CORE-INTERACT.md) 가 정한다.

## 인바운드 HTTP 응답 계약

- **기본**: `202 Accepted` 로 답한다. 실행을 만들지 않고 버린 update 와 채널 어댑터 내부 에러도 `202` 다. `/cancel` 의 취소나 재개 명령을 재개 큐에 넣지 못한 경우도 `202` 다. 서명 검증 뒤 처리 중 예상하지 못한 오류(DB · Redis 장애 등)도 에러 로그를 남기고 `202` 로 답한다.
- **(가) 조건을 만족하는 예외**: 인증 실패 `401` 과 엔드포인트 미존재 `404` 다. 서명 검증 실패 한도에 닿은 요청의 `401` 도 인증 실패다. 이유는 [R-CC-12](#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) (d)·(e) 에 있다. 서명 참조가 없는 채팅 채널 트리거가 전역 요청 한도를 넘은 `429 RATE_LIMITED` 도 서명 검증 전에 나가는 예외다. 규칙은 (다) 에 있다. 프로바이더가 특정 응답 형식만 받는 경우의 `200 OK` 도 여기 든다. 이 응답은 [프로바이더별 응답 예외](#프로바이더별-응답-예외) 의 두 조건을 모두 만족할 때만 둔다. 인터랙션의 `200` 은 처리 경로와 트리거 · 워크플로우 상태에 상관없이 나간다. 서명 검증 전에 끝나는 `401` · `404` · `429` 는 인터랙션이어도 그 에러로 답한다. 아래 표에서 `202` 인 행도 인터랙션이면 `200` 과 기본 응답이다([인터랙션 기본 응답](CLE-CHAT-CORE-INTERACT.md#인터랙션-기본-응답)).
- **(나) 내부 신뢰 호출 실패 전달**: `/start` 의 기존 실행 취소(`ExecutionsService.stop`)가 `INVALID_STATE`·`RESOURCE_NOT_FOUND` 밖의 에러로 실패하면 그 에러로 답한다. 취소를 큐에 넣지 못했을 때의 `503` `EXECUTION_ENQUEUE_FAILED` 가 이 경우다. 프로바이더가 요구하지 않는데도 `202` 대신 `503` 을 돌려주는 예외다. 근거는 [R-CC-12](#r-cc-12-인바운드-응답은-202-로-고정하고-401404-만-예외로-둔다) 와 [R-CC-27](CLE-CHAT-CORE-FLOW.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다. `/cancel` 의 취소 실패와 재개 명령의 큐 적재 실패는 이 예외에 들지 않는다. 둘은 `202` 로 답하고 채널 건강도로 알린다([R-CC-31](CLE-CHAT-CORE-INTERACT.md#r-cc-31-cancel-과-재개-명령의-큐-적재-실패는-202-와-degraded-로-답한다)).
- **(다) 요청 빈도 가드**: 공개 웹훅 가드의 `429` · `413` 은 채팅 채널 트리거 요청에 걸지 않는다. 전역 요청 빈도 제한(`UserThrottlerGuard`)의 `429 RATE_LIMITED` 는 서명 참조가 저장된 채팅 채널 트리거 요청에 걸지 않는다([핸들러 앞 라우트 가드](CLE-CHAT-CORE-GATE.md#핸들러-앞-라우트-가드)). 서명 참조가 없는 채팅 채널 트리거 요청은 전역 한도를 넘으면 `429 RATE_LIMITED` 를 받는다. 서명 검증 실패 한도는 `429` 가 아니라 `401` 로 답한다.

본문 열은 핸들러 반환값이다. `202` 는 전역 `TransformInterceptor` 가 `{ data: { executionId, message } }` 로 감싸 내보낸다. `200` handshake(Slack `{ challenge }` · Discord `{ type: 1 }`)와 인터랙션 응답(Discord 의 기본 응답 `{ type: 6 }` · `{ type: 4 }`, 모달 열기와 폼 제출 응답, Slack 의 빈 본문 · `{ response_type: 'ephemeral', text }` · `{ response_action }`)은 감싸지 않는다. 아래 표의 `202` 행은 인터랙션이 아닌 update 의 응답이다.

| 경우 | HTTP | 본문 | 처리 |
|---|---|---|---|
| 1:1 대화, 정상 update(새 실행 시작) | `202 Accepted` | `{ executionId }`(웹훅 처리 흐름과 같은 형식) | 실행 시작 |
| 1:1 대화, 정상 update(기존 실행에 전달) | `202 Accepted` | `{ executionId }`(활성 실행 id) | `InteractionService.interact` 호출, 새 실행 없음 |
| 1:1 대화, 활성 실행이 있는 대화에 실행 소유자가 보낸 `/start` | `202 Accepted` | `{ executionId }`(새 실행 id) | 기존 실행을 실행 중지 경로로 취소한 뒤 새 실행 시작. 기존 실행이 이미 끝났거나 지워졌으면 취소 없이 시작한다 |
| 1:1 대화, `/start` 의 기존 실행 취소 실패(취소를 큐에 넣지 못함 등) | `503 Service Unavailable` 등 | 표준 에러 응답 봉투(`EXECUTION_ENQUEUE_FAILED` 등. 코드 정의는 [에러 코드 규약과 카탈로그 §6.7](../CLE-API/CLE-API-ERRCODES.md#67-websocket-명령-재개-명령과-마지막-턴-재시도-도메인-문서-참조)) | 새 실행 없음. 그 update 의 중복 제거 선점을 풀어 프로바이더의 재전송을 받는다. 위 규칙 (나) 에 해당한다. 인터랙션으로 온 `/start` 도 같다 |
| 1:1 대화, 활성 실행이 있는 대화에 실행 소유자가 보낸 `/cancel` | `202 Accepted` | `{ executionId }`(취소한 실행 id) | 실행 중지 경로(`ExecutionsService.stop`)로 취소하고 채널 대화 상태의 `executionId` 가 그 실행을 가리킬 때만 비운다. 실행이 이미 끝났거나 지워졌으면(`INVALID_STATE`·`RESOURCE_NOT_FOUND`) 같은 응답이고 채널 건강도를 바꾸지 않는다 |
| 활성 실행이 있는 대화에 실행 소유자가 아닌 사람이 보낸 `/start`·`/cancel` | `202 Accepted` | `{ executionId: 'ignored' }` | 기존 실행을 취소하지 않고 새 실행도 시작하지 않는다. 안내 문구 없이 버린 update 의 수신 확인만 보낸다. 인터랙션(Slack · Discord 슬래시 명령)이면 `200` 과 기본 응답이다. 실행 소유자는 `channelUserKey` 가 채널 대화 상태의 값과 같은 사용자다. 1:1 DM 에서는 생기지 않고 DM 이 아닌 채널에서도 받는 Slack 슬래시 명령에서 생긴다([R-CC-35](CLE-CHAT-CORE-FLOW.md#r-cc-35-start-와-cancel-은-실행-소유자만-쓴다)) |
| 1:1 대화, `/cancel` 의 취소를 재개 큐에 넣지 못함 | `202 Accepted` | `{ executionId }`(취소하려던 실행 id) | 실행은 입력 대기에 남고 `executionId` 도 그대로다. 경고 로그, `chat_channel_health=degraded`, 고정 문구(이미 `degraded` 면 다시 쓰지 않음). 중복 제거 선점은 풀지 않는다. `503` 으로 답하지 않는다([큐 적재 실패](CLE-CHAT-CORE-INTERACT.md#큐-적재-실패)) |
| 1:1 대화, 입력 대기 실행으로 보내는 재개 명령(답장, 버튼 탭, 폼 제출)을 재개 큐에 넣지 못함 | `202 Accepted` | `{ executionId }`(활성 실행 id) | 실행은 입력 대기에 그대로 있다. `/cancel` 의 큐 적재 실패와 같이 처리한다. 인터랙션으로 온 재개 명령은 아래 인터랙션 행의 응답을 쓴다. 네이티브 폼 모달 제출이면 모달 대기(`pendingFormModal`)를 지우지 않고 「양식 작성하기」 버튼을 다시 보내며, 응답은 기본 응답이라 모달만 닫힌다 |
| group·supergroup·channel 대화 | `202 Accepted` | `{ executionId: 'ignored' }` | `languageHints.groupChatRefusal` 안내 발송 |
| 봇이 보낸 메시지(`from.is_bot === true`, Slack `bot_id`, Discord `member.user.bot === true`) | `202 Accepted` | `{ executionId: 'ignored' }` | 조용히 건너뜀 |
| `parseUpdate` 가 지원하지 않는 update | `202 Accepted` | `{ executionId: 'ignored' }` | 조용히 건너뜀(웹훅 처리 흐름과 같다). Telegram 버튼 클릭이면 수신 확인을 보낸다 |
| 대화 단위 분당 한도 초과 | `202 Accepted` | `{ executionId: 'ignored' }` | `rateLimitPerMinute`(기본 60)를 넘으면 쌓거나 다시 보내지 않고 건너뛴 뒤 `chat_channel_health=degraded`([R-CC-19](CLE-CHAT-CORE-GATE.md#r-cc-19-분당-한도-초과분은-재발송-큐-대신-건너뛰고-degraded-로-표시한다)). 안내 메시지는 1차 범위 밖. Telegram 버튼 클릭이면 수신 확인을 보낸다 |
| 트리거의 워크플로우가 트리거의 워크스페이스에 없음(저장 경계 이전의 id 참조 교차 행) | `202 Accepted` | `{ executionId: 'ignored' }` | 실행을 만들지 않고 `chat_channel_health=degraded`. `chat_channel_last_error` 는 고정 문구 `Workflow not found for this trigger` 이고 이미 `degraded` 면 다시 쓰지 않는다([R-CC-25](CLE-CHAT-CORE-GATE.md#r-cc-25-워크플로우가-다른-워크스페이스에-있으면-202-ignored-와-degraded-로-답한다)) |
| 비활성 트리거 | `202 Accepted` | `{ executionId: 'ignored' }` | `HooksService.handle` 의 채팅 채널 분기가 비활성 검사보다 먼저 돌고, `handleChatChannelWebhook` 이 서명 검증(`chatChannelInboundAuthenticator.verify`)을 먼저 한 뒤 비활성이면 조용히 건너뛴다. 서명이 틀리면 401 이다(R-CC-12 (d)). 비활성 트리거에 `410` 으로 답하는 일반 웹훅 규칙([웹훅 「요구사항」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요구사항))의 채팅 채널 예외다. 진행 중인 대화의 입력과 `/cancel` 도 버린다. 인터랙션이면 `200` 과 기본 응답으로 답한다. 실행을 시작하지 않고 수신 확인을 포함한 외부 호출도 하지 않는다. 비활성 워크플로우와의 차이는 [관문 표](CLE-CHAT-CORE-GATE.md#비활성-트리거와-비활성-워크플로우) 를 본다 |
| 워크플로우가 비활성(`workflow.is_active=false`), 새 실행을 시작할 update | `202 Accepted` | `{ executionId: 'ignored' }` | 활성 실행이 없는 대화의 메시지와 `/start` 가 해당한다. 활성 실행이 있는 대화의 `/start` 도 기존 실행을 취소하지 않고 버린다. 진행 중인 대화의 입력, `/cancel`, `/help` 는 활성일 때와 같이 처리한다. 채널 건강도를 바꾸지 않는다. 세 경로 공통 규칙은 [트리거 데이터와 흐름 「워크플로우 활성 관문」](../CLE-TRIG/CLE-TRIG-DATA.md#워크플로우-활성-관문) 이 정한다([R-CC-28](CLE-CHAT-CORE-GATE.md#r-cc-28-비활성-워크플로우는-채팅-채널로-새-실행을-시작하지-않는다)) |
| 전역 요청 빈도 제한 초과(IP 단위 분당 100건) | 서명 참조가 저장된 트리거는 해당 없음. 서명 참조가 없는 트리거는 `429 Too Many Requests` | 서명 참조가 없는 트리거는 표준 에러 응답 봉투(`RATE_LIMITED`) | 서명 참조가 저장된 채팅 채널 트리거 요청은 전역 요청 빈도 제한(`UserThrottlerGuard`)에서 뺀다. 서명 참조가 없는 채팅 채널 트리거(옛 트리거, 채널 연결 전 트리거)의 요청은 일반 웹훅과 같이 세고 한도를 넘으면 서명 검증 전에 거부한다. 인터랙션이어도 같다. 공개 웹훅 가드의 `429` · `413` 은 서명 참조와 상관없이 채팅 채널 트리거에 걸지 않는다 |
| 트리거 없음(잘못된 `endpointPath`) | `404 Not Found` | 표준 에러 응답 봉투 | 일반 경로와 같다([웹훅 「요구사항」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요구사항)). 2xx 로 답하면 낡은 웹훅이 계속 남는다 |
| 웹훅 인증 실패(Telegram `X-Telegram-Bot-Api-Secret-Token`, Slack `X-Slack-Signature`, Discord `X-Signature-Ed25519` 누락·불일치) | `401 Unauthorized` | 표준 에러 응답 봉투 | 일반 경로의 인증 실패와 같다([웹훅 「인증」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#인증)). 비활성 트리거도 인증한다 |
| 서명 검증 실패 한도 초과(같은 트리거와 같은 클라이언트 IP 에서 60초 안에 실패 20번) | `401 Unauthorized` | 표준 에러 응답 봉투(`AUTH_FAILED`) | 창이 끝날 때까지 시크릿 조회와 서명 계산 없이 답한다. `429` 로 바꾸지 않는다. 거부한 요청은 실패로 다시 세지 않는다([서명 검증 실패 한도](CLE-CHAT-CORE-GATE.md#서명-검증-실패-한도)) |
| 채널 어댑터 내부 에러(`sendMessage` 실패 등) | `202 Accepted` | 실패 단계에 따라 `{ executionId: 'ignored' }` 나 `{ executionId }` | 백그라운드 처리, `chat_channel_health='degraded'`. 외부 API 호출 실패 영역이고 실행 실패 안내는 [실행 실패 안내](CLE-CHAT-CORE-RENDER.md#실행-실패-안내) 를 본다 |
| 서명 검증 뒤 처리 중 예상하지 못한 오류(DB · Redis 장애 등) | `202 Accepted` | `{ executionId: 'ignored' }` | 에러 로그를 남기고 버린 update 로 끝낸다. 채널 건강도는 바꾸지 않는다. Telegram 버튼 클릭이면 수신 확인을 보낸다. 인터랙션이면 `200` 과 기본 응답이다. `/start` 의 기존 실행 취소 실패는 이 행이 아니라 위의 `503` 행이다 |
| Slack URL Verification(`type: "url_verification"`) | `200 OK` | `{ challenge: <받은 값> }` JSON | 프로바이더별 예외. Slack 이 challenge 를 응답에서 꺼내야 한다([Slack 어댑터](CLE-CHAT-SLACK.md)). 워크플로우가 비활성이어도 답한다. 트리거가 비활성이면 답하지 않고 `202` 로 버린다(비활성 트리거 행, R-CC-33) |
| Slack Interactivity(`payload` 필드가 있는 요청. `block_actions` · `view_submission` 등) | `200 OK` | 빈 body. 처리 경로가 정한 응답이 있으면 `{ response_action }` | 프로바이더별 예외. Slack 의 3초 ack 시한이고 `202` 를 인정하지 않는다. 트리거 비활성, 파싱 실패, 중복, 한도 초과, 워크플로우 비활성 등 어느 경로로 끝나도 같다([Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK.md#인바운드-응답)) |
| Slack 슬래시 명령(`command` 필드가 있는 요청) | `200 OK` | `{ response_type: 'ephemeral', text }`. 본인에게만 보이는 메시지다 | 프로바이더별 예외. Slack 의 3초 응답 시한이다. `help` 하위 명령은 도움말(`languageHints.help` 나 기본 도움말), 나머지는 공통 수신 문구(`languageHints.commandReceived`)를 싣는다. 새 실행, 취소, 답장 전달, 중복, 한도 초과, 워크플로우 비활성, 트리거 비활성 모두 같다. `help` 는 별도 메시지를 보내지 않는다([Slack 어댑터 「인바운드 응답」](CLE-CHAT-SLACK.md#인바운드-응답)) |
| Discord PING(`type: 1`) | `200 OK` | `{ type: 1 }` JSON | 프로바이더별 예외. Interactions endpoint 등록 때 1회, 그 뒤 주기적으로 온다([Discord 어댑터](CLE-CHAT-DISCORD.md)). 워크플로우가 비활성이어도 답한다. 트리거가 비활성이면 답하지 않고 `202` 로 버린다(비활성 트리거 행, R-CC-33) |
| Discord 컴포넌트 클릭 · 모달 제출(`type ∈ {3, 5}`) | `200 OK` | `{ type: 6 }`(DEFERRED_UPDATE_MESSAGE). 처리 경로가 정한 응답이 있으면 그 응답(모달 열기 `{ type: 9, data: {...} }`, Form 모달 제출 결과 `{ type: 4, data: {...} }`) | 프로바이더별 예외. Discord 의 3초 응답 시한이다. 트리거 비활성, 중복, 한도 초과, 실행 중, 워크플로우 비활성 등 어느 경로로 끝나도 같다([Discord 어댑터 「인바운드 응답」](CLE-CHAT-DISCORD.md#인바운드-응답)) |
| Discord 슬래시 명령(`type: 2`) | `200 OK` | `{ type: 4, data: { content, flags: 64 } }`. 본인에게만 보이는 메시지다 | 프로바이더별 예외. `help` 하위 명령은 도움말(`languageHints.help` 나 기본 도움말), 나머지는 공통 수신 문구(`languageHints.commandReceived`)를 싣는다. 새 실행, 취소, 답장 전달, 중복, 한도 초과, 워크플로우 비활성, 파싱 실패, 트리거 비활성 모두 같다. 시작 안내는 따로 다룬다(NERV Task `CLE-T-0400J6`) |

에러 응답 봉투의 형식은 [에러 응답과 클라이언트 처리 「2. 에러 응답 봉투」](../CLE-API/CLE-API-ERROR.md#2-에러-응답-봉투) 가 정한다.

새 실행을 시작한 경우의 `202` 본문에는 `status: "pending"` 도 실린다. 응답 모양의 기준은 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api) 이고 두 필드(`message` · `status`)를 붙이는 자리는 [트리거 데이터와 흐름 「웹훅 진입」](../CLE-TRIG/CLE-TRIG-DATA.md#웹훅-진입) 에 있다.

새 실행을 만들지 않은 경우의 본문은 `{ ignored: true }` 가 아니라 `executionId` 에 표시 문자열을 넣은 `{ executionId: 'ignored' }` 다(`state?.executionId ?? 'ignored'`). 기존 실행에 전달한 경우는 활성 실행 id 를 돌려준다.

## 프로바이더별 응답 예외

프로바이더가 요구하는 응답 예외(Slack URL Verification, Slack Interactivity ack, Slack 슬래시 명령 응답, Discord PING, Discord 인터랙션 응답)는 다음 두 조건을 모두 만족할 때만 허용한다.

1. 프로바이더가 특정 응답 형식만 성공으로 인정한다. Telegram 처럼 2xx 면 무엇이든 되는 경우가 아니다.
2. 프로바이더 문서 본문에 사유와 응답 본문 형식이 적혀 있다.

예외를 새로 더하려면 프로바이더 문서와 위 표를 함께 고친다.

## 구현 위치

- `codebase/backend/src/modules/hooks/hooks.service.ts`: 처리 중 예상하지 못한 오류의 `202`
- `codebase/backend/test/chat-channel-slack.e2e-spec.ts`, `codebase/backend/test/chat-channel-discord.e2e-spec.ts`(두 파일 모두 인터랙션 응답 포함)

## Rationale

### R-CC-12 인바운드 응답은 202 로 고정하고 401·404 만 예외로 둔다

예외는 제목의 401·404 말고 셋이 더 있다. 프로바이더가 요구하는 응답 형식([프로바이더별 응답 예외](#프로바이더별-응답-예외)), `/start` 의 기존 실행 취소 실패에 돌려주는 `503` `EXECUTION_ENQUEUE_FAILED`, 서명 참조(`inboundSigningRef`)가 없는 채팅 채널 트리거가 전역 요청 빈도 제한에 걸린 `429 RATE_LIMITED` 다. 이 `429` 는 서명 검증 전에 나간다([채팅 채널 「요구사항」](CLE-CHAT-CORE.md#요구사항) 의 전역 요청 빈도 제한 면제, [인바운드 관문 「핸들러 앞 라우트 가드」](CLE-CHAT-CORE-GATE.md#핸들러-앞-라우트-가드)). 인터랙션은 처리 경로와 상관없이 `200` 과 기본 응답으로 답한다(2026-11-12, R-CC-33). 서명 검증 전에 끝나는 `401` · `404` · `429` 는 인터랙션이어도 그 에러로 답한다. 서명 검증 실패 한도에 닿은 요청도 `429` 가 아니라 `401` 이다(2026-11-13, R-CC-34). `/cancel` 의 취소와 재개 명령을 재개 큐에 넣지 못한 경우는 예외에 들지 않고 `202` 다(2026-10-17, R-CC-31). 서명 검증 뒤 처리 중 예상하지 못한 오류도 `202` 다(2026-11-13).

**`202` 를 기본값으로 고른 이유.** 웹훅 처리 흐름이 이미 `202` 를 기준으로 정해 일관성을 지킨다. `200` 을 새로 들이면 Telegram 에는 차이가 없는데 웹훅 문서도 고쳐야 한다. 프로바이더가 `200` 만 성공으로 인정하는 경우의 예외는 그 뒤 [Slack 어댑터 「R-S-8 URL Verification 과 Interactivity 는 200 OK 로 답한다」](CLE-CHAT-SLACK.md#r-s-8-url-verification-과-interactivity-는-200-ok-로-답한다) 와 [Discord 어댑터 「R-D-8 PING 과 Interactivity 는 200 OK 로 답한다」](CLE-CHAT-DISCORD.md#r-d-8-ping-과-interactivity-는-200-ok-로-답한다) 가 더했다. 일반 웹훅이 비활성 트리거에 쓰는 410 Gone([웹훅 「요구사항」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요구사항))을 쓰면 프로바이더가 non-2xx 에 웹훅을 자동 비활성화하고 재전송을 쏟아낸다(Telegram Bot API 문서화 동작).

- (a) 202 는 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api) 의 수신 응답 표준과 맞다.
- (b) 일반 웹훅의 410 정책은 호출자가 사람이나 일반 HTTP 클라이언트라는 가정인데 채팅 채널 프로바이더는 그 가정에서 벗어난다.
- (c) 채팅 채널을 쓰지 않는 웹훅(Cafe24, 사용자 클라이언트)은 404·410 이 디버깅에 필요하므로 두 경로를 나눈다. 웹훅 문서의 "처리 흐름 분기만 정의" 범위 안이다.
- (d) 인증 실패 401: 조용한 2xx 는 무차별 대입 공격자에게 차이를 숨기는 이점이 있지만 운영자가 "봇이 왜 응답하지 않는지" 알려면 401 이 보여야 한다. Telegram 은 `secret_token` 실패에 다시 보내지 않는다는 문서화 동작에 기대므로 재전송 폭주도 없다.
- (e) 404 는 일반 경로와 같다. 없는 엔드포인트에 2xx 로 답하면 낡은 웹훅이 끝없이 남는다([웹훅 「요구사항」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요구사항)).

현재 구현은 정상 update, 인증 실패, 404, 비활성 트리거에서 이 정책과 같다. 핸들러 앞의 공개 웹훅 가드는 채팅 채널 트리거를 통과시키고 전역 요청 빈도 제한은 서명 참조가 저장된 채팅 채널 트리거를 통과시킨다.


**공개 웹훅 가드(2026-11-12).** 채팅 채널 트리거는 공개 웹훅 가드(IP 단위 시작 한도 · 시간당 누적 신규 상한 · 본문 32KB 상한)를 받지 않는다. 그 가드는 인증 없는 공개 웹훅의 남용을 막으려고 둔 것이다([웹훅 「요청 제한과 남용 방어」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요청-제한과-남용-방어)). 채팅 채널 트리거는 프로바이더 서명으로 인증하고 `auth_config_id` 가 없을 뿐이다. 프로바이더는 적은 수의 발신 IP 에서 모든 사용자의 update 를 보낸다. 그래서 IP 단위 시작 한도는 정상 트래픽도 막고, 그때 나가는 `429` · `413` 이 이 절이 피하려던 재전송과 웹훅 비활성화를 부른다.

**전역 요청 빈도 제한(2026-11-12, 2026-11-13 범위 축소).** 전역 요청 빈도 제한(`UserThrottlerGuard`)은 모든 HTTP 요청에 걸리고 로그인 없는 요청은 IP 로 센다. 프로바이더의 발신 IP 가 적으므로 트래픽이 많은 봇은 IP 단위 분당 100건에 닿는다. 그때 나가는 `429` 도 공개 웹훅 가드의 `429` 와 같이 재전송과 웹훅 비활성화를 부른다. 그래서 채팅 채널 트리거 요청을 이 제한에서 뺐다. 남용은 서명 검증(`401`), 서명 검증 실패 한도(R-CC-34), 대화 단위 분당 한도(R-CC-19)가 막는다. 기각한 대안은 전역 요청 빈도 제한을 그대로 두는 안이다. `202` 고정이 막으려던 재전송 위험이 트래픽이 많은 봇에서 다시 생긴다.

2026-11-13 에 뺀 범위를 서명 참조가 저장된 트리거로 좁혔다. 서명 참조가 없는 트리거는 옛 트리거나 채널 연결 전 트리거다. 인바운드 인증기는 이런 트리거의 서명 검증을 건너뛴다. 그래서 `401` 이 나지 않고 서명 검증 실패 한도도 걸리지 않는다. 이런 트리거까지 빼면 그 요청에 걸리는 IP 단위 한도가 하나도 남지 않는다. 이 셋째 예외는 프로바이더 재전송 위험을 감수한다. 면제 판정은 인증기가 서명을 검증하는 조건과 같다. `provider` 와 저장된 서명 참조만 보고 시크릿을 읽지 않으므로 요청마다 시크릿 저장소 조회가 늘지 않는다. 공개 웹훅 가드의 면제는 서명 참조와 상관없이 그대로다. 기각한 대안은 채팅 채널 트리거를 서명 참조와 상관없이 모두 빼는 안이다. 서명 참조가 없는 트리거에 IP 단위 한도가 남지 않는다.

**구현 방식.** `POST /hooks/:endpointPath` 에 `@DeferGlobalThrottle()` 을 붙여 전역 가드가 이 라우트를 세지 않게 했다. 대신 트리거를 조회하는 공개 웹훅 가드 뒤의 라우트 가드(`HookTriggerThrottlerGuard`)가 같은 한도 · 같은 저장소 · 같은 키로 센다. 채팅 채널 트리거인지는 트리거 행을 읽어야 아는데 전역 가드는 라우트 가드보다 먼저 돌기 때문이다. 대가로 이 라우트에서는 전역 한도를 넘은 요청도 트리거 조회 한 번을 거친 뒤 `429` 로 거절된다. 컨트롤러가 그 조회 결과를 다시 쓰므로 요청마다 늘어나는 DB 왕복은 없다.

**처리 중 예상하지 못한 오류(2026-11-13).** 서명 검증을 지난 뒤 처리 중 예상하지 못한 오류(DB · Redis 장애 등)가 나도 5xx 로 답하지 않는다. 에러 로그를 남기고 버린 update 로 끝내 `202`·`{ executionId: 'ignored' }` 로 답한다. 5xx 도 다른 non-2xx 와 같이 재전송과 웹훅 자동 비활성화를 부르기 때문이다. 채널 건강도는 바꾸지 않는다. `degraded` 의 원인은 [채널 건강도](CLE-CHAT-CORE-RENDER.md#채널-건강도) 의 표에 있는 넷뿐이다. 서명 검증 전에 끝나는 `401` · `404` · `429` 와 `/start` 의 기존 실행 취소 실패는 이 처리에 들지 않고 원래 응답 그대로다.

**`/start` 의 기존 실행 취소 실패에 `503` 을 돌려주는 근거.**

- `/start` 의 취소는 새 실행을 시작하기 전의 정리 단계다. 이 실패를 `202` 로 숨기면 옛 실행이 남은 채 사용자의 `/start` 가 조용히 사라진다.
- 큐 적재 실패는 일시적이다. 에러로 답하면 프로바이더가 다시 보낸 같은 update 를 받을 수 있다. 답하기 전에 그 update 의 중복 제거 선점을 풀어 재전송을 다시 처리한다.
- 재전송이 쏟아져도 그 상한은 같은 대화의 `/start` 한 건이다.
- 재개 명령(답장, 버튼 탭, 폼 제출)과 `/cancel` 의 실패는 `202` 로 답한다. 그 명령들은 새 실행을 시작하지 않으므로 `/start` 와 다르게 둔다. 큐 적재 실패는 채널 건강도를 `degraded` 로 바꿔 알린다(R-CC-31).

non-2xx 가 이어질 때 프로바이더가 웹훅을 끄는 조건은 확인하지 않았다. 그래도 이 위험을 받아들인 이유는 [R-CC-27](CLE-CHAT-CORE-FLOW.md#r-cc-27-활성-실행-중-start-는-기존-실행을-취소하고-새로-시작한다) 에 있다.

[웹훅 「처리 흐름」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#처리-흐름) 도 채팅 채널 분기를 활성 확인·인증 설정 인증보다 앞에 두고 프로바이더 서명으로 검증한다. 그래서 두 문서가 인증 단계에서 갈린다던 미결은 닫혔다.
