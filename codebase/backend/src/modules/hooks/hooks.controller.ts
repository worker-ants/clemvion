import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiPayloadTooLargeResponse,
} from '@nestjs/swagger';
import {
  ApiAcceptedWrappedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { Public } from '../../common/decorators';
import { HooksService } from './hooks.service';
import { PublicWebhookThrottleGuard } from './public-webhook-throttle.guard';
import { EmbedConfigService } from './embed-config.service';
import { WebhookAcceptedDto } from './dto/responses/webhook-response.dto';
import { EmbedConfigDto } from './dto/responses/embed-config.dto';

/** embed-config 응답 캐시 max-age (초). CDN·브라우저 캐시 의존 설계 — 워크스페이스 설정 변경 후 최대 이 시간 내 반영(I17/I1). */
const EMBED_CONFIG_CACHE_SEC = 300;

@ApiTags('Hooks')
@Controller('hooks')
export class HooksController {
  constructor(
    private readonly hooksService: HooksService,
    private readonly embedConfigService: EmbedConfigService,
  ) {}

  @Public()
  @Get(':endpointPath/embed-config')
  @ApiOperation({
    summary: '위젯 임베드 설정(공개)',
    description:
      '공개 웹챗 위젯이 부팅 시 조회하는 임베드 allowlist(캐시 가능). 워크스페이스 `interactionAllowedOrigins` 를 반환하며, 비어 있으면 제한 없음(allow-all). 위젯은 enforce=true 이고 호스트 origin 이 allowlist 에 없으면 렌더/시작을 거부한다. spec 7-channel-web-chat/4-security §3-①.\n\n**fail-open 정책**: DB 조회 실패·trigger 미존재 시 `{ allowlist: [], enforce: false }` (HTTP 200) 를 반환 — 위젯을 깨지 않는 soft 검증. 인증 webhook(authConfigId NOT NULL)도 동일하게 allow-all 반환(allowlist 노출 방지).\n\n**캐싱**: 응답에 `Cache-Control: public, max-age=300` 헤더가 포함된다. 워크스페이스 allowlist 변경 후 최대 5분 지연.',
  })
  @ApiParam({
    name: 'endpointPath',
    description: '트리거 등록 시 발급된 고유 엔드포인트 경로',
    example: 'abcd1234',
  })
  @ApiOkWrappedResponse(EmbedConfigDto, {
    description:
      '임베드 allowlist. 전역 TransformInterceptor 에 의해 `{ data: ... }` 로 래핑.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache-Control 응답 헤더 — CDN/브라우저 캐시 허용(W10).',
    headers: {
      'Cache-Control': {
        description: `public, max-age=${300} — 워크스페이스 설정 변경 후 최대 5분 반영 지연(I1).`,
        schema: { type: 'string', example: 'public, max-age=300' },
      },
    },
  })
  async getEmbedConfig(
    @Param('endpointPath') endpointPath: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmbedConfigDto> {
    const result = await this.embedConfigService.resolve(endpointPath);
    // 캐시 가능 — 워크스페이스 설정 변경 주기 대비 짧게(5분). trigger 존재 노출 회피 위해 동일 응답형.
    res.set('Cache-Control', `public, max-age=${EMBED_CONFIG_CACHE_SEC}`);
    return result;
  }

  @Public()
  @UseGuards(PublicWebhookThrottleGuard)
  @Post(':endpointPath')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '웹훅 수신',
    description:
      '외부 서비스가 호출하는 웹훅 엔드포인트입니다. 등록된 `endpointPath`에 해당하는 트리거를 찾아 워크플로우 실행을 비동기로 시작합니다. 본 엔드포인트는 인증이 필요 없으며, 트리거 자체의 시크릿·서명 검증 정책에 따라 보호됩니다. 공개(인증 없음) 트리거에 한해 IP 단위 시작 rate-limit·body 크기 제한이 적용됩니다(spec 7-channel-web-chat/4-security §4).',
  })
  @ApiTooManyRequestsResponse({
    description: '공개 webhook IP 시작 한도 초과(분당/시간당)',
    schema: {
      example: {
        error: {
          code: 'PUBLIC_WEBHOOK_RATE_LIMIT',
          message:
            'Too many conversation starts from this client. Try again later.',
        },
      },
    },
  })
  @ApiPayloadTooLargeResponse({
    description: '공개 webhook body 크기 초과(32KB)',
    schema: {
      example: {
        error: {
          code: 'PUBLIC_WEBHOOK_BODY_TOO_LARGE',
          message: 'Webhook body exceeds 32768 bytes',
        },
      },
    },
  })
  @ApiParam({
    name: 'endpointPath',
    description: '트리거 등록 시 발급된 고유 엔드포인트 경로',
    example: 'abcd1234',
  })
  @ApiAcceptedWrappedResponse(WebhookAcceptedDto, {
    description:
      '웹훅 접수 및 워크플로우 실행 시작. 전역 TransformInterceptor 에 의해 `{ data: ... }` 로 래핑되어 반환됩니다.',
  })
  @ApiUnauthorizedResponse({
    description: '웹훅 서명/시크릿 검증 실패',
  })
  @ApiNotFoundResponse({
    description: '등록된 트리거(endpointPath)를 찾을 수 없음',
  })
  async receiveWebhook(
    @Param('endpointPath') endpointPath: string,
    @Body() body: unknown,
    @Query() query: Record<string, string>,
    @Req()
    req: { headers: Record<string, unknown>; method: string; rawBody?: Buffer },
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      }
    }

    const result = await this.hooksService.handleWebhook(
      endpointPath,
      {
        body,
        headers,
        query,
        method: req.method,
      },
      req.rawBody,
    );

    // Slack url_verification handshake — root-level `{ challenge }` JSON + 200 OK 응답이 필수.
    // TransformInterceptor 의 `{ data: ... }` 래핑을 우회하기 위해 res.json 으로 직접 전송.
    // Spec [providers/slack §3.1 / 5-system/15-chat-channel.md §5.5].
    const challenge = (result as unknown as { challenge?: string }).challenge;
    if (typeof challenge === 'string' && challenge.length > 0) {
      res.status(HttpStatus.OK).json({ challenge });
      return;
    }

    // Discord PING handshake — `{ type: 1 }` JSON + 200 OK. 동일 우회 패턴.
    // Spec [providers/discord §3.1].
    const discordPing = (result as unknown as { discordPing?: boolean })
      .discordPing;
    if (discordPing === true) {
      res.status(HttpStatus.OK).json({ type: 1 });
      return;
    }

    // §4.1 native modal — provider 가 webhook 응답 body 로 직접 돌려줘야 하는 JSON
    // (Discord modal `{ type: 9 }` open / `{ type: 4 }` ack / Slack `{ response_action }`).
    // TransformInterceptor 래핑 우회 — res.json 으로 직접 전송. Spec [chat-channel-adapter §4.1].
    const interactionHttpResponse = (
      result as unknown as { interactionHttpResponse?: unknown }
    ).interactionHttpResponse;
    if (interactionHttpResponse !== undefined) {
      res.status(HttpStatus.OK).json(interactionHttpResponse);
      return;
    }

    return {
      ...result,
      message: 'Webhook received, workflow execution started',
    };
  }
}
