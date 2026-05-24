/**
 * ChatChannelTokenRotatorService 단위 테스트 — @Cron 트리거 호출만 검증.
 * 실 비즈니스 로직은 TriggersService.cleanupRotatedChatChannelTokens (별 spec) 가 담당.
 */
import { ChatChannelTokenRotatorService } from './chat-channel-token-rotator.service';
import type { TriggersService } from '../triggers/triggers.service';

function makeTriggersServiceMock(): jest.Mocked<TriggersService> {
  return {
    cleanupRotatedChatChannelTokens: jest.fn(),
  } as unknown as jest.Mocked<TriggersService>;
}

describe('ChatChannelTokenRotatorService', () => {
  it('cleanupRotatedChatChannelTokens 호출 — cleaned > 0 시 log', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockResolvedValue({ cleaned: 3 });
    const svc = new ChatChannelTokenRotatorService(triggers);
    await svc.handleHourly();
    expect(triggers.cleanupRotatedChatChannelTokens).toHaveBeenCalledTimes(1);
  });

  it('cleaned = 0 시 silent', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockResolvedValue({ cleaned: 0 });
    const svc = new ChatChannelTokenRotatorService(triggers);
    await expect(svc.handleHourly()).resolves.toBeUndefined();
  });

  it('throw 시 swallow + 다음 시간 재시도 (재 throw 안 함)', async () => {
    const triggers = makeTriggersServiceMock();
    triggers.cleanupRotatedChatChannelTokens.mockRejectedValue(
      new Error('db down'),
    );
    const svc = new ChatChannelTokenRotatorService(triggers);
    await expect(svc.handleHourly()).resolves.toBeUndefined();
  });
});
