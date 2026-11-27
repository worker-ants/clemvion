import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import { SseFanoutHealth, SseMessageCodec } from './sse-fanout-shared';
import { SseReplayBuffer } from './sse-replay-buffer';
import { SSE_BUFFER_MAX_MESSAGE_BYTES } from './sse.constants';

type PipelineResult = Array<[Error | null, unknown]> | null;

function setup(opts: {
  execImpl?: () => Promise<PipelineResult>;
  xrangeImpl?: () => Promise<Array<[string, string[]]>>;
  getImpl?: () => Promise<string | null>;
  noClient?: boolean;
}) {
  const xaddArgs: unknown[][] = [];
  const calls: string[] = [];
  const client = {
    xrange: jest.fn(opts.xrangeImpl ?? (() => Promise.resolve([]))),
    get: jest.fn(opts.getImpl ?? (() => Promise.resolve(null))),
    pipeline: jest.fn(() => {
      const p = {
        xadd: jest.fn((...args: unknown[]) => {
          calls.push('xadd');
          xaddArgs.push(args);
          return p;
        }),
        pexpire: jest.fn(() => {
          calls.push('pexpire');
          return p;
        }),
        publish: jest.fn(() => {
          calls.push('publish');
          return p;
        }),
        exec: jest.fn(
          opts.execImpl ??
            (() =>
              Promise.resolve([
                [null, '1-0'],
                [null, 1],
                [null, 0],
              ] as PipelineResult)),
        ),
      };
      return p;
    }),
  };
  const logger = new Logger('test');
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  const metrics = { recordRedisFailOpen: jest.fn() };
  const codec = new SseMessageCodec();
  const buffer = new SseReplayBuffer(
    () => (opts.noClient ? null : (client as unknown as Redis)),
    codec,
    new SseFanoutHealth(logger),
    metrics as never,
  );
  return { buffer, client, codec, warn, log, metrics, calls, xaddArgs };
}

function event(
  seq: number,
  overrides: Partial<ExecutionChannelEvent> = {},
): ExecutionChannelEvent {
  return {
    executionId: 'e1',
    eventType: 'execution.ai_message',
    seq,
    payload: { text: `m${seq}` },
    ...overrides,
  };
}

/** XADD 인자 `[key, 'MAXLEN', '~', n, '*', 'seq', s, 'data', message]` 에서 message 를 꺼낸다. */
const xaddMessage = (args: unknown[]) => args[8] as string;

describe('SseReplayBuffer', () => {
  describe('append', () => {
    it('XADD · PEXPIRE · PUBLISH 를 한 pipeline 으로 보내고 stored 를 돌려준다', async () => {
      const { buffer, calls, xaddArgs, metrics, warn } = setup({});
      await expect(buffer.append(event(3))).resolves.toBe('stored');
      expect(calls).toEqual(['xadd', 'pexpire', 'publish']);
      expect(xaddArgs[0].slice(0, 7)).toEqual([
        'eia:sse:buf:e1',
        'MAXLEN',
        '~',
        1000,
        '*',
        'seq',
        '3',
      ]);
      expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('크기 상한을 넘으면 생략 표시를 넣고 omitted 를 돌려준다', async () => {
      const { buffer, codec, xaddArgs } = setup({});
      const big = event(4, {
        payload: { text: 'x'.repeat(SSE_BUFFER_MAX_MESSAGE_BYTES + 1) },
      });
      await expect(buffer.append(big)).resolves.toBe('omitted');
      const decoded = codec.decodeEntry(xaddMessage(xaddArgs[0]), 'e1');
      expect(decoded).toEqual({ origin: codec.origin, seq: 4, event: null });
    });

    it.each<[string, number, string]>([
      // '가' 는 UTF-8 로 3바이트다. 문자 수는 한도의 1/3 를 넘고 한도 이하라 바이트 수를 세는 분기로 간다.
      [
        '바이트 수가 한도를 넘으면',
        Math.ceil(SSE_BUFFER_MAX_MESSAGE_BYTES / 3) + 10,
        'omitted',
      ],
      [
        '바이트 수가 한도 이내면',
        Math.floor(SSE_BUFFER_MAX_MESSAGE_BYTES / 3) - 200,
        'stored',
      ],
    ])('멀티바이트 payload 는 %s %s 다', async (_n, chars, expected) => {
      const { buffer } = setup({});
      const text = '가'.repeat(chars);
      expect(text.length).toBeLessThanOrEqual(SSE_BUFFER_MAX_MESSAGE_BYTES);
      await expect(
        buffer.append(event(6, { payload: { text } })),
      ).resolves.toBe(expected);
    });

    it('종료 이벤트는 크기 상한을 넘어도 이벤트 전체를 넣는다', async () => {
      const { buffer, codec, xaddArgs } = setup({});
      const big = event(5, {
        eventType: 'execution.completed',
        payload: { text: 'x'.repeat(SSE_BUFFER_MAX_MESSAGE_BYTES + 1) },
      });
      await expect(buffer.append(big)).resolves.toBe('stored');
      const decoded = codec.decodeEntry(xaddMessage(xaddArgs[0]), 'e1');
      expect(decoded?.event?.eventType).toBe('execution.completed');
    });

    it('Redis 를 쓸 수 없으면 failed 이고 pipeline 을 만들지 않는다', async () => {
      const { buffer, client } = setup({ noClient: true });
      await expect(buffer.append(event(1))).resolves.toBe('failed');
      expect(client.pipeline).not.toHaveBeenCalled();
    });

    it('JSON 으로 바꾸지 못하면 failed 이고 카운터는 세지 않고 경고만 남긴다', async () => {
      const { buffer, client, metrics, warn } = setup({});
      const bad = event(1, { payload: { n: BigInt(1) } });
      await expect(buffer.append(bad)).resolves.toBe('failed');
      expect(client.pipeline).not.toHaveBeenCalled();
      expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('버퍼 쓰기');
    });

    it.each<[string, () => Promise<PipelineResult>]>([
      [
        'XADD 가 실패',
        () =>
          Promise.resolve([
            [new Error('xadd 실패'), null],
            [null, 1],
            [null, 0],
          ]),
      ],
      ['결과가 없음', () => Promise.resolve(null)],
      ['exec 가 reject', () => Promise.reject(new Error('conn'))],
    ])(
      'pipeline 에서 %s 하면 failed 이고 write_failed 로 센다',
      async (_n, execImpl) => {
        const { buffer, metrics, warn } = setup({ execImpl });
        await expect(buffer.append(event(1))).resolves.toBe('failed');
        expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
          'sse_fanout',
          'write_failed',
        );
        expect(warn.mock.calls[0][0]).toContain('버퍼 쓰기');
      },
    );

    it.each<[string, string, PipelineResult]>([
      [
        'PUBLISH 가 실패',
        'publish_failed',
        [
          [null, '1-0'],
          [null, 1],
          [new Error('publish 실패'), null],
        ],
      ],
      [
        'PEXPIRE 만 실패',
        'write_failed',
        [
          [null, '1-0'],
          [new Error('pexpire 실패'), null],
          [null, 0],
        ],
      ],
      [
        'PEXPIRE 와 PUBLISH 가 둘 다 실패',
        'publish_failed',
        [
          [null, '1-0'],
          [new Error('pexpire 실패'), null],
          [new Error('publish 실패'), null],
        ],
      ],
    ])(
      '%s 하면 버퍼에는 있으므로 stored 이고 %s 경로로 한 번 센다',
      async (_n, reason, results) => {
        const { buffer, metrics, warn } = setup({
          execImpl: () => Promise.resolve(results),
        });
        await expect(buffer.append(event(1))).resolves.toBe('stored');
        expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(1);
        expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
          'sse_fanout',
          reason,
        );
        expect(warn.mock.calls[0][0]).toContain('버퍼 TTL · 발행');
      },
    );

    it('실패가 이어져도 경고는 한 번만 남기고 성공하면 복구 로그를 남긴다', async () => {
      let fail = true;
      const { buffer, metrics, warn, log } = setup({
        execImpl: () =>
          fail
            ? Promise.reject(new Error('boom'))
            : Promise.resolve([
                [null, '1-0'],
                [null, 1],
                [null, 0],
              ]),
      });
      await buffer.append(event(1));
      await buffer.append(event(2));
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('boom');
      fail = false;
      await expect(buffer.append(event(3))).resolves.toBe('stored');
      expect(log).toHaveBeenCalledWith('EIA SSE Redis 버퍼 쓰기 복구');
    });
  });

  describe('read', () => {
    it('넣은 순서대로 이벤트와 생략 표시를 돌려주고 형식이 맞지 않는 항목은 버린다', async () => {
      // 다른 서버 인스턴스가 넣은 항목도 읽으므로 따로 만든 codec 으로 넣는다.
      const codec = new SseMessageCodec();
      const entries: Array<[string, string[]]> = [
        ['1000-0', ['seq', '1', 'data', codec.encodeEvent(event(1))]],
        ['1001-0', ['seq', '2', 'data', codec.encodeOmitted(event(2))]],
        ['1002-0', ['seq', '3', 'data', 'not json']],
        ['bad-id', ['seq', '4', 'data', codec.encodeEvent(event(4))]],
        ['1003-0', ['seq', '5']],
        [
          '1004-0',
          [
            'seq',
            '6',
            'data',
            codec.encodeEvent(event(6, { executionId: 'e2' })),
          ],
        ],
      ];
      const { buffer, client } = setup({
        xrangeImpl: () => Promise.resolve(entries),
      });
      const result = await buffer.read('e1');
      expect(client.xrange).toHaveBeenCalledWith('eia:sse:buf:e1', '-', '+');
      expect(result?.skipped).toBe(0);
      expect(result?.events.map((e) => [e.seq, e.receivedAt])).toEqual([
        [1, 1000],
        [2, 1001],
      ]);
      expect(result?.events[0].event?.payload).toEqual({ text: 'm1' });
      expect(result?.events[1].event).toBeNull();
    });

    it('afterSeq 이하인 항목은 파싱하지 않고 skipped 로 세며 seq 필드가 없는 옛 항목은 파싱한다', async () => {
      const codec = new SseMessageCodec();
      const entries: Array<[string, string[]]> = [
        ['1000-0', ['seq', '1', 'data', codec.encodeEvent(event(1))]],
        ['1001-0', ['seq', '2', 'data', 'not json']],
        ['1002-0', ['data', codec.encodeEvent(event(3))]],
        ['1003-0', ['seq', '4', 'data', codec.encodeEvent(event(4))]],
      ];
      const { buffer } = setup({ xrangeImpl: () => Promise.resolve(entries) });
      const decode = jest.spyOn(SseMessageCodec.prototype, 'decodeEntry');
      try {
        const result = await buffer.read('e1', 2);
        expect(result?.skipped).toBe(2);
        expect(result?.events.map((e) => e.seq)).toEqual([3, 4]);
        // seq 1 · 2 는 파싱하지 않았다(2 는 깨진 JSON 이라 파싱했으면 버려졌을 것이다).
        expect(decode).toHaveBeenCalledTimes(2);
      } finally {
        decode.mockRestore();
      }
    });

    it('XRANGE 가 실패하면 null 이고 read_failed 로 세며 성공하면 복구 로그를 남긴다', async () => {
      let fail = true;
      const { buffer, metrics, warn, log } = setup({
        xrangeImpl: () =>
          fail ? Promise.reject(new Error('xrange')) : Promise.resolve([]),
      });
      await expect(buffer.read('e1')).resolves.toBeNull();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'read_failed',
      );
      expect(warn.mock.calls[0][0]).toContain('버퍼 읽기');
      fail = false;
      await expect(buffer.read('e1')).resolves.toEqual({
        events: [],
        skipped: 0,
      });
      expect(log).toHaveBeenCalledWith('EIA SSE Redis 버퍼 읽기 복구');
    });

    it('Redis 를 쓸 수 없으면 null 이고 XRANGE 를 부르지 않는다', async () => {
      const { buffer, client } = setup({ noClient: true });
      await expect(buffer.read('e1')).resolves.toBeNull();
      expect(client.xrange).not.toHaveBeenCalled();
    });
  });

  describe('readLatestSeq', () => {
    it.each<[string | null, number | null]>([
      ['7', 7],
      [null, null],
      ['abc', null],
      ['1.5', null],
    ])('카운터 값 %p 는 %p 로 돌려준다', async (raw, expected) => {
      const { buffer, client } = setup({
        getImpl: () => Promise.resolve(raw),
      });
      await expect(buffer.readLatestSeq('e1')).resolves.toBe(expected);
      expect(client.get).toHaveBeenCalledWith('exec:seq:e1');
    });

    it('GET 이 실패하면 null 이고 read_failed 로 센다', async () => {
      const { buffer, metrics, warn } = setup({
        getImpl: () => Promise.reject(new Error('get')),
      });
      await expect(buffer.readLatestSeq('e1')).resolves.toBeNull();
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
        'sse_fanout',
        'read_failed',
      );
      expect(warn.mock.calls[0][0]).toContain('순번 읽기');
    });

    it('Redis 를 쓸 수 없으면 null 이다', async () => {
      const { buffer, client } = setup({ noClient: true });
      await expect(buffer.readLatestSeq('e1')).resolves.toBeNull();
      expect(client.get).not.toHaveBeenCalled();
    });
  });
});
