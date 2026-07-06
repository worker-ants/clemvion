import { withTimeout, TimeoutError } from './with-timeout';

describe('withTimeout', () => {
  it('정상 resolve 시 값을 그대로 전달한다', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'op')).resolves.toBe(
      42,
    );
  });

  it('deadline 경과 시 TimeoutError 로 reject 한다', async () => {
    const never = new Promise<never>(() => {});
    await expect(withTimeout(never, 10, 'slow op')).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it('TimeoutError 는 `<label> timed out after <ms>ms` 포맷 메시지를 갖는다', async () => {
    const never = new Promise<never>(() => {});
    await expect(withTimeout(never, 5, 'connect X')).rejects.toThrow(
      'connect X timed out after 5ms',
    );
  });

  it('non-Error reject 값은 Error 로 래핑된다', async () => {
    // 비-Error reject 흡수를 검증하는 것이 본 테스트의 목적이므로 규칙을 끈다.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    const rejected = Promise.reject('boom');
    await expect(withTimeout(rejected, 1000, 'op')).rejects.toThrow('boom');
  });

  it('Error reject 는 원본 인스턴스를 그대로 전파한다 (래핑하지 않음)', async () => {
    const original = new Error('orig');
    await expect(
      withTimeout(Promise.reject(original), 1000, 'op'),
    ).rejects.toBe(original);
  });

  it('TimeoutError 는 Error 하위클래스이며 name=TimeoutError (하위호환)', () => {
    const err = new TimeoutError('connect', 100);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('TimeoutError');
    expect(err.message).toBe('connect timed out after 100ms');
  });
});
