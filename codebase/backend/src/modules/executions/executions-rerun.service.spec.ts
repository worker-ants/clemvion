import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
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
  let nodeRepo: { findOne: jest.Mock; find: jest.Mock };
  let registry: { getComponent: jest.Mock };
  let audit: { record: jest.Mock };
  let workspaces: { getMemberRole: jest.Mock };

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
    nodeRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      // assertDryRunSupported 가 워크플로 노드를 조회 — 기본은 노드 없음(통과).
      find: jest.fn().mockResolvedValue([]),
    };
    registry = { getComponent: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    // RR-PL-06 — 대상 워크스페이스 role 조회. 기본은 editor(owner/admin 아님).
    workspaces = { getMemberRole: jest.fn().mockResolvedValue('editor') };
    service = new ExecutionsService(
      execRepo as never,
      {} as never,
      {} as never,
      nodeRepo as never,
      engine as never,
      registry as never,
      audit as never,
      workspaces as never,
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
    // 대상 워크스페이스에서 editor 인 사용자는 타인 실행을 re-run 할 수 없다 (IDOR 차단).
    workspaces.getMemberRole.mockResolvedValue('editor');
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
    // 권한 판정이 JWT role 이 아니라 대상 워크스페이스(ws-1) 멤버십을 조회했는지 확인.
    expect(workspaces.getMemberRole).toHaveBeenCalledWith('ws-1', 'user-1');
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('allows admin to re-run another user execution (no ForbiddenException)', async () => {
    const admin = { ...user, role: 'admin' };
    // 권한은 JWT role 이 아니라 대상 워크스페이스 멤버십 role 로 판정된다.
    workspaces.getMemberRole.mockResolvedValue('admin');
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
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'e1', dryRun: false },
    );
    expect(res.reRunOf).toBe('e1');
    expect(res.chainId).toBe('e1');
    expect(res.dryRun).toBe(false);
    // 감사 로그 기록 (spec §11).
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 're_run_initiated',
        resourceType: 'execution',
        resourceId: 'new-exec-id',
        details: expect.objectContaining({
          originalExecutionId: 'e1',
          dryRun: false,
          inputModified: false,
        }),
      }),
    );
  });

  it('dry-run pre-flight rejects when an integration node lacks supportsDryRun', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
      },
    ];
    // 워크플로에 integration 노드가 있고 supportsDryRun 미선언 → 거부.
    nodeRepo.find.mockResolvedValue([
      { id: 'n1', type: 'legacy_side_effect', category: 'integration' },
    ]);
    registry.getComponent.mockReturnValue({
      metadata: { supportsDryRun: undefined },
    });
    await expect(
      service.reRun('e1', 'ws-1', user, { dryRun: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('dry-run proceeds when all side-effect nodes support dry-run', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        inputData: {},
        chainId: null,
      },
    ];
    getRawOneQueue = [{ reRunOf: null }];
    nodeRepo.find.mockResolvedValue([
      { id: 'n1', type: 'http_request', category: 'integration' },
    ]);
    registry.getComponent.mockReturnValue({
      metadata: { supportsDryRun: true },
    });
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    const res = await service.reRun('e1', 'ws-1', user, { dryRun: true });
    expect(engine.execute).toHaveBeenCalledWith(
      'wf-1',
      {},
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'e1', dryRun: true },
    );
    expect(res.dryRun).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ dryRun: true }),
      }),
    );
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
      reRunOf: 'parent' as string | null,
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
      {
        executedBy: 'user-1',
        reRunOf: 'e1',
        chainId: 'root-id',
        dryRun: false,
      },
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
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'e1', dryRun: false },
    );
  });

  it('throws INVALID_INPUT when inputOverride fails trigger schema validation', async () => {
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
    // trigger node 에 required 파라미터 → 빈 override 는 missing_required 로 실패.
    nodeRepo.findOne.mockResolvedValue({
      config: {
        parameters: [{ name: 'orderId', type: 'string', required: true }],
      },
    });
    await expect(
      service.reRun('e1', 'ws-1', user, {
        useOriginalInput: false,
        inputOverride: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
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
      reRunOf: 'parent' as string | null,
    })).concat([{ reRunOf: null }]);
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    await expect(service.reRun('e1', 'ws-1', user, dto)).resolves.toBeDefined();
    expect(engine.execute).toHaveBeenCalled();
  });

  it('records inputModified=true when inputOverride differs from original parameters (W9)', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        inputData: {
          __triggerSource: 'manual',
          parameters: { orderId: 'old' },
        },
        chainId: null,
      },
    ];
    getRawOneQueue = [{ reRunOf: null }];
    // trigger schema 가 orderId 를 받아 override 가 resolveTriggerParameters 를
    // 통과 → executionInput.parameters = { orderId: 'new' } (원본과 다름).
    nodeRepo.findOne.mockResolvedValue({
      config: {
        parameters: [{ name: 'orderId', type: 'string', required: true }],
      },
    });
    jest
      .spyOn(service, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    await service.reRun('e1', 'ws-1', user, {
      useOriginalInput: false,
      inputOverride: { orderId: 'new' },
    });
    expect(engine.execute).toHaveBeenCalledWith(
      'wf-1',
      { __triggerSource: 'manual', parameters: { orderId: 'new' } },
      { executedBy: 'user-1', reRunOf: 'e1', chainId: 'e1', dryRun: false },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ inputModified: true }),
      }),
    );
  });

  it('re-run still resolves when the audit repo save fails — record() swallows (W6/W7)', async () => {
    getOneQueue = [
      {
        id: 'e1',
        workflowId: 'wf-1',
        workflow: { workspaceId: 'ws-1' },
        executedBy: 'user-1',
        inputData: {},
        chainId: null,
      },
    ];
    getRawOneQueue = [{ reRunOf: null }];
    // 실제 AuditLogsService.record() 의 swallow 계약을 검증한다: 내부
    // repository.save() 가 reject 해도 record() 는 console.warn 후 resolve 하므로
    // `await auditLogsService.record(...)` 는 re-run 을 깨지 않는다. 그래서
    // mock 이 아니라 **진짜** AuditLogsService 를 주입하고 save 를 reject 시킨다.
    const auditRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const realAudit = new AuditLogsService(auditRepo as never);
    const saveSpy = jest.spyOn(realAudit, 'record');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const serviceWithRealAudit = new ExecutionsService(
      execRepo as never,
      {} as never,
      {} as never,
      nodeRepo as never,
      engine as never,
      registry as never,
      realAudit as never,
    );
    jest
      .spyOn(serviceWithRealAudit, 'findById')
      .mockResolvedValue({ id: 'new-exec-id' } as never);

    const res = await serviceWithRealAudit.reRun('e1', 'ws-1', user, dto);
    expect(engine.execute).toHaveBeenCalled();
    expect(res.reRunOf).toBe('e1');
    expect(saveSpy).toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalled();
    warnSpy.mockRestore();
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
