// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-8PYFDB`.
// 실행별 replay 버퍼(Redis Stream)와 순번 카운터 읽기. `SseFanoutService` 의 한 부분이다.

import { withTimeout } from '../../common/utils/with-timeout';
import type {
  BusinessMetricsService,
  RedisFailOpenReason,
} from '../metrics/business-metrics.service';
import { executionSeqKey } from '../websocket/execution-seq-allocator.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import {
  REDIS_WAIT_TIMEOUT_MS,
  type RedisClientRef,
  type SseFanoutHealth,
  type SseMessageCodec,
} from './sse-fanout-shared';
import { sseBufferKey, sseLiveChannel } from './sse-redis-keys';
import {
  SSE_BUFFER_MAX_EVENTS,
  SSE_BUFFER_MAX_MESSAGE_BYTES,
  SSE_REPLAY_WINDOW_MS,
  SSE_TERMINAL_EVENT_TYPES,
} from './sse.constants';

/** Stream 항목에서 메시지 JSON 을 담는 필드 이름. */
const BUFFER_FIELD = 'data';
/**
 * Stream 항목에서 이벤트 순번을 담는 필드 이름. 재연결 replay 는 이 값이 `Last-Event-Id` 이하인 항목의 메시지를 파싱하지
 * 않는다. 이 필드가 없는 항목(롤링 배포 중 옛 서버 인스턴스가 넣은 것)은 그대로 파싱한다.
 */
const SEQ_FIELD = 'seq';

/**
 * 버퍼에서 읽은 항목 하나. `receivedAt` 은 Stream 항목 id 의 시각(ms)이다. `event` 가 `null` 이면 크기 상한을 넘어 생략
 * 표시만 남은 항목이다(이벤트 전체는 그 이벤트를 낸 서버 인스턴스의 메모리 버퍼에만 있다).
 */
export interface BufferedSseEvent {
  seq: number;
  receivedAt: number;
  event: ExecutionChannelEvent | null;
}

/** {@link SseReplayBuffer.read} 의 결과. `skipped` 는 `seq` 필드로 보아 파싱하지 않고 건너뛴 항목 수다. */
export interface SseBufferRead {
  events: BufferedSseEvent[];
  skipped: number;
}

/**
 * {@link SseReplayBuffer.append} 의 결과. `stored` 는 이벤트 전체를 Redis 에 넣었다. `omitted` 는 크기 상한을 넘어 생략
 * 표시만 넣었다. `failed` 는 넣지 못했다. `stored` 가 아니면 호출자가 이벤트를 메모리 버퍼에 둔다.
 */
export type SseAppendResult = 'stored' | 'omitted' | 'failed';

/**
 * 실행별 replay 버퍼. `XADD MAXLEN ~ 1000` · `PEXPIRE 300000` · live 채널 `PUBLISH` 를 한 pipeline 으로 보낸다. 마지막
 * 이벤트 뒤 5분이면 키가 사라진다. 실패는 값으로 알리고 던지지 않는다.
 */
export class SseReplayBuffer {
  constructor(
    private readonly client: RedisClientRef,
    private readonly codec: SseMessageCodec,
    private readonly health: SseFanoutHealth,
    private readonly metrics?: BusinessMetricsService,
  ) {}

  /**
   * 이벤트를 replay 버퍼(Stream)에 넣고 live 채널로 보낸다. 결과는 {@link SseAppendResult} 이고 던지지 않는다.
   * `XADD` 와 `PUBLISH` 를 한 pipeline 으로 보내므로 PUBLISH 를 받은 쪽이 같은 연결로 읽는 버퍼에는 그 항목이 있다.
   * JSON 으로 바꾸지 못하는 payload(BigInt 등)도 `failed` 로 알린다. 호출자는 `catch` 없이 쓸 수 있다.
   *
   * 메시지가 {@link SSE_BUFFER_MAX_MESSAGE_BYTES} 를 넘으면(종료 이벤트는 예외) 이벤트 대신 생략 표시를 넣고 `omitted`
   * 다. 항목에는 `seq` 필드를 함께 넣어 replay 가 이미 받은 항목의 파싱을 건너뛰게 한다.
   */
  async append(event: ExecutionChannelEvent): Promise<SseAppendResult> {
    const client = this.client();
    if (!client) return 'failed';
    let message: string;
    try {
      message = this.codec.encodeEvent(event);
    } catch (err) {
      // JSON 변환 실패는 Redis 실패가 아니라 카운터에 세지 않는다. 경고와 복구 로그는 버퍼 쓰기 실패와 같이 남긴다.
      this.health.markDegraded('버퍼 쓰기', err);
      return 'failed';
    }
    try {
      let result: SseAppendResult = 'stored';
      if (
        !SSE_TERMINAL_EVENT_TYPES.has(event.eventType) &&
        exceedsMessageLimit(message)
      ) {
        message = this.codec.encodeOmitted(event);
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
      this.health.recover('버퍼 쓰기');
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
        this.health.recover('버퍼 TTL · 발행');
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
  async read(
    executionId: string,
    afterSeq?: number,
  ): Promise<SseBufferRead | null> {
    const client = this.client();
    if (!client) return null;
    let entries: Array<[string, string[]]>;
    try {
      entries = await withTimeout(
        client.xrange(sseBufferKey(executionId), '-', '+'),
        REDIS_WAIT_TIMEOUT_MS,
        'XRANGE',
      );
      this.health.recover('버퍼 읽기');
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
      const parsed =
        raw === null ? null : this.codec.decodeEntry(raw, executionId);
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
    const client = this.client();
    if (!client) return null;
    try {
      const raw = await withTimeout(
        client.get(executionSeqKey(executionId)),
        REDIS_WAIT_TIMEOUT_MS,
        'GET',
      );
      this.health.recover('순번 읽기');
      const seq = raw === null ? NaN : Number(raw);
      return Number.isSafeInteger(seq) ? seq : null;
    } catch (err) {
      this.degrade('순번 읽기', 'read_failed', err);
      return null;
    }
  }

  /**
   * Redis 명령 실패로 메모리 동작으로 넘어간다. 카운터는 경고 억제와 따로 실패마다 센다. `reason` 은 호출부마다 리터럴로
   * 넘긴다(라벨 쌍 가드가 같은 파일의 호출부를 읽는다).
   */
  private degrade(
    op: string,
    reason: RedisFailOpenReason<'sse_fanout'>,
    err: unknown,
  ): void {
    this.metrics?.recordRedisFailOpen('sse_fanout', reason);
    this.health.markDegraded(op, err);
  }
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

/** Stream 항목의 `[필드, 값, 필드, 값, …]` 에서 필드 값을 찾는다. */
function readField(fields: string[], name: string): string | null {
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === name) return fields[i + 1];
  }
  return null;
}
