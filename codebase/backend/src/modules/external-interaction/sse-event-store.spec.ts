import { Logger } from '@nestjs/common';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import type {
  BufferedSseEvent,
  SseAppendResult,
  SseFanoutService,
} from './sse-fanout.service';
import { SseEventStore, SseMemoryBuffer } from './sse-event-store';
import { SSE_BUFFER_MAX_EVENTS, SSE_REPLAY_WINDOW_MS } from './sse.constants';
import type { SseStreamEligibilityService } from './sse-stream-eligibility.service';

function event(
  seq: number,
  over: Partial<ExecutionChannelEvent> = {},
): ExecutionChannelEvent {
  return {
    executionId: 'exec-1',
    eventType: 'execution.node_started',
    seq,
    payload: {},
    ...over,
  };
}

interface FakeFanout {
  enabled: boolean;
  appended: ExecutionChannelEvent[];
  appendResult: SseAppendResult;
  remote: { events: BufferedSseEvent[]; skipped: number } | null;
}

function makeStore(fanout: FakeFanout, canOpen: () => Promise<boolean>) {
  const logger = new Logger('test');
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  const canOpenStream = jest.fn(canOpen);
  const store = new SseEventStore(
    {
      isEnabled: () => fanout.enabled,
      append: (e: ExecutionChannelEvent) => {
        fanout.appended.push(e);
        return Promise.resolve(fanout.appendResult);
      },
      readBuffer: () => Promise.resolve(fanout.remote),
      readLatestSeq: () => Promise.resolve(42),
    } as unknown as SseFanoutService,
    { canOpenStream } as unknown as SseStreamEligibilityService,
    logger,
  );
  return { store, warn, canOpenStream };
}

function fanout(over: Partial<FakeFanout> = {}): FakeFanout {
  return {
    enabled: true,
    appended: [],
    appendResult: 'stored',
    remote: { events: [], skipped: 0 },
    ...over,
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('SseMemoryBuffer', () => {
  it('개수 상한을 넘으면 가장 오래된 것부터 버린다', () => {
    const buffer = new SseMemoryBuffer();
    for (let seq = 1; seq <= SSE_BUFFER_MAX_EVENTS + 2; seq++) {
      buffer.remember(event(seq), 1000);
    }
    const events = buffer.events('exec-1');
    expect(events).toHaveLength(SSE_BUFFER_MAX_EVENTS);
    expect(events[0].seq).toBe(3);
  });

  it('넣을 때 5분이 지난 항목을 지우고 sweep 은 마지막 이벤트가 오래된 실행을 지운다', () => {
    const buffer = new SseMemoryBuffer();
    buffer.remember(event(1), 0);
    buffer.remember(event(2), SSE_REPLAY_WINDOW_MS + 1);
    expect(buffer.events('exec-1').map((e) => e.seq)).toEqual([2]);
    buffer.sweep(SSE_REPLAY_WINDOW_MS + 2);
    expect(buffer.size('exec-1')).toBe(0);
  });
});

describe('SseEventStore', () => {
  it('Redis 를 쓸 수 없으면 판정 없이 메모리 버퍼에 두고 그대로 읽는다', async () => {
    const f = fanout({ enabled: false });
    const { store, canOpenStream } = makeStore(f, () => Promise.resolve(true));
    store.store(event(1));
    expect(canOpenStream).not.toHaveBeenCalled();
    expect(f.appended).toHaveLength(0);
    const read = await store.read('exec-1', 0);
    expect(read.complete).toBe(true);
    expect(read.events.map((e) => e.seq)).toEqual([1]);
  });

  it('라우팅 컨텍스트의 triggerId 가 있으면 판정 조회 없이 Redis 에 쓴다', async () => {
    const f = fanout();
    const { store, canOpenStream } = makeStore(f, () => Promise.resolve(false));
    store.store(event(1, { payload: { triggerId: 'trg-1' } }));
    store.store(event(2));
    await flush();
    expect(canOpenStream).not.toHaveBeenCalled();
    expect(f.appended.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('판정을 기다리는 동안 온 이벤트를 모았다가 열 수 없는 실행이면 버린다', async () => {
    const f = fanout();
    let resolve: (open: boolean) => void = () => undefined;
    const { store, canOpenStream } = makeStore(
      f,
      () => new Promise<boolean>((r) => (resolve = r)),
    );
    store.store(event(1));
    store.store(event(2));
    expect(canOpenStream).toHaveBeenCalledTimes(1);
    resolve(false);
    await flush();
    store.store(event(3));
    await flush();
    expect(f.appended).toHaveLength(0);
  });

  it('판정 조회가 던지면 놓치지 않는 쪽으로 모은 이벤트를 순서대로 쓴다', async () => {
    const f = fanout();
    const { store } = makeStore(f, () => Promise.reject(new Error('db')));
    store.store(event(1));
    store.store(event(2));
    await flush();
    expect(f.appended.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('크기 상한으로 생략 표시만 올렸으면 메모리 버퍼에 두고 실행마다 한 번만 경고한다', async () => {
    const f = fanout({ appendResult: 'omitted' });
    const { store, warn } = makeStore(f, () => Promise.resolve(true));
    const routed = { payload: { triggerId: 'trg-1' } };
    store.store(event(1, routed));
    store.store(event(2, routed));
    await flush();
    expect(store.bufferSize('exec-1')).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('읽을 때 같은 순번은 생략 표시보다 메모리 버퍼의 이벤트 전체를 앞세운다', async () => {
    const f = fanout({
      appendResult: 'omitted',
      remote: {
        events: [
          { seq: 1, receivedAt: Date.now(), event: event(1) },
          { seq: 2, receivedAt: Date.now(), event: null },
        ],
        skipped: 3,
      },
    });
    const { store } = makeStore(f, () => Promise.resolve(true));
    store.store(event(2, { payload: { triggerId: 'trg-1' } }));
    await flush();
    const read = await store.read('exec-1', 0);
    expect(read.skipped).toBe(3);
    expect(read.complete).toBe(true);
    const bySeq = new Map(read.events.map((e) => [e.seq, e]));
    expect(bySeq.get(1)?.event).not.toBeNull();
    expect(bySeq.get(2)?.event?.seq).toBe(2);
  });

  it('Redis 버퍼를 읽지 못하면 메모리 버퍼만 주고 다 읽지 못했다고 표시한다', async () => {
    const f = fanout({ remote: null });
    const { store } = makeStore(f, () => Promise.resolve(true));
    const read = await store.read('exec-1', 0);
    expect(read).toEqual({ events: [], skipped: 0, complete: false });
  });

  it('종료 이벤트 뒤에는 쓰기 판정을 지워 다음 이벤트에서 다시 정한다', async () => {
    const f = fanout();
    const { store, canOpenStream } = makeStore(f, () => Promise.resolve(true));
    store.store(event(1, { eventType: 'execution.completed' }));
    await flush();
    store.store(event(2));
    await flush();
    expect(canOpenStream).toHaveBeenCalledTimes(2);
  });
});
