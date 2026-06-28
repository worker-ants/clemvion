---
id: webhook
status: implemented
code:
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/dto/responses/webhook-response.dto.ts
  - codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts
  - codebase/backend/src/modules/hooks/public-webhook-quota.service.ts
  - codebase/backend/src/bootstrap/hooks-body-parser.ts
  - codebase/backend/src/modules/auth-configs/auth-configs.service.ts
  - codebase/backend/src/modules/triggers/triggers.service.ts
---

# Spec: Webhook 트리거 시스템

> 관련 문서: [Spec 트리거 목록](../2-navigation/2-trigger-list.md) · [Spec 데이터 모델](../1-data-model.md#28-trigger) · [Spec 실행 엔진](./4-execution-engine.md) · [Spec External Interaction API](./14-external-interaction-api.md) · [Spec Chat Channel](./15-chat-channel.md)

---

## Overview (제품 정의)

---

### 개요

외부 서비스(GitHub, Stripe 등)나 사용자 정의 시스템에서 HTTP 요청을 보내 워크플로우를 자동으로 실행하는 Webhook 트리거 기능을 정의한다. Webhook은 이벤트 기반 자동화의 핵심 진입점으로, 외부 이벤트 발생 시 실시간으로 워크플로우를 트리거한다.

---

### 사용 시나리오

| 시나리오 | 설명 |
|----------|------|
| GitHub PR 이벤트 | PR 생성/머지 시 코드 리뷰 워크플로우 자동 실행 |
| 이메일 수신 | 특정 메일 수신 시 AI 에이전트 워크플로우 실행 |
| Stripe 결제 이벤트 | 결제 완료/실패 시 알림 워크플로우 실행 |
| 폼 제출 | 외부 웹 폼에서 제출 시 데이터 처리 워크플로우 실행 |
| IoT 데이터 수신 | 센서 데이터 도착 시 분석 워크플로우 실행 |

---

### 요구사항

#### Webhook 엔드포인트

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-EP-01 | 트리거별 고유한 webhook URL 자동 생성 | 필수 |
| WH-EP-02 | URL 형식: `{base_url}/api/hooks/{endpoint_path}`. `base_url` 은 webhook 을 서빙하는 백엔드 origin. 프론트엔드(트리거 화면)는 표시·복사용 URL 의 base 를 `NEXT_PUBLIC_WEBHOOK_BASE_URL`(명시 override) → `NEXT_PUBLIC_API_URL` 에서 후행 `/api` 제거 → `window.location.origin` 순으로 결정한다 (구현 `codebase/frontend/src/lib/utils/webhook-url.ts`). | 필수 |
| WH-EP-03 | HTTP POST 메서드 지원 (POST 전용 — GET/PUT 등 미지원 메서드는 `405 Method Not Allowed`, [API 규약 §11.2](./2-api-convention.md#112-지원-메서드)) | 필수 |
| WH-EP-04 | JSON, form-urlencoded 요청 본문 수신 | 필수 |
| WH-EP-05 | 요청 본문 전체를 워크플로우 입력 데이터로 전달 (`body`) | 필수 |
| WH-EP-05-1 | Manual Trigger 노드가 선언한 `parameters` 스키마에 따라 body에서 파라미터를 추출/검증하여 `$input.parameters` / `$params`로 제공 | 필수 |
| WH-EP-05-2 | required 파라미터 누락 또는 타입 강제 변환 실패 시 `400 Bad Request` — 응답은 공식 에러 봉투이며 필드별 사유는 `error.details[]` 로 노출 ([§5.2](#52-400-응답-형식) · [API 규약 §5.3](./2-api-convention.md#53-에러-응답)) | 필수 |
| WH-EP-06 | 요청 헤더 정보를 메타데이터로 전달 (`headers`, `method`, `query`) | 권장 |
| WH-EP-07 | 비활성 트리거로의 요청은 `410 Gone` 응답 반환. **예외**: `config.chatChannel` 이 설정된 트리거는 `202 Accepted + { executionId: 'ignored' }` 를 반환한다 (Telegram 등 chat-channel provider 가 non-2xx 응답 시 webhook 자동 비활성화·retry 폭주를 유발하므로). 구현상 `config.chatChannel` 분기가 `isActive` 검사보다 선행하며, inbound 서명 검증을 수행한 뒤(실패 시 401) 비활성 시 202 silent skip. 상세 — [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract). | 필수 |

#### 인증 및 보안

모든 인증은 `trigger.auth_config_id` 가 가리키는 `AuthConfig` ([Spec 데이터 모델 §2.17](../1-data-model.md#217-authconfig)) 로 수행한다. `auth_config_id IS NULL` 이면 인증 없음(none).

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-SC-01 | 인증 없음(공개) 옵션 — `auth_config_id IS NULL`. `endpointPath` UUID 가 사실상 비밀 키이므로 **반드시 CSPRNG 로 발급한 v4 UUID** 여야 한다(`crypto.randomUUID()`). 서버는 형식(v4)을 강제(WH-MG-02)하나 엔트로피 품질까지 검증할 수 없으므로, 클라이언트는 약한 RNG·고정값 사용을 금한다. | 필수 |
| WH-SC-02 | HMAC 서명 검증 — AuthConfig.type=`hmac`, `config.secret` 기반, 헤더는 `config.header` (default `X-Hub-Signature-256`) | 필수 |
| WH-SC-03 | Bearer Token 검증 — AuthConfig.type=`bearer_token` (`Authorization: Bearer <token>`) | 필수 |
| WH-SC-04 | 인증 실패 시 `401 Unauthorized` 응답 (단일 메시지 `AUTH_FAILED` — enumeration 방지) | 필수 |
| WH-SC-05 | Rate limiting — 분당 최대 요청 수 (현행 구현: 글로벌 throttler **100 req/min**, [Spec API 규약 §7](./2-api-convention.md#7-rate-limiting)). 추가로 공개 webhook(`auth_config_id IS NULL`)에는 `PublicWebhookThrottleGuard` 의 IP 단위 한도(분당 10·시간당 누적 20 기본)가 적용된다 — §6 참조 | 권장 |
| WH-SC-06 | API Key 검증 — AuthConfig.type=`api_key`, 헤더 `config.headerName` (default `X-API-Key`) 의 값 비교 | 필수 |
| WH-SC-07 | Basic Auth 검증 — AuthConfig.type=`basic_auth` (`Authorization: Basic base64(user:pass)`) | 필수 |
| WH-SC-08 | 인증 성공 시 `AuthConfig.last_used_at = NOW()` fire-and-forget UPDATE (트랜잭션 외, 실패 시 미갱신) | 필수 |
| WH-SC-09 | AuthConfig.ip_whitelist 가 설정된 경우 클라이언트 IP allowlist 시행 (불일치 시 401 `AUTH_FAILED`). 각 항목은 단일 IP 또는 CIDR 표기를 허용하며 (IPv4-mapped IPv6 클라이언트는 IPv4 로 정규화 비교), 클라이언트 IP 를 알 수 없으면 거부(fail-closed). ip_whitelist 는 AuthConfig 종속이므로 `auth_config_id IS NOT NULL` 일 때만 평가 | 권장 |

#### 응답 및 피드백

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-RS-01 | 요청 수신 즉시 `202 Accepted` + `executionId` 반환 (비동기 실행) | 필수 |
| WH-RS-02 | 잘못된 경로의 요청은 `404 Not Found` 반환 | 필수 |
| WH-RS-03 | 요청 본문 파싱 실패 시 `400 Bad Request` 반환 | 필수 |
| WH-RS-04 | 트리거에 `interaction.enabled=true` 가 설정되고 `tokenStrategy="per_execution"` 인 경우, 202 응답 body 에 `interaction.token` / `interaction.expiresAt` / `interaction.endpoints` 필드를 동봉한다 — 상세는 [Spec External Interaction API §4.1](./14-external-interaction-api.md#41-webhook-호출-응답-확장) | 필수 |

#### 관리

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-MG-01 | 워크플로우 에디터 또는 트리거 화면에서 webhook 트리거 생성 | 필수 |
| WH-MG-02 | 생성 시 endpoint_path 자동 생성 (랜덤 UUID 기반). 클라이언트가 `crypto.randomUUID()` 로 발급하고 **서버가 생성/수정 DTO 에서 v4 UUID 형식을 강제**(`@IsUUID('4')`)해 예측 가능 경로 직접 지정을 차단한다 (WH-SC-01 비밀성 보강). | 필수 |
| WH-MG-03 | 트리거 목록에서 webhook URL 전체를 클립보드 복사 | 필수 |
| WH-MG-04 | 활성/비활성 토글로 webhook 수신 제어 (사용자 명시 토글 한정 — 시스템 자동 비활성화는 WH-MG-07 / [EIA §R6](./14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지) 참조) | 필수 |
| WH-MG-05 | 호출 이력에서 요청 시각, 상태, 응답 코드 확인 | 필수 |
| WH-MG-06 | 트리거 생성/수정 페이로드의 `notification` (outbound 이벤트 webhook URL + HMAC secret + 구독 이벤트 목록) 및 `interaction` (외부 인터랙션 채널 활성화 + token 전략) 옵션 — 상세는 [Spec External Interaction API §4](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) | 필수 |
| WH-MG-07 | 트리거 상세 화면에 `notificationHealth` 표시 (unknown / healthy / degraded). degraded 상태에서도 트리거 자동 비활성화하지 않음 — [Spec External Interaction API §R6](./14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지) | 권장 |
| WH-MG-08 | 트리거 생성/수정 페이로드의 `chatChannel` 옵션 (외부 chat 플랫폼 어댑터 연결 — Telegram 등) — 상세는 [Spec Chat Channel §4](./15-chat-channel.md#4-데이터-모델). `chatChannel` 미존재 시 일반 webhook 트리거 (기존 동작 그대로) | 필수 |
| WH-MG-09 | 트리거 상세 화면에 `chatChannelHealth` 표시 (unknown / healthy / degraded). `notificationHealth` 배지와 동일 영역·동일 형식으로 나란히 배치. degraded 상태에서도 트리거 자동 비활성화하지 않음 — [Spec Chat Channel §3.4 CCH-SE-01](./15-chat-channel.md#34-신뢰성--보안) | 권장 |

---

### 비기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-NF-01 | webhook 수신 후 200ms 이내 응답 반환 (실행은 비동기) | 필수 |
| WH-NF-02 | 요청 본문 최대 크기 — **분리 임계 (옵션 C, 구현)**: 공개(`auth_config_id IS NULL`) webhook 32KB, 인증 webhook 1MB. 인증 webhook 의 1MB 게이트는 `/api/hooks/*` 라우트 스코프 body-parser limit(`createHooksBodyParsers`, `src/bootstrap/hooks-body-parser.ts`, 기본 1MB·`HOOKS_MAX_BODY_BYTES` env override, 상한 `HOOKS_MAX_BODY_BYTES_CEILING` 16MiB — 과도한 override 로 인한 OOM 방지 클램프)로 구현되며, 초과 시 body-parser 가 `413` 을 throw 하고 `GlobalExceptionFilter` 가 표준 봉투 `PAYLOAD_TOO_LARGE` 로 직렬화한다. `main.ts` 는 `NestFactory.create(AppModule, { bodyParser: false })` 로 Nest 기본 파서를 끄고 hooks(1MB)·전역(`createGlobalBodyParsers`, 100KB) 파서를 직접 등록한다 — Nest 기본 파서를 켠 채 수동 파서를 추가하면 Nest 가 자기 전역 파서 등록을 건너뛰어 non-hooks 본문이 미파싱되는 함정을 회피. hooks 파서를 먼저 등록해 hooks 만 1MB 로 파싱하고(rawBody 보존 — HMAC 호환), **전역 100KB 는 명시 등록해 non-webhook 라우트 방어선을 보존**한다. 공개 webhook 은 그 위에서 `PublicWebhookThrottleGuard` 가 **32KB** (`DEFAULT_MAX_BODY_BYTES`) 초과 시 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` 로 추가 제한. | 필수 |
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

> 위 다이어그램은 **일반 webhook 경로**다. `config.chatChannel` 트리거는 `isActive` 검사보다 `chatChannel` 분기가 **선행**하며 인증을 먼저 수행한다(비활성 시 silent 202) — 상세 순서는 [§7 step 5](#7-처리-흐름) · [WH-EP-07](#webhook-엔드포인트).

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
| 요청 본문 최대 크기 | **분리 임계 (옵션 C, 구현)**: 공개(`auth_config_id IS NULL`) webhook **32KB**(`PublicWebhookThrottleGuard`) / 인증 webhook **1MB**(`/api/hooks/*` 라우트 스코프 body-parser, 초과 시 `413 PAYLOAD_TOO_LARGE`). 상세·근거 [WH-NF-02](#비기능-요구사항) · [§8](#8-보안-고려사항) |

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

> 위 구조는 어댑터가 워크플로우로 넘기는 **입력** 이다. Manual Trigger 핸들러가 이를 노드 `output` 으로 노출하는 shape(특히 webhook 출처의 `output.request.*`)과 다운스트림 expression 접근 경로(`$node["Manual Trigger"].output.request.method` 등)는 [Spec Manual Trigger §5.2](../4-nodes/7-trigger/1-manual-trigger.md#52-case-webhook-어댑터-port-out) 참조.

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

required 파라미터 누락·타입 강제 변환 실패 시 `hooks.service` 가 `BadRequestException` 을 throw 하고, 전역 `GlobalExceptionFilter` 가 이를 프로젝트 공식 에러 봉투(`{ error: { code, message, requestId, details? } }` — [API 규약 §5.3](./2-api-convention.md#53-에러-응답) · [error-handling §2.1](./3-error-handling.md#21-기본-형식))로 직렬화해 응답한다. 두 경우 모두 Execution 레코드는 생성되지 않는다.

```json
{
  "error": {
    "code": "INVALID_WEBHOOK_PAYLOAD",
    "message": "Invalid webhook payload",
    "requestId": "f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b",
    "details": [
      { "field": "orderId", "code": "MISSING_REQUIRED_FIELD", "message": "Required parameter is missing" },
      { "field": "amount",  "code": "TYPE_COERCION_FAILED",   "message": "Value could not be coerced to the declared type" }
    ]
  }
}
```

- **`error.code`**: 도메인 특화 400 override `INVALID_WEBHOOK_PAYLOAD` (API 규약 400 기본 `VALIDATION_ERROR` 대신 — 도메인 override 선례 [error-handling §1.6](./3-error-handling.md#16-eia-rest-외부-표면-에러-코드-도메인-spec-참조)(EIA) · [§1.7](./3-error-handling.md#17-webhook-수신-에러-코드-도메인-spec-참조)(webhook)).
- **`error.details[]`**: 필드별 사유. `field` = 파라미터 이름, `code` = `UPPER_SNAKE_CASE` field code (`MISSING_REQUIRED_FIELD` = required 누락 / `TYPE_COERCION_FAILED` = 선언 타입 coerce 불가). 헬퍼는 `INVALID_SCHEMA`(스키마 구조 위반)도 매핑하나 이는 저장 시점 검증 코드라 **webhook 런타임 경로에서는 발생하지 않는다**(따라서 위 예시에 미포함). 3종 카탈로그 등재 [error-handling §1.7](./3-error-handling.md#17-webhook-수신-에러-코드-도메인-spec-참조), 명명 규약 [error-codes 규약](../conventions/error-codes.md).
- **구현**: `hooks.service` 가 `BadRequestException({ code, message, details })` 를 throw 하고 `GlobalExceptionFilter` 가 `details` 를 그대로 봉투로 전달한다. 내부 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`, [error-codes 규약 §4](../conventions/error-codes.md#4-내부-전용-분류-코드-정규화-후-발행) 패턴)은 `toTriggerParameterErrorDetails` 가 위 public field code (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)로 정규화한다 (Manual 실행 경로 `INVALID_TRIGGER_PARAMETERS` 도 동일 헬퍼 사용 — [manual-trigger §6](../4-nodes/7-trigger/1-manual-trigger.md#6-에러-코드)).

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
- Rate Limiting (공개 webhook 전용 추가): `PublicWebhookThrottleGuard` 가 `auth_config_id IS NULL` 트리거에 한해 IP 단위 시작 한도(기본 분당 10, config `publicWebhook.startupPerMinute`) + 시간당 누적 신규 상한(기본 20, `publicWebhook.hourlyNewMax`) 을 적용. 초과 시 `429 PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` (카탈로그 [error-handling §1.7](./3-error-handling.md#17-webhook-수신-에러-코드-도메인-spec-참조)). 인증 webhook 은 이 Guard 를 무제한 통과(본문 크기는 아래 라우트 스코프 파서가 별도 게이트). Redis 미가용 시 fail-open. (정책 수치 출처: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md); config 키·에러 코드 적용 SoT 는 본 §6 + [error-handling §1.7](./3-error-handling.md#17-webhook-수신-에러-코드-도메인-spec-참조))
- 본문 크기 (WH-NF-02 옵션 C): `/api/hooks/*`(`HOOKS_ROUTE_PREFIX` 상수) 라우트 스코프 body-parser(`createHooksBodyParsers`, `src/bootstrap/hooks-body-parser.ts`)가 인증 webhook 본문을 **1MB**(기본, `HOOKS_MAX_BODY_BYTES` env override, 상한 16MiB)까지 수용하고 초과 시 `413 PAYLOAD_TOO_LARGE`. `main.ts` 는 `bodyParser: false` 로 Nest 기본 파서를 끄고 hooks(1MB)·전역(`createGlobalBodyParsers`, 100KB)을 직접 등록한다. hooks 를 먼저 등록해 1MB 로 파싱하며(`req._body` 가드로 전역 재파싱 skip), rawBody 를 보존해 HMAC 검증과 호환. 전역 100KB 는 명시 등록돼 non-webhook 라우트에 적용. 공개 webhook 의 32KB 는 `PublicWebhookThrottleGuard` 가 그 위에서 추가 제한.
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
   c. update === null 이면 (group chat / 무시 대상) → 202 Accepted + { executionId: 'ignored' } 즉시 반환 (Execution 미생성)
   d. ChannelConversationService.lookup(triggerId, update.conversationKey) → ChannelConversation 조회
   e. 활성 execution 이 있으면 InteractionService.interact() in-process 호출 (token bypass — [EIA §3.3 EIA-AU-08](./14-external-interaction-api.md#33-인증))
      없으면 `ExecutionEngineService.execute(workflowId, input, { triggerId: trigger.id, sourceIp, responseCode: '202' })` 시작 (입력 = parseUpdate 결과 변환). `sourceIp`(extractClientIp)·`responseCode`(202) 는 §A.3 호출 이력에 영속된다 ([config §A.3](../2-navigation/6-config.md), [R-6](../2-navigation/6-config.md#rationale)). schedule/manual 트리거는 두 인자를 생략 → 컬럼 NULL (ExecuteOptions 의 triggerId variant 에서 `sourceIp?`/`responseCode?` 는 optional).
   f. 202 Accepted 즉시 반환 ([WH-NF-01](#비기능-요구사항) 200ms 이내, 후속 처리는 백그라운드). 단 일부 provider handshake/interactivity ack (Slack url_verification·Interactivity, Discord PING·Interactivity, native modal) 은 `200 OK` + 비-래핑 JSON 으로 직접 응답한다 (TransformInterceptor 우회) — 상세 [Spec Chat Channel §5.5·§5.5.1](./15-chat-channel.md#55-inbound-http-contract).
8. config.chatChannel 가 없으면 (기존 경로):
   a. resolveTriggerParameters(workflow, body) 호출
      - required 누락 / coerce 실패 → 400 Bad Request (Execution 생성하지 않음)
   b. ExecutionEngineService.execute(trigger.workflowId, { parameters, body, headers, query, method }, { triggerId: trigger.id, sourceIp, responseCode: '202' })
      - 3번째 인자로 `triggerId`를 전달해야 생성되는 Execution 행의 `trigger_id` 컬럼이 채워지고, 결과적으로 "최근 실행" 화면에서 출처가 `webhook` 으로 분류된다.
      - `sourceIp`(extractClientIp 결과 — 인증 IP whitelist 검증과 공용)·`responseCode`(성공 경로의 실제 HTTP 코드 `202`)도 함께 전달되어 Execution 행의 `source_ip`/`response_code` 컬럼에 영속되고, 인증 설정 사용 내역(§A.3 호출 이력)의 소스 IP·응답 코드 컬럼을 채운다 ([config §A.3](../2-navigation/6-config.md), [R-6](../2-navigation/6-config.md#rationale); [WH-MG-05](#요구사항)). schedule/manual 트리거는 두 인자를 생략하므로 컬럼 NULL — `ExecuteOptions` 의 triggerId variant 에서 `sourceIp?`/`responseCode?` 는 optional 이라 기존 호출자 호환.
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
| 본문 크기 제한 | **분리 임계 (옵션 C, 구현)**: 공개 webhook 32KB 초과 시 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` (`PublicWebhookThrottleGuard`). 인증 webhook 은 `/api/hooks/*` 라우트 스코프 1MB body-parser limit 으로 게이트하고 초과 시 표준 `413 PAYLOAD_TOO_LARGE`. 전역 100KB 기본은 non-webhook 라우트에 보존(라우트 스코프 분리). 공개 진입점은 DoS·abuse 표면이라 32KB 보수 한도 유지 |
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

③의 "POST 전용"은 **트리거 진입 엔드포인트(`/api/hooks/:endpointPath`)에 한정**한다. 그 하위 서브경로는 각 영역 spec 이 별도 메서드·정책으로 정의할 수 있다 — 예: 채널 웹챗의 `GET /api/hooks/:endpointPath/embed-config`(공개·무인증 조회, [7-channel-web-chat 4-security §3-①](../7-channel-web-chat/4-security.md))는 POST 전용 규칙의 예외가 아니라 본 SoT 의 스코프 밖이다.

### WH-NF-02 본문 크기 — 분리 임계(옵션 C) 결정 근거

요청 본문 최대 크기는 공개/인증 webhook 을 **분리 임계**로 둔다 (공개 32KB, 인증 1MB).

- **기각 — 옵션 A (전역 1MB 통일)**: `app.use(json({ limit: '1mb' }))` 로 전역을 1MB 로 올리면 non-webhook 라우트(로그인 등 미인증 표면 포함)까지 1MB 본문을 버퍼링해 DoS 표면을 32배 확대한다. 전역 100KB 기본 방어선을 약화하므로 기각.
- **기각 — 옵션 B (현행 32KB/100KB 박제)**: 인증 webhook 의 "100KB express 기본" 은 설계 결정이 아니라 우연한 프레임워크 기본값이고, 대형 PR/결제 이벤트 등 정당한 인증 페이로드를 막는다. 비표준 `PayloadTooLargeError` 로 끊기는 비일관도 남는다.
- **채택 — 옵션 C (분리 임계)**: 미인증 공개 진입점은 brute-force·DoS 표면이라 32KB 보수 한도 유지, 신원 검증된 인증 webhook 만 `/api/hooks/*` 라우트 스코프 1MB body-parser 로 확대. 위험도에 비례한 한도.
- **구현 결정 — `bodyParser: false` + 명시 등록 순서 의존성**: Nest 기본 파서를 켠 채 `app.use(json())` 같은 수동 파서를 추가하면 Nest 가 자기 전역 파서 등록을 건너뛰어 non-hooks 본문이 미파싱(`req.body=undefined`)되는 함정이 있다. 따라서 `bodyParser: false` 로 끄고 hooks(1MB, 먼저)·전역(100KB) 파서를 직접 등록한다. hooks 가 먼저 파싱해 `req._body` 를 세팅하면 후행 전역 파서가 hooks 를 재파싱하지 않는다(body-parser idempotency 가드). rawBody 는 두 파서 공통 `verify` 로 보존해 HMAC 호환.
- **OOM 상한 클램프**: `HOOKS_MAX_BODY_BYTES` env override 는 `HOOKS_MAX_BODY_BYTES_CEILING`(16MiB)으로 클램프해 운영 실수로 인한 메모리 표면 확대를 막는다.
- **표준 413**: 초과 시 body-parser 의 413 을 `GlobalExceptionFilter` 가 표준 봉투 `PAYLOAD_TOO_LARGE` 로 직렬화([API 규약 §5.3·§6](./2-api-convention.md#6-http-상태-코드), [error-handling §1.3](./3-error-handling.md#13-유효성-검증-에러)).

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

### endpointPath 가변성 — webhook 은 mutable, schedule 만 frozen

Webhook 트리거의 `endpointPath` 는 **의도적으로 변경 가능(mutable)** 하다. URL 이 노출됐을 때 회전하거나 정리 목적으로 경로를 바꾸는 것은 정당한 운영 동작이다. 구현상:

- `UpdateTriggerDto` 가 `endpointPath` 를 받고 (§3.2 / `dto/update-trigger.dto.ts`), `TriggersService.update()` 는 webhook 트리거에 대해 이를 그대로 반영한다.
- 프론트(`codebase/frontend/src/components/triggers/cards/webhook-config-card.tsx`)는 `endpointPath` 편집 필드와 confirm 경고(`triggers.detail.endpointPathChangeWarning` — "변경 시 기존 URL 은 404")를 제공한다.
- 변경된 값은 여전히 비밀 키 역할을 하므로(WH-SC-01) UUID 수준의 고엔트로피 값을 유지해 squatting·enumeration 을 막는 것을 전제로 한다.

변경을 **거부하는 것은 schedule 타입 트리거에 한해서**다. `TriggersService.update()` 의 `disallowed` 거부 블록(`endpointPath` / `authConfigId` / `config` / `notification` / `interaction` / `chatChannel`)은 전적으로 `if (trigger.type === 'schedule')` 가드 **안에** 있다. schedule 은 cron·timezone 등 스케줄 메타를 별도 `Schedule` row + BullMQ job scheduler 와 동기화해야 하므로([데이터 모델 §2.9.1](../1-data-model.md#291-trigger--schedule-동기화-규칙)) 진입 경로(`endpointPath`)·인증·config 를 트리거 PATCH 로 흔들지 못하게 막고, 메타 편집은 Schedule 화면으로 일원화한다.

따라서 "`UpdateTriggerDto` 가 `endpointPath` 를 받지만 service 가 거부한다 → leaky abstraction" 은 **오판**이다. service 는 webhook 트리거에 대해서는 `endpointPath` 변경을 받아들이며, 거부는 schedule 타입에 국한된다. `UpdateTriggerDto` 는 트리거 3종(Manual/Webhook/Schedule)이 공유하는 단일 DTO 이므로 편집 가능 필드의 합집합을 노출하는 것이 정상이고, 타입별 allow/deny 는 service 계층이 책임지는 의도된 설계다 (PR #738 W3 + carryover review 가 반복 오탐한 지점).
