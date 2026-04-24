import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AUTH_CONFIG_TYPES } from './create-auth-config.dto';
import type { AuthConfigType } from './create-auth-config.dto';

export class UpdateAuthConfigDto {
  /** 변경할 인증 설정 이름 */
  @ApiPropertyOptional({
    description: '변경할 인증 설정 이름',
    example: 'Webhook Auth (renamed)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 변경할 인증 타입 */
  @ApiPropertyOptional({
    description: '변경할 인증 타입',
    enum: AUTH_CONFIG_TYPES,
  })
  @IsOptional()
  @IsIn(AUTH_CONFIG_TYPES)
  type?: AuthConfigType;

  /** 변경할 인증 상세 설정 */
  @ApiPropertyOptional({
    description: '변경할 인증 상세 설정. 전달된 값으로 기존 설정을 대체합니다.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** 변경할 IP 화이트리스트 */
  @ApiPropertyOptional({
    description: '변경할 IP 화이트리스트 (CIDR 또는 단일 IP)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  /** 활성 상태 여부 */
  @ApiPropertyOptional({
    description: '활성 상태 여부',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
