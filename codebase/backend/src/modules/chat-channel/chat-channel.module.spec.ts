/**
 * ChatChannelModule 단위 테스트. 모듈에는 provider 어댑터 등록만 남았고 listener 레지스트리
 * 복원은 `ChannelListenerRestorer` 가 맡는다(NERV Task `CLE-T-NCKHVQ`). 복원 자체는
 * `channel-listener.restorer.spec.ts` 가 본다.
 */
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ChatChannelModule } from './chat-channel.module';
import { ChannelListenerRestorer } from './channel-listener.restorer';
import type { ChannelAdapterRegistry } from './channel-adapter.registry';
import type { TelegramAdapter } from './providers/telegram/telegram.adapter';
import type { SlackAdapter } from './providers/slack/slack.adapter';
import type { DiscordAdapter } from './providers/discord/discord.adapter';

describe('ChatChannelModule', () => {
  it('생성자가 세 provider 어댑터를 어댑터 레지스트리에 등록한다', () => {
    const register = jest.fn();
    const telegram = { provider: 'telegram' } as unknown as TelegramAdapter;
    const slack = { provider: 'slack' } as unknown as SlackAdapter;
    const discord = { provider: 'discord' } as unknown as DiscordAdapter;

    new ChatChannelModule(
      { register } as unknown as ChannelAdapterRegistry,
      telegram,
      slack,
      discord,
    );

    expect(register.mock.calls).toEqual([[telegram], [slack], [discord]]);
  });

  // 복원 서비스는 다른 모듈이 주입하지 않는다. provider 목록에서 빠지면 인스턴스가 만들어지지 않아
  // 부팅 · 재구독 복원이 오류 없이 사라진다.
  it('복원 서비스를 provider 로 둔다', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ChatChannelModule,
    ) as unknown[];

    expect(providers).toContain(ChannelListenerRestorer);
  });
});
