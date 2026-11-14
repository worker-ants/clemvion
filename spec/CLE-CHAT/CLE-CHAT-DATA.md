---
id: "CLE-CHAT-DATA"
title: "채팅 채널 데이터와 흐름"
type: "design"
version: 16
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT"]
area: "CLE-CHAT"
content_hash: "d4f92685765bf53c52723a93b8f14676a858e67b12cd13daf0235a7f0f32f723"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/15-chat-channel.md", "spec/data-flow/14-chat-channel.md"]
mirror_sha256: "5b689bbf40ee06cda21bf16ef94fa6cc67c5dce7079562a8f1caff87899809a0"
etag: "sha256-abd3656e9e8ed01a3fee2d55da25c0b956c1a448aa9667df8046eb035ff71a23"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/15-chat-channel.md` (§4 데이터 모델), `spec/data-flow/14-chat-channel.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [채팅 채널](CLE-CHAT-CORE.md) 이 저장하는 데이터와 그 데이터가 흐르는 경로의 입구다. 주제별 내용은 [하위 문서](#하위-문서) 가 맡는다. 이 문서에서 단독으로 쓴 「프로바이더」 는 채널 프로바이더를 뜻한다.

저장 모델의 핵심 사실이 하나 있다. 채널 대화 상태는 Postgres 테이블이 아니라 Redis 키-값(`chat-channel:{triggerId}:{conversationKey}`, TTL(Time To Live) 7일)이다. Redis 를 쓸 수 없으면 조용히 기능을 낮춘다(조회는 null, 저장은 no-op 이라 update 마다 새 실행이 시작된다). 영속 데이터는 `trigger` 테이블의 `chat_channel_*` 컬럼 5개와 `trigger.config.chatChannel` JSON, 그리고 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 행뿐이다.

이 문서가 정하지 않는 것: 웹훅 진입에서 채팅 채널로 갈라지는 지점은 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 이 정한다. 요구사항과 API 계약은 [채팅 채널](CLE-CHAT-CORE.md), 채널 프로바이더별 응답 JSON·서명 알고리즘·Form 모달 세부는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 과 프로바이더 문서가 정한다. 웹채팅 위젯은 채팅 채널 모듈을 거치지 않는다([웹채팅 경로](#웹채팅-경로)).

## 하위 문서

아래 요구사항 번호는 하위 문서가 뒷받침하는 다른 문서의 요구사항이다(이 문서는 요구사항 줄을 정의하지 않는다).

- [채팅 채널 데이터와 흐름 — 설정과 안내 문구](CLE-CHAT-DATA-CONFIG.md): `Trigger.config.chatChannel` 필드 계약, `languageHints` 키와 locale 기본 문구, 제어 안내의 프로바이더별 escape. 관련 요구사항: [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) REQ-TRIG-053
- [채팅 채널 데이터와 흐름 — 저장 모델과 상태](CLE-CHAT-DATA-STORE.md): `trigger` 의 `chat_channel_*` 컬럼, 채널 대화 상태, Redis 키 · pub/sub 채널, 채널 대화 상태 전이와 채널 건강도. 관련 요구사항: [채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-062(채널 대화 상태의 `/start` 예외), REQ-CHAT-073(`chat-channel:listener` pub/sub 실패 정책), REQ-CHAT-071 · 072(같은 pub/sub 의 전파 규칙)
- [채팅 채널 데이터와 흐름 — 인바운드·아웃바운드 흐름](CLE-CHAT-DATA-FLOW.md): 인바운드 흐름(관문 · command 별 처리 · 큐 적재 실패 · 서명 자료 참조가 없는 행)과 아웃바운드 흐름(dispatcher · 트리거 단위 listener 레지스트리). 관련 요구사항: [채팅 채널](CLE-CHAT-CORE.md) REQ-CHAT-062~064(`/start` 의 기존 실행 취소가 실패할 때), REQ-CHAT-065(종결 이벤트의 compare-and-set 정리), REQ-CHAT-066(워크플로우가 비활성일 때의 새 대화), REQ-CHAT-069(Form 입력 대기의 채널 대화 상태 갱신 가드), REQ-CHAT-074 · 075(`/cancel` 처리), REQ-CHAT-076(재개 명령의 큐 적재 실패), REQ-CHAT-080(버린 update 의 인터랙션 기본 응답), REQ-CHAT-081(`ackDroppedUpdate` 를 부르지 않는 경우)
- [채팅 채널 데이터와 흐름 — 봇 토큰 라이프사이클](CLE-CHAT-DATA-TOKEN.md): 봇 토큰 최초 setup · PATCH · 재발급 6단계 · 실패 되돌리기 · 24시간 유예 정리와 유예 중 재발급

## Trigger.config.chatChannel

→ [채팅 채널 데이터와 흐름 — 설정과 안내 문구](CLE-CHAT-DATA-CONFIG.md#triggerconfigchatchannel)

## 트리거 컬럼

→ [채팅 채널 데이터와 흐름 — 저장 모델과 상태](CLE-CHAT-DATA-STORE.md#트리거-컬럼)

## 안내 문구 기본값

→ [채팅 채널 데이터와 흐름 — 설정과 안내 문구](CLE-CHAT-DATA-CONFIG.md#안내-문구-기본값)

## 채널 대화 상태

→ [채팅 채널 데이터와 흐름 — 저장 모델과 상태](CLE-CHAT-DATA-STORE.md#채널-대화-상태)

## Redis 키

→ [채팅 채널 데이터와 흐름 — 저장 모델과 상태](CLE-CHAT-DATA-STORE.md#redis-키)

## 채널 건강도

→ [채팅 채널 데이터와 흐름 — 저장 모델과 상태](CLE-CHAT-DATA-STORE.md#채널-건강도)

## 인바운드 서명 자료 참조가 없는 행

→ [채팅 채널 데이터와 흐름 — 인바운드·아웃바운드 흐름](CLE-CHAT-DATA-FLOW.md#인바운드-서명-자료-참조가-없는-행)

## 봇 토큰 라이프사이클

→ [채팅 채널 데이터와 흐름 — 봇 토큰 라이프사이클](CLE-CHAT-DATA-TOKEN.md#봇-토큰-라이프사이클)

## 웹채팅 경로

웹채팅은 채팅 채널이 아니다. 위젯은 채널 어댑터가 아니라 EIA 의 순수 외부 HTTP 소비자라 채팅 채널 모듈을 거치지 않는다. 위젯 부팅(`GET /api/hooks/:endpointPath/embed-config` 공개 조회), 대화 시작(일반 웹훅 경로와 202 응답의 인터랙션 토큰), 실시간 수신(`/api/external/executions/:id/stream` SSE(Server-Sent Events)와 `interact`)은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 의 흐름을 그대로 쓴다.

웹채팅의 서버 쪽 구성 요소와 그 쓰기 경로는 [웹채팅 구조 §서버 쪽 구성 요소](../CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md#서버-쪽-구성-요소) 가 목록의 기준이다. 임베드 설정 공개 조회, `/api/external/*` 경로별 CORS 처리, 공개 웹훅 가드(`PublicWebhookThrottleGuard`)가 있고, 실행 상태를 바꾸는 쓰기 경로는 유휴 입력 대기 회수(`WebChatIdleReaperService`, BullMQ `webchat-idle-reaper`)뿐이다. 회수 규칙은 [External Interaction API](../CLE-IX/CLE-EIA.md) 가 정한다.

임베드 허용 목록과 `/api/external/*` CORS 허용 목록은 같은 키(`workspace.settings.interactionAllowedOrigins`, [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md))를 쓰지만 빈 목록일 때의 뜻이 다르다. 그 차이는 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 이 정한다.

## 외부 의존

| 의존 | 방향 | 참고 |
|---|---|---|
| 트리거 | 인바운드 진입 | 웹훅 분기([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)) |
| 실행 | 양방향 | 새 대화의 `execute()` 진입과 실행 이벤트 아웃바운드([실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md)) |
| EIA(`InteractionService`) | 인바운드 재개 | 내부 신뢰 호출(`scope: 'in_process_trusted'`)로 서버 안 전달([External Interaction API 「내부 신뢰 호출」](../CLE-IX/CLE-EIA.md#내부-신뢰-호출)). 실행 토큰·SSE·EIA 알림 웹훅 흐름은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| 시크릿 저장소 | 토큰 보관 | `secret://triggers/{id}/...` 참조 세 가지([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)) |
| Telegram API | 아웃바운드·setup | `setWebhook`(setup), `sendMessage` 등(아웃바운드). 인바운드 검증은 `X-Telegram-Bot-Api-Secret-Token` 동일성 |
| Slack API | 아웃바운드·모달·정리 | `auth.test`·`views.open`·`chat.postMessage`, `auth.revoke`(유예 종료 정리, 유예 중 재발급으로 덮인 토큰 폐기). 인바운드 검증은 `X-Slack-Signature` HMAC |
| Discord API | 아웃바운드·setup | 애플리케이션 메타데이터. 모달은 웹훅 HTTP 응답 본문으로 돌려준다. 인바운드 검증은 `X-Signature-Ed25519` |

## 미결 사항

- **`languageHints` 키 목록**: 프로바이더 문서가 참조하는 `executionCancelled`(Telegram 일반 취소 안내)와 `formModalTitle`(Discord 모달 제목 fallback)이 필드 목록에 없다. 코드에는 `slashPrefix` 키도 있다(현재 구현). Discord 기본 도움말은 이 값을 명령 이름으로 쓰고 값이 없으면 `workflow` 를 쓴다. Slack 은 이 키를 쓰지 않고 요청의 `command` 를 쓴다. 목록에 올리고 기본 문구를 둘지 결정 필요.
- **인바운드 서명 자료 참조가 없는 행의 검증 생략**: [인바운드 서명 자료 참조가 없는 행](CLE-CHAT-DATA-FLOW.md#인바운드-서명-자료-참조가-없는-행) 의 현행 동작을 401 로 막을지 NERV Task `CLE-T-AAGZRW` 가 운영 데이터를 잰 뒤 정한다.
- **TTL 만료 뒤 남는 입력 대기 실행**: 채널 대화 상태의 TTL 이 만료되면 그 값이 가리키던 입력 대기 실행을 끝내는 경로가 없다. 활성 실행에 입력을 전달하기만 할 때는 TTL 을 다시 걸지 않는다. 이 실행의 회수 여부와 TTL 을 다시 거는 시점을 정해야 한다. 지금 동작은 [Rationale](CLE-CHAT-DATA-STORE.md#rationale) 의 「채널 대화 상태를 Redis 에만 둔다」 에 있다.

## 구현 위치

- `codebase/backend/src/modules/web-chat-cors/web-chat-cors-origin.resolver.ts`, `codebase/backend/src/modules/hooks/embed-config.service.ts`: 웹채팅 경로(소유 문서는 웹채팅)

## Rationale

### 웹채팅을 채팅 채널 모듈 밖에 둔다

위젯은 서버 쪽 채널 어댑터(봇 토큰, 서명 검증, 프로바이더 API)가 필요 없는 브라우저 클라이언트다. 그래서 채널 어댑터 인터페이스 대신 EIA 표면(웹훅 202 의 인터랙션 토큰, `interact`·SSE)을 그대로 쓴다. 채팅 채널을 EIA 소비자로만 둔 결정([채팅 채널 「R2 채팅 채널을 EIA 의 소비자로만 둔다」](CLE-CHAT-CORE.md#r2-채팅-채널을-eia-의-소비자로만-둔다))과 대칭이다. 웹채팅의 서버 쪽 구성 요소 목록은 [웹채팅 구조](../CLE-WEBCHAT/CLE-WEBCHAT-ARCH.md) 가 정한다.
