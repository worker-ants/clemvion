import { loadParentWorkflowNames } from './load-parent-workflow-names';
import { Execution } from '../entities/execution.entity';

type ParentRawRow = { parent_id: string; workflow_name: string | null };

const buildQB = (rows: ParentRawRow[]) => {
  const qb: Record<string, jest.Mock> = {};
  qb.innerJoin = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return qb;
};

describe('loadParentWorkflowNames', () => {
  let repo: { createQueryBuilder: jest.Mock };

  beforeEach(() => {
    repo = { createQueryBuilder: jest.fn() };
  });

  const exec = (parentExecutionId: string | null) =>
    ({ parentExecutionId }) as Pick<Execution, 'parentExecutionId'>;

  it('returns empty map and skips DB query when no parents present', async () => {
    const result = await loadParentWorkflowNames(repo as never, [
      exec(null),
      exec(null),
    ]);

    expect(result.size).toBe(0);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('issues a single batch query with deduplicated parent IDs', async () => {
    const qb = buildQB([
      { parent_id: 'p1', workflow_name: 'Parent A' },
      { parent_id: 'p2', workflow_name: 'Parent B' },
    ]);
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await loadParentWorkflowNames(repo as never, [
      exec('p1'),
      exec('p2'),
      exec('p1'),
      exec(null),
    ]);

    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qb.where).toHaveBeenCalledWith(
      'pe.id IN (:...ids)',
      expect.objectContaining({ ids: expect.arrayContaining(['p1', 'p2']) }),
    );
    // 중복 제거 — set 기반이므로 2 개만 IN 절에 들어가야 한다.
    const idsArg = qb.where.mock.calls[0][1].ids as string[];
    expect(idsArg).toHaveLength(2);

    expect(result.get('p1')).toBe('Parent A');
    expect(result.get('p2')).toBe('Parent B');
  });

  it('omits keys for parents that are not found (already deleted, etc.)', async () => {
    const qb = buildQB([{ parent_id: 'p1', workflow_name: 'Parent A' }]);
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await loadParentWorkflowNames(repo as never, [
      exec('p1'),
      exec('p2-missing'),
    ]);

    expect(result.get('p1')).toBe('Parent A');
    // p2-missing 키는 등록되지 않아야 한다 — 호출 측은 Map.get(undefined) 으로
    // 자연스럽게 null 처리한다.
    expect(result.has('p2-missing')).toBe(false);
  });

  it('coerces null workflow_name to null entry', async () => {
    const qb = buildQB([{ parent_id: 'p1', workflow_name: null }]);
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await loadParentWorkflowNames(repo as never, [exec('p1')]);
    expect(result.get('p1')).toBeNull();
  });
});
