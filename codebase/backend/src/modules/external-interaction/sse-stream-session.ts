// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림) · [「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰),
// NERV Task `CLE-T-Z35F7P` · `CLE-T-1GR2JE` · `CLE-T-FHG7MT` · `CLE-T-8PYFDB`.
// SSE 연결 하나의 수명주기. 컨트롤러는 요청을 풀어 이 객체를 만들고 실행만 시킨다.

import { HttpException, HttpStatus, type Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type {
  SseAdapter,
  SseStreamToken,
  SseSubscriber,
} from './sse-adapter.service';
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_MAX_CONNECTIONS_PER_EXECUTION,
  SSE_TOKEN_RECHECK_INTERVAL_MS,
} from './sse.constants';
import { errorMessage } from '../../common/utils/error-message';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

/** {@link SSE_TOKEN_RECHECK_INTERVAL_MS} 를 heartbeat 횟수로 바꾼 값. */
const TOKEN_RECHECK_EVERY_HEARTBEATS = Math.max(
  1,
  Math.round(SSE_TOKEN_RECHECK_INTERVAL_MS / SSE_HEARTBEAT_INTERVAL_MS),
);

/**
 * 트리거 단위 토큰(`itk_*`)을 다시 확인하는 창구. 컨트롤러가 요청 하나에 묶어 만든다. 실행 단위 토큰으로 연 스트림은 부르지
 * 않는다.
 */
export interface SseTokenCheck {
  /** 등록 뒤 한 번 다시 확인한다. 무효면 401 을 던진다. */
  reverify(): Promise<void>;
  /** 주기 재확인. 조회가 실패하면 던진다. */
  isValid(): Promise<boolean>;
  /** SSE 헤더를 보내기 전에 서버가 닫았을 때 401 을 던진다. */
  reject(): never;
}

export type SseStreamAdapterPort = Pick<
  SseAdapter,
  'admit' | 'start' | 'unsubscribe' | 'touch'
>;

/**
 * SSE 연결 하나. 단계 순서는 등록과 연결 상한 → 토큰 재확인 → SSE 헤더 → heartbeat → replay 와 실시간 전달이다.
 *
 * SSE 헤더를 보내기 전에는 401 · 429 를 던져 전역 필터가 오류 봉투로 답한다. 헤더를 보낸 뒤에는 응답을 끝내기만 한다.
 * 서버가 닫을 때(종료 이벤트 · 트리거 단위 토큰 무효)는 어댑터가 구독을 이미 풀었으므로 응답만 끝낸다. 클라이언트가 끊으면
 * {@link onClientClose} 가 구독을 풀고 응답을 끝낸다.
 *
 * `itk_*` 로 연 스트림은 {@link SSE_TOKEN_RECHECK_INTERVAL_MS} 마다 토큰을 다시 확인한다. 무효면 서버가 닫을 때와 같이
 * 닫는다. 조회가 실패하면 스트림을 그대로 두고 다음 주기에 다시 본다. 확인이 끝나기 전에 다음 주기가 와도 겹쳐 확인하지
 * 않는다.
 */
export class SseStreamSession {
  readonly subscriber: SseSubscriber;
  /** SSE 헤더를 보냈는지. 보내기 전이면 401 · 429 를 낼 수 있다. */
  private streaming = false;
  /** SSE 헤더를 보내기 전에 서버가 닫았는지(트리거 단위 토큰 무효). 그러면 401 로 답한다. */
  private closedBeforeStreaming = false;
  private finished = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private beats = 0;
  private rechecking = false;

  constructor(
    private readonly res: Response,
    executionId: string,
    token: SseStreamToken,
    private readonly adapter: SseStreamAdapterPort,
    private readonly tokenCheck: SseTokenCheck,
    private readonly logger: Logger,
  ) {
    this.subscriber = {
      id: randomUUID(),
      executionId,
      token,
      push: (event: ExecutionChannelEvent) => writeSseFrame(res, event),
      // 종료 이벤트 뒤와 트리거 단위 토큰 무효 때 어댑터가 부른다.
      close: () => this.onServerClose(),
    };
  }

  /** 클라이언트가 끊었다. 첫 `await` 앞에 걸어야 기다리는 사이에 끊긴 연결도 정리된다. */
  onClientClose(): void {
    this.adapter.unsubscribe(this.subscriber);
    this.finish();
  }

  /** 연결을 연다. 401 · 429 는 SSE 헤더를 보내기 전에만 던진다. */
  async run(lastEventId: number | undefined): Promise<void> {
    if (!(await this.admit())) return;
    if (!(await this.reverify())) return;
    this.openStream();
    this.startHeartbeat();
    await this.adapter.start(this.subscriber, lastEventId);
  }

  /**
   * 구독자를 먼저 등록하고 연결 상한을 센다. 등록 뒤에 온 닫기 신호는 이 구독자를 닫는다. 이어 갈지를 돌려준다. 상한이면
   * 429 를 던진다.
   */
  private async admit(): Promise<boolean> {
    const admitted = await this.adapter.admit(this.subscriber);
    if (this.finished) return false;
    if (this.closedBeforeStreaming) this.tokenCheck.reject();
    if (!admitted) {
      throw new HttpException(
        {
          error: {
            code: 'TOO_MANY_CONNECTIONS',
            message: `Execution-scope SSE 연결이 최대 ${SSE_MAX_CONNECTIONS_PER_EXECUTION} 개를 초과합니다.`,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /**
   * 가드를 통과한 뒤 등록하기 전에 트리거 단위 토큰이 무효가 됐을 수 있다. 등록 뒤에 다시 확인한다. 이어 갈지를 돌려준다.
   */
  private async reverify(): Promise<boolean> {
    if (this.subscriber.token.family !== 'itk') return true;
    try {
      await this.tokenCheck.reverify();
    } catch (err) {
      this.adapter.unsubscribe(this.subscriber);
      throw err;
    }
    if (this.finished) return false;
    // 다시 확인하는 동안 닫기 신호가 왔다. 읽기가 커밋 앞의 값을 봤을 수 있으므로 신호를 따른다.
    if (this.closedBeforeStreaming) this.tokenCheck.reject();
    return true;
  }

  private openStream(): void {
    const res = this.res;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 등 proxy 버퍼링 무력화
    res.flushHeaders?.();
    this.streaming = true;
  }

  /** heartbeat. 연결 상한 자리의 시각도 함께 갱신하고 `itk_*` 스트림이면 주기마다 토큰을 다시 확인한다. */
  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      try {
        this.res.write(`: heartbeat\n\n`);
      } catch {
        // 연결 끊긴 후의 write 는 무시.
      }
      this.adapter.touch(this.subscriber);
      if (this.subscriber.token.family !== 'itk') return;
      this.beats += 1;
      if (this.beats % TOKEN_RECHECK_EVERY_HEARTBEATS !== 0 || this.rechecking)
        return;
      this.rechecking = true;
      void this.recheckToken().finally(() => {
        this.rechecking = false;
      });
    }, SSE_HEARTBEAT_INTERVAL_MS);
  }

  private async recheckToken(): Promise<void> {
    let valid: boolean;
    try {
      valid = await this.tokenCheck.isValid();
    } catch (err) {
      this.logger.warn(
        `EIA SSE 트리거 단위 토큰 재확인 실패 — 스트림을 그대로 두고 다음 주기에 다시 확인한다 (executionId=${this.subscriber.executionId}): ${errorMessage(err)}`,
      );
      return;
    }
    if (valid || this.finished) return;
    this.adapter.unsubscribe(this.subscriber);
    this.finish();
  }

  private onServerClose(): void {
    if (this.streaming) {
      this.finish();
    } else {
      this.closedBeforeStreaming = true;
    }
  }

  /** 응답을 끝낸다. 구독 해제는 하지 않는다(서버가 닫을 때는 어댑터가 이미 했다). */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    try {
      this.res.end();
    } catch {
      // 이미 종료된 응답.
    }
  }
}

/**
 * 단일 ExecutionChannelEvent 를 SSE frame 형식으로 응답에 write.
 *
 * Frame format:
 *   event: <eventType>
 *   id: <seq>            # 실행-scope monotonic seq(>0) 를 가진 이벤트만
 *   data: <JSON.stringify(payload)>
 *   (빈 줄)
 *
 * `id:` 규약: 실행-scope monotonic seq(1부터)를 가진 이벤트만 `id:` 를 싣는다. control
 * frame(`execution.replay_unavailable`, seq=0)은 스트림 위치가 아니므로 `id:` 를 생략한다 —
 * 브라우저 native EventSource 의 Last-Event-Id 가 0 으로 오염돼 다음 자동 재연결이 전체
 * replay(`?lastEventId=0`)를 촉발하는 것을 막는다 (Spec EIA §5.2 / §5.3 seq sentinel 관례와 정합).
 */
export function writeSseFrame(
  res: Response,
  event: ExecutionChannelEvent,
): void {
  const lines = [`event: ${event.eventType}`];
  if (Number.isFinite(event.seq) && event.seq > 0) {
    lines.push(`id: ${event.seq}`);
  }
  lines.push(`data: ${JSON.stringify(event.payload)}`, '', '');
  try {
    res.write(lines.join('\n'));
  } catch {
    // 연결 끊긴 후 write 무시.
  }
}
