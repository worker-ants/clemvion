import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  SSE_ELIGIBILITY_TIMEOUT_MS,
  SseStreamEligibilityService,
} from './sse-stream-eligibility.service';
import type { Execution } from '../executions/entities/execution.entity';
import type { ExecutionToken } from './entities/execution-token.entity';

describe('SseStreamEligibilityService', () => {
  let findOne: jest.Mock;
  let exists: jest.Mock;
  let service: SseStreamEligibilityService;
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    findOne = jest.fn();
    exists = jest.fn().mockResolvedValue(false);
    service = new SseStreamEligibilityService(
      { findOne } as unknown as Repository<Execution>,
      { exists } as unknown as Repository<ExecutionToken>,
    );
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    log.mockRestore();
  });

  it('트리거가 있는 실행은 실행 토큰을 보지 않고 열릴 수 있다', async () => {
    findOne.mockResolvedValue({ id: 'exec-1', triggerId: 'trg-1' });
    await expect(service.canOpenStream('exec-1')).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'exec-1' },
      select: { id: true, triggerId: true },
    });
    expect(exists).not.toHaveBeenCalled();
  });

  it('트리거가 없으면 실행 토큰 행이 있을 때만 열릴 수 있다', async () => {
    findOne.mockResolvedValue({ id: 'exec-1', triggerId: null });
    await expect(service.canOpenStream('exec-1')).resolves.toBe(false);
    expect(exists).toHaveBeenCalledWith({ where: { executionId: 'exec-1' } });

    exists.mockResolvedValue(true);
    await expect(service.canOpenStream('exec-1')).resolves.toBe(true);
  });

  it('실행 행이 아직 없으면 놓치지 않도록 열릴 수 있다고 본다', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.canOpenStream('exec-1')).resolves.toBe(true);
    expect(exists).not.toHaveBeenCalled();
  });

  it('조회가 실패하면 열릴 수 있다고 보고 경고는 복구될 때까지 한 번만 남긴다', async () => {
    findOne.mockRejectedValue(new Error('db down'));
    await expect(service.canOpenStream('exec-1')).resolves.toBe(true);
    await expect(service.canOpenStream('exec-2')).resolves.toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('db down');

    findOne.mockResolvedValue({ id: 'exec-3', triggerId: null });
    await expect(service.canOpenStream('exec-3')).resolves.toBe(false);
    expect(
      log.mock.calls.filter(([m]) => String(m).includes('복구')),
    ).toHaveLength(1);
  });

  it('조회가 2초를 넘기면 열릴 수 있다고 보고 경고를 남긴다', async () => {
    jest.useFakeTimers();
    try {
      findOne.mockReturnValue(new Promise(() => undefined));
      const decided = service.canOpenStream('exec-1');
      await jest.advanceTimersByTimeAsync(SSE_ELIGIBILITY_TIMEOUT_MS - 1);
      let settled = false;
      void decided.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(decided).resolves.toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('실행 토큰 조회가 실패해도 열릴 수 있다고 본다', async () => {
    findOne.mockResolvedValue({ id: 'exec-1', triggerId: null });
    exists.mockRejectedValue(new Error('db down'));
    await expect(service.canOpenStream('exec-1')).resolves.toBe(true);
  });
});
