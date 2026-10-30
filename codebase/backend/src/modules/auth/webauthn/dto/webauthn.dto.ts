import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
  buildMessage,
} from 'class-validator';

import { PostgresVarchar } from '../../../../common/utils/postgres-text';

// Passkey 표시 이름의 최대 길이(유니코드 코드 포인트). `webauthn_credential.device_name` 이 `varchar(100)` 이다.
// 근거: [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN#passkey-등록인증-흐름)
const DEVICE_NAME_MAX_CODE_POINTS = 100;

// 근거: [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN#passkey-등록인증-흐름)
/**
 * 앞뒤 공백 문자를 지우면 빈 문자열이 되는 값을 거부한다. 문자열이 아니어도 거부한다.
 *
 * 공백 문자는 `String.prototype.trim()` 이 지우는 문자다. 서비스가 표시 이름을 저장할 때 지우는 문자와 같다.
 */
function IsNotBlank(): PropertyDecorator {
  return ValidateBy({
    name: 'isNotBlank',
    validator: {
      validate: (value: unknown): boolean =>
        typeof value === 'string' && value.trim().length > 0,
      defaultMessage: buildMessage(
        (eachPrefix) =>
          `${eachPrefix}$property must not be empty or only whitespace`,
      ),
    },
  });
}

// 근거: [가입과 로그인 「Passkey 등록·인증 흐름」](CLE-ACCT-SIGNIN#passkey-등록인증-흐름)
/**
 * WebAuthn 등록 verify 요청.
 */
export class WebAuthnRegisterVerifyDto {
  @ApiProperty({
    description:
      '서버가 register/options 응답에 발급한 stateless JWT (`kind=webauthn_register`, exp 5분).',
  })
  @IsString()
  optionsToken: string;

  @ApiProperty({
    description:
      'navigator.credentials.create() 반환 결과 (RegistrationResponseJSON).',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  response: Record<string, unknown>;

  @ApiProperty({
    description:
      '사용자가 부여한 표시 이름 (선택). 유니코드 코드 포인트 100개까지 받고 NUL 문자는 받지 않는다. 길이는 앞뒤 공백 문자를 지우기 전 값으로 센다. 저장할 때 앞뒤 공백 문자를 지우고, 빈 이름이나 공백 문자로만 된 이름은 이름 없음(null)으로 저장한다.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @PostgresVarchar(DEVICE_NAME_MAX_CODE_POINTS)
  deviceName?: string;
}

/**
 * WebAuthn 로그인 2FA options 요청.
 * `challengeToken` 은 `/auth/login` 응답이 발급한 mfa_challenge JWT.
 */
export class WebAuthnAuthOptionsDto {
  @ApiProperty({ description: '/auth/login 발급 mfa_challenge JWT' })
  @IsString()
  challengeToken: string;
}

/**
 * WebAuthn 로그인 2FA verify 요청.
 */
export class WebAuthnAuthVerifyDto {
  @ApiProperty({ description: '/auth/login 발급 mfa_challenge JWT' })
  @IsString()
  challengeToken: string;

  @ApiProperty({
    description:
      '서버가 authenticate/options 응답에 발급한 JWT (`kind=webauthn_auth`, exp 5분). 옵션 토큰 하나는 검증에 한 번만 쓸 수 있습니다. 다시 쓰면 거부되므로 시도할 때마다 authenticate/options 로 옵션을 새로 받습니다.',
  })
  @IsString()
  optionsToken: string;

  @ApiProperty({
    description:
      'navigator.credentials.get() 반환 결과 (AuthenticationResponseJSON).',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  response: Record<string, unknown>;
}

/** WebAuthn 복구 코드로 2FA 통과. */
export class WebAuthnRecoveryDto {
  @ApiProperty({ description: '/auth/login 발급 mfa_challenge JWT' })
  @IsString()
  challengeToken: string;

  @ApiProperty({ description: '복구 코드 (xxxx-xxxx-xxxx)' })
  @IsString()
  @MinLength(12)
  @MaxLength(32)
  code: string;
}

/** credential 이름 변경. */
export class WebAuthnRenameDto {
  @ApiProperty({
    description:
      '새 표시 이름. 유니코드 코드 포인트 100개까지 받고 NUL 문자는 받지 않는다. 빈 이름과 공백 문자로만 된 이름도 받지 않는다. 길이는 앞뒤 공백 문자를 지우기 전 값으로 센다. 저장할 때 앞뒤 공백 문자를 지운다.',
  })
  @IsString()
  @MinLength(1)
  @IsNotBlank()
  @PostgresVarchar(DEVICE_NAME_MAX_CODE_POINTS)
  deviceName: string;
}

/** WebAuthn 복구 코드 재발급 (비밀번호 재확인). */
export class WebAuthnRegenerateRecoveryDto {
  @ApiProperty({ description: '계정 비밀번호 (재확인용)' })
  @IsString()
  @MinLength(8)
  password: string;
}
