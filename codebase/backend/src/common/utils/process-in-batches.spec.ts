import { processInBatches } from './process-in-batches';

describe('processInBatches', () => {
  it('모든 item 을 처리하고 입력 순서대로 settled 결과를 반환한다', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await processInBatches(items, 2, async (n) => n * 10);
    expect(
      results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
    ).toEqual([10, 20, 30, 40, 50]);
  });

  it('청크 경계를 넘어 전량 처리한다 (12건 / concurrency 5 → 3청크)', async () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const seen: number[] = [];
    const results = await processInBatches(items, 5, async (n) => {
      seen.push(n);
      return n;
    });
    expect(results).toHaveLength(12);
    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });

  it('동시 in-flight 수를 concurrency 로 제한한다', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await processInBatches(items, 3, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('한 item 의 reject 는 배치를 중단하지 않고 rejected 로 격리된다 (fail-open)', async () => {
    const items = ['ok1', 'boom', 'ok2'];
    const results = await processInBatches(items, 2, async (s) => {
      if (s === 'boom') throw new Error('kaboom');
      return s;
    });
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 'ok1' });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 'ok2' });
  });

  it('빈 입력은 worker 를 호출하지 않고 빈 배열을 반환한다', async () => {
    const worker = jest.fn(async (n: number) => n);
    const results = await processInBatches([], 4, worker);
    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it.each([0, -1, -100, 2.7])(
    'concurrency=%p 는 floor(≥1)로 정규화되어 무한 루프 없이 전량 처리한다',
    async (concurrency) => {
      const items = [1, 2, 3];
      const results = await processInBatches(
        items,
        concurrency,
        async (n) => n,
      );
      expect(
        results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
      ).toEqual([1, 2, 3]);
    },
  );

  it('동기적으로 throw 하는 non-async worker 도 rejected 로 격리된다 (fail-open 유지)', async () => {
    const items = [1, 2, 3];
    // 일부러 async 가 아닌 함수 — n===2 에서 promise 반환 전에 동기 throw.
    const results = await processInBatches(items, 2, (n): number => {
      if (n === 2) throw new Error('sync boom');
      return n;
    });
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toMatchObject({ status: 'fulfilled', value: 3 });
  });
});
