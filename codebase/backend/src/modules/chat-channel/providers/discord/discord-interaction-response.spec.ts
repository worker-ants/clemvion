import type { ChatChannelConfig } from '../../types';
import { buildDiscordDefaultInteractionResponse } from './discord-interaction-response';

// 근거: [Discord 어댑터 「인바운드 응답」](CLE-CHAT-DISCORD) · Discord 공식 문서
// (Receiving and Responding) — interaction 은 3초 안에 200 과 콜백 응답을 받아야 클라이언트가 실패
// 표시를 띄우지 않는다. type 6 은 MODAL_SUBMIT 과 컴포넌트 interaction 에만 쓸 수 있어 슬래시 명령은 type 4 다.
// 슬래시 명령의 응답 모양은 2026-11-12 사람 결정(NERV 질문 `01a1d025-899f-7709-b759-4f7bf6c16ef5`):
// 본인에게만 보이는 type 4, help 는 도움말, 나머지는 공통 수신 문구. NERV Task `CLE-T-TSEP9G`.
describe('buildDiscordDefaultInteractionResponse', () => {
  const config: ChatChannelConfig = {
    provider: 'discord',
    botTokenRef: 'secret://triggers/t1/bot-token',
  };
  const slash = (subCommand?: string): Record<string, unknown> => ({
    id: 'I1',
    type: 2,
    token: 'tok',
    data: {
      name: 'workflow',
      ...(subCommand ? { options: [{ name: subCommand, type: 1 }] } : {}),
    },
  });

  it.each([
    ['컴포넌트 클릭(type 3)', 3],
    ['모달 제출(type 5)', 5],
  ])('%s 은 { type: 6 } 이다', (_label, type) => {
    expect(
      buildDiscordDefaultInteractionResponse({ id: 'I1', type }, config),
    ).toEqual({ body: { type: 6 } });
  });

  it.each(['start', 'cancel', 'reply', undefined])(
    '슬래시 명령 %s 는 본인에게만 보이는 type 4 수신 문구다',
    (subCommand) => {
      expect(
        buildDiscordDefaultInteractionResponse(slash(subCommand), config),
      ).toEqual({
        body: {
          type: 4,
          data: {
            content: '요청을 받았습니다.',
            flags: 64,
            allowed_mentions: { parse: [] },
          },
        },
      });
    },
  );

  // 본문에 `data` 가 없는 슬래시 명령도 하위 명령이 없는 것으로 보고 수신 문구로 답한다. 3초 응답을 놓치지
  // 않는 것이 우선이다. NERV Task `CLE-T-0JEQRY` 5번.
  it('data 가 없는 슬래시 명령도 type 4 수신 문구다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(
        { id: 'I1', type: 2, token: 'tok' },
        config,
      ),
    ).toEqual({
      body: {
        type: 4,
        data: {
          content: '요청을 받았습니다.',
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      },
    });
  });

  it('슬래시 명령 help 는 등록한 prefix 를 넣은 기본 도움말이다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(slash('help'), config),
    ).toEqual({
      body: {
        type: 4,
        data: {
          content: [
            '/workflow start - 새 대화 시작',
            '/workflow cancel - 진행 중인 대화 취소',
            '/workflow reply - 진행 중인 대화에 답장',
            '/workflow help - 도움말',
          ].join('\n'),
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      },
    });
  });

  it('help 는 languageHints.slashPrefix 와 en locale 을 따른다', () => {
    const res = buildDiscordDefaultInteractionResponse(slash('help'), {
      ...config,
      languageLocale: 'en',
      languageHints: { slashPrefix: 'bot' },
    }) as { body: { data: { content: string } } };

    expect(res.body.data.content).toBe(
      [
        '/bot start - Start a new conversation',
        '/bot cancel - Cancel the active conversation',
        '/bot reply - Reply to the active conversation',
        '/bot help - Show help',
      ].join('\n'),
    );
  });

  // NERV Task `CLE-T-J8M86K` — 빈 slashPrefix 는 「없는 것」 이라 기본 prefix 로 넘어간다.
  it('help 의 빈 languageHints.slashPrefix 는 무시하고 기본 prefix 를 넣는다', () => {
    const res = buildDiscordDefaultInteractionResponse(slash('help'), {
      ...config,
      languageLocale: 'en',
      languageHints: { slashPrefix: '' },
    }) as { body: { data: { content: string } } };

    expect(res.body.data.content).toBe(
      [
        '/workflow start - Start a new conversation',
        '/workflow cancel - Cancel the active conversation',
        '/workflow reply - Reply to the active conversation',
        '/workflow help - Show help',
      ].join('\n'),
    );
  });

  it('languageHints.help · commandReceived 가 있으면 그 문구다', () => {
    const hinted: ChatChannelConfig = {
      ...config,
      languageHints: { help: '도움말 문구', commandReceived: '접수했어요' },
    };

    expect(
      buildDiscordDefaultInteractionResponse(slash('help'), hinted),
    ).toEqual({
      body: {
        type: 4,
        data: {
          content: '도움말 문구',
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      },
    });
    expect(
      buildDiscordDefaultInteractionResponse(slash('start'), hinted),
    ).toEqual({
      body: {
        type: 4,
        data: {
          content: '접수했어요',
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      },
    });
  });

  it('빈 languageHints.help 는 무시하고 기본 도움말을 쓴다', () => {
    const res = buildDiscordDefaultInteractionResponse(slash('help'), {
      ...config,
      languageHints: { help: '' },
    }) as { body: { data: { content: string } } };

    expect(res.body.data.content.split('\n')[0]).toBe(
      '/workflow start - 새 대화 시작',
    );
  });

  it('languageHints.help 의 {prefix} 는 바꾸지 않는다', () => {
    const res = buildDiscordDefaultInteractionResponse(slash('help'), {
      ...config,
      languageHints: { help: '/{prefix} 도움말', slashPrefix: 'bot' },
    }) as { body: { data: { content: string } } };

    expect(res.body.data.content).toBe('/{prefix} 도움말');
  });

  it('locale 을 모르면 ko 기본 도움말이다', () => {
    const res = buildDiscordDefaultInteractionResponse(slash('help'), {
      ...config,
      languageLocale: 'de' as unknown as 'ko',
    }) as { body: { data: { content: string } } };

    expect(res.body.data.content.split('\n')[0]).toBe(
      '/workflow start - 새 대화 시작',
    );
  });

  it('en locale 수신 문구는 영어다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(slash('cancel'), {
        ...config,
        languageLocale: 'en',
      }),
    ).toEqual({
      body: {
        type: 4,
        data: {
          content: 'Request received.',
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      },
    });
  });

  it.each([
    ['PING(type 1)', { id: 'I1', type: 1 }],
    ['AUTOCOMPLETE(type 4)', { id: 'I1', type: 4 }],
    ['문자열 type', { id: 'I1', type: '3' }],
    ['type 없는 본문', { id: 'I1' }],
    ['null', null],
    ['문자열 본문', 'payload'],
  ])('%s 에는 기본 응답이 없다', (_label, raw) => {
    expect(buildDiscordDefaultInteractionResponse(raw, config)).toBeUndefined();
  });

  // DM 밖(서버 채널 · 스레드 · 그룹 DM)에서 친 슬래시 명령은 파서가 버린다. 사용자에게는 수신 문구 대신
  // 본인에게만 보이는 groupChatRefusal 안내로 답한다(REQ-CHAT-017, Slack 과 같은 규칙). 2026-11-19 사람
  // 결정(NERV 질문 `01a1f1d3-f3ba-702d-9689-121062b39a9d`), NERV Task `CLE-T-B9CRCF`.
  const inChannel = (channelType: number, subCommand?: string) => ({
    ...slash(subCommand),
    channel_id: 'C1',
    channel: { id: 'C1', type: channelType },
  });
  const refusal = (content: string) => ({
    body: {
      type: 4,
      data: { content, flags: 64, allowed_mentions: { parse: [] } },
    },
  });

  it.each([
    ['서버 텍스트 채널(type 0)', 0, 'start'],
    ['서버 텍스트 채널(type 0) help', 0, 'help'],
    ['그룹 DM(type 3)', 3, 'cancel'],
    ['공개 스레드(type 11)', 11, undefined],
  ])('%s 의 슬래시 명령은 groupChatRefusal 안내다', (_label, type, sub) => {
    expect(
      buildDiscordDefaultInteractionResponse(inChannel(type, sub), config),
    ).toEqual(refusal('이 봇은 1:1 대화만 지원합니다.'));
  });

  it('DM 밖 슬래시 명령은 languageHints.groupChatRefusal 이 있으면 그 문구다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(inChannel(0, 'start'), {
        ...config,
        languageHints: { groupChatRefusal: 'DM 으로 불러 주세요.' },
      }),
    ).toEqual(refusal('DM 으로 불러 주세요.'));
  });

  // REQ-DISCORD-036 «없거나 비어 있으면 기본 문구» 의 빈 문자열 쪽(NERV Task `CLE-T-BP79PK`).
  it('DM 밖 슬래시 명령의 빈 languageHints.groupChatRefusal 은 무시하고 기본 문구다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(inChannel(0, 'help'), {
        ...config,
        languageHints: { groupChatRefusal: '' },
      }),
    ).toEqual(refusal('이 봇은 1:1 대화만 지원합니다.'));
  });

  it('DM(type 1)에서 친 슬래시 명령은 그대로 수신 문구다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(inChannel(1, 'start'), config),
    ).toEqual(refusal('요청을 받았습니다.'));
  });

  it('DM 밖 컴포넌트 클릭은 그대로 { type: 6 } 이다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(
        { id: 'I1', type: 3, channel: { id: 'C1', type: 0 } },
        config,
      ),
    ).toEqual({ body: { type: 6 } });
  });
});

/**
 * 멘션 무력화(NERV Task `CLE-T-FQTQ7K`). 슬래시 명령 응답(type 4)도 채널 메시지라
 * `allowed_mentions: {parse: []}` 를 붙인다. `languageHints` 문구에 멘션이 있어도 알림이 없다.
 */
describe('buildDiscordDefaultInteractionResponse — 멘션 알림을 끈다', () => {
  it.each(['start', 'help'])(
    '슬래시 명령 %s 응답 data 에 allowed_mentions 가 있다',
    (name) => {
      const res = buildDiscordDefaultInteractionResponse(
        { type: 2, data: { name: 'workflow', options: [{ name }] } },
        {
          provider: 'discord',
          botTokenRef: 'secret://triggers/t1/bot-token',
          languageHints: {
            help: '@everyone 도움말',
            commandReceived: '@here 접수',
          },
        },
      ) as { body: { data: Record<string, unknown> } };
      expect(res.body.data.allowed_mentions).toEqual({ parse: [] });
    },
  );

  it('컴포넌트 · 모달 응답(type 6)은 메시지가 없어 붙이지 않는다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(
        { type: 3 },
        {
          provider: 'discord',
          botTokenRef: 'secret://triggers/t1/bot-token',
        },
      ),
    ).toEqual({ body: { type: 6 } });
  });
});
