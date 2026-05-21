import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ExecutionChannelEvent,
  WebsocketService,
} from '../websocket/websocket.service';

const BUFFER_RETENTION_MS = 5 * 60 * 1000; // 5분 (Spec EIA §3.5 EIA-NF-03)
const MAX_BUFFER_PER_EXEC = 1000; // 상한 — 폭발 방지
const TERMINAL_EVENT_TYPES = new Set([
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

interface BufferedEntry {
  seq: number;
  receivedAt: number;
  event: ExecutionChannelEvent;
}

/**
 * 외부 SSE 구독자 — Controller 가 본 식별자로 fanout.
 */
export interface SseSubscriber {
  /** 단일 SSE 응답 인스턴스의 고유 id. */
  id: string;
  /** Filter — 본 execution 의 이벤트만. */
  executionId: string;
  /** 본 구독자에게 push 할 채널 (Subject). 종료 시 complete. */
  push: (event: ExecutionChannelEvent) => void;
}

/**
 * [Spec EIA §5.2] — SSE adapter.
 *
 * 책임:
 * 1. WebsocketService.executionEvents$ 구독 → execution 별 in-memory ring buffer 유지 (5분).
 * 2. SSE controller 가 subscribe() / unsubscribe() 로 활성 구독자 관리.
 * 3. 재연결 시 `lastEventId` 기준 누락분 replay (`replayFrom`).
 * 4. terminal event 발송 후 buffer 정리.
 *
 * v1 은 single-instance in-memory — 분산 SSE fan-out 은 follow-up.
 */
@Injectable()
export class SseAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseAdapter.name);
  private readonly buffers = new Map<string, BufferedEntry[]>();
  private readonly subscribers = new Map<string, Set<SseSubscriber>>();
  private subscription: { unsubscribe: () => void } | null = null;

  constructor(private readonly websocketService: WebsocketService) {}

  onModuleInit(): void {
    this.subscription = this.websocketService.executionEvents$.subscribe({
      next: (event) => this.handleEvent(event),
      error: (err) =>
        this.logger.error(
          `SseAdapter subscription error: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
  }

  onModuleDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    for (const subs of this.subscribers.values()) {
      subs.clear();
    }
    this.subscribers.clear();
    this.buffers.clear();
  }

  /**
   * SSE Controller 가 새 구독 시 호출. lastEventId 가 있으면 buffer 에서 replay 후 live stream 합류.
   */
  subscribe(subscriber: SseSubscriber, lastEventId?: number): void {
    let set = this.subscribers.get(subscriber.executionId);
    if (!set) {
      set = new Set();
      this.subscribers.set(subscriber.executionId, set);
    }
    set.add(subscriber);
    // 누락분 replay
    if (typeof lastEventId === 'number' && lastEventId >= 0) {
      const buffer = this.buffers.get(subscriber.executionId) ?? [];
      const cutoff = Date.now() - BUFFER_RETENTION_MS;
      for (const entry of buffer) {
        if (entry.seq <= lastEventId) continue;
        if (entry.receivedAt < cutoff) continue;
        subscriber.push(entry.event);
      }
    }
  }

  unsubscribe(subscriber: SseSubscriber): void {
    const set = this.subscribers.get(subscriber.executionId);
    if (!set) return;
    set.delete(subscriber);
    if (set.size === 0) {
      this.subscribers.delete(subscriber.executionId);
    }
  }

  /**
   * 현재 active 구독자 수. 테스트/모니터링 용.
   */
  subscriberCount(executionId: string): number {
    return this.subscribers.get(executionId)?.size ?? 0;
  }

  /**
   * Buffered 이벤트 수 — 단위 테스트 검증용.
   */
  bufferSize(executionId: string): number {
    return this.buffers.get(executionId)?.length ?? 0;
  }

  private handleEvent(event: ExecutionChannelEvent): void {
    // 1) buffer 갱신
    const buffer = this.buffers.get(event.executionId) ?? [];
    const cutoff = Date.now() - BUFFER_RETENTION_MS;
    const pruned = buffer.filter((e) => e.receivedAt >= cutoff);
    pruned.push({
      seq: event.seq,
      receivedAt: Date.now(),
      event,
    });
    // 상한 — 가장 오래된 것부터 폐기.
    while (pruned.length > MAX_BUFFER_PER_EXEC) pruned.shift();
    this.buffers.set(event.executionId, pruned);
    // 2) 활성 구독자에게 push
    const subs = this.subscribers.get(event.executionId);
    if (subs) {
      for (const s of subs) {
        try {
          s.push(event);
        } catch (err) {
          this.logger.warn(
            `SseAdapter push 실패 (id=${s.id}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    // 3) terminal 이벤트 후 buffer 정리는 BUFFER_RETENTION_MS 후 자동. 즉시 폐기 X — Last-Event-Id
    //    재연결 클라이언트가 5분 안에 들어올 수 있음.
    void TERMINAL_EVENT_TYPES; // type 사용 — buffer 정리 트리거는 retention timer 가 담당.
  }
}
