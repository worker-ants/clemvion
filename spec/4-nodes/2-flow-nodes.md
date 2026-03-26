# Spec: Flow 노드 상세

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#4-flow-노드) · [Spec 노드 개요](./0-overview.md)

---

## 1. Workflow (서브 워크플로우 호출)

다른 워크플로우를 서브 워크플로우로 호출하여 재사용성과 모듈화를 지원.

### 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| workflowId | UUID | 호출할 대상 워크플로우 ID |
| mode | Enum | `sync` / `async` |
| inputMapping | MappingDef[] | 입력 파라미터 매핑 |
| timeout | Integer? | 동기 호출 시 타임아웃 (초, 기본: 300) |

### 설정 UI

```
┌────────────────────────────────────────┐
│  Workflow                              │
│  ────────────────────────────────────  │
│                                        │
│  Target: [Select Workflow ▼]           │
│          "Data Processing Pipeline"     │
│                                        │
│  Mode:   ● Sync  ○ Async              │
│                                        │
│  Input Mapping:                        │
│  ┌────────────────────────────────────┐│
│  │ param1  ←  {{ $input.data }}      ││
│  │ param2  ←  {{ $var.config }}      ││
│  │ [+ Add Parameter]                 ││
│  └────────────────────────────────────┘│
│                                        │
│  Timeout: [300] seconds                │
└────────────────────────────────────────┘
```

### 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

### 실행 로직

#### 동기(Sync) 모드
1. `inputMapping`에 따라 입력 데이터 구성
2. 대상 워크플로우를 새 Execution으로 실행
3. 대상 워크플로우 완료까지 대기 (블로킹)
4. 대상 워크플로우의 최종 출력을 `out` 포트로 전달
5. 타임아웃 초과 시 에러 (에러 핸들링 정책 적용)

#### 비동기(Async) 모드
1. `inputMapping`에 따라 입력 데이터 구성
2. 대상 워크플로우를 새 Execution으로 실행 요청
3. 즉시 실행 ID를 출력에 포함하여 `out` 포트로 전달
4. 메인 워크플로우는 대기 없이 다음 노드로 진행

**비동기 모드 출력 예시:**
```json
{
  "executionId": "uuid-of-sub-execution",
  "workflowId": "uuid-of-target-workflow",
  "status": "started"
}
```

### 대상 워크플로우 선택

- 드롭다운: 같은 워크스페이스 내의 워크플로우 목록
- 검색 가능
- 선택 시 대상 워크플로우의 입력 스키마(첫 노드 기대 입력) 표시
- 대상 워크플로우가 삭제/비활성화된 경우 경고 표시

### 재귀 호출 방지

- 자기 자신을 직접 호출하는 것은 허용 (단, 최대 재귀 깊이 제한: 기본 10)
- 간접 재귀(A→B→A)도 깊이 제한 적용
- 깊이 초과 시 에러: "Maximum recursion depth exceeded"

### 모니터링

- 메인 워크플로우의 Execution에서 서브 워크플로우 Execution 참조
- 에디터에서 Workflow 노드 클릭 시 서브 실행 상태 확인 가능
- 서브 워크플로우의 에러는 호출 노드에 전파
