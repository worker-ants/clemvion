import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { validate as isUuid } from 'uuid';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import { TimeoutError, withTimeout } from '../../common/utils/with-timeout';
import {
  BusinessMetricsService,
  type RedisFailOpenReason,
} from '../metrics/business-metrics.service';
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
 * Stream 항목에서 이벤트 순번을 담는 필드 이름. 재연결 replay 는 이 값이 `Last-Event-Id` 이하인 항목의 메시지를 파싱하지
 * 않는다. 이 필드가 없는 항목(롤링 배포 중 옛 서버 인스턴스가 넣은 것)은 그대로 파싱한다.
 */
const SEQ_FIELD = 'seq';

/**
 * Redis 에 올리는 메시지 하나의 최대 크기(UTF-8 바이트). 넘으면 이벤트 대신 생략 표시만 올리고 이벤트 전체는 이 서버
 * 인스턴스의 메모리 버퍼에 둔다. 종료 이벤트는 스트림을 끝내는 이벤트라 상한을 적용하지 않는다. 정한 값이고 재 본 값이
 * 아니다. 근거: CLE-EIA-DATA Rationale 「SSE 의 Redis 쓰기를 줄이고 구독 공백을 메운다」, NERV Task `CLE-T-XPG8DQ`.
 */
export const SSE_BUFFER_MAX_MESSAGE_BYTES = 64 * 1024;

/** 스트림을 끝내는 종료 이벤트. */
export const SSE_TERMINAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

/** 구독 전용 연결의 이름(`CLIENT SETNAME`). 운영에서 연결을 알아볼 때와 e2e 가 연결 끊김을 만들 때 쓴다. */
export const SSE_SUBSCRIBER_CONNECTION_NAME = 'eia-sse-sub';

/**
 * 요청 경로에서 Redis 응답을 기다리는 상한(ms). 공유 연결이 끊겨 있으면 ioredis 는 명령을 쌓아 두었다가 재연결
 * 시도가 거듭된 뒤에야 거부한다. 넘으면 실패로 보고 메모리 동작으로 넘어간다. `channel-listener.bus.ts` 와 같은 값이다.
 */
const REDIS_WAIT_TIMEOUT_MS = 2000;

/**
 * 버퍼에서 읽은 항목 하나. `receivedAt` 은 Stream 항목 id 의 시각(ms)이다. `event` 가 `null` 이면 크기 상한을 넘어 생략
 * 표시만 남은 항목이다(이벤트 전체는 그 이벤트를 낸 서버 인스턴스의 메모리 버퍼에만 있다).
 */
export interface BufferedSseEvent {
  seq: number;
  receivedAt: number;
  event: ExecutionChannelEvent | null;
}

/** {@link SseFanoutService.readBuffer} 의 결과. `skipped` 는 `seq` 필드로 보아 파싱하지 않고 건너뛴 항목 수다. */
export interface SseBufferRead {
  events: BufferedSseEvent[];
  skipped: number;
}

/**
 * {@link SseFanoutService.append} 의 결과. `stored` 는 이벤트 전체를 Redis 에 넣었다. `omitted` 는 크기 상한을 넘어 생략
 * 표시만 넣었다. `failed` 는 넣지 못했다. `stored` 가 아니면 호출자가 이벤트를 메모리 버퍼에 둔다.
 */
export type SseAppendResult = 'stored' | 'omitted' | 'failed';

/** 다른 서버 인스턴스에서 온 신호를 받는 쪽. `SseAdapter` 가 건다. */
export interface SseFanoutHandlers {
  onLiveEvent(event: ExecutionChannelEvent): void;
  /** 다른 서버 인스턴스의 이벤트가 크기 상한을 넘어 생략 표시만 왔다. */
  onLiveOmitted(executionId: string, seq: number): void;
  onRemoteClose(triggerIds: string[]): void;
  /**
   * 실행 채널 구독이 다시 확정됐다. 구독 연결이 다시 준비돼 재구독했거나 상한(2초)을 넘긴 SUBSCRIBE 가 늦게 확인된
   * 경우다. 그 사이 발행된 메시지는 받지 못했을 수 있다.
   */
  onLiveResumed(executionIds: string[]): void;
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
 * 카운터 `clemvion.redis.fail_open{component=sse_fanout}` 는 경고 억제와 따로 실패마다 오른다. reason 은 버퍼 쓰기 ·
 * TTL(`write_failed`), 버퍼 · 순번 읽기(`read_failed`), 연결 상한(`slot_failed`), live · 닫기 신호 발행(`publish_failed`),
 * 구독 연결 · 구독 · 구독 해제 · 재구독(`subscribe_failed`)이다. Redis 미설정 · JSON 변환 실패 · quit 실패는 세지 않는다.
 */
@Injectable()
export class SseFanoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseFanoutService.name);
  /** 이 프로세스의 id. 자기 메시지를 알아보는 데만 쓴다. */
  private readonly origin = randomUUID();
  /**
   * 이 서버 인스턴스가 낸 메시지의 고정 접두. {@link encodeEvent} 가 키 순서(`v`, `origin`, …)를 정하므로 이 접두로
   * 시작하는 live 메시지는 자기 것이다. 자기 이벤트는 `SseAdapter` 가 이미 바로 전달했으므로 파싱하지 않고 버린다.
   */
  private readonly ownMessagePrefix = `{"v":${MESSAGE_VERSION},"origin":${JSON.stringify(this.origin)},`;
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

  constructor(
    private readonly redis: RedisConnectionProvider,
    @Optional() private readonly metrics?: BusinessMetricsService,
  ) {}

  onModuleInit(): void {
    const base = this.redis.getClientOrNull();
    if (!base) {
      this.logger.warn(
        'Redis 미가용 — EIA SSE 를 이 서버 인스턴스의 메모리로만 처리한다. 다른 서버 인스턴스가 낸 이벤트는 받지 못한다',
      );
      return;
    }
    this.client = base;
    const sub = base.duplicate({
      connectionName: SSE_SUBSCRIBER_CONNECTION_NAME,
    });
    sub.on('error', (err: Error) =>
      this.degrade('구독 연결', 'subscribe_failed', err),
    );
    sub.on('message', (channel: string, message: string) =>
      this.onMessage(channel, message),
    );
    // 첫 준비 전에 보낸 SUBSCRIBE 는 오프라인 큐에서 기다렸다가 처리되고, 그 확인은 `retainLive` 가 기다리거나 늦은 확인으로
    // 알린다. 그래서 놓친 구간을 알리는 것은 끊겼다가 다시 준비됐을 때뿐이다.
    let readyBefore = false;
    sub.on('ready', () => {
      this.recover('구독 연결');
      this.resubscribe(sub, readyBefore);
      readyBefore = true;
    });
    sub.subscribe(SSE_CLOSE_CHANNEL).catch((err: unknown) => {
      this.degrade('닫기 채널 구독', 'subscribe_failed', err);
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
   * 이벤트를 replay 버퍼(Stream)에 넣고 live 채널로 보낸다. 결과는 {@link SseAppendResult} 이고 던지지 않는다.
   * `XADD` 와 `PUBLISH` 를 한 pipeline 으로 보내므로 PUBLISH 를 받은 쪽이 같은 연결로 읽는 버퍼에는 그 항목이 있다.
   * JSON 으로 바꾸지 못하는 payload(BigInt 등)도 `failed` 로 알린다. 호출자는 `catch` 없이 쓸 수 있다.
   *
   * 메시지가 {@link SSE_BUFFER_MAX_MESSAGE_BYTES} 를 넘으면(종료 이벤트는 예외) 이벤트 대신 생략 표시를 넣고 `omitted`
   * 다. 항목에는 `seq` 필드를 함께 넣어 replay 가 이미 받은 항목의 파싱을 건너뛰게 한다.
   */
  async append(event: ExecutionChannelEvent): Promise<SseAppendResult> {
    const client = this.client;
    if (!client) return 'failed';
    let message: string;
    try {
      message = this.encodeEvent(event);
    } catch (err) {
      // JSON 변환 실패는 Redis 실패가 아니라 카운터에 세지 않는다. 경고와 복구 로그는 버퍼 쓰기 실패와 같이 남긴다.
      this.markDegraded('버퍼 쓰기', err);
      return 'failed';
    }
    try {
      let result: SseAppendResult = 'stored';
      if (
        !SSE_TERMINAL_EVENT_TYPES.has(event.eventType) &&
        exceedsMessageLimit(message)
      ) {
        message = this.encodeOmitted(event);
        result = 'omitted';
      }
      const results = await client
        .pipeline()
        .xadd(
          sseBufferKey(event.executionId),
          'MAXLEN',
          '~',
          SSE_BUFFER_MAX_EVENTS,
          '*',
          SEQ_FIELD,
          String(event.seq),
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
        this.degrade('버퍼 쓰기', 'write_failed', xaddError);
        return 'failed';
      }
      this.recover('버퍼 쓰기');
      // PEXPIRE · PUBLISH 실패는 경고만 남긴다. TTL 은 다음 이벤트의 PEXPIRE 가 다시 건다. 놓친 실시간 전달은
      // 클라이언트가 Last-Event-Id 로 다시 연결해 replay 로 받는다.
      const restError = results.slice(1).find(([err]) => err)?.[0];
      if (restError) {
        // 카운터는 PUBLISH 가 실패했으면 발행 실패로, PEXPIRE 만 실패했으면 버퍼 쓰기 실패로 센다. 둘 다 실패해도 한 번이다.
        const publishFailed = Boolean(results[2]?.[0]);
        this.degrade(
          '버퍼 TTL · 발행',
          publishFailed ? 'publish_failed' : 'write_failed',
          restError,
        );
      } else {
        this.recover('버퍼 TTL · 발행');
      }
      return result;
    } catch (err) {
      this.degrade('버퍼 쓰기', 'write_failed', err);
      return 'failed';
    }
  }

  /**
   * 실행의 replay 버퍼를 넣은 순서대로 읽는다. 5분이 지난 항목도 키가 남아 있으면 함께 돌려준다(걸러 내는 것은 호출자다).
   * 실패하면 `null` 이다. 형식이 맞지 않는 항목은 버린다.
   *
   * `afterSeq` 를 주면 `seq` 필드가 그 이하인 항목은 메시지를 파싱하지 않고 `skipped` 로만 센다. 클라이언트가 이미 받은
   * 항목이다. `seq` 필드가 없는 옛 항목은 파싱해서 메시지의 `seq` 로 판단한다.
   */
  async readBuffer(
    executionId: string,
    afterSeq?: number,
  ): Promise<SseBufferRead | null> {
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
      this.degrade('버퍼 읽기', 'read_failed', err);
      return null;
    }
    const events: BufferedSseEvent[] = [];
    let skipped = 0;
    for (const [id, fields] of entries) {
      const receivedAt = Number(id.split('-')[0]);
      if (!Number.isFinite(receivedAt)) continue;
      if (afterSeq !== undefined) {
        const seqField = readField(fields, SEQ_FIELD);
        const seq = seqField === null ? NaN : Number(seqField);
        if (Number.isFinite(seq) && seq <= afterSeq) {
          skipped += 1;
          continue;
        }
      }
      const raw = readField(fields, BUFFER_FIELD);
      const parsed = raw === null ? null : this.decodeEntry(raw, executionId);
      if (!parsed) continue;
      events.push({ seq: parsed.seq, receivedAt, event: parsed.event });
    }
    return { events, skipped };
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
      this.degrade('순번 읽기', 'read_failed', err);
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
    const subscribed = sub.subscribe(sseLiveChannel(executionId));
    let timedOut = false;
    const confirmed = withTimeout(
      subscribed,
      REDIS_WAIT_TIMEOUT_MS,
      'SUBSCRIBE',
    ).then(
      () => {
        this.recover('live 채널 구독');
        return true;
      },
      (err: unknown) => {
        timedOut = err instanceof TimeoutError;
        this.degrade('live 채널 구독', 'subscribe_failed', err);
        return false;
      },
    );
    const state = { refs: 1, confirmed };
    this.liveChannels.set(executionId, state);
    // 상한을 넘긴 SUBSCRIBE 가 늦게 확인되면 그때부터 다른 서버 인스턴스의 이벤트가 온다. 그 사이 발행된 것은 받지 못했으니
    // 구독자에게 따라잡게 한다. 그 사이 구독을 풀었으면 알리지 않는다.
    subscribed.then(
      () => {
        if (timedOut && this.liveChannels.get(executionId) === state) {
          this.handlers?.onLiveResumed([executionId]);
        }
      },
      () => undefined,
    );
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
      this.degrade('live 채널 구독 해제', 'subscribe_failed', err);
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
      // 다른 실패와 달리 억제하지 않고 호출마다 error 로 남긴다. 신호 하나가 빠지면 다른 서버 인스턴스에 무효가 된 토큰의
      // 스트림이 다음 토큰 재확인까지 남는다. 복구 로그를 남기려고 실패 상태는 함께 기록한다.
      this.degradedOps.add('닫기 신호 발행');
      this.logger.error(
        `EIA SSE Redis 닫기 신호 발행 실패 — 다른 서버 인스턴스의 트리거 단위 토큰 스트림은 토큰 재확인 때 닫힌다. triggerIds=${triggerIds.join(',')}: ${errMessage(err)}`,
      );
      this.metrics?.recordRedisFailOpen('sse_fanout', 'publish_failed');
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
      this.degrade('연결 상한', 'slot_failed', err);
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
      .then((results) => {
        // pipeline 은 명령 하나가 실패해도 reject 하지 않는다. ZADD 나 PEXPIRE 가 빠지면 살아 있는 연결의 자리가
        // 45초 뒤 사라져 상한이 느슨해지므로 명령별 결과도 본다(`append` 와 같은 기준).
        const failure = results
          ? results.find(([err]) => err)?.[0]
          : new Error('pipeline 결과 없음');
        if (failure) {
          this.degrade('연결 상한 갱신', 'slot_failed', failure);
        } else {
          this.recover('연결 상한 갱신');
        }
      })
      .catch((err: unknown) =>
        this.degrade('연결 상한 갱신', 'slot_failed', err),
      );
  }

  /** 연결이 끝나면 부른다. 지우지 못해도 TTL 이 지나면 다음 연결 때 지워진다. */
  releaseSlot(executionId: string, subscriberId: string): void {
    const client = this.client;
    if (!client) return;
    client
      .zrem(sseConnectionSlotsKey(executionId), subscriberId)
      .catch((err: unknown) =>
        this.degrade('연결 상한 해제', 'slot_failed', err),
      );
  }

  /**
   * 구독 연결이 준비되면 닫기 채널과 구독 중인 실행 채널을 다시 구독한다. 끊겼다가 다시 준비됐으면(`reconnected`) 끊긴
   * 동안 발행된 메시지는 받지 못했으므로 재구독이 확인된 뒤 그 실행들을 {@link SseFanoutHandlers.onLiveResumed} 로 알린다.
   */
  private resubscribe(sub: Redis, reconnected: boolean): void {
    const executionIds = Array.from(this.liveChannels.keys());
    const channels = [SSE_CLOSE_CHANNEL, ...executionIds.map(sseLiveChannel)];
    sub.subscribe(...channels).then(
      () => {
        this.recover('재구독');
        if (!reconnected) return;
        const still = executionIds.filter((id) => this.liveChannels.has(id));
        if (still.length > 0) this.handlers?.onLiveResumed(still);
      },
      (err: unknown) => {
        this.degrade('재구독', 'subscribe_failed', err);
      },
    );
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
    if (message.startsWith(this.ownMessagePrefix)) return;
    const parsed = this.decodeEntry(message, executionId);
    // 자기 이벤트는 `SseAdapter` 가 이미 바로 전달했다.
    if (!parsed || parsed.origin === this.origin) return;
    if (parsed.event) {
      handlers.onLiveEvent(parsed.event);
    } else {
      handlers.onLiveOmitted(executionId, parsed.seq);
    }
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

  /** 크기 상한을 넘은 이벤트 대신 올리는 생략 표시. 키 순서는 {@link encodeEvent} 와 같아 자기 접두로 알아본다. */
  private encodeOmitted(event: ExecutionChannelEvent): string {
    return JSON.stringify({
      v: MESSAGE_VERSION,
      origin: this.origin,
      omitted: {
        executionId: event.executionId,
        seq: event.seq,
        eventType: event.eventType,
      },
    });
  }

  /**
   * 버퍼 항목 · live 메시지를 바꾼다. 이벤트면 `event` 를, 생략 표시면 `event: null` 을 준다. 형식이 맞지 않거나 다른
   * 실행의 것이면 `null` 이다. Redis 는 믿는 저장소지만 형식까지 믿지는 않는다.
   */
  private decodeEntry(
    message: string,
    executionId: string,
  ): {
    origin: string;
    seq: number;
    event: ExecutionChannelEvent | null;
  } | null {
    const m = parseObject(message);
    if (!m || m.v !== MESSAGE_VERSION) return null;
    if (typeof m.origin !== 'string' || m.origin.length === 0) return null;
    if (m.event === undefined) {
      const seq = decodeOmitted(m.omitted, executionId);
      return seq === null ? null : { origin: m.origin, seq, event: null };
    }
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
      seq: event.seq,
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

  /**
   * Redis 명령 실패로 메모리 동작으로 넘어간다. 카운터는 경고 억제와 따로 실패마다 센다. 경고는 {@link markDegraded} 가
   * 실패 종류(`op`)마다 복구 전까지 한 번만 남긴다. `reason` 은 호출부마다 리터럴로 넘긴다(라벨 쌍 가드가 호출부를 읽는다).
   */
  private degrade(
    op: string,
    reason: RedisFailOpenReason<'sse_fanout'>,
    err: unknown,
  ): void {
    this.metrics?.recordRedisFailOpen('sse_fanout', reason);
    this.markDegraded(op, err);
  }

  /** 실패 종류를 기록하고 경고를 남긴다. 같은 종류가 복구되기 전이면 다시 남기지 않는다. 카운터는 세지 않는다. */
  private markDegraded(op: string, err: unknown): void {
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

/**
 * 메시지가 {@link SSE_BUFFER_MAX_MESSAGE_BYTES} 를 넘는지 본다. UTF-16 코드 단위 하나는 UTF-8 로 1~3바이트라 길이만으로
 * 갈리면 바이트 수를 세지 않는다.
 */
function exceedsMessageLimit(message: string): boolean {
  if (message.length > SSE_BUFFER_MAX_MESSAGE_BYTES) return true;
  if (message.length * 3 <= SSE_BUFFER_MAX_MESSAGE_BYTES) return false;
  return Buffer.byteLength(message, 'utf8') > SSE_BUFFER_MAX_MESSAGE_BYTES;
}

/** 생략 표시의 `omitted` 를 검사해 순번을 준다. 형식이 맞지 않거나 다른 실행의 것이면 `null` 이다. */
function decodeOmitted(raw: unknown, executionId: string): number | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const omitted = raw as Record<string, unknown>;
  if (omitted.executionId !== executionId) return null;
  if (typeof omitted.eventType !== 'string') return null;
  const seq = omitted.seq;
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq <= 0) {
    return null;
  }
  return seq;
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
