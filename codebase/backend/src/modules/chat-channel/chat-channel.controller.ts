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
import { SecretResolverService } from '../secret-store/secret-resolver.service';

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
    private readonly secrets: SecretResolverService,
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
    const chatChannelCfg = (
      trigger.config as { chatChannel?: ChatChannelConfig }
    ).chatChannel;
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

    const botTokenRef =
      chatChannelCfg.botTokenRef ??
      `secret://triggers/${trigger.id}/bot-token`;
    const v2Ref = `${botTokenRef}.v2`;
    const secretTokenRef =
      chatChannelCfg.secretTokenRef ??
      `secret://triggers/${trigger.id}/webhook-secret`;

    // 1. 기존 botToken resolve (실패 시 skip — 최초 rotation).
    let oldPlaintext: string | null = null;
    try {
      oldPlaintext = await this.secrets.resolve(botTokenRef);
    } catch {
      // 최초 rotation: secret store 에 아직 row 없음. v2 백업 skip.
    }

    // 2. 기존 token 이 있으면 v2Ref 에 백업.
    let v2RefUsed: string | null = null;
    if (oldPlaintext !== null) {
      await this.secrets.rotate(v2Ref, trigger.workspaceId, oldPlaintext);
      v2RefUsed = v2Ref;
    }

    // 3. primary botTokenRef 에 새 token 저장 (UPSERT).
    await this.secrets.rotate(botTokenRef, trigger.workspaceId, body.newBotToken!);

    // 4. 새 token 으로 setupChannel 재호출.
    const mergedConfig: ChatChannelConfig = { ...chatChannelCfg, botTokenRef };
    const callbackUrl = `/api/hooks/${trigger.endpointPath.replace(/^\//, '')}`;
    const result = await adapter.setupChannel(mergedConfig, callbackUrl);
    const mergedChannel: ChatChannelConfig = {
      ...mergedConfig,
      ...(result.configUpdates ?? {}),
      botTokenRef,
      secretTokenRef,
    };

    // 5. issuedSecretToken → secret store 저장 (setupChannel 이 webhook secret 발급 시).
    if (result.issuedSecretToken) {
      await this.secrets.rotate(
        secretTokenRef,
        trigger.workspaceId,
        result.issuedSecretToken,
      );
    }

    // 6. trigger 갱신.
    const rotatedAt = new Date();
    await this.triggerRepository.update(
      { id: trigger.id },
      {
        config: { ...(trigger.config ?? {}), chatChannel: mergedChannel },
        chatChannelTokenV2: v2RefUsed,
        chatChannelRotatedAt: rotatedAt,
        chatChannelHealth: 'healthy',
        chatChannelLastError: null,
      },
    );
    return { rotatedAt: rotatedAt.toISOString() };
  }
}
