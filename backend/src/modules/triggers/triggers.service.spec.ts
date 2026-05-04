import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TriggersService } from './triggers.service';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';

describe('TriggersService.findOneDetail', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Schedule),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    scheduleRepo = moduleRef.get(getRepositoryToken(Schedule));
  });

  it('schedule 타입 + 매칭 schedule 존재 시 cron/timezone/nextRunAt을 평탄화하여 반환', async () => {
    const nextRunAt = new Date('2026-05-06T00:00:00Z');
    triggerRepo.findOne.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws',
      type: 'schedule',
      name: '매일 날씨 알림',
    } as unknown as Trigger);
    scheduleRepo.findOne.mockResolvedValue({
      id: 's1',
      triggerId: 't1',
      workspaceId: 'ws',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Seoul',
      nextRunAt,
    } as unknown as Schedule);

    const result = await service.findOneDetail('t1', 'ws');

    expect(scheduleRepo.findOne).toHaveBeenCalledWith({
      where: { triggerId: 't1', workspaceId: 'ws' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 't1',
        type: 'schedule',
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        nextRunAt,
      }),
    );
  });

  it('schedule 타입인데 매칭 schedule이 없으면 트리거를 그대로 반환 (cron 필드 없음)', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws',
      type: 'schedule',
      name: '매일 날씨 알림',
    } as unknown as Trigger);
    scheduleRepo.findOne.mockResolvedValue(null);

    const result = (await service.findOneDetail('t1', 'ws')) as Record<
      string,
      unknown
    >;

    expect(result.id).toBe('t1');
    expect(result.cronExpression).toBeUndefined();
    expect(result.timezone).toBeUndefined();
    expect(result.nextRunAt).toBeUndefined();
  });

  it('webhook 타입은 schedule 조회를 skip', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't2',
      workspaceId: 'ws',
      type: 'webhook',
      name: '웹훅',
    } as unknown as Trigger);

    const result = await service.findOneDetail('t2', 'ws');

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ id: 't2', type: 'webhook' }),
    );
  });

  it('manual 타입은 schedule 조회를 skip', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't3',
      workspaceId: 'ws',
      type: 'manual',
      name: '수동',
    } as unknown as Trigger);

    const result = await service.findOneDetail('t3', 'ws');

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ id: 't3', type: 'manual' }),
    );
  });

  it('트리거가 존재하지 않으면 RESOURCE_NOT_FOUND NotFoundException을 throw', async () => {
    triggerRepo.findOne.mockResolvedValue(null);

    await expect(service.findOneDetail('missing', 'ws')).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    await expect(service.findOneDetail('missing', 'ws')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
  });
});
