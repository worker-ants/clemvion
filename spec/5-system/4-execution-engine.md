# Spec: 실행 엔진 상세

> 관련 문서: [Spec 아키텍처 개요](../0-overview.md) · [Spec 에러 처리](./3-error-handling.md) · [Spec 실행/디버깅](../3-workflow-editor/3-execution.md) · [데이터 모델 - Execution](../1-data-model.md#213-execution)

---

## 1. 실행 상태 머신

### 1.1 Execution 상태

```
                    ┌─ cancelled
                    │
pending → running ──┤
                    ├─ completed
                    │
                    └─ failed
```

| 상태 | 설명 | 전이 조건 |
|------|------|-----------|
| `pending` | 실행 요청됨, Worker 할당 대기 | 트리거/수동 실행 시 생성 |
| `running` | 실행 중 | Worker가 태스크 소비 시 |
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

### 1.2 NodeExecution 상태

```
                    ┌─ completed
                    │
pending → running ──┤
                    ├─ failed
                    │
                    └─ skipped
```

| 상태 | 설명 |
|------|------|
| `pending` | 실행 대기 (선행 노드 완료 대기) |
| `running` | 실행 중 |
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
   c. 내부 리프 노드의 출력을 다음 반복의 입력으로 전달
   d. breakCondition 평가 → 충족 시 조기 종료
3. 최종 반복의 리프 노드 출력을 done 포트로 전달
```

- 각 반복은 독립된 NodeExecution 세트 생성 (iteration 인덱스 기록)
- maxIterations 초과 시 `MAX_ITERATIONS_EXCEEDED` 에러

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

## 5. 실행 컨텍스트

### 5.1 컨텍스트 구조

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

### 5.2 저장 전략

| 단계 | 저장소 | 설명 |
|------|--------|------|
| 실행 중 | Redis | 실행 컨텍스트를 Redis에 저장 (TTL: 실행 타임아웃 × 2) |
| 노드 완료 시 | Redis + PostgreSQL | nodeOutputCache 업데이트(Redis), NodeExecution 레코드 저장(PostgreSQL) |
| 실행 완료 시 | PostgreSQL | 전체 컨텍스트를 PostgreSQL에 영구 저장, Redis에서 삭제 |

---

## 6. 장애 복구

### 6.1 Worker Heartbeat

| 항목 | 값 |
|------|-----|
| Heartbeat 간격 | 5초 |
| 미응답 판정 | 3회 연속 미응답 (15초) |
| 미응답 시 동작 | 해당 태스크를 큐에 재발행 (재큐) |

### 6.2 체크포인트 기반 Resume

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

### 6.3 멱등성 보장

- 각 NodeExecution에 고유 taskId 부여
- Worker는 실행 전 taskId 중복 확인 (이미 완료된 태스크는 스킵)
- 외부 API 호출 노드(Integration)의 멱등성은 노드 설정에서 관리

---

## 7. 동시 실행 제한

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
