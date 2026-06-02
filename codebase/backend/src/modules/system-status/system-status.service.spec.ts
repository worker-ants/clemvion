import { SystemStatusService, QueueHandle } from './system-status.service';
import { MonitoredQueue } from './system-status.constants';

type Counts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
};

function makeHandle(
  name: string,
  group: MonitoredQueue['group'],
  concurrency: number,
  counts: Partial<Counts>,
  opts: { isPaused?: boolean; throws?: boolean } = {},
): QueueHandle {
  const full: Counts = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    paused: 0,
    ...counts,
  };
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
    },
  };
}

describe('SystemStatusService.getOverview', () => {
  it('모든 큐 정상 — overall healthy, totalFailed 0', async () => {
    const handles = [
      makeHandle('background-execution', 'execution', 3, { active: 1 }),
      makeHandle('document-embedding', 'knowledge-base', 3, {}),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.overall).toBe('healthy');
    expect(res.totalFailed).toBe(0);
    expect(res.queues).toHaveLength(2);
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

  it('failed >= 임계(기본 1) → degraded, totalFailed 합산', async () => {
    const handles = [
      makeHandle('a', 'execution', 2, { active: 1, failed: 2 }),
      makeHandle('b', 'system', 1, { active: 1, failed: 3 }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].health).toBe('degraded');
    expect(res.totalFailed).toBe(5);
    expect(res.overall).toBe('degraded');
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
      makeHandle('b', 'system', 1, { active: 1, failed: 1 }), // degraded
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.overall).toBe('degraded');
  });

  // I-8: 복합 조건 우선순위 테스트
  it('paused + failed 초과 동시 → paused 우선 (down)', async () => {
    // isPaused rule 1 이 failed rule 3 보다 먼저 평가된다
    const handles = [
      makeHandle('a', 'execution', 1, { failed: 5 }, { isPaused: true }),
    ];
    const service = new SystemStatusService(handles);

    const res = await service.getOverview();

    expect(res.queues[0].isPaused).toBe(true);
    expect(res.queues[0].health).toBe('down');
  });

  it('waiting>0, active=0, failed>=임계 → waiting 우선 (down)', async () => {
    // 규칙 2(waiting>0 && active=0) 가 규칙 3(failed>=임계) 보다 먼저 평가된다
    const handles = [
      makeHandle('a', 'execution', 1, { waiting: 3, active: 0, failed: 2 }),
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
