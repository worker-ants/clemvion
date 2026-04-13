import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { HooksService } from './hooks.service';

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
  @ApiAcceptedResponse({
    description: '웹훅 접수 및 워크플로우 실행 시작',
    schema: {
      type: 'object',
      properties: {
        executionId: {
          type: 'string',
          format: 'uuid',
          description: '시작된 실행의 ID',
        },
        message: {
          type: 'string',
          example: 'Webhook received, workflow execution started',
        },
      },
    },
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

    return {
      ...result,
      message: 'Webhook received, workflow execution started',
    };
  }
}
