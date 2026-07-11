import {
  resolveWebchatIdleReapGraceMs,
  DEFAULT_WEBCHAT_IDLE_REAP_GRACE_MS,
} from './webchat-idle-reaper.types';

describe('resolveWebchatIdleReapGraceMs [Spec EIA §3.4 EIA-RL-07]', () => {
  it('유효 양의 정수 문자열을 채택', () => {
    expect(
      resolveWebchatIdleReapGraceMs({
        WEBCHAT_IDLE_REAP_GRACE_MS: '7200000',
      } as never),
    ).toBe(7200000);
  });

  it('미설정 → 기본값(1h)', () => {
    expect(resolveWebchatIdleReapGraceMs({} as never)).toBe(
      DEFAULT_WEBCHAT_IDLE_REAP_GRACE_MS,
    );
  });

  it.each(['0', '-1', '3.5', '1e3', 'abc', ''])(
    '비양수·비정수·비숫자(%s) → 기본값 fallback',
    (raw) => {
      expect(
        resolveWebchatIdleReapGraceMs({
          WEBCHAT_IDLE_REAP_GRACE_MS: raw,
        } as never),
      ).toBe(DEFAULT_WEBCHAT_IDLE_REAP_GRACE_MS);
    },
  );
});
