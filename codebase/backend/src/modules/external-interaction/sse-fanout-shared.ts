// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-8PYFDB`.
// `SseFanoutService` 를 이루는 replay 버퍼 · 연결 상한 · 신호 버스가 함께 쓰는 것: 메시지 형식, 실패 · 복구 로그 상태,
// Redis 응답 상한.

import type { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { validate as isUuid } from 'uuid';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';
import { errorMessage } from '../../common/utils/error-message';

/** 메시지 형식 버전. 형식을 바꾸면 올리고, 모르는 버전은 받는 쪽이 버린다. */
const MESSAGE_VERSION = 1;

/**
 * 요청 경로에서 Redis 응답을 기다리는 상한(ms). 공유 연결이 끊겨 있으면 ioredis 는 명령을 쌓아 두었다가 재연결
 * 시도가 거듭된 뒤에야 거부한다. 넘으면 실패로 보고 메모리 동작으로 넘어간다. `channel-listener.bus.ts` 와 같은 값이다.
 */
export const REDIS_WAIT_TIMEOUT_MS = 2000;

/** 명령을 보낼 공유 연결. Redis 를 쓸 수 없으면 `null` 이다. */
export type RedisClientRef = () => Redis | null;

/** 버퍼 항목 · live 메시지를 읽은 결과. `event` 가 `null` 이면 크기 상한을 넘어 생략 표시만 온 것이다. */
export interface DecodedSseEntry {
  origin: string;
  seq: number;
  event: ExecutionChannelEvent | null;
}

/**
 * Redis 명령 실패의 경고 · 복구 로그 상태. 경고는 실패 종류(`op`)마다 복구 전까지 한 번만 남긴다. 카운터는 세지 않는다.
 * 카운터는 각 부분의 `degrade` 가 호출부마다 리터럴 reason 으로 센다(라벨 쌍 가드가 같은 파일의 호출부를 읽는다).
 */
export class SseFanoutHealth {
  /** 경고를 남긴 실패 종류. 같은 종류가 다시 성공할 때까지 경고를 다시 남기지 않는다. */
  private readonly degradedOps = new Set<string>();

  constructor(private readonly logger: Logger) {}

  /** 실패 종류를 기록하고 경고를 남긴다. 같은 종류가 복구되기 전이면 다시 남기지 않는다. */
  markDegraded(op: string, err: unknown): void {
    if (this.degradedOps.has(op)) return;
    this.degradedOps.add(op);
    this.logger.warn(
      `EIA SSE Redis ${op} 실패 — 이 서버 인스턴스의 메모리로 처리한다(복구될 때까지 다시 남기지 않는다): ${errorMessage(err)}`,
    );
  }

  /** 경고는 남기지 않고 실패만 기록한다. 호출자가 따로 로그를 남길 때 복구 로그를 위해 쓴다. */
  markFailed(op: string): void {
    this.degradedOps.add(op);
  }

  recover(op: string): void {
    if (!this.degradedOps.delete(op)) return;
    this.logger.log(`EIA SSE Redis ${op} 복구`);
  }
}

/**
 * 메시지 형식. 이 서버 인스턴스의 `origin` 을 메시지에 넣어 자기 메시지를 알아본다. Redis 는 믿는 저장소지만 형식까지
 * 믿지는 않는다.
 */
export class SseMessageCodec {
  /** 이 프로세스의 id. 자기 메시지를 알아보는 데만 쓴다. */
  readonly origin = randomUUID();
  /**
   * 이 서버 인스턴스가 낸 메시지의 고정 접두. {@link encodeEvent} 가 키 순서(`v`, `origin`, …)를 정하므로 이 접두로
   * 시작하는 live 메시지는 자기 것이다.
   */
  private readonly ownMessagePrefix = `{"v":${MESSAGE_VERSION},"origin":${JSON.stringify(this.origin)},`;

  encodeEvent(event: ExecutionChannelEvent): string {
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
  encodeOmitted(event: ExecutionChannelEvent): string {
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

  encodeClose(triggerIds: readonly string[]): string {
    return JSON.stringify({
      v: MESSAGE_VERSION,
      origin: this.origin,
      triggerIds,
    });
  }

  /** 이 서버 인스턴스가 낸 live 메시지인지. 파싱하지 않고 접두로 본다. */
  isOwnMessage(message: string): boolean {
    return message.startsWith(this.ownMessagePrefix);
  }

  /**
   * 버퍼 항목 · live 메시지를 바꾼다. 이벤트면 `event` 를, 생략 표시면 `event: null` 을 준다. 형식이 맞지 않거나 다른
   * 실행의 것이면 `null` 이다.
   */
  decodeEntry(message: string, executionId: string): DecodedSseEntry | null {
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
  decodeClose(message: string): string[] | null {
    const m = parseObject(message);
    if (!m || m.v !== MESSAGE_VERSION) return null;
    if (typeof m.origin !== 'string' || m.origin.length === 0) return null;
    if (m.origin === this.origin) return null;
    const ids = m.triggerIds;
    if (!Array.isArray(ids) || ids.length === 0) return null;
    if (!ids.every((id) => typeof id === 'string' && isUuid(id))) return null;
    return ids as string[];
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
