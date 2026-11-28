import {
  installTxByAffected,
  installTxUpdateBuilders,
  makeUpdateQb,
  mockGuardedUpdateBuilder,
} from './update-query-builder.mock';

class Execution {}
class NodeExecution {}

const makeService = () => ({ dataSource: { transaction: jest.fn() } });

describe('makeUpdateQb', () => {
  it('기본은 affected 1 이고 raw 키가 없다', async () => {
    await expect(makeUpdateQb().execute()).resolves.toEqual({ affected: 1 });
  });

  it('raw 는 영향 행이 있을 때만 싣고 0행이면 빈 배열을 싣는다', async () => {
    const row = [{ id: 'a' }];
    await expect(
      makeUpdateQb({ affected: 1, raw: row }).execute(),
    ).resolves.toEqual({ affected: 1, raw: row });
    await expect(
      makeUpdateQb({ affected: 0, raw: row }).execute(),
    ).resolves.toEqual({ affected: 0, raw: [] });
  });

  it('execute 를 직접 주면 affected · raw 를 무시한다', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 7 });
    const qb = makeUpdateQb({ affected: 0, execute });
    await expect(qb.execute()).resolves.toEqual({ affected: 7 });
    expect(qb.execute).toBe(execute);
  });

  it('order 를 주면 execute 때 update 한 엔티티 이름을 넣는다', async () => {
    const order: string[] = [];
    const qb = makeUpdateQb({}, order);
    qb.update(Execution);
    await qb.execute();
    expect(order).toEqual(['Execution']);
  });

  it('onUpdate 를 주면 update 가 target 을 정한 뒤 그 qb 로 부른다', () => {
    const seen: string[] = [];
    const qb = makeUpdateQb({}, undefined, (q) => seen.push(q.target));
    qb.update(NodeExecution);
    expect(seen).toEqual(['NodeExecution']);
  });

  it('체인은 늘 qb 를 돌려주고 관찰 함수에 인자를 넘긴다', () => {
    const set = jest.fn();
    const qb = makeUpdateQb({ set });
    expect(qb.update(Execution).set({ a: 1 }).where('x').andWhere('y')).toBe(
      qb,
    );
    expect(set).toHaveBeenCalledWith({ a: 1 });
  });
});

describe('mockGuardedUpdateBuilder', () => {
  it('함수 옵션은 호출 번호(1부터)를 받아 qb 마다 다른 결과를 준다', async () => {
    const cqb = mockGuardedUpdateBuilder((n) => ({
      affected: n === 1 ? 1 : 0,
    }));
    await expect(cqb().execute()).resolves.toEqual({ affected: 1 });
    await expect(cqb().execute()).resolves.toEqual({ affected: 0 });
  });
});

describe('installTxUpdateBuilders', () => {
  it('Execution → NodeExecution 순으로 qb 를 주고 byEntity · order 를 채운다', async () => {
    const service = makeService();
    const b = installTxUpdateBuilders(service, {
      execution: { affected: 1 },
      nodeExecution: { affected: 2 },
    });
    expect(service.dataSource.transaction).toBe(b.tx);
    await b.tx(async (m: { createQueryBuilder: () => unknown }) => {
      const first = m.createQueryBuilder() as typeof b.execQb;
      const second = m.createQueryBuilder() as typeof b.nodeQb;
      expect(first).toBe(b.execQb);
      expect(second).toBe(b.nodeQb);
      await first.update(Execution).execute();
      await second.update(NodeExecution).execute();
    });
    expect(b.order).toEqual(['Execution', 'NodeExecution']);
    expect(b.byEntity.Execution).toBe(b.execQb);
    expect(b.byEntity.NodeExecution).toBe(b.nodeQb);
    expect(b.managerCqb).toHaveBeenCalledTimes(2);
  });

  it('트랜잭션을 다시 부르면 순서 카운터를 처음부터 센다', async () => {
    const b = installTxUpdateBuilders(makeService(), {
      execution: { affected: 1 },
    });
    const pick = () =>
      b.tx(async (m: { createQueryBuilder: () => unknown }) => [
        m.createQueryBuilder(),
        m.createQueryBuilder(),
      ]) as Promise<unknown[]>;
    await expect(pick()).resolves.toEqual([b.execQb, b.nodeQb]);
    await expect(pick()).resolves.toEqual([b.execQb, b.nodeQb]);
  });

  it('한 트랜잭션에서 qb 를 세 번째로 달라고 하면 원인을 적은 Error 를 던진다', async () => {
    const b = installTxUpdateBuilders(makeService(), {
      execution: { affected: 1 },
    });
    await expect(
      b.tx(async (m: { createQueryBuilder: () => unknown }) => {
        m.createQueryBuilder();
        m.createQueryBuilder();
        m.createQueryBuilder();
      }),
    ).rejects.toThrow(/준비한 qb 는 2개인데 createQueryBuilder\(\) 를 3번째로/);
    expect(b.managerCqb).toHaveBeenCalledTimes(3);
  });

  it('nodeExecution 을 생략하면 affected 1 이고 콜백이 던지면 tx 가 reject 한다', async () => {
    const b = installTxUpdateBuilders(makeService(), {
      execution: { affected: 1 },
    });
    await expect(b.nodeQb.execute()).resolves.toEqual({ affected: 1 });
    await expect(
      b.tx(() => Promise.reject(new Error('rollback'))),
    ).rejects.toThrow('rollback');
  });
});

describe('installTxByAffected', () => {
  it('테이블 이름으로 영향 행 수를 정하고 raw 를 두 테이블에 싣는다', async () => {
    const raw = [{ id: 'e', duration_ms: 1 }];
    const b = installTxByAffected(
      makeService(),
      { execution: 1, nodeExecution: 0 },
      raw,
    );
    await expect(b.execQb.execute()).resolves.toEqual({ affected: 1, raw });
    await expect(b.nodeQb.execute()).resolves.toEqual({
      affected: 0,
      raw: [],
    });
  });

  it('raw 를 생략하면 결과에 raw 키가 없다', async () => {
    const b = installTxByAffected(makeService(), {
      execution: 2,
      nodeExecution: 3,
    });
    await expect(b.execQb.execute()).resolves.toEqual({ affected: 2 });
    await expect(b.nodeQb.execute()).resolves.toEqual({ affected: 3 });
  });
});
