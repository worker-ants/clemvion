import type { Queue } from 'bullmq';
import { ExecutionRunDlqMonitorService } from './execution-run-dlq-monitor.service';
import {
  loadExecutionRunDlqMonitorConfig,
  type ExecutionRunDlqMonitorConfig,
} from './execution-run-dlq-monitor.config';

type MockQueue = { getJobCounts: jest.Mock };

const DEFAULT_CFG: ExecutionRunDlqMonitorConfig = {
  thresholdJobs: 20,
  intervalMs: 60_000,
  cooldownMs: 300_000,
  enabled: true,
};

function makeService(cfg: Partial<ExecutionRunDlqMonitorConfig> = {}): {
  service: ExecutionRunDlqMonitorService;
  queue: MockQueue;
} {
  const queue: MockQueue = { getJobCounts: jest.fn() };
  const service = new ExecutionRunDlqMonitorService(queue as unknown as Queue, {
    ...DEFAULT_CFG,
    ...cfg,
  });
  return { service, queue };
}

describe('loadExecutionRunDlqMonitorConfig (env 파싱)', () => {
  it('기본값 — threshold=20 interval=60000 cooldown=300000 enabled=true', () => {
    expect(loadExecutionRunDlqMonitorConfig({})).toEqual(DEFAULT_CFG);
  });

  it('env override 적용', () => {
    expect(
      loadExecutionRunDlqMonitorConfig({
        EXECUTION_RUN_DLQ_ALARM_THRESHOLD: '5',
        EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS: '1000',
        EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS: '2000',
      }),
    ).toEqual({
      thresholdJobs: 5,
      intervalMs: 1000,
      cooldownMs: 2000,
      enabled: true,
    });
  });

  it('비정상 입력(0 / 음수 / 비숫자 / 공학표기 1e10)은 기본값 fallback', () => {
    expect(
      loadExecutionRunDlqMonitorConfig({
        EXECUTION_RUN_DLQ_ALARM_THRESHOLD: '0',
        EXECUTION_RUN_DLQ_MONITOR_INTERVAL_MS: '-5',
        EXECUTION_RUN_DLQ_ALARM_COOLDOWN_MS: '1e10',
      }),
    ).toEqual(DEFAULT_CFG);
  });

  it('enabled — false/0/no/off (대소문자·공백 무관) 는 비활성', () => {
    for (const v of ['false', '0', 'no', 'off', ' OFF ', 'False']) {
      expect(
        loadExecutionRunDlqMonitorConfig({
          EXECUTION_RUN_DLQ_MONITOR_ENABLED: v,
        }).enabled,
      ).toBe(false);
    }
    expect(
      loadExecutionRunDlqMonitorConfig({
        EXECUTION_RUN_DLQ_MONITOR_ENABLED: 'true',
      }).enabled,
    ).toBe(true);
  });
});

describe('ExecutionRunDlqMonitorService', () => {
  describe('checkOnce', () => {
    it('failed >= threshold 면 알람 발생 (alarmed=true)', async () => {
      const { service, queue } = makeService({ thresholdJobs: 3 });
      queue.getJobCounts.mockResolvedValue({ failed: 5, delayed: 2 });
      const result = await service.checkOnce(1_000);
      expect(result).toEqual({ failed: 5, delayed: 2, alarmed: true });
    });

    it('failed < threshold 면 알람 없음', async () => {
      const { service, queue } = makeService({ thresholdJobs: 3 });
      queue.getJobCounts.mockResolvedValue({ failed: 2, delayed: 0 });
      expect((await service.checkOnce(1_000)).alarmed).toBe(false);
    });

    it('cooldown 내 재호출은 알람 억제, 경과 후 재발', async () => {
      const { service, queue } = makeService({
        thresholdJobs: 3,
        cooldownMs: 5_000,
      });
      queue.getJobCounts.mockResolvedValue({ failed: 9, delayed: 0 });
      expect((await service.checkOnce(0)).alarmed).toBe(true);
      expect((await service.checkOnce(4_000)).alarmed).toBe(false); // cooldown 내
      expect((await service.checkOnce(6_000)).alarmed).toBe(true); // 경과 후
    });

    it('조회 실패는 삼켜서 다음 tick 재시도 (알람 없음)', async () => {
      const { service, queue } = makeService();
      queue.getJobCounts.mockRejectedValue(new Error('redis down'));
      expect(await service.checkOnce(1_000)).toEqual({
        failed: 0,
        delayed: 0,
        alarmed: false,
      });
    });
  });
});
