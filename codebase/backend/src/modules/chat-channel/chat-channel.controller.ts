import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { Trigger } from '../triggers/entities/trigger.entity';
import { ChatChannelConfig } from './types';

/**
 * Chat Channel 어댑터의 관리 endpoint.
 *
 * Spec [CCH-SE-04 / providers/telegram §6] — Bot token rotation.
 *
 * `POST /api/triggers/:id/chat-channel/rotate-bot-token`
 *   - body: { newBotToken: string }
 *   - 동작: 새 token 으로 setupChannel (setWebhook) 재호출 + 기존 token 은 24h grace 동안 chat_channel_token_v2 컬럼에
 *     보관 (notification_secret_v2 패턴과 동일). cron 으로 grace 만료 시 v2 → primary 승격.
 *
 * 동사 `rotate-bot-token` — EIA `/notification/rotate-secret` (HMAC secret) 와 다른 자원이므로 별도 동사
 * (api-convention §2.2 의 RPC-style sub-channel action 예외 조항 적용).
 */
@ApiTags('Triggers')
@Controller('triggers')
export class ChatChannelController {
  constructor(
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
  ) {}

  @Post(':id/chat-channel/rotate-bot-token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Chat Channel bot token 회전',
    description:
      'Spec CCH-SE-04 — 외부 provider bot token 회전. 기존 token 은 24h grace 동안 chat_channel_token_v2 로 보관.',
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
    const trigger = await this.triggerRepository.findOne({
      where: { id: triggerId, workspaceId },
    });
    if (!trigger) {
      throw new NotFoundException({
        code: 'TRIGGER_NOT_FOUND',
        message: 'Trigger not found',
      });
    }
    const chatChannelCfg = (trigger.config as { chatChannel?: ChatChannelConfig })
      .chatChannel;
    if (!chatChannelCfg) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_NOT_CONFIGURED',
        message: 'Trigger has no chat channel configuration',
      });
    }
    if (!this.channelAdapterRegistry.has(chatChannelCfg.provider)) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_PROVIDER_UNKNOWN',
        message: `Unknown provider: ${chatChannelCfg.provider}`,
      });
    }
    const adapter = this.channelAdapterRegistry.get(chatChannelCfg.provider);
    if (!trigger.endpointPath) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_ENDPOINT_REQUIRED',
        message: 'Trigger endpointPath is required for rotation',
      });
    }

    // 새 token 으로 setupChannel 재호출 — 외부 채널의 webhook URL 은 동일하지만 secret_token 은
    // 새로 발급. 성공 시 기존 token 을 chat_channel_token_v2 로 보관 (24h grace).
    const oldToken = chatChannelCfg.botToken;
    const newConfig: ChatChannelConfig = {
      ...chatChannelCfg,
      botToken: body.newBotToken,
    };
    const callbackUrl = `/api/hooks/${trigger.endpointPath.replace(/^\//, '')}`;
    const result = await adapter.setupChannel(newConfig, callbackUrl);
    const mergedChannel = { ...newConfig, ...(result.configUpdates ?? {}) };
    const rotatedAt = new Date();
    await this.triggerRepository.update(
      { id: trigger.id },
      {
        config: { ...(trigger.config ?? {}), chatChannel: mergedChannel },
        chatChannelTokenV2: oldToken,
        chatChannelRotatedAt: rotatedAt,
        chatChannelHealth: 'healthy',
        chatChannelLastError: null,
      },
    );
    return { rotatedAt: rotatedAt.toISOString() };
  }
}
