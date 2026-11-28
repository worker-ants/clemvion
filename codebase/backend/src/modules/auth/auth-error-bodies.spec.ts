import { AUTH_ERROR_BODIES } from './auth-error-bodies';

/**
 * 인증 응답 본문 상수의 코드와 영문 문구를 고정한다(NERV Task CLE-T-7QQPK7). 서비스와 다른 spec 은 이 상수를 참조하므로
 * 문구를 바꾸면 여기서만 고친다. 코드는 프런트엔드 공용 매핑(`server-error-messages.ts`)의 키라 바꾸지 않는다.
 */
describe('AUTH_ERROR_BODIES', () => {
  it('코드와 영문 문구가 그대로다', () => {
    expect(AUTH_ERROR_BODIES).toEqual({
      loginFailed: {
        code: 'LOGIN_FAILED',
        message: 'Invalid email or password',
      },
      totpInvalid: {
        code: 'TOTP_INVALID',
        message: 'The verification code is incorrect.',
      },
      passwordInvalid: {
        code: 'PASSWORD_INVALID',
        message: 'The password is incorrect.',
      },
      emailTaken: {
        code: 'RESOURCE_CONFLICT',
        message: 'Email already registered',
      },
      refreshTokenInvalid: {
        code: 'TOKEN_INVALID',
        message: 'Invalid refresh token',
      },
      webauthnCredentialExists: {
        code: 'WEBAUTHN_CREDENTIAL_EXISTS',
        message: 'This authenticator is already registered.',
      },
    });
  });

  it('문구에 한국어가 없다(서버 문구는 영문 고정)', () => {
    for (const body of Object.values(AUTH_ERROR_BODIES)) {
      expect(body.message).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    }
  });
});
