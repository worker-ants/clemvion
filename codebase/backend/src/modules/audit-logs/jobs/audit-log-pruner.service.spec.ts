import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  AUDIT_LOG_PRUNER_QUEUE,
  AUDIT_LOG_RETENTION_DEFAULT_DAYS,
  AUDIT_LOG_RETENTION_MAX_DAYS,
  AUDIT_LOG_PRUNE_CRON,
  AuditLogPrunerService,
  resolveAuditLogRetentionDays,
} from './audit-log-pruner.service';
import { AuditLogsService } from '../audit-logs.service';

describe('resolveAuditLogRetentionDays', () => {
  it('값이 없으면 기본 365일을 쓰고 경고하지 않는다', () => {
    expect(resolveAuditLogRetentionDays(undefined)).toEqual({
      days: AUDIT_LOG_RETENTION_DEFAULT_DAYS,
      invalid: false,
    });
    expect(AUDIT_LOG_RETENTION_DEFAULT_DAYS).toBe(365);
  });

  it('빈 문자열 · 공백만 있는 값도 설정하지 않은 것으로 본다', () => {
    expect(resolveAuditLogRetentionDays('')).toEqual({
      days: 365,
      invalid: false,
    });
    expect(resolveAuditLogRetentionDays('  ')).toEqual({
      days: 365,
      invalid: false,
    });
  });

  it.each([
    ['30', 30],
    [' 730 ', 730],
    ['1', 1],
    [String(AUDIT_LOG_RETENTION_MAX_DAYS), AUDIT_LOG_RETENTION_MAX_DAYS],
  ])('양의 정수 %p 는 그대로 쓴다', (raw, days) => {
    expect(resolveAuditLogRetentionDays(raw)).toEqual({
      days,
      invalid: false,
    });
  });

  it.each([
    'abc',
    '0',
    '-5',
    '1.5',
    '1e3',
    '30d',
    '00',
    '99999999999999999999',
    '9007199254740991',
    String(AUDIT_LOG_RETENTION_MAX_DAYS + 1),
  ])(
    '양의 정수가 아니거나 상한을 넘는 %p 는 기본값으로 돌아가고 invalid 로 알린다',
    (raw) => {
      expect(resolveAuditLogRetentionDays(raw)).toEqual({
        days: 365,
        invalid: true,
      });
    },
  );
});

describe('AuditLogPrunerService', () => {
  const ORIGINAL_ENV = process.env.AUDIT_LOG_RETENTION_DAYS;
  let auditLogs: { pruneOlderThanRetention: jest.Mock };
  let queue: { upsertJobScheduler: jest.Mock };

  async function build(): Promise<AuditLogPrunerService> {
    auditLogs = { pruneOlderThanRetention: jest.fn() };
    queue = { upsertJobScheduler: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogPrunerService,
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: getQueueToken(AUDIT_LOG_PRUNER_QUEUE), useValue: queue },
      ],
    }).compile();
    return module.get(AuditLogPrunerService);
  }

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.AUDIT_LOG_RETENTION_DAYS;
    else process.env.AUDIT_LOG_RETENTION_DAYS = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('큐 이름은 audit-log-pruner 다', () => {
    expect(AUDIT_LOG_PRUNER_QUEUE).toBe('audit-log-pruner');
  });

  it('onModuleInit 이 매일 03:30 Asia/Seoul 반복 작업을 큐 이름에서 딴 ID 로 등록한다', async () => {
    const service = await build();

    await service.onModuleInit();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'audit-log-pruner-daily',
      { pattern: AUDIT_LOG_PRUNE_CRON, tz: 'Asia/Seoul' },
      expect.objectContaining({ name: expect.any(String) }),
    );
  });

  it('onModuleInit 은 반복 작업 등록 실패를 그대로 던진다(Redis 장애면 부팅을 멈춘다)', async () => {
    const service = await build();
    queue.upsertJobScheduler.mockRejectedValue(new Error('redis down'));

    await expect(service.onModuleInit()).rejects.toThrow('redis down');
  });

  it('process 는 환경 변수의 보존 일수로 prune 을 부른다', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '30';
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockResolvedValue(0);

    await service.process({} as never);

    expect(auditLogs.pruneOlderThanRetention).toHaveBeenCalledWith(30);
  });

  it('환경 변수가 없으면 365일로 prune 한다', async () => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockResolvedValue(0);

    await service.prune();

    expect(auditLogs.pruneOlderThanRetention).toHaveBeenCalledWith(365);
  });

  it('잘못된 환경 변수는 365일로 돌아가고 서비스를 만들 때 경고를 한 번 남긴다', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = 'abc';
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockResolvedValue(0);

    await service.prune();
    await service.prune();

    expect(auditLogs.pruneOlderThanRetention).toHaveBeenLastCalledWith(365);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('AUDIT_LOG_RETENTION_DAYS'),
    );
  });

  it('상한을 넘는 값은 365일로 돌아가고 경고에 상한을 적는다', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = String(
      AUDIT_LOG_RETENTION_MAX_DAYS + 1,
    );
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockResolvedValue(0);

    await service.prune();

    expect(auditLogs.pruneOlderThanRetention).toHaveBeenCalledWith(365);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`up to ${AUDIT_LOG_RETENTION_MAX_DAYS}`),
    );
  });

  it('지운 행이 없으면 로그를 남기지 않는다', async () => {
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockResolvedValue(0);
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.prune();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('지운 행 수를 로그에 남긴다', async () => {
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockResolvedValue(42);
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.prune();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
  });

  it('삭제 실패는 흡수하고 에러 로그를 남긴다', async () => {
    const service = await build();
    auditLogs.pruneOlderThanRetention.mockRejectedValue(new Error('db down'));
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(service.prune()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
