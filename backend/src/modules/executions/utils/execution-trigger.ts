/**
 * 실행 출처(Trigger Source) 분류 헬퍼.
 *
 * Source-of-truth: `EXECUTION_TRIGGER_SOURCES` 배열을 단일 정의로 두고, DTO/타입 등 다른
 * 모든 사용처는 이 배열에서 파생한다. 새 출처 추가 시 이 한 곳만 수정하면 된다.
 *
 * 우선순위: subworkflow > manual > schedule > webhook > unknown.
 *
 * 보안 노트: `manual` 라벨은 `User.name` 만 사용한다. 이메일 등 PII 는 라벨에 노출하지 않는다.
 */

export const EXECUTION_TRIGGER_SOURCES = [
  'manual',
  'schedule',
  'webhook',
  'subworkflow',
  'unknown',
] as const;

export type ExecutionTriggerSource = (typeof EXECUTION_TRIGGER_SOURCES)[number];

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
  executor?: { name?: string | null } | null;
};

const trimToNull = (s: string | null | undefined): string | null => {
  if (s == null) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
};

export function deriveExecutionTrigger(
  execution: DerivableExecution,
  parentWorkflowName?: string | null,
): ExecutionTriggerInfo {
  if (execution.parentExecutionId) {
    return {
      source: 'subworkflow',
      label: trimToNull(parentWorkflowName ?? null),
    };
  }
  if (execution.executedBy) {
    return {
      source: 'manual',
      label: trimToNull(execution.executor?.name ?? null),
    };
  }
  if (execution.triggerId && execution.trigger) {
    if (execution.trigger.type === 'schedule') {
      return {
        source: 'schedule',
        label: trimToNull(execution.trigger.name ?? null),
      };
    }
    if (execution.trigger.type === 'webhook') {
      return {
        source: 'webhook',
        label: trimToNull(execution.trigger.name ?? null),
      };
    }
  }
  return { source: 'unknown', label: null };
}
