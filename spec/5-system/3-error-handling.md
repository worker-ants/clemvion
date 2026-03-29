# Spec: 에러 처리 정책

> 관련 문서: [PRD 비기능 요구사항](../../prd/5-non-functional.md) · [Spec API 규칙](./2-api-convention.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md)

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

| 코드 | 설명 |
|------|------|
| `EXECUTION_TIMEOUT` | 워크플로우 또는 노드 실행 타임아웃 |
| `NODE_EXECUTION_FAILED` | 노드 실행 중 에러 |
| `INTEGRATION_ERROR` | 외부 서비스 연동 실패 |
| `LLM_ERROR` | LLM API 호출 실패 |
| `LLM_RATE_LIMITED` | LLM 프로바이더 Rate Limit |
| `RECURSION_DEPTH_EXCEEDED` | 서브 워크플로우 재귀 깊이 초과 |
| `MAX_ITERATIONS_EXCEEDED` | Loop/ForEach 최대 반복 횟수 초과 |
| `CYCLE_DETECTED` | 워크플로우 그래프에 순환 감지 |
| `INVALID_EXPRESSION` | 표현식 평가 실패 |
| `VARIABLE_NOT_FOUND` | 참조된 변수 없음 |
| `TYPE_MISMATCH` | 데이터 타입 불일치 |
| `ERROR_PORT_FALLBACK` | 에러 포트로 라우팅 시도했으나 연결된 엣지 없음 → Stop Workflow 폴백 |

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

에러 포트로 전달되는 데이터 구조:

```json
{
  "error": {
    "code": "NODE_EXECUTION_FAILED",
    "message": "LLM connection timeout",
    "nodeId": "uuid-of-failed-node",
    "nodeType": "ai_agent",
    "timestamp": "2026-03-29T12:00:00.000Z",
    "details": { ... },
    "originalInput": { ... }
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| code | String | 에러 코드 (§1.4 참조) |
| message | String | 사람이 읽을 수 있는 에러 메시지 |
| nodeId | UUID | 에러가 발생한 노드 ID |
| nodeType | String | 에러가 발생한 노드 타입 |
| timestamp | Timestamp | 에러 발생 시각 |
| details | Object? | 에러 상세 정보 (스택 트레이스 등) |
| originalInput | Object | 에러 발생 노드에 전달되었던 원본 입력 데이터 |

**동작 규칙:**
- error 포트에 엣지가 연결되어 있으면 → 에러 데이터를 해당 엣지로 전달, 다음 노드 실행
- error 포트에 엣지가 없으면 → `ERROR_PORT_FALLBACK` 에러 로깅 후 Stop Workflow 폴백
- NodeExecution.status는 `failed`로 기록하되, Execution은 계속 진행

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
