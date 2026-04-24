## 발견사항

### **[WARNING]** `EXECUTION_NOT_IN_SCOPE` 테스트의 Dead Mock 코드
- 위치: `explore-tools.service.spec.ts`, `EXECUTION_NOT_IN_SCOPE` 테스트
- 상세: `mockExecution({ workflowId: OTHER_WF, parentExecutionId: null })` 으로 설정한 뒤 두 번째 `mockResolvedValueOnce(null)` 을 세팅하지만, `isExecutionInScope` 는 `!execution.parentExecutionId` 조건에서 즉시 `false` 를 반환하므로 두 번째 `findOne` 이 절대 호출되지 않음. 테스트 의도를 오해하게 만드는 dead mock
- 제안: 테스트를 두 개로 분리해 의도를 명확히 할 것
  1. `parentExecutionId: null` → 직접 `false` 반환
  2. `parentExecutionId` 가 있으나 부모 `workflowId` 가 `currentWorkflowId` 와 다름 → `false` 반환 (현재 **전혀 테스트되지 않은 경로**)

---

### **[WARNING]** `isExecutionInScope` 의 "부모 존재하지만 다른 워크플로" 경로 미검증
- 위치: `explore-tools.service.spec.ts`, `getExecutionDetails` describe
- 상세: `parentExecutionId` 가 설정된 실행을 조회했는데 부모 실행의 `workflowId` 가 `CURRENT_WF` 가 아닌 제 3의 워크플로인 경우 — `isExecutionInScope` 코드상 `!!parent && parent.workflowId === currentWorkflowId` → `false` 로 `EXECUTION_NOT_IN_SCOPE` 를 반환해야 하지만 이 경로를 검증하는 테스트가 없음. `accepts direct-child` 테스트의 반대 케이스
- 제안:
  ```typescript
  it('rejects sub-execution whose parent belongs to a third workflow', async () => {
    repos.execution.findOne
      .mockResolvedValueOnce(mockExecution({ workflowId: OTHER_WF, parentExecutionId: PARENT_EX }))
      .mockResolvedValueOnce({ id: PARENT_EX, workflowId: 'zzz-other-workflow' }); // 제 3의 WF
    const result = await svc.getExecutionDetails(WORKSPACE, CURRENT_WF, EX_ID) as Row;
    expect(result.error).toBe('EXECUTION_NOT_IN_SCOPE');
  });
  ```

---

### **[WARNING]** `tool-call-badge.tsx` 신규 분기에 대한 프론트엔드 유닛 테스트 없음
- 위치: `frontend/src/components/editor/assistant-panel/tool-call-badge.tsx`
- 상세: `summarize` 함수에 `get_workflow_executions` / `get_execution_details` 두 분기를 추가했지만 해당 로직을 검증하는 테스트가 없음. `result` 가 `null` 일 때 `count` 가 `undefined` 로 처리되는 경로, `status` 가 없는 경우 등 분기별 출력 문자열이 코드 외에 어느 곳에서도 명시적으로 검증되지 않음
- 제안: `tool-call-badge.test.tsx` 에 최소 3 케이스 추가
  1. `get_workflow_executions` + `status: 'failed'` + `items` 3건 → `"executions (failed): 3"`
  2. `get_workflow_executions` + `result` null → `"executions"`
  3. `get_execution_details` + `timeline` 5건 → `"execution detail: 5 nodes"`

---

### **[WARNING]** i18n 키 추가했으나 `tool-call-badge.tsx` 에서 미사용
- 위치: `tool-call-badge.tsx:151–163`, `en.ts / ko.ts`
- 상세: 계획 문서(`plan/workflow-assistant-execution-tools.md`)는 배지 라벨에 `assistant.exploreExecutionsList` / `assistant.exploreExecutionDetails` i18n 키를 사용하도록 지정했지만, 실제 구현은 하드코딩된 영어 문자열(`"executions"`, `"execution detail"`)을 사용. ko.ts 에 추가된 `"실행 이력 {{count}}건 조회"` 등의 번역이 실제로 렌더되지 않음
- 제안: 배지 컴포넌트에서 `useTranslation` (또는 프로젝트의 i18n hook) 을 통해 해당 키를 사용하도록 수정하고, 누락 여부를 테스트로 검증

---

### **[WARNING]** `tsconfig.json` 테스트 파일 제외로 인한 타입 가드 약화
- 위치: `frontend/tsconfig.json`
- 상세: 빌드 타입체크에서 `*.spec.ts / *.test.tsx` 등을 제외하면 테스트 mock 의 타입 불일치가 CI 에서 조용히 통과됨. 예를 들어 `ExploreToolsService` 생성자 시그니처가 변경되면 `explore-tools.service.spec.ts` 의 `makeService()` 가 잘못된 인자를 넘겨도 빌드에서 잡히지 않음
- 제안: `tsconfig.test.json` 을 별도로 만들어 테스트 파일 포함 범위를 분리하거나, Jest `transform` 에서 `tsc --noEmit --project tsconfig.test.json` 을 lint 단계에 추가할 것

---

### **[INFO]** `getWorkflowExecutions` 빈 결과에서 `nodeStats` fallback 비명시
- 위치: `explore-tools.service.spec.ts`
- 상세: 실행 목록이 0건일 때 `loadNodeStats` 에 빈 배열이 전달되어 즉시 빈 Map 을 반환하는 경로가 직접 테스트되지 않음. 현재 `clamps limit` 테스트에서 `finalRows: []` 로 간접적으로 실행되지만 `items: []` 임을 명시적으로 assert 하지 않음
- 제안: 별도 it 블록으로 `items` 가 빈 배열이고 `nodeStats` fallback 이 `{ total:0, completed:0, failed:0 }` 인지 검증 추가

---

### **[INFO]** 단일 자식 실행만 테스트 — 복수 자식 + 혼합 상태 미검증
- 위치: `explore-tools.service.spec.ts`, `subExecutionsTruncatedDepth` 테스트
- 상세: `subExecutions` / `subExecutionsTruncatedDepth` 테스트가 항상 자식 1건만 다룸. `Promise.all` 로 병렬 로드하는 복수 자식 케이스나 자식 중 일부가 `failed` / 일부가 `completed` 인 혼합 케이스가 없음
- 제안: 자식 2건(하나는 completed, 하나는 failed) 케이스를 추가해 `Promise.all` 경로와 상태 혼합 시 envelope 구조를 검증

---

## 요약

핵심 비즈니스 로직 경로(`INVALID_ID`, `WORKFLOW_NOT_FOUND`, `EXECUTION_NOT_FOUND`, 마스킹, `subExecutionsTruncatedDepth`, running 부분 타임라인)에 대한 백엔드 단위 테스트와 스트림 서비스 위임 테스트는 충분히 작성되어 있다. 그러나 `isExecutionInScope` 의 "부모 존재하지만 제 3의 워크플로" 경로가 누락되어 있어 scope 체크 로직의 한 브랜치가 미검증 상태로 남아 있고, 프론트엔드 배지 로직에는 테스트가 전혀 없다. 또한 계획 문서와 달리 i18n 키가 실제 컴포넌트에 적용되지 않아 번역이 렌더되지 않는 상태이며, `tsconfig.json` 의 테스트 파일 제외가 mock 타입 불일치를 빌드에서 가릴 위험이 있다.

## 위험도

**MEDIUM** — 핵심 보안 경계(스코프 검증)의 한 경로가 테스트로 검증되지 않았고, 프론트엔드 신규 로직이 무방비 상태이나, 이미 구현된 `isExecutionInScope` 코드 자체는 올바르게 작성되어 있어 즉각적 장애 위험은 낮음