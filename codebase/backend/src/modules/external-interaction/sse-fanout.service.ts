import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { validate as isUuid } from 'uuid';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import { withTimeout } from '../../common/utils/with-timeout';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P`.
// 키 접두 `eia:` 는 이 모듈이 이미 쓰는 접두다([Redis 키 명명 규약 「규칙」](CLE-ENG-REDIS#규칙) 규칙 6).

/** 재연결 replay 를 받아 주는 기간(ms). 버퍼 키의 TTL 이기도 하다. */
export const SSE_REPLAY_WINDOW_MS = 5 * 60 * 1000;
/** 실행 하나의 버퍼에 두는 이벤트 수의 상한. Redis 는 `MAXLEN ~` 라 조금 넘길 수 있다. */
export const SSE_BUFFER_MAX_EVENTS = 1000;
/** SSE heartbeat 주석을 보내는 간격(ms). 연결 상한의 member 점수도 이 간격으로 갱신한다. */
export const SSE_HEARTBEAT_INTERVAL_MS = 15_000;
/** 연결 상한 member 를 오래됐다고 보는 시간(ms). heartbeat 간격의 3배다. 키 TTL 도 같다. */
export const SSE_CONNECTION_SLOT_TTL_MS = 3 * SSE_HEARTBEAT_INTERVAL_MS;
/** 실행 하나에 동시에 열 수 있는 SSE 연결 수. 모든 서버 인스턴스를 합쳐 센다. */
export const SSE_MAX_CONNECTIONS_PER_EXECUTION = 3;

/** 트리거 단위 토큰 스트림 닫기 신호를 모든 서버 인스턴스에 알리는 채널. */
export const SSE_CLOSE_CHANNEL = 'eia:sse:close';
const SSE_LIVE_CHANNEL_PREFIX = 'eia:sse:live:';

/** 실행별 replay 버퍼(Redis Stream) 키. */
export function sseBufferKey(executionId: string): string {
  return `eia:sse:buf:${executionId}`;
}

/** 실행별 실시간 전달 채널. */
export function sseLiveChannel(executionId: string): string {
  return `${SSE_LIVE_CHANNEL_PREFIX}${executionId}`;
}

/** 실행별 연결 상한 ZSET 키. member 는 구독 id, 점수는 마지막 heartbeat 시각(ms)이다. */
export function sseConnectionSlotsKey(executionId: string): string {
  return `eia:sse:subs:${executionId}`;
}

/**
 * 실행 이벤트 순번 카운터 키. 쓰는 쪽은 `ExecutionSeqAllocator`(`execution-seq-allocator.service.ts`)다. 이벤트마다 INCR 하고
 * TTL 을 24시간(`EXECUTION_SEQ_TTL_SECONDS`)으로 늘리며 종료 이벤트 뒤 지운다. 여기서는 읽기만 한다.
 */
function executionSeqKey(executionId: string): string {
  return `exec:seq:${executionId}`;
}

/**
 * 연결 자리 하나를 원자적으로 잡는다. 오래된 member 를 지우고, 수를 확인하고, 자리가 있으면 더한다.
 * 시각은 서버 인스턴스의 시계로 넘긴다. 인스턴스 사이의 시계 차이가 TTL(45초)보다 훨씬 작다는 전제다.
 *
 * KEYS[1] 연결 상한 키. ARGV 는 지금 시각, 이보다 오래된 점수를 지울 기준 시각, 상한, member, 키 TTL(ms) 순서다.
 * 잡았으면 1, 상한이면 0 을 돌려준다.
 */
export const SSE_ACQUIRE_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', '(' .. ARGV[2])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

/** 메시지 형식 버전. 형식을 바꾸면 올리고, 모르는 버전은 받는 쪽이 버린다. */
const MESSAGE_VERSION = 1;
/** Stream 항목에서 메시지 JSON 을 담는 필드 이름. */
const BUFFER_FIELD = 'data';

/**
 * 요청 경로에서 Redis 응답을 기다리는 상한(ms). 공유 연결이 끊겨 있으면 ioredis 는 명령을 쌓아 두었다가 재연결
 * 시도가 거듭된 뒤에야 거부한다. 넘으면 실패로 보고 메모리 동작으로 넘어간다. `channel-listener.bus.ts` 와 같은 값이다.
 */
const REDIS_WAIT_TIMEOUT_MS = 2000;

/** 버퍼에서 읽은 이벤트 하나. `receivedAt` 은 Stream 항목 id 의 시각(ms)이다. */
export interface BufferedSseEvent {
  seq: number;
  receivedAt: number;
  event: ExecutionChannelEvent;
}

/** 다른 서버 인스턴스에서 온 신호를 받는 쪽. `SseAdapter` 가 건다. */
export interface SseFanoutHandlers {
  onLiveEvent(event: ExecutionChannelEvent): void;
  onRemoteClose(triggerIds: string[]): void;
}

/**
 * EIA SSE 를 여러 서버 인스턴스로 나눠 받기 위한 Redis 쪽 저장과 신호.
 *
 * - replay 버퍼: 실행별 Redis Stream {@link sseBufferKey}. `XADD MAXLEN ~ 1000` 과 `PEXPIRE 300000` 을 한 pipeline 으로
 *   보낸다. 마지막 이벤트 뒤 5분이면 키가 사라진다.
 * - 실시간 전달: 같은 pipeline 의 `PUBLISH` 로 실행별 채널 {@link sseLiveChannel} 에 보낸다. 구독은 그 실행의 로컬 구독자가
 *   있는 동안만 전용 연결(`duplicate()`)로 한다. 자기가 보낸 메시지는 `origin` 으로 알아보고 건너뛴다. 자기 이벤트는
 *   `SseAdapter` 가 Redis 를 거치지 않고 바로 전달한다.
 * - 닫기 신호: 전역 채널 {@link SSE_CLOSE_CHANNEL}. `channel-listener.bus.ts` 와 같은 방식이다(`origin`, 발행 2초 상한,
 *   실패해도 던지지 않음, 구독 연결이 `ready` 가 되면 다시 구독).
 * - 연결 상한: 실행별 ZSET {@link sseConnectionSlotsKey}. {@link SSE_ACQUIRE_SLOT_SCRIPT} 로 원자적으로 잡는다.
 *
 * **실패 정책**: 부팅 때 Redis 가 없으면(`getClientOrNull()` 이 `null`) 아무것도 하지 않는다. 명령이 실패하면 호출자에게
 * 실패를 값(`false` · `null`)으로 알리고 던지지 않는다. 호출자(`SseAdapter`)는 이 서버 인스턴스의 메모리로 동작한다.
 * 경고는 실패 종류마다 한 번만 남기고 그 종류가 다시 성공하면 복구를 남긴다.
 */
@Injectable()
export class SseFanoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseFanoutService.name);
  /** 이 프로세스의 id. 자기 메시지를 알아보는 데만 쓴다. */
  private readonly origin = randomUUID();
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private handlers: SseFanoutHandlers | null = null;
  /** 실행별 live 채널 구독의 참조 수와 SUBSCRIBE 확인. */
  private readonly liveChannels = new Map<
    string,
    { refs: number; confirmed: Promise<boolean> }
  >();
  /** 경고를 남긴 실패 종류. 같은 종류가 다시 성공할 때까지 경고를 다시 남기지 않는다. */
  private readonly degradedOps = new Set<string>();

  constructor(private readonly redis: RedisConnectionProvider) {}

  onModuleInit(): void {
    const base = this.redis.getClientOrNull();
    if (!base) {
      this.logger.warn(
        'Redis 미가용 — EIA SSE 를 이 서버 인스턴스의 메모리로만 처리한다. 다른 서버 인스턴스가 낸 이벤트는 받지 못한다',
      );
      return;
    }
    this.client = base;
    const sub = base.duplicate();
    sub.on('error', (err: Error) => this.degrade('구독 연결', err));
    sub.on('message', (channel: string, message: string) =>
      this.onMessage(channel, message),
    );
    sub.on('ready', () => {
      this.recover('구독 연결');
      this.resubscribe(sub);
    });
    sub.subscribe(SSE_CLOSE_CHANNEL).catch((err: unknown) => {
      this.degrade('닫기 채널 구독', err);
    });
    this.subscriber = sub;
  }

  async onModuleDestroy(): Promise<void> {
    const sub = this.subscriber;
    this.subscriber = null;
    this.client = null;
    this.liveChannels.clear();
    if (sub) await sub.quit().catch(() => undefined);
  }

  /** Redis 로 동작하는지. `false` 면 호출자가 메모리로만 동작한다. */
  isEnabled(): boolean {
    return this.client !== null;
  }

  /** 다른 서버 인스턴스에서 온 이벤트 · 닫기 신호를 받을 쪽을 건다. */
  bind(handlers: SseFanoutHandlers): void {
    this.handlers = handlers;
  }

  /**
   * 이벤트를 replay 버퍼에 넣고 live 채널로 보낸다. 버퍼에 넣었으면 `true` 다. 실패하면 `false` 이고 던지지 않는다.
   * `XADD` 와 `PUBLISH` 를 한 pipeline 으로 보내므로 PUBLISH 를 받은 쪽이 같은 연결로 읽는 버퍼에는 그 항목이 있다.
   */
  async append(event: ExecutionChannelEvent): Promise<boolean> {
    const client = this.client;
    if (!client) return false;
    const message = this.encodeEvent(event);
    try {
      const results = await client
        .pipeline()
        .xadd(
          sseBufferKey(event.executionId),
          'MAXLEN',
          '~',
          SSE_BUFFER_MAX_EVENTS,
          '*',
          BUFFER_FIELD,
          message,
        )
        .pexpire(sseBufferKey(event.executionId), SSE_REPLAY_WINDOW_MS)
        .publish(sseLiveChannel(event.executionId), message)
        .exec();
      // XADD 가 실패했으면 버퍼에 없다.
      const xaddError = results
        ? results[0]?.[0]
        : new Error('pipeline 결과 없음');
      if (!results || xaddError) {
        this.degrade('버퍼 쓰기', xaddError);
        return false;
      }
      this.recover('버퍼 쓰기');
      // PEXPIRE · PUBLISH 실패는 경고만 남긴다. TTL 은 다음 이벤트의 PEXPIRE 가 다시 건다. 놓친 실시간 전달은
      // 클라이언트가 Last-Event-Id 로 다시 연결해 replay 로 받는다.
      const restError = results.slice(1).find(([err]) => err)?.[0];
      if (restError) {
        this.degrade('버퍼 TTL · 발행', restError);
      } else {
        this.recover('버퍼 TTL · 발행');
      }
      return true;
    } catch (err) {
      this.degrade('버퍼 쓰기', err);
      return false;
    }
  }

  /**
   * 실행의 replay 버퍼를 넣은 순서대로 읽는다. 5분이 지난 항목도 키가 남아 있으면 함께 돌려준다(걸러 내는 것은 호출자다).
   * 실패하면 `null` 이다. 형식이 맞지 않는 항목은 버린다.
   */
  async readBuffer(executionId: string): Promise<BufferedSseEvent[] | null> {
    const client = this.client;
    if (!client) return null;
    let entries: Array<[string, string[]]>;
    try {
      entries = await withTimeout(
        client.xrange(sseBufferKey(executionId), '-', '+'),
        REDIS_WAIT_TIMEOUT_MS,
        'XRANGE',
      );
      this.recover('버퍼 읽기');
    } catch (err) {
      this.degrade('버퍼 읽기', err);
      return null;
    }
    const buffered: BufferedSseEvent[] = [];
    for (const [id, fields] of entries) {
      const raw = readField(fields, BUFFER_FIELD);
      const parsed = raw === null ? null : this.decodeEvent(raw, executionId);
      const receivedAt = Number(id.split('-')[0]);
      if (!parsed || !Number.isFinite(receivedAt)) continue;
      buffered.push({ seq: parsed.event.seq, receivedAt, event: parsed.event });
    }
    return buffered;
  }

  /**
   * 실행이 지금까지 낸 마지막 seq 다. 카운터가 없거나(이벤트를 낸 적 없음 · 종료 뒤 지움 · 24시간 만료) 읽지 못하면
   * `null` 이다. replay 버퍼 키가 사라진 뒤 재연결이 이벤트를 놓쳤는지 판정하는 데 쓴다.
   */
  async readLatestSeq(executionId: string): Promise<number | null> {
    const client = this.client;
    if (!client) return null;
    try {
      const raw = await withTimeout(
        client.get(executionSeqKey(executionId)),
        REDIS_WAIT_TIMEOUT_MS,
        'GET',
      );
      this.recover('순번 읽기');
      const seq = raw === null ? NaN : Number(raw);
      return Number.isSafeInteger(seq) ? seq : null;
    } catch (err) {
      this.degrade('순번 읽기', err);
      return null;
    }
  }

  /**
   * 실행의 live 채널을 구독한다. 첫 로컬 구독자일 때만 SUBSCRIBE 를 보내고 나머지는 참조 수만 올린다. 참조 수는 바로
   * 올라가므로 돌려준 Promise 를 기다리는 동안 {@link releaseLive} 를 불러도 짝이 맞는다.
   *
   * SUBSCRIBE 가 처리됐으면 `true` 다. 실패하거나 {@link REDIS_WAIT_TIMEOUT_MS} 를 넘으면 `false` 이고, 다른 서버
   * 인스턴스의 이벤트는 구독 연결이 다시 `ready` 가 된 뒤부터 받는다.
   */
  retainLive(executionId: string): Promise<boolean> {
    const sub = this.subscriber;
    if (!sub) return Promise.resolve(false);
    const existing = this.liveChannels.get(executionId);
    if (existing) {
      existing.refs += 1;
      return existing.confirmed;
    }
    const confirmed = withTimeout(
      sub.subscribe(sseLiveChannel(executionId)),
      REDIS_WAIT_TIMEOUT_MS,
      'SUBSCRIBE',
    ).then(
      () => {
        this.recover('live 채널 구독');
        return true;
      },
      (err: unknown) => {
        this.degrade('live 채널 구독', err);
        return false;
      },
    );
    this.liveChannels.set(executionId, { refs: 1, confirmed });
    return confirmed;
  }

  /** {@link retainLive} 의 짝. 마지막 참조가 빠지면 UNSUBSCRIBE 한다. */
  releaseLive(executionId: string): void {
    const state = this.liveChannels.get(executionId);
    if (!state) return;
    state.refs -= 1;
    if (state.refs > 0) return;
    this.liveChannels.delete(executionId);
    const sub = this.subscriber;
    if (!sub) return;
    sub.unsubscribe(sseLiveChannel(executionId)).catch((err: unknown) => {
      this.degrade('live 채널 구독 해제', err);
    });
  }

  /**
   * 트리거 단위 토큰 스트림 닫기를 다른 서버 인스턴스에 알린다. 던지지 않는다. 응답은 {@link REDIS_WAIT_TIMEOUT_MS} 까지만
   * 기다린다. 상한을 넘긴 뒤 늦게 온 거부도 `withTimeout` 이 받아서 처리되지 않은 거부로 새지 않는다.
   */
  async publishClose(triggerIds: readonly string[]): Promise<void> {
    const client = this.client;
    if (!client || triggerIds.length === 0) return;
    const message = JSON.stringify({
      v: MESSAGE_VERSION,
      origin: this.origin,
      triggerIds,
    });
    try {
      await withTimeout(
        client.publish(SSE_CLOSE_CHANNEL, message),
        REDIS_WAIT_TIMEOUT_MS,
        'PUBLISH',
      );
      this.recover('닫기 신호 발행');
    } catch (err) {
      this.degrade('닫기 신호 발행', err);
    }
  }

  /**
   * 연결 자리를 잡는다. 잡았으면 `true`, 상한이면 `false` 다. Redis 를 쓸 수 없으면 `null` 이고 호출자가 이 서버
   * 인스턴스 안에서 센다.
   */
  async acquireSlot(
    executionId: string,
    subscriberId: string,
    limit: number,
  ): Promise<boolean | null> {
    const client = this.client;
    if (!client) return null;
    const now = Date.now();
    try {
      const acquired = await withTimeout(
        client.eval(
          SSE_ACQUIRE_SLOT_SCRIPT,
          1,
          sseConnectionSlotsKey(executionId),
          now,
          now - SSE_CONNECTION_SLOT_TTL_MS,
          limit,
          subscriberId,
          SSE_CONNECTION_SLOT_TTL_MS,
        ),
        REDIS_WAIT_TIMEOUT_MS,
        'EVAL',
      );
      this.recover('연결 상한');
      return Number(acquired) === 1;
    } catch (err) {
      this.degrade('연결 상한', err);
      return null;
    }
  }

  /** heartbeat 때 부른다. 잡은 자리의 시각과 키 TTL 을 갱신한다. 실패는 경고만 남긴다. */
  refreshSlot(executionId: string, subscriberId: string): void {
    const client = this.client;
    if (!client) return;
    const key = sseConnectionSlotsKey(executionId);
    client
      .pipeline()
      .zadd(key, Date.now(), subscriberId)
      .pexpire(key, SSE_CONNECTION_SLOT_TTL_MS)
      .exec()
      .then(() => this.recover('연결 상한 갱신'))
      .catch((err: unknown) => this.degrade('연결 상한 갱신', err));
  }

  /** 연결이 끝나면 부른다. 지우지 못해도 TTL 이 지나면 다음 연결 때 지워진다. */
  releaseSlot(executionId: string, subscriberId: string): void {
    const client = this.client;
    if (!client) return;
    client
      .zrem(sseConnectionSlotsKey(executionId), subscriberId)
      .catch((err: unknown) => this.degrade('연결 상한 해제', err));
  }

  private resubscribe(sub: Redis): void {
    const channels = [
      SSE_CLOSE_CHANNEL,
      ...Array.from(this.liveChannels.keys(), sseLiveChannel),
    ];
    sub.subscribe(...channels).catch((err: unknown) => {
      this.degrade('재구독', err);
    });
  }

  private onMessage(channel: string, message: string): void {
    const handlers = this.handlers;
    if (!handlers) return;
    if (channel === SSE_CLOSE_CHANNEL) {
      const triggerIds = this.decodeClose(message);
      if (triggerIds) handlers.onRemoteClose(triggerIds);
      return;
    }
    if (!channel.startsWith(SSE_LIVE_CHANNEL_PREFIX)) return;
    const executionId = channel.slice(SSE_LIVE_CHANNEL_PREFIX.length);
    if (!this.liveChannels.has(executionId)) return;
    const parsed = this.decodeEvent(message, executionId);
    // 자기 이벤트는 `SseAdapter` 가 이미 바로 전달했다.
    if (!parsed || parsed.origin === this.origin) return;
    handlers.onLiveEvent(parsed.event);
  }

  private encodeEvent(event: ExecutionChannelEvent): string {
    return JSON.stringify({
      v: MESSAGE_VERSION,
      origin: this.origin,
      event: {
        executionId: event.executionId,
        eventType: event.eventType,
        seq: event.seq,
        payload: event.payload,
      },
    });
  }

  /**
   * 버퍼 항목 · live 메시지를 이벤트로 바꾼다. 형식이 맞지 않거나 다른 실행의 것이면 `null` 이다. Redis 는 믿는 저장소지만
   * 형식까지 믿지는 않는다.
   */
  private decodeEvent(
    message: string,
    executionId: string,
  ): { origin: string; event: ExecutionChannelEvent } | null {
    const m = parseObject(message);
    if (!m || m.v !== MESSAGE_VERSION) return null;
    if (typeof m.origin !== 'string' || m.origin.length === 0) return null;
    const e = m.event;
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return null;
    const event = e as Record<string, unknown>;
    if (event.executionId !== executionId) return null;
    if (typeof event.eventType !== 'string') return null;
    if (typeof event.seq !== 'number' || !Number.isFinite(event.seq)) {
      return null;
    }
    const payload = event.payload;
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return null;
    }
    return {
      origin: m.origin,
      event: {
        executionId,
        eventType: event.eventType,
        seq: event.seq,
        payload: payload as Record<string, unknown>,
      },
    };
  }

  /** 다른 서버 인스턴스가 보낸 올바른 닫기 신호만 트리거 id 목록으로 바꾼다. 나머지는 `null` 이다. */
  private decodeClose(message: string): string[] | null {
    const m = parseObject(message);
    if (!m || m.v !== MESSAGE_VERSION) return null;
    if (typeof m.origin !== 'string' || m.origin.length === 0) return null;
    if (m.origin === this.origin) return null;
    const ids = m.triggerIds;
    if (!Array.isArray(ids) || ids.length === 0) return null;
    if (!ids.every((id) => typeof id === 'string' && isUuid(id))) return null;
    return ids as string[];
  }

  private degrade(op: string, err: unknown): void {
    if (this.degradedOps.has(op)) return;
    this.degradedOps.add(op);
    this.logger.warn(
      `EIA SSE Redis ${op} 실패 — 이 서버 인스턴스의 메모리로 처리한다(복구될 때까지 다시 남기지 않는다): ${errMessage(err)}`,
    );
  }

  private recover(op: string): void {
    if (!this.degradedOps.delete(op)) return;
    this.logger.log(`EIA SSE Redis ${op} 복구`);
  }
}

function parseObject(message: string): Record<string, unknown> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(message);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, unknown>;
}

/** Stream 항목의 `[필드, 값, 필드, 값, …]` 에서 필드 값을 찾는다. */
function readField(fields: string[], name: string): string | null {
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === name) return fields[i + 1];
  }
  return null;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
