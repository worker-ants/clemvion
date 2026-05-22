import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ChatChannelController } from './chat-channel.controller';
import { TriggersService } from '../triggers/triggers.service';

/**
 * ChatChannelController.rotateBotToken 단위 테스트.
 *
 * 본 컨트롤러는 input validation + workspaceId 헤더만 책임. 6단계 오케스트레이션은
 * TriggersService.rotateBotToken 으로 위임되어 별도 spec 에서 검증.
 */
describe('ChatChannelController.rotateBotToken', () => {
  let controller: ChatChannelController;
  let triggersService: jest.Mocked<Pick<TriggersService, 'rotateBotToken'>>;

  const WORKSPACE_ID = 'ws-1';
  const TRIGGER_ID = 'trig-1';
  const NEW_BOT_TOKEN = '222222222:NewToken';
  const ROTATED_AT_ISO = new Date('2026-05-22T00:00:00.000Z').toISOString();

  beforeEach(() => {
    triggersService = {
      rotateBotToken: jest
        .fn()
        .mockResolvedValue({ rotatedAt: ROTATED_AT_ISO }),
    } as jest.Mocked<Pick<TriggersService, 'rotateBotToken'>>;
    controller = new ChatChannelController(
      triggersService as unknown as TriggersService,
    );
  });

  it('정상 — TriggersService.rotateBotToken 위임 + rotatedAt 반환', async () => {
    const result = await controller.rotateBotToken(
      TRIGGER_ID,
      { newBotToken: NEW_BOT_TOKEN },
      WORKSPACE_ID,
    );
    expect(triggersService.rotateBotToken).toHaveBeenCalledWith(
      TRIGGER_ID,
      WORKSPACE_ID,
      NEW_BOT_TOKEN,
    );
    expect(result).toEqual({ rotatedAt: ROTATED_AT_ISO });
  });

  it('실패 — newBotToken 미전달 시 BadRequestException', async () => {
    await expect(
      controller.rotateBotToken(TRIGGER_ID, {}, WORKSPACE_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(triggersService.rotateBotToken).not.toHaveBeenCalled();
  });

  it('실패 — newBotToken 이 비문자열', async () => {
    await expect(
      controller.rotateBotToken(
        TRIGGER_ID,
        { newBotToken: 123 as unknown as string },
        WORKSPACE_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(triggersService.rotateBotToken).not.toHaveBeenCalled();
  });

  it('실패 — X-Workspace-Id 미전달 시 UnauthorizedException', async () => {
    await expect(
      controller.rotateBotToken(TRIGGER_ID, { newBotToken: NEW_BOT_TOKEN }, ''),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(triggersService.rotateBotToken).not.toHaveBeenCalled();
  });

  it('TriggersService 가 throw 하면 그대로 전파', async () => {
    triggersService.rotateBotToken.mockRejectedValueOnce(
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
});
