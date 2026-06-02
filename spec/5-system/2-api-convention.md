---
id: api-convention
status: implemented
code:
  - codebase/backend/src/common/filters/http-exception.filter.ts
  - codebase/backend/src/common/pipes/validation.pipe.ts
  - codebase/backend/src/common/dto/*.ts
  - codebase/backend/src/common/swagger/error-response.dto.ts
---

# Spec: API 설계 규칙

> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md)

---

## 1. 기본 원칙

| 항목 | 규칙 |
|------|------|
| 프로토콜 | HTTPS (TLS 1.2+) |
| 스타일 | RESTful |
| 형식 | JSON (Content-Type: application/json) |
| 인코딩 | UTF-8 |
| 인증 | Bearer Token (Authorization: Bearer {access_token}) |
| 버전 | URL 경로에 포함하지 않음 (Accept 헤더 또는 단일 버전 운영) |

---

## 2. URL 구조

### 2.1 기본 패턴

```
{base_url}/api/{resource}
{base_url}/api/{resource}/{id}
{base_url}/api/{resource}/{id}/{sub-resource}
```

### 2.2 명명 규칙

| 규칙 | 예시 |
|------|------|
| 리소스는 복수형 명사 | `/api/workflows`, `/api/triggers` |
| 케밥 케이스 | `/api/knowledge-bases`, `/api/auth-configs` |
| 중첩은 2단계까지 | `/api/knowledge-bases/:id/documents` |
| 3단계 이상은 최상위로 분리 | `/api/documents/:docId` (필요 시) |
| **예외 — RPC-style sub-channel action**: `/api/{resource}/{id}/{channel}/{action}` 형태의 동작 호출은 허용 (e.g. `/api/triggers/:id/notification/rotate-secret`, `/api/triggers/:id/interaction/revoke-token`, `/api/triggers/:id/chat-channel/rotate-bot-token`). 자원 자체가 아닌 sub-channel 의 부작용 동작 (`rotate-*`, `revoke-*`, `disable-*` 등) 이며 URL 만으로 자원·채널·동작을 식별 가능해야 하기 때문 | (좌측 예시 참조) |

### 2.3 워크스페이스 스코핑

모든 리소스 API는 현재 워크스페이스 컨텍스트에서 동작한다.
워크스페이스 ID는 JWT에서 추출하거나 헤더로 전달.

```
X-Workspace-Id: {workspace-uuid}
```

#### 시스템 전역 API 예외

일부 관측성 API 는 워크스페이스 경계가 없는 **시스템 전역 집계**를 반환한다. 이 카테고리는 `X-Workspace-Id` 를 받더라도 무시하며, 개별 워크스페이스·유저를 식별할 수 있는 데이터(레코드 id·payload 등)를 노출하지 않는다.

| 전역 API | 설명 |
|----------|------|
| `GET /api/system-status/overview` | 전체 BullMQ 큐의 집계 카운트·health. 상세 [16-system-status-api.md](./16-system-status-api.md) |

---

## 3. HTTP 메서드

| 메서드 | 용도 | 멱등성 |
|--------|------|--------|
| GET | 리소스 조회 (목록/상세) | O |
| POST | 리소스 생성, 액션 실행 | X |
| PATCH | 리소스 부분 수정 | O |
| DELETE | 리소스 삭제 | O |
| PUT | 사용하지 않음 (PATCH 선호) | — |

---

## 4. 요청 형식

### 4.1 목록 조회 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| page | Integer | 페이지 번호 (1부터) | 1 |
| limit | Integer | 페이지 크기 (최대 100) | 20 |
| sort | String | 정렬 필드 (예: `created_at`) | `created_at` |
| order | `asc` / `desc` | 정렬 방향 | `desc` |
| search | String | 검색 키워드 | — |

### 4.2 필터 파라미터

리소스별로 추가 필터 파라미터 정의. 예:
```
GET /api/workflows?status=active&tag=marketing
GET /api/triggers?type=webhook&status=active
```

---

## 5. 응답 형식

### 5.1 단일 리소스

```json
{
  "data": {
    "id": "uuid",
    "name": "My Workflow",
    "...": "..."
  }
}
```

### 5.2 목록 응답

```json
{
  "data": [
    { "id": "uuid-1", "...": "..." },
    { "id": "uuid-2", "...": "..." }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3
  }
}
```

### 5.3 에러 응답

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow name is required",
    "details": [
      {
        "field": "name",
        "message": "This field is required"
      }
    ]
  }
}
```

---

## 6. HTTP 상태 코드

| 코드 | 의미 | 사용 상황 |
|------|------|-----------|
| 200 | OK | 조회, 수정 성공 |
| 201 | Created | 생성 성공 |
| 204 | No Content | 삭제 성공 |
| 400 | Bad Request | 잘못된 요청 (유효성 검증 실패) |
| 401 | Unauthorized | 인증 필요 또는 토큰 만료 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 리소스 충돌 (중복 생성 등) |
| 422 | Unprocessable Entity | 비즈니스 로직 오류 |
| 429 | Too Many Requests | Rate Limit 초과 |
| 500 | Internal Server Error | 서버 오류 |

---

## 7. Rate Limiting

| 범위 | 제한 | 헤더 |
|------|------|------|
| 일반 API | 100 req/min (사용자 기준) | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| 인증 API | 10 req/min (IP 기준) | 동일 |
| Webhook 수신 | 100 req/min (글로벌 throttler `default`) | 동일 |
| 파일 업로드 | 10 req/min (사용자 기준) | 동일 |

Rate Limit 초과 시 `429` 응답 + `Retry-After` 헤더.

> **`NODE_ENV=test` 환경 한정 skip**: e2e 가 단일 컨테이너 IP 에서 빠른 인증 호출을 직렬로 폭주시켜 자체 throttle 한계 (100/60s) 에 막히는 자기충돌을 피하기 위해, test 환경에서는 `ThrottlerModule` 의 `skipIf` 가 전역적으로 throttle 을 우회한다. production / development 동작은 무변경 — 위 표의 제한이 그대로 강제된다. helper: `codebase/backend/src/common/utils/throttler-skip.ts`.

---

## 8. 페이지네이션

### 8.1 Offset 기반 (기본)

```
GET /api/workflows?page=2&limit=20
```

### 8.2 Cursor 기반 (실행 이력 등 대량 데이터)

```
GET /api/executions?cursor=eyJ...&limit=20
```

```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJ...",
    "hasNext": true,
    "limit": 20
  }
}
```

---

## 9. 파일 업로드

| 항목 | 규칙 |
|------|------|
| 형식 | `multipart/form-data` |
| 최대 크기 | 단일 파일 50MB |
| 허용 타입 | 엔드포인트별 제한 (Knowledge Base: txt/md/pdf/csv, Avatar: jpg/png) |
| 응답 | 업로드된 파일 메타데이터 (id, url, size 등) |

---

## 10. WebSocket

### 10.1 연결

```
ws(s)://{base_url}/ws?token={access_token}
```

### 10.2 메시지 형식

```json
{
  "type": "event_name",
  "payload": { "...": "..." }
}
```

### 10.3 용도

| 용도 | 방향 | 이벤트 |
|------|------|--------|
| 워크플로우 실행 상태 | Server → Client | execution.*, node.* |
| 실행 제어 | Client → Server | execution.start/stop/continue |
| KB 문서 상태 (임베딩·그래프 추출) | Server → Client | document:embedding_*, document:graph_* (채널 `kb:{documentId}`) |

### 10.4 재연결

- 연결 끊김 시 지수 백오프로 재연결 (1s, 2s, 4s, ... 최대 30s)
- 재연결 시 마지막 수신 이벤트 ID 전달 → 놓친 이벤트 재전송

> **상세 프로토콜:** 채널 구독, 인증, heartbeat, 메시지 스키마 등은 [WebSocket 프로토콜 상세](./6-websocket-protocol.md) 참조.

---

## 11. Webhook 수신 엔드포인트

외부 시스템에서 워크플로우를 트리거하기 위해 호출하는 Webhook 수신 엔드포인트를 정의한다.

> **단일 진실**: Webhook 수신 엔드포인트의 상세 명세(URL·인증·입력 데이터·에러)는 [Spec Webhook](./12-webhook.md) 가 SoT 다. 본 절은 일반 API 규약 관점의 요점만 정리하고 상세는 위임한다.

### 11.1 URL 구조

```
POST {base_url}/api/hooks/{endpoint_path}
```

- `base_url`: SaaS → 서비스 도메인 (예: `https://api.example.com`), 셀프 호스팅 → 설정된 도메인. 프론트엔드 base 결정 규약은 [Spec Webhook WH-EP-02](./12-webhook.md#31-webhook-엔드포인트).
- `endpoint_path`: Trigger 엔티티의 `endpoint_path` 값 (생성 시 UUID 자동 발급, 라우팅 식별자)
- 예시: `POST https://api.example.com/api/hooks/order-created`

### 11.2 지원 메서드

| 메서드 | 지원 | 설명 |
|--------|------|------|
| POST | ✓ | 표준 webhook 수신 (유일 지원 메서드) |

POST 외 메서드는 `405 Method Not Allowed`. (GET/PUT 은 v1 미지원 — [Spec Webhook WH-EP-03](./12-webhook.md#31-webhook-엔드포인트).)

### 11.3 요청 처리 플로우

```
1. URL에서 endpoint_path 추출 → Trigger 조회 (없으면 404, 비활성 410 Gone)
2. 인증 검증 (Trigger.auth_config_id 가 가리키는 AuthConfig 기준. 없으면 공개 수신, 실패 401)
3. 페이로드 파싱 (application/json / application/x-www-form-urlencoded)
4. Execution 생성 + 실행 엔진 큐 적재
5. 즉시 202 응답 반환 (비동기 실행)
```

> 상세 처리 흐름·인증 분기·파라미터 추출은 [Spec Webhook §7](./12-webhook.md#7-처리-흐름) 참조.

### 11.4 응답 형식

비동기 단일 모드. 실행 큐 적재 후 즉시 `202 Accepted` 반환 (동기 `?wait=true` 모드는 미지원). 모든 응답은 전역 `TransformInterceptor` 가 `{ data: ... }` 로 래핑한다 (§5 참조).

```json
{
  "data": {
    "executionId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Webhook received, workflow execution started"
  }
}
```

> `interaction.enabled=true` 트리거의 응답 확장 필드는 [Spec Webhook §3.1](./12-webhook.md#31-webhook-수신-엔드포인트) / [Spec External Interaction API §4.1](./14-external-interaction-api.md#41-webhook-호출-응답-확장).

### 11.5 인증 방식

Webhook 트리거에 `AuthConfig` 를 연결해 인증한다 (none / api_key / bearer_token / basic_auth / hmac). 헤더·기본값·검증 방식의 SoT 는 [Spec Webhook §4](./12-webhook.md#4-인증-방식) — 예: HMAC 은 `AuthConfig.config.header`(기본 `X-Hub-Signature-256`), API Key 는 `AuthConfig.config.headerName`(기본 `X-API-Key`) **헤더** 검증.

### 11.6 워크플로우 실행 입력 데이터

Webhook 수신 데이터의 워크플로우 입력 구조(`parameters` / `body` / `headers` / `query` / `method`)는 [Spec Webhook §5](./12-webhook.md#5-워크플로우-입력-데이터-구조) 가 SoT.

### 11.7 Rate Limiting

Webhook 수신은 글로벌 throttler **100 req/min** 제한 (§7 참조). 초과 시 `429 Too Many Requests`.

---

## 12. 공통 API 패턴

### 12.1 상태 토글 패턴

리소스의 상태 필드를 토글(활성/비활성 등)할 때는 전용 엔드포인트를 만들지 않고, **PATCH 본문에 변경할 필드를 포함**하는 방식을 사용한다.

```
PATCH /api/{resource}/{id}
Content-Type: application/json

{ "is_active": false }
```

| 규칙 | 설명 |
|------|------|
| 패턴 | `PATCH /:id { field: value }` |
| 전용 endpoint 불필요 | `POST /:id/activate`, `POST /:id/deactivate` 등의 전용 엔드포인트를 만들지 않음 |
| 적용 대상 | `is_active` (Workflow, Trigger, Schedule), `is_disabled` (Node), `is_read` (Notification) 등 Boolean 토글 필드 |

### 12.2 유니크 제약 범위

| 필드 | 유니크 범위 | 설명 |
|------|------------|------|
| `Trigger.endpoint_path` | 워크스페이스 단위 | 동일 워크스페이스 내에서 중복 불가. 다른 워크스페이스와는 독립 |

> 인덱스 정의: [데이터 모델 §3](../1-data-model.md#3-인덱스-전략) 참조

---

## Rationale

### §11 Webhook 절을 12-webhook.md 로 위임·정합화

`§11` 은 webhook 도메인 SoT([Spec Webhook](./12-webhook.md))와 중복 기술돼 drift 가 누적됐다. 코드(`hooks.controller.ts` / `hooks.service.ts` / `app.module.ts` ThrottlerModule)를 ground truth 로 삼아 정합화하고, 상세는 12-webhook 으로 위임했다. 정정 내역:

- URL `{base_url}/hooks/` → `{base_url}/api/hooks/` (코드: `@Controller('hooks')` + global prefix `api`). "`/hooks/*` 는 `/api/*` 와 분리" note 는 사실과 반대여서 삭제.
- 메서드: GET/PUT 행 삭제 — 코드는 `@Post(':endpointPath')` 단일 (POST 전용).
- 동기 `?wait=true` 모드 삭제 — 코드에 wait 파라미터·동기 경로 없음 (구 설계 잔재).
- 응답 shape: `{ data: { executionId, message } }` 로 정정 — 전역 `TransformInterceptor` 가 `{data}` 래핑. 구 표기의 `status`/`triggeredAt` 필드는 실제 반환에 없음.
- HMAC 헤더 `X-Webhook-Signature` 고정 → `AuthConfig.config.header`(기본 `X-Hub-Signature-256`), API Key `?api_key=` 쿼리 옵션 삭제(헤더 전용) — 12-webhook §4 로 위임.
- 입력 데이터 `path` 필드 삭제 — 12-webhook §5 입력 구조에 없음.
- Content-Type `text/plain` 삭제 — 코드는 json/form parameter 추출만.
- Rate limit `1000 req/min(워크스페이스)` → `100 req/min(글로벌 throttler default)` — §7 표 포함.
