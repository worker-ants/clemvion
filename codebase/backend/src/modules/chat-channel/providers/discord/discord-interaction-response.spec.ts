import type { ChatChannelConfig } from '../../types';
import { buildDiscordDefaultInteractionResponse } from './discord-interaction-response';

// 근거: [Discord 어댑터 「인바운드 응답」](CLE-CHAT-DISCORD) · Discord 공식 문서
// (Receiving and Responding) — interaction 은 3초 안에 200 과 콜백 응답을 받아야 클라이언트가 실패
// 표시를 띄우지 않는다. type 6 은 컴포넌트(버튼)와 버튼에서 연 모달의 제출에만 쓸 수 있어 슬래시 명령은 type 4 다.
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
        body: { type: 4, data: { content: '요청을 받았습니다.', flags: 64 } },
      });
    },
  );

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

  it('languageHints.help · commandReceived 가 있으면 그 문구다', () => {
    const hinted: ChatChannelConfig = {
      ...config,
      languageHints: { help: '도움말 문구', commandReceived: '접수했어요' },
    };

    expect(
      buildDiscordDefaultInteractionResponse(slash('help'), hinted),
    ).toEqual({
      body: { type: 4, data: { content: '도움말 문구', flags: 64 } },
    });
    expect(
      buildDiscordDefaultInteractionResponse(slash('start'), hinted),
    ).toEqual({
      body: { type: 4, data: { content: '접수했어요', flags: 64 } },
    });
  });

  it('en locale 수신 문구는 영어다', () => {
    expect(
      buildDiscordDefaultInteractionResponse(slash('cancel'), {
        ...config,
        languageLocale: 'en',
      }),
    ).toEqual({
      body: { type: 4, data: { content: 'Request received.', flags: 64 } },
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
});
