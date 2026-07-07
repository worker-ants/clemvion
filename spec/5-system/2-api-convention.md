---
id: api-convention
status: implemented
code:
  - codebase/backend/src/common/filters/http-exception.filter.ts
  - codebase/backend/src/common/pipes/validation.pipe.ts
  - codebase/backend/src/common/dto/*.ts
  - codebase/backend/src/common/swagger/error-response.dto.ts
  - codebase/backend/src/common/interceptors/transform.interceptor.ts
  - codebase/backend/src/common/guards/user-throttler.guard.ts
  - codebase/backend/src/common/utils/throttler-skip.ts
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
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

모든 리소스 API는 현재 워크스페이스 컨텍스트에서 동작한다. 활성 워크스페이스는 access token 의 **`activeWorkspaceId` 클레임**으로 확정되며(`jwt.strategy` 가 멤버십 검증 후 `request.user.workspaceId` 로 채택), 전환은 토큰 재발급(`POST /api/auth/workspaces/:id/switch`)으로 이뤄진다. **전환기 하위호환 — header-first**: `X-Workspace-Id` 헤더가 있으면 `WorkspaceId` 데코레이터·`RolesGuard` 가 그 워크스페이스를 우선 사용하고, 헤더가 없으면 토큰 클레임을 사용한다. 클라이언트가 헤더를 떼면 토큰 클레임이 단일 진실이 된다. 결정 우선순위·전환 플로우·마이그레이션의 SoT 는 [`data-flow/12-workspace.md §1.5`](../data-flow/12-workspace.md).

> **상태(2026-07-07, 구현 완료)**: 위 모델은 구현됐다 (`spec-sync-data-flow-12-workspace-gaps` 결정1·2). `jwt.strategy` 가 토큰 클레임(dual-read `activeWorkspaceId ?? workspaceId`)의 멤버십을 검증해 활성값을 확정하고, 데코레이터·`RolesGuard` 는 header-first 로 헤더를 우선한다(전환기 하위호환).

```
# 전환기: X-Workspace-Id 헤더가 있으면 header-first 로 우선
X-Workspace-Id: {workspace-uuid}

# 헤더가 없으면 토큰 클레임(activeWorkspaceId)이 활성 워크스페이스
Authorization: Bearer {access-token}   # payload.activeWorkspaceId
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

> `data`(배열)·`pagination` 이 **top-level 형제**다(중첩 아님). 목록 핸들러는 공용 `PaginatedResponseDto`(`{ data, pagination }`)를 반환하고, 이미 `data` 키를 가진 객체는 전역 `TransformInterceptor` 가 추가 래핑 없이 pass-through 하기 때문 — §5.1 단일 리소스의 `{ data: <obj> }` 와 달리 `data` 가 한 겹 더 감싸이지 않는다. 메커니즘 상세: [Swagger 규약 §2-5 응답 wrapping](../conventions/swagger.md#2-5-응답-wrapping).

> **비-페이징 고정 컬렉션** — 페이지네이션이 무의미한 소규모·본인 소유 목록(활성 세션 목록, WebAuthn credential 목록)은 `pagination` 없이 단일 `items` 배열을 `data` 아래 중첩해 `{ "data": { "items": [ ... ] } }` 형태로 반환한다. 핸들러가 `{ data: { items } }` 를 직접 반환하면 이미 top-level `data` 키를 가지므로 `TransformInterceptor` 가 추가 래핑 없이 pass-through 한다(위 페이징 목록과 동일한 `'data' in data` pass-through 경로 — [Swagger 규약 §2-5](../conventions/swagger.md#2-5-응답-wrapping)). 이는 위 페이징 목록(`data` 가 배열 그 자체 + `pagination` 형제)과 형태가 다르며, [Swagger 규약 §6](../conventions/swagger.md#6-레거시-패턴-제거) 이 "버그"로 지목하는 `{ data: { items, totalItems, page, limit } }`(페이지네이션 메타를 `items` 옆에 뒤섞은 오용)와도 다르다 — 본 컬렉션은 애초에 `pagination` 필드 자체가 없다. 결정 근거는 [Rationale](#비-페이징-고정-컬렉션은-dataitems-유지-52-페이징과-형태-상이).

### 5.3 에러 응답

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Workflow name is required",
    "requestId": "f3b6d2e0-9d4a-4b77-9d19-7a0f8f4c1e2b",
    "details": [
      {
        "field": "name",
        "message": "This field is required",
        "code": "INVALID_FIELD"
      }
    ]
  }
}
```

- `message`: 사람이 읽을 짧은 설명. **내부 구현 원문(라이브러리 예외 메시지·스택·파일 경로 등)을 echo 하지 않는다 — 정보 노출(CWE-209) 방지.** body-parser 등 http-error 4xx 는 상태 기반 고정 문구로 직렬화하고(413 → `"Request payload too large."`, 그 외 4xx → `"The request could not be processed."`), 5xx 는 generic 500 으로 마스킹하며 원문은 서버 로그에만 남긴다. 세부 정책: [error-handling §1.3](./3-error-handling.md#13-유효성-검증-에러).
- `requestId`: 모든 에러 응답에 항상 포함되는 추적용 UUID (서버 로그 상관관계). `GlobalExceptionFilter` 가 매 응답마다 발급한다.
- `details`: 선택 필드 (검증 오류 등 추가 컨텍스트 존재 시에만 동봉). 검증 오류 항목은 `{ field, message, code: "INVALID_FIELD" }` 구조이며 `field` 는 중첩 경로(`nodes[3].type`)를 유지한다.
- `code` 의 상태코드별 기본값: 400=`VALIDATION_ERROR`, 401=`AUTH_REQUIRED`, 403=`FORBIDDEN`, 404=`RESOURCE_NOT_FOUND`, 409=`RESOURCE_CONFLICT`, 413=`PAYLOAD_TOO_LARGE`, 422=`INVALID_STATE`, 429=`RATE_LIMITED`, 5xx=`INTERNAL_ERROR`.

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
| 413 | Payload Too Large | 요청 본문 크기 초과 (body-parser 한도). 코드 `PAYLOAD_TOO_LARGE`. webhook 본문 크기 정책은 [Spec Webhook WH-NF-02](./12-webhook.md#비기능-요구사항) |
| 422 | Unprocessable Entity | 비즈니스 로직 오류 |
| 429 | Too Many Requests | Rate Limit 초과 |
| 500 | Internal Server Error | 서버 오류 |
| 503 | Service Unavailable | upstream 의존성(Redis 등) 일시 장애로 요청을 수락할 수 없음 — 재시도 가능. 코드: `SERVER_SHUTTING_DOWN`(SIGTERM 후 새 실행 거부)·`EXECUTION_ENQUEUE_FAILED`(continuation publish 실패로 cancel 미수락) — [error-handling §1.5](./3-error-handling.md#15-ws-commands-에러-코드-도메인-spec-참조) |

---

## 7. Rate Limiting

| 범위 | 제한 | 헤더 |
|------|------|------|
| 일반 API | 100 req/min (사용자 기준) | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| 인증 API | 10 req/min (IP 기준) | 동일 |
| Webhook 수신 | 100 req/min (글로벌 throttler `default`) | 동일 |
| 파일 업로드 (KB 문서) | 글로벌 100 req/min 상속 (`POST /api/knowledge-bases/:id/documents` 에 별도 `@Throttle` 없음) | 동일 |
| Provider probe API (`POST /api/model-configs/preview-models` · `POST /api/model-configs/:id/test` · `GET /api/model-configs/:id/models`) | 10 req/min (사용자 기준) — 실시간 provider 호출 비용·속도제한 보호용 `@Throttle`, 3 핸들러 공통 컨트롤러 상수 `PROVIDER_PROBE_THROTTLE` | 동일 |
| KB 재임베딩 (`POST /api/knowledge-bases/:id/re-embed`) | 3 req/min (사용자 기준) — `@Throttle`, editor 이상 ([§8 임베딩 파이프라인](./8-embedding-pipeline.md) SoT) | 동일 |
| 초대 발송/재발송 (`POST /api/workspaces/:id/invitations` · `.../invitations/:invitationId/resend`) | 10 req/min (사용자 기준) — email-bombing 방지 `@Throttle`. provider probe 와 공통 tier 상수 `SENSITIVE_ACTION_THROTTLE`(별칭 `INVITATION_THROTTLE`) | 동일 |
| External Interaction inbound (`POST /api/external/executions/:id/interact` · `GET /api/external/executions/:id`) | interact 60 req/min · status 조회 120 req/min — **execution 당** (IP 아님). 글로벌 100/min 위에 얹히는 층. `InteractionRateLimiterService`(Redis fixed-window) + `InteractionRateLimitGuard`, 초과 시 `429 RATE_LIMITED` + `Retry-After`. SoT: [§14 External Interaction API §8.4](./14-external-interaction-api.md#84-rate-limit) | `Retry-After` |
| External Interaction SSE 동시연결 (`GET /api/external/executions/:id/stream`) | execution 당 3 동시연결 — 초과 시 `429 TOO_MANY_CONNECTIONS`(EIA 전용). SoT: [§14 §5.2](./14-external-interaction-api.md) | — |
| WebSocket 명령 (`/ws` namespace 의 `@SubscribeMessage`) | **socket 당** 60 msg/min (in-memory fixed-window, HTTP 아님). `WsRateLimitGuard`, 초과 시 `WsException(RATE_LIMITED)` → 클라이언트 `exception` 이벤트(HTTP status 없음). `ping` 포함 전 핸들러 + 미등록 이벤트(onAny)에 적용. SoT: [§6 WS 프로토콜 §7.1](./6-websocket-protocol.md#71-에러-코드) | — (transport: socket `exception`) |

Rate Limit 초과 시 `429` 응답 + `Retry-After` 헤더.

> **표의 범위**: 위 표는 글로벌 throttler tier(상위 4행)와, 그 위에 라우트별 `@Throttle` 또는 도메인 전용 rate-limiter 로 덮어쓴 **주요 endpoint-specific 오버라이드**(하위 행들)를 cross-cutting SoT 로 정리한 것이다. 개별 엔드포인트의 권위 기술(권한·부수효과 등)은 각 도메인 spec 에 있으며, throttle **수치**의 단일 진실은 본 표다. 인증 요청은 전역 `UserThrottlerGuard` 가 `user:<sub>` 키로 **사용자당** 집계하고(미인증만 IP 폴백), 따라서 위 인증 보호 라우트의 제한은 사용자 기준이다. External Interaction inbound 는 `@Throttle` 이 아니라 도메인 전용 `InteractionRateLimiterService`(execution 단위 Redis 카운터)로 덮어쓴 사례다.

> **`NODE_ENV=test` 환경 한정 skip**: e2e 가 단일 컨테이너 IP 에서 빠른 인증 호출을 직렬로 폭주시켜 자체 throttle 한계 (100/60s) 에 막히는 자기충돌을 피하기 위해, test 환경에서는 `ThrottlerModule` 의 `skipIf` 가 전역적으로 throttle 을 우회한다. production / development 동작은 무변경 — 위 표의 제한이 그대로 강제된다. helper: `codebase/backend/src/common/utils/throttler-skip.ts`.

---

## 8. 페이지네이션

### 8.1 Offset 기반 (기본)

```
GET /api/workflows?page=2&limit=20
```

### 8.2 Cursor 기반 (대량 NodeExecution 등)

Background 노드 본문의 NodeExecution 목록처럼 대량·append 성 데이터는 cursor 페이지네이션을 쓴다.

```
GET /api/executions/{executionId}/background-runs/{backgroundRunId}?cursor=eyJ...&limit=20
```

응답의 `nodeExecutions` 묶음이 cursor 페이지를 담는다. 키는 `nextCursor`(opaque base64, 없으면 `null`) + `hasMore`(추가 페이지 존재 여부):

```json
{
  "data": {
    "nodeExecutions": {
      "data": [...],
      "nextCursor": "eyJ...",
      "hasMore": true
    }
  }
}
```

> 워크플로우별 실행 목록(`GET /api/executions/workflow/:workflowId`)은 cursor 가 아니라 §8.1 offset 기반(`{ page, limit, totalItems, totalPages }`)이다.

---

## 9. 파일 업로드

| 항목 | 규칙 |
|------|------|
| 형식 | `multipart/form-data` (필드명 `file`) |
| 최대 크기 | 단일 파일 50MB (`FileInterceptor` `limits.fileSize`) |
| 허용 타입 | 엔드포인트별 제한 (Knowledge Base 문서: PDF/Markdown/텍스트 등) |
| 응답 | 업로드된 파일 메타데이터 (id, status 등) |

현재 파일 업로드 엔드포인트는 Knowledge Base 문서 업로드(`POST /api/knowledge-bases/:id/documents`)가 유일하다. 유저 아바타는 multipart 업로드가 아니라 `avatarUrl` URL 필드로 관리한다(별도 업로드 엔드포인트 없음).

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
| 실행 제어 | Client → Server | execution.start/stop/continue _(계획·미구현 — [6-websocket-protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server))_ |
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

- `base_url`: SaaS → 서비스 도메인 (예: `https://api.example.com`), 셀프 호스팅 → 설정된 도메인. 프론트엔드 base 결정 규약은 [Spec Webhook WH-EP-02](./12-webhook.md#webhook-엔드포인트).
- `endpoint_path`: Trigger 엔티티의 `endpoint_path` 값 (생성 시 UUID 자동 발급, 라우팅 식별자)
- 예시: `POST https://api.example.com/api/hooks/order-created`

### 11.2 지원 메서드

| 메서드 | 지원 | 설명 |
|--------|------|------|
| POST | ✓ | 표준 webhook 수신 (유일 지원 메서드) |

webhook **수신**(workflow trigger) 메서드로는 POST 만 지원하며 그 외 메서드는 `405 Method Not Allowed`. (GET/PUT trigger 수신은 v1 미지원 — [Spec Webhook WH-EP-03](./12-webhook.md#webhook-엔드포인트).) 단, 같은 라우터에는 위젯 부팅용 공개 읽기 엔드포인트 `GET /api/hooks/{endpoint_path}/embed-config` 가 별도로 존재한다 — webhook 수신이 아니라 임베드 allowlist 조회용 ([7-channel-web-chat/4-security §3](../7-channel-web-chat/4-security.md)).

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

### 413 `PAYLOAD_TOO_LARGE`(전역) — 도메인 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 공존

§6 에 413 `PAYLOAD_TOO_LARGE` 를 전역 표준 코드로 등재했다. 이는 body-parser 레이어가 라우트 본문 한도(전역 100KB·`/api/hooks/*` 1MB)를 초과할 때 `GlobalExceptionFilter` 가 발행하는 **모든 라우트 공통** 코드다. 같은 413 이라도 공개 webhook 의 32KB 도메인 한도는 별도 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(Guard 발행)로 구분한다 — 일반 신규 코드는 전역 코드를 쓰고 도메인 특화 한도가 있을 때만 별도 코드를 신설하는 원칙. 상세 근거·레이어 구분은 [error-handling §Rationale](./3-error-handling.md#rationale) · [Spec Webhook WH-NF-02](./12-webhook.md#비기능-요구사항).

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

### 비-페이징 고정 컬렉션은 `{data:{items}}` 유지 (§5.2 페이징과 형태 상이)

활성 세션·WebAuthn credential 목록은 페이지네이션이 무의미한 소규모 본인 소유 컬렉션으로, `{ data: { items: [...] } }` 를 반환한다. 이는 §5.2 페이징 목록(`data` 가 배열 그 자체, `pagination` 형제)과 nesting 형태가 달라 일관성 관점에서 이상적이지 않다. 그럼에도 이 형태를 **유지**하는 이유: (1) sessions·webauthn 양 엔드포인트의 백엔드(`sessions.controller.ts`·`webauthn.controller.ts` + `WebAuthnCredentialListDto`/`SessionListDto`)와 프런트(`lib/api/sessions.ts`·`passkey-card.tsx` 가 `res.data.data.items` 소비)가 이미 이 계약에 의존하는 **load-bearing** 상태이고, (2) bare-array 로 평탄화하면 백엔드 2·프런트 2 surface 를 동시 변경하는 breaking change 라 이득 대비 churn 이 크다. 따라서 spec 을 실제 계약에 맞춰 정정한다(문서 정직화). 비-페이징 목록을 bare-array `{data:[]}` 로 정규화하는 대안은 breaking 이라 별도 결정 시까지 defer. 본 `{data:{items}}` 는 [Swagger 규약 §6](../conventions/swagger.md#6-레거시-패턴-제거) 이 기각한 페이지네이션 double-wrap 버그(`{data:{items,totalItems,page,limit}}`)와 무관하다 — pagination 필드가 전혀 없는 순수 비-페이징 컬렉션에 한정된다.
