---
id: "CLE-EIA"
title: "External Interaction API"
type: "feature"
version: 8
status: "approved"
requirements: ["REQ-EIA-001", "REQ-EIA-002", "REQ-EIA-003", "REQ-EIA-004", "REQ-EIA-005", "REQ-EIA-006", "REQ-EIA-007", "REQ-EIA-008", "REQ-EIA-009", "REQ-EIA-010", "REQ-EIA-011", "REQ-EIA-012", "REQ-EIA-013", "REQ-EIA-014", "REQ-EIA-015", "REQ-EIA-016", "REQ-EIA-017", "REQ-EIA-018", "REQ-EIA-019", "REQ-EIA-020", "REQ-EIA-021", "REQ-EIA-022", "REQ-EIA-023", "REQ-EIA-024", "REQ-EIA-025", "REQ-EIA-026", "REQ-EIA-027", "REQ-EIA-028", "REQ-EIA-029", "REQ-EIA-030", "REQ-EIA-031", "REQ-EIA-032", "REQ-EIA-033", "REQ-EIA-034", "REQ-EIA-035", "REQ-EIA-036", "REQ-EIA-037", "REQ-EIA-038", "REQ-EIA-039", "REQ-EIA-040", "REQ-EIA-041", "REQ-EIA-042"]
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "822cd00c24c23c144b0ce81e9515a2cea26cf341f81248e912a513c7a61ce4c7"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/14-external-interaction-api.md"]
mirror_sha256: "afc1247d1349e04ae840cc48f1b880bed994d810ca898b52131a8d1d67330d9d"
etag: "sha256-bbeff335640d4b9fc870af1ecd8373216fcbc2d272af162477f20fa6621480ad"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/14-external-interaction-api.md` (§1~§4, §8.3~§8.5, §9, §10, §12, Rationale R1·R4·R7·R9·R10·R15·R19) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

워크플로우가 외부 시스템(웹훅 트리거·외부 자동화·서드파티 봇)에서 시작되면, 실행 중에 사용자 입력이 필요한 노드(Form, 버튼이 있는 Presentation 노드, AI Agent 멀티턴, 정보 추출기 노드 멀티턴)를 만날 수 있다. 그때 호출자는 실행이 입력 대기(waiting for input, `waiting_for_input`)로 멈춘 사실을 알 수 없고, 대화 턴을 주고받을 수단도 없다. 내부 WebSocket 채널은 워크스페이스 JWT 로만 인증하므로 외부 호출자가 쓸 수 없기 때문이다.

External Interaction API(EIA, `/api/external/*`)는 이 간극을 두 채널로 메운다.

- **EIA 알림 웹훅**(Outbound Notification Webhook, `config.notification`): 서버가 실행 이벤트(`waiting_for_input`·`completed`·`failed`·`cancelled`·`ai_message`)를 외부 URL 로 HMAC 서명해 보낸다. 자세한 계약은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 에서 정한다.
- **인바운드 인터랙션**(Inbound Interaction): 외부 클라이언트가 REST 로 인터랙션 명령(`submit_form`·`click_button`·`submit_message`·`end_conversation`·`cancel`)을 보내고 SSE 로 실행 이벤트를 받는다. 자세한 계약은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 에서 정한다.

두 채널은 모두 선택 사항이다. 트리거마다 둘 다 켜거나, 하나만 켜거나, 둘 다 끌 수 있다. 내부 처리는 WebSocket 명령·이벤트 경로([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md))를 그대로 다시 쓰는 facade 로 구현해 두 경로가 갈라지지 않게 한다.

이 문서는 두 채널의 공통 부분의 입구다. 사용 시나리오, 채널 공통 요구사항(인터랙션 토큰·신뢰성·이벤트 순번·레이트 리밋·CORS), 커밋 뒤 발송 규칙, 호환성, 공통 결정의 근거가 여기 있다. 트리거 설정 · 웹훅 응답 · 토큰 규칙은 [트리거 설정과 인터랙션 토큰](CLE-EIA-TOKEN.md), 레이트 리밋 · CORS · 처리 흐름 · 토큰 정리 작업은 [처리 흐름과 한도](CLE-EIA-FLOW.md) 가 정한다.

범위 밖: 엔티티·저장소·데이터 흐름은 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 외부로 나가는 값의 자격 증명 가리기는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md), EIA 를 쓰는 서버 어댑터와 임베드 위젯은 [채팅 채널](../CLE-CHAT/CLE-CHAT.md) 과 [웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md) 이 정한다. 웹훅 진입 자체(인증·입력 구조)는 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 소관이다.

## 사용 시나리오

| 시나리오 | 쓰는 채널 | 설명 |
|---|---|---|
| 서버 간 자동화에 사람 결재가 필요한 경우 | 알림 웹훅 + 인바운드(`interaction.enabled`) | 외부 서버가 웹훅으로 워크플로우를 시작하고 웹훅 응답에서 인터랙션 토큰을 받는다([웹훅 호출 응답 확장](#웹훅-호출-응답-확장)). Form 에 도달하면 EIA 알림 웹훅을 받아 자체 UI 로 안내하고 그 토큰으로 REST 로 폼을 제출한다. 알림 웹훅에 토큰과 제출 경로를 싣는 인터랙션 안내 블록(REQ-EIANOTI-033)은 아직 구현되지 않았다. |
| 외부 챗봇(Telegram·Slack·카카오) 위에 워크플로우 얹기, 변환층을 사용자가 직접 구현 | 알림 웹훅 + 인바운드 | `config.chatChannel` 을 쓰지 않는다. 봇 메시지로 웹훅을 불러 실행을 시작하고, AI 멀티턴에 들어가면 알림으로 어시스턴트 응답을 받고, 사용자 메시지마다 REST `submit_message` 를 보낸다. 특이한 통합이나 지원하지 않는 메신저도 운영할 수 있다. |
| 외부 챗봇, 서버 어댑터 사용 | 알림 웹훅 + 인바운드(어댑터가 자동화) | 웹훅 트리거에 `config.chatChannel` 만 등록하면 Telegram 등과 자동으로 연결된다. 어댑터가 서버 안에서 EIA 이벤트를 받아 메신저 메시지로 바꾸고, 서버 안에서 인바운드 명령을 부른다. 사용자 코드가 필요 없다. 자세한 내용은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 에서 정한다. |
| 외부 SaaS 가 채팅 위젯을 호스팅 | 인바운드만(SSE + REST) | 웹훅 응답으로 받은 토큰으로 SSE 스트림을 열고 REST 명령을 보낸다. 알림 웹훅은 쓰지 않는다. |
| 인터랙션 없는 단순 자동화 | 둘 다 쓰지 않음 | 기존 웹훅 그대로다. |

## 요구사항

인바운드 명령·SSE·상태 조회의 요구사항은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md), 알림 발송의 요구사항은 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 에 있다. 아래는 두 채널이 함께 따르는 요구사항이다.

### 트리거 등록과 웹훅 응답

- REQ-EIA-001 WHEN 트리거 설정에 `notification` 이나 `interaction` 그룹이 없으면 THE SYSTEM SHALL 그 채널을 쓰지 않는 것으로 해석하고 기존 웹훅 동작을 그대로 유지한다. (원본: §1, §12)
- REQ-EIA-002 WHEN `interaction.enabled=true` 인 웹훅 트리거가 호출되면 THE SYSTEM SHALL 202 응답에 `status` 와 `interaction.endpoints`(stream·submit·status·cancel·refresh 다섯 경로)를 함께 싣는다. (원본: §4.1, §9.2 · 응답 모양의 기준은 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api))
- REQ-EIA-003 WHEN 그 트리거의 `tokenStrategy` 가 `per_execution` 이면 THE SYSTEM SHALL `interaction` 블록에 새 실행 단위 토큰(`token`)과 `expiresAt` 을 함께 싣는다. (원본: §4.1)
- REQ-EIA-004 WHEN PATCH 로 `interaction` 객체를 보내면 THE SYSTEM SHALL 사용자가 정하는 `interaction` 필드를 병합하지 않고 통째로 바꾸고 서버가 만든 `triggerToken` 은 요청에서 받지 않는다. (원본: §4 · 토큰을 정하는 규칙은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약))
- REQ-EIA-005 WHEN 트리거를 만들거나 PATCH 가 EIA 알림 웹훅 설정을 처음 붙여서 서버가 알림 서명 시크릿(`wsk_*`)을 발급하면 THE SYSTEM SHALL 그 평문을 그 응답의 `data.secrets.notificationSigningSecret` 에 한 번만 싣고 이후 응답에는 싣지 않는다. (원본: EIA-AU-01 · 발급 조건과 저장된 옛 평문 처리는 [EIA 알림 웹훅 「요구사항」](CLE-EIA-NOTIFY.md#요구사항) 의 REQ-EIANOTI-037)

### 인터랙션 토큰

- REQ-EIA-006 WHEN 트리거에 인터랙션을 켜면 THE SYSTEM SHALL 인바운드 인증에 실행 단위 토큰(`iext_*`, 실행 하나에 묶인 1시간 JWT)과 트리거 단위 토큰(`itk_*`, 트리거의 모든 실행에 쓰는 영구 토큰) 중 `tokenStrategy` 가 고른 하나를 쓴다. (원본: EIA-AU-02)
- REQ-EIA-007 IF `tokenStrategy` 를 지정하지 않으면 THE SYSTEM SHALL `per_execution` 을 쓴다. (원본: EIA-AU-03)
- REQ-EIA-008 WHEN 실행이 종료(`completed`·`failed`·`cancelled`)되면 THE SYSTEM SHALL 그 실행에 발급한 실행 단위 토큰을 즉시 무효로 만든다. (원본: EIA-AU-04)
- REQ-EIA-009 WHILE 실행 단위 토큰의 만료가 30분 이내이고 실행이 살아 있는 동안 THE SYSTEM SHALL `POST /api/external/executions/:id/refresh-token` 으로 토큰 갱신을 허용한다. (원본: EIA-AU-05)
- REQ-EIA-010 WHEN 트리거가 삭제되면 THE SYSTEM SHALL 그 트리거 단위 토큰을 무효로 만들고 그 토큰으로 연 SSE 스트림을 닫는다. (원본: EIA-AU-07)
- REQ-EIA-011 WHEN `POST /api/triggers/:id/interaction/revoke-token` 이 호출되면 THE SYSTEM SHALL 새 트리거 단위 토큰을 발급하고 옛 토큰을 새 요청에 대해 즉시 무효로 만들며 옛 토큰으로 연 SSE 스트림을 닫는다. (원본: EIA-AU-07)
- REQ-EIA-012 WHEN 트리거 단위 토큰을 재발급하면 THE SYSTEM SHALL 감사 로그에 `trigger.interaction_token_revoked` 를 남긴다. (원본: EIA-AU-07)
- REQ-EIA-038 WHEN 인터랙션을 켜고(`interaction.enabled=true`) 전략이 `per_trigger` 인 트리거를 만들면 THE SYSTEM SHALL 트리거 단위 토큰(`itk_*`)을 발급해 그 평문을 생성 응답의 `data.secrets.interactionToken` 에 한 번만 싣는다. (2026-10-17 결정 · [생성과 PATCH 응답에 싣는 일회성 비밀](#생성과-patch-응답에-싣는-일회성-비밀-2026-10-17))
- REQ-EIA-039 WHEN 최상위 `interaction` 을 바꾼 PATCH 의 결과가 인터랙션을 켠 `per_trigger` 전략이고 저장된 트리거 단위 토큰이 없으면 THE SYSTEM SHALL 트리거 단위 토큰을 발급해 그 평문을 그 PATCH 응답의 `data.secrets.interactionToken` 에 한 번만 싣는다. (2026-10-17 결정)
- REQ-EIA-040 WHEN PATCH 결과가 `per_trigger` 전략이고 저장된 트리거 단위 토큰이 있으면 THE SYSTEM SHALL 그 토큰을 이어받고 새 토큰을 발급하지 않는다. (2026-10-17 결정)
- REQ-EIA-041 WHEN PATCH 가 전략을 `per_trigger` 에서 다른 값으로 바꾸면 THE SYSTEM SHALL 저장된 트리거 단위 토큰을 지우고 그 토큰으로 연 SSE 스트림을 닫는다. (2026-10-09 결정 · [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약))
- REQ-EIA-042 WHEN PATCH 가 `per_trigger` 전략인 트리거의 인터랙션을 끄면 THE SYSTEM SHALL 트리거 단위 토큰 값은 남기고 그 토큰으로 오는 요청을 401 로 거부하며 그 토큰으로 연 SSE 스트림을 닫는다. (2026-10-09, NERV Task `CLE-T-M6PERB` 구현 코드 리뷰 질문에 대한 사용자 답(finding `01a11f6b-cc1a-7129-a666-0fb29b2a4849`))
- REQ-EIA-013 WHEN 서버 프로세스 안의 신뢰 호출자가 `InteractionService.interact()` 를 직접 부르면 THE SYSTEM SHALL 토큰 발급과 검증을 건너뛴다. (원본: EIA-AU-08)
- REQ-EIA-014 IF 요청이 HTTP 로 들어오면 THE SYSTEM SHALL 내부 신뢰 호출 예외를 적용하지 않고 인터랙션 토큰 인증을 그대로 요구한다. (원본: EIA-AU-08, EIA-IN-06)
- REQ-EIA-015 WHEN HTTP 진입점 가드가 요청 컨텍스트를 합성하면 THE SYSTEM SHALL `scope` 필드를 설정하지 않는다. (원본: §3.3.1-1)
- REQ-EIA-016 WHEN HTTP 요청 본문·헤더·쿼리·경로 값을 역직렬화하면 THE SYSTEM SHALL `scope` 필드를 제거한다. (원본: §3.3.1-2)
- REQ-EIA-017 WHILE `iext_*` 를 서명·검증하는 동안 THE SYSTEM SHALL HS256 과 `INTERACTION_JWT_SECRET`, 그것이 없으면 `JWT_SECRET` 을 쓴다. (원본: §8.3)
- REQ-EIA-018 IF `NODE_ENV=production` 에서 `INTERACTION_JWT_SECRET` 과 `JWT_SECRET` 이 모두 없거나, 설정한 `INTERACTION_JWT_SECRET` 이 [세션과 토큰 「운영 환경 가드」](../CLE-ACCT/CLE-ACCT-SESSION.md#운영-환경-가드) 가 막는 값이면 THE SYSTEM SHALL 서버 부팅을 막는다. (원본: §8.3)
- REQ-EIA-019 IF 개발 환경에서 두 시크릿이 모두 없으면 THE SYSTEM SHALL 프로세스 시작 때 한 번 만든 임시 무작위 키로 서명한다. (원본: §8.3)
- REQ-EIA-020 WHEN 인바운드 요청이 토큰을 보내면 THE SYSTEM SHALL `Authorization: Bearer` 헤더로만 받고, 쿼리 파라미터(`?token=`)는 SSE 스트림에만 허용한다. (원본: §8.3)
- REQ-EIA-021 WHILE 운영 환경인 동안 THE SYSTEM SHALL EIA 경로에 HTTPS 를 강제한다. (원본: §8.3)

### 신뢰성과 이벤트 순번

- REQ-EIA-022 WHEN 실행과 노드 실행의 상태 변경 트랜잭션이 커밋되면 THE SYSTEM SHALL 그 뒤에만 EIA 알림 웹훅 발송과 SSE 이벤트를 내보낸다. (원본: EIA-RL-04)
- REQ-EIA-023 IF 상태 변경 트랜잭션이 롤백되면 THE SYSTEM SHALL 어떤 외부 발송도 하지 않는다. (원본: §9.3)
- REQ-EIA-024 WHEN 같은 실행의 이벤트를 SSE 와 알림 웹훅으로 보내면 THE SYSTEM SHALL 두 채널에 같은 이벤트 순번(`seq`)을 싣는다. (원본: EIA-RL-05)
- REQ-EIA-025 WHILE Redis 를 쓸 수 있는 동안 THE SYSTEM SHALL 여러 인스턴스가 같은 실행의 이벤트를 동시에 내보내도 초당 1000건 부하에서 이벤트 순번을 중복·역전 없이 단조 증가시킨다. (원본: EIA-NF-06)
- REQ-EIA-026 IF Redis 를 쓸 수 없으면 THE SYSTEM SHALL 인스턴스별 메모리 카운터로 이벤트 순번을 이어 가고 인스턴스 사이의 단조성은 보장하지 않는다. (원본: EIA-NF-06)
- REQ-EIA-027 WHEN 이벤트마다 순번을 발급하면 THE SYSTEM SHALL 단일 인스턴스에서 메모리 기준선 대비 추가 지연을 중앙값 5ms 미만으로 유지한다. (원본: EIA-NF-07)
- REQ-EIA-028 WHEN 실행이 종료되면 THE SYSTEM SHALL 엔진 종료 이벤트 구독으로 그 실행의 모든 인터랙션 토큰을 즉시 폐기하고, 분 단위 정리 작업으로 남은 토큰을 다시 폐기해 최소 한 번의 폐기를 보장한다. (원본: EIA-RL-06)
- REQ-EIA-029 WHILE 공개 웹훅 트리거(`auth_config_id IS NULL`)가 시작한 실행이 실행 단위 토큰으로만 접근되며 입력 대기인 동안, 발급한 모든 토큰이 만료되고 유예 시간(`WEBCHAT_IDLE_REAP_GRACE_MS`, 기본 3600000ms)이 지나면 THE SYSTEM SHALL 그 실행을 `cancelled`(`cancelledBy='timeout'`, `error.code='WEBCHAT_IDLE_TIMEOUT'`)로 회수한다. (원본: EIA-RL-07)
- REQ-EIA-030 IF 실행을 시작한 트리거에 인증 설정이 연결돼 있거나 그 실행에 실행 토큰 행이 하나도 없으면 THE SYSTEM SHALL 그 실행을 입력 대기 회수 대상에서 뺀다. 토큰 행이 없는 실행은 트리거 단위 토큰을 쓰는 실행, 채팅 채널 실행, 인터랙션을 켜지 않은 웹훅 실행이다. (원본: EIA-RL-07)

### 레이트 리밋과 CORS

- REQ-EIA-031 WHEN 한 실행에 인바운드 명령(`/interact`, `/cancel` 합산)이 분당 60건을 넘으면 THE SYSTEM SHALL `429 RATE_LIMITED` 와 `Retry-After` 를 돌려준다. (원본: §8.4)
- REQ-EIA-032 WHEN 한 실행에 단발 상태 조회가 분당 120건을 넘으면 THE SYSTEM SHALL `429 RATE_LIMITED` 와 `Retry-After` 를 돌려준다. (원본: §8.4)
- REQ-EIA-033 IF 레이트 리밋 카운터용 Redis 를 쓸 수 없으면 THE SYSTEM SHALL 요청을 허용한다. (원본: §8.4)
- REQ-EIA-034 WHEN 브라우저가 `/api/external/executions/:id` 이하 경로를 부르면 THE SYSTEM SHALL 워크스페이스의 `interactionAllowedOrigins` 와 공식 웹채팅 위젯 배포 주소에 있는 origin 만 CORS 로 허용한다. (원본: §8.5)
- REQ-EIA-035 IF 워크스페이스에 `interactionAllowedOrigins` 가 없으면 THE SYSTEM SHALL 공식 위젯 배포 주소 밖의 브라우저 호출을 CORS 로 막는다. (원본: §8.5)

### 호환성

- REQ-EIA-036 WHEN 인터랙션 토큰(`iext_*`·`itk_*`)으로 재실행 API(`POST /api/executions/:id/re-run`)를 부르면 THE SYSTEM SHALL 거부하고 워크스페이스 JWT 만 받는다. (원본: §12)
- REQ-EIA-037 WHILE EIA 를 쓰는 동안 THE SYSTEM SHALL 내부 WebSocket 채널(`/ws`)의 명령·이벤트 흐름을 바꾸지 않는다. (원본: §12)


## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|---|---|---|
| [트리거 설정과 인터랙션 토큰](CLE-EIA-TOKEN.md) | 트리거 등록 페이로드의 `notification` · `interaction` 그룹, 생성 · PATCH 응답의 일회성 비밀(`data.secrets`), 웹훅 202 응답의 인터랙션 블록, 실행 단위 · 트리거 단위 토큰, 서명 비밀, 내부 신뢰 호출 | REQ-EIA-002 ~ 021, REQ-EIA-038 ~ 042 |
| [처리 흐름과 한도](CLE-EIA-FLOW.md) | 실행별 레이트 리밋과 Redis 키, CORS, 폼 입력 · AI 멀티턴 처리 흐름, 종료 시 토큰 폐기, 공개 위젯의 입력 대기 회수, API 문서화 | REQ-EIA-028 ~ 035 |

커밋 뒤 발송(REQ-EIA-022 · 023)과 이벤트 순번(REQ-EIA-024 ~ 027)의 본문 · 근거, 호환성(REQ-EIA-001 · 036 · 037)의 근거는 이 문서에 있다. REQ-EIA-001 이 말하는 `notification` · `interaction` 그룹의 형태는 [트리거 등록 페이로드 확장](CLE-EIA-TOKEN.md#트리거-등록-페이로드-확장) 이 정한다. 트리거 단위 토큰 발급의 트리거 관리 쪽 요구사항은 [트리거 관리 「요구사항」](../CLE-TRIG/CLE-TRIG-MANAGE.md#요구사항) 의 REQ-TRIG-055(생성) · 056(PATCH) 이다.

## 트리거 등록 페이로드 확장

→ [트리거 등록 페이로드 확장](CLE-EIA-TOKEN.md#트리거-등록-페이로드-확장)

## 웹훅 호출 응답 확장

→ [웹훅 호출 응답 확장](CLE-EIA-TOKEN.md#웹훅-호출-응답-확장)

## 인터랙션 토큰

→ [인터랙션 토큰](CLE-EIA-TOKEN.md#인터랙션-토큰)

### 내부 신뢰 호출

→ [내부 신뢰 호출](CLE-EIA-TOKEN.md#내부-신뢰-호출)

## 레이트 리밋

→ [레이트 리밋](CLE-EIA-FLOW.md#레이트-리밋)

## CORS

→ [CORS](CLE-EIA-FLOW.md#cors)

## 처리 흐름

폼 입력 · AI 멀티턴 흐름은 [처리 흐름](CLE-EIA-FLOW.md#처리-흐름) 이 정한다.

### 실행 단위 토큰으로 폼 입력 받기

→ [실행 단위 토큰으로 폼 입력 받기](CLE-EIA-FLOW.md#실행-단위-토큰으로-폼-입력-받기)

### 트리거 단위 토큰으로 AI 멀티턴 대화

→ [트리거 단위 토큰으로 AI 멀티턴 대화](CLE-EIA-FLOW.md#트리거-단위-토큰으로-ai-멀티턴-대화)

### 트랜잭션과 발송 순서

[실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 가 정한 원자성을 지킨다. 실행과 노드 실행의 상태 변경 트랜잭션이 커밋된 뒤에만 외부로 이벤트를 내보낸다. 롤백되면 외부 발송은 없다. 현재 구조에서 엔진은 커밋 뒤 단일 싱크(`WebsocketService.executionEvents$`)에 이벤트를 내고, `NotificationFanout`·SSE 어댑터·`ChatChannelDispatcher` 가 그 싱크를 구독해 각자 처리한다([단일 싱크와 외부 facade](#단일-싱크와-외부-facade) 참조).

### 종료 시 토큰 폐기

→ [종료 시 토큰 폐기](CLE-EIA-FLOW.md#종료-시-토큰-폐기)

### 공개 위젯의 방치된 입력 대기 회수

→ [공개 위젯의 방치된 입력 대기 회수](CLE-EIA-FLOW.md#공개-위젯의-방치된-입력-대기-회수)

## API 문서화

→ [API 문서화](CLE-EIA-FLOW.md#api-문서화)

## 호환성

- 웹훅 호출 응답(`POST /api/hooks/:endpointPath`)에는 `status`·`interaction` 만 더한다. 기존 클라이언트는 모르는 필드를 무시하므로 영향이 없다.
- 내부 WebSocket 채널(`/ws`)은 그대로다. UI 는 계속 이 경로를 쓰고, EIA 가 WS 흐름을 바꾸지 않는다.
- 트리거에는 새 컬럼 네 개(`notification_health`·`notification_last_error`·`notification_secret_v2`·`notification_rotated_at`)를 더한다. 설정 JSONB 는 키가 없으면 쓰지 않는 것으로 읽으므로 기존 트리거에 영향이 없다([EIA 데이터와 흐름](CLE-EIA-DATA.md)).
- 새 API 는 모두 `/api/external/executions/:id/*` 아래에 둔다. 기존 `/api/executions/*`([에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md), [실행 내역](../CLE-EXEC/CLE-EXEC-HISTORY.md))와 경로 prefix·인증 계열이 모두 달라 충돌하지 않는다.
- 재실행 API(`POST /api/executions/:id/re-run`, [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md))는 워크스페이스 JWT 전용이다. 외부 시스템이 재실행을 하려면 별도 웹훅 트리거를 두고, 그 호출로 받은 새 실행의 인터랙션 토큰을 써야 한다.

## 미결 사항

- **종료된 실행에 대한 명령의 정상 응답 코드**: REQ-EIA-008 에 따라 실행이 끝나면 실행 단위 토큰을 바로 폐기하고, 가드는 폐기된 토큰을 핸들러 전에 `401 TOKEN_REVOKED` 로 막는다. 한편 EIA-IN-12 는 종료된 실행에 대한 명령에 `410 Gone` 을 예고한다. 그래서 정상 경로의 코드가 `401` 인지 `410` 인지 하나로 정해지지 않았다. 두 쪽 서술과 영향은 [EIA 수신 API와 SSE §미결 사항](CLE-EIA-INBOUND.md#미결-사항) 과 [웹채팅 인증과 세션 §미결 사항](../CLE-WEBCHAT/CLE-WEBCHAT-SESSION.md#미결-사항) 에 있다. 결정 필요.
- **전역 스로틀의 카운트 기준**: 원문은 `UserThrottlerGuard` 를 IP 기준 분당 100이라 적고, [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 은 사용자 기준 분당 100이라 적는다. 토큰으로만 인증하는 EIA 경로에서 가드가 IP 로 대신 세는지 확인하고, 키 결정 규칙을 HTTP API 규약에 적어야 한다.

## 구현 위치

- `codebase/backend/src/modules/external-interaction/**` (모듈 전체. 파일별 역할은 하위 문서의 「구현 위치」)
  - `external-interaction.module.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts` (단일 싱크)
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- `codebase/backend/src/shared/utils/terminal-duration.ts`, `terminal-error-payload.ts`
- 응답 마스킹 관련 코드(`strip-external-only-fields.ts`, `node-output-allowlist.ts`, `redact-stored-error.ts`, `sanitize-error-message.ts`, `packages/masked-markers` 등)는 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 다룬다.

## Rationale

### 두 채널을 나눈다

알림 웹훅과 인바운드 REST·SSE 를 따로 제공하고, 트리거마다 `notification`·`interaction` 을 따로 켜고 끈다. 인터랙션이 없는 자동화는 둘 다 끈 채 기존 동작을 유지한다. 브라우저 채팅 위젯처럼 SSE 를 늘 열어 둘 수 있으면 인바운드만으로 충분하다. 서버 간 자동화는 SSE 를 계속 유지하기 어렵다. 그래서 둘 다 선택 사항으로 두고 사용자가 고른다.

두 채널은 방향(밖으로 밀기 대 안으로 당기기·보내기)과 인프라 요구(URL 을 호스팅할 수 있는가 대 연결을 유지할 수 있는가)가 다르다. 한 채널로는 외부 환경의 다양성을 덮을 수 없다. 예를 들어 알림만 제공하면 인터랙션이 필요한 워크플로우에서 응답할 길이 없어 AI 멀티턴·Form·버튼이 교착한다. 외부 WebSocket 만 제공하는 안은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) 의 외부 WebSocket 보류 결정에 따라 채택하지 않았다.

### 실행 단위 토큰을 기본값으로

→ [실행 단위 토큰을 기본값으로](CLE-EIA-TOKEN.md#실행-단위-토큰을-기본값으로)

### 이벤트 순번을 SSE 와 알림이 같이 쓴다

SSE 의 `id` 와 알림 payload 의 `seq` 는 같은 단조 카운터다([WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 의 이벤트 래퍼와도 같은 값).

- 한 클라이언트가 SSE 와 알림을 함께 구독해도 중복을 걸러 낼 수 있다.
- 디버깅할 때 백엔드 로그·DB 의 발행 순서와 클라이언트가 본 순서를 일대일로 맞출 수 있다.
- 카운터를 새로 만들면 두 채널 사이의 정합을 따로 검증해야 해서 비용만 크고 이득이 없다.

외부 채널은 순번이 필수 전제라 실행별 원자적 INCR 로 발급하는 카운터를 두고, WS 이벤트 래퍼·SSE `id:`·알림 `seq` 세 곳에 같은 값을 싣는다. 저장소는 Redis `INCR exec:seq:<id>` 하나로 정했다. DB 행 잠금 대안은 버렸고, Redis 를 못 쓰면 인스턴스별 메모리로 내려간다. 부하 아래 단조 유일성과 발급 지연 예산(REQ-EIA-025·027)은 실제 Redis 두 인스턴스 e2e 로 확인했다(관측: 초당 약 63,000 이벤트, 단일 인스턴스 지연 중앙값 0.083ms). Redis 를 못 쓰는 구간에서 인스턴스 사이의 단조성을 보장하지 않는 것은 [WebSocket 연결과 채널 구독](../CLE-API/CLE-API-WS.md) 과 [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md) 이 받아들인 trade-off 와 같다.

### 웹훅 문서와 분리한다

EIA 는 웹훅 문서에 흡수하지 않고 따로 둔다. 웹훅은 "트리거 진입점" 책임에 집중하고, EIA 는 "실행 중 인터랙션 채널" 이라 층이 다르다. 한 문서에 합치면 두 관심사가 섞인다. [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) 은 관리 표에 알림·인터랙션 설정 필드 행만 두고 이 문서를 가리킨다. 웹훅 202 응답 모양의 기준도 [웹훅 「수신 API」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#수신-api) 다. 이 문서는 인터랙션 블록을 받은 뒤의 호출을 정하고 응답 예시는 그 절을 따른다.

### 단일 싱크와 외부 facade

실행 엔진은 이벤트를 `WebsocketService` 한 곳에만 낸다([실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md) 의 단일 싱크 정책). 그 정책은 "외부 싱크(웹훅 콜백·텔레메트리 export)가 실제로 생기면 다시 검토한다" 고 적었고, EIA 알림 발송이 그 계기다. 결정은 엔진 단일 싱크를 유지하고 알림 발송기와 SSE 어댑터를 엔진 밖 facade 층에 두는 것이다.

- 엔진은 여전히 `WebsocketService.emitToExecution` 만 부른다.
- 알림 발송은 엔진 코드가 직접 부르지 않는다. 단일 싱크를 구독하는 `NotificationFanout` 이 커밋 뒤 이벤트를 받아 `NotificationDispatcher.enqueue()` 로 넘긴다.
- SSE 어댑터는 단일 싱크 `WebsocketService.executionEvents$` 를 서버 안에서 직접 구독한다. 엔진과 직접 묶이지 않는다.

근거는 세 가지다. 엔진이 외부 싱크의 종류를 몰라도 된다. 새 외부 싱크(텔레메트리 export 등)는 엔진 코드를 고치지 않고 facade 만 더한다. 커밋 뒤 발행 규칙(REQ-EIA-022)이 단일 싱크의 시점 보장과 맞는다. 알림 발송기를 엔진 안에서 직접 부르는 안은 엔진이 외부 싱크 종류·재시도·서명·SSRF 정책을 모두 알아야 해 단일 책임을 어기고 엔진의 책임 분리 결정을 뒤집으므로 채택하지 않았다.

단일 싱크(RxJS `Subject`)에는 형제 구독자 셋이 `onModuleInit` 에서 직접 붙는다. 셋 다 같은 facade 층이고 같은 이벤트 순번과 같은 커밋 시점을 공유한다.

- `NotificationFanout`(`notification-fanout.service.ts`): 알림 설정이 그 이벤트를 구독하면 `NotificationDispatcher.enqueue()`(BullMQ 적재만 하는 facade)로 외부 HTTP POST 를 맡긴다. 종료 이벤트면 토큰 폐기도 한다. 서버 인스턴스마다 자기 프로세스의 싱크를 구독한다. 그래서 이벤트 하나는 그 이벤트를 낸 서버 인스턴스에서 한 번만 큐에 들어간다.
- SSE 어댑터(`sse-adapter.service.ts`): 자기 프로세스의 싱크를 서버 안에서 직접 구독한다. 받은 이벤트는 Redis 를 거쳐 그 실행의 SSE 구독자가 붙은 모든 서버 인스턴스로 전달된다. 그래서 외부 SSE 클라이언트는 아무 서버 인스턴스에나 붙어도 된다. Redis 는 서버 인스턴스 사이의 전달 수단이고 새 싱크가 아니다. 2026-10-17 에 서버 인스턴스 하나의 메모리 버퍼에서 이 구조로 바꿨다. 설계와 기각한 대안은 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 의 「SSE 스트림」 과 Rationale 에 있다.
- `ChatChannelDispatcher`: 같은 프로세스 안에서 구독해 메신저 `sendMessage` 로 바꾼다.

채팅 채널 어댑터는 `NotificationFanout`·`NotificationDispatcher` 뒤가 아니라 단일 싱크에 직접 붙은 형제 구독자다. 알림 경로가 채팅 채널용 이벤트를 따로 내지 않고, 어댑터도 엔진 코드를 부르지 않으므로 "엔진 단일 싱크 + 외부 facade" 원칙을 깨지 않는다. 어댑터가 알림 화이트리스트 다섯 종 밖의 서버 안 이벤트(현재 `execution.node.completed`, [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md))를 추가로 걸러 받는 것도 이 원칙 안이다. 싱크는 여전히 `WebsocketService.emit*` 하나이고, 어댑터는 그 구독자일 뿐 새 싱크를 만들지 않는다. 외부 HTTP 알림 화이트리스트 다섯 종은 바뀌지 않는다. 이 허용 범위의 결정 기준은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 이 정한다.

### 종료 토큰 폐기는 실행 토큰 테이블로 정리한다

→ [종료 토큰 폐기는 실행 토큰 테이블로 정리한다](CLE-EIA-FLOW.md#종료-토큰-폐기는-실행-토큰-테이블로-정리한다)

### 공개 위젯 회수 신호는 토큰 만료다

→ [공개 위젯 회수 신호는 토큰 만료다](CLE-EIA-FLOW.md#공개-위젯-회수-신호는-토큰-만료다)

### 생성과 PATCH 응답에 싣는 일회성 비밀 (2026-10-17)

→ [생성과 PATCH 응답에 싣는 일회성 비밀 (2026-10-17)](CLE-EIA-TOKEN.md#생성과-patch-응답에-싣는-일회성-비밀-2026-10-17)

### 운영 환경 가드 목록은 링크로 둔다 (2026-10-31)

→ [운영 환경 가드 목록은 링크로 둔다 (2026-10-31)](CLE-EIA-TOKEN.md#운영-환경-가드-목록은-링크로-둔다-2026-10-31)

### 인터랙션 서명 비밀도 운영 환경 가드가 검사한다 (2026-11-06)

→ [인터랙션 서명 비밀도 운영 환경 가드가 검사한다 (2026-11-06)](CLE-EIA-TOKEN.md#인터랙션-서명-비밀도-운영-환경-가드가-검사한다-2026-11-06)
