import {
  chatChannelSecretRef,
  pinChatChannelSecretRefs,
} from './chat-channel-secret-refs';
import type { ChatChannelConfig } from './types';

// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
// NERV Task `CLE-T-XYR067`. 저장된 `config.chatChannel` 의 참조가 다른 트리거를 가리켜도 그 비밀을 쓰지 않는다.

const OWN = 'trig-1';
const OTHER = 'trig-10';

function makeLogger() {
  return { error: jest.fn() };
}

describe('chatChannelSecretRef', () => {
  it('트리거 id 로 두 참조를 만든다', () => {
    expect(chatChannelSecretRef(OWN, 'botTokenRef')).toBe(
      'secret://triggers/trig-1/bot-token',
    );
    expect(chatChannelSecretRef(OWN, 'inboundSigningRef')).toBe(
      'secret://triggers/trig-1/inbound-signing',
    );
  });
});

describe('pinChatChannelSecretRefs', () => {
  it('자기 트리거의 참조는 그대로 두고 로그를 남기지 않는다', () => {
    const logger = makeLogger();
    const config: ChatChannelConfig = {
      provider: 'slack',
      botTokenRef: chatChannelSecretRef(OWN, 'botTokenRef'),
      inboundSigningRef: chatChannelSecretRef(OWN, 'inboundSigningRef'),
    };

    const pinned = pinChatChannelSecretRefs(OWN, config, logger, 'test');

    expect(pinned).toEqual(config);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ['botTokenRef', 'bot-token'],
    ['inboundSigningRef', 'inbound-signing'],
  ] as const)(
    '%s 가 다른 트리거를 가리키면 자기 트리거의 참조로 바꾸고 오류 로그를 남긴다',
    (field, name) => {
      const logger = makeLogger();
      // 접두가 겹치는 이웃 id(`trig-1` · `trig-10`)도 다른 트리거다.
      const config: ChatChannelConfig = {
        provider: 'telegram',
        [field]: `secret://triggers/${OTHER}/${name}`,
      };

      const pinned = pinChatChannelSecretRefs(OWN, config, logger, 'test');

      expect(pinned[field]).toBe(`secret://triggers/${OWN}/${name}`);
      expect(logger.error).toHaveBeenCalledTimes(1);
      const message = logger.error.mock.calls[0][0] as string;
      expect(message).toContain(OWN);
      expect(message).toContain(`chatChannel.${field}`);
    },
  );

  it('같은 트리거라도 이름이 다른 참조는 정해진 참조로 바꾼다', () => {
    const logger = makeLogger();
    const config: ChatChannelConfig = {
      provider: 'telegram',
      botTokenRef: `secret://triggers/${OWN}/inbound-signing`,
    };

    const pinned = pinChatChannelSecretRefs(OWN, config, logger, 'test');

    expect(pinned.botTokenRef).toBe(chatChannelSecretRef(OWN, 'botTokenRef'));
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  // 참조가 없다는 것은 "그 비밀이 저장돼 있지 않다" 는 신호다. 인바운드 인증기는 참조가 없으면 검증을
  // 건너뛰므로 여기서 참조를 붙이면 동작이 바뀐다(chat-channel-binder.service.ts 의 [ref 보존] 주석).
  it('참조가 없으면 붙이지 않는다', () => {
    const logger = makeLogger();
    const config: ChatChannelConfig = { provider: 'discord' };

    const pinned = pinChatChannelSecretRefs(OWN, config, logger, 'test');

    expect(pinned).not.toHaveProperty('botTokenRef');
    expect(pinned).not.toHaveProperty('inboundSigningRef');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('다른 필드는 그대로 두고 입력 객체를 바꾸지 않는다', () => {
    const logger = makeLogger();
    const foreign = `secret://triggers/${OTHER}/bot-token`;
    const config: ChatChannelConfig = {
      provider: 'telegram',
      botTokenRef: foreign,
      botIdentity: { botId: 7, username: 'bot' },
    };

    const pinned = pinChatChannelSecretRefs(OWN, config, logger, 'test');

    expect(pinned.botIdentity).toEqual({ botId: 7, username: 'bot' });
    expect(pinned.provider).toBe('telegram');
    expect(config.botTokenRef).toBe(foreign);
  });
});
