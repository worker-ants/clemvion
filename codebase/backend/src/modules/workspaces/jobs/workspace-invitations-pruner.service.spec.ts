import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  WorkspaceInvitationsPrunerService,
  WORKSPACE_INVITATIONS_PRUNER_QUEUE,
} from './workspace-invitations-pruner.service';
import { WorkspaceInvitationsService } from '../workspace-invitations.service';

describe('WorkspaceInvitationsPrunerService', () => {
  let service: WorkspaceInvitationsPrunerService;
  let invitations: jest.Mocked<WorkspaceInvitationsService>;
  let queue: { upsertJobScheduler: jest.Mock; removeJobScheduler: jest.Mock };

  beforeEach(async () => {
    queue = {
      upsertJobScheduler: jest.fn(),
      removeJobScheduler: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceInvitationsPrunerService,
        {
          provide: WorkspaceInvitationsService,
          useValue: { pruneExpired: jest.fn() },
        },
        {
          provide: getQueueToken(WORKSPACE_INVITATIONS_PRUNER_QUEUE),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get(WorkspaceInvitationsPrunerService);
    invitations = module.get(WorkspaceInvitationsService);
  });

  it('onModuleInit 이 매일 04:00 Asia/Seoul repeatable scheduler 를 등록', async () => {
    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'workspace-invitations-pruner-daily',
      expect.objectContaining({ pattern: '0 4 * * *', tz: 'Asia/Seoul' }),
      expect.objectContaining({
        name: expect.any(String),
        // 완료/실패 잡이 Redis 에 무기한 누적되지 않도록 retention 설정을 회귀 가드.
        opts: expect.objectContaining({
          removeOnComplete: expect.objectContaining({
            age: expect.any(Number),
          }),
          removeOnFail: expect.objectContaining({ age: expect.any(Number) }),
        }),
      }),
    );
  });

  it('onModuleInit 은 scheduler 등록 실패를 전파 — Redis 장애 시 fail-fast (부팅 거부)', async () => {
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));

    await expect(service.onModuleInit()).rejects.toThrow('redis down');
  });

  it('process 는 prune 으로 위임하며 현재 시각으로 pruneExpired 호출', async () => {
    invitations.pruneExpired.mockResolvedValue(0);

    await service.process({} as never);

    expect(invitations.pruneExpired).toHaveBeenCalledTimes(1);
    expect(invitations.pruneExpired).toHaveBeenCalledWith(expect.any(Date));
  });

  it('0건 삭제 시 로그 없음', async () => {
    invitations.pruneExpired.mockResolvedValue(0);
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.prune();

    expect(invitations.pruneExpired).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('삭제된 row 가 있으면 건수를 info 로그', async () => {
    invitations.pruneExpired.mockResolvedValue(7);
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.prune();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('7'));
  });

  it('에러를 swallow + 로그 — 스케줄 잡이 프로세스를 죽이지 않음', async () => {
    invitations.pruneExpired.mockRejectedValue(new Error('db down'));
    const errSpy = jest.spyOn((service as any).logger, 'error');

    await expect(service.prune()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
