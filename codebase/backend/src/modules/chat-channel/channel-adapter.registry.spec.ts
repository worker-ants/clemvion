import { NotFoundException } from '@nestjs/common';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import type {
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  EiaEvent,
  SendResult,
  SetupResult,
} from './types';

class FakeAdapter implements ChatChannelAdapter {
  readonly provider: string;
  constructor(provider: string) {
    this.provider = provider;
  }
  setupChannel(_config: ChatChannelConfig, _url: string): Promise<SetupResult> {
    return Promise.resolve({ registeredAt: new Date().toISOString() });
  }
  teardownChannel(): Promise<void> {
    return Promise.resolve();
  }
  parseUpdate(): Promise<ChannelUpdate | null> {
    return Promise.resolve(null);
  }
  renderNode(
    _event: EiaEvent,
    _config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    return Promise.resolve([]);
  }
  sendMessage(): Promise<SendResult> {
    return Promise.resolve({ externalMsgId: 'x', sentAt: '' });
  }
  ackInteraction(): Promise<void> {
    return Promise.resolve();
  }
}

describe('ChannelAdapterRegistry', () => {
  let registry: ChannelAdapterRegistry;

  beforeEach(() => {
    registry = new ChannelAdapterRegistry();
  });

  it('register / get round-trip', () => {
    const adapter = new FakeAdapter('telegram');
    registry.register(adapter);
    expect(registry.get('telegram')).toBe(adapter);
    expect(registry.has('telegram')).toBe(true);
  });

  it('has() 는 미등록 provider 에 false', () => {
    expect(registry.has('slack')).toBe(false);
  });

  it('get() 미등록 provider → NotFoundException', () => {
    expect(() => registry.get('slack')).toThrow(NotFoundException);
  });

  it('중복 register 는 마지막 인스턴스로 overwrite', () => {
    const first = new FakeAdapter('telegram');
    const second = new FakeAdapter('telegram');
    registry.register(first);
    registry.register(second);
    expect(registry.get('telegram')).toBe(second);
  });

  it('list() 는 등록된 provider 목록 반환', () => {
    registry.register(new FakeAdapter('telegram'));
    registry.register(new FakeAdapter('slack'));
    expect(registry.list().sort()).toEqual(['slack', 'telegram']);
  });
});
