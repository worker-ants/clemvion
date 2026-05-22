import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ChatChannelController } from './chat-channel.controller';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { Trigger } from '../triggers/entities/trigger.entity';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { ChatChannelAdapter, ChatChannelConfig, SetupResult } from './types';

/**
 * ChatChannelController.rotateBotToken 단위 테스트 (SUMMARY#2).
 *
 * 6단계 검증:
 *   (a) old token resolve → v2 ref 백업 → primary ref 교체 → setupChannel → issuedSecretToken 저장 → config 갱신.
 */
describe('ChatChannelController.rotateBotToken', () => {
  let controller: ChatChannelController;
  let triggerRepo: jest.Mocked<Pick<Repository<Trigger>, 'findOne' | 'update'>>;
  let secrets: jest.Mocked<SecretResolverService>;
  let adapterRegistry: jest.Mocked<ChannelAdapterRegistry>;
  let mockAdapter: jest.Mocked<Pick<ChatChannelAdapter, 'setupChannel'>>;

  const WORKSPACE_ID = 'ws-1';
  const TRIGGER_ID = 'trig-1';
  const BOT_TOKEN_REF = 'secret://triggers/trig-1/bot-token';
  const SECRET_TOKEN_REF = 'secret://triggers/trig-1/webhook-secret';
  const OLD_BOT_TOKEN = '111111111:OldToken';
  const NEW_BOT_TOKEN = '222222222:NewToken';
  const ISSUED_SECRET = 'newWebhookSecret';

  const baseChatChannelConfig: ChatChannelConfig = {
    provider: 'telegram',
    botTokenRef: BOT_TOKEN_REF,
    secretTokenRef: SECRET_TOKEN_REF,
  };

  const baseTrigger = {
    id: TRIGGER_ID,
    workspaceId: WORKSPACE_ID,
    endpointPath: 'hook-abc',
    config: { chatChannel: baseChatChannelConfig },
    chatChannelHealth: 'healthy',
    chatChannelLastError: null,
    chatChannelSetupAt: new Date(),
    chatChannelTokenV2: null,
    chatChannelRotatedAt: null,
  } as unknown as Trigger;

  beforeEach(() => {
    triggerRepo = {
      findOne: jest.fn().mockResolvedValue(baseTrigger),
      update: jest.fn().mockResolvedValue(undefined),
    };
    secrets = {
      resolve: jest.fn().mockResolvedValue(OLD_BOT_TOKEN),
      store: jest.fn().mockResolvedValue(undefined),
      rotate: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteByPrefix: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<SecretResolverService>;

    mockAdapter = {
      setupChannel: jest.fn().mockResolvedValue({
        configUpdates: {},
        issuedSecretToken: ISSUED_SECRET,
      } as SetupResult),
    };

    adapterRegistry = {
      has: jest.fn().mockReturnValue(true),
      get: jest
        .fn()
        .mockReturnValue(mockAdapter as unknown as ChatChannelAdapter),
    } as unknown as jest.Mocked<ChannelAdapterRegistry>;

    controller = new ChatChannelController(
      adapterRegistry,
      triggerRepo as unknown as Repository<Trigger>,
      secrets,
    );
  });

  it('정상 rotation — 6단계 전체 수행, rotatedAt 반환 (SUMMARY#2-a)', async () => {
    const result = await controller.rotateBotToken(
      TRIGGER_ID,
      { newBotToken: NEW_BOT_TOKEN },
      WORKSPACE_ID,
    );

    // old token resolve
    expect(secrets.resolve).toHaveBeenCalledWith(BOT_TOKEN_REF);
    // v2 ref 에 old token 백업
    expect(secrets.rotate).toHaveBeenCalledWith(
      expect.stringContaining('bot-token.v2'),
      WORKSPACE_ID,
      OLD_BOT_TOKEN,
    );
    // primary ref 를 new token 으로 교체
    expect(secrets.rotate).toHaveBeenCalledWith(
      BOT_TOKEN_REF,
      WORKSPACE_ID,
      NEW_BOT_TOKEN,
    );
    // setupChannel 재호출
    expect(mockAdapter.setupChannel).toHaveBeenCalledWith(
      baseChatChannelConfig,
      expect.stringContaining('hook-abc'),
    );
    // issuedSecretToken → secret store
    expect(secrets.rotate).toHaveBeenCalledWith(
      SECRET_TOKEN_REF,
      WORKSPACE_ID,
      ISSUED_SECRET,
    );
    // trigger 갱신 — chatChannelHealth=healthy, chatChannelTokenV2 에 v2Ref
    expect(triggerRepo.update).toHaveBeenCalledWith(
      { id: TRIGGER_ID },
      expect.objectContaining({
        chatChannelHealth: 'healthy',
        chatChannelTokenV2: expect.stringContaining('bot-token.v2'),
      }),
    );
    // rotatedAt 반환
    expect(result).toHaveProperty('rotatedAt');
    expect(typeof result.rotatedAt).toBe('string');
  });

  it('첫 rotation (old token resolve 실패) — v2 ref 백업 skip + chatChannelTokenV2=null (SUMMARY#2-b)', async () => {
    secrets.resolve.mockRejectedValueOnce(new Error('secret not found'));

    await controller.rotateBotToken(
      TRIGGER_ID,
      { newBotToken: NEW_BOT_TOKEN },
      WORKSPACE_ID,
    );

    // v2 ref rotate 는 호출되지 않아야 함 (old token 없음)
    expect(secrets.rotate).not.toHaveBeenCalledWith(
      expect.stringContaining('bot-token.v2'),
      expect.anything(),
      expect.anything(),
    );
    // chatChannelTokenV2=null
    expect(triggerRepo.update).toHaveBeenCalledWith(
      { id: TRIGGER_ID },
      expect.objectContaining({ chatChannelTokenV2: null }),
    );
  });

  it('issuedSecretToken 없을 때 새 secretTokenRef rotate 미호출 (SUMMARY#2-c)', async () => {
    mockAdapter.setupChannel.mockResolvedValueOnce({
      configUpdates: {},
      // issuedSecretToken 없음
    });

    await controller.rotateBotToken(
      TRIGGER_ID,
      { newBotToken: NEW_BOT_TOKEN },
      WORKSPACE_ID,
    );

    // secrets.rotate 는 v2 ref + primary ref 두 번만 호출 (webhookSecret 없음)
    const rotateCalls = (secrets.rotate as jest.Mock).mock.calls;
    const webhookSecretCalls = rotateCalls.filter(([ref]) =>
      (ref as string).includes('webhook-secret'),
    );
    expect(webhookSecretCalls).toHaveLength(0);
  });

  it('setupChannel 예외 시 에러 전파 (SUMMARY#2-d)', async () => {
    mockAdapter.setupChannel.mockRejectedValueOnce(
      new Error('Telegram API error'),
    );

    await expect(
      controller.rotateBotToken(
        TRIGGER_ID,
        { newBotToken: NEW_BOT_TOKEN },
        WORKSPACE_ID,
      ),
    ).rejects.toThrow('Telegram API error');
  });

  it('newBotToken 미전달 시 BadRequestException (SUMMARY#2-e)', async () => {
    await expect(
      controller.rotateBotToken(TRIGGER_ID, {}, WORKSPACE_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('X-Workspace-Id 미전달 시 UnauthorizedException (SUMMARY#2-f)', async () => {
    await expect(
      controller.rotateBotToken(TRIGGER_ID, { newBotToken: NEW_BOT_TOKEN }, ''),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('trigger 미존재 시 NotFoundException (SUMMARY#2-g)', async () => {
    triggerRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      controller.rotateBotToken(
        TRIGGER_ID,
        { newBotToken: NEW_BOT_TOKEN },
        WORKSPACE_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
