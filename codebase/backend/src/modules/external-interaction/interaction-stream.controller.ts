import {
  Controller,
  Get,
  Headers,
  Logger,
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
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { InteractionGuard } from './interaction.guard';
import type {
  ExternalInteractionRequestContext,
  RequestWithInteraction,
} from './interaction.guard';
import { SseAdapter, type SseStreamToken } from './sse-adapter.service';
import { SseStreamSession, type SseTokenCheck } from './sse-stream-session';

// 근거: [EIA 데이터와 흐름 「SSE 스트림」](CLE-EIA-DATA#sse-스트림), NERV Task `CLE-T-Z35F7P` · `CLE-T-EQDYC1`.
// 토큰 재확인 주기의 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰), NERV Task `CLE-T-1GR2JE`.
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
 *   옛 토큰으로 다시 연결하면 가드가 401 로 거부한다. 닫기 신호를 놓친 스트림도 `SSE_TOKEN_RECHECK_INTERVAL_MS`(60초)
 *   마다 토큰을 다시 확인해 닫는다. 닫기 신호는 Redis pub/sub 이라 발행이 실패하거나 구독 연결이 끊긴 사이 나가면 다른
 *   서버 인스턴스의 스트림에 닿지 않는다. 그래도 이 주기 안에는 닫힌다. 스트림 하나가 주기마다 트리거 행 하나를 읽는다.
 * - execution 당 동시 연결 한도 3 — 모든 서버 인스턴스를 합쳐 센다. 초과 시 429 `TOO_MANY_CONNECTIONS`. SSE 헤더를
 *   보내기 전이라 `HttpException` 을 던져 전역 필터가 `requestId` 를 담은 오류 봉투를 만든다.
 * - EventSource 는 헤더를 못 보내므로 토큰을 `?token=` 쿼리로도 받는다.
 *
 * 연결 하나의 수명주기(연결 상한 · 토큰 재확인 · heartbeat · 정리)는 {@link SseStreamSession} 이 맡는다. 이 핸들러는 요청을
 * 풀어 세션을 만들고 실행시킨다.
 */
@ApiTags('External Interaction')
@ApiBearerAuth('interaction-token')
@Controller('external/executions')
@UseGuards(InteractionGuard)
export class InteractionStreamController {
  private readonly logger = new Logger(InteractionStreamController.name);

  constructor(
    private readonly sseAdapter: SseAdapter,
    private readonly interactionGuard: InteractionGuard,
  ) {}

  @Public()
  @Get(':executionId/stream')
  @ApiOperation({
    summary: '실행 이벤트 SSE 스트림',
    description:
      '실행의 라이브 이벤트를 Server-Sent Events 로 보내고 종료 이벤트 뒤에 응답을 끝낸다. Last-Event-Id 를 주면 5분 버퍼에서 놓친 이벤트를 다시 보낸다.',
  })
  @ApiParam({ name: 'executionId', format: 'uuid' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'SSE 스트림 — EventSource 류 클라이언트로 읽는다',
  })
  @ApiUnauthorizedResponse({ description: 'TOKEN_*' })
  @ApiTooManyRequestsResponse({
    description:
      'TOO_MANY_CONNECTIONS — 실행 하나에 열린 SSE 연결이 모든 서버 인스턴스를 합쳐 3개다.',
  })
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
    const session = new SseStreamSession(
      res,
      executionId,
      toStreamToken(ctx),
      this.sseAdapter,
      this.tokenCheckFor(req),
      this.logger,
    );
    req.on('close', () => session.onClientClose());
    await session.run(
      resolveLastEventId(
        headerLastEventId,
        (req.query as { lastEventId?: string }).lastEventId,
      ),
    );
  }

  /** 이 요청의 트리거 단위 토큰을 다시 확인하는 창구. 확인은 가드가 한다. */
  private tokenCheckFor(req: RequestWithInteraction): SseTokenCheck {
    const guard = this.interactionGuard;
    return {
      reverify: () => guard.reverifyTriggerToken(req),
      isValid: () => guard.isTriggerTokenValid(req),
      reject: () => guard.rejectTriggerToken(req),
    };
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

/** `Last-Event-Id` 헤더나 `?lastEventId=` 값. 비었거나 숫자가 아니면 `undefined` 다. 정수로 맞추는 일은 어댑터가 한다. */
export function parseLastEventId(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** 헤더가 있으면(빈 문자열 포함) 헤더를, 없으면 쿼리를 읽는다. */
export function resolveLastEventId(
  header: string | undefined,
  query: string | undefined,
): number | undefined {
  return parseLastEventId(header ?? query);
}
