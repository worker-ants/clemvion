// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-XPG8DQ` · `CLE-T-FHG7MT` · `CLE-T-8PYFDB`.
// SSE 이벤트를 replay 용으로 두고 다시 읽는 저장소. Redis 로 동작할 때와 메모리로 동작할 때의 분기를 이 파일에만 둔다.

import type { Logger } from '@nestjs/common';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import type { SseFanoutService } from './sse-fanout.service';
import type { BufferedSseEvent } from './sse-replay-buffer';
import type { SseBufferSnapshot } from './sse-replay-plan';
import {
  SSE_BUFFER_MAX_EVENTS,
  SSE_BUFFER_MAX_MESSAGE_BYTES,
  SSE_REPLAY_WINDOW_MS,
  SSE_TERMINAL_EVENT_TYPES,
} from './sse.constants';
import type { SseStreamEligibilityService } from './sse-stream-eligibility.service';

/**
 * 실행 하나의 Redis 쓰기 판정. `pending` 이면 판정을 기다리며 이벤트를 `queued` 에 순서대로 모은다. `write` 면 쓰고
 * `skip` 이면 버린다(EIA SSE 로 열릴 수 없는 실행). 한 번 정하면 종료 이벤트나 5분 동안 이벤트가 없어 지울 때까지
 * 바꾸지 않는다. 조회에 실패해 `write` 로 정했어도 그렇다.
 */
interface WriteScope {
  decision: 'pending' | 'write' | 'skip';
  queued: ExecutionChannelEvent[];
  /** 마지막 이벤트 시각(ms). 5분 동안 이벤트가 없으면 주기 정리가 지운다. */
  touchedAt: number;
  /** 크기 상한 경고를 이 실행에서 남겼는지. */
  omittedWarned: boolean;
}

/**
 * 이 서버 인스턴스의 메모리 버퍼. 실행마다 5분 안의 이벤트를 최대 {@link SSE_BUFFER_MAX_EVENTS} 개 둔다. 바이트 상한은
 * 두지 않는다(NERV Task `CLE-T-FHG7MT` 에서 정했다).
 */
export class SseMemoryBuffer {
  private readonly buffers = new Map<string, BufferedSseEvent[]>();

  /** 이벤트를 넣는다. 5분이 지난 항목을 지우고 상한을 넘으면 가장 오래된 것부터 버린다. */
  remember(event: ExecutionChannelEvent, now: number = Date.now()): void {
    const cutoff = now - SSE_REPLAY_WINDOW_MS;
    const buffer = (this.buffers.get(event.executionId) ?? []).filter(
      (e) => e.receivedAt >= cutoff,
    );
    buffer.push({ seq: event.seq, receivedAt: now, event });
    while (buffer.length > SSE_BUFFER_MAX_EVENTS) buffer.shift();
    this.buffers.set(event.executionId, buffer);
  }

  events(executionId: string): BufferedSseEvent[] {
    return this.buffers.get(executionId) ?? [];
  }

  size(executionId: string): number {
    return this.buffers.get(executionId)?.length ?? 0;
  }

  /** 마지막 이벤트가 `cutoff` 보다 오래된 실행의 버퍼를 지운다. */
  sweep(cutoff: number): void {
    for (const [executionId, buffer] of this.buffers) {
      const last = buffer[buffer.length - 1];
      if (!last || last.receivedAt < cutoff) this.buffers.delete(executionId);
    }
  }

  clear(): void {
    this.buffers.clear();
  }
}

/**
 * SSE 이벤트 저장소. Redis 버퍼(`SseFanoutService`)를 쓰고 Redis 에 이벤트 전체를 넣지 못한 이벤트는 메모리 버퍼에 둔다.
 * Redis 를 쓸 수 없으면(부팅 때 없거나 명령 실패) 메모리 버퍼만 쓴다. 읽을 때는 둘을 합친다.
 *
 * Redis 에는 EIA SSE 로 열릴 수 있는 실행의 이벤트만 쓴다. 라우팅 컨텍스트의 `triggerId` 가 이벤트에 붙어 있으면 바로
 * 쓴다. 없으면 실행마다 한 번 {@link SseStreamEligibilityService} 로 판정하고, 판정을 기다리는 동안 온 이벤트는
 * 순서대로 모았다가 판정 뒤에 쓰거나 버린다. 라우팅 컨텍스트만 보지 않는 것은 모든 이벤트 경로가 `triggerId` 를
 * 등록하지는 않기 때문이다(웹훅 실행의 종료 이벤트를 라우팅 해제 뒤에 내는 경로 등).
 */
export class SseEventStore {
  private readonly memory = new SseMemoryBuffer();
  /** 실행별 Redis 쓰기 판정. 종료 이벤트나 5분 동안 이벤트가 없으면 지운다. */
  private readonly writeScopes = new Map<string, WriteScope>();

  constructor(
    private readonly fanout: SseFanoutService,
    private readonly eligibility: SseStreamEligibilityService,
    private readonly logger: Logger,
  ) {}

  /** 이벤트를 replay 용으로 둔다. 던지지 않는다. Redis 쓰기는 기다리지 않는다. */
  store(event: ExecutionChannelEvent): void {
    if (!this.fanout.isEnabled()) {
      // Redis 없이 부팅했으면 판정 없이 메모리 버퍼에 둔다(이 서버 인스턴스의 replay 용이고 Redis 쓰기량과 무관하다).
      this.memory.remember(event);
      return;
    }
    const executionId = event.executionId;
    const routed = hasRoutingTrigger(event);
    let scope = this.writeScopes.get(executionId);
    if (!scope) {
      scope = {
        decision: 'pending',
        queued: [],
        touchedAt: 0,
        omittedWarned: false,
      };
      this.writeScopes.set(executionId, scope);
      if (!routed) void this.resolveScope(executionId, scope);
    }
    scope.touchedAt = Date.now();
    if (scope.decision === 'pending' && routed) {
      this.decide(scope, true);
    }
    if (scope.decision === 'write') {
      this.write(event, scope);
    } else if (scope.decision === 'pending') {
      scope.queued.push(event);
      // 판정이 늦어 모은 이벤트가 상한에 닿으면 더 기다리지 않고 쓴다. 버리지 않는 쪽으로 정한다.
      if (scope.queued.length >= SSE_BUFFER_MAX_EVENTS)
        this.decide(scope, true);
    }
    // 종료 이벤트 뒤에는 그 실행의 이벤트가 더 오지 않는다. 판정 중이면 그 판정이 모은 이벤트를 마저 처리한다.
    if (SSE_TERMINAL_EVENT_TYPES.has(event.eventType)) {
      this.writeScopes.delete(executionId);
    }
  }

  /**
   * Redis 버퍼와 메모리 버퍼를 합쳐 읽는다. 메모리 버퍼에는 Redis 에 이벤트 전체를 넣지 못한 이벤트만 있다. 같은 seq 는
   * 하나만 두고 생략 표시보다 이벤트 전체를 앞세운다. Redis 버퍼에서 `afterSeq` 이하 항목은 파싱하지 않고 `skipped` 로
   * 센다.
   */
  async read(
    executionId: string,
    afterSeq: number,
  ): Promise<SseBufferSnapshot> {
    const local = this.memory.events(executionId);
    if (!this.fanout.isEnabled()) {
      return { events: local, skipped: 0, complete: true };
    }
    const remote = await this.fanout.readBuffer(executionId, afterSeq);
    if (remote === null) return { events: local, skipped: 0, complete: false };
    if (local.length === 0) {
      return { events: remote.events, skipped: remote.skipped, complete: true };
    }
    const bySeq = new Map<number, BufferedSseEvent>();
    for (const item of [...remote.events, ...local]) {
      const existing = bySeq.get(item.seq);
      if (!existing || (existing.event === null && item.event !== null)) {
        bySeq.set(item.seq, item);
      }
    }
    return {
      events: Array.from(bySeq.values()),
      skipped: remote.skipped,
      complete: true,
    };
  }

  /** 실행의 순번 카운터. 읽지 못하면(키가 없음 · Redis 장애 · 메모리 모드) `null` 이다. */
  readLatestSeq(executionId: string): Promise<number | null> {
    return this.fanout.readLatestSeq(executionId);
  }

  /** 메모리 버퍼의 이벤트 수. Redis 로 동작하는 동안은 크기 상한을 넘은 이벤트만 센다. */
  bufferSize(executionId: string): number {
    return this.memory.size(executionId);
  }

  /** 마지막 이벤트 뒤 5분이 지난 실행의 메모리 버퍼와 쓰기 판정을 지운다. */
  sweep(now: number = Date.now()): void {
    const cutoff = now - SSE_REPLAY_WINDOW_MS;
    this.memory.sweep(cutoff);
    for (const [executionId, scope] of this.writeScopes) {
      if (scope.touchedAt < cutoff) this.writeScopes.delete(executionId);
    }
  }

  clear(): void {
    this.memory.clear();
    this.writeScopes.clear();
  }

  private async resolveScope(
    executionId: string,
    scope: WriteScope,
  ): Promise<void> {
    let open: boolean;
    try {
      open = await this.eligibility.canOpenStream(executionId);
    } catch {
      // `canOpenStream` 은 던지지 않는 계약이다. 어겨도 놓치지 않는 쪽으로 쓴다.
      open = true;
    }
    this.decide(scope, open);
  }

  /** 판정을 정하고 모은 이벤트를 순서대로 쓰거나 버린다. 이미 정했으면 아무것도 하지 않는다. */
  private decide(scope: WriteScope, open: boolean): void {
    if (scope.decision !== 'pending') return;
    scope.decision = open ? 'write' : 'skip';
    const queued = scope.queued;
    scope.queued = [];
    if (!open) return;
    for (const event of queued) this.write(event, scope);
  }

  /**
   * Redis 에 넣는다. 이벤트 전체를 넣지 못하면 메모리 버퍼에 둔다. `append` 는 던지지 않는 계약이다. 어겨서 거부돼도
   * 처리되지 않은 거부로 새지 않게 메모리 버퍼에 둔다.
   */
  private write(event: ExecutionChannelEvent, scope: WriteScope): void {
    void this.fanout.append(event).then(
      (result) => {
        if (result === 'stored') return;
        this.memory.remember(event);
        if (result === 'omitted') this.warnOmitted(event, scope);
      },
      () => this.memory.remember(event),
    );
  }

  private warnOmitted(event: ExecutionChannelEvent, scope: WriteScope): void {
    if (scope.omittedWarned) return;
    scope.omittedWarned = true;
    this.logger.warn(
      `EIA SSE 이벤트가 크기 상한(${SSE_BUFFER_MAX_MESSAGE_BYTES}바이트)을 넘어 Redis 에 생략 표시만 올렸다 — 다른 서버 인스턴스의 구독자는 execution.replay_unavailable 을 받는다(이 실행에서는 다시 남기지 않는다). executionId=${event.executionId} seq=${event.seq} eventType=${event.eventType}`,
    );
  }
}

/** 라우팅 컨텍스트가 이벤트에 `triggerId` 를 붙였는지. 붙었으면 트리거가 있는 실행이라 판정 조회 없이 쓴다. */
function hasRoutingTrigger(event: ExecutionChannelEvent): boolean {
  const triggerId = event.payload?.triggerId;
  return typeof triggerId === 'string' && triggerId.length > 0;
}
