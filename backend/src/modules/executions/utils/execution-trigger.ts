export type ExecutionTriggerSource =
  | 'manual'
  | 'schedule'
  | 'webhook'
  | 'subworkflow'
  | 'unknown';

export interface ExecutionTriggerInfo {
  source: ExecutionTriggerSource;
  label: string | null;
}

/**
 * 헬퍼 입력 타입 — TypeORM Execution 엔티티는 nullable 컬럼도 non-null 타입으로 노출하므로
 * 별도 권한 좁힌 입력 타입을 둔다.
 */
type DerivableExecution = {
  triggerId?: string | null;
  executedBy?: string | null;
  parentExecutionId?: string | null;
  trigger?: { type: string; name?: string | null } | null;
  executor?: { name?: string | null; email?: string | null } | null;
};

/**
 * 우선순위: subworkflow > manual > schedule > webhook > unknown.
 * `subworkflow` 라벨은 호출자가 부모 실행의 workflow.name 을 별도 batch 로 조회해 전달.
 */
export function deriveExecutionTrigger(
  execution: DerivableExecution,
  parentWorkflowName?: string | null,
): ExecutionTriggerInfo {
  if (execution.parentExecutionId) {
    return { source: 'subworkflow', label: parentWorkflowName ?? null };
  }
  if (execution.executedBy) {
    const executor = execution.executor;
    const label = executor?.name ?? executor?.email ?? null;
    return { source: 'manual', label };
  }
  if (execution.triggerId && execution.trigger) {
    if (execution.trigger.type === 'schedule') {
      return { source: 'schedule', label: execution.trigger.name ?? null };
    }
    if (execution.trigger.type === 'webhook') {
      return { source: 'webhook', label: execution.trigger.name ?? null };
    }
  }
  return { source: 'unknown', label: null };
}
