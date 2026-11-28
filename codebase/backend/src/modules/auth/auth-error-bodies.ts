import { PASSWORD_VERIFY_CODES } from '../../common/utils/password.util';

/**
 * 인증 모듈이 여러 자리에서 같은 코드로 내는 에러 응답 본문(`{ code, message }`). 서버 `message` 는 영문 고정 문구이고
 * 화면 문구는 프런트엔드가 코드로 고른다(NERV CLE-UI-I18N-BACKEND 규칙 3 · 5). 같은 코드의 문구가 자리마다 갈라지지
 * 않게 한 곳에 두고 서비스와 테스트가 이 값을 함께 본다(NERV Task CLE-T-7QQPK7).
 *
 * 예외 객체가 아니라 본문만 둔다. 상태 코드(`UnauthorizedException` · `ConflictException`)는 쓰는 자리가 고르고, 본문은
 * 펼쳐서(`{ ...AUTH_ERROR_BODIES.loginFailed }`) 넘겨 예외마다 새 객체를 갖게 한다.
 */
export const AUTH_ERROR_BODIES = {
  /** 이메일 · 비밀번호 로그인 실패. 계정이 없는지 비밀번호가 틀렸는지 구분하지 않는다. */
  loginFailed: { code: 'LOGIN_FAILED', message: 'Invalid email or password' },
  /** 2단계 인증 코드(TOTP)가 맞지 않다. */
  totpInvalid: {
    code: 'TOTP_INVALID',
    message: 'The verification code is incorrect.',
  },
  /** 비밀번호 재확인에서 비밀번호가 맞지 않다. */
  passwordInvalid: {
    code: PASSWORD_VERIFY_CODES.INVALID,
    message: 'The password is incorrect.',
  },
  /** 가입 · 이메일 변경에서 이미 쓰는 이메일이다. */
  emailTaken: {
    code: 'RESOURCE_CONFLICT',
    message: 'Email already registered',
  },
  /** refresh 토큰이 없거나 이미 회전됐다. */
  refreshTokenInvalid: {
    code: 'TOKEN_INVALID',
    message: 'Invalid refresh token',
  },
  /** 같은 인증기(credential id)가 이미 등록돼 있다. */
  webauthnCredentialExists: {
    code: 'WEBAUTHN_CREDENTIAL_EXISTS',
    message: 'This authenticator is already registered.',
  },
} as const;
