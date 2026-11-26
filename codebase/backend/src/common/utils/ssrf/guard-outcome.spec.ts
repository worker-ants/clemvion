import { findConnectTimeBlock, runSsrfPreflight } from './guard-outcome';
import { SsrfBlockedError } from './outbound-guard';

function fakeLogger(): { warn: jest.Mock<void, [string]> } {
  return { warn: jest.fn<void, [string]>() };
}

describe('runSsrfPreflight — 연결 전 판정 결과 처리', () => {
  it('검사가 통과하면 pass 이고 로그를 남기지 않는다', async () => {
    const logger = fakeLogger();

    await expect(
      runSsrfPreflight(() => Promise.resolve(), logger, 'site'),
    ).resolves.toBe('pass');
    await expect(
      runSsrfPreflight(() => Promise.resolve(null), logger, 'site'),
    ).resolves.toBe('pass');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('검사가 판정 오류를 던지면 blocked 이고 원문을 차단 경고 로그에 남긴다', async () => {
    const logger = fakeLogger();

    const outcome = await runSsrfPreflight(
      () => Promise.reject(new SsrfBlockedError('host "db.test" is 10.0.0.1')),
      logger,
      'database-query',
    );

    expect(outcome).toBe('blocked');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'SSRF block (database-query): SSRF_BLOCKED: host "db.test" is 10.0.0.1',
    );
  });

  it('검사가 판정 오류를 돌려주면(`checkSmtpHost` 형태) blocked 이고 원문을 차단 경고 로그에 남긴다', async () => {
    const logger = fakeLogger();

    const outcome = await runSsrfPreflight(
      () => Promise.resolve(new SsrfBlockedError('smtp is 10.0.0.2')),
      logger,
      'send-email',
    );

    expect(outcome).toBe('blocked');
    expect(logger.warn).toHaveBeenCalledWith(
      'SSRF block (send-email): SSRF_BLOCKED: smtp is 10.0.0.2',
    );
  });

  it.each([
    [
      'Error',
      new Error('resolver exploded for 10.0.0.3'),
      'resolver exploded for 10.0.0.3',
    ],
    ['Error 아닌 값', 'raw failure', 'raw failure'],
  ])(
    '판정이 아닌 오류(%s)는 guard_failed 이고 원문을 가드 고장 경고 로그에 남긴다',
    async (_label, thrown, detail) => {
      const logger = fakeLogger();

      const outcome = await runSsrfPreflight(
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Error 아닌 값으로 실패하는 가드를 재현한다
        () => Promise.reject(thrown),
        logger,
        'email connection test',
      );

      expect(outcome).toBe('guard_failed');
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        `SSRF guard failed (email connection test): ${detail}`,
      );
    },
  );
});

describe('findConnectTimeBlock — 연결 시점 차단 찾기', () => {
  it('cause 사슬에 판정 오류가 있으면 그 오류를 돌려주고 원문을 경고 로그에 남긴다', () => {
    const logger = fakeLogger();
    const blocked = new SsrfBlockedError('rebind.test resolved to 127.0.0.1');
    const wrapped = new Error('connect failed', {
      cause: new Error('socket error', { cause: blocked }),
    });

    expect(findConnectTimeBlock(wrapped, logger, 'send-email')).toBe(blocked);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'SSRF block at connect time (send-email): SSRF_BLOCKED: rebind.test resolved to 127.0.0.1',
    );
  });

  it('판정 오류가 없으면 undefined 이고 로그를 남기지 않는다', () => {
    const logger = fakeLogger();

    expect(
      findConnectTimeBlock(new Error('ECONNREFUSED'), logger, 'database-query'),
    ).toBeUndefined();
    expect(findConnectTimeBlock('not an error', logger, 'x')).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
