### 발견사항

- **[INFO]** `timeline-tree.ts`의 공개 함수 문서화가 전반적으로 양호함
  - 위치: `timeline-tree.ts` 전체
  - 상세: `buildTimelineTree`, `sumDescendantDurations`에 JSDoc이 작성되어 있으며, 함수의 전제 조건(정렬 순서), 동작 방식(orphan 처리), 반환 구조가 명확히 기술되어 있음
  - 제안: 현재 수준 유지. `countDescendants`에만 JSDoc이 없으나 단순 유틸이므로 현재도 무방

- **[INFO]** `ExecutionContext.parentNodeExecutionId` JSDoc이 구체적이고 복원 의무(restore contract)까지 명시함
  - 위치: `node-handler.interface.ts:31-38`
  - 상세: "Must be restored to the prior value on inline-run return so sibling nodes don't inherit it" — 사용 시 주의사항을 인터페이스 수준에서 명시한 점이 우수함
  - 제안: 없음

- **[INFO]** `InlineExecutionOptions.parentNodeExecutionId` JSDoc이 의도와 기본값("Normally the id of the `workflow` node's own NodeExecution")을 명시함
  - 위치: `workflow-executor.interface.ts:20-26`
  - 상세: 옵션 필드의 목적과 일반적인 사용 패턴이 문서화되어 있어 구현자가 혼란 없이 사용할 수 있음
  - 제안: 없음

- **[INFO]** `NodeExecution.parentNodeExecutionId` entity 필드 JSDoc이 NULL 의미(루트 노드)까지 명시함
  - 위치: `node-execution.entity.ts:64-73`
  - 상세: "NULL for nodes that ran directly in the main workflow (or at any depth where no Sub-Workflow wrapper applies)"라는 경계 조건이 명확히 기술됨
  - 제안: 없음

- **[INFO]** `NodeExecutionData.parentNodeExecutionId` API 타입 JSDoc이 프론트엔드 소비 목적까지 기술함
  - 위치: `executions.ts:22-28`
  - 상세: "Used by the run-results timeline to render Sub-Workflow children as a nested card"로 왜 이 필드가 API에 노출되는지 컨텍스트가 명확함
  - 제안: 없음

- **[INFO]** `NodeResult.parentNodeExecutionId` 스토어 타입 주석이 중간 이벤트 보존 이유를 설명함
  - 위치: `execution-store.ts:49-55`
  - 상세: "some mid-flight events (waiting_for_input) don't carry it, and losing it would collapse the Sub-Workflow card back to a flat row" — 버그 방지 맥락이 포함된 양질의 주석
  - 제안: 없음

- **[INFO]** `SubWorkflowCard` 컴포넌트에 JSDoc 없음
  - 위치: `result-timeline.tsx:201-234`
  - 상세: `TimelineRow`와 `SubWorkflowCard` 모두 컴포넌트 상단에 간단한 JSDoc(또는 단일 줄 설명 주석)이 있으나, `SubWorkflowCard`의 "기본 expanded=true" 동작 방식이 props 레벨이 아니라 구현 내부에만 설명되어 있음. `RowCtx`도 마찬가지
  - 제안: 현재 인라인 주석 수준으로 충분. 별도 JSDoc 추가 불필요

- **[WARNING]** `migration V012`에 기존 데이터 백필 여부가 주석으로 명시되지 않음
  - 위치: `V012__add_parent_node_execution_id.sql` 전체
  - 상세: 기존 `node_execution` 레코드는 마이그레이션 후 `parent_node_execution_id = NULL`이 되어 모두 루트로 처리됨. 이것이 의도된 동작(신규 실행부터 적용)인지 아닌지가 주석에 명시되어 있지 않아, 향후 개발자가 백필이 필요한지 판단할 근거가 없음
  - 제안:
    ```sql
    -- Applies to new executions only. Existing records retain NULL (treated as
    -- root nodes in the timeline), which is acceptable since sub-workflow
    -- grouping did not exist before this migration.
    ```

- **[INFO]** `ON DELETE SET NULL` 선택 근거가 주석으로 명시되지 않음
  - 위치: `V012__add_parent_node_execution_id.sql:4`
  - 상세: CASCADE 대신 SET NULL을 선택한 이유(자식 실행 이력 보존)가 코드 외부에서는 추론 불가
  - 제안:
    ```sql
    -- ON DELETE SET NULL: preserve child execution history even when the
    -- parent Sub-Workflow node execution is deleted.
    ```

- **[INFO]** `CREATE INDEX` 라인에 용도 주석 없음
  - 위치: `V012__add_parent_node_execution_id.sql:5`
  - 상세: 인덱스가 "부모 기준 자식 조회 성능"을 위한 것임이 헤더 주석에 암묵적으로 기술되어 있으나, 인덱스 라인 자체에 없음
  - 제안:
    ```sql
    -- Index for efficiently fetching all child executions of a given parent.
    CREATE INDEX idx_node_execution_parent ON node_execution(parent_node_execution_id);
    ```

- **[INFO]** `toggleCardExpand` vs `toggleExpand` 분리 이유가 주석에만 있고 함수명으로는 알기 어려움
  - 위치: `result-timeline.tsx:340-345`
  - 상세: Sub-Workflow 카드의 기본 상태가 expanded=true이기 때문에 토글 기본값이 다름. 현재 인라인 주석으로 설명되어 있어 이해는 가능하나, 함수 이름에서는 이 차이가 드러나지 않음
  - 제안: 주석이 이미 충분히 설명하고 있으므로 현재 수준 유지

- **[INFO]** `spec` 문서에 Sub-Workflow 타임라인 계층 구조 관련 내용 업데이트 여부 미확인
  - 위치: `spec/` 디렉토리
  - 상세: 이번 변경은 실행 타임라인의 렌더링 방식을 계층 트리로 전환하는 기능 변경으로, `spec/` 문서에 반영이 필요할 수 있음. 현재 리뷰 범위에는 포함되어 있지 않아 확인 불가
  - 제안: `spec/execution-timeline.md` 또는 관련 스펙 파일에 Sub-Workflow 카드 그룹핑 동작, `parentNodeExecutionId` 전파 방식, 트리 구조 렌더링 규칙을 추가 기술하는 것을 권장

---

### 요약

전반적으로 문서화 품질이 높다. 인터페이스 필드, 엔티티 컬럼, API 타입, 스토어 필드 모두 JSDoc이 작성되어 있고, 새로 추가된 `timeline-tree.ts`는 함수 전제 조건(정렬 순서)과 경계 동작(orphan 처리)을 명시한 양질의 문서를 포함한다. 개선 여지는 마이그레이션 파일에 집중되어 있으며, 기존 데이터 백필 불필요 여부 주석과 `ON DELETE SET NULL` 선택 근거 주석을 추가하면 향후 유지보수 시 혼란을 방지할 수 있다. 코드 레이어의 문서화는 Warning 수준의 누락이 없다.

### 위험도

**LOW** — 마이그레이션 파일의 설계 의도 주석 보완이 권장 사항이나, 기능 동작에는 영향 없음