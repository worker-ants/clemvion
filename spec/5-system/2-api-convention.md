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
