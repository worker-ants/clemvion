import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { SseFanoutHealth } from './sse-fanout-shared';
import { SseConnectionSlots } from './sse-connection-slots';

type PipelineResult = Array<[Error | null, unknown]> | null;

function setup(opts: {
  evalImpl?: () => Promise<unknown>;
  execImpl?: () => Promise<PipelineResult>;
  zremImpl?: () => Promise<unknown>;
  noClient?: boolean;
}) {
  const calls: string[] = [];
  const client = {
    eval: jest.fn(opts.evalImpl ?? (() => Promise.resolve(1))),
    zrem: jest.fn(opts.zremImpl ?? (() => Promise.resolve(1))),
    pipeline: jest.fn(() => {
      const p = {
        zadd: jest.fn(() => {
          calls.push('zadd');
          return p;
        }),
        pexpire: jest.fn(() => {
          calls.push('pexpire');
          return p;
        }),
        exec: jest.fn(opts.execImpl ?? (() => Promise.resolve([]))),
      };
      return p;
    }),
  };
  const logger = new Logger('test');
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  const metrics = { recordRedisFailOpen: jest.fn() };
  const slots = new SseConnectionSlots(
    () => (opts.noClient ? null : (client as unknown as Redis)),
    new SseFanoutHealth(logger),
    metrics as never,
  );
  return { slots, client, warn, log, metrics, calls };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('SseConnectionSlots', () => {
  describe('acquire', () => {
    it.each<[unknown, boolean]>([
      [1, true],
      [0, false],
    ])('eval 결과 %p 는 %p 로 돌려준다', async (result, expected) => {
      const { slots, metrics } = setup({
        evalImpl: () => Promise.resolve(result),
      });
      await expect(slots.acquire('e1', 's1', 3)).resolves.toBe(expected);
      expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
    });

    it('Redis 를 쓸 수 없으면 null 이고 eval 을 부르지 않는다', async () => {
      const { slots, client } = setup({ noClient: true });
      await expect(slots.acquire('e1', 's1', 3)).resolves.toBeNull();
      expect(client.eval).not.toHaveBeenCalled();
    });

    it('eval 이 실패하면 null 이고 카운터를 세며 경고는 한 번만 남기고 복구 로그를 남긴다', async () => {
      let fail = true;
      const { slots, warn, log, metrics } = setup({
        evalImpl: () =>
          fail ? Promise.reject(new Error('boom')) : Promise.resolve(1),
      });
      await expect(slots.acquire('e1', 's1', 3)).resolves.toBeNull();
      await expect(slots.acquire('e1', 's1', 3)).resolves.toBeNull();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(2);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'slot_failed',
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('연결 상한');
      expect(warn.mock.calls[0][0]).toContain('boom');
      fail = false;
      await expect(slots.acquire('e1', 's1', 3)).resolves.toBe(true);
      expect(log).toHaveBeenCalledWith('EIA SSE Redis 연결 상한 복구');
    });
  });

  describe('refresh', () => {
    it('ZADD 와 PEXPIRE 를 보내고 성공하면 아무것도 남기지 않는다', async () => {
      const { slots, calls, warn, metrics } = setup({});
      slots.refresh('e1', 's1');
      await flush();
      expect(calls).toEqual(['zadd', 'pexpire']);
      expect(warn).not.toHaveBeenCalled();
      expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
    });

    it.each<[string, PipelineResult]>([
      [
        'ZADD 가 실패',
        [
          [new Error('zadd 실패'), null],
          [null, 1],
        ],
      ],
      [
        'PEXPIRE 가 실패',
        [
          [null, 1],
          [new Error('pexpire 실패'), null],
        ],
      ],
      ['결과가 없음', null],
    ])('pipeline 에서 %s 하면 카운터를 세고 경고한다', async (_n, results) => {
      const { slots, warn, metrics } = setup({
        execImpl: () => Promise.resolve(results),
      });
      slots.refresh('e1', 's1');
      await flush();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'slot_failed',
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('연결 상한 갱신');
    });

    it('exec 가 reject 해도 던지지 않고 카운터를 센다', async () => {
      const { slots, metrics } = setup({
        execImpl: () => Promise.reject(new Error('conn')),
      });
      slots.refresh('e1', 's1');
      await flush();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(1);
    });

    it('Redis 를 쓸 수 없으면 pipeline 을 만들지 않는다', () => {
      const { slots, client } = setup({ noClient: true });
      slots.refresh('e1', 's1');
      expect(client.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('ZREM 으로 자리를 지운다', async () => {
      const { slots, client } = setup({});
      slots.release('e1', 's1');
      await flush();
      expect(client.zrem).toHaveBeenCalledWith(
        expect.stringContaining('e1'),
        's1',
      );
    });

    it('ZREM 이 실패해도 던지지 않고 카운터를 센다', async () => {
      const { slots, metrics, warn } = setup({
        zremImpl: () => Promise.reject(new Error('zrem')),
      });
      slots.release('e1', 's1');
      await flush();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'slot_failed',
      );
      expect(warn.mock.calls[0][0]).toContain('연결 상한 해제');
    });

    it('Redis 를 쓸 수 없으면 아무것도 하지 않는다', () => {
      const { slots, client } = setup({ noClient: true });
      slots.release('e1', 's1');
      expect(client.zrem).not.toHaveBeenCalled();
    });
  });
});
