import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

/**
 * decision F2 — Re-run 서비스 검증 경로 + happy path 단위 테스트.
 */
describe('ExecutionsService — reRun (decision F2)', () => {
  let service: ExecutionsService;
  let execRepo: {
    createQueryBuilder: jest.Mock;
  };
  let engine: { execute: jest.Mock };
  let nodeRepo: { findOne: jest.Mock };

  // createQueryBuilder 는 호출마다 새 chainable qb 를 반환. getOne/getRawOne/
  // getMany 결과는 큐에서 순서대로 소비.
  let getOneQueue: unknown[];
  let getRawOneQueue: unknown[];
  let getManyQueue: unknown[][];

  function makeQb() {
    const qb: Record<string, unknown> = {};
    for (const m of [
      'leftJoinAndSelect',
      'leftJoin',
      'select',
      'where',
      'andWhere',
      'orderBy',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getOne = jest.fn(() => Promise.resolve(getOneQueue.shift() ?? null));
    qb.getRawOne = jest.fn(() =>
      Promise.resolve(getRawOneQueue.shift() ?? null),
    );
    qb.getMany = jest.fn(() => Promise.resolve(getManyQueue.shift() ?? []));
    return qb;
  }

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'u@e.com',
    workspaceId: 'ws-1',
    role: 'editor',
  };

  beforeEach(() => {
    getOneQueue = [];
    getRawOneQueue = [];
    getManyQueue = [];
    execRepo = { createQueryBuilder: jest.fn(() => makeQb()) };
    engine = { execute: jest.fn().mockResolvedValue('new-exec-id') };
    nodeRepo = { findOne: jest.fn().mockResolvedValue(null) };
    service = new ExecutionsService(
      execRepo as never,
      {} as never,
      {} as never,
      nodeRepo as never,
      engine as never,
    );
  });

  const dto = { useOriginalInput: true };

  it('throws RERUN_EXECUTION_NOT_FOUND for another workspace', async () => {
    getOneQueue = [
      { id: 'e1', workflow: { workspaceId: 'OTHER' }, executedBy: 'user-1' },
    ];
    await expect(service.reRun('e1', 'ws-1', user, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('throws RERUN_PERMISSION_DENIED for another user execution (non owner/admin)', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'someone-else',
      },
    ];
    await expect(service.reRun('e1', 'ws-1', user, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('allows admin to re-run another user execution (no ForbiddenException)', async () => {
    const admin = { ...user, role: 'admin' };
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'someone-else',
        inputData: {},
        chainId: null,
      },
    ];
    getRawOneQueue = [{ reRunOf: null }]; // depth = 1
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    const res = await service.reRun('e1', 'ws-1', admin, dto);
    expect(engine.execute).toHaveBeenCalledWith(
      'wf-1',
      {},
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'e1' },
    );
    expect(res.reRunOf).toBe('e1');
    expect(res.chainId).toBe('e1');
    expect(res.dryRun).toBe(false);
  });

  it('rejects dry-run with RERUN_DRY_RUN_NOT_APPLICABLE (v1 gate)', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
      },
    ];
    await expect(
      service.reRun('e1', 'ws-1', user, { dryRun: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('rejects when chain depth limit (32) is exceeded', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        chainId: 'root',
      },
    ];
    // computeChainDepth walks re_run_of — feed 31 parents (→ depth 32).
    getRawOneQueue = Array.from({ length: 31 }, () => ({
      reRunOf: 'parent',
    })).concat([{ reRunOf: null }]);
    await expect(service.reRun('e1', 'ws-1', user, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('uses original inputData and computes chainId from original.chainId', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        inputData: { __triggerSource: 'manual', parameters: { a: 1 } },
        chainId: 'root-id',
      },
    ];
    getRawOneQueue = [{ reRunOf: null }];
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    const res = await service.reRun('e1', 'ws-1', user, dto);
    expect(engine.execute).toHaveBeenCalledWith(
      'wf-1',
      { __triggerSource: 'manual', parameters: { a: 1 } },
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'root-id' },
    );
    expect(res.chainId).toBe('root-id');
  });

  it('uses inputOverride path when useOriginalInput=false (no trigger schema → {})', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        chainId: null,
      },
    ];
    getRawOneQueue = [{ reRunOf: null }];
    nodeRepo.findOne.mockResolvedValue(null); // no trigger node → schema undefined → {}
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    await service.reRun('e1', 'ws-1', user, {
      useOriginalInput: false,
      inputOverride: { x: 1 },
    });
    expect(engine.execute).toHaveBeenCalledWith(
      'wf-1',
      { __triggerSource: 'manual', parameters: {} },
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'e1' },
    );
  });

  it('allows chain depth 31 (boundary — not exceeded)', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        inputData: {},
        chainId: 'root',
      },
    ];
    // 30 parents → depth 31 (< 32, 통과).
    getRawOneQueue = Array.from({ length: 30 }, () => ({
      reRunOf: 'parent',
    })).concat([{ reRunOf: null }]);
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    await expect(service.reRun('e1', 'ws-1', user, dto)).resolves.toBeDefined();
    expect(engine.execute).toHaveBeenCalled();
  });

  describe('getChain', () => {
    it('returns chain rows for root id', async () => {
      getOneQueue = [
        {
          id: 'e2',
          workflow: { workspaceId: 'ws-1' },
          chainId: 'root',
          executedBy: 'user-1',
        },
      ];
      getManyQueue = [[{ id: 'root' }, { id: 'e2' }]];
      const rows = await service.getChain('e2', 'ws-1', user);
      expect(rows).toHaveLength(2);
    });

    it('handles chainId=null (root execution) via rootId = exec.id', async () => {
      getOneQueue = [
        {
          id: 'e-root',
          workflow: { workspaceId: 'ws-1' },
          chainId: null,
          executedBy: 'user-1',
        },
      ];
      getManyQueue = [[{ id: 'e-root' }]];
      const rows = await service.getChain('e-root', 'ws-1', user);
      expect(rows).toHaveLength(1);
    });

    it('throws RERUN_PERMISSION_DENIED for another user (non owner/admin)', async () => {
      getOneQueue = [
        {
          id: 'e2',
          workflow: { workspaceId: 'ws-1' },
          chainId: null,
          executedBy: 'someone-else',
        },
      ];
      await expect(service.getChain('e2', 'ws-1', user)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws RERUN_EXECUTION_NOT_FOUND for another workspace', async () => {
      getOneQueue = [
        { id: 'e2', workflow: { workspaceId: 'OTHER' }, chainId: null },
      ];
      await expect(service.getChain('e2', 'ws-1', user)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
