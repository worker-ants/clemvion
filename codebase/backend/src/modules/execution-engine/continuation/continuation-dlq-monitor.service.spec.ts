import type { Queue } from 'bullmq';
import { ContinuationDlqMonitorService } from './continuation-dlq-monitor.service';
import {
  loadContinuationDlqMonitorConfig,
  type ContinuationDlqMonitorConfig,
} from './continuation-dlq-monitor.config';

type MockQueue = { getJobCounts: jest.Mock };

const DEFAULT_CFG: ContinuationDlqMonitorConfig = {
  thresholdJobs: 50,
  intervalMs: 60_000,
  cooldownMs: 300_000,
  enabled: true,
};

function makeService(cfg: Partial<ContinuationDlqMonitorConfig> = {}): {
  service: ContinuationDlqMonitorService;
  queue: MockQueue;
} {
  const queue: MockQueue = { getJobCounts: jest.fn() };
  const service = new ContinuationDlqMonitorService(queue as unknown as Queue, {
    ...DEFAULT_CFG,
    ...cfg,
  });
  return { service, queue };
}

describe('loadContinuationDlqMonitorConfig (env 파싱)', () => {
  it('기본값 — threshold=50 interval=60000 cooldown=300000 enabled=true', () => {
    expect(loadContinuationDlqMonitorConfig({})).toEqual(DEFAULT_CFG);
  });

  it('env override 적용', () => {
    expect(
      loadContinuationDlqMonitorConfig({
        CONTINUATION_DLQ_ALARM_THRESHOLD: '5',
        CONTINUATION_DLQ_MONITOR_INTERVAL_MS: '1000',
        CONTINUATION_DLQ_ALARM_COOLDOWN_MS: '2000',
      }),
    ).toMatchObject({ thresholdJobs: 5, intervalMs: 1000, cooldownMs: 2000 });
  });

  it('비정상 입력(0 / 음수 / 비숫자 / 공학표기 1e10)은 기본값 fallback', () => {
    expect(
      loadContinuationDlqMonitorConfig({
        CONTINUATION_DLQ_ALARM_THRESHOLD: '0',
        CONTINUATION_DLQ_MONITOR_INTERVAL_MS: '-3',
        CONTINUATION_DLQ_ALARM_COOLDOWN_MS: 'abc',
      }),
    ).toMatchObject({
      thresholdJobs: 50,
      intervalMs: 60_000,
      cooldownMs: 300_000,
    });
    // 공학표기 1e10 도 차단 (review I-4)
    expect(
      loadContinuationDlqMonitorConfig({
        CONTINUATION_DLQ_ALARM_THRESHOLD: '1e10',
      }).thresholdJobs,
    ).toBe(50);
  });

  it('enabled — false/0/no/off (대소문자·공백 무관) 는 비활성 (review W-6)', () => {
    for (const v of ['false', 'FALSE', '0', 'no', 'OFF', ' false ']) {
      expect(
        loadContinuationDlqMonitorConfig({
          CONTINUATION_DLQ_MONITOR_ENABLED: v,
        }).enabled,
      ).toBe(false);
    }
    expect(
      loadContinuationDlqMonitorConfig({
        CONTINUATION_DLQ_MONITOR_ENABLED: 'true',
      }).enabled,
    ).toBe(true);
  });
});

describe('ContinuationDlqMonitorService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('checkOnce', () => {
    it('failed >= threshold 면 알람 발생 (alarmed=true) + error 로그', async () => {
      const { service, queue } = makeService({ thresholdJobs: 3 });
      queue.getJobCounts.mockResolvedValue({ failed: 5, delayed: 2 });
      const errSpy = jest
        .spyOn(
          (service as never as { logger: { error: jest.Mock } }).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      const result = await service.checkOnce(1_000);
      expect(result).toEqual({ failed: 5, delayed: 2, alarmed: true });
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DLQ ALARM]'),
      );
    });

    it('failed < threshold 면 알람 없음 (alarmed=false)', async () => {
      const { service, queue } = makeService({ thresholdJobs: 10 });
      queue.getJobCounts.mockResolvedValue({ failed: 2, delayed: 0 });
      expect((await service.checkOnce(1_000)).alarmed).toBe(false);
    });

    it('cooldown 내 재호출은 알람 억제, cooldown 경과 후 재발', async () => {
      const { service, queue } = makeService({
        thresholdJobs: 1,
        cooldownMs: 5000,
      });
      queue.getJobCounts.mockResolvedValue({ failed: 9, delayed: 0 });
      jest
        .spyOn(
          (service as never as { logger: { error: jest.Mock } }).logger,
          'error',
        )
        .mockImplementation(() => undefined);

      expect((await service.checkOnce(0)).alarmed).toBe(true); // 첫 알람
      expect((await service.checkOnce(4_000)).alarmed).toBe(false); // cooldown 내
      expect((await service.checkOnce(5_000)).alarmed).toBe(true); // cooldown 경과
    });

    it('getJobCounts 실패는 삼켜서 zeros 반환 (워커 비차단)', async () => {
      const { service, queue } = makeService();
      queue.getJobCounts.mockRejectedValue(new Error('redis down'));
      expect(await service.checkOnce(1_000)).toEqual({
        failed: 0,
        delayed: 0,
        alarmed: false,
      });
    });

    it('count 필드 누락 시 0 으로 간주', async () => {
      const { service, queue } = makeService({ thresholdJobs: 1 });
      queue.getJobCounts.mockResolvedValue({});
      expect(await service.checkOnce(1_000)).toEqual({
        failed: 0,
        delayed: 0,
        alarmed: false,
      });
    });

    it('in-flight 중복 호출은 skip (review W-10 race 가드)', async () => {
      const { service, queue } = makeService({ thresholdJobs: 1 });
      let release: (v: { failed: number; delayed: number }) => void = () => {};
      queue.getJobCounts.mockReturnValue(
        new Promise((res) => {
          release = res;
        }),
      );
      const first = service.checkOnce(1_000); // in-flight
      const second = await service.checkOnce(1_000); // 즉시 skip
      expect(second).toEqual({
        failed: 0,
        delayed: 0,
        alarmed: false,
        skipped: true,
      });
      release({ failed: 0, delayed: 0 });
      await first;
    });
  });

  describe('lifecycle', () => {
    it('onModuleInit 가 interval 타이머 등록 + unref, onModuleDestroy 가 해제', () => {
      const { service } = makeService({ intervalMs: 1000 });
      const unref = jest.fn();
      const setIntervalSpy = jest
        .spyOn(global, 'setInterval')
        .mockReturnValue({ unref } as unknown as NodeJS.Timeout);
      const clearIntervalSpy = jest
        .spyOn(global, 'clearInterval')
        .mockImplementation(() => undefined);

      service.onModuleInit();
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(unref).toHaveBeenCalledTimes(1); // review W-12
      service.onModuleDestroy();
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('enabled=false 면 타이머 미가동', () => {
      const { service } = makeService({ enabled: false });
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      service.onModuleInit();
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });
});
