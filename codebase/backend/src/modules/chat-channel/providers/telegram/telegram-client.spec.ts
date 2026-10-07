import { Logger } from '@nestjs/common';
import { VALUE_MASK_MARKER } from '../../../../shared/utils/sanitize-error-message';
import {
  describeFetchError,
  safeHost,
  TelegramClient,
} from './telegram-client';

describe('describeFetchError', () => {
  it('plain Error → message', () => {
    expect(describeFetchError(new Error('boom'))).toBe('boom');
  });

  it('fetch failed with cause + code → unwraps cause and code', () => {
    const cause = Object.assign(
      new Error('getaddrinfo ENOTFOUND api.telegram.org'),
      {
        code: 'ENOTFOUND',
      },
    );
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = cause;
    expect(describeFetchError(err)).toBe(
      'fetch failed ← Error: getaddrinfo ENOTFOUND api.telegram.org [ENOTFOUND]',
    );
  });

  it('fetch failed with cause but no code', () => {
    const cause = new Error('socket hang up');
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = cause;
    expect(describeFetchError(err)).toBe(
      'fetch failed ← Error: socket hang up',
    );
  });

  it('fetch failed with non-Error cause', () => {
    const err = new TypeError('fetch failed');
    (err as { cause?: unknown }).cause = 'arbitrary';
    expect(describeFetchError(err)).toBe('fetch failed ← cause=arbitrary');
  });

  it('non-Error throwable → String()', () => {
    expect(describeFetchError('raw string')).toBe('raw string');
    expect(describeFetchError(undefined)).toBe('undefined');
  });
});

describe('safeHost', () => {
  it('extracts host', () => {
    expect(safeHost('https://api.telegram.org/botSECRET/sendMessage')).toBe(
      'api.telegram.org',
    );
  });

  it('non-URL → unknown', () => {
    expect(safeHost('not a url')).toBe('unknown');
  });
});

/**
 * 실패 원문과 로그에서 봇 토큰을 지운다(NERV Task `CLE-T-H0GF4K`).
 *
 * Telegram 은 토큰을 URL 경로(`/bot<토큰>/<메서드>`)에 싣는다. 지금 Node 의 fetch 오류 원문
 * (`fetch failed`)에는 URL 이 없지만, 시도마다 남기는 로그는 `cause` 까지 풀어 쓴다
 * ({@link describeFetchError}). 원문이나 `cause` 에 URL 이 실리는 오류가 와도 토큰이 로그와
 * `chat_channel_last_error` 에 닿지 않게 한다. Slack · Discord 클라이언트와 같은 규칙이다.
 */
describe('TelegramClient — 실패 원문과 로그에서 봇 토큰을 지운다', () => {
  const token = '1234567890:AAH-telegram-secret';

  it('description 과 시도별 · 최종 로그에 토큰이 없다', async () => {
    const cause = new Error(
      `connect ECONNREFUSED https://api.telegram.org/bot${token}/getMe`,
    );
    const err = new TypeError(`request to /bot${token}/getMe failed`);
    (err as { cause?: unknown }).cause = cause;
    const original = global.fetch;
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(err);
    jest.useFakeTimers();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const pending = new TelegramClient().getMe(token);
      await jest.advanceTimersByTimeAsync(10_000);
      const res = await pending;

      expect(res.ok).toBe(false);
      expect(res.description).toBe(
        `request to /bot${VALUE_MASK_MARKER}/getMe failed`,
      );
      // 시도 3번 + 최종 1번.
      expect(warn).toHaveBeenCalledTimes(4);
      for (const call of warn.mock.calls) {
        expect(call.map(String).join(' ')).not.toContain(token);
      }
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
      global.fetch = original;
    }
  });
});
