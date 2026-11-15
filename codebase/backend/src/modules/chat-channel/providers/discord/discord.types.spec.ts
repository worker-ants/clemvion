/**
 * isDiscordApiError — Discord 클라이언트 결과의 실패 판정 단위 테스트.
 * 판정은 `ok: false` 표지로만 한다. 성공 응답(메시지 · 명령 배열 · 204 의 빈 객체)은 실패가 아니다.
 */
import {
  buildDiscordEphemeralMessageResponse,
  isDiscordApiError,
  withDiscordMentionsDisabled,
} from './discord.types';

describe('isDiscordApiError', () => {
  it.each([
    ['합성 실패', { ok: false }],
    ['4xx 본문', { ok: false, status: 400, code: 50035 }],
  ])('%s → true', (_name, value) => {
    expect(isDiscordApiError(value)).toBe(true);
  });

  it.each([
    ['빈 객체(204)', {}],
    ['빈 배열', []],
    ['명령 배열(성공)', [{ id: '1', name: 'cmd' }]],
    ['null', null],
    ['undefined', undefined],
    ['ok:true', { ok: true }],
    ['code:0 (ok 없음)', { code: 0 }],
    ['code:50001 (ok 없음)', { code: 50001 }],
    ['메시지 객체', { id: 'M1', channel_id: 'C1' }],
    ['문자열', 'ok'],
  ])('%s → false', (_name, value) => {
    expect(isDiscordApiError(value)).toBe(false);
  });
});

// NERV Task CLE-T-VE7QVM — 메시지를 싣는 응답 data 의 공용 빌더.
describe('buildDiscordEphemeralMessageResponse', () => {
  it('type 4 · flags 64 · allowed_mentions.parse 빈 배열로 content 를 싣는다', () => {
    expect(buildDiscordEphemeralMessageResponse('@everyone 안내')).toEqual({
      type: 4,
      data: {
        content: '@everyone 안내',
        flags: 64,
        allowed_mentions: { parse: [] },
      },
    });
  });
});

describe('withDiscordMentionsDisabled', () => {
  it('본문 필드는 그대로 두고 allowed_mentions 를 더한다', () => {
    expect(withDiscordMentionsDisabled({ content: 'x', embeds: [] })).toEqual({
      content: 'x',
      embeds: [],
      allowed_mentions: { parse: [] },
    });
  });

  it('호출자가 넣은 allowed_mentions 는 parse 빈 배열로 덮는다', () => {
    expect(
      withDiscordMentionsDisabled({
        content: 'x',
        allowed_mentions: { parse: ['everyone', 'users'] },
      }),
    ).toEqual({ content: 'x', allowed_mentions: { parse: [] } });
  });
});
