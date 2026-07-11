import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { WebchatIdleReaperService } from './webchat-idle-reaper.service';
import { WEBCHAT_IDLE_REAPER_QUEUE } from './webchat-idle-reaper.types';
import { InteractionTokenService } from './interaction-token.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';

describe('WebchatIdleReaperService [Spec EIA §3.4 EIA-RL-07 / §R19]', () => {
  let service: WebchatIdleReaperService;
  let tokenService: jest.Mocked<
    Pick<
      InteractionTokenService,
      'findIdleWebchatExecutionIds' | 'revokeAllForExecution'
    >
  >;
  let engine: jest.Mocked<
    Pick<ExecutionEngineService, 'markWebchatIdleTimeout'>
  >;
  let queue: { upsertJobScheduler: jest.Mock };

  beforeEach(async () => {
    queue = { upsertJobScheduler: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebchatIdleReaperService,
        {
          provide: InteractionTokenService,
          useValue: {
            findIdleWebchatExecutionIds: jest.fn(),
            revokeAllForExecution: jest.fn(),
          },
        },
        {
          provide: ExecutionEngineService,
          useValue: { markWebchatIdleTimeout: jest.fn() },
        },
        { provide: getQueueToken(WEBCHAT_IDLE_REAPER_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(WebchatIdleReaperService);
    tokenService = module.get(InteractionTokenService);
    engine = module.get(ExecutionEngineService);
  });

  it('onModuleInit 이 분 단위 repeatable scheduler 를 등록 (멀티 인스턴스 전역 1회)', async () => {
    await service.onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      `${WEBCHAT_IDLE_REAPER_QUEUE}-every-minute`,
      expect.objectContaining({ pattern: '* * * * *' }),
      expect.objectContaining({
        name: expect.any(String),
        opts: expect.objectContaining({
          removeOnComplete: { age: 24 * 60 * 60 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        }),
      }),
    );
  });

  it('onModuleInit 은 scheduler 등록 실패를 전파 — Redis 장애 시 fail-fast (부팅 거부)', async () => {
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));
    await expect(service.onModuleInit()).rejects.toThrow('redis down');
  });

  it('process 는 reap 로 위임', async () => {
    tokenService.findIdleWebchatExecutionIds.mockResolvedValue([]);
    await service.process({} as never);
    expect(tokenService.findIdleWebchatExecutionIds).toHaveBeenCalledTimes(1);
  });

  it('reap: 대상 execution 을 engine cancel → 성공분만 토큰 revoke', async () => {
    tokenService.findIdleWebchatExecutionIds.mockResolvedValue(['e1', 'e2']);
    // e1 은 실제 cancel 전이(true), e2 는 이미 RUNNING/terminal(false).
    engine.markWebchatIdleTimeout.mockImplementation(async (id) => id === 'e1');
    tokenService.revokeAllForExecution.mockResolvedValue({ revoked: 1 });

    await service.reap();

    expect(engine.markWebchatIdleTimeout).toHaveBeenCalledWith('e1');
    expect(engine.markWebchatIdleTimeout).toHaveBeenCalledWith('e2');
    // cancel=true 인 e1 만 revoke, e2 는 skip.
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledTimes(1);
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('e1');
  });

  it('reap: 대상 0건이면 engine/revoke 미호출', async () => {
    tokenService.findIdleWebchatExecutionIds.mockResolvedValue([]);
    await service.reap();
    expect(engine.markWebchatIdleTimeout).not.toHaveBeenCalled();
    expect(tokenService.revokeAllForExecution).not.toHaveBeenCalled();
  });

  it('reap: 개별 execution 실패는 fail-open — 다른 건 계속 처리, throw 안 함', async () => {
    tokenService.findIdleWebchatExecutionIds.mockResolvedValue(['bad', 'good']);
    engine.markWebchatIdleTimeout.mockImplementation(async (id) => {
      if (id === 'bad') throw new Error('cancel blew up');
      return true;
    });
    tokenService.revokeAllForExecution.mockResolvedValue({ revoked: 1 });

    await expect(service.reap()).resolves.toBeUndefined();
    // good 은 정상 처리(revoke 됨).
    expect(tokenService.revokeAllForExecution).toHaveBeenCalledWith('good');
  });

  it('reap: 조회 자체가 실패해도 swallow (fail-open, 다음 tick 재시도)', async () => {
    tokenService.findIdleWebchatExecutionIds.mockRejectedValue(
      new Error('query blew up'),
    );
    await expect(service.reap()).resolves.toBeUndefined();
  });
});
