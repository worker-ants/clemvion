# Spec: 실행 엔진 상세

> 관련 문서: [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## 1. 실행 상태 머신

### 1.1 Execution 상태

```
                    ┌─ cancelled
                    │
                    ├─ waiting_for_input ─┬─ running (재개)
pending → running ──┤                     └─ cancelled
                    ├─ completed
                    │
                    └─ failed
```

| 상태 | 설명 | 전이 조건 |
|------|------|-----------|
| `pending` | 실행 요청됨, Worker 할당 대기 | 트리거/수동 실행 시 생성 |
| `running` | 실행 중 | Worker가 태스크 소비 시 |
| `waiting_for_input` | Form 노드에서 사용자 입력 대기 중 | Form 노드 도달 시 |
| `completed` | 정상 완료 | 모든 노드 실행 완료 |
| `failed` | 실패 | 노드 에러 + Stop Workflow 정책, 또는 시스템 에러 |
| `cancelled` | 사용자 취소 | 사용자가 실행 중단 요청 |

**허용되는 상태 전이:**

| From | To | 조건 |
|------|----|------|
| pending | running | Worker 할당 |
| pending | cancelled | 큐 대기 중 취소 |
| running | completed | 정상 종료 |
| running | failed | 에러 발생 |
| running | cancelled | 사용자 취소 |
| running | waiting_for_input | Form 노드 도달 |
| waiting_for_input | running | 사용자 폼 제출 (실행 재개) |
| waiting_for_input | cancelled | 사용자 취소 또는 타임아웃 |

### 1.2 NodeExecution 상태

```
                    ┌─ completed
                    │
pending → running ──┤
                    ├─ failed
                    │
                    ├─ skipped
                    │
                    └─ waiting_for_input → completed (폼 제출 시)
```

| 상태 | 설명 |
|------|------|
| `pending` | 실행 대기 (선행 노드 완료 대기) |
| `running` | 실행 중 |
| `waiting_for_input` | Form 노드에서 사용자 입력 대기 중 |
| `completed` | 정상 완료 |
| `failed` | 실행 실패 |
| `skipped` | 건너뜀 (노드 비활성, Skip Node 정책, 조건 분기 미선택) |

---

## 2. 그래프 순회

### 2.1 토폴로지 정렬 기반 실행

워크플로우 실행 시 노드 그래프를 토폴로지 정렬(Topological Sort)하여 실행 순서를 결정한다.

```
1. 워크플로우의 모든 노드와 엣지를 로드
2. 컨테이너 내부 노드(container_id != null)를 글로벌 그래프에서 제외
3. Tool Area 노드(tool_owner_id != null)를 글로벌 그래프에서 제외
4. 나머지 노드로 DAG 구성 → 토폴로지 정렬
5. 정렬 순서에 따라 순차 실행 (분기는 선택된 포트만)
```

### 2.2 컨테이너 내부 독립 정렬

컨테이너 노드(Loop, ForEach, Background) 내부의 자식 노드는 독립적으로 토폴로지 정렬한다.

- 컨테이너 실행 시점에 내부 노드의 실행 순서를 별도 산출
- 내부 그래프는 글로벌 DAG 사이클 검사에서 제외 (반복 구조 허용)
- 컨테이너 경계를 넘는 엣지는 존재하지 않음 (포트를 통해서만 데이터 전달)

### 2.3 Tool Area 노드 처리

Tool Area에 등록된 노드(tool_owner_id != null)는 그래프 순회에 참여하지 않는다.

- AI Agent의 LLM이 도구 호출을 요청할 때만 **on-demand**로 실행
- 실행 결과는 AI Agent 노드의 tool call 컨텍스트로 반환
- NodeExecution 레코드는 정상 생성 (parent_execution_id = AI Agent의 NodeExecution)

---

## 3. 컨테이너 실행

### 3.1 Loop 실행

```
1. count 평가 → N회
2. for i in 0..N:
   a. $loop.index = i 설정
   b. 컨테이너 내부 노드 그래프를 순차 실행
   c. 내부 리프 노드의 출력을 병합하여 다음 반복의 body 시작 노드 입력으로 전달
   d. breakCondition 평가 → 충족 시 조기 종료
3. 최종 반복의 리프 노드 병합 출력을 done 포트로 전달
```

- 각 반복은 독립된 NodeExecution 세트 생성 (iteration 인덱스 기록)
- maxIterations 초과 시 `MAX_ITERATIONS_EXCEEDED` 에러

#### 3.1.1 리프 노드 정의

"리프 노드"란 컨테이너 내부에서 **후속 엣지가 없는 노드**(done 포트에 연결되기 직전의 종단 노드)를 말한다.

#### 3.1.2 다중 리프 출력 병합

컨테이너 내부에 리프 노드가 2개 이상인 경우, 각 리프 노드의 출력을 다음과 같이 병합한다:

```json
{
  "<leafNodeId_1>": { /* 리프 노드 1 출력 */ },
  "<leafNodeId_2>": { /* 리프 노드 2 출력 */ }
}
```

- 리프 노드가 1개인 경우: 해당 노드의 출력을 그대로 전달 (래핑 없음)
- 병합된 출력이 다음 반복의 body 시작 노드 `$input`으로 전달된다

### 3.2 ForEach 실행

```
1. arrayField 평가 → 배열 추출
2. for each item in array:
   a. $item = 현재 항목 설정
   b. 컨테이너 내부 노드 그래프를 순차 실행
   c. collectResults=true 시 리프 노드 출력을 결과 배열에 수집
   d. errorPolicy에 따라 에러 처리 (stop/skip/continue)
3. 수집된 결과 배열을 done 포트로 전달
```

- 결과 배열은 원본 배열과 **동일 인덱스**를 유지한다. errorPolicy=skip 시 스킵된 인덱스에 에러 객체를 삽입한다: `{ _skipped: true, error: { code: "...", message: "..." } }`. 이를 통해 다운스트림에서 스킵 여부와 원인을 프로그래밍적으로 판별할 수 있다
- 다중 리프 노드가 있는 경우, Loop와 동일한 병합 규칙(§3.1.2)을 적용한다

### 3.4 중첩 컨테이너 스코프

컨테이너가 중첩된 경우(예: Loop > ForEach), 내부 컨테이너는 **스코프 체인**을 통해 외부 컨텍스트를 참조할 수 있다.

#### 3.4.1 스코프 체인 규칙

| 규칙 | 설명 |
|------|------|
| 읽기 가능 | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 읽을 수 있다 |
| 쓰기 불가 | 내부 컨테이너에서 외부 컨테이너의 컨텍스트 변수를 직접 수정할 수 없다 |
| Shadowing | 동명 변수가 존재하면 내부(현재 스코프)가 우선한다 |
| `$parent` 접근 | `$parent.loop`, `$parent.item`으로 한 단계 외부 컨테이너 컨텍스트에 명시적으로 접근 |

#### 3.4.2 예시: Loop > ForEach 중첩

```
Loop (외부)                    ForEach (내부)
──────────────                 ──────────────────
$loop.index = 2               $item = "current item"
$loop.count = 10              $item.index = 1
                               $parent.loop.index = 2  (외부 Loop 참조)
                               $parent.loop.count = 10
```

- 내부 ForEach에서 `$loop`를 참조하면 → 외부 Loop의 `$loop` (ForEach는 `$loop` 변수를 생성하지 않으므로 shadowing 없음)
- 내부 ForEach에서 `$item`을 참조하면 → ForEach 자신의 현재 항목
- 외부 Loop에 대해 명시적으로 `$parent.loop`로도 접근 가능

---

### 3.3 Background 실행

```
1. main 포트로 입력 데이터를 즉시 pass-through (메인 흐름 계속)
2. 별도 Worker 태스크로 컨테이너 내부 노드 그래프를 비동기 실행
   - 새로운 NodeExecution 세트 생성 (background=true 플래그)
3. 백그라운드 완료/실패 시 설정에 따라 알림
4. 타임아웃 초과 시 강제 종료
```

- 메인 Execution과 동일한 execution_id를 공유
- 백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음

---

## 4. Worker 모델

### 4.1 아키텍처

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Execution  │────→│  Redis BQ    │────→│  Worker 1   │
│  Engine     │     │  (Task Queue)│     │  Worker 2   │
│  (Producer) │     │              │     │  Worker N   │
└─────────────┘     └──────────────┘     └─────────────┘
```

### 4.2 태스크 단위

- **1 Worker = 1 NodeExecution**: 각 Worker는 한 번에 하나의 노드 실행을 처리
- 태스크 메시지 형식:

```json
{
  "taskId": "uuid",
  "executionId": "uuid",
  "nodeId": "uuid",
  "nodeType": "ai_agent",
  "input": { ... },
  "context": {
    "variables": { ... },
    "loopContext": null,
    "itemContext": null
  },
  "timeout": 30000,
  "retryCount": 0
}
```

### 4.3 수평 확장

| 항목 | 설명 |
|------|------|
| Worker 인스턴스 수 | 환경 변수로 설정 (기본: 4) |
| 스케일 아웃 | Worker 프로세스를 추가하여 처리량 증가 |
| 큐 파티셔닝 | 워크스페이스별 큐 분리 가능 (멀티테넌트 격리) |
| 우선순위 큐 | 수동 실행 > 트리거 실행 > 스케줄 실행 |

---

## 5. 노드 핸들러 계약

### 5.1 NodeHandler 인터페이스

모든 노드 유형은 공통 핸들러 인터페이스를 구현한다.

```
interface NodeHandler {
  validate(config: JSON) → ValidationResult
  execute(input: JSON, config: JSON, context: ExecutionContext) → JSON
}
```

| 메서드 | 설명 |
|--------|------|
| `validate(config)` | 노드 설정의 유효성 검사. 워크플로우 저장/실행 전에 호출. 에러 시 `{ valid: false, errors: [...] }` 반환 |
| `execute(input, config, context)` | 노드 실행. 입력 데이터와 설정을 받아 처리 후 출력 데이터를 반환 |

### 5.2 NodeHandlerRegistry

```
interface NodeHandlerRegistry {
  register(nodeType: string, handler: NodeHandler) → void
  get(nodeType: string) → NodeHandler
}
```

- 시스템 시작 시 모든 빌트인 노드 핸들러를 레지스트리에 등록
- 마켓플레이스를 통해 설치된 커스텀 플러그인 노드도 동일 레지스트리에 등록
- 미등록 nodeType 조회 시 `UNKNOWN_NODE_TYPE` 에러

### 5.3 Worker 실행 흐름

```
1. Worker가 태스크 큐에서 태스크 메시지를 수신
2. registry.get(nodeType) → handler 조회
3. handler.validate(config) → 유효하지 않으면 즉시 실패 (INVALID_NODE_CONFIG)
4. handler.execute(input, config, context) → output
5. 출력 정규화: output이 JSON 직렬화 가능한지 확인
6. NodeExecution 레코드에 input, output, status 기록
7. 다음 노드 태스크 생성 (그래프 순회에 따라)
```

### 5.4 노드 유형별 리트라이 정책

| 카테고리 | 기본 리트라이 | 설정 가능 | 비고 |
|----------|-------------|-----------|------|
| Integration | 최대 3회, 지수 백오프 | O (maxRetries, retryDelay) | 외부 서비스 일시 장애 대응 |
| AI | 최대 2회, 지수 백오프 | O | LLM 프로바이더 일시 장애 대응 |
| Logic | 리트라이 없음 | X | 결정론적 실행, 재시도 무의미 |
| Data | 리트라이 없음 | X | 결정론적 실행, 재시도 무의미 |
| Flow | 최대 1회 | O | 하위 워크플로우 호출 실패 시 |
| Presentation | 리트라이 없음 | X | UI 렌더링, 재시도 무의미 |

> 사용자가 노드 설정 패널의 에러 처리 정책에서 "Retry"를 선택하면 위 기본값을 오버라이드할 수 있다. [노드 공통 스펙 §2.4](../3-workflow-editor/1-node-common.md#24-에러-처리-정책) 참조.

---

## 6. 실행 컨텍스트

### 6.1 컨텍스트 구조

```json
{
  "executionId": "uuid",
  "workflowId": "uuid",
  "variables": {
    "myVar": "value"
  },
  "nodeOutputCache": {
    "node-uuid-1": { "field": "output data" },
    "node-uuid-2": { ... }
  },
  "loopContext": {
    "index": 3,
    "count": 10,
    "isFirst": false,
    "isLast": false
  },
  "itemContext": {
    "item": { ... },
    "index": 2,
    "isFirst": false,
    "isLast": false
  }
}
```

### 6.2 저장 전략

| 단계 | 저장소 | 설명 |
|------|--------|------|
| 실행 중 | Redis | 실행 컨텍스트를 Redis에 저장 (TTL: 실행 타임아웃 × 2) |
| 노드 완료 시 | Redis + PostgreSQL | nodeOutputCache 업데이트(Redis), NodeExecution 레코드 저장(PostgreSQL) |
| 실행 완료 시 | PostgreSQL | 전체 컨텍스트를 PostgreSQL에 영구 저장, Redis에서 삭제 |

---

## 7. 장애 복구

### 7.1 Worker Heartbeat

| 항목 | 값 |
|------|-----|
| Heartbeat 간격 | 5초 |
| 미응답 판정 | 3회 연속 미응답 (15초) |
| 미응답 시 동작 | 해당 태스크를 큐에 재발행 (재큐) |

### 7.2 체크포인트 기반 Resume

```
1. 워크플로우 실행 중 각 노드 완료 시 체크포인트 저장
   - 완료된 노드 목록, 각 노드의 출력 데이터, 현재 실행 컨텍스트
2. Worker 장애 발생 시:
   a. 미완료 태스크(현재 실행 중이던 노드)를 재큐
   b. 새 Worker가 태스크 소비
   c. 해당 노드만 재실행 (이전 완료 노드는 재실행하지 않음)
3. 전체 Execution Engine 재시작 시:
   a. status=running인 Execution 목록 조회
   b. 각 Execution의 마지막 체크포인트에서 resume
```

### 7.3 멱등성 보장

- 각 NodeExecution에 고유 taskId 부여
- Worker는 실행 전 taskId 중복 확인 (이미 완료된 태스크는 스킵)
- 외부 API 호출 노드(Integration)의 멱등성은 노드 설정에서 관리

---

## 8. 동시 실행 제한

| 제한 항목 | 기본값 | 설정 위치 |
|-----------|--------|-----------|
| 워크스페이스당 동시 Execution 수 | 10 | Workspace.settings |
| 워크플로우당 동시 Execution 수 | 3 | Workflow.settings |
| 단일 Execution 최대 노드 수 | 500 | 시스템 설정 |
| 단일 Execution 최대 실행 시간 | 30분 | Workflow.settings |
| 노드별 기본 타임아웃 | 30초 | Node.config |

**제한 초과 시 동작:**
- 워크스페이스/워크플로우 제한 초과 → 새 Execution은 `pending` 상태로 큐 대기
- 최대 실행 시간 초과 → `EXECUTION_TIMEOUT` 에러 → Execution.status = `failed`
- 큐 대기 시간 제한 (기본: 5분) 초과 → `cancelled` 처리

---

## 9. Redis 키 네이밍 컨벤션

### 9.1 키 패턴

모든 Redis 키는 아래 패턴을 따른다:

```
{service}:{workspaceId}:{resource}:{id}:{sub}
```

| 세그먼트 | 설명 | 예시 |
|----------|------|------|
| `service` | 서비스 식별자 | `exec` (실행 엔진), `core` (Core API), `ws` (WebSocket) |
| `workspaceId` | 워크스페이스 UUID | `550e8400-...` |
| `resource` | 리소스 유형 | `execution`, `node`, `lock`, `rate`, `session` |
| `id` | 리소스 ID | UUID |
| `sub` | 하위 키 (선택) | `context`, `output`, `heartbeat` |

### 9.2 용도별 키 정의 및 TTL

| 키 패턴 | 용도 | TTL |
|---------|------|-----|
| `exec:{wsId}:execution:{execId}:context` | 실행 컨텍스트 (변수, nodeOutputCache) | 실행 타임아웃 × 2 |
| `exec:{wsId}:execution:{execId}:status` | 실행 상태 (running, waiting 등) | 실행 타임아웃 × 2 |
| `exec:{wsId}:node:{nodeExecId}:output` | 노드 실행 출력 캐시 | 실행 타임아웃 × 2 |
| `exec:{wsId}:worker:{workerId}:heartbeat` | Worker 헬스체크 | 15초 |
| `exec:{wsId}:lock:{execId}` | 실행 동시 접근 잠금 | 30초 (자동 갱신) |
| `core:{wsId}:rate:{userId}` | API Rate Limit 카운터 | 60초 |
| `ws:{wsId}:session:{connId}` | WebSocket 세션 정보 | 세션 유지 시간 |
| `exec:{wsId}:queue:priority` | 우선순위 큐 (Sorted Set) | 영구 (큐 소비 시 삭제) |
