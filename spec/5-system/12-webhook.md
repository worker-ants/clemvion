---
id: webhook
status: partial
code:
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts
  - codebase/backend/src/modules/hooks/public-webhook-quota.service.ts
  - codebase/backend/src/modules/auth-configs/auth-configs.service.ts
  - codebase/backend/src/modules/triggers/triggers.service.ts
pending_plans:
  - plan/in-progress/spec-sync-webhook-gaps.md
---

# Spec: Webhook 트리거 시스템

> 관련 문서: [Spec 트리거 목록](../2-navigation/2-trigger-list.md) · [Spec 데이터 모델](../1-data-model.md#28-trigger) · [Spec 실행 엔진](./4-execution-engine.md) · [Spec External Interaction API](./14-external-interaction-api.md) · [Spec Chat Channel](./15-chat-channel.md)

---

## Overview (제품 정의)

---

### 1. 개요

외부 서비스(GitHub, Stripe 등)나 사용자 정의 시스템에서 HTTP 요청을 보내 워크플로우를 자동으로 실행하는 Webhook 트리거 기능을 정의한다. Webhook은 이벤트 기반 자동화의 핵심 진입점으로, 외부 이벤트 발생 시 실시간으로 워크플로우를 트리거한다.

---

### 2. 사용 시나리오

| 시나리오 | 설명 |
|----------|------|
| GitHub PR 이벤트 | PR 생성/머지 시 코드 리뷰 워크플로우 자동 실행 |
| 이메일 수신 | 특정 메일 수신 시 AI 에이전트 워크플로우 실행 |
| Stripe 결제 이벤트 | 결제 완료/실패 시 알림 워크플로우 실행 |
| 폼 제출 | 외부 웹 폼에서 제출 시 데이터 처리 워크플로우 실행 |
| IoT 데이터 수신 | 센서 데이터 도착 시 분석 워크플로우 실행 |

---

### 3. 요구사항

#### 3.1 Webhook 엔드포인트

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-EP-01 | 트리거별 고유한 webhook URL 자동 생성 | 필수 |
| WH-EP-02 | URL 형식: `{base_url}/api/hooks/{endpoint_path}`. `base_url` 은 webhook 을 서빙하는 백엔드 origin. 프론트엔드(트리거 화면)는 표시·복사용 URL 의 base 를 `NEXT_PUBLIC_WEBHOOK_BASE_URL`(명시 override) → `NEXT_PUBLIC_API_URL` 에서 후행 `/api` 제거 → `window.location.origin` 순으로 결정한다 (구현 `codebase/frontend/src/lib/utils/webhook-url.ts`). | 필수 |
| WH-EP-03 | HTTP POST 메서드 지원 (POST 전용 — GET/PUT 미지원) | 필수 |
| WH-EP-04 | JSON, form-urlencoded 요청 본문 수신 | 필수 |
| WH-EP-05 | 요청 본문 전체를 워크플로우 입력 데이터로 전달 (`body`) | 필수 |
| WH-EP-05-1 | Manual Trigger 노드가 선언한 `parameters` 스키마에 따라 body에서 파라미터를 추출/검증하여 `$input.parameters` / `$params`로 제공 | 필수 |
| WH-EP-05-2 | required 파라미터 누락 또는 타입 강제 변환 실패 시 `400 Bad Request`와 누락 필드 목록 반환 | 필수 |
| WH-EP-06 | 요청 헤더 정보를 메타데이터로 전달 (`headers`, `method`, `query`) | 권장 |
| WH-EP-07 | 비활성 트리거로의 요청은 `410 Gone` 응답 반환. **예외**: `config.chatChannel` 이 설정된 트리거는 `202 Accepted + { executionId: 'ignored' }` 를 반환한다 (Telegram 등 chat-channel provider 가 non-2xx 응답 시 webhook 자동 비활성화·retry 폭주를 유발하므로). 구현상 `config.chatChannel` 분기가 `isActive` 검사보다 선행하며, inbound 서명 검증을 수행한 뒤(실패 시 401) 비활성 시 202 silent skip. 상세 — [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract). | 필수 |

#### 3.2 인증 및 보안

모든 인증은 `trigger.auth_config_id` 가 가리키는 `AuthConfig` ([Spec 데이터 모델 §2.17](../1-data-model.md#217-authconfig)) 로 수행한다. `auth_config_id IS NULL` 이면 인증 없음(none).

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-SC-01 | 인증 없음(공개) 옵션 — `auth_config_id IS NULL`. `endpointPath` UUID 가 사실상 비밀 키 | 필수 |
| WH-SC-02 | HMAC 서명 검증 — AuthConfig.type=`hmac`, `config.secret` 기반, 헤더는 `config.header` (default `X-Hub-Signature-256`) | 필수 |
| WH-SC-03 | Bearer Token 검증 — AuthConfig.type=`bearer_token` (`Authorization: Bearer <token>`) | 필수 |
| WH-SC-04 | 인증 실패 시 `401 Unauthorized` 응답 (단일 메시지 `AUTH_FAILED` — enumeration 방지) | 필수 |
| WH-SC-05 | Rate limiting — 분당 최대 요청 수 (현행 구현: 글로벌 throttler **100 req/min**, [Spec API 규약 §7](./2-api-convention.md#7-rate-limiting)). 추가로 공개 webhook(`auth_config_id IS NULL`)에는 `PublicWebhookThrottleGuard` 의 IP 단위 한도(분당 10·시간당 누적 20 기본)가 적용된다 — §6 참조 | 권장 |
| WH-SC-06 | API Key 검증 — AuthConfig.type=`api_key`, 헤더 `config.headerName` (default `X-API-Key`) 의 값 비교 | 필수 |
| WH-SC-07 | Basic Auth 검증 — AuthConfig.type=`basic_auth` (`Authorization: Basic base64(user:pass)`) | 필수 |
| WH-SC-08 | 인증 성공 시 `AuthConfig.last_used_at = NOW()` fire-and-forget UPDATE (트랜잭션 외, 실패 시 미갱신) | 필수 |
| WH-SC-09 | AuthConfig.ip_whitelist 가 설정된 경우 클라이언트 IP allowlist 시행 (불일치 시 401 `AUTH_FAILED`). 각 항목은 단일 IP 또는 CIDR 표기를 허용하며 (IPv4-mapped IPv6 클라이언트는 IPv4 로 정규화 비교), 클라이언트 IP 를 알 수 없으면 거부(fail-closed). ip_whitelist 는 AuthConfig 종속이므로 `auth_config_id IS NOT NULL` 일 때만 평가 | 권장 |

#### 3.3 응답 및 피드백

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-RS-01 | 요청 수신 즉시 `202 Accepted` + `executionId` 반환 (비동기 실행) | 필수 |
| WH-RS-02 | 잘못된 경로의 요청은 `404 Not Found` 반환 | 필수 |
| WH-RS-03 | 요청 본문 파싱 실패 시 `400 Bad Request` 반환 | 필수 |
| WH-RS-04 | 트리거에 `interaction.enabled=true` 가 설정되고 `tokenStrategy="per_execution"` 인 경우, 202 응답 body 에 `interaction.token` / `interaction.expiresAt` / `interaction.endpoints` 필드를 동봉한다 — 상세는 [Spec External Interaction API §4.1](./14-external-interaction-api.md#41-webhook-호출-응답-확장) | 필수 |

#### 3.4 관리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-MG-01 | 워크플로우 에디터 또는 트리거 화면에서 webhook 트리거 생성 | 필수 |
| WH-MG-02 | 생성 시 endpoint_path 자동 생성 (랜덤 UUID 기반) | 필수 |
| WH-MG-03 | 트리거 목록에서 webhook URL 전체를 클립보드 복사 | 필수 |
| WH-MG-04 | 활성/비활성 토글로 webhook 수신 제어 (사용자 명시 토글 한정 — 시스템 자동 비활성화는 WH-MG-07 / [EIA §R6](./14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지) 참조) | 필수 |
| WH-MG-05 | 호출 이력에서 요청 시각, 상태, 응답 코드 확인 | 필수 |
| WH-MG-06 | 트리거 생성/수정 페이로드의 `notification` (outbound 이벤트 webhook URL + HMAC secret + 구독 이벤트 목록) 및 `interaction` (외부 인터랙션 채널 활성화 + token 전략) 옵션 — 상세는 [Spec External Interaction API §4](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) | 필수 |
| WH-MG-07 | 트리거 상세 화면에 `notificationHealth` 표시 (unknown / healthy / degraded). degraded 상태에서도 트리거 자동 비활성화하지 않음 — [Spec External Interaction API §R6](./14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지) | 권장 |
| WH-MG-08 | 트리거 생성/수정 페이로드의 `chatChannel` 옵션 (외부 chat 플랫폼 어댑터 연결 — Telegram 등) — 상세는 [Spec Chat Channel §4](./15-chat-channel.md#4-데이터-모델). `chatChannel` 미존재 시 일반 webhook 트리거 (기존 동작 그대로) | 필수 |
| WH-MG-09 | 트리거 상세 화면에 `chatChannelHealth` 표시 (unknown / healthy / degraded). `notificationHealth` 배지와 동일 영역·동일 형식으로 나란히 배치. degraded 상태에서도 트리거 자동 비활성화하지 않음 — [Spec Chat Channel §3.4 CCH-SE-01](./15-chat-channel.md#34-신뢰성--보안) | 권장 |

---

### 4. 비기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-NF-01 | webhook 수신 후 200ms 이내 응답 반환 (실행은 비동기) | 필수 |
| WH-NF-02 | 요청 본문 최대 크기. **현행 구현**: 공개(인증 없음 — `auth_config_id IS NULL`) webhook 에 한해 `PublicWebhookThrottleGuard` 가 **32KB** (`DEFAULT_MAX_BODY_BYTES`, config `publicWebhook.maxBodyBytes`) 초과 시 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` 를 반환한다. 인증 webhook 에는 별도의 본문 크기 게이트가 없다 (전역 body-parser limit 미설정 — express 기본값 적용). **1MB 통일 임계는 미구현 (Planned)** — `plan/in-progress/spec-sync-webhook-gaps.md`. | 필수 |
| WH-NF-03 | 동시 다발 webhook 수신 처리 (실행 엔진은 독립적으로 동작) | 필수 |

---

## 1. 아키텍처 개요

```
외부 서비스 (GitHub, Stripe 등)
       │
       ▼  HTTP POST
┌──────────────────────────────────────┐
│  POST /api/hooks/:endpointPath       │
│  (HooksController)                   │
│                                      │
│  1. endpointPath로 Trigger 조회      │
│  2. isActive 확인                    │
│  3. 인증 검증 (AuthConfig)           │
│  4. 202 Accepted 즉시 반환           │
│  5. executionEngine.execute() 호출   │
└──────────────┬───────────────────────┘
               │ (비동기)
               ▼
┌──────────────────────────────────────┐
│  ExecutionEngineService.execute()    │
│  - Execution 레코드 생성             │
│  - 워크플로우 실행 (백그라운드)        │
└──────────────────────────────────────┘
```

---

## 2. 데이터 모델

### 2.1 기존 엔티티 활용

Webhook 트리거는 기존 `Trigger` 엔티티를 사용한다. 신규 테이블 불필요.

| 필드 | 용도 |
|------|------|
| `type` | `'webhook'` |
| `endpointPath` | URL 경로 (고유, UUID 기반 자동 생성) |
| `isActive` | 수신 활성/비활성 |
| `authConfigId` | Webhook 인증 검증의 단일 진입 (FK → AuthConfig). `NULL` 이면 인증 없음(none). 인증 자료·`ip_whitelist` 는 모두 AuthConfig 가 보유 — `config` 에 inline 인증 키 없음 (V066 cleanup) |
| `config` | 추가 설정 (JSONB) — 인증 관련 키는 보유하지 않음 (§2.2) |
| `workflowId` | 실행할 워크플로우 |
| `lastTriggeredAt` | 마지막 호출 시각 |

### 2.2 config 필드 구조

```json
{
  "notification": { /* External Interaction API 의 outbound 설정. [Spec EIA §4·§7.1](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) */ },
  "interaction":  { /* External Interaction API 의 inbound 설정. [Spec EIA §4·§7.1](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) */ },
  "chatChannel":  { /* Chat Channel adapter 설정 (Telegram 등). [Spec Chat Channel §4.1](./15-chat-channel.md#41-triggerconfigchatchannel) */ }
}
```

`notification` / `interaction` / `chatChannel` 은 누락 가능. 누락 시 해당 외부 인터랙션 채널 / chat 채널 어댑터가 비활성으로 간주된다 (기존 동작과 호환). 별 컬럼이 필요한 health/secret rotation 추적 필드는 [Spec EIA §7.1](./14-external-interaction-api.md#71-trigger-엔티티-확장) 와 [Spec Chat Channel §4.2](./15-chat-channel.md#42-trigger-테이블-신규-컬럼) 에 정의.

**인증 키는 `config` 에 보유하지 않는다.** Webhook 인증 검증은 `trigger.auth_config_id` 가 가리키는 `AuthConfig.type` ([Spec 데이터 모델 §2.17](../1-data-model.md#217-authconfig)) 으로 결정된다. 과거 inline 키 (`authType` / `secret` / `bearerToken` / `hmacHeader` / `hmacAlgorithm`) 는 `V066__trigger_config_strip_inline_auth.sql` cleanup migration 으로 제거되며, 잔존 row 에 키가 남아 있어도 코드는 무시한다. (AuthConfig.config 의 `header` / `algorithm` 은 과거 `config.hmacHeader` / `hmacAlgorithm` 과 위치·소유자가 다르다 — 트리거가 아니라 자격증명 메타.)

---

## 3. API 명세

### 3.1 Webhook 수신 엔드포인트

```
POST /api/hooks/:endpointPath
```

| 항목 | 설명 |
|------|------|
| 인증 | `trigger.auth_config_id` 가 가리키는 `AuthConfig.type` 에 따름 (none = `auth_config_id IS NULL` / api_key / bearer_token / basic_auth / hmac). `is_active=false` 인 AuthConfig 는 즉시 401 `AUTH_FAILED`. `AuthConfig.ip_whitelist` 가 있으면 함께 시행 |
| Content-Type | `application/json`, `application/x-www-form-urlencoded` |
| 요청 본문 최대 크기 | 1MB |

**성공 응답** (`202 Accepted`) — 핸들러 반환값(아래)은 전역 `TransformInterceptor` 가 `{ "data": { ... } }` 로 래핑해 전송한다 ([Spec API 규약 §5.1](./2-api-convention.md#5-응답-형식)):
```json
{
  "data": {
    "executionId": "uuid",
    "message": "Webhook received, workflow execution started"
  }
}
```

트리거에 `interaction.enabled=true` + `tokenStrategy="per_execution"` 가 설정되면 위 `data` 객체에 추가로 `status: "pending"` 과 `interaction: { token, expiresAt, endpoints }` 가 동봉된다. 상세는 [Spec External Interaction API §4.1](./14-external-interaction-api.md#41-webhook-호출-응답-확장).

**에러 응답**:

| 상태 | 조건 |
|------|------|
| `400 Bad Request` | 요청 본문 파싱 실패 |
| `401 Unauthorized` | 인증 검증 실패 |
| `404 Not Found` | endpointPath에 해당하는 트리거 없음 |
| `410 Gone` | 트리거가 비활성 상태 (`config.chatChannel` 트리거는 예외 — 비활성 시 `202 Accepted + { executionId: 'ignored' }`, [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract) / WH-EP-07 참조) |

### 3.2 기존 Trigger CRUD API

기존 `/api/triggers` 엔드포인트를 그대로 사용. 변경 없음.

---

## 4. 인증 방식

모든 인증 자료는 `trigger.auth_config_id` 가 가리키는 `AuthConfig.config` ([Spec 데이터 모델 §2.17.1](../1-data-model.md#2171-config-의-jsonb-스키마)) 에서 복호화해 비교한다. 비교는 `crypto.timingSafeEqual` 기반 상수 시간 비교로 타이밍 공격을 막는다. 인증 실패는 type 무관 단일 `401 AUTH_FAILED` 응답 (어떤 type 인지·왜 실패했는지 클라이언트로 반사하지 않음 — enumeration·information leakage 차단). 진단은 서버 로그에만 남긴다.

### 4.1 None (공개)

`auth_config_id IS NULL`. 인증 없이 누구나 호출 가능. `endpointPath`의 UUID가 사실상 비밀 키 역할.

### 4.2 HMAC 서명 — AuthConfig.type=`hmac`

```
요청 헤더:  {config.header}: {config.algorithm}=<hex-digest>   (default header: X-Hub-Signature-256)
검증 방식:  HMAC-{config.algorithm}(config.secret, rawBody) === 헤더 값
```

GitHub Webhook과 동일한 방식.

- **알고리즘 허용 목록**: `config.algorithm` 은 `sha256`, `sha512` 만 허용. 다른 값은 인증 실패로 처리.
- **rawBody 요구**: HMAC 검증은 파싱 전 원본 바이트가 필요하다. NestJS 부트스트랩에서 `rawBody: true` 활성화가 필수다.

### 4.3 Bearer Token — AuthConfig.type=`bearer_token`

```
요청 헤더:  Authorization: Bearer <token>
검증 방식:  token === config.token
```

### 4.4 API Key — AuthConfig.type=`api_key`

```
요청 헤더:  {config.headerName}: <key>   (default header: X-API-Key)
검증 방식:  헤더 값 === config.key
```

### 4.5 Basic Auth — AuthConfig.type=`basic_auth`

```
요청 헤더:  Authorization: Basic base64(username:password)
검증 방식:  디코드한 username/password === config.username / config.password
```

---

## 5. 워크플로우 입력 데이터 구조

Webhook으로 수신된 데이터는 아래 구조로 워크플로우에 전달:

```json
{
  "parameters": { "orderId": "abc", "amount": 1000 },
  "body": { "orderId": "abc", "amount": "1000", "extra": "..." },
  "headers": {
    "content-type": "application/json",
    "x-event-type": "order.created"
  },
  "query": { "key": "value" },
  "method": "POST"
}
```

| 키 | 설명 |
|----|------|
| `parameters` | Manual Trigger 노드의 `config.parameters`에 따라 **body의 동일 이름 최상위 키**에서 추출 + 타입 coerce 결과. 다운스트림에서 `$params.<name>` 또는 `$input.parameters.<name>`으로 접근. |
| `body` | 파싱된 요청 본문 (JSON 또는 form data, 원본 유지) |
| `headers` | 요청 헤더 (소문자 키) |
| `query` | URL 쿼리 파라미터 |
| `method` | HTTP 메서드 |

### 5.1 파라미터 추출 규칙

1. 워크플로우의 manual_trigger 노드에서 `config.parameters` 스키마를 조회한다.
2. 스키마가 없거나 빈 배열 → `parameters = {}` (기존 동작과 호환)
3. 스키마가 있는 경우 각 파라미터에 대해:
   - `body`가 객체인 경우: 해당 `name` 최상위 키 값을 가져옴
   - `body`가 객체가 아닌 경우: 모든 값은 미지정으로 취급
   - 값이 없고 `required=true`면 누락으로 간주 → **400 Bad Request** 반환 (body 전체가 누락 필드 목록과 함께)
   - 값이 없고 `required=false`면 `defaultValue` 사용 (없으면 `null`)
   - 타입 불일치는 `coerceToType`로 강제 변환 (실패 시 400)

### 5.2 400 응답 형식

```json
{
  "statusCode": 400,
  "message": "Invalid webhook payload",
  "errors": [
    { "field": "orderId", "reason": "missing_required" },
    { "field": "amount", "reason": "coerce_failed" }
  ]
}
```

이 경우 Execution 레코드는 생성되지 않는다.

---

## 6. 구현 파일 구조

```
codebase/backend/src/modules/hooks/
  ├── hooks.module.ts                    # 모듈 정의
  ├── hooks.controller.ts                # POST /api/hooks/:endpointPath
  ├── hooks.service.ts                   # 트리거 조회, 인증 검증, 실행 트리거
  ├── public-webhook-throttle.guard.ts   # 공개 webhook 전용 body 32KB 제한 + IP 단위 rate-limit (인증 webhook 은 무제한 통과)
  └── public-webhook-quota.service.ts    # Redis fixed-window 카운터 (분당/시간당 누적 상한)
```

- `/api/hooks/*` 경로는 JWT 인증 제외 (외부 서비스가 호출하므로)
- Rate Limiting (전역): 글로벌 throttler **100 req/min** ([Spec API 규약 §7](./2-api-convention.md#7-rate-limiting))
- Rate Limiting (공개 webhook 전용 추가): `PublicWebhookThrottleGuard` 가 `auth_config_id IS NULL` 트리거에 한해 IP 단위 시작 한도(기본 분당 10, config `publicWebhook.startupPerMinute`) + 시간당 누적 신규 상한(기본 20, `publicWebhook.hourlyNewMax`) 을 적용. 초과 시 `429 PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT`. 인증 webhook 은 이 Guard 를 무제한 통과. Redis 미가용 시 fail-open. (SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md))
- 기존 `TriggersService.findByEndpointPath()` 재사용

---

## 7. 처리 흐름

```
1. POST /api/hooks/abc-123-def 수신
2. HooksService.handleWebhook('abc-123-def', body, headers, query)
3. TriggersService.findByEndpointPath('abc-123-def') → Trigger 엔티티
4. Trigger 없으면 → 404 Not Found
5. Trigger.isActive === false → `config.chatChannel` 가 있으면 step 6 (인증) 을 먼저 수행한 뒤(서명 실패 시 401) step 7c 의 silent skip 분기로 진입 (update 무시, 응답은 202 + { executionId: 'ignored' }); `config.chatChannel` 가 없으면 410 Gone. 즉 `HooksService.handle` 의 chatChannel 분기가 isActive 검사보다 선행한다. (chatChannel 트리거는 비활성 상태에서도 인증을 그대로 수행 — 정당화: (a) 보안 — auth 실패한 요청에 silent 202 를 주면 공격자가 trigger 활성 여부를 inference 할 수 없도록 함, (b) 운영 — auth 실패는 운영자 디버깅 가시성 401 필요. 상세 [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract) 참조.)
6. 인증 검증:
   a. trigger.auth_config_id IS NULL → 통과 (none). (ip_whitelist 도 AuthConfig 종속이라 평가 대상 없음)
   b. authConfigsService.findById(trigger.auth_config_id, trigger.workspace_id) → AuthConfig row
   c. AuthConfig.is_active === false → 401 AUTH_FAILED
   d. AuthConfig.ip_whitelist 가 있으면 클라이언트 IP allowlist 검증 (불일치 → 401)
   e. AuthConfig.type 별 분기 (bearer_token / api_key / basic_auth / hmac) → constantTimeEquals 비교
   f. 성공 → AuthConfig.last_used_at = NOW() fire-and-forget UPDATE (트랜잭션 외)
   g. 실패 → 401 Unauthorized (단일 메시지 AUTH_FAILED, 갱신 안 함)
7. config.chatChannel 가 있으면 (Chat Channel 분기):
   a. adapter = ChannelAdapterRegistry.get(config.chatChannel.provider)
   b. update = await adapter.parseUpdate(rawBody, config.chatChannel)   // 50ms 이내 (CCH-NF-01)
   c. update === null 이면 (group chat / 무시 대상) → 202 Accepted + { ignored: true } 즉시 반환 (Execution 미생성)
   d. ChannelConversationService.lookup(triggerId, update.conversationKey) → ChannelConversation 조회
   e. 활성 execution 이 있으면 InteractionService.interact() in-process 호출 (token bypass — [EIA §3.3 EIA-AU-08](./14-external-interaction-api.md#33-인증))
      없으면 ExecutionEngineService.execute() 시작 (입력 = parseUpdate 결과 변환)
   f. 202 Accepted 즉시 반환 ([WH-NF-01](#4-비기능-요구사항) 200ms 이내, 후속 처리는 백그라운드). 단 일부 provider handshake/interactivity ack (Slack url_verification·Interactivity, Discord PING·Interactivity, native modal) 은 `200 OK` + 비-래핑 JSON 으로 직접 응답한다 (TransformInterceptor 우회) — 상세 [Spec Chat Channel §5.5·§5.5.1](./15-chat-channel.md#55-inbound-http-contract).
8. config.chatChannel 가 없으면 (기존 경로):
   a. resolveTriggerParameters(workflow, body) 호출
      - required 누락 / coerce 실패 → 400 Bad Request (Execution 생성하지 않음)
   b. ExecutionEngineService.execute(trigger.workflowId, { parameters, body, headers, query, method }, { triggerId: trigger.id })
      - 3번째 인자로 `triggerId`를 전달해야 생성되는 Execution 행의 `trigger_id` 컬럼이 채워지고, 결과적으로 "최근 실행" 화면에서 출처가 `webhook` 으로 분류된다.
9. Trigger.lastTriggeredAt = now → DB 업데이트
10. 202 Accepted + { data: { executionId, message } } 반환 (전역 TransformInterceptor 가 `{ data }` 래핑)

> Chat Channel 분기의 outbound 응답 (사용자에게 메시지 발송) 은 본 webhook 수신 흐름 안에서 발생하지 않는다.
> [Spec Chat Channel §3.1](./15-chat-channel.md#31-전체-시퀀스-telegram-예시) 의 NotificationDispatcher EventEmitter 경로로 비동기 처리된다.
```

---

## 8. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 엔드포인트 유추 방지 | UUID 기반 랜덤 경로 (brute force 불가) |
| 비밀 키 저장 | Webhook 인증 자료는 모두 `auth_config.config` JSONB 에 AES-256-GCM 으로 암호화 저장 ([Spec 데이터 모델 §2.17.2](../1-data-model.md#2172-마스킹노출-정책)). API 응답 시 항상 마스킹, 평문 노출은 create / regenerate / reveal 3 경로만 |
| last_used_at 갱신 | 인증 성공 직후 `auth_config.last_used_at = NOW()` fire-and-forget UPDATE. 트랜잭션 외라 race 시 last-write-wins, 실패 시 미갱신 (활성 가시성 차단) |
| 본문 크기 제한 | **현행**: 공개 webhook 만 32KB 초과 시 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` (`PublicWebhookThrottleGuard`). 인증 webhook 은 별도 게이트 없음. 1MB 통일 임계는 미구현 (WH-NF-02, Planned) |
| Rate Limiting | 글로벌 Throttler (100 req/min, [Spec API 규약 §7](./2-api-convention.md#7-rate-limiting)) + 공개 webhook 전용 IP 단위 한도 (분당 10·시간당 20 기본, `PublicWebhookThrottleGuard`/`PublicWebhookQuotaService`) |
| JWT 제외 | `/api/hooks/*` 경로는 JWT guard에서 제외 |
| CORS | webhook 엔드포인트는 CORS 제한 없음 |

---

## 9. 에러 처리

| 상황 | 처리 |
|------|------|
| 워크플로우가 삭제됨 | Trigger의 workflowId FK CASCADE로 Trigger도 삭제됨 → 404 |
| 실행 엔진 오류 | 500 Internal Server Error 반환, 에러 로깅 |
| 동시 다발 요청 | 각 요청은 독립적인 Execution을 생성하여 병렬 실행 |

---

## 10. 프론트엔드 연동

기존 트리거 목록 화면(`/triggers`)과 상세 드로어에서 webhook 정보가 이미 표시됨. 추가 UI 변경 없음:
- URL 복사 버튼 (📋)
- HTTP 메서드 표시
- 호출 이력 표시

신규 (External Interaction API 활성화 시):
- 트리거 상세 드로어에 `notification` 섹션 — URL, 구독 이벤트, secret rotation 버튼, `notificationHealth` 배지
- `interaction` 섹션 — enabled 토글, tokenStrategy 표시, per_trigger 인 경우 token revoke 버튼

---

## Rationale

### webhook URL base 결정 규약 명문화 + cross-spec 정합화

WH-EP-02 에 프론트엔드 base 결정 우선순위(`NEXT_PUBLIC_WEBHOOK_BASE_URL` → `NEXT_PUBLIC_API_URL` 의 `/api` 제거 → `window.location.origin`)를 명문화했다 (구현 `codebase/frontend/src/lib/utils/webhook-url.ts`). webhook 엔드포인트는 백엔드가 서빙하므로 base 는 백엔드 origin 이다.

본 spec 을 webhook 도메인 SoT 로 확정한다: ① 응답은 전역 `TransformInterceptor` 로 `{data:...}` 래핑(§3.1) ② rate limit 은 글로벌 throttler **100 req/min**(§6·§8·WH-SC-05) ③ POST 전용(GET/PUT·`?wait` 동기모드 미지원) ④ URL 정본 `/api/hooks/:endpointPath`(`/api/webhooks`·workspaceSlug 세그먼트는 없음).

### 외부 인터랙션 채널을 별도 spec 파일로 분리

본 spec 은 "트리거 진입점" (외부 → workflow 시작) 의 책임에 한정한다. 트리거가 실행시킨 workflow 가 도중에 `waiting_for_input` 으로 멈추거나 종료될 때 외부 시스템과 turn 을 주고받는 채널은 [Spec External Interaction API](./14-external-interaction-api.md) 가 단일 진실로 다룬다. 본 문서는 그쪽 spec 에 cross-link 만 둔다.

위치 결정 근거는 [Spec EIA §R9](./14-external-interaction-api.md#r9-spec-위치--5-system-하위-신규-파일) 참조.

### Chat Channel 어댑터 — 별도 spec 으로 분리

Webhook 트리거의 `config.chatChannel` 한 갈래로 동작하지만 어댑터 설계·provider 별 구체 정의가 분리되는 별 layer 이므로 [Spec Chat Channel](./15-chat-channel.md) 로 단일 진실 분리. 본 spec 은 `chatChannel` config 의 위치 (§2.2) + WH-MG-08/09 의 관리 요구사항 + §7 처리 흐름의 분기만 정의하고, 어댑터 인터페이스·provider 별 구체·EIA 와의 관계는 모두 Chat Channel spec 에 위임. 트리거 유형 카탈로그 (Manual / Webhook / Schedule 3종) 는 그대로 유지된다.

### inline auth path 폐지 — AuthConfig 단일 진입

`auth_config_id` 가 webhook 인증의 단일 진입(SoT)이며 inline 인증 path (`trigger.config.authType` 등) 는 사용하지 않는다. 근거:

1. **자격증명 vault 중복 회피** — AuthConfig 도메인(`/authentication` 메뉴)이 발행·회전(regenerate)·통계(last_used_at)·RBAC·마스킹을 이미 책임진다. inline 은 동일 책임의 축소판으로, 두 경로가 공존하면 vault 와의 일관성이 깨진다.
2. **rotation 훅 부재** — inline secret 은 `PATCH /api/triggers/:id` 의 부분 갱신으로만 교체 가능했고 grace·즉시 무효화·audit 가 없었다. AuthConfig 는 `regenerate` 로 일원화.
3. **`last_used_at` 미갱신** — inline 은 사용 통계가 trigger 단위로 묶여 "어떤 자격증명이 마지막으로 쓰였는가" 추적이 불가했다.
4. **ip_whitelist 우회** — AuthConfig 가 보유한 `ip_whitelist` (§2.17) 가 inline path 에서는 시행되지 않았다.
5. **RBAC 회피** — AuthConfig 는 Owner/Admin = CRUD, Editor/Viewer = R ([Spec 인증 §3.2](./1-auth.md#3-인가-authorization)) 인 반면, inline 은 trigger CRUD 권한(editor+)으로 자격증명까지 수정 가능해 권한 모델 일관성이 깨졌다.
6. **평문 secret JSONB 잔존** — 평문 `bearerToken`/`secret` 이 `trigger.config` 에 노출되어 백업·로그·재현 시 유출 위험이 있었다. `V066__trigger_config_strip_inline_auth.sql` cleanup migration 으로 제거.

`auth_config_id IS NULL` 인 트리거는 "인증 없음(none)" 으로 동작한다.
