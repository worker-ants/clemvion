---
id: "CLE-EIA-NOTIFY"
title: "EIA 알림 웹훅"
type: "feature"
version: 15
status: "approved"
requirements: ["REQ-EIANOTI-001", "REQ-EIANOTI-002", "REQ-EIANOTI-003", "REQ-EIANOTI-004", "REQ-EIANOTI-005", "REQ-EIANOTI-006", "REQ-EIANOTI-007", "REQ-EIANOTI-008", "REQ-EIANOTI-009", "REQ-EIANOTI-010", "REQ-EIANOTI-011", "REQ-EIANOTI-012", "REQ-EIANOTI-013", "REQ-EIANOTI-014", "REQ-EIANOTI-015", "REQ-EIANOTI-016", "REQ-EIANOTI-017", "REQ-EIANOTI-018", "REQ-EIANOTI-019", "REQ-EIANOTI-020", "REQ-EIANOTI-021", "REQ-EIANOTI-022", "REQ-EIANOTI-023", "REQ-EIANOTI-024", "REQ-EIANOTI-025", "REQ-EIANOTI-026", "REQ-EIANOTI-027", "REQ-EIANOTI-028", "REQ-EIANOTI-029", "REQ-EIANOTI-030", "REQ-EIANOTI-031", "REQ-EIANOTI-032", "REQ-EIANOTI-033", "REQ-EIANOTI-034", "REQ-EIANOTI-035", "REQ-EIANOTI-036", "REQ-EIANOTI-037", "REQ-EIANOTI-038"]
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "74e8aa6970372e0e66c37dbe9359e04c0ff19807333f56344774b9ecd9591fa5"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/5-system/14-external-interaction-api.md", "spec/data-flow/15-external-interaction.md"]
mirror_sha256: "b50bf18b22b1527a3bb97fc29980ea104c6ac17216b725e20e09f185cf885aa6"
etag: "sha256-a097b1377ac155d1f8afdbacfe72034db4e61274d0272467f2ce74ab30a4f87c"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/14-external-interaction-api.md` (§3.1, §6, §8.1·§8.2, Rationale R2·R6·R12·R-outbound-flood), `spec/data-flow/15-external-interaction.md` (§1.4 발송 사실) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

EIA 알림 웹훅(Outbound Notification Webhook, `config.notification`)은 실행 이벤트를 트리거에 등록한 외부 URL 로 HMAC 서명해 보내는 채널이다. 서버 간 자동화처럼 SSE 연결을 유지하기 어려운 호출자가 입력 대기·종료 같은 사건을 받는 데 쓴다. 인앱 알림([알림](../CLE-OBS/CLE-OBS-NOTIFY.md))과는 다른 기능이다.

이 문서는 알림 웹훅 계약의 입구다. 요구사항은 여기 있고 세부 계약은 「하위 문서」 절의 문서가 맡는다. 종결 이벤트 필드 집합과 이벤트 봉투는 SSE·WebSocket 도 이 문서 묶음을 기준으로 삼는다.

범위 밖: 트리거 등록 페이로드와 EIA 채널 공통 규칙은 [External Interaction API](CLE-EIA.md), SSE 로 같은 이벤트를 받는 방법은 [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md), 발송 파이프라인의 큐·저장소·시크릿 승격 흐름은 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 값 가리기 정책은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다.

## 요구사항

- REQ-EIANOTI-001 WHEN 트리거에 `notification.url` 이 설정돼 있고 구독한 이벤트가 발생하면 THE SYSTEM SHALL 그 URL 로 이벤트를 HTTP POST 한다. (원본: EIA-NX-01)
- REQ-EIANOTI-002 WHEN 구독 이벤트를 등록하면 THE SYSTEM SHALL `execution.waiting_for_input`·`execution.completed`·`execution.failed`·`execution.cancelled`·`execution.ai_message` 다섯 가지 안에서만 받는다. (원본: EIA-NX-02)
- REQ-EIANOTI-003 WHEN EIA 알림 웹훅을 보내면 THE SYSTEM SHALL 본문을 HMAC 으로 서명해 `X-Clemvion-Signature: t=<unix>,v1=<hex>` 헤더로 싣는다. (원본: EIA-NX-03)
- REQ-EIANOTI-004 WHEN 서명 알고리즘을 설정 값으로 드러내면 THE SYSTEM SHALL `hmac-sha256`·`hmac-sha512` 두 값만 받고 웹훅 인바운드 검증의 `sha256`·`sha512` 표기와 나눈다. (원본: EIA-NX-03, §8.2)
- REQ-EIANOTI-005 WHEN 같은 이벤트를 다시 보내면 THE SYSTEM SHALL 처음과 같은 `X-Clemvion-Delivery` UUID 를 싣는다. (원본: EIA-NX-04)
- REQ-EIANOTI-006 WHEN `waiting_for_input`·`ai_message` EIA 알림 웹훅을 보내기 직전이면 THE SYSTEM SHALL 실행 상태를 다시 읽고 이미 종료된 실행이면 보내지 않는다. (원본: EIA-NX-05)
- REQ-EIANOTI-007 WHEN 수신 측이 응답하면 THE SYSTEM SHALL `2xx` 만 성공으로 본다. (원본: EIA-NX-06)
- REQ-EIANOTI-008 IF 응답이 `2xx` 가 아니거나 10초 안에 오지 않으면 THE SYSTEM SHALL 1초에서 시작해 4배씩 늘어나되 1시간을 넘지 않는 간격(1초 · 4초 · 16초 · 64초 … 최대 1시간)으로 다시 보내고 첫 시도를 포함한 총 시도 횟수를 `notification.retry.maxAttempts`(기본 5, 상한 10, 0 은 1 로 본다)로 제한한다. (원본: EIA-NX-06)
- REQ-EIANOTI-009 IF 마지막 시도까지 실패하면 THE SYSTEM SHALL 트리거의 발송 건강도(`notification_health`)를 `degraded` 로 바꾸고 `notification_last_error` 를 기록하되 트리거를 끄지 않는다. (원본: EIA-NX-07)
- REQ-EIANOTI-010 WHEN EIA 알림 웹훅을 보내면 THE SYSTEM SHALL 알림 웹훅 페이로드에 그 실행의 이벤트 순번(`seq`)을 싣는다. (원본: EIA-NX-08)
- REQ-EIANOTI-011 IF `notification.url` 이 `https://` 가 아니면 THE SYSTEM SHALL 거부하되, 개발 환경 변수 `ALLOW_HTTP_HOOKS=1` 일 때만 `http://` 를 허용한다. 트리거 생성 · 수정 요청에서는 `400 INVALID_NOTIFICATION_URL` 로 거부한다. 보내기 직전에 걸리면 그 알림 웹훅을 보내지 않고 발송 건강도를 `degraded` 로 둔다. (원본: EIA-NX-09)
- REQ-EIANOTI-012 IF `notification.url` 의 호스트가 사설 IP·loopback·메타데이터 주소의 IP 리터럴이거나 `localhost` · `0.0.0.0` 이면 THE SYSTEM SHALL 등록할 때와 보내기 직전에 모두 거부한다. 등록할 때 거부하면 트리거 생성 · 수정 요청이 `400 INVALID_NOTIFICATION_URL` 로 실패한다. 보내기 직전에 거부하면 그 알림 웹훅을 보내지 않고 발송 건강도를 `degraded` 로 둔다. 호스트 이름을 DNS 로 풀어 보는 검사는 [SSRF 방지](#ssrf-방지) 가 정한다. 운영 환경(`NODE_ENV=production`)에서는 이 검사가 기본으로 켜져 있어 보내기 직전에 사설 IP 로 풀리는 호스트 이름도 거부한다. 운영 밖에서는 기본으로 꺼져 있다. (원본: EIA-NX-10)
- REQ-EIANOTI-013 WHEN EIA 알림 웹훅 URL 을 검증하면 THE SYSTEM SHALL 워크스페이스 단위 허용·차단 목록을 함께 적용한다. (원본: EIA-NX-10) (미구현)
- REQ-EIANOTI-014 WHEN 한 트리거의 발송 성공이 분당 60건을 넘으면 THE SYSTEM SHALL EIA 알림 웹훅을 버리거나 늦추지 않고 보내되 발송 건강도를 `degraded` 로, `notification_last_error` 를 폭주 전용 메시지로 기록한다. (원본: EIA-NX-11)
- REQ-EIANOTI-015 WHEN 폭주가 멎어 분당 60건 이내로 발송에 성공하면 THE SYSTEM SHALL 발송 건강도를 `healthy` 로 되돌린다. (원본: R-outbound-flood)
- REQ-EIANOTI-016 WHEN `POST /api/triggers/:id/notification/rotate-secret` 이 호출되면 THE SYSTEM SHALL 새 알림 서명 시크릿을 만들어 응답에 한 번만 평문으로 싣고 24시간 동안 옛 시크릿과 함께 쓴다. (원본: EIA-NX-12)
- REQ-EIANOTI-017 WHEN 시크릿 교체가 일어나면 THE SYSTEM SHALL 감사 로그에 `trigger.notification_secret_rotated` 를 남긴다. (원본: EIA-NX-12)
- REQ-EIANOTI-018 WHILE 시크릿 교체 유예 24시간 동안 THE SYSTEM SHALL 옛 시크릿과 새 시크릿으로 각각 서명한 `v1=` 두 개를 함께 싣는다. (원본: data-flow §1.4)
- REQ-EIANOTI-019 IF 주 알림 서명 시크릿이 없거나 가져오지 못하면 THE SYSTEM SHALL 서명 없이 보내지 않고 발송 건강도를 `degraded` 로 바꾼다. 유예 중인 새 시크릿(`notification_secret_v2`)만 있어도 그 값 하나로 서명해 보내지 않는다. (원본: data-flow §1.4)
- REQ-EIANOTI-020 IF 이벤트에 `triggerId` 가 없거나(수동 실행) 트리거가 삭제됐으면 THE SYSTEM SHALL EIA 알림 웹훅을 보내지 않는다. (원본: data-flow §1.4)
- REQ-EIANOTI-021 WHEN 트랜잭션이 커밋되면 THE SYSTEM SHALL 평균 200ms 안에 EIA 알림 웹훅 HTTP POST 를 시도한다. (원본: EIA-NF-01)
- REQ-EIANOTI-022 WHEN EIA 알림 웹훅 발송 작업이 발송 큐(`notification-webhook`)에 적재되면 THE SYSTEM SHALL 최소 한 번 전달을 보장하고, 수신 측이 `X-Clemvion-Delivery` 로 중복을 거르고 `seq` 로 정렬할 수 있게 한다. (원본: EIA-RL-01)
- REQ-EIANOTI-023 WHEN 종결 이벤트(`completed`·`failed`·`cancelled`)를 보내면 THE SYSTEM SHALL 종결 이벤트 필드 집합 표에 있는 필드만 싣는다. (원본: §6)
- REQ-EIANOTI-024 WHEN `execution.cancelled` 를 보내면 THE SYSTEM SHALL `result.cancelledBy` 에 `user`·`system`·`timeout` 중 하나를 싣는다. (원본: §6)
- REQ-EIANOTI-025 WHEN 시스템이 실행을 취소하면 THE SYSTEM SHALL `execution.cancelled` 에 사유를 가르는 `error.code` 를 함께 싣는다. (원본: §6)
- REQ-EIANOTI-026 WHEN 사용자가 실행을 취소하면 THE SYSTEM SHALL `execution.cancelled` 에 `error` 키를 싣지 않는다. (원본: §6)
- REQ-EIANOTI-027 WHEN `execution.failed` 를 보내면 THE SYSTEM SHALL `error` 를 모든 경로에서 `{ code, message, nodeId, details? }` 객체로 싣고, 분류할 코드나 노드가 없으면 `code`·`nodeId` 를 `null` 로 둔다. (원본: §6, §6.4)
- REQ-EIANOTI-028 WHEN `execution.failed` 의 `error.message`·`error.details` 를 내보내면 THE SYSTEM SHALL 자격 증명 값을 가리고 `code`·`nodeId` 는 원문 그대로 둔다. (원본: §6.4)
- REQ-EIANOTI-029 WHEN 종결 이벤트를 보내면 THE SYSTEM SHALL 영속한 `durationMs` 를 싣고 알 수 없으면 `null` 로 둔다. (원본: §6)
- REQ-EIANOTI-030 WHEN 입력 대기·AI 메시지 이벤트를 밖으로 보내면 THE SYSTEM SHALL 디버그 전용 필드(`llmCalls` 등 원본 LLM 요청·응답)를 깊이와 관계없이 뺀다. (원본: §6.2, §6.5)
- REQ-EIANOTI-031 WHEN `execution.ai_message` 에 표시물이 있으면 THE SYSTEM SHALL WebSocket payload 의 `presentations[]` 를 그대로 전달한다. (원본: §6.5)
- REQ-EIANOTI-032 WHEN `execution.completed` 를 보내면 THE SYSTEM SHALL 실행 결과 출력(`result.outputs`)을 싣는다. (원본: §6) (미구현)
- REQ-EIANOTI-033 WHEN `waiting_for_input` 알림 웹훅을 보내면 THE SYSTEM SHALL 인터랙션 안내 블록(`submitUrl`·`streamUrl`·`statusUrl`·`cancelUrl`·`token`·`expiresAt`·`expectedCommands`)을 싣는다. (원본: §6.2) (미구현)
- REQ-EIANOTI-034 WHEN 트리거 조회 · 생성 · 수정 응답이 `notificationLastError` 를 돌려주면 THE SYSTEM SHALL 저장값은 두고 응답에서 자격 증명 모양을 가린다. ([응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md#310-트리거-응답의-마지막-오류-2026-10-05))
- REQ-EIANOTI-035 WHEN 시크릿 교체 유예 중에 `rotate-secret` 이 다시 호출되면 THE SYSTEM SHALL 앞서 만든 새 시크릿을 이번 새 시크릿으로 덮어쓰고 24시간 유예를 그 시각부터 다시 시작한다. ([시크릿 교체](#시크릿-교체))
- REQ-EIANOTI-036 WHEN 매시 승격 작업이 유예가 끝난 새 시크릿을 승격하면 THE SYSTEM SHALL 시크릿 교체와 같은 트리거 설정 잠금을 잡고 잠금 안에서 읽은 `notification_secret_v2` 가 처음 고른 값과 같을 때만 같은 잠금 안에서 그 값을 정식 참조로 옮기고 비운다. ([시크릿 교체](#시크릿-교체))
- REQ-EIANOTI-037 WHEN EIA 알림 웹훅 설정(`config.notification`)이 있는 트리거를 만들거나 PATCH 로 EIA 알림 웹훅 설정을 처음 붙이면 THE SYSTEM SHALL 알림 서명 시크릿을 발급해 시크릿 저장소에 넣고 평문을 그 응답에 한 번만 싣는다. 다시 읽은 행에 남아 있는 평문 `signing.secret`(옛 키)이 있으면 그 값을 시크릿 저장소로 옮기고 발급하지 않는다. ([시크릿 교체](#시크릿-교체), 응답 위치: [트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api))
- REQ-EIANOTI-038 WHEN 알림 웹훅 발송 응답이 3xx 이면 THE SYSTEM SHALL `Location` 을 따라가지 않고 그 발송을 실패로 보아 REQ-EIANOTI-008 의 재시도 규칙을 적용한다. ([재시도와 실패 처리](#재시도와-실패-처리), [SSRF 방지](#ssrf-방지))

## 하위 문서

| 문서 | 맡는 내용 | 요구사항 |
|---|---|---|
| [EIA 알림 웹훅 — 이벤트와 payload](CLE-EIA-NOTIFY-EVENTS.md) | 구독 이벤트, 이벤트 봉투와 알림 웹훅 페이로드, 종결 이벤트 필드 집합, `execution.cancelled` 행동 계약, 이벤트별 payload | REQ-EIANOTI-002, 010, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033 |
| [EIA 알림 웹훅 — 서명과 발송](CLE-EIA-NOTIFY-DELIVERY.md) | 헤더와 서명, 재시도와 실패 처리, 리다이렉트, 낡은 알림 웹훅 차단, 전달 보장, 폭주 감지 | REQ-EIANOTI-001, 003, 004, 005, 006, 007, 008, 009, 014, 015, 018, 020, 021, 022, 034, 038 |
| [EIA 알림 웹훅 — SSRF 방지](CLE-EIA-NOTIFY-SSRF.md) | 등록 · 발송 직전 URL 검사, 차단 대역, IPv4 를 품은 IPv6, DNS 결과 검사, 거부가 보이는 방식 | REQ-EIANOTI-011, 012, 013 |
| [EIA 알림 웹훅 — 시크릿 교체](CLE-EIA-NOTIFY-SECRET.md) | 알림 서명 시크릿의 첫 발급 · 옛 평문 옮기기 · 교체 · 승격, 주 시크릿 읽기 | REQ-EIANOTI-016, 017, 019, 035, 036, 037 |

REQ-EIANOTI-020(`triggerId` 가 없거나 트리거가 삭제됐을 때 보내지 않음)과 021(커밋 뒤 평균 200ms 안에 시도)은 발송 문서에 배정했지만 본문 서술은 없고 위 요구사항 줄이 정본이다.

## 종결 이벤트 필드 집합

→ [EIA 알림 웹훅 — 이벤트와 payload 「종결 이벤트 필드 집합」](CLE-EIA-NOTIFY-EVENTS.md#종결-이벤트-필드-집합)

## 재시도와 실패 처리

→ [EIA 알림 웹훅 — 서명과 발송 「재시도와 실패 처리」](CLE-EIA-NOTIFY-DELIVERY.md#재시도와-실패-처리)

## SSRF 방지

→ [EIA 알림 웹훅 — SSRF 방지](CLE-EIA-NOTIFY-SSRF.md#ssrf-방지)

## 시크릿 교체

→ [EIA 알림 웹훅 — 시크릿 교체](CLE-EIA-NOTIFY-SECRET.md#시크릿-교체)

## 미결 사항

- **워크스페이스 알림 웹훅 URL 허용 목록**: [SSRF 방지](CLE-EIA-NOTIFY-SSRF.md#ssrf-방지) 와 요구사항 목록은 워크스페이스 단위 허용·차단 목록을 약속하고(원문 우선순위는 필수) `workspace_settings.notification_url_allow_pattern` 을 이름으로 든다. [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 워크스페이스 설정 키에는 이 값이 없고 `workspace_settings` 테이블도 없으며, 현재 구현도 없다(분석 단계 확인). 미구현으로 두고 설정 키 이름을 정할지, 요구사항에서 뺄지 결정 필요.
- **`ai_form_render` 가 외부에서 어떻게 보이는가**: [인터랙션 타입 레지스트리](CLE-IX-TYPES.md#미결-사항) 참조.

## 구현 위치

각 하위 문서의 「구현 위치」 절에 나눠 적었다.

## Rationale

### EIA 알림 웹훅 응답으로 인터랙션을 받지 않는다

인터랙션은 별도 인바운드 채널로 나누고 알림 웹훅은 순수 통보로 한정한다. 알림 웹훅의 HTTP 응답 본문으로 인터랙션 결과를 받는 방식(예: `waiting_for_input` 알림 웹훅에 200 OK 와 폼 데이터를 돌려주면 그대로 폼 제출로 처리)은 채택하지 않았다.

- HTTP 응답 한 번은 양방향 대화(AI 멀티턴의 여러 턴)를 표현할 수 없다.
- "알림 웹훅 한 번 = 응답 한 번" 의 비대칭 모델이 되어 모든 노드를 같은 모델로 묶기 어렵다.
- 재시도 때 같은 인터랙션 응답을 여러 번 보내는 모호함이 생긴다. 서버는 첫 응답만 의미 있게 처리해야 하지만, 클라이언트는 "성공 = 인터랙션 반영" 으로 오해할 수 있다.
- 서명 검증 직후 곧바로 비즈니스 응답을 요구하는 동기 모델은 클라이언트 구현 부담이 크다.

### EIA 알림 웹훅 발송이 실패해도 트리거를 끄지 않는다

마지막 시도까지 실패해도 발송 건강도만 `degraded` 로 표시하고 트리거는 끄지 않는다. EIA 알림 웹훅은 트리거의 부수 기능이다. 자동으로 끄면 본체(워크플로우 실행)까지 멈추게 되어 사용자 의도와 다를 수 있다. 저하 표시와 인앱 알림, 화면의 명시적 비활성화 버튼이 알맞고, 자동 차단에는 사용자 확인이 필요하다. 다만 2026-10-09 기준 저하 신호는 발송 건강도 배지와 `notification_last_error` 뿐이다. 발송 저하를 알리는 인앱 알림 유형은 없다([알림](../CLE-OBS/CLE-OBS-NOTIFY.md#알림-유형)).

### 정본을 한 곳에 둔다

필드 집합·이벤트 봉투·알림 웹훅 페이로드·`cancelled` 행동 계약, `notification.retry` 의 뜻, 시크릿 승격 조건은 이 문서 묶음 한 곳에만 둔다. 같은 내용을 여러 문서에 나열하면 저마다 두 번째 기준이 되고, 실제로 그렇게 됐다. 다른 문서는 여기를 가리키기만 한다(선례: Redis 키 목록의 포인터 원칙, [Redis 키 명명 규약](../CLE-ENG/CLE-ENG-REDIS.md)).

하위 문서로 옮긴 Rationale 가운데 다른 스펙이 이 문서의 앵커로 링크하는 두 항목만 아래에 이동 안내를 남긴다. 나머지는 각 하위 문서의 Rationale 에 있다.

### IPv4 를 품은 IPv6 리터럴을 품은 IPv4 로 판정한다 (2026-11-01)

→ [EIA 알림 웹훅 — SSRF 방지](CLE-EIA-NOTIFY-SSRF.md#ipv4-를-품은-ipv6-리터럴을-품은-ipv4-로-판정한다-2026-11-01)

### 공백만 있는 옛 평문도 없는 것으로 본다 (2026-11-06)

→ [EIA 알림 웹훅 — 시크릿 교체](CLE-EIA-NOTIFY-SECRET.md#공백만-있는-옛-평문도-없는-것으로-본다-2026-11-06)
