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

// "인증 없음" 은 AuthConfig row 가 아니라 Trigger.authConfigId IS NULL 로 표현한다
// (spec/1-data-model.md §2.17.3). 따라서 type 에 'none' 을 두지 않는다.
export const AUTH_CONFIG_TYPES = [
  'api_key',
  'bearer_token',
  'basic_auth',
  'hmac',
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
      '인증 타입. api_key=API 키 (X-API-Key 헤더), bearer_token=Bearer 토큰, basic_auth=Basic 인증, hmac=HMAC 서명. "인증 없음" 은 type 이 아니라 Trigger.authConfigId 를 null 로 두어 표현한다.',
    enum: AUTH_CONFIG_TYPES,
    example: 'api_key',
  })
  @IsIn(AUTH_CONFIG_TYPES)
  type: AuthConfigType;

  /**
   * 인증 상세 설정. type에 따라 필수 필드가 달라지며 key/token 값은 생성 시 미지정 시 자동 발급됩니다.
   */
  @ApiPropertyOptional({
    description:
      '인증 상세 설정 (spec/1-data-model.md §2.17.1). api_key: { key 자동발급, headerName?="X-API-Key" }. bearer_token: { token 자동발급 }. basic_auth: { username, password } 사용자 입력 필수. hmac: { secret 자동발급, header?="X-Hub-Signature-256", algorithm?="sha256"|"sha512" }.',
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
