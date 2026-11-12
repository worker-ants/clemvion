import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  SSE_BUFFER_MAX_MESSAGE_BYTES,
  SSE_CLOSE_CHANNEL,
  SSE_SUBSCRIBER_CONNECTION_NAME,
  SseFanoutService,
  sseBufferKey,
  sseConnectionSlotsKey,
  sseLiveChannel,
  type SseFanoutHandlers,
} from './sse-fanout.service';
import {
  FakeRedisClient,
  FakeRedisServer,
} from './__test-utils__/fake-redis-streams';
import type { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

const TRIGGER_1 = '11111111-1111-4111-8111-111111111111';

interface Booted {
  service: SseFanoutService;
  /** `duplicate()` 로 만든 구독 연결. */
  sub: FakeRedisClient;
  /** `duplicate()` 에 넘긴 옵션. */
  duplicateOptions: unknown;
  handlers: jest.Mocked<SseFanoutHandlers>;
}

/** `BusinessMetricsService` 중 이 서비스가 부르는 메서드만. */
interface MetricsStub {
  recordRedisFailOpen: jest.Mock;
}

/**
 * 구독 연결을 테스트가 잡을 수 있게 `duplicate()` 를 가로채고 부팅한다. `metrics` 를 주면 fail-open 기록을 받는다.
 */
function boot(server: FakeRedisServer, metrics?: MetricsStub): Booted {
  const base = server.client();
  const sub = server.client();
  let duplicateOptions: unknown;
  base.duplicate = (options?: unknown) => {
    duplicateOptions = options;
    return sub;
  };
  const service = new SseFanoutService(
    {
      getClientOrNull: () => base as unknown as Redis,
    } as unknown as RedisConnectionProvider,
    metrics as never,
  );
  service.onModuleInit();
  const handlers = {
    onLiveEvent: jest.fn(),
    onLiveOmitted: jest.fn(),
    onRemoteClose: jest.fn(),
    onLiveResumed: jest.fn(),
  };
  service.bind(handlers);
  return { service, sub, duplicateOptions, handlers };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** 가짜 타이머를 켠 동안 대기 중인 Promise 연쇄를 처리한다. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function ev(seq: number, executionId = 'exec-1'): ExecutionChannelEvent {
  return {
    executionId,
    eventType: 'execution.node.started',
    seq,
    payload: { seq },
  };
}

function message(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}

describe('SseFanoutService', () => {
  let server: FakeRedisServer;
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(() => {
    server = new FakeRedisServer();
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

  function warnings(op: string): unknown[][] {
    return warn.mock.calls.filter(([m]) => String(m).includes(op));
  }

  describe('Redis 없이 부팅', () => {
    let service: SseFanoutService;

    beforeEach(() => {
      service = new SseFanoutService({
        getClientOrNull: () => null,
      } as unknown as RedisConnectionProvider);
      service.onModuleInit();
    });

    it('메모리로만 동작한다고 한 번 알리고 모든 명령이 실패 값을 돌려준다', async () => {
      expect(warn).toHaveBeenCalledTimes(1);
      expect(service.isEnabled()).toBe(false);
      expect(await service.append(ev(1))).toBe('failed');
      expect(await service.readBuffer('exec-1')).toBeNull();
      expect(await service.readLatestSeq('exec-1')).toBeNull();
      expect(await service.retainLive('exec-1')).toBe(false);
      expect(await service.acquireSlot('exec-1', 'sub-1', 3)).toBeNull();
      await expect(service.publishClose([TRIGGER_1])).resolves.toBeUndefined();
      service.releaseLive('exec-1');
      service.refreshSlot('exec-1', 'sub-1');
      service.releaseSlot('exec-1', 'sub-1');
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('버퍼와 live 발행', () => {
    it('append 는 Stream 에 seq 와 메시지를 넣고 TTL 5분을 걸고 live 채널로 같은 메시지를 보낸다', async () => {
      const { service } = boot(server);
      expect(await service.append(ev(1))).toBe('stored');

      const entries = server.streams.get(sseBufferKey('exec-1'));
      expect(entries).toHaveLength(1);
      const [, fields] = entries![0];
      expect(fields.slice(0, 3)).toEqual(['seq', '1', 'data']);
      const stored = JSON.parse(fields[3]) as Record<string, unknown>;
      expect(stored).toMatchObject({
        v: 1,
        event: ev(1),
      });
      expect(typeof stored.origin).toBe('string');
      const ttl = server.pttl(sseBufferKey('exec-1'));
      expect(ttl).toBeLessThanOrEqual(300_000);
      expect(ttl).toBeGreaterThan(299_000);
      expect(server.published).toEqual([
        { channel: sseLiveChannel('exec-1'), message: fields[3] },
      ]);
    });

    describe('크기 상한', () => {
      /** 직렬화한 메시지가 상한을 넘는 이벤트. 한글은 UTF-8 로 3바이트라 문자 수로는 상한 안이다. */
      function big(seq: number, eventType = 'execution.node.completed') {
        return {
          executionId: 'exec-1',
          eventType,
          seq,
          payload: {
            text: '가'.repeat(Math.ceil(SSE_BUFFER_MAX_MESSAGE_BYTES / 3) + 10),
          },
        } satisfies ExecutionChannelEvent;
      }

      it('상한을 넘는 이벤트는 생략 표시만 Stream 과 live 채널에 넣는다', async () => {
        const { service } = boot(server);
        expect(await service.append(big(1))).toBe('omitted');
        const [, fields] = server.streams.get(sseBufferKey('exec-1'))![0];
        expect(fields.slice(0, 3)).toEqual(['seq', '1', 'data']);
        const stored = JSON.parse(fields[3]) as Record<string, unknown>;
        expect(stored).toMatchObject({
          v: 1,
          omitted: {
            executionId: 'exec-1',
            seq: 1,
            eventType: 'execution.node.completed',
          },
        });
        expect(stored.event).toBeUndefined();
        expect(Buffer.byteLength(fields[3], 'utf8')).toBeLessThan(1024);
        expect(server.published).toEqual([
          { channel: sseLiveChannel('exec-1'), message: fields[3] },
        ]);
      });

      it('상한 안의 이벤트는 그대로 넣는다', async () => {
        const { service } = boot(server);
        const fits: ExecutionChannelEvent = {
          ...ev(1),
          payload: { text: 'a'.repeat(SSE_BUFFER_MAX_MESSAGE_BYTES - 200) },
        };
        expect(await service.append(fits)).toBe('stored');
      });

      it.each([
        'execution.completed',
        'execution.failed',
        'execution.cancelled',
      ])('종료 이벤트 %s 는 상한을 넘어도 그대로 넣는다', async (eventType) => {
        const { service } = boot(server);
        expect(await service.append(big(1, eventType))).toBe('stored');
        const [, fields] = server.streams.get(sseBufferKey('exec-1'))![0];
        expect(JSON.parse(fields[3])).toMatchObject({
          event: big(1, eventType),
        });
      });

      it('readBuffer 는 생략 표시를 이벤트 없이 seq 로 돌려준다', async () => {
        const { service } = boot(server);
        await service.append(ev(1));
        await service.append(big(2));
        const read = await service.readBuffer('exec-1');
        expect(read?.events.map((e) => [e.seq, e.event])).toEqual([
          [1, ev(1)],
          [2, null],
        ]);
      });

      it('다른 서버 인스턴스의 생략 표시는 onLiveOmitted 로 넘긴다', async () => {
        const a = boot(server);
        const b = boot(server);
        await a.service.retainLive('exec-1');
        await b.service.retainLive('exec-1');
        await a.service.append(big(4));
        await flush();
        expect(b.handlers.onLiveOmitted).toHaveBeenCalledWith('exec-1', 4);
        expect(b.handlers.onLiveEvent).not.toHaveBeenCalled();
        expect(a.handlers.onLiveOmitted).not.toHaveBeenCalled();
      });

      it.each([
        ['다른 실행', { executionId: 'x', seq: 1, eventType: 'e' }],
        ['seq 가 0', { executionId: 'exec-1', seq: 0, eventType: 'e' }],
        ['seq 가 문자열', { executionId: 'exec-1', seq: '1', eventType: 'e' }],
        ['eventType 없음', { executionId: 'exec-1', seq: 1 }],
        ['객체가 아님', 'omitted'],
      ])('형식이 맞지 않는 생략 표시(%s)는 버린다', async (_, omitted) => {
        const { service, sub, handlers } = boot(server);
        await service.retainLive('exec-1');
        sub.emit(
          'message',
          sseLiveChannel('exec-1'),
          message({ v: 1, origin: 'other', omitted }),
        );
        expect(handlers.onLiveOmitted).not.toHaveBeenCalled();
        expect(handlers.onLiveEvent).not.toHaveBeenCalled();
      });
    });

    it('Stream 에 1000개 남짓만 둔다', async () => {
      const { service } = boot(server);
      for (let i = 1; i <= 1005; i++) await service.append(ev(i));
      expect(server.streams.get(sseBufferKey('exec-1'))).toHaveLength(1000);
    });

    it('넣지 못하면 failed 이고 경고는 복구될 때까지 한 번만 남긴다', async () => {
      const { service } = boot(server);
      server.failing = true;
      expect(await service.append(ev(1))).toBe('failed');
      expect(await service.append(ev(2))).toBe('failed');
      expect(warnings('버퍼 쓰기')).toHaveLength(1);
      server.failing = false;
      expect(await service.append(ev(3))).toBe('stored');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('버퍼 쓰기 복구'),
      );
      server.failing = true;
      await service.append(ev(4));
      expect(warnings('버퍼 쓰기')).toHaveLength(2);
    });

    // ioredis 의 pipeline.exec() 는 명령 하나가 실패해도 reject 하지 않고 [오류, 결과] 배열로 돌려준다.
    describe('pipeline 명령 하나의 실패', () => {
      it('XADD 가 실패하면 failed 이고 버퍼 쓰기 경고를 한 번만 남긴다', async () => {
        const { service } = boot(server);
        server.failPipelineCommands.add('xadd');
        expect(await service.append(ev(1))).toBe('failed');
        expect(await service.append(ev(2))).toBe('failed');
        expect(warnings('버퍼 쓰기')).toHaveLength(1);
        expect(warnings('버퍼 TTL · 발행')).toHaveLength(0);
        expect(server.streams.get(sseBufferKey('exec-1'))).toBeUndefined();

        server.failPipelineCommands.clear();
        expect(await service.append(ev(3))).toBe('stored');
        expect(log).toHaveBeenCalledWith(
          expect.stringContaining('버퍼 쓰기 복구'),
        );
      });

      it.each(['pexpire', 'publish'] as const)(
        '%s 만 실패하면 stored 이고 버퍼 TTL · 발행 경고를 한 번만 남긴다',
        async (command) => {
          const { service } = boot(server);
          server.failPipelineCommands.add(command);
          expect(await service.append(ev(1))).toBe('stored');
          expect(await service.append(ev(2))).toBe('stored');
          // XADD 는 들어갔으므로 재연결 replay 로 읽을 수 있다.
          expect(server.streams.get(sseBufferKey('exec-1'))).toHaveLength(2);
          expect(warnings('버퍼 TTL · 발행')).toHaveLength(1);
          expect(warnings('버퍼 쓰기')).toHaveLength(0);

          server.failPipelineCommands.clear();
          expect(await service.append(ev(3))).toBe('stored');
          expect(log).toHaveBeenCalledWith(
            expect.stringContaining('버퍼 TTL · 발행 복구'),
          );
          // 한 번 복구한 뒤 다시 실패하면 경고를 다시 남긴다.
          server.failPipelineCommands.add(command);
          await service.append(ev(4));
          expect(warnings('버퍼 TTL · 발행')).toHaveLength(2);
        },
      );

      it('XADD 와 PEXPIRE 가 함께 실패하면 XADD 실패로 본다', async () => {
        const { service } = boot(server);
        server.failPipelineCommands.add('xadd');
        server.failPipelineCommands.add('pexpire');
        expect(await service.append(ev(1))).toBe('failed');
        expect(warnings('버퍼 쓰기')).toHaveLength(1);
        expect(warnings('버퍼 TTL · 발행')).toHaveLength(0);
      });

      it('exec() 가 결과 없이 끝나면 failed 이다', async () => {
        const { service } = boot(server);
        server.pipelineExecReturnsNull = true;
        expect(await service.append(ev(1))).toBe('failed');
        expect(warnings('버퍼 쓰기')).toHaveLength(1);

        server.pipelineExecReturnsNull = false;
        expect(await service.append(ev(2))).toBe('stored');
        expect(log).toHaveBeenCalledWith(
          expect.stringContaining('버퍼 쓰기 복구'),
        );
      });
    });

    it('JSON 으로 바꾸지 못하는 payload 는 던지지 않고 failed 이며 경고를 남긴다', async () => {
      const { service } = boot(server);
      const unserializable: ExecutionChannelEvent = {
        executionId: 'exec-1',
        eventType: 'execution.node.started',
        seq: 1,
        payload: { big: BigInt(1) },
      };
      await expect(service.append(unserializable)).resolves.toBe('failed');
      expect(warnings('버퍼 쓰기')).toHaveLength(1);
      expect(server.streams.get(sseBufferKey('exec-1'))).toBeUndefined();
      expect(server.published).toEqual([]);
      // 다음 정상 이벤트는 그대로 들어가고 복구가 기록된다.
      expect(await service.append(ev(2))).toBe('stored');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('버퍼 쓰기 복구'),
      );
    });

    it('readBuffer 는 넣은 순서대로 읽고 Stream id 의 시각을 받은 시각으로 쓴다', async () => {
      const { service } = boot(server);
      await service.append(ev(1));
      await service.append(ev(2));
      const read = await service.readBuffer('exec-1');
      expect(read?.events.map((e) => e.seq)).toEqual([1, 2]);
      expect(read?.events[0].event).toEqual(ev(1));
      const [id] = server.streams.get(sseBufferKey('exec-1'))![0];
      expect(read?.events[0].receivedAt).toBe(Number(id.split('-')[0]));
      expect(read?.skipped).toBe(0);
    });

    it('readBuffer 는 afterSeq 이하 항목을 파싱하지 않고 센다', async () => {
      const { service } = boot(server);
      for (let i = 1; i <= 5; i++) await service.append(ev(i));
      const raws = server.streams
        .get(sseBufferKey('exec-1'))!
        .map(([, fields]) => fields[3]);
      const parse = jest.spyOn(JSON, 'parse');
      try {
        const read = await service.readBuffer('exec-1', 3);
        expect(read?.skipped).toBe(3);
        expect(read?.events.map((e) => e.seq)).toEqual([4, 5]);
        const parsed = parse.mock.calls
          .map(([text]) => raws.indexOf(text as string))
          .filter((i) => i >= 0);
        expect(parsed).toEqual([3, 4]);
      } finally {
        parse.mockRestore();
      }
    });

    it('readBuffer 는 seq 필드가 없는 이전 형식 항목도 파싱해 읽는다', async () => {
      const { service } = boot(server);
      server.streams.set(sseBufferKey('exec-1'), [
        ['1-0', ['data', message({ v: 1, origin: 'o', event: ev(1) })]],
        ['2-0', ['data', message({ v: 1, origin: 'o', event: ev(2) })]],
      ]);
      const read = await service.readBuffer('exec-1', 1);
      expect(read?.skipped).toBe(0);
      expect(read?.events.map((e) => e.seq)).toEqual([1, 2]);
    });

    it('readBuffer 는 형식이 맞지 않는 항목을 버린다', async () => {
      const { service } = boot(server);
      const key = sseBufferKey('exec-1');
      const good = message({ v: 1, origin: 'o', event: ev(3) });
      server.streams.set(key, [
        ['1-0', ['data', 'not json']],
        ['2-0', ['data', message({ v: 2, origin: 'o', event: ev(1) })]],
        ['3-0', ['data', message({ v: 1, origin: '', event: ev(1) })]],
        ['4-0', ['data', message({ v: 1, origin: 'o', event: ev(1, 'x') })]],
        ['5-0', ['other', good]],
        [
          '6-0',
          [
            'data',
            message({ v: 1, origin: 'o', event: { ...ev(1), payload: [] } }),
          ],
        ],
        [
          '7-0',
          [
            'data',
            message({ v: 1, origin: 'o', event: { ...ev(1), seq: 'one' } }),
          ],
        ],
        ['8-0', ['data', good]],
      ]);
      const read = await service.readBuffer('exec-1');
      expect(read).toEqual({
        events: [{ seq: 3, receivedAt: 8, event: ev(3) }],
        skipped: 0,
      });
    });

    it('readBuffer 는 키가 없으면 빈 목록, 읽지 못하면 null 이다', async () => {
      const { service } = boot(server);
      expect(await service.readBuffer('exec-1')).toEqual({
        events: [],
        skipped: 0,
      });
      server.failing = true;
      expect(await service.readBuffer('exec-1')).toBeNull();
      expect(warnings('버퍼 읽기')).toHaveLength(1);
    });

    it('readLatestSeq 는 실행 순번 카운터를 읽는다', async () => {
      const { service } = boot(server);
      expect(await service.readLatestSeq('exec-1')).toBeNull();
      server.strings.set('exec:seq:exec-1', '12');
      expect(await service.readLatestSeq('exec-1')).toBe(12);
      server.strings.set('exec:seq:exec-1', 'abc');
      expect(await service.readLatestSeq('exec-1')).toBeNull();
      server.strings.set('exec:seq:exec-1', '12');
      server.failing = true;
      expect(await service.readLatestSeq('exec-1')).toBeNull();
    });
  });

  describe('live 채널', () => {
    it('참조 수를 세어 SUBSCRIBE · UNSUBSCRIBE 를 한 번씩 보낸다', async () => {
      const { service, sub } = boot(server);
      const channel = sseLiveChannel('exec-1');
      expect(await service.retainLive('exec-1')).toBe(true);
      expect(await service.retainLive('exec-1')).toBe(true);
      expect(
        sub.subscribeCalls.filter((c) => c.includes(channel)),
      ).toHaveLength(1);
      service.releaseLive('exec-1');
      expect(server.subscriberCount(channel)).toBe(1);
      service.releaseLive('exec-1');
      await flush();
      expect(server.subscriberCount(channel)).toBe(0);
      // 짝이 없는 해제는 무시한다.
      service.releaseLive('exec-1');
    });

    it('다른 서버 인스턴스의 이벤트만 넘기고 자기 이벤트는 건너뛴다', async () => {
      const a = boot(server);
      const b = boot(server);
      await a.service.retainLive('exec-1');
      await b.service.retainLive('exec-1');
      await a.service.append(ev(1));
      await flush();
      expect(b.handlers.onLiveEvent).toHaveBeenCalledWith(ev(1));
      expect(a.handlers.onLiveEvent).not.toHaveBeenCalled();
    });

    it('자기 이벤트는 접두로 알아보고 JSON 을 파싱하지 않는다', async () => {
      const a = boot(server);
      const b = boot(server);
      await a.service.retainLive('exec-1');
      await b.service.retainLive('exec-1');
      const parse = jest.spyOn(JSON, 'parse');
      try {
        await a.service.append(ev(1));
        await flush();
        const [published] = server.published
          .filter(({ channel }) => channel === sseLiveChannel('exec-1'))
          .map(({ message: raw }) => raw);
        // b 는 다른 서버 인스턴스의 메시지라 한 번 파싱한다. a 는 자기 메시지라 파싱하지 않는다.
        expect(
          parse.mock.calls.filter(([text]) => text === published),
        ).toHaveLength(1);
        expect(b.handlers.onLiveEvent).toHaveBeenCalledWith(ev(1));
        expect(a.handlers.onLiveEvent).not.toHaveBeenCalled();
      } finally {
        parse.mockRestore();
      }
    });

    it('구독하지 않은 실행의 메시지와 형식이 맞지 않는 메시지는 버린다', async () => {
      const { service, sub, handlers } = boot(server);
      await service.retainLive('exec-1');
      // 구독을 푼 실행 — 해제가 늦게 처리되는 사이 도착한 메시지.
      sub.emit(
        'message',
        sseLiveChannel('exec-2'),
        message({ v: 1, origin: 'other', event: ev(1, 'exec-2') }),
      );
      // 채널과 다른 실행의 이벤트.
      sub.emit(
        'message',
        sseLiveChannel('exec-1'),
        message({ v: 1, origin: 'other', event: ev(1, 'exec-2') }),
      );
      sub.emit('message', sseLiveChannel('exec-1'), 'not json');
      sub.emit('message', 'unrelated', message({ v: 1 }));
      expect(handlers.onLiveEvent).not.toHaveBeenCalled();
      sub.emit(
        'message',
        sseLiveChannel('exec-1'),
        message({ v: 1, origin: 'other', event: ev(2) }),
      );
      expect(handlers.onLiveEvent).toHaveBeenCalledWith(ev(2));
    });

    it('SUBSCRIBE 가 실패하면 false 다', async () => {
      const { service } = boot(server);
      server.failing = true;
      expect(await service.retainLive('exec-1')).toBe(false);
      expect(warnings('live 채널 구독')).toHaveLength(1);
    });

    it('SUBSCRIBE 응답을 2초까지만 기다린다', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      try {
        const { service, sub } = boot(server);
        sub.subscribe = () => new Promise<number>(() => undefined);
        const confirmed = service.retainLive('exec-1');
        await jest.advanceTimersByTimeAsync(1_999);
        let settled = false;
        void confirmed.then(() => {
          settled = true;
        });
        await Promise.resolve();
        expect(settled).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(await confirmed).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    describe('상한을 넘긴 SUBSCRIBE 가 늦게 확인되면', () => {
      function slowSubscribe(sub: FakeRedisClient): () => void {
        let resolve: (n: number) => void = () => undefined;
        sub.subscribe = () =>
          new Promise<number>((r) => {
            resolve = r;
          });
        return () => resolve(1);
      }

      it('onLiveResumed 로 알린다', async () => {
        jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
        try {
          const { service, sub, handlers } = boot(server);
          const confirm = slowSubscribe(sub);
          const confirmed = service.retainLive('exec-1');
          await jest.advanceTimersByTimeAsync(2_000);
          expect(await confirmed).toBe(false);
          expect(handlers.onLiveResumed).not.toHaveBeenCalled();
          confirm();
          await flushMicrotasks();
          expect(handlers.onLiveResumed).toHaveBeenCalledWith(['exec-1']);
        } finally {
          jest.useRealTimers();
        }
      });

      it('그 사이 구독을 풀었으면 알리지 않는다', async () => {
        jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
        try {
          const { service, sub, handlers } = boot(server);
          const confirm = slowSubscribe(sub);
          const confirmed = service.retainLive('exec-1');
          await jest.advanceTimersByTimeAsync(2_000);
          await confirmed;
          service.releaseLive('exec-1');
          confirm();
          await flushMicrotasks();
          expect(handlers.onLiveResumed).not.toHaveBeenCalled();
        } finally {
          jest.useRealTimers();
        }
      });

      it('상한 안에 확인되면 알리지 않는다', async () => {
        const { service, handlers } = boot(server);
        expect(await service.retainLive('exec-1')).toBe(true);
        await flush();
        expect(handlers.onLiveResumed).not.toHaveBeenCalled();
      });
    });
  });

  describe('닫기 신호', () => {
    it('다른 서버 인스턴스에 트리거 id 를 알리고 자기 신호는 건너뛴다', async () => {
      const a = boot(server);
      const b = boot(server);
      await a.service.publishClose([TRIGGER_1]);
      await flush();
      expect(b.handlers.onRemoteClose).toHaveBeenCalledWith([TRIGGER_1]);
      expect(a.handlers.onRemoteClose).not.toHaveBeenCalled();
      const sent = JSON.parse(server.published[0].message) as Record<
        string,
        unknown
      >;
      expect(server.published[0].channel).toBe(SSE_CLOSE_CHANNEL);
      expect(sent).toMatchObject({ v: 1, triggerIds: [TRIGGER_1] });
    });

    it.each([
      ['JSON 이 아님', 'nope'],
      ['버전이 다름', message({ v: 2, origin: 'o', triggerIds: [TRIGGER_1] })],
      ['origin 없음', message({ v: 1, triggerIds: [TRIGGER_1] })],
      ['빈 목록', message({ v: 1, origin: 'o', triggerIds: [] })],
      ['uuid 가 아님', message({ v: 1, origin: 'o', triggerIds: ['trg-1'] })],
      ['배열이 아님', message({ v: 1, origin: 'o', triggerIds: TRIGGER_1 })],
    ])('형식이 맞지 않는 신호는 버린다 — %s', (_label, raw) => {
      const { sub, handlers } = boot(server);
      sub.emit('message', SSE_CLOSE_CHANNEL, raw);
      expect(handlers.onRemoteClose).not.toHaveBeenCalled();
    });

    describe('발행 실패', () => {
      let error: jest.SpyInstance;
      beforeEach(() => {
        error = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);
      });
      afterEach(() => error.mockRestore());

      function errors(): string[] {
        return error.mock.calls
          .map(([m]) => String(m))
          .filter((m) => m.includes('닫기 신호 발행'));
      }

      it('던지지 않고 호출마다 트리거 id 와 오류를 error 로 남긴다', async () => {
        const { service } = boot(server);
        server.failing = true;
        await expect(
          service.publishClose([TRIGGER_1]),
        ).resolves.toBeUndefined();
        await service.publishClose([TRIGGER_1]);
        expect(errors()).toHaveLength(2);
        expect(errors()[0]).toContain(TRIGGER_1);
        expect(errors()[0]).toContain('fake redis');
        // 억제되는 경고로는 남기지 않는다. 실패 하나가 다른 서버 인스턴스의 인가 틈이 되기 때문이다.
        expect(warnings('닫기 신호 발행')).toHaveLength(0);

        server.failing = false;
        await service.publishClose([TRIGGER_1]);
        expect(
          log.mock.calls.filter(([m]) =>
            String(m).includes('닫기 신호 발행 복구'),
          ),
        ).toHaveLength(1);
      });

      it('응답을 2초까지만 기다리고 넘기면 error 로 남긴다', async () => {
        jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
        try {
          const base = server.client();
          base.publish = () => new Promise<number>(() => undefined);
          const service = new SseFanoutService({
            getClientOrNull: () => base as unknown as Redis,
          } as unknown as RedisConnectionProvider);
          service.onModuleInit();
          const done = service.publishClose([TRIGGER_1]);
          await jest.advanceTimersByTimeAsync(2_000);
          await expect(done).resolves.toBeUndefined();
          expect(errors()).toHaveLength(1);
        } finally {
          jest.useRealTimers();
        }
      });
    });
  });

  describe('구독 연결', () => {
    it('부팅 때 이름을 붙인 구독 연결을 만들고 닫기 채널을 구독한다', () => {
      const { sub, duplicateOptions } = boot(server);
      expect(duplicateOptions).toEqual({
        connectionName: SSE_SUBSCRIBER_CONNECTION_NAME,
      });
      expect(sub.subscribeCalls).toEqual([[SSE_CLOSE_CHANNEL]]);
    });

    it('ready 가 되면 닫기 채널과 구독 중인 live 채널을 다시 구독한다', async () => {
      const { service, sub } = boot(server);
      await service.retainLive('exec-1');
      await service.retainLive('exec-2');
      service.releaseLive('exec-2');
      sub.emit('ready');
      expect(sub.subscribeCalls.at(-1)).toEqual([
        SSE_CLOSE_CHANNEL,
        sseLiveChannel('exec-1'),
      ]);
    });

    it('끊겼다가 다시 준비되면 재구독을 확인한 뒤 구독 중인 실행을 onLiveResumed 로 알린다', async () => {
      const { service, sub, handlers } = boot(server);
      await service.retainLive('exec-1');
      await service.retainLive('exec-2');
      // 첫 준비. 그 전에 보낸 SUBSCRIBE 는 retainLive 가 확인하므로 알리지 않는다.
      sub.emit('ready');
      await flush();
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();

      service.releaseLive('exec-2');
      sub.emit('ready');
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();
      await flush();
      expect(handlers.onLiveResumed).toHaveBeenCalledTimes(1);
      expect(handlers.onLiveResumed).toHaveBeenCalledWith(['exec-1']);
    });

    it('재구독이 실패하면 알리지 않고 경고를 남긴다', async () => {
      const { service, sub, handlers } = boot(server);
      await service.retainLive('exec-1');
      sub.emit('ready');
      await flush();
      server.failing = true;
      sub.emit('ready');
      await flush();
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();
      expect(warnings('재구독')).toHaveLength(1);
    });

    it('재구독 확인 전에 구독을 다 풀었으면 알리지 않는다', async () => {
      const { service, sub, handlers } = boot(server);
      await service.retainLive('exec-1');
      sub.emit('ready');
      await flush();
      sub.emit('ready');
      service.releaseLive('exec-1');
      await flush();
      expect(handlers.onLiveResumed).not.toHaveBeenCalled();
    });

    it('연결 오류는 한 번만 경고하고 ready 때 복구를 남긴다', () => {
      const { sub } = boot(server);
      sub.emit('error', new Error('ECONNRESET'));
      sub.emit('error', new Error('ECONNRESET'));
      expect(warnings('구독 연결')).toHaveLength(1);
      sub.emit('ready');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('구독 연결 복구'),
      );
    });

    it('onModuleDestroy 가 구독 연결을 닫고 이후 명령은 실패 값이다', async () => {
      const { service, sub } = boot(server);
      await service.onModuleDestroy();
      expect(sub.quitCalled).toBe(true);
      expect(service.isEnabled()).toBe(false);
      expect(await service.append(ev(1))).toBe('failed');
    });
  });

  describe('연결 상한', () => {
    const key = sseConnectionSlotsKey('exec-1');

    it('상한까지 자리를 잡고 키 TTL 을 45초로 건다', async () => {
      const { service } = boot(server);
      expect(await service.acquireSlot('exec-1', 's1', 2)).toBe(true);
      expect(await service.acquireSlot('exec-1', 's2', 2)).toBe(true);
      expect(await service.acquireSlot('exec-1', 's3', 2)).toBe(false);
      expect(Array.from(server.zsets.get(key)!.keys())).toEqual(['s1', 's2']);
      const ttl = server.pttl(key);
      expect(ttl).toBeLessThanOrEqual(45_000);
      expect(ttl).toBeGreaterThan(44_000);
    });

    it('점수가 45초보다 오래된 자리는 지우고 센다', async () => {
      const { service } = boot(server);
      await service.acquireSlot('exec-1', 's1', 1);
      server.zsets.get(key)!.set('s1', Date.now() - 45_001);
      expect(await service.acquireSlot('exec-1', 's2', 1)).toBe(true);
      expect(server.zsets.get(key)!.has('s1')).toBe(false);
    });

    it('refreshSlot 은 점수와 TTL 을 갱신하고 releaseSlot 은 자리를 지운다', async () => {
      const { service } = boot(server);
      await service.acquireSlot('exec-1', 's1', 3);
      server.zsets.get(key)!.set('s1', 0);
      server.expiresAt.set(key, Date.now() + 10);
      service.refreshSlot('exec-1', 's1');
      await flush();
      expect(server.zsets.get(key)!.get('s1')).toBeGreaterThan(
        Date.now() - 1_000,
      );
      expect(server.pttl(key)).toBeGreaterThan(44_000);
      service.releaseSlot('exec-1', 's1');
      await flush();
      expect(server.zsets.get(key)!.has('s1')).toBe(false);
    });

    it.each(['zadd', 'pexpire'] as const)(
      'refreshSlot 은 pipeline 의 %s 하나만 실패해도 경고를 한 번 남기고 성공하면 복구를 남긴다',
      async (command) => {
        const { service } = boot(server);
        await service.acquireSlot('exec-1', 's1', 3);
        server.failPipelineCommands.add(command);
        service.refreshSlot('exec-1', 's1');
        service.refreshSlot('exec-1', 's1');
        await flush();
        expect(warnings('연결 상한 갱신')).toHaveLength(1);

        server.failPipelineCommands.clear();
        service.refreshSlot('exec-1', 's1');
        await flush();
        expect(
          log.mock.calls.filter(([m]) =>
            String(m).includes('연결 상한 갱신 복구'),
          ),
        ).toHaveLength(1);
      },
    );

    it('refreshSlot 은 exec() 가 결과 없이 끝나도 실패로 본다', async () => {
      const { service } = boot(server);
      server.pipelineExecReturnsNull = true;
      service.refreshSlot('exec-1', 's1');
      await flush();
      expect(warnings('연결 상한 갱신')).toHaveLength(1);
    });

    it('Redis 가 실패하면 null 이다', async () => {
      const { service } = boot(server);
      server.failing = true;
      expect(await service.acquireSlot('exec-1', 's1', 3)).toBeNull();
      service.refreshSlot('exec-1', 's1');
      service.releaseSlot('exec-1', 's1');
      await flush();
      expect(warnings('연결 상한')).toHaveLength(3);
    });
  });
});

/**
 * Redis 강등이 `clemvion.redis.fail_open` 카운터에 `sse_fanout/<reason>` 으로 잡히는지 본다. 경고 로그는 같은 실패 종류마다
 * 복구 전까지 한 번만 남지만 카운터는 실패마다 오른다. 반환값은 위 블록이 고정한 실패 값 그대로여야 한다.
 */
describe('SseFanoutService — fail-open 관측 (metrics)', () => {
  let server: FakeRedisServer;
  let metrics: MetricsStub;
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    server = new FakeRedisServer();
    metrics = { recordRedisFailOpen: jest.fn() };
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    log.mockRestore();
    error.mockRestore();
  });

  function warnings(op: string): unknown[][] {
    return warn.mock.calls.filter(([m]) => String(m).includes(op));
  }

  function expectRecordedOnce(reason: string): void {
    expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(1);
    expect(metrics.recordRedisFailOpen).toHaveBeenCalledWith(
      'sse_fanout',
      reason,
    );
  }

  describe('subscribe_failed', () => {
    it('구독 연결 오류는 경고를 한 번만 남겨도 오류마다 센다', () => {
      const { sub } = boot(server, metrics);
      sub.emit('error', new Error('ECONNRESET'));
      sub.emit('error', new Error('ECONNRESET'));
      expect(warnings('구독 연결')).toHaveLength(1);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(2);
      expect(metrics.recordRedisFailOpen).toHaveBeenNthCalledWith(
        1,
        'sse_fanout',
        'subscribe_failed',
      );
      expect(metrics.recordRedisFailOpen).toHaveBeenNthCalledWith(
        2,
        'sse_fanout',
        'subscribe_failed',
      );
    });

    it('부팅 때 닫기 채널 SUBSCRIBE 가 실패하면 센다', async () => {
      server.failing = true;
      boot(server, metrics);
      await flush();
      expectRecordedOnce('subscribe_failed');
    });

    it('live 채널 SUBSCRIBE 가 실패하면 false 이고 센다', async () => {
      const { service } = boot(server, metrics);
      await flush();
      server.failing = true;
      expect(await service.retainLive('exec-1')).toBe(false);
      expectRecordedOnce('subscribe_failed');
    });

    it('live 채널 SUBSCRIBE 가 2초를 넘기면 한 번 세고 늦은 확인은 더 세지 않는다', async () => {
      jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
      try {
        const { service, sub } = boot(server, metrics);
        await flushMicrotasks();
        let resolve: (n: number) => void = () => undefined;
        sub.subscribe = () =>
          new Promise<number>((r) => {
            resolve = r;
          });
        const confirmed = service.retainLive('exec-1');
        await jest.advanceTimersByTimeAsync(2_000);
        expect(await confirmed).toBe(false);
        resolve(1);
        await flushMicrotasks();
        expectRecordedOnce('subscribe_failed');
      } finally {
        jest.useRealTimers();
      }
    });

    it('live 채널 UNSUBSCRIBE 가 실패하면 센다', async () => {
      const { service, sub } = boot(server, metrics);
      expect(await service.retainLive('exec-1')).toBe(true);
      sub.unsubscribe = () => Promise.reject(new Error('ECONNRESET'));
      service.releaseLive('exec-1');
      await flush();
      expectRecordedOnce('subscribe_failed');
    });

    it('ready 뒤 재구독이 실패하면 센다', async () => {
      const { service, sub } = boot(server, metrics);
      await service.retainLive('exec-1');
      server.failing = true;
      sub.emit('ready');
      await flush();
      expectRecordedOnce('subscribe_failed');
    });
  });

  describe('append', () => {
    it.each<[string, string, string, (s: FakeRedisServer) => void]>([
      [
        'pipeline exec 가 reject',
        'failed',
        'write_failed',
        (s) => {
          s.failing = true;
        },
      ],
      [
        'XADD 명령 오류',
        'failed',
        'write_failed',
        (s) => {
          s.failPipelineCommands.add('xadd');
        },
      ],
      [
        'exec() 가 결과 없이 끝남',
        'failed',
        'write_failed',
        (s) => {
          s.pipelineExecReturnsNull = true;
        },
      ],
      [
        'PEXPIRE 만 실패',
        'stored',
        'write_failed',
        (s) => {
          s.failPipelineCommands.add('pexpire');
        },
      ],
      [
        'PUBLISH 만 실패',
        'stored',
        'publish_failed',
        (s) => {
          s.failPipelineCommands.add('publish');
        },
      ],
      [
        'PEXPIRE 와 PUBLISH 가 함께 실패',
        'stored',
        'publish_failed',
        (s) => {
          s.failPipelineCommands.add('pexpire');
          s.failPipelineCommands.add('publish');
        },
      ],
    ])('%s → %s 이고 %s 를 한 번 센다', async (_, result, reason, fail) => {
      const { service } = boot(server, metrics);
      await flush();
      fail(server);
      expect(await service.append(ev(1))).toBe(result);
      expectRecordedOnce(reason);
    });

    it('경고는 복구 전까지 한 번이어도 실패마다 센다', async () => {
      const { service } = boot(server, metrics);
      await flush();
      server.failing = true;
      expect(await service.append(ev(1))).toBe('failed');
      expect(await service.append(ev(2))).toBe('failed');
      expect(warnings('버퍼 쓰기')).toHaveLength(1);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(2);
      expect(metrics.recordRedisFailOpen).toHaveBeenNthCalledWith(
        2,
        'sse_fanout',
        'write_failed',
      );
    });

    it('JSON 으로 바꾸지 못하는 payload 는 Redis 실패가 아니라 세지 않는다 (failed · 경고 · 복구는 그대로)', async () => {
      const { service } = boot(server, metrics);
      await flush();
      const unserializable: ExecutionChannelEvent = {
        executionId: 'exec-1',
        eventType: 'execution.node.started',
        seq: 1,
        payload: { big: BigInt(1) },
      };
      expect(await service.append(unserializable)).toBe('failed');
      expect(warnings('버퍼 쓰기')).toHaveLength(1);
      expect(await service.append(ev(2))).toBe('stored');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('버퍼 쓰기 복구'),
      );
      expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
    });
  });

  describe('read_failed', () => {
    it('readBuffer 의 XRANGE 가 실패하면 null 이고 센다', async () => {
      const { service } = boot(server, metrics);
      await flush();
      server.failing = true;
      expect(await service.readBuffer('exec-1')).toBeNull();
      expectRecordedOnce('read_failed');
    });

    it('readLatestSeq 의 GET 이 실패하면 null 이고 센다', async () => {
      const { service } = boot(server, metrics);
      await flush();
      server.failing = true;
      expect(await service.readLatestSeq('exec-1')).toBeNull();
      expectRecordedOnce('read_failed');
    });
  });

  describe('slot_failed', () => {
    it('acquireSlot 의 EVAL 이 실패하면 null 이고 센다', async () => {
      const { service } = boot(server, metrics);
      await flush();
      server.failing = true;
      expect(await service.acquireSlot('exec-1', 's1', 3)).toBeNull();
      expectRecordedOnce('slot_failed');
    });

    it.each<[string, (s: FakeRedisServer) => void]>([
      [
        'exec 가 reject',
        (s) => {
          s.failing = true;
        },
      ],
      [
        'ZADD 명령 오류',
        (s) => {
          s.failPipelineCommands.add('zadd');
        },
      ],
      [
        'PEXPIRE 명령 오류',
        (s) => {
          s.failPipelineCommands.add('pexpire');
        },
      ],
      [
        'exec() 가 결과 없이 끝남',
        (s) => {
          s.pipelineExecReturnsNull = true;
        },
      ],
    ])('refreshSlot: %s → 한 번 센다', async (_, fail) => {
      const { service } = boot(server, metrics);
      await service.acquireSlot('exec-1', 's1', 3);
      fail(server);
      service.refreshSlot('exec-1', 's1');
      await flush();
      expectRecordedOnce('slot_failed');
    });

    it('releaseSlot 의 ZREM 이 실패하면 센다', async () => {
      const { service } = boot(server, metrics);
      await service.acquireSlot('exec-1', 's1', 3);
      server.failing = true;
      service.releaseSlot('exec-1', 's1');
      await flush();
      expectRecordedOnce('slot_failed');
    });
  });

  describe('publish_failed (닫기 신호)', () => {
    it('publishClose 실패는 던지지 않고 호출마다 센다', async () => {
      const { service } = boot(server, metrics);
      await flush();
      server.failing = true;
      await expect(service.publishClose([TRIGGER_1])).resolves.toBeUndefined();
      await service.publishClose([TRIGGER_1]);
      expect(metrics.recordRedisFailOpen).toHaveBeenCalledTimes(2);
      expect(metrics.recordRedisFailOpen).toHaveBeenNthCalledWith(
        1,
        'sse_fanout',
        'publish_failed',
      );
      expect(metrics.recordRedisFailOpen).toHaveBeenNthCalledWith(
        2,
        'sse_fanout',
        'publish_failed',
      );
    });
  });

  it('성공 경로에서는 기록하지 않는다', async () => {
    const { service, sub } = boot(server, metrics);
    await flush();
    expect(await service.append(ev(1))).toBe('stored');
    expect(await service.readBuffer('exec-1')).not.toBeNull();
    server.strings.set('exec:seq:exec-1', '1');
    expect(await service.readLatestSeq('exec-1')).toBe(1);
    expect(await service.retainLive('exec-1')).toBe(true);
    sub.emit('ready');
    await flush();
    service.releaseLive('exec-1');
    await service.publishClose([TRIGGER_1]);
    expect(await service.acquireSlot('exec-1', 's1', 3)).toBe(true);
    service.refreshSlot('exec-1', 's1');
    service.releaseSlot('exec-1', 's1');
    await flush();
    expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
  });

  it('Redis 없이 부팅하면 모든 명령이 실패 값이어도 기록하지 않는다', async () => {
    const service = new SseFanoutService(
      { getClientOrNull: () => null } as unknown as RedisConnectionProvider,
      metrics as never,
    );
    service.onModuleInit();
    expect(await service.append(ev(1))).toBe('failed');
    expect(await service.readBuffer('exec-1')).toBeNull();
    expect(await service.readLatestSeq('exec-1')).toBeNull();
    expect(await service.retainLive('exec-1')).toBe(false);
    expect(await service.acquireSlot('exec-1', 's1', 3)).toBeNull();
    await service.publishClose([TRIGGER_1]);
    service.releaseLive('exec-1');
    service.refreshSlot('exec-1', 's1');
    service.releaseSlot('exec-1', 's1');
    await flush();
    expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
  });

  it('구독 연결 quit 실패는 세지 않는다', async () => {
    const { service, sub } = boot(server, metrics);
    await flush();
    sub.quit = () => Promise.reject(new Error('ECONNRESET'));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(metrics.recordRedisFailOpen).not.toHaveBeenCalled();
  });

  it('metrics 를 주지 않아도 fail-open 경로가 죽지 않는다 (optional DI)', async () => {
    const { service, sub } = boot(server);
    await flush();
    server.failing = true;
    sub.emit('error', new Error('ECONNRESET'));
    expect(await service.append(ev(1))).toBe('failed');
    expect(await service.readBuffer('exec-1')).toBeNull();
    expect(await service.readLatestSeq('exec-1')).toBeNull();
    expect(await service.retainLive('exec-1')).toBe(false);
    expect(await service.acquireSlot('exec-1', 's1', 3)).toBeNull();
    await expect(service.publishClose([TRIGGER_1])).resolves.toBeUndefined();
    service.refreshSlot('exec-1', 's1');
    service.releaseSlot('exec-1', 's1');
    await flush();
  });
});
