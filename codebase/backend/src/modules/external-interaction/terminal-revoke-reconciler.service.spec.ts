import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  TerminalRevokeReconcilerService,
  TERMINAL_REVOKE_RECONCILE_QUEUE,
} from './terminal-revoke-reconciler.service';
import { InteractionTokenService } from './interaction-token.service';

describe('TerminalRevokeReconcilerService [Spec EIA §3.4 EIA-RL-06 / R15]', () => {
  let service: TerminalRevokeReconcilerService;
  let tokenService: jest.Mocked<
    Pick<InteractionTokenService, 'reconcileTerminalRevocations'>
  >;
  let queue: { upsertJobScheduler: jest.Mock };

  beforeEach(async () => {
    queue = { upsertJobScheduler: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerminalRevokeReconcilerService,
        {
          provide: InteractionTokenService,
          useValue: { reconcileTerminalRevocations: jest.fn() },
        },
        {
          provide: getQueueToken(TERMINAL_REVOKE_RECONCILE_QUEUE),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get(TerminalRevokeReconcilerService);
    tokenService = module.get(InteractionTokenService);
  });

  it('onModuleInit 이 분 단위 repeatable scheduler 를 등록 (멀티 인스턴스 전역 1회)', async () => {
    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      `${TERMINAL_REVOKE_RECONCILE_QUEUE}-every-minute`,
      expect.objectContaining({ pattern: '* * * * *' }),
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('onModuleInit 은 scheduler 등록 실패를 전파 — Redis 장애 시 fail-fast (부팅 거부)', async () => {
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));
    await expect(service.onModuleInit()).rejects.toThrow('redis down');
  });

  it('process 는 reconcileTerminalRevocations 로 위임', async () => {
    tokenService.reconcileTerminalRevocations.mockResolvedValue({
      swept: 0,
      revoked: 0,
    });

    await service.process({} as never);

    expect(tokenService.reconcileTerminalRevocations).toHaveBeenCalledTimes(1);
  });

  it('reconcile 실패는 swallow — 다음 tick 재시도 (fail-open, throw 안 함)', async () => {
    tokenService.reconcileTerminalRevocations.mockRejectedValue(
      new Error('sweep blew up'),
    );

    await expect(service.process({} as never)).resolves.toBeUndefined();
  });

  it('reconcile() 직접 호출 — 성공 시 token service 위임', async () => {
    tokenService.reconcileTerminalRevocations.mockResolvedValue({
      swept: 3,
      revoked: 5,
    });

    await expect(service.reconcile()).resolves.toBeUndefined();
    expect(tokenService.reconcileTerminalRevocations).toHaveBeenCalledTimes(1);
  });

  it('reconcile() 직접 호출 — throw 도 swallow (fail-open)', async () => {
    tokenService.reconcileTerminalRevocations.mockRejectedValue(
      new Error('boom'),
    );

    await expect(service.reconcile()).resolves.toBeUndefined();
  });
});
