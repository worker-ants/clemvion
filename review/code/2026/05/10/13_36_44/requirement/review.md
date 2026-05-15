### 발견사항

---

- **[WARNING]** `spec/4-nodes/2-flow/1-workflow.md` §5.3 에러 예시 JSON 불일치
  - 위치: `spec/4-nodes/2-flow/1-workflow.md` §5.3 예시 JSON
  - 상세: 에러 예시에서 `"message": "Workflow not found: wf_uuid_9999"` 를 사용하면서 `"code": "SUB_WORKFLOW_FAILED"` 를 표시한다. 하지만 구현된 `mapSubWorkflowError` 는 `'workflow not found'` 패턴을 `SUB_WORKFLOW_NOT_FOUND` 으로 매핑한다. 스펙 예시가 실제 동작과 다른 코드를 보여주는 셈이다.
  - 제안: 에러 예시 JSON의 `code` 를 `"SUB_WORKFLOW_NOT_FOUND"` 으로 정정하거나, 예시 메시지를 `SUB_WORKFLOW_FAILED` 가 실제로 나오는 케이스(`"Node 'Transform' exceeded maximum iteration count"` 등)로 교체

---

- **[WARNING]** `mapSubWorkflowError` — `'timeout'` 키워드 매칭이 과도하게 광범위
  - 위치: `workflow.handler.ts` `mapSubWorkflowError` 함수
  - 상세: `lower.includes('timed out') || lower.includes('timeout')` 는 서브 워크플로우 실행 전반의 모든 에러 메시지에 적용된다. executor 가 내부 노드 에러(예: DB 연결 타임아웃, HTTP 요청 타임아웃)를 래핑 없이 그대로 throw 하는 경우, `"PostgreSQL connection timeout after 5s"` 같은 메시지도 `SUB_WORKFLOW_TIMEOUT` 으로 잘못 분류된다. `SUB_WORKFLOW_TIMEOUT` 의 의미는 "서브 워크플로우 실행 자체의 시간 초과" 인데, 내부 노드의 타임아웃과 구분이 안 된다.
  - 제안: 매칭 조건에 컨텍스트를 추가. 예: `'sub-workflow'` 나 `'workflow execution'` 과의 AND 조건, 또는 정규식 `/(sub-?workflow|execution|inline).*timed? out|timed? out.*(sub-?workflow|execution)/` 처럼 워크플로우 실행 컨텍스트를 명시. 혹은 executor 레벨 에러 타입을 구조화할 때까지는 `'timed out'` 만 남기고 `'timeout'` 단독 매칭은 제거

---

- **[INFO]** `SUB_WORKFLOW_TIMEOUT` — async 경로 통합 테스트 미작성
  - 위치: `workflow.handler.spec.ts` `execute - error propagation` describe 블록
  - 상세: `SUB_WORKFLOW_TIMEOUT` 은 sync 경로(`executeInline`)만 통합 테스트가 있다. async 경로(`executeAsync`)는 `mapSubWorkflowError` 단위 테스트가 함수 자체를 검증하지만, async 경로의 end-to-end 흐름(`executeAsync` mock → `buildSubWorkflowError` → `TIMEOUT` 코드)을 직접 통과하는 케이스가 없다. `SUB_WORKFLOW_QUEUE_FAILED` 와 `SUB_WORKFLOW_NOT_FOUND` 는 양쪽 경로가 모두 있음.
  - 제안: `'maps "timed out" → SUB_WORKFLOW_TIMEOUT (async path)'` 케이스 추가

---

- **[INFO]** `workflowNodeOutputSchema` — `meta.status` 필드가 실제 핸들러 반환과 불일치
  - 위치: `workflow.schema.ts` `workflowNodeOutputSchema`
  - 상세: A-2 변경으로 `meta.status: 'started'` 가 제거되고 최상위 `status: 'started'` 로 이동했다. 그러나 `workflowNodeOutputSchema` 의 `meta` 정의에는 여전히 `status: z.string().optional()` 이 남아 있다. 스키마 기반 자동완성, 문서 생성, 런타임 검증에서 `meta.status` 가 유효한 필드처럼 나타날 수 있다. `.passthrough()` 로 인해 파괴적이지는 않지만 혼란 유발 가능.
  - 제안: `meta` 오브젝트에서 `status` 필드 제거. `status` 는 최상위 스키마 필드로 이미 정의됨.

---

- **[INFO]** `mapSubWorkflowError` — executor 에러 메시지 문자열 계약에 종속
  - 위치: `workflow.handler.ts` `mapSubWorkflowError` 주석
  - 상세: 함수 자체가 "until the executor exposes a structured error type" 이라고 명시한다. 하지만 이 임시 상태를 추적할 장치가 없다. executor 가 에러 메시지 포맷을 바꾸면 매핑이 조용히 `SUB_WORKFLOW_FAILED` 로 퇴보하며 테스트도 통과한다. 스펙 `§6` 에도 매칭 패턴이 문서화되어 있어 두 곳에서 동기화가 필요해진다.
  - 제안: executor 에 구조화된 에러 타입(`WorkflowNotFoundError`, `WorkflowTimeoutError` 등) 또는 에러 코드 필드를 추가하는 작업을 별도 plan 항목으로 등록

---

### 요약

Phase 1(A+D) workflow 노드 변경은 요구사항의 4가지 항목(스키마 키 통일, async 출력 보강, 에러 코드 세분화, sync 래핑)을 코드·테스트·스펙·문서 전반에 걸쳐 일관되게 구현했다. `mapSubWorkflowError` 단위 테스트와 통합 테스트가 각 코드를 독립적으로 검증하며, `workflowNodeOutputSchema` 에 `status` 최상위 필드도 반영되어 있다. 치명적인 기능 미구현은 없으나, 스펙 §5.3 예시 JSON 의 에러 코드가 실제 구현과 다른 값을 표시하고 있어 사용자에게 혼동을 줄 수 있으며, `'timeout'` 단독 키워드 매칭이 서브 워크플로우 내부 노드 타임아웃을 `SUB_WORKFLOW_TIMEOUT` 으로 잘못 분류할 수 있는 잠재적 오분류 위험이 있다.

### 위험도

**LOW**