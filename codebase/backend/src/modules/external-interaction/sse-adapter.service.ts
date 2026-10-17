import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebsocketService } from '../websocket/websocket.service';
import type { InteractionStreamCloserPort } from './interaction-stream-closer';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import {
  SSE_BUFFER_MAX_EVENTS,
  SSE_MAX_CONNECTIONS_PER_EXECUTION,
  SSE_REPLAY_WINDOW_MS,
  SseFanoutService,
  type BufferedSseEvent,
} from './sse-fanout.service';

const TERMINAL_EVENT_TYPES = new Set([
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

/** 메모리 버퍼에서 마지막 이벤트 뒤 5분이 지난 실행을 지우는 주기(ms). */
const MEMORY_BUFFER_SWEEP_INTERVAL_MS = 60_000;

/**
 * [Spec EIA §5.2 / §11 EIA-IN-07·EIA-NF-03] 재연결 replay 가 5분 buffer 로 요청 범위를
 * 완전히 재생하지 못할 때(만료 또는 cap 폐기로 중간 seq 유실) 1회 발송하는 control frame.
 * 내부 WS 의 `replay.unavailable` 과 의미는 같으나 SSE `execution.*` namespace 컨벤션을 따른다.
 */
const REPLAY_UNAVAILABLE_EVENT_TYPE = 'execution.replay_unavailable';

/**
 * 스트림을 연 토큰. 트리거 단위 토큰(`itk`)으로 연 스트림만 {@link SseAdapter.closeTriggerTokenStreams} 의 대상이다.
 */
export type SseStreamToken =
  { family: 'iext' } | { family: 'itk'; triggerId: string };

/**
 * 외부 SSE 구독자 — Controller 가 본 식별자로 fanout.
 */
export interface SseSubscriber {
  /** 단일 SSE 응답 인스턴스의 고유 id. 연결 상한 ZSET 의 member 이기도 하다. */
  id: string;
  /** Filter — 본 execution 의 이벤트만. */
  executionId: string;
  /** 스트림을 연 토큰. */
  token: SseStreamToken;
  /** 이벤트 하나를 응답에 쓴다. */
  push: (event: ExecutionChannelEvent) => void;
  /**
   * 서버가 스트림을 끝낼 때 어댑터가 부른다. 응답 종료와 heartbeat 정리만 한다. 구독 해제는 어댑터가 이미 했다.
   * 클라이언트가 끊었을 때는 호출자가 {@link SseAdapter.unsubscribe} 를 부른다.
   */
  close: () => void;
}

interface SubscriberEntry {
  readonly subscriber: SseSubscriber;
  /**
   * `admitting`: 등록만 했다. `catching_up`: replay 중이다. 두 단계에서 도착한 이벤트는 `pending` 에 모은다.
   * `live`: 바로 보낸다. `closed`: 해제됐다.
   */
  phase: 'admitting' | 'catching_up' | 'live' | 'closed';
  /** 연결 상한 안에 들었는지. 이 서버 인스턴스 안에서 셀 때 쓴다. */
  admitted: boolean;
  pending: ExecutionChannelEvent[];
  /** `pending` 이 상한을 넘어 앞쪽을 버렸는지. */
  pendingOverflowed: boolean;
  /** 마지막으로 보낸 seq. 이 이하의 seq 는 버린다(replay 와 live 의 겹침). */
  lastSeq: number;
  holdsRedisSlot: boolean;
  retainsLive: boolean;
}

/**
 * [Spec EIA §5.2] — SSE adapter.
 *
 * 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P`.
 * 서버 인스턴스가 여럿이어도 구독자가 어느 인스턴스에 붙든 그 실행의 이벤트를 받고, 다른 인스턴스로 다시 연결해도 5분
 * replay 가 된다. Redis 쪽 저장과 신호는 {@link SseFanoutService} 가 한다. 이 클래스는 구독자 관리와 replay 판정을 한다.
 *
 * 책임:
 * 1. 자기 프로세스의 `WebsocketService.executionEvents$` 이벤트를 Redis 버퍼에 넣고 로컬 구독자에게 바로 보낸다.
 *    다른 서버 인스턴스의 이벤트는 live 채널로 받는다.
 * 2. 구독 순서: 등록(도착 이벤트를 모음) → 연결 상한 → live 채널 SUBSCRIBE 확인 → `lastEventId` 이후 replay → 모은 이벤트를
 *    보내고 실시간으로 바꾼다. 구독자마다 마지막으로 보낸 seq 이하는 버린다. seq 가 0 이하인 제어 프레임은 예외다.
 * 3. 종료 이벤트와 트리거 단위 토큰 무효 때 스트림을 끝낸다. 닫기 신호는 다른 서버 인스턴스에도 보낸다.
 *
 * Redis 를 쓸 수 없으면(부팅 때 없거나 명령 실패) 이 서버 인스턴스의 메모리로 동작한다. 메모리 버퍼는 마지막 이벤트
 * 뒤 5분이 지나면 주기 타이머가 지운다.
 */
@Injectable()
export class SseAdapter
  implements OnModuleInit, OnModuleDestroy, InteractionStreamCloserPort
{
  private readonly logger = new Logger(SseAdapter.name);
  /** Redis 에 넣지 못한 이벤트의 버퍼. Redis 를 쓸 수 없을 때만 채운다. */
  private readonly memoryBuffers = new Map<string, BufferedSseEvent[]>();
  private readonly entries = new Map<string, SubscriberEntry>();
  private readonly entriesByExecution = new Map<string, Set<SubscriberEntry>>();
  private subscription: { unsubscribe: () => void } | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly fanout: SseFanoutService,
  ) {}

  onModuleInit(): void {
    this.fanout.bind({
      onLiveEvent: (event) => this.dispatch(event),
      onRemoteClose: (triggerIds) =>
        this.closeLocalTriggerTokenStreams(triggerIds),
    });
    this.subscription = this.websocketService.executionEvents$.subscribe({
      next: (event) => this.handleEvent(event),
      error: (err) =>
        this.logger.error(
          `SseAdapter subscription error: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
    this.sweepTimer = setInterval(
      () => this.sweepMemoryBuffers(),
      MEMORY_BUFFER_SWEEP_INTERVAL_MS,
    );
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    // 다른 서버 인스턴스가 이 연결들을 TTL(45초) 동안 상한에 세지 않게 자리를 돌려준다.
    for (const entry of Array.from(this.entries.values())) {
      this.unsubscribe(entry.subscriber);
    }
    this.memoryBuffers.clear();
  }

  /**
   * 구독자를 등록하고 실행당 동시 연결 상한을 확인한다. 상한이면 등록을 풀고 `false` 다.
   *
   * 등록은 상한 확인보다 먼저 한다. 그래서 확인을 기다리는 사이에 온 닫기 신호도 이 구독자를 닫는다. 그 경우 호출자는
   * `close` 로 알게 된다. 상한은 Redis ZSET 으로 모든 서버 인스턴스를 합쳐 센다. Redis 를 쓸 수 없으면 이 서버
   * 인스턴스 안에서 센다.
   */
  async admit(subscriber: SseSubscriber): Promise<boolean> {
    const entry = this.register(subscriber);
    if (!this.fanout.isEnabled()) return this.admitLocally(entry);
    const acquired = await this.fanout.acquireSlot(
      subscriber.executionId,
      subscriber.id,
      SSE_MAX_CONNECTIONS_PER_EXECUTION,
    );
    if (acquired === null) return this.admitLocally(entry);
    if (entry.phase === 'closed') {
      if (acquired) {
        this.fanout.releaseSlot(subscriber.executionId, subscriber.id);
      }
      return false;
    }
    if (!acquired) {
      this.unsubscribe(subscriber);
      return false;
    }
    entry.holdsRedisSlot = true;
    entry.admitted = true;
    return true;
  }

  /**
   * {@link admit} 한 구독자의 replay 와 실시간 전달을 시작한다. `lastEventId` 가 있으면 그 이후를 버퍼에서 다시 보낸다.
   * 버퍼가 요청 범위를 다 채우지 못하면 `execution.replay_unavailable` 을 한 번 보낸다.
   *
   * live 채널 SUBSCRIBE 확인을 버퍼 읽기보다 먼저 기다린다. 다른 서버 인스턴스는 `XADD` 와 `PUBLISH` 를 한
   * pipeline 으로 보내므로, 확인 앞에 발행된 이벤트는 버퍼에 있고 뒤에 발행된 이벤트는 live 로 온다.
   */
  async start(subscriber: SseSubscriber, lastEventId?: number): Promise<void> {
    const entry = this.entries.get(subscriber.id);
    if (!entry || entry.phase !== 'admitting') return;
    entry.phase = 'catching_up';
    // Last-Event-Id 는 정수 seq 지만 공개 표면(`?lastEventId=`)으로 소수/malformed 가 올 수
    // 있어 floor 로 정규화한다 — 그러지 않으면 `lastEventId+1` 이 어떤 정수 seq 와도 안 맞아
    // 연속 buffer 도 gap 으로 오탐한다.
    const replayAfter =
      typeof lastEventId === 'number' &&
      Number.isFinite(lastEventId) &&
      lastEventId >= 0
        ? Math.floor(lastEventId)
        : undefined;
    if (replayAfter !== undefined) entry.lastSeq = replayAfter;
    if (this.fanout.isEnabled()) {
      entry.retainsLive = true;
      // 실패해도 이어 간다. 이 서버 인스턴스의 이벤트는 그대로 받는다.
      await this.fanout.retainLive(subscriber.executionId);
      if (this.isClosed(entry)) return;
    }
    if (replayAfter !== undefined) {
      await this.replay(entry, replayAfter);
      if (this.isClosed(entry)) return;
    }
    entry.phase = 'live';
    const pending = entry.pending;
    entry.pending = [];
    if (entry.pendingOverflowed) {
      entry.pendingOverflowed = false;
      this.deliverNow(
        entry,
        this.buildReplayUnavailableEvent(subscriber.executionId, entry.lastSeq),
      );
    }
    for (const event of pending) {
      if (this.isClosed(entry)) return;
      this.deliverNow(entry, event);
    }
  }

  /**
   * 구독을 해제한다. 몇 번 불러도 같다. 연결 상한 자리와 live 채널 참조를 돌려준다. 응답은 끝내지 않는다.
   */
  unsubscribe(subscriber: SseSubscriber): void {
    const entry = this.entries.get(subscriber.id);
    if (!entry || entry.subscriber !== subscriber) return;
    entry.phase = 'closed';
    entry.pending = [];
    this.entries.delete(subscriber.id);
    const set = this.entriesByExecution.get(subscriber.executionId);
    if (set) {
      set.delete(entry);
      if (set.size === 0)
        this.entriesByExecution.delete(subscriber.executionId);
    }
    if (entry.retainsLive) {
      entry.retainsLive = false;
      this.fanout.releaseLive(subscriber.executionId);
    }
    if (entry.holdsRedisSlot) {
      entry.holdsRedisSlot = false;
      this.fanout.releaseSlot(subscriber.executionId, subscriber.id);
    }
  }

  /** heartbeat 때 부른다. 연결 상한 자리의 시각을 갱신해 다른 서버 인스턴스가 오래된 자리로 지우지 않게 한다. */
  touch(subscriber: SseSubscriber): void {
    const entry = this.entries.get(subscriber.id);
    if (entry?.holdsRedisSlot) {
      this.fanout.refreshSlot(subscriber.executionId, subscriber.id);
    }
  }

  /**
   * 트리거 단위 토큰(`itk_*`)이 무효가 된 트리거들의 스트림을 닫는다 — `InteractionStreamCloserPort` 구현.
   *
   * 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰). 새 이벤트 이름은 만들지 않고
   * 응답을 끝낸다. 클라이언트가 옛 토큰으로 다시 연결하면 가드가 401 로 거부한다. 실행 단위 토큰으로 연
   * 스트림은 대상이 아니다. 이 서버 인스턴스의 구독자를 닫고 `eia:sse:close` 로 다른 서버 인스턴스에도 알린다
   * (NERV Task `CLE-T-Z35F7P`). 돌려주는 수는 이 서버 인스턴스에서 닫은 수다. 알리기는 기다리지 않는다.
   *
   * 한 구독자의 `close` 가 던져도 나머지를 계속 닫는다. 구독 해제를 먼저 해 두므로 던진 구독자도 더는
   * 이벤트를 받지 않는다.
   */
  closeTriggerTokenStreams(triggerIds: readonly string[]): number {
    if (triggerIds.length === 0) return 0;
    const closed = this.closeLocalTriggerTokenStreams(triggerIds);
    void this.fanout.publishClose(triggerIds);
    return closed;
  }

  /**
   * 현재 등록된 구독자 수. 테스트/모니터링 용. 이 서버 인스턴스의 수다.
   */
  subscriberCount(executionId: string): number {
    return this.entriesByExecution.get(executionId)?.size ?? 0;
  }

  /**
   * 메모리 버퍼의 이벤트 수 — 단위 테스트 검증용. Redis 로 동작하는 동안은 0 이다.
   */
  bufferSize(executionId: string): number {
    return this.memoryBuffers.get(executionId)?.length ?? 0;
  }

  private register(subscriber: SseSubscriber): SubscriberEntry {
    const entry: SubscriberEntry = {
      subscriber,
      phase: 'admitting',
      admitted: false,
      pending: [],
      pendingOverflowed: false,
      lastSeq: 0,
      holdsRedisSlot: false,
      retainsLive: false,
    };
    this.entries.set(subscriber.id, entry);
    let set = this.entriesByExecution.get(subscriber.executionId);
    if (!set) {
      set = new Set();
      this.entriesByExecution.set(subscriber.executionId, set);
    }
    set.add(entry);
    return entry;
  }

  private admitLocally(entry: SubscriberEntry): boolean {
    if (entry.phase === 'closed') return false;
    let admitted = 0;
    for (const other of this.entriesByExecution.get(
      entry.subscriber.executionId,
    ) ?? []) {
      if (other !== entry && other.admitted) admitted += 1;
    }
    if (admitted >= SSE_MAX_CONNECTIONS_PER_EXECUTION) {
      this.unsubscribe(entry.subscriber);
      return false;
    }
    entry.admitted = true;
    return true;
  }

  private isClosed(entry: SubscriberEntry): boolean {
    return entry.phase === 'closed';
  }

  /**
   * 재연결 replay. `lastEventId` 이후 이벤트가 버퍼에 있으면 {@link replayOrSignalUnavailable} 로 넘긴다.
   *
   * 버퍼에 그 이후 이벤트가 없을 때가 둘로 갈린다. 버퍼를 다 읽었고 비어 있지 않으면 버퍼에 그 실행의 마지막 이벤트가
   * 있으므로 클라이언트가 최신까지 받았다. 버퍼 키가 사라졌거나(마지막 이벤트 뒤 5분) Redis 를 읽지 못했으면 버퍼만으로
   * 판정할 수 없다. 그때는 실행의 순번 카운터와 견줘 놓쳤을 수 있으면 `execution.replay_unavailable` 을 보낸다.
   */
  private async replay(
    entry: SubscriberEntry,
    lastEventId: number,
  ): Promise<void> {
    const executionId = entry.subscriber.executionId;
    const buffer = await this.readBuffer(executionId);
    if (this.isClosed(entry)) return;
    // 클라이언트가 아직 못 받은 이벤트. 만료됐지만 아직 버퍼에 남은 항목도 센다.
    const wanted = buffer.events.filter((e) => e.seq > lastEventId);
    if (wanted.length > 0) {
      this.replayOrSignalUnavailable(entry, lastEventId, wanted);
      return;
    }
    if (buffer.complete && buffer.events.length > 0) return;
    const latest = await this.fanout.readLatestSeq(executionId);
    if (this.isClosed(entry)) return;
    if (this.mayHaveMissed(entry, lastEventId, latest)) {
      this.deliverNow(
        entry,
        this.buildReplayUnavailableEvent(executionId, lastEventId),
      );
    }
  }

  /**
   * 버퍼 없이 판정한다. 카운터를 읽지 못하면(키가 없음 · Redis 장애 · 메모리 모드) 근거가 없으므로 놓쳤을 수 있다고 본다.
   * 카운터가 `lastEventId` 보다 크면 그 사이 seq 중 replay 를 기다리며 모은 이벤트에 없는 것이 있을 때 놓친 것이다.
   */
  private mayHaveMissed(
    entry: SubscriberEntry,
    lastEventId: number,
    latest: number | null,
  ): boolean {
    if (latest === null) return true;
    if (latest <= lastEventId) return false;
    const collected = new Set(
      entry.pending
        .map((e) => e.seq)
        .filter((seq) => seq > lastEventId && seq <= latest),
    );
    return collected.size < latest - lastEventId;
  }

  /**
   * 재연결 replay — `lastEventId` 이후 이벤트를 5분 buffer 에서 재전송한다. 단 buffer 가
   * 요청 범위를 **완전히** 재생하지 못하면(만료 또는 `SSE_BUFFER_MAX_EVENTS` cap 으로 중간 seq
   * 유실) 부분 replay 대신 `execution.replay_unavailable` 을 **한 번** push → 클라이언트는
   * `GET /api/external/executions/:id` 로 현재 상태를 REST 재조회한다.
   * (Spec EIA §5.2 / EIA-IN-07 / EIA-NF-03 — 만료분 silent drop 을 명시 신호로 대체.)
   *
   * @param wanted 버퍼에서 seq 가 `lastEventId` 보다 큰 항목. 비어 있지 않다.
   */
  private replayOrSignalUnavailable(
    entry: SubscriberEntry,
    lastEventId: number,
    wanted: BufferedSseEvent[],
  ): void {
    const executionId = entry.subscriber.executionId;
    const cutoff = Date.now() - SSE_REPLAY_WINDOW_MS;
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
      this.deliverNow(
        entry,
        this.buildReplayUnavailableEvent(executionId, lastEventId),
      );
      return;
    }
    for (const item of replayable) {
      if (this.isClosed(entry)) return;
      this.deliverNow(entry, item.event);
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

  /**
   * Redis 버퍼와 메모리 버퍼를 합쳐 읽는다. 메모리 버퍼에는 Redis 에 넣지 못한 이벤트만 있다. 같은 seq 는 하나만 둔다.
   * `complete` 는 버퍼를 다 읽었는지다. Redis 로 동작하는데 읽지 못했으면 `false` 다.
   */
  private async readBuffer(
    executionId: string,
  ): Promise<{ events: BufferedSseEvent[]; complete: boolean }> {
    const local = this.memoryBuffers.get(executionId) ?? [];
    if (!this.fanout.isEnabled()) return { events: local, complete: true };
    const remote = await this.fanout.readBuffer(executionId);
    if (remote === null) return { events: local, complete: false };
    if (local.length === 0) return { events: remote, complete: true };
    const bySeq = new Map<number, BufferedSseEvent>();
    for (const item of [...remote, ...local]) {
      if (!bySeq.has(item.seq)) bySeq.set(item.seq, item);
    }
    return { events: Array.from(bySeq.values()), complete: true };
  }

  /**
   * `closeTriggerTokenStreams` 의 이 서버 인스턴스 부분. 다른 서버 인스턴스에서 온 닫기 신호도 이것만 부른다(다시 알리지
   * 않는다).
   */
  private closeLocalTriggerTokenStreams(triggerIds: readonly string[]): number {
    const targets = new Set(triggerIds);
    // 해제가 맵과 집합을 지우므로 복사본을 돈다.
    const matched = Array.from(this.entries.values())
      .map((e) => e.subscriber)
      .filter(
        (s) => s.token.family === 'itk' && targets.has(s.token.triggerId),
      );
    for (const subscriber of matched) {
      this.unsubscribe(subscriber);
      this.closeSafely(subscriber);
    }
    return matched.length;
  }

  private closeSafely(subscriber: SseSubscriber): void {
    try {
      subscriber.close();
    } catch (err) {
      this.logger.warn(
        `SseAdapter close 실패 (id=${subscriber.id}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private handleEvent(event: ExecutionChannelEvent): void {
    if (this.fanout.isEnabled()) {
      // 다른 서버 인스턴스의 구독자와 replay 를 위해 Redis 에 넣는다. 넣지 못하면 메모리 버퍼에 둔다.
      void this.fanout.append(event).then((stored) => {
        if (!stored) this.remember(event);
      });
    } else {
      this.remember(event);
    }
    // 이 서버 인스턴스의 구독자에게는 Redis 를 거치지 않고 바로 보낸다.
    this.dispatch(event);
  }

  private dispatch(event: ExecutionChannelEvent): void {
    const set = this.entriesByExecution.get(event.executionId);
    if (!set) return;
    // 종료 이벤트가 해제를 부르므로 복사본을 돈다.
    for (const entry of Array.from(set)) {
      this.deliver(entry, event);
    }
  }

  private deliver(entry: SubscriberEntry, event: ExecutionChannelEvent): void {
    if (entry.phase === 'closed') return;
    if (entry.phase !== 'live') {
      entry.pending.push(event);
      if (entry.pending.length > SSE_BUFFER_MAX_EVENTS) {
        entry.pending.shift();
        entry.pendingOverflowed = true;
      }
      return;
    }
    this.deliverNow(entry, event);
  }

  private deliverNow(
    entry: SubscriberEntry,
    event: ExecutionChannelEvent,
  ): void {
    if (entry.phase === 'closed') return;
    if (event.seq > 0) {
      if (event.seq <= entry.lastSeq) return;
      entry.lastSeq = event.seq;
    }
    const subscriber = entry.subscriber;
    try {
      subscriber.push(event);
    } catch (err) {
      this.logger.warn(
        `SseAdapter push 실패 (id=${subscriber.id}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (TERMINAL_EVENT_TYPES.has(event.eventType)) {
      // 종료 이벤트 뒤에는 스트림을 끝낸다. 응답 종료는 다음 턴에 한다.
      this.unsubscribe(subscriber);
      setImmediate(() => this.closeSafely(subscriber));
    }
  }

  private remember(event: ExecutionChannelEvent): void {
    const now = Date.now();
    const cutoff = now - SSE_REPLAY_WINDOW_MS;
    const buffer = (this.memoryBuffers.get(event.executionId) ?? []).filter(
      (e) => e.receivedAt >= cutoff,
    );
    buffer.push({ seq: event.seq, receivedAt: now, event });
    // 상한 — 가장 오래된 것부터 폐기.
    while (buffer.length > SSE_BUFFER_MAX_EVENTS) buffer.shift();
    this.memoryBuffers.set(event.executionId, buffer);
  }

  /** 마지막 이벤트 뒤 5분이 지난 실행의 메모리 버퍼를 지운다. */
  private sweepMemoryBuffers(): void {
    const cutoff = Date.now() - SSE_REPLAY_WINDOW_MS;
    for (const [executionId, buffer] of this.memoryBuffers) {
      const last = buffer[buffer.length - 1];
      if (!last || last.receivedAt < cutoff) {
        this.memoryBuffers.delete(executionId);
      }
    }
  }
}
