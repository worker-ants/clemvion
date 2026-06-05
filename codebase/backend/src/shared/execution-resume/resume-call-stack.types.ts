/**
 * 중첩 sub-workflow(executeInline) blocking 노드 park 시 재개에 필요한 **호출 체인**의
 * durable 영속 형태. `Execution.resume_call_stack`(V087) jsonb 컬럼에 저장된다.
 *
 * 컨테이너(Loop/ForEach/Map/Parallel) body 의 blocking 은 spec §3.2 로 금지되므로,
 * 영속할 중첩은 sub-workflow 호출 체인뿐 = **선형 스택**(iteration/branch 상태 없음).
 * top-level park(중첩 깊이 0)는 컬럼이 NULL.
 *
 * spec: 5-system/4-execution-engine.md §6.2/§7.5/§Rationale(D6), 1-data-model.md §2.13.
 */
export interface ResumeCallStackFrame {
  /**
   * 호출된 sub-workflow 정의의 ID. (`context.variables.__workflowId`(top-level 실행
   * 워크플로)와 레이어가 다르다 — 이건 executeInline 으로 진입한 하위 워크플로다.)
   */
  workflowId: string;
  /**
   * 이 sub-workflow 를 호출한 부모 그래프의 Workflow(sub-workflow) 노드 `Node.id`.
   * 재개 시 부모 그래프에서 이 노드까지 전진한 뒤 executeInline 재진입 키로 쓴다.
   */
  invokerNodeId: string;
  /**
   * 이 프레임 진입 시점의 `ExecutionContext.recursionDepth` (executeInline 가 증분).
   * 재개 시 프레임별 recursionDepth 복원에 쓴다. (동음의 `Execution`/`ExecutionContext`
   * 의 recursionDepth 와 같은 개념의 프레임-시점 스냅샷이다.)
   */
  recursionDepth: number;
}

/**
 * `Execution.resume_call_stack` 의 envelope. `version` 은
 * `CALL_STACK_SCHEMA_VERSION`(execution-engine.service.ts, `CHECKPOINT_SCHEMA_VERSION`
 * 과 **독립** 상수)으로 스탬프된다. frames 는 outermost(top-level 바로 아래) →
 * waiting inner 노드 직전까지 순서.
 */
export interface ResumeCallStack {
  version: number;
  frames: ResumeCallStackFrame[];
}
