import {
  retryWithBackoff,
  isRetryableLlmError,
} from './retry-with-backoff.util';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('첫 시도에서 성공하면 retry 없이 결과 반환', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const onAttempt = jest.fn();
    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onAttempt,
    });
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAttempt).not.toHaveBeenCalled();
  });

  it('재시도성 오류는 백오프 1s / 4s / 16s 로 3회 재시도 (jitter 0 고정)', async () => {
    const err = new Error('Request timed out after 60000ms');
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');
    const onAttempt = jest.fn();

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onAttempt,
      randomFn: () => 0, // jitter 비활성 — 1.0x 곱
    });

    // 1차 시도 (즉시)
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);

    // 1차 실패 → 1s 대기
    await jest.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // 2차 실패 → 4s 대기
    await jest.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(3);

    // 3차 실패 → 16s 대기
    await jest.advanceTimersByTimeAsync(16000);
    expect(fn).toHaveBeenCalledTimes(4);

    await expect(promise).resolves.toBe('ok');
    // onAttempt 는 실패 직후마다 호출 — 총 3회 (3차 시도까지의 실패에 대해)
    expect(onAttempt).toHaveBeenCalledTimes(3);
    expect(onAttempt.mock.calls[0][0]).toBe(0);
    expect(onAttempt.mock.calls[1][0]).toBe(1);
    expect(onAttempt.mock.calls[2][0]).toBe(2);
  });

  it('jitter random=1 이면 backoff 가 1.3x 로 늘어남', async () => {
    const err = new Error('Request timed out');
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      randomFn: () => 1, // 최대 jitter — 1300ms 까지 늘어남
    });

    // 1300ms 직전엔 두 번째 호출 안 됨
    await jest.advanceTimersByTimeAsync(1299);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await expect(promise).resolves.toBe('ok');
  });

  it('maxRetries=0 이면 fn 이 1회만 호출되고 즉시 throw', async () => {
    const err = new Error('Request timed out');
    const fn = jest.fn<Promise<string>, []>().mockRejectedValue(err);
    const onAttempt = jest.fn();

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 0,
        baseDelayMs: 1000,
        onAttempt,
      }),
    ).rejects.toThrow('Request timed out');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it('onAttempt 가 throw 해도 재시도는 계속 진행 (부수효과 실패는 흡수)', async () => {
    const err = new Error('Request timed out');
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');
    const onAttempt = jest.fn().mockRejectedValue(new Error('DB write failed'));

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onAttempt,
      randomFn: () => 0,
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it('재시도 모두 실패하면 마지막 오류를 throw', async () => {
    const err = new Error('Request timed out after 60000ms');
    const fn = jest.fn<Promise<string>, []>().mockRejectedValue(err);

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      randomFn: () => 0,
    });
    promise.catch(() => undefined); // unhandled rejection 방지

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(4000);
    await jest.advanceTimersByTimeAsync(16000);

    await expect(promise).rejects.toThrow('Request timed out after 60000ms');
    expect(fn).toHaveBeenCalledTimes(4); // 1 + 3 retry
  });

  it('비재시도성 오류는 즉시 throw', async () => {
    const err = new Error('Unauthorized 401');
    const fn = jest.fn<Promise<string>, []>().mockRejectedValue(err);
    const onAttempt = jest.fn();

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1000,
        isRetryable: () => false,
        onAttempt,
      }),
    ).rejects.toThrow('Unauthorized 401');
    expect(fn).toHaveBeenCalledTimes(1);
    // 마지막 실패 알림은 1회 (최종 실패 직전)
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  it('onAttempt 가 await 되어 DB 업데이트 등의 부수효과를 보장', async () => {
    const err = new Error('Request timed out');
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');
    const sideEffect = jest.fn().mockResolvedValue(undefined);
    const onAttempt = jest.fn().mockImplementation(async () => sideEffect());

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      onAttempt,
      randomFn: () => 0,
    });

    await jest.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe('ok');
    expect(sideEffect).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableLlmError', () => {
  it.each([
    ['Request timed out after 60000ms', true],
    ['socket hang up', true],
    ['ECONNRESET', true],
    ['ETIMEDOUT', true],
    ['getaddrinfo EAI_AGAIN api.openai.com', true],
    ['getaddrinfo ENOTFOUND api.openai.com', false], // ENOTFOUND 는 패턴 미포함 (의도적 — DNS 영구 실패 분리)
    ['429 Too Many Requests', true],
    ['Rate limit reached', true],
    ['HTTP 500 Internal Server Error', true],
    ['502 Bad Gateway', true],
    ['503 Service Unavailable', true],
    ['504 Gateway Timeout', true],
  ])('재시도 대상: %s', (msg, expected) => {
    expect(isRetryableLlmError(new Error(msg))).toBe(expected);
  });

  it.each([
    ['401 Unauthorized', false],
    ['403 Forbidden', false],
    ['404 Not Found', false],
    ['422 Unprocessable Entity', false],
    ['Embedding dimension mismatch for KB kb-1: expected 1536, got 3', false],
    ['Embedding vector is empty', false],
    ['JSON parse failed', false],
    ['400 Bad Request', false],
  ])('비재시도 대상: %s', (msg, expected) => {
    expect(isRetryableLlmError(new Error(msg))).toBe(expected);
  });
});
