import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const AUTH_CONFIG_TYPES = [
  'api_key',
  'bearer_token',
  'basic_auth',
  'hmac',
  'none',
] as const;
export type AuthConfigType = (typeof AUTH_CONFIG_TYPES)[number];

export class CreateAuthConfigDto {
  /** 인증 설정 이름 (식별용) */
  @ApiProperty({
    description: '인증 설정 이름 (식별용)',
    example: 'Webhook Auth #1',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** 인증 타입 */
  @ApiProperty({
    description:
      '인증 타입. api_key=API 키, bearer_token=Bearer 토큰, basic_auth=Basic 인증, hmac=서명 기반, none=인증 없음',
    enum: AUTH_CONFIG_TYPES,
    example: 'api_key',
  })
  @IsIn(AUTH_CONFIG_TYPES as unknown as string[])
  type: AuthConfigType;

  /**
   * 인증 상세 설정. type에 따라 필수 필드가 달라지며 key/token 값은 생성 시 미지정 시 자동 발급됩니다.
   */
  @ApiPropertyOptional({
    description:
      '인증 상세 설정. api_key의 경우 { key } 자동 발급, bearer_token의 경우 { token } 자동 발급. basic_auth는 { username, password } 필요.',
    type: 'object',
    additionalProperties: true,
    example: { headerName: 'X-API-Key' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** 접근 허용 IP 화이트리스트 (CIDR 또는 IP) */
  @ApiPropertyOptional({
    description: '접근 허용 IP 화이트리스트 (CIDR 또는 단일 IP)',
    type: [String],
    example: ['10.0.0.0/8', '203.0.113.42'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  /** 활성 상태 여부 (기본값 true) */
  @ApiPropertyOptional({
    description: '활성 상태 여부. false로 설정 시 인증 검사 자체가 거부됩니다.',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
