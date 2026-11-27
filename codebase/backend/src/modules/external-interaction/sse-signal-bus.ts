// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-8PYFDB`.
// 서버 인스턴스 사이의 실시간 전달과 닫기 신호(Redis pub/sub). `SseFanoutService` 의 한 부분이다.

import type { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { errorMessage } from '../../common/utils/error-message';
import { TimeoutError, withTimeout } from '../../common/utils/with-timeout';
import type {
  BusinessMetricsService,
  RedisFailOpenReason,
} from '../metrics/business-metrics.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import {
  REDIS_WAIT_TIMEOUT_MS,
  type RedisClientRef,
  type SseFanoutHealth,
  type SseMessageCodec,
} from './sse-fanout-shared';
import {
  SSE_CLOSE_CHANNEL,
  SSE_LIVE_CHANNEL_PREFIX,
  sseLiveChannel,
} from './sse-redis-keys';
import { SSE_SUBSCRIBER_CONNECTION_NAME } from './sse.constants';

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
 * 실행별 live 채널 {@link sseLiveChannel} 과 전역 닫기 채널 {@link SSE_CLOSE_CHANNEL}. 구독은 전용 연결(`duplicate()`)로
 * 하고 실행 채널은 그 실행의 로컬 구독자가 있는 동안만 구독한다. 자기가 보낸 메시지는 `origin` 으로 알아보고 건너뛴다.
 * 닫기 신호는 `channel-listener.bus.ts` 와 같은 방식이다(`origin`, 발행 2초 상한, 실패해도 던지지 않음, 구독 연결이
 * `ready` 가 되면 다시 구독).
 */
export class SseSignalBus {
  private subscriber: Redis | null = null;
  private handlers: SseFanoutHandlers | null = null;
  /** 실행별 live 채널 구독의 참조 수와 SUBSCRIBE 확인. */
  private readonly liveChannels = new Map<
    string,
    { refs: number; confirmed: Promise<boolean> }
  >();

  constructor(
    private readonly client: RedisClientRef,
    private readonly codec: SseMessageCodec,
    private readonly health: SseFanoutHealth,
    private readonly logger: Logger,
    private readonly metrics?: BusinessMetricsService,
  ) {}

  /** 구독 연결을 열고 닫기 채널을 구독한다. */
  start(base: Redis): void {
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
      this.health.recover('구독 연결');
      this.resubscribe(sub, readyBefore);
      readyBefore = true;
    });
    sub.subscribe(SSE_CLOSE_CHANNEL).catch((err: unknown) => {
      this.degrade('닫기 채널 구독', 'subscribe_failed', err);
    });
    this.subscriber = sub;
  }

  async stop(): Promise<void> {
    const sub = this.subscriber;
    this.subscriber = null;
    this.liveChannels.clear();
    if (sub) await sub.quit().catch(() => undefined);
  }

  /** 다른 서버 인스턴스에서 온 이벤트 · 닫기 신호를 받을 쪽을 건다. */
  bind(handlers: SseFanoutHandlers): void {
    this.handlers = handlers;
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
        this.health.recover('live 채널 구독');
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
    const client = this.client();
    if (!client || triggerIds.length === 0) return;
    const message = this.codec.encodeClose(triggerIds);
    try {
      await withTimeout(
        client.publish(SSE_CLOSE_CHANNEL, message),
        REDIS_WAIT_TIMEOUT_MS,
        'PUBLISH',
      );
      this.health.recover('닫기 신호 발행');
    } catch (err) {
      // 다른 실패와 달리 억제하지 않고 호출마다 error 로 남긴다. 신호 하나가 빠지면 다른 서버 인스턴스에 무효가 된 토큰의
      // 스트림이 다음 토큰 재확인까지 남는다. 복구 로그를 남기려고 실패 상태는 함께 기록한다.
      this.health.markFailed('닫기 신호 발행');
      this.logger.error(
        `EIA SSE Redis 닫기 신호 발행 실패 — 다른 서버 인스턴스의 트리거 단위 토큰 스트림은 토큰 재확인 때 닫힌다. triggerIds=${triggerIds.join(',')}: ${errorMessage(err)}`,
      );
      this.metrics?.recordRedisFailOpen('sse_fanout', 'publish_failed');
    }
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
        this.health.recover('재구독');
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
      const triggerIds = this.codec.decodeClose(message);
      if (triggerIds) handlers.onRemoteClose(triggerIds);
      return;
    }
    if (!channel.startsWith(SSE_LIVE_CHANNEL_PREFIX)) return;
    const executionId = channel.slice(SSE_LIVE_CHANNEL_PREFIX.length);
    if (!this.liveChannels.has(executionId)) return;
    // 자기 이벤트는 `SseAdapter` 가 이미 바로 전달했으므로 파싱하지 않고 버린다.
    if (this.codec.isOwnMessage(message)) return;
    const parsed = this.codec.decodeEntry(message, executionId);
    if (!parsed || parsed.origin === this.codec.origin) return;
    if (parsed.event) {
      handlers.onLiveEvent(parsed.event);
    } else {
      handlers.onLiveOmitted(executionId, parsed.seq);
    }
  }

  /** 카운터를 세고 경고를 남긴다. `reason` 은 호출부마다 리터럴로 넘긴다(라벨 쌍 가드가 같은 파일의 호출부를 읽는다). */
  private degrade(
    op: string,
    reason: RedisFailOpenReason<'sse_fanout'>,
    err: unknown,
  ): void {
    this.metrics?.recordRedisFailOpen('sse_fanout', reason);
    this.health.markDegraded(op, err);
  }
}
