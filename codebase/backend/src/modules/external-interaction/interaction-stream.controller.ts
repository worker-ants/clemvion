import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { Public } from '../../common/decorators';
import { InteractionGuard } from './interaction.guard';
import type { RequestWithInteraction } from './interaction.guard';
import { SseAdapter, SseSubscriber } from './sse-adapter.service';
import type { ExecutionChannelEvent } from '../websocket/websocket.service';

const HEARTBEAT_MS = 15_000;
const MAX_CONCURRENT_SUBS_PER_EXEC = 3;
const TERMINAL_EVENT_TYPES = new Set([
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

/**
 * [Spec EIA §5.2] — Server-Sent Events stream.
 *
 * 경로: `GET /api/external/executions/:executionId/stream`.
 * `text/event-stream` 응답으로 long-lived connection. 클라이언트는 EventSource 또는 fetch 로 소비.
 *
 * 핵심 동작:
 * - `Last-Event-Id` 헤더 (또는 `?lastEventId=` query) → SseAdapter 가 5분 buffer 에서 누락분 replay
 * - 15초 heartbeat (`: heartbeat` comment) — proxy idle timeout 회피
 * - terminal event (`completed`/`failed`/`cancelled`) 발송 후 자동 종료
 * - execution 당 동시 구독 한도 3 — 초과 시 즉시 종료 + `event: error` 1회 발송
 */
@ApiTags('External Interaction')
@ApiBearerAuth('interaction-token')
@Controller('external/executions')
@Public()
@UseGuards(InteractionGuard)
export class InteractionStreamController {
  constructor(private readonly sseAdapter: SseAdapter) {}

  @Get(':executionId/stream')
  @ApiOperation({
    summary: '실행 이벤트 SSE 스트림',
    description:
      '실행의 라이브 이벤트를 Server-Sent Events 로 수신. Last-Event-Id 로 5분 buffer 에서 누락분 재전송. terminal 이벤트 발송 후 자동 종료. EventSource 사용 시 토큰을 ?token= 쿼리로도 받아준다.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'TOKEN_*' })
  stream(
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
    @Req() req: RequestWithInteraction,
    @Res() res: Response,
    @Headers('last-event-id') headerLastEventId?: string,
  ): void {
    const ctx = req.interaction;
    if (!ctx) {
      res.status(500).end('interaction context missing');
      return;
    }
    // 동시 연결 제한
    const current = this.sseAdapter.subscriberCount(executionId);
    if (current >= MAX_CONCURRENT_SUBS_PER_EXEC) {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_CONNECTIONS',
          message: `Execution-scope SSE 연결이 최대 ${MAX_CONCURRENT_SUBS_PER_EXEC} 개를 초과합니다.`,
        },
      });
      return;
    }

    // SSE 헤더
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 등 proxy 버퍼링 무력화
    res.flushHeaders?.();

    const lastEventIdRaw =
      headerLastEventId ?? (req.query as { lastEventId?: string }).lastEventId;
    const lastEventId =
      lastEventIdRaw !== undefined && lastEventIdRaw !== ''
        ? Number(lastEventIdRaw)
        : undefined;

    // heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        // 연결 끊긴 후의 write 는 무시.
      }
    }, HEARTBEAT_MS);

    const subscriber: SseSubscriber = {
      id: randomUUID(),
      executionId,
      push: (event: ExecutionChannelEvent) => {
        writeSseFrame(res, event);
        if (TERMINAL_EVENT_TYPES.has(event.eventType)) {
          // terminal — 잠시 후 자동 종료.
          setImmediate(() => {
            this.sseAdapter.unsubscribe(subscriber);
            clearInterval(heartbeat);
            try {
              res.end();
            } catch {
              // 이미 종료된 응답.
            }
          });
        }
      },
    };

    // 클라이언트 disconnect 처리
    req.on('close', () => {
      clearInterval(heartbeat);
      this.sseAdapter.unsubscribe(subscriber);
    });

    this.sseAdapter.subscribe(
      subscriber,
      Number.isFinite(lastEventId) ? lastEventId : undefined,
    );
  }
}

/**
 * 단일 ExecutionChannelEvent 를 SSE frame 형식으로 응답에 write.
 *
 * Frame format:
 *   event: <eventType>
 *   id: <seq>
 *   data: <JSON.stringify(payload)>
 *   (빈 줄)
 */
function writeSseFrame(res: Response, event: ExecutionChannelEvent): void {
  const lines = [
    `event: ${event.eventType}`,
    `id: ${event.seq}`,
    `data: ${JSON.stringify(event.payload)}`,
    '',
    '',
  ];
  try {
    res.write(lines.join('\n'));
  } catch {
    // 연결 끊긴 후 write 무시.
  }
}
