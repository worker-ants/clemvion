# Spec: Webhook 트리거 시스템

> 관련 문서: [PRD Webhook](./12-webhook.md) · [Spec 트리거 목록](../2-navigation/2-trigger-list.md) · [Spec 데이터 모델](../1-data-model.md#28-trigger) · [Spec 실행 엔진](./4-execution-engine.md) · [Spec External Interaction API](./14-external-interaction-api.md) · [Spec Chat Channel](./15-chat-channel.md)

---

## Overview (제품 정의)

> 출처: `prd/8-webhook.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.

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
| WH-EP-02 | URL 형식: `{base_url}/api/hooks/{endpoint_path}` | 필수 |
| WH-EP-03 | HTTP POST 메서드 지원 | 필수 |
| WH-EP-04 | JSON, form-urlencoded 요청 본문 수신 | 필수 |
| WH-EP-05 | 요청 본문 전체를 워크플로우 입력 데이터로 전달 (`body`) | 필수 |
| WH-EP-05-1 | Manual Trigger 노드가 선언한 `parameters` 스키마에 따라 body에서 파라미터를 추출/검증하여 `$input.parameters` / `$params`로 제공 | 필수 |
| WH-EP-05-2 | required 파라미터 누락 또는 타입 강제 변환 실패 시 `400 Bad Request`와 누락 필드 목록 반환 | 필수 |
| WH-EP-06 | 요청 헤더 정보를 메타데이터로 전달 (`headers`, `method`, `query`) | 권장 |
| WH-EP-07 | 비활성 트리거로의 요청은 `410 Gone` 응답 반환. **예외**: `config.chatChannel` 이 설정된 트리거는 `202 Accepted + { ignored: true }` 반환 (Telegram 등 chat-channel provider 가 non-2xx 응답 시 webhook 자동 비활성화·retry 폭주를 유발하므로). 상세 — [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract) | 필수 |

#### 3.2 인증 및 보안

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-SC-01 | 인증 없음(공개) 옵션 | 필수 |
| WH-SC-02 | HMAC 서명 검증 (Secret 기반) | 필수 |
| WH-SC-03 | Bearer Token 검증 | 필수 |
| WH-SC-04 | 인증 실패 시 `401 Unauthorized` 응답 | 필수 |
| WH-SC-05 | Rate limiting (트리거당 분당 최대 요청 수) | 권장 |

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
| WH-MG-04 | 활성/비활성 토글로 webhook 수신 제어 (사용자 명시 토글 한정 — 시스템 자동 비활성화는 WH-MG-07 / [EIA §R6](./14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지-2026-05-21) 참조) | 필수 |
| WH-MG-05 | 호출 이력에서 요청 시각, 상태, 응답 코드 확인 | 필수 |
| WH-MG-06 | 트리거 생성/수정 페이로드의 `notification` (outbound 이벤트 webhook URL + HMAC secret + 구독 이벤트 목록) 및 `interaction` (외부 인터랙션 채널 활성화 + token 전략) 옵션 — 상세는 [Spec External Interaction API §4](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) | 필수 |
| WH-MG-07 | 트리거 상세 화면에 `notificationHealth` 표시 (unknown / healthy / degraded). degraded 상태에서도 트리거 자동 비활성화하지 않음 — [Spec External Interaction API §R6](./14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지-2026-05-21) | 권장 |
| WH-MG-08 | 트리거 생성/수정 페이로드의 `chatChannel` 옵션 (외부 chat 플랫폼 어댑터 연결 — Telegram 등) — 상세는 [Spec Chat Channel §4](./15-chat-channel.md#4-데이터-모델). `chatChannel` 미존재 시 일반 webhook 트리거 (기존 동작 그대로) | 필수 |
| WH-MG-09 | 트리거 상세 화면에 `chatChannelHealth` 표시 (unknown / healthy / degraded). `notificationHealth` 배지와 동일 영역·동일 형식으로 나란히 배치. degraded 상태에서도 트리거 자동 비활성화하지 않음 — [Spec Chat Channel §3.4 CCH-SE-01](./15-chat-channel.md#34-신뢰성--보안) | 권장 |

---

### 4. 비기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| WH-NF-01 | webhook 수신 후 200ms 이내 응답 반환 (실행은 비동기) | 필수 |
| WH-NF-02 | 요청 본문 최대 크기: 1MB | 필수 |
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
| `authConfigId` | 인증 설정 연결 (nullable) |
| `config` | 추가 설정 (JSONB) |
| `workflowId` | 실행할 워크플로우 |
| `lastTriggeredAt` | 마지막 호출 시각 |

### 2.2 config 필드 구조

```json
{
  "authType": "none" | "hmac" | "bearer",
  "secret": "hmac-secret-key",
  "bearerToken": "expected-token",
  "hmacHeader": "X-Hub-Signature-256",
  "hmacAlgorithm": "sha256",

  "notification": { /* External Interaction API 의 outbound 설정. [Spec EIA §4·§7.1](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) */ },
  "interaction":  { /* External Interaction API 의 inbound 설정. [Spec EIA §4·§7.1](./14-external-interaction-api.md#4-trigger-등록-페이로드-확장) */ },
  "chatChannel":  { /* Chat Channel adapter 설정 (Telegram 등). [Spec Chat Channel §4.1](./15-chat-channel.md#41-triggerconfigchatchannel) */ }
}
```

`notification` / `interaction` / `chatChannel` 은 누락 가능. 누락 시 해당 외부 인터랙션 채널 / chat 채널 어댑터가 비활성으로 간주된다 (기존 동작과 호환). 별 컬럼이 필요한 health/secret rotation 추적 필드는 [Spec EIA §7.1](./14-external-interaction-api.md#71-trigger-엔티티-확장) 와 [Spec Chat Channel §4.2](./15-chat-channel.md#42-trigger-테이블-신규-컬럼) 에 정의.

---

## 3. API 명세

### 3.1 Webhook 수신 엔드포인트

```
POST /api/hooks/:endpointPath
```

| 항목 | 설명 |
|------|------|
| 인증 | 트리거의 authType에 따라 다름 (공개/HMAC/Bearer) |
| Content-Type | `application/json`, `application/x-www-form-urlencoded` |
| 요청 본문 최대 크기 | 1MB |

**성공 응답** (`202 Accepted`):
```json
{
  "executionId": "uuid",
  "message": "Webhook received, workflow execution started"
}
```

트리거에 `interaction.enabled=true` + `tokenStrategy="per_execution"` 가 설정되면 위 응답에 추가로 `status: "pending"` 과 `interaction: { token, expiresAt, endpoints }` 가 동봉된다. 상세는 [Spec External Interaction API §4.1](./14-external-interaction-api.md#41-webhook-호출-응답-확장).

**에러 응답**:

| 상태 | 조건 |
|------|------|
| `400 Bad Request` | 요청 본문 파싱 실패 |
| `401 Unauthorized` | 인증 검증 실패 |
| `404 Not Found` | endpointPath에 해당하는 트리거 없음 |
| `410 Gone` | 트리거가 비활성 상태 (단, `config.chatChannel` 트리거는 [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract) 적용 — 비활성도 `202 Accepted + { ignored: true }`) |

### 3.2 기존 Trigger CRUD API

기존 `/api/triggers` 엔드포인트를 그대로 사용. 변경 없음.

---

## 4. 인증 방식

### 4.1 None (공개)

인증 없이 누구나 호출 가능. `endpointPath`의 UUID가 사실상 비밀 키 역할.

### 4.2 HMAC 서명

```
요청 헤더:  X-Hub-Signature-256: sha256=<hex-digest>
검증 방식:  HMAC-<algorithm>(secret, rawBody) === 헤더 값
```

GitHub Webhook과 동일한 방식.

- **알고리즘 허용 목록**: `sha256`, `sha512` 만 허용. 다른 값 (`md5`, `sha1` 등) 은 인증 실패로 처리된다. 거부 응답은 다른 인증 실패와 동일한 메시지(`AUTH_FAILED` / "Authentication failed") 만 반환하며, 알고리즘 명을 클라이언트로 반사하지 않는다 (information leakage 차단). 진단은 서버 로그에만 남는다.
- **rawBody 요구**: HMAC 검증은 파싱 전 원본 바이트가 필요하다. NestJS 부트스트랩에서 `rawBody: true` 활성화가 필수다 ([§구현 §11.3 — main.ts](#)).

### 4.3 Bearer Token

```
요청 헤더:  Authorization: Bearer <token>
검증 방식:  token === config.bearerToken
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
  ├── hooks.module.ts          # 모듈 정의
  ├── hooks.controller.ts      # POST /api/hooks/:endpointPath
  └── hooks.service.ts         # 트리거 조회, 인증 검증, 실행 트리거
```

- `/api/hooks/*` 경로는 JWT 인증 제외 (외부 서비스가 호출하므로)
- Rate Limiting 적용: 트리거당 60req/min
- 기존 `TriggersService.findByEndpointPath()` 재사용

---

## 7. 처리 흐름

```
1. POST /api/hooks/abc-123-def 수신
2. HooksService.handleWebhook('abc-123-def', body, headers, query)
3. TriggersService.findByEndpointPath('abc-123-def') → Trigger 엔티티
4. Trigger 없으면 → 404 Not Found
5. Trigger.isActive === false → `config.chatChannel` 가 있으면 step 6 (인증) → step 7c 의 silent skip 분기로 진입 (parseUpdate 호출 전에 isActive 미통과를 인지하고 update 무시, 응답은 202 + { ignored: true }). `config.chatChannel` 가 없으면 → 410 Gone 즉시 반환. (chatChannel 트리거의 비활성 상태에서도 인증은 그대로 수행 — auth 실패 시 401 반환. 정당화: (a) 보안 — auth 실패한 요청에 silent 202 를 주면 공격자가 trigger 활성 여부를 inference 할 수 없도록 함, (b) 운영 — auth 실패는 운영자 디버깅 가시성 401 필요. 상세 [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract) 참조.)
6. 인증 검증:
   a. config.authType === 'none' → 통과
   b. config.authType === 'hmac' → HMAC 서명 검증
   c. config.authType === 'bearer' → Bearer 토큰 검증
   d. 실패 → 401 Unauthorized
7. config.chatChannel 가 있으면 (Chat Channel 분기):
   a. adapter = ChannelAdapterRegistry.get(config.chatChannel.provider)
   b. update = await adapter.parseUpdate(rawBody, config.chatChannel)   // 50ms 이내 (CCH-NF-01)
   c. update === null 이면 (group chat / 무시 대상) → 202 Accepted + { ignored: true } 즉시 반환 (Execution 미생성)
   d. ChannelConversationService.lookup(triggerId, update.conversationKey) → ChannelConversation 조회
   e. 활성 execution 이 있으면 InteractionService.interact() in-process 호출 (token bypass — [EIA §3.3 EIA-AU-08](./14-external-interaction-api.md#33-인증))
      없으면 ExecutionEngineService.execute() 시작 (입력 = parseUpdate 결과 변환)
   f. 202 Accepted 즉시 반환 ([WH-NF-01](#4-비기능-요구사항) 200ms 이내, 후속 처리는 백그라운드)
8. config.chatChannel 가 없으면 (기존 경로):
   a. resolveTriggerParameters(workflow, body) 호출
      - required 누락 / coerce 실패 → 400 Bad Request (Execution 생성하지 않음)
   b. ExecutionEngineService.execute(trigger.workflowId, { parameters, body, headers, query, method }, { triggerId: trigger.id })
      - 3번째 인자로 `triggerId`를 전달해야 생성되는 Execution 행의 `trigger_id` 컬럼이 채워지고, 결과적으로 "최근 실행" 화면에서 출처가 `webhook` 으로 분류된다.
9. Trigger.lastTriggeredAt = now → DB 업데이트
10. 202 Accepted + { executionId } 반환

> Chat Channel 분기의 outbound 응답 (사용자에게 메시지 발송) 은 본 webhook 수신 흐름 안에서 발생하지 않는다.
> [Spec Chat Channel §3.1](./15-chat-channel.md#31-전체-시퀀스-telegram-예시) 의 NotificationDispatcher EventEmitter 경로로 비동기 처리된다.
```

---

## 8. 보안 고려사항

| 항목 | 대책 |
|------|------|
| 엔드포인트 유추 방지 | UUID 기반 랜덤 경로 (brute force 불가) |
| 비밀 키 저장 | `config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용) |
| 본문 크기 제한 | 1MB 초과 시 `413 Payload Too Large` |
| Rate Limiting | Throttler 적용 (60req/min/trigger) |
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

### 외부 인터랙션 채널을 별도 spec 파일로 분리 (2026-05-21)

본 spec 은 "트리거 진입점" (외부 → workflow 시작) 의 책임에 한정한다. 트리거가 실행시킨 workflow 가 도중에 `waiting_for_input` 으로 멈추거나 종료될 때 외부 시스템과 turn 을 주고받는 채널은 [Spec External Interaction API](./14-external-interaction-api.md) 가 단일 진실로 다룬다. 본 문서는 그쪽 spec 에 cross-link 만 둔다.

검토한 대안 (12-webhook 본문에 모두 흡수) 의 기각 사유와 위치 결정 근거는 [Spec EIA §R9](./14-external-interaction-api.md#r9-spec-위치--5-system-하위-신규-파일-2026-05-21) 참조.

### Chat Channel 어댑터 — 별도 spec 으로 분리 (2026-05-21)

Webhook 트리거의 `config.chatChannel` 한 갈래로 동작하지만 어댑터 설계·provider 별 구체 정의가 분리되는 별 layer 이므로 [Spec Chat Channel](./15-chat-channel.md) 로 단일 진실 분리. 본 spec 은 `chatChannel` config 의 위치 (§2.2) + WH-MG-08/09 의 관리 요구사항 + §7 처리 흐름의 분기만 정의하고, 어댑터 인터페이스·provider 별 구체·EIA 와의 관계는 모두 Chat Channel spec 에 위임. 트리거 유형 카탈로그 (Manual / Webhook / Schedule 3종) 는 그대로 유지된다.
