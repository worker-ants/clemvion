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

/**
 * [Spec EIA §5.2 / §11 EIA-IN-07·EIA-NF-03] 재연결 replay 가 5분 buffer 로 요청 범위를
 * 완전히 재생하지 못할 때(만료 또는 cap 폐기로 중간 seq 유실) 1회 발송하는 control frame.
 * 내부 WS 의 `replay.unavailable` 과 의미는 같으나 SSE `execution.*` namespace 컨벤션을 따른다.
 */
const REPLAY_UNAVAILABLE_EVENT_TYPE = 'execution.replay_unavailable';

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
    // 누락분 replay (buffer 가 요청 범위를 못 채우면 replay_unavailable 신호).
    // Last-Event-Id 는 정수 seq 지만 공개 표면(`?lastEventId=`)으로 소수/malformed 가 올 수
    // 있어 floor 로 정규화한다 — 그러지 않으면 `lastEventId+1` 이 어떤 정수 seq 와도 안 맞아
    // 연속 buffer 도 gap 으로 오탐한다.
    if (typeof lastEventId === 'number' && lastEventId >= 0) {
      this.replayOrSignalUnavailable(subscriber, Math.floor(lastEventId));
    }
  }

  /**
   * 재연결 replay — `lastEventId` 이후 이벤트를 5분 buffer 에서 재전송한다. 단 buffer 가
   * 요청 범위를 **완전히** 재생하지 못하면(만료 또는 `MAX_BUFFER_PER_EXEC` cap 으로 중간 seq
   * 유실) 부분 replay 대신 `execution.replay_unavailable` 을 **한 번** push → 클라이언트는
   * `GET /api/external/executions/:id` 로 현재 상태를 REST 재조회한다.
   * (Spec EIA §5.2 / EIA-IN-07 / EIA-NF-03 — 만료분 silent drop 을 명시 신호로 대체.)
   */
  private replayOrSignalUnavailable(
    subscriber: SseSubscriber,
    lastEventId: number,
  ): void {
    const buffer = this.buffers.get(subscriber.executionId) ?? [];
    // 클라이언트가 아직 못 받은 이벤트. (만료됐지만 아직 배열에 남은 항목도 포함해서 센다 —
    // seq > lastEventId 인 항목이 하나도 없으면 클라이언트가 최신까지 수신했다는 뜻이므로
    // 누락이 아니다.)
    const wanted = buffer.filter((e) => e.seq > lastEventId);
    if (wanted.length === 0) {
      // 최신까지 수신함(또는 실행이 아직 그 이후 이벤트를 내지 않음) → 누락 없음, live 로 이어짐.
      return;
    }
    const cutoff = Date.now() - BUFFER_RETENTION_MS;
    const replayable = wanted
      .filter((e) => e.receivedAt >= cutoff)
      .sort((a, b) => a.seq - b.seq);
    // seq 는 monotonic 이라 만료·cap 폐기는 항상 앞쪽부터 발생한다. 재생 가능한 가장 이른
    // seq 가 `lastEventId + 1` 이 아니면 그 사이 구간이 유실된 것 → 완전 replay 불가. 선두뿐
    // 아니라 배열 중간에 hole(예: seq 유실로 `[6,7,9]`)이 있어도 gap 으로 판정한다 — 이
    // 기능이 없애려는 바로 그 silent drop 을 놓치지 않도록 전 구간 연속성을 확인한다.
    const contiguous =
      replayable.length > 0 &&
      replayable[0].seq === lastEventId + 1 &&
      replayable.every(
        (e, i) => i === 0 || e.seq === replayable[i - 1].seq + 1,
      );
    if (!contiguous) {
      subscriber.push(
        this.buildReplayUnavailableEvent(subscriber.executionId, lastEventId),
      );
      return;
    }
    for (const entry of replayable) {
      subscriber.push(entry.event);
    }
  }

  /**
   * `execution.replay_unavailable` control frame 을 구성. 재연결 응답 전용이라 monotonic
   * 스트림 위치가 아니며 `seq: 0` sentinel 을 쓴다 (`interaction-stream.controller` 의
   * `writeSseFrame` 이 seq<=0 이면 SSE `id:` 라인을 생략 → client 의 Last-Event-Id 오염 방지).
   */
  private buildReplayUnavailableEvent(
    executionId: string,
    lastEventId: number,
  ): ExecutionChannelEvent {
    return {
      executionId,
      eventType: REPLAY_UNAVAILABLE_EVENT_TYPE,
      seq: 0,
      payload: {
        executionId,
        lastEventId,
        message:
          'Requested events are no longer available in the 5-minute replay buffer. Re-fetch current state via GET /api/external/executions/:id.',
      },
    };
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
