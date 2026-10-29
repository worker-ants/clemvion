import {
  type SqlRunner,
  filterExecutionUsableIntegrations,
} from './personal-integration-use-facts';

/*
 * 실행 시점 판정으로 통합을 거르는 헬퍼(예산 계산이 쓴다). 판정 자체는 personal-integration-use.spec.ts 가 보고,
 * 여기서는 조직 통합의 통과, 소유자 멤버십 쿼리를 한 번만 보내는 것, 작성자를 모를 때의 결과를 본다.
 */
const WORKSPACE = '00000000-0000-4000-8000-000000000001';
const AUTHOR = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000b2';

const org = { id: 'org', scope: 'organization', createdBy: OTHER };
const mine = { id: 'mine', scope: 'personal', createdBy: AUTHOR };
const others = { id: 'others', scope: 'personal', createdBy: OTHER };

function runner(memberIds: string[]) {
  const query = jest.fn(async () => memberIds.map((user_id) => ({ user_id })));
  return { query } as unknown as SqlRunner & { query: typeof query };
}

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describe('filterExecutionUsableIntegrations', () => {
  it('개인 통합이 없으면 쿼리 없이 모두 남긴다', async () => {
    const r = runner([]);
    const out = await filterExecutionUsableIntegrations(
      r,
      { workspaceId: WORKSPACE, workflowAuthorId: AUTHOR },
      [org],
    );
    expect(ids(out)).toEqual(['org']);
    expect(r.query).not.toHaveBeenCalled();
  });

  it('작성자가 소유자이고 멤버인 개인 통합은 남기고 남의 개인 통합은 뺀다', async () => {
    const r = runner([AUTHOR, OTHER]);
    const out = await filterExecutionUsableIntegrations(
      r,
      { workspaceId: WORKSPACE, workflowAuthorId: AUTHOR },
      [org, mine, others],
    );
    expect(ids(out)).toEqual(['org', 'mine']);
    expect(r.query).toHaveBeenCalledTimes(1);
  });

  it('소유자가 워크스페이스 멤버가 아니면 뺀다', async () => {
    const r = runner([]);
    const out = await filterExecutionUsableIntegrations(
      r,
      { workspaceId: WORKSPACE, workflowAuthorId: AUTHOR },
      [org, mine],
    );
    expect(ids(out)).toEqual(['org']);
  });

  it('작성자를 모르면 조직 통합만 남긴다', async () => {
    const r = runner([AUTHOR]);
    const out = await filterExecutionUsableIntegrations(
      r,
      { workspaceId: WORKSPACE, workflowAuthorId: null },
      [org, mine],
    );
    expect(ids(out)).toEqual(['org']);
  });
});
