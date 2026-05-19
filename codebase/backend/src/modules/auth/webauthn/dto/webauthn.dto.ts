import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * WebAuthn 등록 verify 요청.
 *
 * spec/5-system/1-auth.md §1.4.4 등록 흐름.
 */
export class WebAuthnRegisterVerifyDto {
  @ApiProperty({
    description:
      '서버가 register/options 응답에 발급한 stateless JWT (`kind=webauthn_register`, exp 5분).',
  })
  @IsString()
  optionsToken: string;

  @ApiProperty({
    description: 'navigator.credentials.create() 반환 결과 (RegistrationResponseJSON).',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  response: Record<string, unknown>;

  @ApiProperty({
    description: '사용자가 부여한 표시 이름 (최대 100자, 선택)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
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
      '서버가 authenticate/options 응답에 발급한 stateless JWT (`kind=webauthn_auth`, exp 5분).',
  })
  @IsString()
  optionsToken: string;

  @ApiProperty({
    description: 'navigator.credentials.get() 반환 결과 (AuthenticationResponseJSON).',
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
  @ApiProperty({ description: '새 표시 이름 (최대 100자)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deviceName: string;
}

/** WebAuthn 복구 코드 재발급 (비밀번호 재확인). */
export class WebAuthnRegenerateRecoveryDto {
  @ApiProperty({ description: '계정 비밀번호 (재확인용)' })
  @IsString()
  @MinLength(8)
  password: string;
}
