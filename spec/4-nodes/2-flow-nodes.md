# Spec: Flow 노드 상세

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#4-flow-노드) · [Spec 노드 개요](./0-overview.md)

---

## 1. Workflow (서브 워크플로우 호출)

다른 워크플로우를 서브 워크플로우로 호출하여 재사용성과 모듈화를 지원.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| workflowId | UUID | 호출할 대상 워크플로우 ID |
| workflowName | String? | 선택된 워크플로우 이름 (캔버스 요약 표시용, 드롭다운 선택 시 자동 저장) |
| mode | Enum | `sync` / `async` |
| inputMapping | MappingDef[] | 입력 파라미터 매핑 |
| timeout | Integer? | 동기 호출 시 타임아웃 (초, 기본: 300). `0 = no timeout` (무제한 대기) |

### 설정 UI

```
┌────────────────────────────────────────┐
│  Workflow                              │
│  ────────────────────────────────────  │
│                                        │
│  Target Workflow:                      │
│  [Select a workflow...          ▼]     │
│    - Data Processing Pipeline          │
│    - Email Notification Flow           │
│    - ...                               │
│                                        │
│  Workflow ID:                          │
│  [_________________________]           │
│  (직접 UUID 또는 expression 입력 가능) │
│                                        │
│  Mode:   [Sync ▼]                     │
│                                        │
│  Input Mapping:                        │
│  ┌────────────────────────────────────┐│
│  │ param1  ←  {{ $input.data }}      ││
│  │ param2  ←  {{ $var.config }}      ││
│  │ [+ Add Parameter]                 ││
│  └────────────────────────────────────┘│
│                                        │
│  Timeout: [300] seconds (0=no timeout) │
└────────────────────────────────────────┘
```

- 드롭다운에서 선택 시 Workflow ID 필드에 자동 반영
- 직접 입력 시 드롭다운 선택 해제

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### 실행 로직

#### 동기(Sync) 모드 — 인라인 실행
1. `inputMapping`에 따라 입력 데이터 구성 (미지정 시 부모 입력을 그대로 전달)
2. 대상 워크플로우의 노드와 엣지를 로드하여 **부모 Execution 내에서 인라인 실행**
3. 서브 워크플로우 노드들은 부모의 `executionId`, `nodeOutputCache`, `nodeMap`을 공유
4. 실행 히스토리에서 서브 워크플로우 노드가 부모 노드 다음에 자연스럽게 표시됨
5. `$node` expression 참조가 부모/서브 워크플로우 간에 상호 호환
6. 대상 워크플로우의 최종 출력을 `out` 포트로 전달
7. 서브 워크플로우의 trigger 노드는 자동 스킵 (입력 데이터를 그대로 전달)

#### 비동기(Async) 모드
1. `inputMapping`에 따라 입력 데이터 구성 (미지정 시 부모 입력을 그대로 전달)
2. 대상 워크플로우를 새 Execution으로 실행 요청 (`parentExecutionId`, `recursionDepth` 기록)
3. 즉시 실행 ID를 출력에 포함하여 `out` 포트로 전달
4. 메인 워크플로우는 대기 없이 다음 노드로 진행
5. 비동기 서브 워크플로우의 에러는 부모에 전파되지 않음 (fire-and-forget)

**비동기 모드 출력 예시:**
```json
{
  "executionId": "uuid-of-sub-execution",
  "workflowId": "uuid-of-target-workflow",
  "status": "started"
}
```

### 대상 워크플로우 선택

- 드롭다운: 같은 워크스페이스 내의 워크플로우 목록 (API: `GET /workflows`)
- 현재 편집 중인 워크플로우는 목록에서 제외
- 비활성 워크플로우는 `(inactive)` 라벨 표시
- 드롭다운 선택 시 `workflowId`와 `workflowName`을 config에 동시 저장
- ExpressionInput을 통한 직접 UUID/expression 입력도 지원 (직접 입력 시 `workflowName` 초기화)
- 선택 시 대상 워크플로우의 입력 스키마(첫 노드 기대 입력) 표시
- 대상 워크플로우가 삭제/비활성화된 경우 경고 표시

### 재귀 호출 방지

- 자기 자신을 직접 호출하는 것은 허용 (단, 최대 재귀 깊이 제한: 기본 10)
- 간접 재귀(A→B→A)도 깊이 제한 적용
- 깊이 초과 시 에러: "Maximum recursion depth exceeded"

### 포트

| 포트 | 방향 | 설명 |
|------|------|------|
| `in` | 입력 | 호출 시 input 데이터 |
| `out` | 출력 (success) | 서브 워크플로우의 최종 출력 (sync) 또는 `{executionId}` (async) |
| `error` | 출력 (error) | 서브 워크플로우 런타임 실패 시 라우팅. `output.error.code: 'SUB_WORKFLOW_FAILED'` + `output.error.details.{workflowId, mode}` (CONVENTIONS §3.2) |

> `error` 포트에 엣지가 연결되지 않은 상태에서 서브 워크플로우 실패가 발생하면, 현재 엔진은 호출 노드 실행만 `failed` 로 기록하고 부모 Execution 은 계속 진행한다. `ERROR_PORT_FALLBACK` (Stop Workflow 폴백) 동작은 `spec/5-system/3-error-handling.md §3.2` 의 일반 정책이며, workflow 노드도 동일하게 따른다.

### 모니터링

- **동기 모드**: 인라인 실행이므로 부모 Execution의 히스토리 타임라인에 서브 워크플로우 노드가 직접 표시됨. 런타임 에러는 `error` 포트로 라우팅; 미연결 시 Stop Workflow 폴백 (§3.2 정책)
- **비동기 모드**: 별도 Execution 생성. `parentExecutionId`로 부모 참조. 큐 enqueue 실패 등은 `error` 포트로 라우팅, 런타임 이후 에러는 서브 Execution 의 로그에만 기록.
- `recursionDepth`가 Execution 레코드(비동기) 또는 ExecutionContext(동기)에 기록되어 재귀 깊이 추적 가능

---

## 2. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Workflow | `{workflowName 또는 workflowId} · {mode}`. `workflowName`이 있으면 이름 표시, 없으면 ID 표시. 워크플로우 삭제 시 `⚠ Missing workflow` | `Data Pipeline · sync` |
