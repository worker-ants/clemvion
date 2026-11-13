import { describe, it, expect, jest } from '@jest/globals';
import type { FindOperator, Repository } from 'typeorm';
import type { Integration } from './entities/integration.entity';
import {
  findAllCafe24RowsForMall,
  hasReleasedStoreSlot,
} from './cafe24-store-rows';

type Where = Record<string, unknown>;

const row = (overrides: Partial<Integration>): Integration =>
  ({
    id: 'int-1',
    status: 'connected',
    statusReason: null,
    mallId: null,
    credentials: null,
    ...overrides,
  }) as unknown as Integration;

/** 두 `find` 호출(컬럼 경로, legacy 경로)을 나눠 받는 저장소 mock. */
const repoOf = (direct: Integration[], legacy: Integration[]) => {
  const find =
    jest.fn<(options: { where: Where | Where[] }) => Promise<Integration[]>>();
  find.mockResolvedValueOnce(direct).mockResolvedValueOnce(legacy);
  return { repo: { find } as unknown as Repository<Integration>, find };
};

describe('hasReleasedStoreSlot', () => {
  it.each([
    ['expired', 'install_timeout', true],
    ['expired', null, false],
    ['expired', 'token_expired', false],
    ['connected', 'install_timeout', false],
    ['connected', null, false],
    ['pending_install', null, false],
  ])('%s + %s → %s', (status, statusReason, expected) => {
    expect(
      hasReleasedStoreSlot({ status, statusReason } as Pick<
        Integration,
        'status' | 'statusReason'
      >),
    ).toBe(expected);
  });
});

describe('findAllCafe24RowsForMall', () => {
  it('컬럼 경로는 mall_id 로, legacy 경로는 mall_id NULL 과 만료 행 제외 두 갈래로 조회한다', async () => {
    const { repo, find } = repoOf([], []);
    await findAllCafe24RowsForMall(repo, 'ws-1', 'mall-a');

    const [direct, legacy] = find.mock.calls.map((c) => c[0].where);
    expect(direct).toEqual({
      workspaceId: 'ws-1',
      serviceType: 'cafe24',
      mallId: 'mall-a',
    });
    const branches = legacy as Where[];
    expect(Array.isArray(branches)).toBe(true);
    expect(branches).toHaveLength(2);
    const op = (value: unknown) => value as FindOperator<unknown>;
    // 갈래 1: status <> 'expired'
    expect(op(branches[0].status).type).toBe('not');
    expect(op(branches[0].status).value).toBe('expired');
    expect(branches[0]).not.toHaveProperty('statusReason');
    // 갈래 2: expired 이면서 사유가 NULL 이거나 install_timeout 이 아님
    expect(branches[1].status).toBe('expired');
    expect(op(branches[1].statusReason).type).toBe('or');
    for (const branch of branches) {
      expect(branch).toMatchObject({
        workspaceId: 'ws-1',
        serviceType: 'cafe24',
      });
      expect(op(branch.mallId).type).toBe('isNull');
    }
  });

  it('legacy 행은 credentials.mall_id 가 맞는 것만 남긴다', async () => {
    const hit = row({ id: 'hit', credentials: { mall_id: 'mall-a' } });
    const other = row({ id: 'other', credentials: { mall_id: 'mall-b' } });
    const { repo } = repoOf([], [hit, other]);
    const found = await findAllCafe24RowsForMall(repo, 'ws-1', 'mall-a');
    expect(found.map((r) => r.id)).toEqual(['hit']);
  });

  it('credentials 가 null 인 legacy 행은 오류 없이 빠진다', async () => {
    const { repo } = repoOf([], [row({ id: 'nocred', credentials: null })]);
    await expect(
      findAllCafe24RowsForMall(repo, 'ws-1', 'mall-a'),
    ).resolves.toEqual([]);
  });

  it('사유가 NULL 인 expired legacy 행과 다른 사유의 expired 행은 유지한다', async () => {
    const creds = { mall_id: 'mall-a' };
    const nullReason = row({
      id: 'null-reason',
      status: 'expired',
      statusReason: null,
      credentials: creds,
    });
    const otherReason = row({
      id: 'other-reason',
      status: 'expired',
      statusReason: 'token_expired',
      credentials: creds,
    });
    const { repo } = repoOf([], [nullReason, otherReason]);
    const found = await findAllCafe24RowsForMall(repo, 'ws-1', 'mall-a');
    expect(found.map((r) => r.id)).toEqual(['null-reason', 'other-reason']);
  });

  it('install_timeout 만료 행은 사후 필터에서도 빠진다(SQL 을 지나친 경우의 방어선)', async () => {
    const released = row({
      id: 'released',
      status: 'expired',
      statusReason: 'install_timeout',
      mallId: 'mall-a',
      credentials: { mall_id: 'mall-a' },
    });
    const kept = row({ id: 'kept', mallId: 'mall-a' });
    const { repo } = repoOf([released, kept], [released]);
    const found = await findAllCafe24RowsForMall(repo, 'ws-1', 'mall-a');
    expect(found.map((r) => r.id)).toEqual(['kept']);
  });
});
