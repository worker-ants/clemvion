import { SystemStatusService, QueueHandle } from './system-status.service';
import {
  MonitoredQueue,
  getFailedWindowMinutes,
  getFailedScanCap,
} from './system-status.constants';

type Counts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
};

/** getFailed mock 용 최소 Job 형태 (newest→oldest 순서로 전달). */
type FailedJobStub = { finishedOn?: number; timestamp?: number };

const HOUR = 60 * 60 * 1000;

/** 윈도우 안에 드는 실패 job N건 (finishedOn = 방금 전). */
function recentJobs(n: number): FailedJobStub[] {
  return Array.from({ length: n }, () => ({ finishedOn: Date.now() }));
}

/** 윈도우 밖(2시간 전) 실패 job N건. */
function oldJobs(n: number): FailedJobStub[] {
  return Array.from({ length: n }, () => ({
    finishedOn: Date.now() - 2 * HOUR,
  }));
}

function makeHandle(
  name: string,
  group: MonitoredQueue['group'],
  concurrency: number,
  counts: Partial<Counts>,
  opts: {
    isPaused?: boolean;
    throws?: boolean;
    /** 실패 집합 (newest→oldest). getFailed mock 이 이 배열을 슬라이스해 반환. */
    failedJobs?: FailedJobStub[];
  } = {},
): QueueHandle {
  const full: Counts = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    paused: 0,
    ...counts,
  };
  const failedJobs = opts.failedJobs ?? [];
  return {
    meta: { name, group, concurrency },
    queue: {
      getJobCounts: jest.fn(async () => {
        if (opts.throws) throw new Error('redis down');
        return full;
      }),
      isPaused: jest.fn(async () => {
        if (opts.throws) throw new Error('redis down');
        return opts.isPaused ?? false;
      }),
      getFailed: jest.fn(async (start = 0, end = -1) => {
        if (opts.throws) throw new Error('redis down');
        const last = end < 0 ? failedJobs.length - 1 : end;
        return failedJobs.slice(start, last + 1) as never;
      }),
    },
  };
}

describe('SystemStatusService.getOverview', () => {
  it('모든 큐 정상 — overall healthy, totalFailed/totalRecentFailed 0, 윈도우 기본 60', async () => {
    const handles = [
      makeHandle('background-execution', 'execution', 3, { active: 1 }),
      makeHandle('document-embedding', 'knowledge-base', 3, {}),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.overall).toBe('healthy');
    expect(res.totalFailed).toBe(0);
    expect(res.totalRecentFailed).toBe(0);
    expect(res.failedWindowMinutes).toBe(60);
    expect(res.queues).toHaveLength(2);
    expect(res.queues[0].recentFailed).toBe(0);
    expect(typeof res.generatedAt).toBe('string');
    expect(new Date(res.generatedAt).toISOString()).toBe(res.generatedAt);
  });

  it('utilization = active / concurrency (소수 2자리)', async () => {
    const handles = [
      makeHandle('background-execution', 'execution', 3, { active: 1 }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].utilization).toBeCloseTo(0.33, 2);
  });

  it('concurrency=0 이면 utilization 0 (0 division 방지)', async () => {
    const handles = [makeHandle('x', 'system', 0, { active: 5 })];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].utilization).toBe(0);
  });

  it('paused 큐 → health down, overall down', async () => {
    const handles = [
      makeHandle('a', 'execution', 1, { active: 1 }),
      makeHandle('b', 'system', 1, {}, { isPaused: true }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    const b = res.queues.find((q) => q.name === 'b')!;
    expect(b.isPaused).toBe(true);
    expect(b.health).toBe('down');
    expect(res.overall).toBe('down');
  });

  it('waiting>0 && active=0 → 워커 미가동 추정 down', async () => {
    const handles = [
      makeHandle('a', 'execution', 1, { waiting: 3, active: 0 }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].health).toBe('down');
  });

  it('recentFailed >= 임계(기본 1) → degraded, totalFailed 는 누적 합산 유지', async () => {
    const handles = [
      makeHandle(
        'a',
        'execution',
        2,
        { active: 1, failed: 2 },
        {
          failedJobs: recentJobs(2),
        },
      ),
      makeHandle(
        'b',
        'system',
        1,
        { active: 1, failed: 3 },
        {
          failedJobs: recentJobs(3),
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].health).toBe('degraded');
    expect(res.queues[0].recentFailed).toBe(2);
    expect(res.totalFailed).toBe(5); // 누적(보관 중) 합산
    expect(res.totalRecentFailed).toBe(5); // 최근 윈도우 합산
    expect(res.overall).toBe('degraded');
  });

  it('보관 중 누적 failed 는 있으나 최근 윈도우 실패 0 → healthy (영구 degraded 회귀 방지, R-5)', async () => {
    const handles = [
      // 보관된 실패 5건이 모두 윈도우 밖(2시간 전) → recentFailed 0
      makeHandle(
        'a',
        'execution',
        2,
        { active: 1, failed: 5 },
        {
          failedJobs: oldJobs(5),
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].recentFailed).toBe(0);
    expect(res.queues[0].health).toBe('healthy');
    expect(res.totalFailed).toBe(5);
    expect(res.totalRecentFailed).toBe(0);
    expect(res.overall).toBe('healthy');
  });

  it('윈도우 경계 — 최근 job 만 카운트하고 오래된 job 에서 스캔 중단', async () => {
    const handles = [
      makeHandle(
        'a',
        'execution',
        2,
        { active: 1, failed: 10 },
        {
          // newest→oldest: 최근 3건 + 오래된 7건
          failedJobs: [...recentJobs(3), ...oldJobs(7)],
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].recentFailed).toBe(3);
    expect(res.queues[0].health).toBe('degraded');
  });

  it('스캔 캡 도달 시 recentFailed 는 하한값 (캡=2)', async () => {
    const prev = process.env.SYSTEM_STATUS_FAILED_SCAN_CAP;
    process.env.SYSTEM_STATUS_FAILED_SCAN_CAP = '2';
    try {
      const handles = [
        makeHandle(
          'a',
          'execution',
          2,
          { active: 1, failed: 10 },
          {
            failedJobs: recentJobs(10), // 모두 최근이지만 캡 2 에서 멈춤
          },
        ),
      ];
      const service = new SystemStatusService(handles);

      const res = await service.getOverview();

      // 캡 2 까지만 스캔 → 하한값 2
      expect(res.queues[0].recentFailed).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.SYSTEM_STATUS_FAILED_SCAN_CAP;
      else process.env.SYSTEM_STATUS_FAILED_SCAN_CAP = prev;
    }
  });

  it('경계: 캡 == 실제 job 수 — scanned>=cap 분기로 정확히 종료(중복 카운트 없음)', async () => {
    const prev = process.env.SYSTEM_STATUS_FAILED_SCAN_CAP;
    process.env.SYSTEM_STATUS_FAILED_SCAN_CAP = '2';
    try {
      const handles = [
        // 캡(2) == 페이지 슬라이스 == 실제 job 수(2): jobs.length<limit 분기가 아니라
        // scanned>=scanCap 분기로 종료되어야 하며 정확히 2 를 반환한다.
        makeHandle(
          'a',
          'execution',
          2,
          { active: 1, failed: 2 },
          {
            failedJobs: recentJobs(2),
          },
        ),
      ];
      const service = new SystemStatusService(handles);

      const res = await service.getOverview();

      expect(res.queues[0].recentFailed).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.SYSTEM_STATUS_FAILED_SCAN_CAP;
      else process.env.SYSTEM_STATUS_FAILED_SCAN_CAP = prev;
    }
  });

  it('failed===0 이면 getFailed 스캔을 건너뛴다 (정상 상태 비용 제거)', async () => {
    const getFailed = jest.fn();
    const handle: QueueHandle = {
      meta: { name: 'a', group: 'execution', concurrency: 1 },
      queue: {
        getJobCounts: jest.fn(async () => ({
          waiting: 0,
          active: 1,
          delayed: 0,
          failed: 0,
          paused: 0,
        })),
        isPaused: jest.fn(async () => false),
        getFailed,
      },
    };
    const service = new SystemStatusService([handle]);

    const res = await service.getOverview();

    expect(res.queues[0].recentFailed).toBe(0);
    expect(getFailed).not.toHaveBeenCalled();
  });

  it('finishedOn 없으면 timestamp 로 대체, 둘 다 없으면 집계 제외', async () => {
    const handles = [
      makeHandle(
        'a',
        'execution',
        2,
        { active: 1, failed: 3 },
        {
          failedJobs: [
            { timestamp: Date.now() }, // finishedOn 없음 → timestamp(최근) 대체 → 카운트
            { timestamp: Date.now() - 2 * HOUR }, // timestamp(오래됨) → 미카운트 + 스캔 중단
          ],
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].recentFailed).toBe(1);
  });

  it('finishedOn·timestamp 둘 다 없는 job 은 건너뛰고 다음 job 계속 스캔', async () => {
    const handles = [
      makeHandle(
        'a',
        'execution',
        2,
        { active: 1, failed: 2 },
        {
          // 첫 job 은 판정 불가(건너뜀, 스캔 중단 아님) → 다음 최근 job 은 카운트
          failedJobs: [{}, { finishedOn: Date.now() }],
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].recentFailed).toBe(1);
  });

  it('윈도우 길이 env 조정 — SYSTEM_STATUS_FAILED_WINDOW_MINUTES 반영', async () => {
    const prev = process.env.SYSTEM_STATUS_FAILED_WINDOW_MINUTES;
    process.env.SYSTEM_STATUS_FAILED_WINDOW_MINUTES = '10';
    try {
      const handles = [makeHandle('a', 'execution', 1, { active: 1 })];
      const service = new SystemStatusService(handles);

      const res = await service.getOverview();

      expect(res.failedWindowMinutes).toBe(10);
    } finally {
      if (prev === undefined)
        delete process.env.SYSTEM_STATUS_FAILED_WINDOW_MINUTES;
      else process.env.SYSTEM_STATUS_FAILED_WINDOW_MINUTES = prev;
    }
  });

  it('delayed >= 임계(기본 50) → degraded', async () => {
    const handles = [
      makeHandle('a', 'execution', 1, { active: 1, delayed: 50 }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].health).toBe('degraded');
  });

  it('delayed 가 임계 미만이면 degraded 아님', async () => {
    const handles = [
      makeHandle('a', 'execution', 1, { active: 1, delayed: 49 }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].health).toBe('healthy');
  });

  it('단일 큐 조회 실패 → 그 큐만 down+0, 나머지는 정상 반환', async () => {
    const handles = [
      makeHandle('ok', 'execution', 1, { active: 1 }),
      makeHandle('broken', 'system', 1, {}, { throws: true }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    const broken = res.queues.find((q) => q.name === 'broken')!;
    expect(broken.health).toBe('down');
    expect(broken.recentFailed).toBe(0);
    expect(broken.counts).toEqual({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      paused: 0,
    });
    const ok = res.queues.find((q) => q.name === 'ok')!;
    expect(ok.health).toBe('healthy');
    expect(res.overall).toBe('down');
  });

  it('overall 은 최악값 (down > degraded > healthy)', async () => {
    const handles = [
      makeHandle('a', 'execution', 1, { active: 1 }), // healthy
      makeHandle(
        'b',
        'system',
        1,
        { active: 1, failed: 1 },
        {
          failedJobs: recentJobs(1),
        },
      ), // degraded
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.overall).toBe('degraded');
  });

  // I-8: 복합 조건 우선순위 테스트
  it('paused + recentFailed 초과 동시 → paused 우선 (down)', async () => {
    // isPaused rule 1 이 recentFailed rule 3 보다 먼저 평가된다
    const handles = [
      makeHandle(
        'a',
        'execution',
        1,
        { failed: 5 },
        {
          isPaused: true,
          failedJobs: recentJobs(5),
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].isPaused).toBe(true);
    expect(res.queues[0].health).toBe('down');
  });

  it('waiting>0, active=0, recentFailed>=임계 → waiting 우선 (down)', async () => {
    // 규칙 2(waiting>0 && active=0) 가 규칙 3(recentFailed>=임계) 보다 먼저 평가된다
    const handles = [
      makeHandle(
        'a',
        'execution',
        1,
        { waiting: 3, active: 0, failed: 2 },
        {
          failedJobs: recentJobs(2),
        },
      ),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    // down(rule2) — degraded(rule3) 보다 우선
    expect(res.queues[0].health).toBe('down');
  });

  // I-9: utilization 상한 테스트 (active > concurrency)
  it('active > concurrency 일 때 utilization 은 1.0 상한', async () => {
    const handles = [makeHandle('a', 'execution', 2, { active: 5 })];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].utilization).toBe(1);
  });
});

describe('failed window/scan-cap getter 가드', () => {
  it.each([
    ['SYSTEM_STATUS_FAILED_WINDOW_MINUTES', getFailedWindowMinutes, 60],
    ['SYSTEM_STATUS_FAILED_SCAN_CAP', getFailedScanCap, 1000],
  ])('%s: 빈/NaN/0 은 기본값, 음수는 1 로 클램프', (env, getter, dflt) => {
    const prev = process.env[env];
    try {
      delete process.env[env];
      expect(getter()).toBe(dflt); // 미설정 → 기본값

      process.env[env] = 'abc';
      expect(getter()).toBe(dflt); // NaN → 기본값

      process.env[env] = '0';
      expect(getter()).toBe(dflt); // 0 은 falsy → 기본값 (0 분/0 스캔은 무의미)

      process.env[env] = '-5';
      expect(getter()).toBe(1); // 음수 → Math.max 클램프 1

      process.env[env] = '30';
      expect(getter()).toBe(30); // 정상값 반영
    } finally {
      if (prev === undefined) delete process.env[env];
      else process.env[env] = prev;
    }
  });
});
