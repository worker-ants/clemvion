# Spec: API 설계 규칙

> 관련 문서: [PRD 비기능 요구사항](../../prd/5-non-functional.md) · [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md)

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

### 2.3 워크스페이스 스코핑

모든 리소스 API는 현재 워크스페이스 컨텍스트에서 동작한다.
워크스페이스 ID는 JWT에서 추출하거나 헤더로 전달.

```
X-Workspace-Id: {workspace-uuid}
```

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
| Webhook 수신 | 1000 req/min (워크스페이스 기준) | 동일 |
| 파일 업로드 | 10 req/min (사용자 기준) | 동일 |

Rate Limit 초과 시 `429` 응답 + `Retry-After` 헤더.

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
| 임베딩 진행 상태 | Server → Client | embedding.progress |

### 10.4 재연결

- 연결 끊김 시 지수 백오프로 재연결 (1s, 2s, 4s, ... 최대 30s)
- 재연결 시 마지막 수신 이벤트 ID 전달 → 놓친 이벤트 재전송

> **상세 프로토콜:** 채널 구독, 인증, heartbeat, 메시지 스키마 등은 [WebSocket 프로토콜 상세](./6-websocket-protocol.md) 참조.

---

## 11. Webhook 수신 엔드포인트

외부 시스템에서 워크플로우를 트리거하기 위해 호출하는 Webhook 수신 엔드포인트를 정의한다.

### 11.1 URL 구조

```
POST {base_url}/hooks/{endpoint_path}
```

- `base_url`: SaaS → 서비스 도메인 (예: `https://api.example.com`), 셀프 호스팅 → 설정된 도메인
- `endpoint_path`: Trigger 엔티티의 `endpoint_path` 값. 사용자가 트리거 생성 시 지정 (유니크)
- 예시: `POST https://api.example.com/hooks/order-created`

> **참고**: `/hooks/*` 경로는 `/api/*` 경로와 분리된다. API Gateway에서 별도 라우팅.

### 11.2 지원 메서드

| 메서드 | 지원 | 설명 |
|--------|------|------|
| POST | ✓ (기본) | 표준 webhook 수신 |
| GET | ✓ | 간단한 트리거 (쿼리 파라미터) |
| PUT | ✓ | 일부 외부 서비스 호환용 |

Trigger 엔티티에 허용 메서드를 설정한다. 설정되지 않은 메서드로 요청 시 `405 Method Not Allowed`.

### 11.3 요청 처리 플로우

```
1. URL에서 endpoint_path 추출
2. Trigger 엔티티 조회 (endpoint_path → trigger)
   - 없으면 → 404 Not Found
   - 비활성(is_active=false) → 410 Gone
3. 인증 검증 (Trigger에 연결된 AuthConfig 기준)
   - AuthConfig 없으면 → 인증 없이 수신 (공개)
   - 검증 실패 → 401 Unauthorized
4. 페이로드 파싱
   - Content-Type: application/json → JSON 파싱
   - Content-Type: application/x-www-form-urlencoded → form 파싱
   - Content-Type: text/plain → 텍스트로 저장
   - 기타 → 400 Bad Request
5. 실행 생성 및 큐에 추가
   - Execution 엔티티 생성 (status: pending, trigger_type: webhook)
   - 실행 엔진 큐에 작업 추가
6. 즉시 응답 반환
```

### 11.4 응답 형식

| 모드 | 설명 | 응답 |
|------|------|------|
| **비동기 (기본)** | 실행 큐에 추가 후 즉시 응답 | `202 Accepted` + `{ "executionId": "uuid" }` |
| **동기** | 워크플로우 실행 완료 후 응답 (쿼리: `?wait=true`, 최대 대기 30초) | `200 OK` + 워크플로우 최종 출력 데이터 |

**비동기 응답:**
```json
{
  "data": {
    "executionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "triggeredAt": "2026-03-29T14:00:00Z"
  }
}
```

**동기 응답 (타임아웃):**
```json
{
  "error": {
    "code": "EXECUTION_TIMEOUT",
    "message": "Workflow execution did not complete within 30 seconds",
    "executionId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 11.5 인증 방식

Webhook 트리거에 AuthConfig를 연결하여 인증을 적용한다.

| 인증 유형 | 검증 방법 |
|-----------|-----------|
| API Key | `X-API-Key` 헤더 또는 `?api_key=` 쿼리 파라미터 |
| Bearer Token | `Authorization: Bearer {token}` 헤더 |
| Basic Auth | `Authorization: Basic {base64}` 헤더 |
| HMAC Signature | `X-Webhook-Signature` 헤더. `HMAC-SHA256(secret, body)` 검증 |
| 없음 (공개) | AuthConfig 미연결 시 인증 없이 수신 |

### 11.6 워크플로우 실행 입력 데이터

Webhook으로 수신한 데이터는 다음 구조로 워크플로우의 첫 번째 노드에 전달된다:

```json
{
  "headers": { "content-type": "application/json", "x-custom": "value" },
  "query": { "param1": "value1" },
  "body": { "event": "order.created", "data": { ... } },
  "method": "POST",
  "path": "/hooks/order-created",
  "triggeredAt": "2026-03-29T14:00:00Z"
}
```

### 11.7 Rate Limiting

Webhook 수신은 워크스페이스 기준 **1000 req/min** 제한 (§7 참조). 초과 시 `429 Too Many Requests`.
