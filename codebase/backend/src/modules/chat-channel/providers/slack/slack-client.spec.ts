import { Logger } from '@nestjs/common';
import { VALUE_MASK_MARKER } from '../../../../shared/utils/sanitize-error-message';
import { realFetchHeaderError } from '../../../../shared/testing/real-fetch-header-error';
import { SlackClient } from './slack-client';

/** 로그 인자 어디에도 토큰 전체 · 제어 문자 앞뒤 조각이 없다. */
function expectNoTokenInLogs(spy: jest.SpyInstance, parts: string[]): void {
  expect(spy).toHaveBeenCalled();
  for (const call of spy.mock.calls) {
    const line = call.map(String).join(' ');
    for (const part of parts) expect(line).not.toContain(part);
  }
}

/**
 * 실패 원문에서 봇 토큰을 지운다(NERV Task `CLE-T-H0GF4K`).
 *
 * Node 24 의 fetch 는 헤더 값에 CR · LF · NUL 이 있으면 요청을 만들지 않고
 * `Headers.append: "Bearer <토큰 전체>" is an invalid header value.` 로 거부한다.
 * 이 원문이 그대로 반환되면 어댑터 → dispatcher · binder 를 거쳐 `chat_channel_last_error`
 * 와 로그에 토큰 평문이 남는다. 시크릿 저장소 평문은 DB 와 로그에 닿으면 안 된다.
 *
 * 원문은 실제 fetch 로 만든다({@link realFetchHeaderError}). 재시도 백오프(1s · 2s)는 가짜
 * 타이머로 넘긴다.
 */
describe('SlackClient — 실패 원문에서 봇 토큰을 지운다', () => {
  const token = 'xoxb-AAA\nBBBB';
  const parts = [token, 'xoxb-AAA', 'BBBB'];
  let warn: jest.SpyInstance;
  let original: typeof fetch;

  beforeEach(async () => {
    // 원문을 먼저 만든다. 전제가 깨져 여기서 던지면 아래 교체가 일어나지 않고 afterEach 도
    // 되돌릴 것이 없다.
    const rejection = await realFetchHeaderError(`Bearer ${token}`);
    original = global.fetch;
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(rejection);
    jest.useFakeTimers();
  });

  afterEach(() => {
    warn?.mockRestore();
    jest.useRealTimers();
    if (original) global.fetch = original;
  });

  it('call 경로(auth.test): 반환 error 와 로그에 토큰이 없다', async () => {
    const pending = new SlackClient().authTest(token);
    await jest.advanceTimersByTimeAsync(10_000);
    const res = await pending;

    expect(res.ok).toBe(false);
    expect(res.error).toBe(
      `Headers.append: "Bearer ${VALUE_MASK_MARKER}" is an invalid header value.`,
    );
    expectNoTokenInLogs(warn, parts);
  });

  it('filesUploadV2 경로: 반환 error 와 로그에 토큰이 없다', async () => {
    const pending = new SlackClient().filesUploadV2(token, {
      channel_id: 'C1',
      filename: 'a.png',
      file: Buffer.from([1, 2, 3]),
    });
    await jest.advanceTimersByTimeAsync(10_000);
    const res = await pending;

    expect(res.ok).toBe(false);
    expect(res.error).toBe(
      `Headers.append: "Bearer ${VALUE_MASK_MARKER}" is an invalid header value.`,
    );
    expectNoTokenInLogs(warn, parts);
  });
});

/**
 * 여러 줄을 붙여 넣은 토큰(끝에 줄바꿈)은 fetch 가 끝 공백을 떼고 원문에 싣는다. 정확 일치만
 * 보면 빗나가 평문이 남던 경우다.
 */
describe('SlackClient — 끝에 줄바꿈이 붙은 토큰도 지운다', () => {
  it('반환 error 와 로그에 토큰 본문이 없다', async () => {
    const token = 'xoxb-AAA\nBBBB\n';
    const rejection = await realFetchHeaderError(`Bearer ${token}`);
    const original = global.fetch;
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(rejection);
    jest.useFakeTimers();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      const pending = new SlackClient().authTest(token);
      await jest.advanceTimersByTimeAsync(10_000);
      const res = await pending;

      expect(res.error).toBe(
        `Headers.append: "Bearer ${VALUE_MASK_MARKER}" is an invalid header value.`,
      );
      expectNoTokenInLogs(warn, ['xoxb-AAA', 'BBBB']);
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
      global.fetch = original;
    }
  });
});

/**
 * 치환은 클라이언트가 만든 진단 문장에만 건다. 프로바이더가 돌려준 4xx 본문의 `error` 코드는
 * 자격 증명 거부 판별(어댑터의 `code` 선언)의 입력이라 건드리지 않는다. 토큰이 아주 짧아
 * 코드 문자열과 겹쳐도 그대로다.
 */
describe('SlackClient — 프로바이더 4xx 본문은 바꾸지 않는다', () => {
  it('짧은 토큰이 코드 문자열과 겹쳐도 `error` 코드가 그대로다', async () => {
    const original = global.fetch;
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => null },
        json: async () => ({ ok: false, error: 'invalid_auth' }),
      });
    try {
      const res = await new SlackClient().authTest('a');
      expect(res).toEqual({ ok: false, error: 'invalid_auth' });
    } finally {
      global.fetch = original;
    }
  });
});
