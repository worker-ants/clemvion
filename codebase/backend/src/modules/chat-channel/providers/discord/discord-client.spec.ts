import { DiscordClient } from './discord-client';
import type { DiscordApiError } from './discord.types';

/**
 * DiscordClient 4xx 응답 계약 — **`status` 배선**.
 *
 * 이 파일이 생긴 이유: adapter 테스트는 `getApplicationMe` 를 mock 하면서 `status` 를
 * **자기가 넣어** 주므로, client 가 `status` 를 싣지 않게 되어도 adapter 쪽은 전부 GREEN 이다
 * (뮤테이션으로 실증 — `status: res.status` 를 지웠는데 434개 테스트가 통과했다). 자격 증명
 * 거부 판정(`§1.1.2`)이 이 필드에 걸려 있으므로 그 배선을 여기서 고정한다.
 */
describe('DiscordClient — 4xx 응답에 HTTP status 를 싣는다', () => {
  const withFetch = async (
    res: Record<string, unknown>,
  ): Promise<DiscordApiError> => {
    const original = global.fetch;
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValue(res);
    try {
      return (await new DiscordClient().getApplicationMe(
        'bot-token',
      )) as DiscordApiError;
    } finally {
      global.fetch = original;
    }
  };

  it('401 — status 401 + Discord 원본 `code` 를 함께 보존 (다른 네임스페이스)', async () => {
    const body = await withFetch({
      ok: false,
      status: 401,
      headers: { get: () => null },
      // Discord 는 인증 실패에 숫자 `code: 0` 을 준다 — 값으로는 자격 증명 거부를 못 가른다.
      json: async () => ({ message: '401: Unauthorized', code: 0 }),
    });
    expect(body).toMatchObject({ ok: false, status: 401, code: 0 });
  });

  it('404 — status 404 (어댑터가 자격 증명 거부로 오분류하지 않도록)', async () => {
    const body = await withFetch({
      ok: false,
      status: 404,
      headers: { get: () => null },
      json: async () => ({ message: 'Unknown application', code: 10002 }),
    });
    expect(body).toMatchObject({ ok: false, status: 404, code: 10002 });
  });

  it('body 가 JSON 이 아니어도 status 는 남는다 (합성 body 경로)', async () => {
    const body = await withFetch({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => {
        throw new Error('not json');
      },
    });
    expect(body).toMatchObject({ ok: false, status: 403 });
  });
});
