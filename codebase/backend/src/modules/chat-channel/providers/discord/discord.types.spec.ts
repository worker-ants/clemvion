/**
 * isDiscordApiError — Discord 클라이언트 결과의 실패 판정 단위 테스트.
 * 판정은 `ok: false` 표지로만 한다. 성공 응답(메시지 · 명령 배열 · 204 의 빈 객체)은 실패가 아니다.
 */
import { isDiscordApiError } from './discord.types';

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
