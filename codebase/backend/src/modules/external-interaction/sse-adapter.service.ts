import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebsocketService } from '../websocket/websocket.service';
import type { InteractionStreamCloserPort } from './interaction-stream-closer';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import { errorMessage } from '../../common/utils/error-message';
import { SseFanoutService } from './sse-fanout.service';
import {
  SSE_BUFFER_MAX_EVENTS,
  SSE_MAX_CONNECTIONS_PER_EXECUTION,
  SSE_TERMINAL_EVENT_TYPES,
} from './sse.constants';
import { SseStreamEligibilityService } from './sse-stream-eligibility.service';
import { SseEventStore } from './sse-event-store';
import { mayHaveMissed, planReplay } from './sse-replay-plan';

/** 메모리 버퍼 · 쓰기 대상 판정에서 마지막 이벤트 뒤 5분이 지난 실행을 지우는 주기(ms). */
const MEMORY_BUFFER_SWEEP_INTERVAL_MS = 60_000;

/**
 * 버퍼가 요청 범위를 다 채우지 못할 때(만료나 상한 초과로 중간 순번 유실) 한 번 보내는 제어 프레임. 구독 공백과 크기
 * 상한으로 빠진 이벤트가 있으면 스트림 도중에도 보낸다. 내부 WebSocket 에는 대응 이벤트가 없다(`execution.snapshot` 으로
 * 대신한다). 이름은 SSE 이벤트 이름 규칙(`execution.*`)을 따른다.
 *
 * 근거: [EIA 수신 API와 SSE 「스트림 규칙」](CLE-EIA-INBOUND-STREAM#스트림-규칙), REQ-EIAIN-010 · REQ-EIAIN-011.
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

/**
 * 실시간 전달로 바꾸기 전에 모아 두는 것. `omitted` 는 다른 서버 인스턴스의 이벤트가 크기 상한을 넘어 생략 표시만 온
 * 자리다. 보낼 때 `execution.replay_unavailable` 이 된다.
 */
type PendingItem =
  | { kind: 'event'; event: ExecutionChannelEvent }
  | { kind: 'omitted'; seq: number };

interface SubscriberEntry {
  readonly subscriber: SseSubscriber;
  /**
   * `admitting`: 등록만 했다. `catching_up`: replay 중이다. 두 단계에서 도착한 이벤트는 `pending` 에 모은다.
   * `live`: 바로 보낸다. `closed`: 해제됐다.
   */
  phase: 'admitting' | 'catching_up' | 'live' | 'closed';
  /** 연결 상한 안에 들었는지. 이 서버 인스턴스 안에서 셀 때 쓴다. */
  admitted: boolean;
  pending: PendingItem[];
  /** `pending` 이 상한을 넘어 앞쪽을 버렸는지. */
  pendingOverflowed: boolean;
  /** 마지막으로 보낸 seq. 이 이하의 seq 는 버린다(replay 와 live 의 겹침). */
  lastSeq: number;
  /**
   * 클라이언트가 받은 위치를 아는지. `Last-Event-Id` 로 연결했거나 이벤트를 하나라도 보냈으면 안다. 모르면 구독이 다시
   * 확정됐을 때 놓친 구간을 버퍼로 채울 기준이 없다.
   */
  anchored: boolean;
  /** replay 중에 구독이 다시 확정됐다. 실시간 상태로 바꾼 직후 한 번 더 따라잡는다. */
  resyncRequested: boolean;
  holdsRedisSlot: boolean;
  retainsLive: boolean;
}

/**
 * [Spec EIA §5.2] — SSE adapter.
 *
 * 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P`.
 * 서버 인스턴스가 여럿이어도 구독자가 어느 인스턴스에 붙든 그 실행의 이벤트를 받고, 다른 인스턴스로 다시 연결해도 5분
 * replay 가 된다. Redis 쪽 저장과 신호는 {@link SseFanoutService} 가 한다. 이벤트를 두고 읽는 일과 Redis · 메모리 분기는
 * {@link SseEventStore} 가, replay 판정은 `sse-replay-plan.ts` 의 함수가 한다. 이 클래스는 구독자 상태와 전달을 맡는다.
 *
 * 책임:
 * 1. 자기 프로세스의 `WebsocketService.executionEvents$` 이벤트를 Redis 버퍼에 넣고 로컬 구독자에게 바로 보낸다.
 *    다른 서버 인스턴스의 이벤트는 live 채널로 받는다. Redis 에는 EIA SSE 로 열릴 수 있는 실행의 이벤트만 쓴다
 *    ({@link SseEventStore}, NERV Task `CLE-T-XPG8DQ`).
 * 2. 구독 순서: 등록(도착 이벤트를 모음) → 연결 상한 → live 채널 SUBSCRIBE 확인 → `lastEventId` 이후 replay → 모은 이벤트를
 *    보내고 실시간으로 바꾼다. 구독자마다 마지막으로 보낸 seq 이하는 버린다. seq 가 0 이하인 제어 프레임은 예외다.
 * 3. 구독이 다시 확정되면(구독 연결 재준비 · 늦은 SUBSCRIBE 확인) 실시간 구독자마다 그 사이 놓친 구간을 같은 판정으로
 *    채우거나 `execution.replay_unavailable` 을 보낸다(NERV Task `CLE-T-1GR2JE`).
 * 4. 종료 이벤트와 트리거 단위 토큰 무효 때 스트림을 끝낸다. 닫기 신호는 다른 서버 인스턴스에도 보낸다.
 *
 * Redis 를 쓸 수 없으면(부팅 때 없거나 명령 실패) 이 서버 인스턴스의 메모리로 동작한다. 메모리 버퍼는 마지막 이벤트
 * 뒤 5분이 지나면 주기 타이머가 지운다.
 */
@Injectable()
export class SseAdapter
  implements OnModuleInit, OnModuleDestroy, InteractionStreamCloserPort
{
  private readonly logger = new Logger(SseAdapter.name);
  private readonly events: SseEventStore;
  private readonly entries = new Map<string, SubscriberEntry>();
  private readonly entriesByExecution = new Map<string, Set<SubscriberEntry>>();
  private subscription: { unsubscribe: () => void } | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly fanout: SseFanoutService,
    eligibility: SseStreamEligibilityService,
  ) {
    this.events = new SseEventStore(fanout, eligibility, this.logger);
  }

  onModuleInit(): void {
    this.fanout.bind({
      onLiveEvent: (event) => this.dispatch(event),
      onLiveOmitted: (executionId, seq) =>
        this.dispatchOmitted(executionId, seq),
      onRemoteClose: (triggerIds) => {
        this.closeLocalTriggerTokenStreams(triggerIds);
      },
      onLiveResumed: (executionIds) => this.resync(executionIds),
    });
    this.subscription = this.websocketService.executionEvents$.subscribe({
      next: (event) => this.handleEvent(event),
      error: (err) =>
        this.logger.error(
          `SseAdapter subscription error: ${errorMessage(err)}`,
        ),
    });
    this.sweepTimer = setInterval(
      () => this.events.sweep(),
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
    this.events.clear();
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
    if (replayAfter !== undefined) {
      entry.lastSeq = replayAfter;
      entry.anchored = true;
    }
    if (this.fanout.isEnabled()) {
      entry.retainsLive = true;
      // 실패해도 이어 간다. 이 서버 인스턴스의 이벤트는 그대로 받는다. 늦게 확인되면 `onLiveResumed` 로 따라잡는다.
      await this.fanout.retainLive(subscriber.executionId);
      if (this.isClosed(entry)) return;
    }
    if (replayAfter !== undefined) {
      await this.replay(entry, replayAfter);
      if (this.isClosed(entry)) return;
    }
    this.goLive(entry);
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
    return this.events.bufferSize(executionId);
  }

  private register(subscriber: SseSubscriber): SubscriberEntry {
    const entry: SubscriberEntry = {
      subscriber,
      phase: 'admitting',
      admitted: false,
      pending: [],
      pendingOverflowed: false,
      lastSeq: 0,
      anchored: false,
      resyncRequested: false,
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
   * 모은 것을 보내고 실시간 상태로 바꾼다. 모은 것이 상한을 넘어 앞쪽을 버렸으면 먼저 `execution.replay_unavailable` 을
   * 보낸다. 모은 순서대로 보낸다. 그 사이 구독이 다시 확정됐으면 바로 한 번 더 따라잡는다.
   */
  private goLive(entry: SubscriberEntry): void {
    entry.phase = 'live';
    const pending = entry.pending;
    entry.pending = [];
    if (entry.pendingOverflowed) {
      entry.pendingOverflowed = false;
      this.sendReplayUnavailable(entry, entry.lastSeq);
    }
    for (const item of pending) {
      if (this.isClosed(entry)) return;
      if (item.kind === 'event') {
        this.deliverNow(entry, item.event);
      } else {
        this.signalOmitted(entry, item.seq);
      }
    }
    if (entry.resyncRequested && !this.isClosed(entry)) {
      void this.catchUp(entry);
    }
  }

  /**
   * 구독이 다시 확정된 실행의 구독자를 따라잡게 한다. 실시간 상태면 바로 따라잡는다. 아직 replay 중이면 표시만 해 두고
   * 실시간 상태로 바꾼 직후 따라잡는다. 아직 live 채널을 구독하지 않은 구독자는 그 뒤에 구독하므로 대상이 아니다.
   */
  private resync(executionIds: readonly string[]): void {
    for (const executionId of executionIds) {
      const set = this.entriesByExecution.get(executionId);
      if (!set) continue;
      for (const entry of Array.from(set)) {
        if (!entry.retainsLive) continue;
        if (entry.phase === 'live') {
          void this.catchUp(entry);
        } else if (entry.phase === 'catching_up') {
          entry.resyncRequested = true;
        }
      }
    }
  }

  /**
   * 구독이 끊겼던 사이 놓친 구간을 채운다. 그동안 온 이벤트는 다시 모은다. 기준 순번은 마지막으로 보낸 seq 이고 판정은
   * 재연결 replay 와 같다. 클라이언트가 받은 위치를 모르면(`Last-Event-Id` 없이 연결했고 보낸 이벤트가 없음) 연결 전
   * 이벤트와 놓친 이벤트를 가를 수 없으므로 버퍼를 읽지 않고 `execution.replay_unavailable` 을 보낸다.
   */
  private async catchUp(entry: SubscriberEntry): Promise<void> {
    entry.resyncRequested = false;
    entry.phase = 'catching_up';
    try {
      if (entry.anchored) {
        await this.replay(entry, entry.lastSeq);
      } else {
        this.sendReplayUnavailable(entry, entry.lastSeq);
      }
    } catch (err) {
      // replay 는 던지지 않는 계약이다. 어겨도 구독자가 모으는 상태에 묶이지 않게 신호를 보내고 이어 간다.
      this.logger.warn(
        `SseAdapter 따라잡기 실패 (id=${entry.subscriber.id}): ${errorMessage(err)}`,
      );
      this.sendReplayUnavailable(entry, entry.lastSeq);
    }
    if (this.isClosed(entry)) return;
    this.goLive(entry);
  }

  /**
   * 재연결 replay. 버퍼를 읽어 {@link planReplay} 로 정한다. 버퍼가 요청 범위를 다 채우지 못하면(만료나 상한 초과로 중간
   * 순번 유실, 생략 표시만 남은 항목) 일부만 보내지 않고 `execution.replay_unavailable` 을 한 번 보낸다. 클라이언트는
   * `GET /api/external/executions/:id` 로 현재 상태를 다시 읽는다. 버퍼만으로 정할 수 없으면 실행의 순번 카운터와 견준다.
   */
  private async replay(
    entry: SubscriberEntry,
    lastEventId: number,
  ): Promise<void> {
    const executionId = entry.subscriber.executionId;
    const buffer = await this.events.read(executionId, lastEventId);
    if (this.isClosed(entry)) return;
    const plan = planReplay(buffer, lastEventId, Date.now());
    switch (plan.kind) {
      case 'replay':
        for (const event of plan.events) {
          if (this.isClosed(entry)) return;
          this.deliverNow(entry, event);
        }
        return;
      case 'unavailable':
        this.sendReplayUnavailable(entry, lastEventId);
        return;
      case 'up_to_date':
        return;
      case 'check_counter': {
        const latest = await this.events.readLatestSeq(executionId);
        if (this.isClosed(entry)) return;
        if (mayHaveMissed(collectedEventSeqs(entry), lastEventId, latest)) {
          this.sendReplayUnavailable(entry, lastEventId);
        }
        return;
      }
    }
  }

  /** {@link buildReplayUnavailableEvent} 로 만든 제어 프레임을 구독자에게 바로 보낸다. */
  private sendReplayUnavailable(
    entry: SubscriberEntry,
    lastEventId: number,
  ): void {
    this.deliverNow(
      entry,
      buildReplayUnavailableEvent(entry.subscriber.executionId, lastEventId),
    );
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
        `SseAdapter close 실패 (id=${subscriber.id}): ${errorMessage(err)}`,
      );
    }
  }

  private handleEvent(event: ExecutionChannelEvent): void {
    // 다른 서버 인스턴스의 구독자와 replay 를 위해 둔다.
    this.events.store(event);
    // 이 서버 인스턴스의 구독자에게는 Redis 를 거치지 않고 바로 보낸다.
    this.dispatch(event);
  }

  /** 다른 서버 인스턴스의 이벤트가 크기 상한을 넘어 생략 표시만 왔다. 구독자마다 그 순번 자리에서 신호를 보낸다. */
  private dispatchOmitted(executionId: string, seq: number): void {
    const set = this.entriesByExecution.get(executionId);
    if (!set) return;
    for (const entry of Array.from(set)) {
      if (entry.phase === 'closed') continue;
      if (entry.phase !== 'live') {
        this.collect(entry, { kind: 'omitted', seq });
      } else {
        this.signalOmitted(entry, seq);
      }
    }
  }

  /**
   * 생략 표시 자리에서 `execution.replay_unavailable` 을 보낸다. 그 순번 이상을 이미 보냈으면 보내지 않는다. 생략 표시는
   * 받은 이벤트가 아니므로 마지막으로 보낸 seq 를 바꾸지 않는다.
   */
  private signalOmitted(entry: SubscriberEntry, seq: number): void {
    if (seq <= entry.lastSeq) return;
    this.sendReplayUnavailable(entry, entry.lastSeq);
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
      this.collect(entry, { kind: 'event', event });
      return;
    }
    this.deliverNow(entry, event);
  }

  private collect(entry: SubscriberEntry, item: PendingItem): void {
    entry.pending.push(item);
    if (entry.pending.length > SSE_BUFFER_MAX_EVENTS) {
      entry.pending.shift();
      entry.pendingOverflowed = true;
    }
  }

  private deliverNow(
    entry: SubscriberEntry,
    event: ExecutionChannelEvent,
  ): void {
    if (entry.phase === 'closed') return;
    if (event.seq > 0) {
      if (event.seq <= entry.lastSeq) return;
      entry.lastSeq = event.seq;
      entry.anchored = true;
    }
    const subscriber = entry.subscriber;
    try {
      subscriber.push(event);
    } catch (err) {
      this.logger.warn(
        `SseAdapter push 실패 (id=${subscriber.id}): ${errorMessage(err)}`,
      );
    }
    if (SSE_TERMINAL_EVENT_TYPES.has(event.eventType)) {
      // 종료 이벤트 뒤에는 스트림을 끝낸다. 응답 종료는 다음 턴에 한다.
      this.unsubscribe(subscriber);
      setImmediate(() => this.closeSafely(subscriber));
    }
  }
}

/**
 * `execution.replay_unavailable` 제어 프레임을 만든다. 재연결 응답 전용이라 단조 증가하는 스트림 위치가 아니고
 * `seq: 0` 을 쓴다. `sse-stream-session` 의 `writeSseFrame` 은 seq 가 0 이하면 SSE `id:` 줄을 빼서
 * 클라이언트의 Last-Event-Id 를 덮지 않는다.
 */
function buildReplayUnavailableEvent(
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

/** replay 를 기다리며 모은 이벤트의 순번. 생략 표시는 받은 이벤트가 아니므로 빼고 센다. */
function collectedEventSeqs(entry: SubscriberEntry): number[] {
  const seqs: number[] = [];
  for (const item of entry.pending) {
    if (item.kind === 'event') seqs.push(item.event.seq);
  }
  return seqs;
}
