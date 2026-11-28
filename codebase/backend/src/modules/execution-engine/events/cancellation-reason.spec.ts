import { cancellationReasonFromError } from './cancellation-reason';

describe('cancellationReasonFromError (CLE-T-NP5VPK)', () => {
  it.each([
    ['RESUME_CHECKPOINT_MISSING', 'system'],
    ['RESUME_FAILED', 'system'],
    ['RESUME_INCOMPATIBLE_STATE', 'system'],
    ['EXECUTION_QUEUE_WAIT_TIMEOUT', 'timeout'],
    ['WEBCHAT_IDLE_TIMEOUT', 'timeout'],
  ])('error.code=%s → cancelledBy=%s, error 를 그대로 싣는다', (code, by) => {
    expect(cancellationReasonFromError({ code, message: `m:${code}` })).toEqual(
      {
        cancelledBy: by,
        error: { code, message: `m:${code}` },
      },
    );
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['code 없는 객체', { message: 'stale' }],
    ['빈 code', { code: '', message: 'x' }],
    ['문자열 아닌 code', { code: 42, message: 'x' }],
  ])('%s → user 이고 error 키가 없다', (_label, error) => {
    const reason = cancellationReasonFromError(error as never);
    expect(reason).toEqual({ cancelledBy: 'user' });
    expect('error' in reason).toBe(false);
  });

  it('표에 없는 코드는 user 로 두되 error 를 지우지 않는다', () => {
    expect(
      cancellationReasonFromError({ code: 'SOMETHING_NEW', message: 'why' }),
    ).toEqual({
      cancelledBy: 'user',
      error: { code: 'SOMETHING_NEW', message: 'why' },
    });
  });

  it('message 가 문자열이 아니면 code 를 message 로 쓴다', () => {
    expect(cancellationReasonFromError({ code: 'RESUME_FAILED' })).toEqual({
      cancelledBy: 'system',
      error: { code: 'RESUME_FAILED', message: 'RESUME_FAILED' },
    });
  });

  it('RESUME 로 시작하지만 밑줄이 없는 코드는 system 이 아니다', () => {
    expect(
      cancellationReasonFromError({ code: 'RESUMED', message: 'x' })
        .cancelledBy,
    ).toBe('user');
  });
});
