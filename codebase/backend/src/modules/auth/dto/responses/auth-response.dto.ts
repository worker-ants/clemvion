import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 액세스 토큰 본문 */
export class AccessTokenDto {
  /** JWT Access Token */
  @ApiProperty({ description: 'JWT Access Token (15분 유효)' })
  accessToken: string;
}

/**
 * 2FA challenge 필요 응답.
 *
 * spec/5-system/1-auth.md §1.4.2 — WebAuthn 우선, TOTP fallback 자동 금지.
 *
 *   methods ⊇ ['webauthn']  → 사용자에게 WebAuthn 화면만 노출
 *   methods === ['totp']    → 사용자에게 TOTP 입력 화면 노출
 *
 * `requiresTotp` 는 deprecated backward-compat 필드 (`methods` 에 'totp' 포함이면 true).
 * 새 클라이언트는 `requires2fa` + `methods` 만 본다. 두 필드 충돌 시 `requires2fa` 우선.
 */
export class LoginChallengeDto {
  @ApiProperty({ example: true, description: '2FA 통과가 필요' })
  requires2fa: boolean;

  @ApiProperty({
    type: [String],
    enum: ['webauthn', 'totp'],
    example: ['webauthn'],
    description:
      '클라이언트에 노출할 2FA 방식. WebAuthn credential 보유 시 ["webauthn"] 만, 아니면 ["totp"].',
  })
  methods: Array<'webauthn' | 'totp'>;

  @ApiProperty({ description: 'mfa_challenge JWT (5분). 후속 verify 요청에 동봉' })
  challengeToken: string;

  @ApiPropertyOptional({
    description:
      'DEPRECATED — `methods` 가 \'totp\' 포함이면 true. 두 마이너 버전 후 제거 예정 (spec §1.4.2).',
    deprecated: true,
  })
  requiresTotp?: boolean;
}

/** TOTP setup 결과 */
export class TotpSetupDto {
  @ApiProperty({ description: 'Authenticator 앱이 읽을 otpauth:// URL' })
  otpauthUrl: string;

  @ApiProperty({ description: 'QR 코드 이미지 (base64 data URL)' })
  qrCodeDataUrl: string;
}

/** 2FA 검증·활성 결과 */
export class TotpVerifyDto {
  @ApiProperty({ type: [String], description: '복구 코드 10개 (일회성 표시)' })
  recoveryCodes: string[];
}

/** 2FA 비활성 결과 */
export class TotpDisableResultDto {
  @ApiProperty({ example: true })
  ok: boolean;
}

/** 단순 메시지 응답 */
export class AuthMessageDto {
  @ApiProperty()
  message: string;
}

/** 회원가입 응답. 초대 토큰 가입은 accessToken 이 동봉된 자동 로그인 형태. */
export class RegisterResultDto {
  @ApiProperty()
  message: string;

  @ApiPropertyOptional({
    description:
      '초대 토큰으로 가입한 경우 즉시 발급되는 Access Token. 일반 가입은 누락(이메일 인증 후 발급). 동시에 Refresh Token 이 httpOnly 쿠키로 셋된다.',
  })
  accessToken?: string;
}

/** 이메일 사용 가능 여부 */
export class CheckEmailResultDto {
  @ApiProperty({ description: 'true면 해당 이메일로 가입 가능' })
  available: boolean;
}

/** OAuth provider 목록 */
export class OauthProvidersDto {
  @ApiProperty({
    type: [String],
    enum: ['google', 'github'],
    example: ['google', 'github'],
  })
  providers: string[];
}
