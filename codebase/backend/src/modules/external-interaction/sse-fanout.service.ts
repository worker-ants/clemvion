import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import { SseConnectionSlots } from './sse-connection-slots';
import { SseFanoutHealth, SseMessageCodec } from './sse-fanout-shared';
import {
  SseReplayBuffer,
  type SseAppendResult,
  type SseBufferRead,
} from './sse-replay-buffer';
import { SseSignalBus, type SseFanoutHandlers } from './sse-signal-bus';

// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-8PYFDB`.
// 키 · 채널 이름은 `sse-redis-keys.ts`, 부분은 `sse-replay-buffer.ts` · `sse-connection-slots.ts` · `sse-signal-bus.ts` 에 있다.

export {
  SSE_CLOSE_CHANNEL,
  sseBufferKey,
  sseConnectionSlotsKey,
  sseLiveChannel,
} from './sse-redis-keys';
export { SSE_ACQUIRE_SLOT_SCRIPT } from './sse-connection-slots';
export type {
  BufferedSseEvent,
  SseAppendResult,
  SseBufferRead,
} from './sse-replay-buffer';
export type { SseFanoutHandlers } from './sse-signal-bus';

/**
 * EIA SSE 를 여러 서버 인스턴스로 나눠 받기 위한 Redis 쪽 저장과 신호. 세 부분을 묶어 `SseAdapter` 에 한 창구로 준다.
 *
 * - replay 버퍼({@link SseReplayBuffer}): 실행별 Redis Stream. `XADD MAXLEN ~ 1000` 과 `PEXPIRE 300000` 을 한
 *   pipeline 으로 보낸다. 마지막 이벤트 뒤 5분이면 키가 사라진다.
 * - 실시간 전달과 닫기 신호({@link SseSignalBus}): 같은 pipeline 의 `PUBLISH` 로 실행별 채널에 보낸다. 구독은 그 실행의
 *   로컬 구독자가 있는 동안만 전용 연결(`duplicate()`)로 한다. 자기 이벤트는 `SseAdapter` 가 Redis 를 거치지 않고 바로
 *   전달한다. 닫기 신호는 전역 채널 하나를 쓴다.
 * - 연결 상한({@link SseConnectionSlots}): 실행별 ZSET 을 Lua 스크립트로 원자적으로 잡는다.
 *
 * **실패 정책**: 부팅 때 Redis 가 없으면(`getClientOrNull()` 이 `null`) 아무것도 하지 않는다. 명령이 실패하면 호출자에게
 * 실패를 값(`false` · `null`)으로 알리고 던지지 않는다. 호출자(`SseAdapter`)는 이 서버 인스턴스의 메모리로 동작한다.
 * 경고는 실패 종류마다 한 번만 남기고 그 종류가 다시 성공하면 복구를 남긴다(세 부분이 {@link SseFanoutHealth} 하나를
 * 함께 쓴다).
 * 카운터 `clemvion.redis.fail_open{component=sse_fanout}` 는 경고 억제와 따로 실패마다 오른다. reason 은 버퍼 쓰기 ·
 * TTL(`write_failed`), 버퍼 · 순번 읽기(`read_failed`), 연결 상한(`slot_failed`), live · 닫기 신호 발행(`publish_failed`),
 * 구독 연결 · 구독 · 구독 해제 · 재구독(`subscribe_failed`)이다. Redis 미설정 · JSON 변환 실패 · quit 실패는 세지 않는다.
 */
@Injectable()
export class SseFanoutService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseFanoutService.name);
  private client: Redis | null = null;
  private readonly buffer: SseReplayBuffer;
  private readonly slots: SseConnectionSlots;
  private readonly bus: SseSignalBus;

  constructor(
    private readonly redis: RedisConnectionProvider,
    @Optional() metrics?: BusinessMetricsService,
  ) {
    const clientRef = () => this.client;
    const codec = new SseMessageCodec();
    const health = new SseFanoutHealth(this.logger);
    this.buffer = new SseReplayBuffer(clientRef, codec, health, metrics);
    this.slots = new SseConnectionSlots(clientRef, health, metrics);
    this.bus = new SseSignalBus(clientRef, codec, health, this.logger, metrics);
  }

  onModuleInit(): void {
    const base = this.redis.getClientOrNull();
    if (!base) {
      this.logger.warn(
        'Redis 미가용 — EIA SSE 를 이 서버 인스턴스의 메모리로만 처리한다. 다른 서버 인스턴스가 낸 이벤트는 받지 못한다',
      );
      return;
    }
    this.client = base;
    this.bus.start(base);
  }

  async onModuleDestroy(): Promise<void> {
    this.client = null;
    await this.bus.stop();
  }

  /** Redis 로 동작하는지. `false` 면 호출자가 메모리로만 동작한다. */
  isEnabled(): boolean {
    return this.client !== null;
  }

  /** 다른 서버 인스턴스에서 온 이벤트 · 닫기 신호를 받을 쪽을 건다. */
  bind(handlers: SseFanoutHandlers): void {
    this.bus.bind(handlers);
  }

  /** {@link SseReplayBuffer.append}. 던지지 않는다. */
  append(event: ExecutionChannelEvent): Promise<SseAppendResult> {
    return this.buffer.append(event);
  }

  /** {@link SseReplayBuffer.read}. 실패하면 `null` 이다. */
  readBuffer(
    executionId: string,
    afterSeq?: number,
  ): Promise<SseBufferRead | null> {
    return this.buffer.read(executionId, afterSeq);
  }

  /** {@link SseReplayBuffer.readLatestSeq}. 카운터가 없거나 읽지 못하면 `null` 이다. */
  readLatestSeq(executionId: string): Promise<number | null> {
    return this.buffer.readLatestSeq(executionId);
  }

  /** {@link SseSignalBus.retainLive}. SUBSCRIBE 가 처리됐으면 `true` 다. */
  retainLive(executionId: string): Promise<boolean> {
    return this.bus.retainLive(executionId);
  }

  /** {@link SseSignalBus.releaseLive}. */
  releaseLive(executionId: string): void {
    this.bus.releaseLive(executionId);
  }

  /** {@link SseSignalBus.publishClose}. 던지지 않는다. */
  publishClose(triggerIds: readonly string[]): Promise<void> {
    return this.bus.publishClose(triggerIds);
  }

  /** {@link SseConnectionSlots.acquire}. Redis 를 쓸 수 없으면 `null` 이다. */
  acquireSlot(
    executionId: string,
    subscriberId: string,
    limit: number,
  ): Promise<boolean | null> {
    return this.slots.acquire(executionId, subscriberId, limit);
  }

  /** {@link SseConnectionSlots.refresh}. */
  refreshSlot(executionId: string, subscriberId: string): void {
    this.slots.refresh(executionId, subscriberId);
  }

  /** {@link SseConnectionSlots.release}. */
  releaseSlot(executionId: string, subscriberId: string): void {
    this.slots.release(executionId, subscriberId);
  }
}
