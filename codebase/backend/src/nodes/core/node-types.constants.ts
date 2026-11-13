/**
 * 잘 알려진 노드 타입 상수. 엔진 내부에서 metadata.kind 로 분기할 수 없는
 * 소수의 노드별 특수 처리 (e.g. template root-spread, manual_trigger
 * pass-through) 에서 사용한다 — WARN #26 (Maintainability).
 *
 * 일반 dispatch 는 `NodeHandlerRegistry.getMetadata(type).kind` 를 사용하므로
 * 본 상수는 추가하지 않는 것을 우선한다.
 */
export const NODE_TYPES = {
  /** Manual trigger — 워크플로우의 사용자 수동 진입점. */
  MANUAL_TRIGGER: 'manual_trigger',
  /**
   * Template node — `executeNode` 에서 nodeInput 을 expression context 의
   * root-level 로 spread (`{{ name }}` 가 `{{ $input.name }}` 와 동등하게
   * 동작하도록). 본 동작은 template-only 특수 처리 — 다른 노드는 영향 없음.
   */
  TEMPLATE: 'template',
  /** 서브 워크플로우 노드. 재실행 dry-run 사전 검사가 자식 워크플로우를 따라갈 때 쓴다. */
  WORKFLOW: 'workflow',
  /** Background 노드. 부팅 복구 스캔이 Background 본문 행을 가려낼 때 쓴다. */
  BACKGROUND: 'background',
} as const;

/**
 * 서브 워크플로우 재귀 깊이 한도. `WorkflowHandler` · `ExecutionEngineService` 의 실행 때 검사와
 * `ExecutionsService` 의 dry-run 사전 검사가 같은 값을 쓴다.
 */
export const SUB_WORKFLOW_MAX_RECURSION_DEPTH = 10;

export type WellKnownNodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];
