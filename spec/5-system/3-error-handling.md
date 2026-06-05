---
id: error-handling
status: implemented
code:
  - codebase/backend/src/common/filters/http-exception.filter.ts
  - codebase/backend/src/common/pipes/validation.pipe.ts
  - codebase/backend/src/common/swagger/error-response.dto.ts
  - codebase/backend/src/nodes/core/error-codes.ts
  - codebase/backend/src/modules/execution-engine/error/error-policy.handler.ts
  - codebase/backend/src/modules/health/health.service.ts
---

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
| `FORBIDDEN` | 권한 없음 | 역할 권한 부족(generic) | 403 |
| `ADMIN_REQUIRED` | Admin 권한 필요 | 워크스페이스 Owner/Admin 역할 필요 시 발행되는 `FORBIDDEN` 의 컨텍스트 특화 코드(`WorkspacesService.assertAdmin()` 발행) | 403 |
| `LOGIN_FAILED` | 로그인 실패 | 잘못된 자격 증명 | 401 |
| `ACCOUNT_LOCKED` | 계정 잠김 | 로그인 시도 초과 | 423 |

### 1.3 유효성 검증 에러

| 코드 | 설명 | HTTP |
|------|------|------|
| `VALIDATION_ERROR` | 요청 데이터 유효성 실패 | 400 |
| `RESOURCE_NOT_FOUND` | 리소스 없음 | 404 |
| `RESOURCE_CONFLICT` | 리소스 충돌 (이름 중복 등) | 409 |
| `INVALID_STATE` | 상태 전이 불가 (이미 실행 중인 워크플로우 삭제 등) | 422 |

> WS commands 에서는 동일 의미를 `INVALID_EXECUTION_STATE` 코드로 표기 ([WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state)). REST 와 WS 의 routing 분기 가시성을 위해 의도적 분리.

### 1.4 워크플로우 실행 에러

엔진 수준 에러 (execution status → `failed`):

| 코드 | 설명 |
|------|------|
| `EXECUTION_TIMEOUT` | **Code 노드 스크립트 실행 타임아웃** (`nodes/data/code/code.handler.ts`). 엔진 레벨 누적 실행시간 초과는 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 쓴다 |
| `EXECUTION_TIME_LIMIT_EXCEEDED` | 엔진 레벨 — 단일 Execution 의 **누적 active-running 시간**(wall-clock 아님, `waiting_for_input` 대기 제외) 초과 → `failed` ([4-execution-engine §8](./4-execution-engine.md#8-동시-실행-제한)) |
| `WORKER_HEARTBEAT_TIMEOUT` | active 세그먼트 job 이 BullMQ stalled 재배달 attempts 를 모두 소진(terminal worker failure) → `failed` ([4-execution-engine §7.1](./4-execution-engine.md#71-워커-크래시-복구--bullmq-stalled-job-target)) |
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
| Email | `EMAIL_SEND_FAILED` (+ `details.integrationCode` 로 원본 `INTEGRATION_INCOMPLETE` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` 보존) · `EMAIL_HOST_BLOCKED` (SSRF 가드 차단 — host 가 사설/loopback, 기본 ON·`ALLOW_PRIVATE_HOST_TARGETS` opt-out) |
| LLM | `LLM_CALL_FAILED` · `LLM_RATE_LIMIT` · `LLM_RESPONSE_INVALID` · `LLM_TIMEOUT` · `MAX_COLLECTION_RETRIES_EXCEEDED` |
| Code 노드 | `CODE_EXECUTION_FAILED` · `CODE_TIMEOUT` |
| Sub-workflow | `SUB_WORKFLOW_FAILED` |

> 구 에러 코드 `NODE_EXECUTION_FAILED` / `INTEGRATION_ERROR` / `LLM_ERROR` 는 노드 수준 envelope 에 더 이상 사용하지 않는다. 엔진 레벨(노드 실패가 Stop Workflow 로 격상된 경우)에서만 `NodeExecution.error.message` 컨텍스트로 남는다.

> Chat Channel 어댑터의 사용자 안내 메시지 분류는 본 enum 을 입력으로 사용한다 — 분류 표 SoT 는 [`spec/conventions/chat-channel-adapter.md §3.1`](../conventions/chat-channel-adapter.md#31-execution-failed-분류-알고리즘). 본 enum 확장 (예: MCP 도구 카테고리) 시 분류 표 행 추가 검토 의무.

### 1.5 WS commands 에러 코드 (도메인 spec 참조)

다음 에러 코드는 WebSocket ack 응답 전용이며 REST API 에는 적용되지 않는다. 각 코드의 정의·트리거 조건·적용 명령 범위는 해당 도메인 spec 이 SoT 이고, 본 §1.5 는 공용 카탈로그 가시성을 위한 등재 목적이다.

| 코드 | 설명 | 도메인 SoT |
|------|------|-----------|
| `INVALID_EXECUTION_STATE` | 실행이 기대 상태가 아님 (`waiting_for_input` 또는 `failed` 기대). 동기 ack 응답 — BullMQ enqueue 시도 없음 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state) |
| `RESUME_CHECKPOINT_MISSING` | rehydration 시 `NodeExecution.outputData` 부재 또는 손상. Execution `cancelled` 로 종결 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5](./4-execution-engine.md#75-resume-after-restart-rehydration) |
| `RESUME_FAILED` | continuation-queue `RESUME_BULLMQ_ATTEMPTS` 소진. Execution `cancelled` 로 종결 | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5](./4-execution-engine.md#75-resume-after-restart-rehydration) |
| `RESUME_INCOMPATIBLE_STATE` | Multi-turn AI 의 `_resumeCheckpoint` 가 부재(기능 배포 이전 진입한 waiting row) 또는 손상(schema drift 로 재구성 실패). Execution `cancelled` 로 종결 — 채널은 graceful "세션 만료" 안내. **정상 경로(checkpoint 존재)는 재구성 재개되어 미발생** | [WS Protocol §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) / [실행 엔진 §7.5](./4-execution-engine.md#75-resume-after-restart-rehydration) |
| `SERVER_SHUTTING_DOWN` | 서버 SIGTERM 수신 후 새 Execution 시작 불가. HTTP 진입점은 503 으로 표기 ([실행 엔진 §11](./4-execution-engine.md#11-graceful-shutdown)) | [실행 엔진 §11](./4-execution-engine.md#11-graceful-shutdown) |

> `INVALID_EXECUTION_STATE` 와 동일 의미의 REST 코드는 §1.3 의 `INVALID_STATE` (422) — 두 layer 의 routing 분기 가시성을 위해 의도적으로 분리. 상세: [실행 엔진 §7.5.1](./4-execution-engine.md#751-publisher-측-사전-검증--invalid_execution_state).

---

## 2. 에러 응답 형식

### 2.1 기본 형식

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "field": "name",
        "message": "name should not be empty",
        "code": "INVALID_FIELD"
      },
      {
        "field": "nodes[3].type",
        "message": "type must be a string",
        "code": "INVALID_FIELD"
      }
    ],
    "requestId": "req_abc123"
  }
}
```

> 현재 구현(`common/pipes/validation.pipe.ts` `CustomValidationPipe`)은 `message` 로 고정 문자열 `"Input validation failed"`, `details[].message` 로 class-validator constraint 원문(영문), `details[].code` 로 단일 값 `"INVALID_FIELD"` 만 방출한다. `details[].field` 는 중첩/배열 경로를 `nodes[3].type` 형식으로 유지한다. 위 표의 사용자향 한국어 메시지·세분화 코드(`REQUIRED`/`INVALID_FORMAT`)는 **계획(Planned)** 이며 미구현이다.

### 2.2 실행 에러 형식

```json
{
  "error": {
    "code": "LLM_TIMEOUT",
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
| code | String | UPPER_SNAKE_CASE 에러 코드 (`codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 참조). 코드 **명명 규율**(의미 기반 명명·rename 안정성·historical-artifact 예외)의 SoT 는 [`conventions/error-codes.md`](../conventions/error-codes.md) — 본 문서는 표기(`UPPER_SNAKE_CASE`)·카탈로그·envelope 만 정의한다 |
| message | String | 사람이 읽을 수 있는 에러 메시지 (국제화 없음) |
| details | Object? | 노드별 부가 정보 — stack / originalInput / attempts / missingFields 등. JSON 직렬화 가능해야 함 |

**LLM 계열 노드의 특이 케이스** — `max_retries` / `max_turns` 같은 부분 성공 시나리오에서는 `output.error` 와 `output.result` 가 **공존** 한다. `output.error` 존재 여부로 에러/정상 분기를 판정하고, 부분 수집된 결과는 `output.result` 에서 소비한다.

**대표 에러 코드** (후속 PR 에서 enum 확장):

| 노드 카테고리 | 코드 |
|----------------|------|
| HTTP | `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT` |
| Database | `DB_QUERY_FAILED`, `DB_CONNECTION_ERROR`, `DB_CONSTRAINT_VIOLATION`, `DB_PERMISSION_DENIED` |
| Email | `EMAIL_SEND_FAILED` |
| LLM | `LLM_CALL_FAILED`, `LLM_RATE_LIMIT`, `LLM_RESPONSE_INVALID`, `LLM_TIMEOUT`, `MAX_COLLECTION_RETRIES_EXCEEDED` |
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
| maxInterval | Integer | 30000 | 최대 재시도 간격 (ms) — **계획(Planned), 미구현**: 현재 `RetryConfig`(`execution-engine/error/error-policy.handler.ts`)는 이 필드를 두지 않으며 백오프 간격에 상한 클램프가 없다 |

> 위 필드는 `config.errorHandling.retryConfig.*` 경로에 저장된다 (설정 패널 SoT: [Spec 노드 공통 §2.4](../3-workflow-editor/1-node-common.md#24-에러-처리-정책)).

**재시도 간격 계산** (현재 구현 — 상한 클램프 없음):
```
interval = retryInterval × backoffMultiplier^attempt
```

> `maxInterval` 클램프(`min(..., maxInterval)`)는 **계획**이다. 현재 `error-policy.handler.ts` 와 `execution-engine.service.ts` 의 retry 경로 모두 무제한으로 증가하는 지수 백오프를 사용한다.

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
    "redis": { "status": "healthy", "latency": 2 }
  }
}
```

현재 구현(`modules/health/health.service.ts` `HealthService.check()`)은 **database 와 redis 두 항목만** 점검한다. 전체 `status` 는 **binary** 이며 두 항목 중 하나라도 비정상이면 `unhealthy` 다.

| 전체 상태 | 조건 |
|-----------|------|
| `healthy` | database·redis 두 checks 모두 healthy |
| `unhealthy` | database 또는 redis 비정상 — Redis config 누락 시 redis 체크는 `unconfigured` 로 표기되고 전체 status 는 `unhealthy` 로 내려 미구성 상태를 외부 모니터가 감지하게 한다 |

> **계획(Planned)**: `vectorDb` 체크 항목과 `degraded`(비필수 checks 일부 실패) 3-state 어휘는 아직 미구현이다. 현재는 database·redis(필수)만 점검하는 binary 판정이다.

> **참고**: `/api/health` 는 liveness probe 용 binary 판정(`unhealthy`)을 쓴다. 큐 적체 상태를 보여주는 시스템 상태 API(`/api/system-status/overview`)는 "처리 중이나 적체(degraded)" 와 "처리 정지(down)" 를 구분할 가치가 있어 별도 어휘 `healthy/degraded/down` 을 사용한다 — 근거는 [16-system-status-api.md Rationale R-4](./16-system-status-api.md#r-4-health-어휘를-healthydegradeddown-으로-둔-이유).
