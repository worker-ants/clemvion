# Spec: 에러 처리 정책

> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md) · [Spec API 규칙](./2-api-convention.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md)

---

## 1. 에러 분류

### 1.1 시스템 에러

| 코드 | 이름 | 설명 | 사용자 메시지 |
|------|------|------|--------------|
| `INTERNAL_ERROR` | 내부 서버 오류 | 예상하지 못한 서버 오류 | "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." |
| `SERVICE_UNAVAILABLE` | 서비스 불가 | 의존 서비스 접근 불가 | "서비스를 일시적으로 사용할 수 없습니다." |
| `DATABASE_ERROR` | DB 오류 | 데이터베이스 연결/쿼리 실패 | "데이터 처리 중 오류가 발생했습니다." |
| `RATE_LIMITED` | 요청 제한 | Rate limit 초과 | "요청이 너무 많습니다. {retry_after}초 후 다시 시도해 주세요." |

### 1.2 인증/인가 에러

| 코드 | 이름 | 설명 | HTTP |
|------|------|------|------|
| `AUTH_REQUIRED` | 인증 필요 | 토큰 없음 | 401 |
| `TOKEN_EXPIRED` | 토큰 만료 | Access Token 만료 | 401 |
| `TOKEN_INVALID` | 토큰 무효 | 변조/형식 오류 | 401 |
| `FORBIDDEN` | 권한 없음 | 역할 권한 부족 | 403 |
| `LOGIN_FAILED` | 로그인 실패 | 잘못된 자격 증명 | 401 |
| `ACCOUNT_LOCKED` | 계정 잠김 | 로그인 시도 초과 | 423 |

### 1.3 유효성 검증 에러

| 코드 | 설명 | HTTP |
|------|------|------|
| `VALIDATION_ERROR` | 요청 데이터 유효성 실패 | 400 |
| `RESOURCE_NOT_FOUND` | 리소스 없음 | 404 |
| `RESOURCE_CONFLICT` | 리소스 충돌 (이름 중복 등) | 409 |
| `INVALID_STATE` | 상태 전이 불가 (이미 실행 중인 워크플로우 삭제 등) | 422 |

### 1.4 워크플로우 실행 에러

엔진 수준 에러 (execution status → `failed`):

| 코드 | 설명 |
|------|------|
| `EXECUTION_TIMEOUT` | 워크플로우 또는 노드 실행 타임아웃 |
| `RECURSION_DEPTH_EXCEEDED` | 서브 워크플로우 재귀 깊이 초과 |
| `MAX_ITERATIONS_EXCEEDED` | Loop/ForEach 최대 반복 횟수 초과 |
| `CYCLE_DETECTED` | 워크플로우 그래프에 순환 감지 |
| `INVALID_EXPRESSION` | 표현식 평가 실패 |
| `VARIABLE_NOT_FOUND` | 참조된 변수 없음 |
| `TYPE_MISMATCH` | 데이터 타입 불일치 |
| `ERROR_PORT_FALLBACK` | 에러 포트로 라우팅 시도했으나 연결된 엣지 없음 → Stop Workflow 폴백 |

노드 수준 런타임 에러 (`output.error.code` 로 라우팅, §3.2 참조) — 정식 목록은 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum. 주요 항목:

| 카테고리 | 코드 |
|----------|------|
| HTTP | `HTTP_TRANSPORT_FAILED` · `HTTP_4XX` · `HTTP_5XX` · `HTTP_TIMEOUT` |
| Database | `DB_QUERY_FAILED` · `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` |
| Email | `EMAIL_SEND_FAILED` (+ `details.integrationCode` 로 원본 `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 보존) |
| LLM | `LLM_CALL_FAILED` · `LLM_RATE_LIMITED` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT` · `MAX_COLLECTION_RETRIES_EXCEEDED` |
| Code 노드 | `CODE_EXECUTION_FAILED` · `CODE_TIMEOUT` |
| Sub-workflow | `SUB_WORKFLOW_FAILED` |

> 구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다. 엔진 레벨(노드 실패가 Stop Workflow 로 격상된 경우)에서만 `NodeExecution.error.message` 컨텍스트로 남는다.

---

## 2. 에러 응답 형식

### 2.1 기본 형식

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 유효하지 않습니다.",
    "details": [
      {
        "field": "name",
        "message": "이름은 필수 항목입니다.",
        "code": "REQUIRED"
      },
      {
        "field": "cron_expression",
        "message": "유효하지 않은 Cron 표현식입니다.",
        "code": "INVALID_FORMAT"
      }
    ],
    "requestId": "req_abc123"
  }
}
```

### 2.2 실행 에러 형식

```json
{
  "error": {
    "code": "NODE_EXECUTION_FAILED",
    "message": "Node 'AI Agent' failed: LLM connection timeout",
    "nodeId": "uuid-of-node",
    "nodeName": "AI Agent",
    "nodeType": "ai_agent",
    "executionId": "uuid-of-execution",
    "stack": "...",
    "requestId": "req_abc123"
  }
}
```

---

## 3. 노드 에러 처리 정책

개별 노드 설정에서 지정하는 에러 처리 방식. ([Spec 노드 공통](../3-workflow-editor/1-node-common.md#24-에러-처리-정책) 참조)

### 3.1 정책별 동작

```
[실행 중] → [노드 에러 발생]
                │
                ├─ Stop Workflow (기본)
                │   → Execution.status = "failed"
                │   → 에러 노드 하이라이트
                │   → 이후 노드 미실행
                │
                ├─ Skip Node
                │   → NodeExecution.status = "skipped"
                │   → NodeExecution.error = { message: "..." } (에러 정보 보존)
                │   → 출력 = null
                │   → 다음 노드는 null 입력으로 실행
                │
                ├─ Use Default Output
                │   → NodeExecution.status = "completed" (경고 포함)
                │   → 출력 = 미리 설정된 기본값
                │   → 다음 노드는 기본값으로 실행
                │
                ├─ Retry
                │   → 재시도 (maxRetries, retryInterval)
                │   → 모든 재시도 실패 시 Stop Workflow
                │
                └─ Route to Error Port
                    → 에러 데이터를 error 포트로 전달
                    → 연결된 다음 노드가 에러 데이터를 입력으로 실행
                    → error 포트에 엣지가 없으면 Stop Workflow 폴백
```

### 3.2 Route to Error Port 상세

노드 핸들러가 **런타임 실패**를 `port: 'error'` 로 라우팅할 때의 통일된 envelope 규격 (CONVENTIONS §3.2). Pre-flight(config) 에러는 이 envelope 으로 래핑하지 않고 그대로 throw 되어 Execution 전체를 `failed` 로 전이시킨다.

```json
{
  "config": { /* 해석된 노드 config echo (credentials 제외) */ },
  "output": {
    "error": {
      "code": "HTTP_5XX",
      "message": "HTTP 502 Bad Gateway",
      "details": { "statusCode": 502, "url": "https://api.example.com/data", "method": "GET" }
    }
  },
  "meta": { "durationMs": 812, "statusCode": 502 },
  "port": "error",
  "status": "ended"
}
```

**필드 정의** (`NodeHandlerOutput.output.error`):

| 필드 | 타입 | 설명 |
|------|------|------|
| code | String | UPPER_SNAKE_CASE 에러 코드 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 참조) |
| message | String | 사람이 읽을 수 있는 에러 메시지 (국제화 없음) |
| details | Object? | 노드별 부가 정보 — stack / originalInput / attempts / missingFields 등. JSON 직렬화 가능해야 함 |

**LLM 계열 노드의 특이 케이스** — `max_retries` / `max_turns` 같은 부분 성공 시나리오에서는 `output.error` 와 `output.result` 가 **공존** 한다. `output.error` 존재 여부로 에러/정상 분기를 판정하고, 부분 수집된 결과는 `output.result` 에서 소비한다.

**대표 에러 코드** (후속 PR 에서 enum 확장):

| 노드 카테고리 | 코드 |
|----------------|------|
| HTTP | `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT` |
| Database | `DB_QUERY_FAILED`, `DB_CONNECTION_ERROR`, `DB_CONSTRAINT_VIOLATION`, `DB_PERMISSION_DENIED` |
| Email | `EMAIL_SEND_FAILED` |
| LLM | `LLM_CALL_FAILED`, `LLM_RATE_LIMITED`, `LLM_RESPONSE_INVALID`, `LLM_TIMEOUT`, `MAX_COLLECTION_RETRIES_EXCEEDED` |
| Code | `CODE_EXECUTION_FAILED`, `CODE_TIMEOUT` |
| Sub-workflow | `SUB_WORKFLOW_FAILED` |

**에러 포트 보유 노드** (기본):

`http_request`, `database_query`, `send_email`, `code`, `ai_agent`, `text_classifier`, `information_extractor`, `workflow`.

`transform`, `if_else`, `switch` 등은 pre-flight 검증만 수행 → throw (런타임 에러 포트 없음).

**동작 규칙:**
- error 포트에 엣지가 연결되어 있으면 → `output.error` 를 포함한 `output` 전체를 해당 엣지로 전달, 다음 노드 실행
- error 포트에 엣지가 없으면 → `ERROR_PORT_FALLBACK` 에러 로깅 후 Stop Workflow 폴백
- NodeExecution.status 는 `failed` 로 기록하되, Execution 은 계속 진행
- 다운스트림 노드는 `$node["X"].output.error?.code` 로 분기하거나 `$node["X"].port === 'error'` 로 판정

### 3.3 Retry 설정

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| maxRetries | Integer | 3 | 최대 재시도 횟수 |
| retryInterval | Integer | 1000 | 재시도 간격 (ms) |
| backoffMultiplier | Float | 2.0 | 지수 백오프 배수 |
| maxInterval | Integer | 30000 | 최대 재시도 간격 (ms) |

**재시도 간격 계산:**
```
interval = min(retryInterval × backoffMultiplier^attempt, maxInterval)
```

---

## 4. 자동 재시도 정책 (워크플로우 레벨)

트리거/스케줄에 의한 자동 실행 시 워크플로우 레벨 재시도.

| 항목 | 설명 |
|------|------|
| 적용 대상 | Trigger/Schedule에 의한 자동 실행만 (수동 실행 제외) |
| 재시도 횟수 | 워크플로우 설정에서 지정 (기본: 0, 최대: 5) |
| 재시도 간격 | 고정 또는 지수 백오프 |
| 재시도 대상 에러 | 시스템 에러, Integration 에러, 타임아웃만 재시도 (유효성 에러는 재시도하지 않음) |

---

## 5. 클라이언트 에러 처리

### 5.1 API 에러 처리 흐름

```
API 호출 → 응답 확인
  │
  ├─ 200/201/204 → 정상 처리
  │
  ├─ 400 → 유효성 에러 표시 (필드별 에러 메시지)
  │
  ├─ 401 → 토큰 갱신 시도
  │   ├─ 갱신 성공 → 원래 요청 재시도
  │   └─ 갱신 실패 → 로그인 페이지 이동
  │
  ├─ 403 → "권한이 없습니다" 토스트
  │
  ├─ 404 → "리소스를 찾을 수 없습니다" 토스트 또는 404 페이지
  │
  ├─ 409 → 충돌 해결 안내 (예: 이름 변경)
  │
  ├─ 429 → "요청이 너무 많습니다" 토스트 + Retry-After 후 자동 재시도
  │
  └─ 500 → "서버 오류가 발생했습니다" 토스트 + 에러 리포트 옵션
```

### 5.2 토스트 알림

| 유형 | 스타일 | 자동 닫힘 |
|------|--------|-----------|
| 성공 | 초록 | 3초 |
| 정보 | 파랑 | 5초 |
| 경고 | 노랑 | 수동 닫기 |
| 에러 | 빨강 | 수동 닫기 |

---

## 6. 로깅 정책

### 6.1 로그 레벨

| 레벨 | 용도 |
|------|------|
| ERROR | 시스템 에러, 미처리 예외 |
| WARN | 비정상적이지만 복구 가능한 상황 (재시도, 폴백) |
| INFO | 주요 비즈니스 이벤트 (실행 시작/완료, 로그인) |
| DEBUG | 상세 디버깅 (요청/응답 데이터, 쿼리) |

### 6.2 로그 형식

```json
{
  "timestamp": "2026-03-26T12:00:00.000Z",
  "level": "ERROR",
  "service": "execution-engine",
  "message": "Node execution failed",
  "requestId": "req_abc123",
  "userId": "uuid",
  "workspaceId": "uuid",
  "context": {
    "workflowId": "uuid",
    "executionId": "uuid",
    "nodeId": "uuid",
    "error": "Connection timeout"
  }
}
```

### 6.3 민감 정보 마스킹

로그에 다음 정보가 포함되지 않도록 자동 마스킹:
- API Key, Bearer Token, 비밀번호
- OAuth 토큰
- 개인 식별 정보 (이메일은 부분 마스킹: `g***@example.com`)

---

## 7. 헬스 체크

### 7.1 엔드포인트

```
GET /api/health
```

### 7.2 응답

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 2 },
    "vectorDb": { "status": "healthy", "latency": 8 }
  }
}
```

| 전체 상태 | 조건 |
|-----------|------|
| `healthy` | 모든 checks가 healthy |
| `degraded` | 일부 checks 실패 (비필수) |
| `unhealthy` | 필수 checks 실패 (database, redis) |
