import { emptyOAuthEnvConfig } from './oauth.config';

/**
 * refactor M-6 (review I19) — `emptyOAuthEnvConfig` factory 계약 고정.
 * 서비스 getter·테스트 mock 이 공유하는 단일 SoT 이므로, 빈 기본값 + **매 호출 fresh 객체**
 * (nested 포함) 반환으로 cross-consumer mutation 격리가 보장돼야 한다.
 */
describe('emptyOAuthEnvConfig (refactor M-6)', () => {
  it('빈 기본값(모든 자격증명 빈 문자열, flag 빈 문자열)을 반환한다', () => {
    expect(emptyOAuthEnvConfig()).toEqual({
      cafe24: { clientId: '', clientSecret: '' },
      google: { clientId: '', clientSecret: '' },
      github: { clientId: '', clientSecret: '' },
      stubModeRaw: '',
      frontendUrl: '',
      appUrl: '',
    });
  });

  it('매 호출 fresh 객체(nested 포함)를 반환해 mutation 이 격리된다', () => {
    const a = emptyOAuthEnvConfig();
    const b = emptyOAuthEnvConfig();
    expect(a).not.toBe(b);
    expect(a.cafe24).not.toBe(b.cafe24);

    a.cafe24.clientId = 'mutated';
    expect(b.cafe24.clientId).toBe('');
  });
});
