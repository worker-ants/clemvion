import { BadRequestException } from '@nestjs/common';
import { TriggersController } from './triggers.controller';
import { TriggersService } from './triggers.service';

/**
 * `TriggersController.rotateBotToken` 단위 테스트.
 *
 * (C-2: ChatChannelController 에서 본 컨트롤러로 이전 — chat-channel↔triggers
 * forwardRef 순환 해소. route `POST /api/triggers/:id/chat-channel/rotate-bot-token`
 * 와 핸들러 로직은 무변.)
 *
 * 본 메서드는 input validation 만 책임. workspaceId 부재 검증은 공용 `@WorkspaceId()`
 * 데코레이터(부재 시 `WORKSPACE_ID_REQUIRED` 400)가 담당하며 `common/decorators/
 * workspace.decorator.spec.ts` 에서 검증. 6단계 오케스트레이션은 TriggersService.
 * rotateBotToken 으로 위임되어 별도 spec 에서 검증.
 */
describe('TriggersController.rotateBotToken', () => {
  let controller: TriggersController;
  let triggersService: jest.Mocked<Pick<TriggersService, 'rotateBotToken'>>;

  const WORKSPACE_ID = 'ws-1';
  const TRIGGER_ID = 'trig-1';
  const NEW_BOT_TOKEN = '222222222:NewToken';
  const ROTATED_AT_ISO = new Date('2026-05-22T00:00:00.000Z').toISOString();
  // [Spec §5.4] 성공 응답 = rotatedAt + 3 추가 필드 (triggerId / chatChannelHealth / botIdentity).
  const ROTATE_RESULT = {
    rotatedAt: ROTATED_AT_ISO,
    triggerId: TRIGGER_ID,
    chatChannelHealth: 'healthy' as const,
    botIdentity: { botId: 111, username: 'bot' },
  };

  beforeEach(() => {
    triggersService = {
      rotateBotToken: jest.fn().mockResolvedValue(ROTATE_RESULT),
    } as jest.Mocked<Pick<TriggersService, 'rotateBotToken'>>;
    controller = new TriggersController(
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
    expect(result).toEqual(ROTATE_RESULT);
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

/**
 * 컨트롤러 → 서비스 **행위자(userId) 배선** 검증.
 *
 * `create(workspaceId, dto, userId)` 는 1·3번째 인자가 **둘 다 string** 이라 스왑해도
 * 컴파일이 통과한다(실측: 스왑 후 `tsc --noEmit` 오류 0건). 스왑되면 감사 로그의 workspace 와
 * actor 가 뒤바뀐 채로도 행이 정상적으로 쌓여 **조용히 틀린 감사**가 된다. 서비스 spec 은 이미
 * 들어온 값을 볼 뿐이라 경계에서 단언해야 잡힌다.
 */
describe('TriggersController — 행위자(userId) 배선', () => {
  let controller: TriggersController;
  let service: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };

  const WS = 'ws-1';
  const USER = 'user-1';

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'trig-1' }),
      update: jest.fn().mockResolvedValue({ id: 'trig-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    controller = new TriggersController(service as unknown as TriggersService);
  });

  it('create 는 workspaceId 와 userId 를 각자 자리에 전달한다', async () => {
    const dto = { workflowId: 'wf-1', type: 'webhook', name: 'T' } as never;

    await controller.create(WS, dto, USER);

    // 위치까지 고정한다 — objectContaining 으로는 스왑을 못 잡는다.
    expect(service.create).toHaveBeenCalledWith(WS, dto, USER);
  });

  it('update 는 id·workspaceId·dto·userId 순서를 지킨다', async () => {
    const dto = { name: 'T2' } as never;

    await controller.update('trig-1', WS, dto, USER);

    expect(service.update).toHaveBeenCalledWith('trig-1', WS, dto, USER);
  });

  it('remove 는 id·workspaceId·userId 순서를 지킨다', async () => {
    await controller.remove('trig-2', WS, USER);

    expect(service.remove).toHaveBeenCalledWith('trig-2', WS, USER);
  });
});
