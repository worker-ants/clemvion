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
  ApiOkResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { Public } from '../../common/decorators';
import { InteractionGuard } from './interaction.guard';
import type {
  ExternalInteractionRequestContext,
  RequestWithInteraction,
} from './interaction.guard';
import {
  SseAdapter,
  type SseStreamToken,
  type SseSubscriber,
} from './sse-adapter.service';
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_MAX_CONNECTIONS_PER_EXECUTION,
} from './sse-fanout.service';
import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';

// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-EQDYC1`.
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
 * - `itk_*` 로 연 스트림은 그 트리거 단위 토큰이 무효가 되면(재발급 · 전략 변경 · 인터랙션 끄기 · 트리거 삭제) 서버가
 *   응답을 끝낸다. 어느 서버 인스턴스에 붙은 스트림이든 닫는다. 닫힘을 알리는 이벤트는 없다. 새 토큰으로 다시 연결한다.
 *   옛 토큰으로 다시 연결하면 가드가 401 로 거부한다.
 * - execution 당 동시 연결 한도 3 — 모든 서버 인스턴스를 합쳐 센다. 초과 시 429 `TOO_MANY_CONNECTIONS`
 */
@ApiTags('External Interaction')
@ApiBearerAuth('interaction-token')
@Controller('external/executions')
@UseGuards(InteractionGuard)
export class InteractionStreamController {
  constructor(
    private readonly sseAdapter: SseAdapter,
    private readonly interactionGuard: InteractionGuard,
  ) {}

  @Public()
  @Get(':executionId/stream')
  @ApiOperation({
    summary: '실행 이벤트 SSE 스트림',
    description:
      '실행의 라이브 이벤트를 Server-Sent Events 로 수신. Last-Event-Id 로 5분 buffer 에서 누락분 재전송. terminal 이벤트 발송 후 자동 종료. 트리거 단위 토큰(itk_*)으로 연 스트림은 그 토큰이 무효가 되면(재발급 · 전략 변경 · 인터랙션 끄기 · 트리거 삭제) 서버가 응답을 끝낸다 — 새 토큰으로 다시 연결한다(옛 토큰은 401). EventSource 사용 시 토큰을 ?token= 쿼리로도 받아준다.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'SSE 스트림 — EventSource 류 클라이언트로 읽는다',
  })
  @ApiUnauthorizedResponse({ description: 'TOKEN_*' })
  async stream(
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
    @Req() req: RequestWithInteraction,
    @Res() res: Response,
    @Headers('last-event-id') headerLastEventId?: string,
  ): Promise<void> {
    const ctx = req.interaction;
    if (!ctx) {
      res.status(500).end('interaction context missing');
      return;
    }

    // SSE 헤더를 보냈는지. 보내기 전이면 401 · 429 를 낼 수 있다.
    let streaming = false;
    // SSE 헤더를 보내기 전에 서버가 닫았는지(트리거 단위 토큰 무효). 그러면 401 로 답한다.
    let closedBeforeStreaming = false;
    let finished = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    // 응답을 끝낸다. 구독 해제는 하지 않는다(서버가 닫을 때는 어댑터가 이미 했다).
    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (heartbeat) clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        // 이미 종료된 응답.
      }
    };

    const subscriber: SseSubscriber = {
      id: randomUUID(),
      executionId,
      token: toStreamToken(ctx),
      push: (event: ExecutionChannelEvent) => writeSseFrame(res, event),
      // 종료 이벤트 뒤와 트리거 단위 토큰 무효 때 어댑터가 부른다.
      close: () => {
        if (streaming) {
          finish();
        } else {
          closedBeforeStreaming = true;
        }
      },
    };

    // 클라이언트 disconnect 처리. 첫 await 앞에 걸어야 기다리는 사이에 끊긴 연결도 정리된다.
    req.on('close', () => {
      this.sseAdapter.unsubscribe(subscriber);
      finish();
    });

    // 구독자를 먼저 등록하고 연결 상한을 센다. 등록 뒤에 온 닫기 신호는 이 구독자를 닫는다.
    const admitted = await this.sseAdapter.admit(subscriber);
    if (finished) return;
    if (closedBeforeStreaming) this.interactionGuard.rejectTriggerToken(req);
    if (!admitted) {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_CONNECTIONS',
          message: `Execution-scope SSE 연결이 최대 ${SSE_MAX_CONNECTIONS_PER_EXECUTION} 개를 초과합니다.`,
        },
      });
      return;
    }

    // 가드를 통과한 뒤 등록하기 전에 트리거 단위 토큰이 무효가 됐을 수 있다. 등록 뒤에 다시 확인한다.
    if (subscriber.token.family === 'itk') {
      try {
        await this.interactionGuard.reverifyTriggerToken(req);
      } catch (err) {
        this.sseAdapter.unsubscribe(subscriber);
        throw err;
      }
      if (finished) return;
      // 다시 확인하는 동안 닫기 신호가 왔다. 읽기가 커밋 앞의 값을 봤을 수 있으므로 신호를 따른다.
      if (closedBeforeStreaming) this.interactionGuard.rejectTriggerToken(req);
    }

    // SSE 헤더
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx 등 proxy 버퍼링 무력화
    res.flushHeaders?.();
    streaming = true;

    const lastEventIdRaw =
      headerLastEventId ?? (req.query as { lastEventId?: string }).lastEventId;
    const lastEventId =
      lastEventIdRaw !== undefined && lastEventIdRaw !== ''
        ? Number(lastEventIdRaw)
        : undefined;

    // heartbeat. 연결 상한 자리의 시각도 함께 갱신한다.
    heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        // 연결 끊긴 후의 write 는 무시.
      }
      this.sseAdapter.touch(subscriber);
    }, SSE_HEARTBEAT_INTERVAL_MS);

    await this.sseAdapter.start(
      subscriber,
      Number.isFinite(lastEventId) ? lastEventId : undefined,
    );
  }
}

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰).
/**
 * 스트림을 연 토큰. `itk_*` 로 연 스트림은 그 토큰이 무효가 되면 서버가 닫는다(`SseAdapter.closeTriggerTokenStreams` 가
 * `close` 를 부른다). 가드는 `itk` 에 늘 `triggerId` 를 채운다. 비어 있으면 다시 확인할 때 401 이 된다.
 */
function toStreamToken(ctx: ExternalInteractionRequestContext): SseStreamToken {
  return ctx.tokenFamily === 'itk'
    ? { family: 'itk', triggerId: ctx.triggerId ?? '' }
    : { family: 'iext' };
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
 *
 * @internal 단위 테스트(`interaction-stream.controller.spec.ts`)를 위해 export.
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
