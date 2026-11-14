---
id: "CLE-TRIG-WEBHOOK-FLOW"
title: "웹훅 — 처리 흐름"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-WEBHOOK"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-WEBHOOK"]
area: "CLE-TRIG"
content_hash: "5c4a74c9acda025dbe720f057b6d8396785baffc9118fae8fe5c260440a3b124"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "be3cbca81807a9f9f27954919c8aab699f35316516c9c19025e2279c234cdf7a"
etag: "sha256-7a55084c1cd38ab49bed147aa80c0348daae1678655583ba2287593cde872a53"
---
## 개요

이 문서는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 하위 문서로 웹훅 요청을 받은 뒤의 처리 단계, 채팅 채널 분기, 트리거 · 워크플로우가 비활성일 때의 응답, 에러 처리를 정한다. 순서도는 [웹훅 「처리 구조」](CLE-TRIG-WEBHOOK.md#처리-구조), 응답 모양과 에러 코드 표는 [수신 API](CLE-TRIG-WEBHOOK-API.md#수신-api) 에 있다.

## 처리 흐름

1. `POST /api/hooks/:endpointPath` 를 받는다. 앞단에서 `PublicWebhookThrottleGuard` 가 공개 웹훅(채팅 채널 트리거 제외)의 본문 크기와 IP 한도를 먼저 적용한다. 이어서 `HookTriggerThrottlerGuard` 가 서명 참조가 있는 채팅 채널 트리거를 뺀 요청에 전역 한도를 건다([호출 빈도 제한](CLE-TRIG-WEBHOOK-LIMIT.md#호출-빈도-제한)).
2. `HooksService.handleWebhook(endpointPath, body, headers, query)` 가 처리를 시작한다.
3. `TriggersService.findByEndpointPath()` 로 웹훅 트리거를 찾는다. 조회는 워크스페이스 없이 `endpoint_path` 와 `type='webhook'` 으로 한다.
4. 트리거가 없으면 `404 TRIGGER_NOT_FOUND` 다.
5. `config.chatChannel.provider` 가 빈 문자열이 아닌 문자열이면 채팅 채널 분기로 간다(아래 [채팅 채널 분기](#채팅-채널-분기)). 이 분기는 활성 확인보다 먼저다.
6. 트리거가 비활성이면 `410 Gone`(`TRIGGER_INACTIVE`)이다.
   - 트리거가 활성이면 워크플로우 활성 상태를 본다(`isWorkflowInactive`). 워크플로우가 비활성이면(`workflow.is_active=false`) `410 Gone`(`WORKFLOW_INACTIVE`, 메시지 `Workflow of this webhook trigger is inactive`)이다. 인증보다 앞이라 인증 설정 `last_used_at` 도 바뀌지 않는다.
   - 워크플로우가 트리거의 워크스페이스에 없으면 이 확인은 통과하고 10 의 엔진이 404 로 거부한다. 조회 범위와 남지 않는 기록은 [트리거 데이터와 흐름 「워크플로우 활성 관문」](CLE-TRIG-DATA.md#워크플로우-활성-관문) 이 정한다.
7. 인증을 검증한다(`AuthConfigsService.verifyWebhookRequest`, 유형별 규칙은 [인증](CLE-TRIG-WEBHOOK-AUTH.md#인증)).
   1. `trigger.auth_config_id IS NULL` 이면 통과한다. `ip_whitelist` 도 인증 설정에 딸려 있어 평가하지 않는다.
   2. 인증 설정을 트리거의 워크스페이스 안에서 찾는다. 없으면 `401 AUTH_FAILED` 다. 다른 워크스페이스의 인증 설정을 가리키는 저장된 행도 여기서 막힌다([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)).
   3. 인증 설정이 비활성이면 `401 AUTH_FAILED`.
   4. `ip_whitelist` 가 있으면 클라이언트 IP 를 검사한다. 맞지 않으면 401.
   5. 유형별(`bearer_token` / `api_key` / `basic_auth` / `hmac`)로 상수 시간 비교를 한다. 기대값이 비었거나 문자열이 아니거나, 헤더 이름이 있는데 문자열이 아니거나, 복호화 불가 표식으로 읽히면 요청 값과 상관없이 `401 AUTH_FAILED` 다.
   6. 성공하면 `last_used_at` 을 fire-and-forget 으로 갱신한다.
   7. 실패하면 `401 AUTH_FAILED` 이고 갱신하지 않는다.
8. `resolveTriggerParameters(workflow, body)` 로 파라미터를 추출·검증한다([파라미터 추출 규칙](CLE-TRIG-WEBHOOK-AUTH.md#파라미터-추출-규칙)). 파라미터 스키마는 트리거의 워크스페이스 안에서만 읽는다. 워크플로우가 그 워크스페이스에 없으면 스키마가 없는 것으로 보고 10 에서 404 가 된다. required 누락이나 변환 실패면 `400 INVALID_WEBHOOK_PAYLOAD` 이고 실행을 만들지 않는다.
9. 민감 헤더를 `[REDACTED]` 로 가린다([수신 헤더 마스킹](CLE-TRIG-WEBHOOK-AUTH.md#수신-헤더-마스킹)).
10. `ExecutionEngineService.execute(trigger.workflowId, { __triggerSource:'webhook', parameters, body, headers, query, method }, { triggerId: trigger.id, workspaceId: trigger.workspaceId, sourceIp, responseCode: '202' })` 를 부른다.
    - 엔진은 워크플로우가 트리거의 워크스페이스에 없으면 거부한다. 이때 4 와 같은 `404 TRIGGER_NOT_FOUND`(같은 본문)로 응답하고 실행 행과 `last_triggered_at` 을 남기지 않는다. 저장 경계 이전에 남은 교차 행을 위한 동작이다([데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검)).
    - 세 번째 인자로 `triggerId` 를 넘겨야 실행 행의 `trigger_id` 가 채워지고 실행 내역 화면에서 출처가 `webhook` 으로 분류된다.
    - `sourceIp`(`extractClientIpFromHeaders` 결과, 인증 IP whitelist 검증과 같은 값)와 `responseCode`(성공 경로의 실제 HTTP 코드 `202`)도 넘긴다. 둘은 실행 행의 `source_ip`/`response_code` 컬럼에 저장돼 인증 설정 사용 내역의 소스 IP·응답 코드를 채운다([외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md)).
    - 스케줄·수동 트리거는 두 인자를 넘기지 않아 컬럼이 NULL 이다. `ExecuteOptions` 의 `triggerId` variant 에서 `sourceIp?`/`responseCode?` 는 선택이라 기존 호출자와 호환된다.
    - `execute()` 는 실행 행을 `pending` 으로 만들고 곧바로 `executionId` 를 돌려준다.
11. `Trigger.lastTriggeredAt` 을 현재 시각으로 갱신한다.
12. `202 Accepted` 와 `{ data: { executionId, message } }` 를 응답한다. `message` 는 늘 있다. `config.interaction.enabled=true` 면 `data` 에 `status: "pending"` 과 `interaction` 이 더 들어간다([수신 API](CLE-TRIG-WEBHOOK-API.md#수신-api)).

## 채팅 채널 분기

`config.chatChannel.provider` 가 빈 문자열이 아닌 문자열인 트리거는 5단계에서 채팅 채널 분기(`handleChatChannelWebhook`)로 간다. 이 분기는 일반 흐름의 활성 확인(410), 인증 설정 인증, 트리거 파라미터 검증을 거치지 않는다.

- 인증은 인증 설정이 아니라 provider 별 inbound 서명 검증(`chatChannelInboundAuthenticator.verify`)으로 한다. Telegram 은 `X-Telegram-Bot-Api-Secret-Token`, Slack 은 `X-Slack-Signature`, Discord 는 `X-Signature-Ed25519` 를 쓴다. 검증에 실패하면 401 이다.
- 인터랙션 요청은 프로바이더가 3초 안에 `200 OK` 와 정해진 본문을 받아야 하는 요청이다. Discord 컴포넌트(type 3) · 모달 제출(type 5) · 슬래시 명령(type 2)과 Slack Interactivity(`block_actions` · `view_submission` 등) · 슬래시 명령이 해당한다.
  - 서명 검증 직후 채널 어댑터 훅 `defaultInteractionResponse` 가 요청 본문만 보고 기본 인터랙션 응답을 정한다. 외부 호출이 없는 계산이다. Discord 컴포넌트 · 모달 제출은 `{ type: 6 }`, Discord 슬래시 명령은 본인에게만 보이는 수신 문구나 도움말을 담은 `{ type: 4 }`, Slack Interactivity 는 빈 본문이다. Slack 슬래시 명령은 본인에게만 보이는 수신 문구나 도움말을 담은 `{ response_type: 'ephemeral', text }` 다.
  - 인터랙션 요청이 아니면 기본 인터랙션 응답이 없고 아래 규칙대로 `202` 나 handshake 응답으로 답한다. Discord PING · 자동 완성, Slack `url_verification` · Events API 메시지, Telegram update 가 여기에 든다.
  - 프로바이더별 본문과 문구는 [Discord 어댑터 「인바운드 응답」](../CLE-CHAT/CLE-CHAT-DISCORD.md#인바운드-응답) 과 [Slack 어댑터 「인바운드 응답」](../CLE-CHAT/CLE-CHAT-SLACK.md#인바운드-응답) 이 정한다.
- 트리거가 비활성이어도 서명 검증은 먼저 한다. 통과하면 update 를 무시하고 실행을 시작하지 않는다. 버린 버튼 클릭의 수신 확인을 포함해 프로바이더 API 도 부르지 않는다. 응답은 인터랙션 요청이면 `200 OK` 와 기본 인터랙션 응답이고 그 밖에는 `202 Accepted` 와 `{ executionId: 'ignored' }` 다. handshake 도 그 밖에 들어 `202` 다.
  - 비활성인데 410 이 아니라 2xx 인 이유는 Telegram 같은 provider 가 2xx 가 아닌 응답을 받으면 웹훅을 자동으로 끄거나 재시도를 쏟아내기 때문이다. 인터랙션 요청에 `200` 으로 답하는 이유는 [꺼진 트리거도 인터랙션 요청에는 200 으로 답한다](#꺼진-트리거도-인터랙션-요청에는-200-으로-답한다-2026-11-12) 에 있다.
  - 비활성이어도 인증을 하는 이유는 인증에 실패한 요청에 조용한 202 를 주면 공격자가 트리거 활성 여부를 추측할 수 있고 운영자는 인증 실패를 401 로 봐야 디버깅할 수 있기 때문이다.
- 워크플로우가 비활성이면(`workflow.is_active=false`) 새 실행을 시작하는 경우만 막고 비활성 트리거와 같이 `202 Accepted` 와 `{ executionId: 'ignored' }` 로 응답한다. 인터랙션 요청이면 `202` 대신 `200 OK` 와 기본 인터랙션 응답으로 답한다. handshake 에는 답하고 진행 중인 대화는 이어진다. 막는 update 와 비활성 트리거와의 차이는 [트리거 데이터와 흐름 「워크플로우 활성 관문」](CLE-TRIG-DATA.md#워크플로우-활성-관문) 이 정하고 확인 순서는 [채팅 채널 「인바운드 관문 순서」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-관문-순서) 가 정한다.
- 새 대화면 일반 경로와 같이 `execute(workflowId, input, { triggerId, workspaceId, sourceIp, responseCode })` 로 실행을 시작한다. 입력은 provider update 를 바꾼 값이다. `responseCode` 는 이 요청에 실제로 답하는 HTTP 응답 코드다. 기본은 `'202'` 이고 인터랙션 요청이면 `'200'` 이다. 워크플로우가 트리거의 워크스페이스에 없으면 404 대신 `202 Accepted` 와 `{ executionId: 'ignored' }` 로 답하고 `chat_channel_health` 를 `degraded` 로 남긴다. 인터랙션 요청이면 `202` 대신 `200 OK` 와 기본 인터랙션 응답으로 답한다([채팅 채널 §인바운드 HTTP 응답 계약](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)).
- handshake 와 인터랙션 요청의 응답은 `200 OK` 로 직접 보내고 `{ data }` 봉투로 감싸지 않는다(`TransformInterceptor` 우회). handshake 는 Slack `url_verification` 의 `{ challenge }` 와 Discord PING 의 `{ type: 1 }` 이고 트리거가 활성일 때만 답한다. 인터랙션 요청은 서명 검증을 통과하면 트리거 활성 여부와 처리 결과(무시, 대기 실행에 전달, 새 실행, 새 실행 차단)에 상관없이 이 방식으로 답한다. 처리 경로가 따로 정한 응답이 있으면 그것을 기본 인터랙션 응답보다 먼저 쓴다. Discord 모달을 열면 `{ type: 9 }`, Form 모달 제출 결과는 `{ type: 4 }` 다. 응답 본문이 없으면(Slack Interactivity) 빈 본문을 보낸다.
- update 파싱, 무시 대상 판정, 진행 중인 실행에 인터랙션 전달, 대화 기록은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 정한다. 비활성 트리거의 응답과 서명 실패 `401` 을 포함한 응답 계약의 기준은 [채팅 채널 §인바운드 HTTP 응답 계약](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이다. 사용자에게 보내는 메시지와 버린 update 의 수신 확인 같은 프로바이더 API 호출도 채팅 채널 쪽이 정한다. 슬래시 명령의 수신 문구와 도움말은 위 기본 인터랙션 응답 본문에 실린다.

## 에러 처리

| 상황 | 처리 |
|------|------|
| 워크플로우가 지워짐 | 트리거의 `workflow_id` FK CASCADE 로 트리거도 지워져 404 가 된다 |
| 워크플로우가 비활성 | 트리거 활성 확인 바로 뒤, 인증 전에 `410 Gone`(`WORKFLOW_INACTIVE`)으로 답하고 실행을 만들지 않는다. 채팅 채널 트리거는 [채팅 채널 분기](#채팅-채널-분기) 를 따른다 |
| 트리거의 워크플로우가 다른 워크스페이스에 있음 | 저장 경계 이전에 남은 행이다. 엔드포인트가 없을 때와 같은 `404 TRIGGER_NOT_FOUND` 이고 실행을 만들지 않는다. 활성 확인과 인증을 통과한 뒤의 응답이다. 채팅 채널 트리거는 `202` ignored(인터랙션 요청이면 `200 OK` 와 기본 인터랙션 응답)다([채팅 채널 분기](#채팅-채널-분기)) |
| 실행 엔진 에러 | 500 Internal Server Error 를 응답하고 에러를 로그에 남긴다 |
| 동시 다발 요청 | 요청마다 독립된 실행을 만들어 병렬로 실행한다 |

## 구현 위치

- `codebase/backend/src/modules/hooks/hooks.controller.ts` (`POST /api/hooks/:endpointPath`. 채팅 채널 결과에 `interactionHttpResponse` 가 있으면 `200` 과 그 본문, `interactionEmptyResponse` 면 `200` 과 빈 본문, 그 밖에는 `202` 와 `{ data }` 봉투로 응답한다)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (트리거 조회, 워크플로우 활성 확인, 인증 검증 호출, 파라미터 추출, 실행 시작. 채팅 채널 분기 `handleChatChannelWebhook` 은 서명 검증 뒤 채널 어댑터의 `defaultInteractionResponse` 를 먼저 구해 비활성 트리거 응답과 처리 결과에 덧씌우고(`withDefaultInteractionResponse`) 새 실행을 시작하기 직전에 워크플로우 활성 상태를 확인한다)
- `codebase/backend/src/modules/chat-channel/types.ts` (채널 어댑터 훅 `defaultInteractionResponse` 의 계약. 프로바이더별 구현은 채팅 채널 문서가 정한다)
- `codebase/backend/src/modules/execution-engine/utils/is-workflow-inactive.ts` (워크플로우 활성 관문 `isWorkflowInactive`. 부르는 곳은 일반 웹훅, 채팅 채널, 스케줄 processor 세 곳이다)
- `codebase/backend/src/modules/hooks/hooks.service.spec.ts`, `codebase/backend/test/workflow-inactive-gate.e2e-spec.ts` (워크플로우가 비활성일 때: 일반 웹훅 410 `WORKFLOW_INACTIVE`, 채팅 채널 202 ignored, Discord PING 응답)
- `codebase/backend/src/modules/hooks/hooks.controller.spec.ts`, `codebase/backend/test/chat-channel-discord.e2e-spec.ts`, `codebase/backend/test/chat-channel-slack.e2e-spec.ts` (인터랙션 요청의 `200` 응답. 비활성 트리거의 Discord 버튼 클릭 · 슬래시 명령과 Slack `block_actions` 는 `200` 이고 실행이 없다. 비활성 트리거의 Discord PING 과 Slack Events API 메시지는 `202` 다)

## Rationale

### 꺼진 워크플로우의 웹훅 응답 (2026-10-10)

워크플로우를 비활성으로 바꾸면 웹훅과 채팅 채널 수신으로 새 실행이 생기지 않는다. 이 미결은 사용자가 2026-10-10 에 정했다(NERV Task `CLE-T-XRWFMJ`). 결정과 기각한 대안, handshake 에 답하는 이유, 진행 중인 대화를 막지 않는 이유, 트리거의 워크스페이스 안에서만 찾는 이유, 엔진이 아니라 호출부에서 확인하는 이유는 [트리거 데이터와 흐름](CLE-TRIG-DATA.md#꺼진-워크플로우를-실행-관문으로-둔-결정-2026-10-10) 이 기준이다. 이 문서는 수신 응답만 정한다.

- 일반 웹훅은 비활성 트리거와 같은 `410 Gone` 이고 코드는 새로 둔 `WORKFLOW_INACTIVE` 다(사용자 결정). 코드가 다르면 호출자와 운영자가 트리거와 워크플로우 가운데 무엇을 활성으로 바꿔야 하는지 응답만 보고 안다.
- 확인 자리는 비활성 트리거 확인 바로 뒤, 인증 앞이다. 두 비활성 응답이 같은 자리에서 나간다. 경로를 아는 호출자는 지금도 인증 없이 410 으로 트리거가 비활성임을 안다. 새 코드로 더 알 수 있는 것은 비활성인 쪽이 워크플로우라는 사실뿐이다.
- 채팅 채널은 비활성 트리거와 같은 `202` ignored(인터랙션 요청은 `200 OK`)다. provider 가 2xx 가 아닌 응답을 받으면 웹훅을 끄거나 재시도를 쏟아내는 사정([채팅 채널 분기](#채팅-채널-분기))이 그대로 적용된다.

### 꺼진 트리거도 인터랙션 요청에는 200 으로 답한다 (2026-11-12)

채팅 채널 트리거가 비활성이어도 서명 검증을 통과한 인터랙션 요청에는 `200 OK` 와 기본 인터랙션 응답으로 답한다. 실행은 시작하지 않는다. 사람 결정 Q2(NERV 질문 `01a1d025-8baf-773f-95fd-201820c7cd5f`, 2026-11-12)이고 구현은 NERV Task `CLE-T-TSEP9G` · `CLE-T-FCBG91` 이 했다. 상세 규칙은 [채팅 채널 「인바운드 HTTP 응답 계약」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약) 이 정한다.

- 이 결정 전에는 비활성 트리거가 모든 프로바이더에 `202` 와 `{ executionId: 'ignored' }` 로 답했다. Discord 와 Slack 은 인터랙션마다 3초 안에 `200` 과 정해진 본문을 받아야 하고 받지 못하면 사용자 화면에 실패 표시를 띄운다. 그래서 트리거를 끈 동안 사용자가 이전 메시지의 버튼을 누르거나 슬래시 명령을 쓰면 매번 실패 표시가 떴다.
- 기본 인터랙션 응답은 요청 본문만 보고 만들고 외부 호출이 없다. 실행도 만들지 않으므로 트리거를 끈 뜻과 어긋나지 않는다.
- 같은 결정으로 비활성 트리거는 수신 확인을 포함해 프로바이더 API 를 부르지 않는다. Telegram 의 버린 버튼 클릭 수신 확인(`answerCallbackQuery`)은 API 호출이라 트리거가 활성일 때만 보낸다.
- Discord 슬래시 명령도 인터랙션 요청이다. 응답 모양은 사람 결정 Q1(NERV 질문 `01a1d025-899f-7709-b759-4f7bf6c16ef5`)대로 본인에게만 보이는 `{ type: 4 }` 메시지다. 그래서 슬래시 명령으로 새 실행을 시작하면 `response_code` 가 `'202'` 에서 `'200'` 으로 바뀌었다.
- Slack 슬래시 명령도 뒤의 사람 결정(NERV 질문 `01a1d2f3-e188-7354-8298-243092419a3c`, NERV Task `CLE-T-MGZRRP`)으로 인터랙션 요청에 넣었다. Discord 슬래시 명령과 같이 모든 경로에서 `{ response_type: 'ephemeral', text }` 로 답하고 새 실행의 `response_code` 는 `'200'` 이다. 문구와 `help` 처리는 [Slack 어댑터 「인바운드 응답」](../CLE-CHAT/CLE-CHAT-SLACK.md#인바운드-응답) 이 정한다.
- handshake(Discord PING · Slack `url_verification`)는 인터랙션 요청이 아니라 이 결정에 들지 않는다. 비활성 트리거는 지금처럼 `202` 로 답하고 그동안 URL 등록은 실패한다. 비활성 트리거가 handshake 에 답할지는 [트리거 데이터와 흐름 「미결 사항」](CLE-TRIG-DATA.md#미결-사항) 에 남아 있다.
- 판단 자리는 채널 어댑터 훅 `defaultInteractionResponse` 다. `HooksService` 는 프로바이더를 가리지 않고 그 값을 비활성 트리거 응답과 처리 결과에 덧씌운다.
- 기각한 대안: 비활성 트리거는 인터랙션 요청에도 `202` 를 유지하는 안. 응답 규칙은 단순하지만 위의 실패 표시가 그대로 남는다.
- 기각한 대안: Discord 슬래시 명령에 `{ type: 5 }`(지연 응답)로 답하는 안. 지연 응답 뒤에는 프로바이더 API 로 후속 메시지를 보내야 한다. 비활성 트리거와 버린 명령에서는 보낼 메시지가 없어 Discord 화면에 응답 대기 표시가 남는다.
- 기각한 대안: 비활성 트리거에서도 버린 버튼 클릭에 수신 확인 API 를 부르는 안. Telegram 클라이언트의 로딩 표시는 사라지지만 트리거를 끈 뒤에도 외부 호출이 나간다. Q2 는 외부 호출을 하지 않는 쪽을 골랐다.
