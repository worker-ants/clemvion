import { ChatChannelInboundAuthenticator } from './chat-channel-inbound-authenticator';
import type { ChatChannelSignatureFailureLimiterService } from './chat-channel-signature-failure-limiter.service';
import type { SecretResolverService } from '../secret-store/secret-resolver.service';
import {
  chatChannelSecretRef,
  isSignedChatChannelTrigger,
  pinChatChannelSecretRefs,
  readTriggerChatChannelConfig,
  readTriggerChatChannelProvider,
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
  it('빈 문자열 참조는 없는 것으로 보고 그대로 둔다', () => {
    const logger = makeLogger();
    const config: ChatChannelConfig = {
      provider: 'telegram',
      inboundSigningRef: '',
    };

    const pinned = pinChatChannelSecretRefs(OWN, config, logger, 'test');

    expect(pinned.inboundSigningRef).toBe('');
    expect(logger.error).not.toHaveBeenCalled();
  });

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

describe('readTriggerChatChannelProvider', () => {
  it.each([
    ['config 가 null', null],
    ['config 가 문자열', 'oops'],
    ['chatChannel 이 없다', {}],
    ['chatChannel 이 객체가 아니다', { chatChannel: 'telegram' }],
    ['provider 가 없다', { chatChannel: { botTokenRef: 'x' } }],
    ['provider 가 빈 문자열', { chatChannel: { provider: '' } }],
    ['provider 가 문자열이 아니다', { chatChannel: { provider: 7 } }],
  ])('%s 면 null 이다', (_label, config) => {
    expect(readTriggerChatChannelProvider(config)).toBeNull();
  });

  it('provider 문자열을 돌려준다. 시크릿 참조가 어긋나도 그대로 읽는다', () => {
    expect(
      readTriggerChatChannelProvider({
        chatChannel: {
          provider: 'discord',
          botTokenRef: `secret://triggers/${OTHER}/bot-token`,
        },
      }),
    ).toBe('discord');
  });
});

// 근거: NERV 질문 `01a1d322-7833-756b-a20d-2e3e247411f3` 답 A(2026-11-13, CLE-T-ZC34Y0).
// 서명 참조가 있는 채팅 채널 트리거만 전역 요청 한도에서 뺀다. 인바운드 인증기가 서명을 검증하는
// 조건(저장된 `inboundSigningRef` 가 있다)과 같은 판정이어야 한다.
describe('isSignedChatChannelTrigger', () => {
  it.each([
    ['config 가 null', null],
    ['채팅 채널이 아니다', {}],
    [
      'provider 가 없다',
      {
        chatChannel: {
          inboundSigningRef: 'secret://triggers/t/inbound-signing',
        },
      },
    ],
    ['서명 참조가 없다', { chatChannel: { provider: 'telegram' } }],
    [
      '서명 참조가 빈 문자열',
      { chatChannel: { provider: 'slack', inboundSigningRef: '' } },
    ],
  ])('%s 면 false 다', (_label, config) => {
    expect(isSignedChatChannelTrigger(config)).toBe(false);
  });

  it('provider 와 서명 참조가 있으면 true 다. 참조가 다른 트리거를 가리켜도 있음으로 본다', () => {
    // pinChatChannelSecretRefs 는 있는 참조를 이 트리거의 참조로 바꿔 쓸 뿐 지우지 않으므로
    // 인증기는 이 트리거도 검증한다.
    expect(
      isSignedChatChannelTrigger({
        chatChannel: {
          provider: 'discord',
          inboundSigningRef: `secret://triggers/${OTHER}/inbound-signing`,
        },
      }),
    ).toBe(true);
  });
});

describe('readTriggerChatChannelConfig', () => {
  it.each([
    ['config 가 null', null],
    ['config 가 문자열', 'oops'],
    ['chatChannel 이 없다', {}],
    ['chatChannel 이 객체가 아니다', { chatChannel: 'telegram' }],
    ['provider 가 없다', { chatChannel: { botTokenRef: 'x' } }],
    ['provider 가 빈 문자열', { chatChannel: { provider: '' } }],
    ['provider 가 문자열이 아니다', { chatChannel: { provider: 7 } }],
  ])('%s 면 채팅 채널이 아니라고 보고 null 이다', (_label, config) => {
    const logger = makeLogger();

    expect(
      readTriggerChatChannelConfig({ id: OWN, config }, logger, 'test'),
    ).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('채팅 채널이면 트리거 id 로 참조를 맞춘 사본을 돌려준다', () => {
    const logger = makeLogger();
    const stored = {
      provider: 'slack',
      botTokenRef: `secret://triggers/${OTHER}/bot-token`,
    };

    const read = readTriggerChatChannelConfig(
      { id: OWN, config: { chatChannel: stored } },
      logger,
      'test',
    );

    expect(read).toEqual({
      provider: 'slack',
      botTokenRef: chatChannelSecretRef(OWN, 'botTokenRef'),
    });
    expect(stored.botTokenRef).toBe(`secret://triggers/${OTHER}/bot-token`);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

// 근거: CLE-T-ZC34Y0. 전역 한도 면제(`isSignedChatChannelTrigger`)와 인증기의 서명 검증 여부는 같아야 한다.
// 어긋나면 면제됐는데 검증이 없는 트리거가 생겨 IP 단위 한도가 하나도 걸리지 않는다.
describe('isSignedChatChannelTrigger 와 인바운드 인증기의 서명 검증 여부', () => {
  const refs: Array<[string, unknown]> = [
    ['없음', undefined],
    ['null', null],
    ['빈 문자열', ''],
    ['0', 0],
    ['숫자 7', 7],
    ['객체', { x: 1 }],
    ['참조 문자열', 'secret://triggers/t/inbound-signing'],
  ];
  const providers = ['telegram', 'slack', 'discord'] as const;
  const cases = providers.flatMap((provider) =>
    refs.map(([label, ref]) => [provider, label, ref] as const),
  );

  it.each(cases)(
    '%s 서명 참조가 %s 일 때 면제 판정과 시크릿 조회가 같다',
    async (provider, _label, ref) => {
      const resolve = jest.fn(async () => 'v');
      const authenticator = new ChatChannelInboundAuthenticator(
        { resolve } as unknown as SecretResolverService,
        {
          isBlocked: async () => false,
          recordFailure: async () => undefined,
        } as unknown as ChatChannelSignatureFailureLimiterService,
      );
      const stored = {
        chatChannel: {
          provider,
          botTokenRef: chatChannelSecretRef('t', 'botTokenRef'),
          inboundSigningRef: ref,
        },
      };
      const config = readTriggerChatChannelConfig(
        { id: 't', config: stored },
        makeLogger(),
        'test',
      ) as ChatChannelConfig;

      await authenticator.verify('t', config, {}, '').catch(() => undefined);

      expect(resolve.mock.calls.length > 0).toBe(
        isSignedChatChannelTrigger(stored),
      );
    },
  );
});
