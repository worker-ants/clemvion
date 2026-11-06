import { Logger } from '@nestjs/common';
import { VALUE_MASK_MARKER } from '../../../../shared/utils/sanitize-error-message';
import { realFetchHeaderError } from '../../../../shared/testing/real-fetch-header-error';
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

/**
 * 실패 원문에서 봇 토큰을 지운다(NERV Task `CLE-T-H0GF4K`).
 *
 * `authorization: Bot <토큰>` 에 CR · LF · NUL 이 있으면 fetch 가 헤더 값 전체를 원문에 싣는다.
 * 합성 실패의 이 원문은 로그에 남고, 어댑터가 `ok: false` 로 실패를 판정한 뒤로는(NERV Task
 * `CLE-T-KX2Q2N`) `chat_channel_last_error` 에도 닿는다. 시크릿 저장소 평문은 어디에도 닿으면 안 된다.
 */
describe('DiscordClient — 실패 원문에서 봇 토큰을 지운다', () => {
  const parts = ['MTAx.Yy', 'ZZZZ'];

  // 둘째 줄: 끝 공백이 붙은 토큰은 fetch 가 끝 공백을 떼고 원문에 싣는다(정확 일치가 빗나가던 경우).
  it.each([['MTAx.Yy\nZZZZ'], ['MTAx.Yy\nZZZZ\t ']])(
    '반환 message 와 로그에 토큰이 없다 (%j)',
    async (token) => {
      const rejection = await realFetchHeaderError(`Bot ${token}`);
      const original = global.fetch;
      (global as unknown as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockRejectedValue(rejection);
      jest.useFakeTimers();
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      try {
        const pending = new DiscordClient().getApplicationMe(token);
        await jest.advanceTimersByTimeAsync(10_000);
        const res = (await pending) as DiscordApiError;

        expect(res.message).toBe(
          `Headers.append: "Bot ${VALUE_MASK_MARKER}" is an invalid header value.`,
        );
        expect(warn).toHaveBeenCalled();
        for (const call of warn.mock.calls) {
          const line = call.map(String).join(' ');
          for (const part of parts) expect(line).not.toContain(part);
        }
      } finally {
        warn.mockRestore();
        jest.useRealTimers();
        global.fetch = original;
      }
    },
  );
});

/**
 * typing 결과는 `ok: false` 표지로 판정한다(NERV Task `CLE-T-KX2Q2N`). 재시도를 다 쓴 합성
 * 실패에는 Discord 원본 숫자 `code` 가 없어서 예전 판정(`code` 가 있으면 실패)은 성공으로 봤다.
 */
describe('DiscordClient.postChannelTyping — ok:false 로 판정한다', () => {
  const typingWith = async (fetchMock: jest.Mock): Promise<{ ok: boolean }> => {
    const original = global.fetch;
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    jest.useFakeTimers();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const pending = new DiscordClient().postChannelTyping('bot-token', 'C1');
      await jest.advanceTimersByTimeAsync(10_000);
      return await pending;
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
      global.fetch = original;
    }
  };

  it('5xx 를 세 번 받은 합성 실패 → ok:false', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => null },
      json: async () => ({ message: 'unavailable' }),
    });
    await expect(typingWith(fetchMock)).resolves.toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fetch 예외를 세 번 받은 합성 실패 → ok:false', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(typingWith(fetchMock)).resolves.toEqual({ ok: false });
  });

  it('4xx 본문(Discord 원본 code 있음) → ok:false', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: async () => ({ message: 'Missing Access', code: 50001 }),
    });
    await expect(typingWith(fetchMock)).resolves.toEqual({ ok: false });
  });

  it('204 No Content → ok:true', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
    });
    await expect(typingWith(fetchMock)).resolves.toEqual({ ok: true });
  });
});
