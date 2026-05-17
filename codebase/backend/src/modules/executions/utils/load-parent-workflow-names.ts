import { Repository } from 'typeorm';
import { Execution } from '../entities/execution.entity';

/**
 * 한 페이지의 Execution 목록에서 서브워크플로우 실행이 있을 경우, 부모 실행의
 * `workflow.name` 을 한 번의 IN 쿼리로 일괄 로드한다.
 *
 * - 부모 실행의 두 컬럼(`pe.id`, `wf.name`) 만 SELECT 해 N+1 과 over-fetch 를 동시에 방지한다.
 * - 부모를 못 찾은 경우(이미 삭제 등)는 Map 에 등록되지 않아, 호출 측 `Map.get` 이
 *   `undefined` 를 반환하면 자연스럽게 null 처리하면 된다.
 */
export async function loadParentWorkflowNames(
  repo: Repository<Execution>,
  executions: Pick<Execution, 'parentExecutionId'>[],
): Promise<Map<string, string | null>> {
  const parentIds = Array.from(
    new Set(
      executions
        .map((e) => e.parentExecutionId)
        .filter((v): v is string => !!v),
    ),
  );
  const map = new Map<string, string | null>();
  if (parentIds.length === 0) return map;

  const rows = await repo
    .createQueryBuilder('pe')
    .innerJoin('pe.workflow', 'wf')
    .select(['pe.id AS parent_id', 'wf.name AS workflow_name'])
    .where('pe.id IN (:...ids)', { ids: parentIds })
    .getRawMany<{ parent_id: string; workflow_name: string | null }>();

  for (const r of rows) {
    map.set(r.parent_id, r.workflow_name ?? null);
  }
  return map;
}
