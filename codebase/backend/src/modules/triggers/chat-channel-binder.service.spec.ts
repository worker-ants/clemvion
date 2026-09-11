/**
 * `ChatChannelBinderService.teardownChatChannel` 직접 단위 테스트.
 *
 * ## 왜 teardown 만인가 — 갭이 거기였다
 *
 * `/ai-review` `review/code/2026/09/11/18_04_36` W2 가 실측으로 짚었다: `has() === true` 일 때
 * **실제로 `adapter.teardownChannel()` 을 부르는 분기와 그 실패를 삼키는 best-effort catch 가
 * 백엔드 전체 스위트에서 한 번도 실행되지 않는다.** `remove()` 를 도는 describe 가 전부
 * registry 를 `has: () => false` 로 고정해 두었기 때문이다. 즉 그 두 줄이 사라져도 GREEN 이었다.
 *
 * **`setupChatChannel` 은 여기서 다시 덮지 않는다.** 그쪽은 `triggers.service.spec.ts` 가
 * 공개 진입점(`create`/`update`)으로 이미 두껍게 행사하고 있고, 옮기면서 뮤테이션 3종
 * (`storeUserSuppliedSecrets` 게이팅 · `inboundSigningRefSurvives` 술어 · 실패 경로
 * `fallbackConfig`)이 전부 RED 임을 실측했다. 같은 것을 두 곳에서 단언하면 다음 사람이
 * **어느 쪽이 정본인지** 모르게 된다.
 *
 * 의존은 `new` 로 직접 주입한다 — 같은 폴더 `chat-channel-token-rotator.service.spec.ts` 의 관례다.
 */
import { Logger } from '@nestjs/common';
import { ChatChannelBinderService } from './chat-channel-binder.service';
import type { Trigger } from './entities/trigger.entity';
import type { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import type { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import type { SecretResolverService } from '../secret-store/secret-resolver.service';

type AdapterMock = { teardownChannel: jest.Mock; setupChannel: jest.Mock };

function makeBinder(adapter: AdapterMock, has: boolean) {
  const registry = {
    has: jest.fn(() => has),
    get: jest.fn(() => adapter),
  };
  const svc = new ChatChannelBinderService(
    { update: jest.fn() } as never,
    registry as unknown as ChannelAdapterRegistry,
    {
      register: jest.fn(),
      unregister: jest.fn(),
    } as unknown as ChannelListenerRegistry,
    { rotate: jest.fn() } as unknown as SecretResolverService,
    { get: jest.fn(() => 'https://example.com') } as never,
  );
  return { svc, registry };
}

function makeAdapter(): AdapterMock {
  return { teardownChannel: jest.fn(), setupChannel: jest.fn() };
}

const TELEGRAM_CFG = { provider: 'telegram', botTokenRef: 'secret://x' };

function makeTrigger(config: unknown): Trigger {
  return { id: 'trig-1', workspaceId: 'ws-1', config } as unknown as Trigger;
}

describe('ChatChannelBinderService.teardownChatChannel', () => {
  it('config 에 chatChannel 이 없으면 registry 를 조회조차 하지 않는다', async () => {
    const adapter = makeAdapter();
    const { svc, registry } = makeBinder(adapter, true);

    await svc.teardownChatChannel(makeTrigger({}));

    expect(registry.has).not.toHaveBeenCalled();
    expect(adapter.teardownChannel).not.toHaveBeenCalled();
  });

  it('provider 가 미등록이면 adapter 를 가져오지 않는다', async () => {
    const adapter = makeAdapter();
    const { svc, registry } = makeBinder(adapter, false);

    await svc.teardownChatChannel(makeTrigger({ chatChannel: TELEGRAM_CFG }));

    expect(registry.has).toHaveBeenCalledWith('telegram');
    expect(registry.get).not.toHaveBeenCalled();
    expect(adapter.teardownChannel).not.toHaveBeenCalled();
  });

  /**
   * **이 경로가 지금까지 한 번도 안 돌았다** (W2). `toHaveBeenCalledWith` 로 **넘기는 값**까지
   * 본다 — 호출 여부만 보면 엉뚱한 객체를 넘겨도 통과한다.
   */
  it('provider 가 등록돼 있으면 그 config 로 adapter.teardownChannel 을 부른다', async () => {
    const adapter = makeAdapter();
    const { svc, registry } = makeBinder(adapter, true);

    await svc.teardownChatChannel(makeTrigger({ chatChannel: TELEGRAM_CFG }));

    expect(registry.get).toHaveBeenCalledWith('telegram');
    expect(adapter.teardownChannel).toHaveBeenCalledTimes(1);
    expect(adapter.teardownChannel).toHaveBeenCalledWith(TELEGRAM_CFG);
  });

  /**
   * best-effort (CCH-AD-03) — 삭제 흐름이 adapter 장애로 멈추면 안 된다.
   *
   * **`resolves` 만 단언하면 부족하다**: catch 가 아무것도 안 하고 삼켜도 통과한다. 진단이
   * 남는지까지 봐야 *"조용히 사라지지 않는다"* 를 고정할 수 있어 warn 내용도 단언한다.
   */
  it('adapter 가 던져도 삼키고 trigger id 와 사유를 warn 으로 남긴다', async () => {
    const adapter = makeAdapter();
    adapter.teardownChannel.mockRejectedValue(new Error('telegram down'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { svc } = makeBinder(adapter, true);

    await expect(
      svc.teardownChatChannel(makeTrigger({ chatChannel: TELEGRAM_CFG })),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('trig-1');
    expect(message).toContain('telegram down');
    warn.mockRestore();
  });
});
