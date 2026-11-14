---
id: "CLE-TRIG-WEBHOOK-API"
title: "웹훅 — 엔드포인트와 수신 API"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-WEBHOOK"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-WEBHOOK"]
area: "CLE-TRIG"
content_hash: "2a12bf293a15ffe2027cd0f409cb2f7c57b4cbb45f24541492a5bdd2742296a1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "198ce1e0521db22964b5f398cfb66705666eb856b7fc699eeb1a640b7ee6ad86"
etag: "sha256-7c6b0ebefb52373549590e1a29cfddba944fd657d2373e6774953067a70d1160"
---
## 개요

이 문서는 [웹훅](CLE-TRIG-WEBHOOK.md) 의 하위 문서로 웹훅 트리거의 필드와 `config`, 엔드포인트 경로(URL 형식 · 비밀성 · 변경), 수신 API 의 요청 · 응답 · 에러 표, 화면 연동을 정한다. 수신 처리 순서는 [웹훅 — 처리 흐름](CLE-TRIG-WEBHOOK-FLOW.md) 이 정한다.

## 트리거 필드와 config

웹훅 트리거는 트리거 엔티티를 그대로 쓰고 새 테이블은 없다. 컬럼 정의는 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 이 정한다.

| 필드 | 웹훅에서의 쓰임 |
|------|----------------|
| `type` | `'webhook'` |
| `endpointPath` | URL 경로. 전역에서 유일하다(`(endpoint_path)` UNIQUE). UUID 로 만든다 |
| `isActive` | 수신 활성/비활성 |
| `authConfigId` | 웹훅 인증 검증의 단일 진입점(FK → 인증 설정). `NULL` 이면 인증 없음이다. 인증 자료와 `ip_whitelist` 는 모두 인증 설정에 있다 |
| `config` | 추가 설정(JSONB). 인증 관련 키는 없다 |
| `workflowId` | 실행할 워크플로우 |
| `lastTriggeredAt` | 마지막 호출 시각 |

`config` 는 다음 세 서브 객체를 담을 수 있다. 셋 다 없어도 된다. 없으면 해당 외부 인터랙션 채널이나 채팅 채널 어댑터가 비활성으로 간주된다.

```json
{
  "notification": { },
  "interaction":  { },
  "chatChannel":  { }
}
```

| 키 | 내용 | 기준 문서 |
|----|------|----------|
| `notification` | EIA 알림 웹훅 설정(outbound 이벤트) | [External Interaction API](../CLE-IX/CLE-EIA.md) |
| `interaction` | 외부 인터랙션 채널(inbound) 설정 | [External Interaction API](../CLE-IX/CLE-EIA.md) |
| `chatChannel` | 채팅 채널 어댑터 설정(Telegram 등) | [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) |

상태·시크릿 회전 추적처럼 별도 컬럼이 필요한 필드는 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 과 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다.

인증 키는 `config` 에 두지 않는다. 웹훅 인증은 `trigger.auth_config_id` 가 가리키는 인증 설정 유형(`AuthConfig.type`)으로 정해진다. 옛 인라인 키(`authType` / `secret` / `bearerToken` / `hmacHeader` / `hmacAlgorithm`)는 `V066__trigger_config_strip_inline_auth.sql` 로 지웠고 남은 행에 키가 있어도 코드는 무시한다([인라인 인증 경로 폐지](CLE-TRIG-WEBHOOK-AUTH.md#인라인-인증-경로-폐지)). 인증 설정 `config` 의 `header` / `algorithm` 은 옛 `config.hmacHeader` / `hmacAlgorithm` 과 위치와 주인이 다르다. 트리거가 아니라 자격 증명의 메타데이터다.

## 엔드포인트 경로

### URL 형식

웹훅 URL 은 `{base_url}/api/hooks/{endpoint_path}` 한 가지 형식이다. `/api/webhooks` 경로나 워크스페이스 slug 세그먼트는 없다.

`base_url` 은 웹훅을 받는 백엔드 origin 이다. 프런트엔드(트리거 화면)는 표시·복사용 URL 의 base 를 다음 순서로 고른다(구현 `codebase/frontend/src/lib/utils/webhook-url.ts`).

1. `NEXT_PUBLIC_WEBHOOK_BASE_URL`(명시 override)
2. `NEXT_PUBLIC_API_URL` 에서 끝의 `/api` 를 뗀 값
3. `window.location.origin`

### 비밀성

인증 없는 웹훅에서는 엔드포인트 경로 UUID 가 사실상 비밀 키다. 그래서 경로는 반드시 CSPRNG 로 발급한 v4 UUID(`crypto.randomUUID()`)여야 한다. 서버는 생성·수정 DTO 에서 v4 형식을 강제하지만(`@IsUUID('4')`) 엔트로피 품질까지는 검증할 수 없다. 그래서 클라이언트는 약한 난수나 고정값을 쓰지 않는다. 형식 강제는 예측할 수 있는 비-UUID 경로를 직접 지정하는 것(squatting·enumeration)을 막는다.

비밀성(추측할 수 없음)과 유일성(복사할 수 없음)은 다른 보장이다. 경로는 전역에서 유일하다(`(endpoint_path)` UNIQUE, V132). 경로를 아는 다른 워크스페이스가 같은 경로를 등록하면 409 로 거부된다. 한 번 쓴 경로는 지우거나 바꾼 뒤에도 그 워크스페이스 소유로 영구 예약된다. 유일성과 예약의 규칙과 근거는 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 이 정한다.

웹채팅 트리거는 모두 공개 웹훅이다. 웹채팅 인스턴스의 엔드포인트 경로는 외부 사이트의 설치 스크립트에 박히므로 그 사이트를 연 누구나 알 수 있다. 이 경우 경로의 비밀성은 성립하지 않는다. 대신 [요청 제한과 남용 방어](CLE-TRIG-WEBHOOK-LIMIT.md#요청-제한과-남용-방어)가 모든 공개 웹훅에 똑같이 걸리고 웹채팅 쪽 보호는 [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md) 이 정한다. 경로를 누구에게 보여도 되는지(뷰어 노출 등)가 일반 웹훅에도 적용되는지는 [웹훅 「미결 사항」](CLE-TRIG-WEBHOOK.md#미결-사항)에 적는다.

### 경로 변경

웹훅 트리거의 엔드포인트 경로는 의도적으로 바꿀 수 있다. 스케줄 유형 트리거의 경로만 바꿀 수 없다. 근거는 [엔드포인트 경로 가변성](#엔드포인트-경로-가변성).

## 수신 API

```
POST /api/hooks/:endpointPath
```

| 항목 | 설명 |
|------|------|
| 인증 | `trigger.auth_config_id` 가 가리키는 인증 설정 유형에 따른다. 연결 없음(`auth_config_id IS NULL`, 공개) / `api_key` / `bearer_token` / `basic_auth` / `hmac`. `is_active=false` 인 인증 설정은 곧바로 401 `AUTH_FAILED`. 인증 설정에 `ip_whitelist` 가 있으면 함께 시행한다([인증](CLE-TRIG-WEBHOOK-AUTH.md#인증)) |
| Content-Type | `application/json`, `application/x-www-form-urlencoded` |
| 요청 본문 최대 크기 | 공개 웹훅 32KB, 인증 웹훅과 채팅 채널 트리거 1MB(기본). [본문 크기](CLE-TRIG-WEBHOOK-LIMIT.md#본문-크기) |
| JWT | `/api/hooks/*` 는 JWT guard 대상이 아니다(외부 서비스가 부르므로) |
| CORS | 웹훅 엔드포인트에는 CORS 제한이 없다 |

성공 응답은 `202 Accepted` 다. 핸들러가 돌려준 값은 전역 `TransformInterceptor` 가 `{ "data": { ... } }` 로 감싸 보낸다([HTTP API 규약](../CLE-API/CLE-API-CONV.md) 응답 형식).

```json
{
  "data": {
    "executionId": "uuid",
    "message": "Webhook received, workflow execution started"
  }
}
```

위 예시는 외부 인터랙션을 켜지 않은 트리거의 응답이다. `message` 는 어느 경우에나 들어간다. 트리거에 `config.interaction.enabled=true` 가 설정돼 있으면 `data` 에 `status: "pending"` 과 `interaction` 이 더 들어간다. 두 키는 외부 인터랙션을 켰을 때만 있는 선택적 부가 맥락이라 켜지 않은 트리거의 응답에서는 `null` 을 싣지 않고 키를 생략한다([HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b)).

- `interaction` 은 `tokenStrategy="per_execution"` 이면 `{ token, expiresAt, endpoints }` 이고 `per_trigger` 면 `{ endpoints }` 다. `per_trigger` 호출자에게는 트리거 단위 토큰(`itk_*`)이 이미 있어서 응답에 토큰을 싣지 않는다. 그 토큰은 트리거를 만들 때나 인터랙션을 `per_trigger` 로 처음 켜는 PATCH 의 응답에서 받는다([트리거 관리 「API」](CLE-TRIG-MANAGE.md#api)). `per_trigger` 응답에서 빠지는 `token` · `expiresAt` 도 `null` 없이 키를 생략한다(같은 기준 (b)).
- 응답 DTO(`WebhookAcceptedDto` · `WebhookInteractionDto`)는 두 변형을 `oneOf` 로 나누지 않는다. `status` · `interaction` · `token` · `expiresAt` 은 선택 필드(`@ApiPropertyOptional`)로 선언돼 있다.
- `endpoints` 는 `stream`·`submit`·`status`·`cancel`·`refresh` 다섯 경로다.
- 202 응답 모양은 이 절이 기준이다. 인터랙션 블록을 받은 뒤의 호출은 [External Interaction API](../CLE-IX/CLE-EIA.md) 가 정한다. 실행 단위 토큰의 발급과 저장은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md#토큰-발급) 이 정한다.
- 채팅 채널 트리거의 handshake 와 인터랙션 요청은 `{ data }` 봉투 없이 `200 OK` 로 답한다([채팅 채널 분기](CLE-TRIG-WEBHOOK-FLOW.md#채팅-채널-분기)).

에러 응답은 다음과 같다. 코드 카탈로그는 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 등재한다. 표의 "채팅 채널 예외" 에서 인터랙션 요청이면 `202` 대신 `200 OK` 와 기본 인터랙션 응답이다([채팅 채널 분기](CLE-TRIG-WEBHOOK-FLOW.md#채팅-채널-분기)).

| 상태 | 코드 | 조건 |
|------|------|------|
| `400 Bad Request` | | 요청 본문 파싱 실패 |
| `400 Bad Request` | `INVALID_WEBHOOK_PAYLOAD` | required 트리거 파라미터 누락, 타입 강제 변환 실패([400 응답 형식](CLE-TRIG-WEBHOOK-AUTH.md#400-응답-형식)) |
| `401 Unauthorized` | `AUTH_FAILED` | 인증 실패. 비활성 인증 설정, 트리거의 워크스페이스에 없는 인증 설정, 서명·토큰 불일치, `ip_whitelist` 불일치, 기대값이 비었거나 문자열이 아닌 인증 설정, 복호화 불가 표식으로 읽히는 인증 설정 모두 같은 코드다 |
| `404 Not Found` | `TRIGGER_NOT_FOUND` | 엔드포인트 경로에 맞는 웹훅 트리거가 없다. 예약만 있고 트리거가 없는 경로도 404 다. 트리거의 워크플로우가 트리거의 워크스페이스에 없을 때도 같은 본문이다. 채팅 채널 예외: `202 Accepted` 와 `{ executionId: 'ignored' }`([채팅 채널 §인바운드 HTTP 응답 계약](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-http-응답-계약)) |
| `405 Method Not Allowed` | | POST 가 아닌 메서드([HTTP API 규약](../CLE-API/CLE-API-CONV.md)) |
| `410 Gone` | `TRIGGER_INACTIVE` | 트리거가 비활성이다. 채팅 채널 예외: 서명 검증 뒤 `202 Accepted` 와 `{ executionId: 'ignored' }` |
| `410 Gone` | `WORKFLOW_INACTIVE` | 트리거는 활성이고 트리거의 워크플로우가 비활성이다(`workflow.is_active=false`). 메시지는 `Workflow of this webhook trigger is inactive` 다. 인증보다 먼저 확인한다. 채팅 채널 예외: 새 실행을 시작할 update 에만 `202 Accepted` 와 `{ executionId: 'ignored' }` 를 돌려주고 진행 중인 대화는 그대로 처리한다 |
| `413 Payload Too Large` | `PUBLIC_WEBHOOK_BODY_TOO_LARGE` | 공개 웹훅 본문이 32KB 초과 |
| `413 Payload Too Large` | `PAYLOAD_TOO_LARGE` | 인증 웹훅 본문이 라우트 한도(기본 1MB) 초과 |
| `429 Too Many Requests` | `PUBLIC_WEBHOOK_RATE_LIMIT` | 공개 웹훅 IP 단위 분당 시작 한도 초과 |
| `429 Too Many Requests` | `PUBLIC_WEBHOOK_HOURLY_LIMIT` | 공개 웹훅 IP 단위 시간당 누적 신규 상한 초과 |

트리거 CRUD 는 기존 `/api/triggers` 를 그대로 쓴다([트리거 관리](CLE-TRIG-MANAGE.md)).

## 화면 연동

웹훅 정보는 트리거 화면(`/triggers`)이 보여 준다([트리거 관리](CLE-TRIG-MANAGE.md)).

- 목록 행: URL 복사 버튼(📋), HTTP 메서드와 경로
- 상세 드로어: 웹훅 URL, HTTP 메서드, 인증 방식, Content-Type. 호출 이력은 상세 드로어에 없고 목록 더보기(⋮) "호출 이력" 대화상자에서 본다
- 외부 인터랙션을 켜면 상세 드로어에 `notification` 영역(URL, 구독 이벤트, 시크릿 교체 버튼, `notificationHealth` 배지)과 `interaction` 영역(enabled 토글, `tokenStrategy` 표시, `per_trigger` 면 트리거 단위 토큰 재발급 버튼)이 생긴다

## 구현 위치

- `codebase/backend/src/modules/hooks/hooks.module.ts`
- `codebase/backend/src/modules/hooks/dto/responses/webhook-response.dto.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`findByEndpointPath()` 재사용)
- `codebase/frontend/src/lib/utils/webhook-url.ts` (URL base 결정)
- 컨트롤러 `hooks.controller.ts` 는 [웹훅 — 처리 흐름](CLE-TRIG-WEBHOOK-FLOW.md#구현-위치) 에 적는다

## Rationale

### 웹훅 URL base 결정과 이 문서를 웹훅 기준으로 정한 결정

[URL 형식](#url-형식) 의 base 결정 순서를 요구사항 WH-EP-02 에 명문화했다. 웹훅 엔드포인트는 백엔드가 받으므로 base 는 백엔드 origin 이다.

[웹훅](CLE-TRIG-WEBHOOK.md) 문서를 웹훅 도메인의 기준으로 정하면서 다음을 확정했다. ① 응답은 전역 `TransformInterceptor` 가 `{data: ...}` 로 감싼다. ② rate limit 은 전역 throttler 분당 100건이다. 서명 참조가 있는 채팅 채널 트리거는 2026-11-12 · 2026-11-13 사람 결정으로 이 한도에서 뺐다([서명 참조가 있는 채팅 채널 트리거만 전역 요청 한도에서 뺀다](CLE-TRIG-WEBHOOK-LIMIT.md#서명-참조가-있는-채팅-채널-트리거만-전역-요청-한도에서-뺀다-2026-11-13)). ③ POST 전용이다(GET·PUT 과 `?wait` 동기 모드는 지원하지 않는다). ④ URL 정본은 `/api/hooks/:endpointPath` 이고 `/api/webhooks` 나 워크스페이스 slug 세그먼트는 없다. 웹훅 라우트는 `HooksController` 하나다.

③의 POST 전용은 트리거 진입 엔드포인트(`/api/hooks/:endpointPath`)에만 적용한다. 그 아래 서브경로는 각 영역 문서가 따로 메서드와 정책을 정할 수 있다. 예를 들어 웹채팅의 `GET /api/hooks/:endpointPath/embed-config`(공개·무인증 조회, [웹채팅 보안](../CLE-WEBCHAT/CLE-WEBCHAT-SECURITY.md))는 POST 전용 규칙의 예외가 아니라 이 문서의 범위 밖이다. 이 엔드포인트는 실행을 시작하지 않는다.

### 엔드포인트 경로 가변성

웹훅 트리거의 엔드포인트 경로는 의도적으로 바꿀 수 있다. URL 이 노출됐을 때 회전하거나 정리하려고 경로를 바꾸는 것은 정당한 운영 동작이다.

- `UpdateTriggerDto` 가 `endpointPath` 를 받고 `TriggersService.update()` 는 웹훅 트리거에 그대로 반영한다.
- 프런트엔드(`codebase/frontend/src/components/triggers/cards/webhook-config-card.tsx`)는 경로 편집 필드와 확인 경고(`triggers.detail.endpointPathChangeWarning`, "변경 시 기존 URL 은 404")를 제공한다.
- 바꾼 값도 비밀 키 역할을 하므로 UUID 수준의 높은 엔트로피를 유지해 squatting·enumeration 을 막는다는 전제다.
- 높은 엔트로피는 추측을 막을 뿐 복사를 막지 못한다. 경로를 아는 사람(뷰어, 멤버 전원, URL 을 받은 외부 서비스)의 복사는 전역 UNIQUE(V132)와 영구 예약이 막는다([비밀성](#비밀성)). 같은 워크스페이스는 옛 경로를 다시 쓸 수 있다.

변경을 거부하는 것은 스케줄 유형 트리거뿐이다. `TriggersService.update()` 의 거부 블록(`endpointPath` / `authConfigId` / `config` / `notification` / `interaction` / `chatChannel`)은 모두 `if (trigger.type === 'schedule')` 가드 안에 있다. 스케줄은 Cron·시간대 같은 메타를 별도 스케줄 행과 BullMQ job scheduler 에 맞춰야 하므로 진입 경로·인증·config 를 트리거 PATCH 로 흔들지 못하게 막고 메타 편집은 스케줄 화면으로 모은다.

그래서 "`UpdateTriggerDto` 가 `endpointPath` 를 받는데 서비스가 거부하니 leaky abstraction 이다" 는 오판이다. `UpdateTriggerDto` 는 세 트리거 유형이 함께 쓰는 단일 DTO 이므로 편집할 수 있는 필드의 합집합을 노출하는 것이 정상이다. 유형별 허용·거부는 서비스 층이 맡는 의도한 설계다.

### 웹훅 202 응답 모양을 지금 코드에 맞춘다 (2026-10-09)

202 응답 모양은 지금 코드를 기준으로 정한다. NERV Task `CLE-T-M6PERB` 에서 사용자에게 묻지 않고 기본값으로 정해 알린 뒤 진행했다(2026-10-09). 결정 이력은 그 Task 의 결정 기록에 있다.

- 배경: 문서마다 응답 계약이 달랐다. `message` 가 남는지는 [External Interaction API](../CLE-IX/CLE-EIA.md#미결-사항) 의 미결로 미뤄졌고 인터랙션 응답 요구사항은 `per_execution` 만 다뤄 `per_trigger` 트리거의 응답이 정해지지 않았다.
- 코드(`hooks.controller.ts` 의 `message`, `hooks.service.ts` 의 `buildInteractionResponse`)의 동작인 [수신 API](#수신-api) 의 모양을 그대로 계약으로 삼는다. `per_trigger` 호출자에게는 트리거 단위 토큰이 이미 있어서 응답에 토큰을 실을 필요가 없다. 다음 호출에 쓸 `endpoints` 는 두 전략 모두 필요하다.
- 202 응답 모양의 기준은 이 문서의 「수신 API」 와 [웹훅 「요구사항」](CLE-TRIG-WEBHOOK.md#요구사항) 이다. [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 과 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 은 처리 흐름이나 EIA 쪽 뜻만 적고 모양은 여기를 가리킨다. 여러 문서가 같은 필드를 나열하면 저마다 두 번째 기준이 되기 때문이다. [External Interaction API](../CLE-IX/CLE-EIA.md#웹훅-호출-응답-확장) 의 응답 예시도 이 기준을 따른다. 이 기준 문서 지정도 사용자에게 묻지 않고 기본값으로 정해 알렸다.
