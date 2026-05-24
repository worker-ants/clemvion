import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiAcceptedWrappedResponse } from '../../common/swagger';
import { Public } from '../../common/decorators';
import { HooksService } from './hooks.service';
import { WebhookAcceptedDto } from './dto/responses/webhook-response.dto';

@ApiTags('Hooks')
@Controller('hooks')
export class HooksController {
  constructor(private readonly hooksService: HooksService) {}

  @Public()
  @Post(':endpointPath')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '웹훅 수신',
    description:
      '외부 서비스가 호출하는 웹훅 엔드포인트입니다. 등록된 `endpointPath`에 해당하는 트리거를 찾아 워크플로우 실행을 비동기로 시작합니다. 본 엔드포인트는 인증이 필요 없으며, 트리거 자체의 시크릿·서명 검증 정책에 따라 보호됩니다.',
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

    return {
      ...result,
      message: 'Webhook received, workflow execution started',
    };
  }
}
