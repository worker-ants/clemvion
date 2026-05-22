import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  BadRequestException,
  Inject,
  forwardRef,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TriggersService } from '../triggers/triggers.service';

/**
 * Chat Channel 어댑터의 관리 endpoint.
 *
 * Spec [CCH-SE-04 / providers/telegram §6] — Bot token rotation.
 *
 * `POST /api/triggers/:id/chat-channel/rotate-bot-token`
 *   - body: { newBotToken: string }
 *   - 위임: `TriggersService.rotateBotToken()` 가 secret store + adapter 오케스트레이션 6단계 담당.
 *     본 controller 는 input validation + workspaceId 헤더만 처리.
 *
 * 동사 `rotate-bot-token` — EIA `/notification/rotate-secret` (HMAC secret) 와 다른 자원이므로 별도 동사
 * (api-convention §2.2 의 RPC-style sub-channel action 예외 조항 적용).
 */
@ApiTags('Triggers')
@Controller('triggers')
export class ChatChannelController {
  constructor(
    // TriggersModule ↔ ChatChannelModule 양방향 import 회피용 forwardRef.
    @Inject(forwardRef(() => TriggersService))
    private readonly triggersService: TriggersService,
  ) {}

  @Post(':id/chat-channel/rotate-bot-token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Chat Channel bot token 회전',
    description:
      'Spec CCH-SE-04 — 외부 provider bot token 회전. 기존 token 은 24h grace 동안 chat_channel_token_v2 (secret store v2 ref) 로 보관, CCH-SE-04-C cron 이 grace 만료 시 정리.',
  })
  async rotateBotToken(
    @Param('id') triggerId: string,
    @Body() body: { newBotToken?: string },
    @Headers('x-workspace-id') workspaceId: string,
  ): Promise<{ rotatedAt: string }> {
    if (!body?.newBotToken || typeof body.newBotToken !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_BOT_TOKEN',
        message: 'newBotToken is required',
      });
    }
    if (!workspaceId) {
      throw new UnauthorizedException({
        code: 'WORKSPACE_REQUIRED',
        message: 'X-Workspace-Id header is required',
      });
    }
    return this.triggersService.rotateBotToken(
      triggerId,
      workspaceId,
      body.newBotToken,
    );
  }
}
