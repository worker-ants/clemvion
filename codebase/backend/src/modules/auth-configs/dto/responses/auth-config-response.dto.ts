import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 커스텀 인증 설정 응답 DTO */
export class AuthConfigDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['api_key', 'bearer_token', 'hmac_signature', 'basic_auth'],
    example: 'api_key',
  })
  type: string;

  /** 타입별 세부 설정 (마스킹된 값 포함) */
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  @ApiProperty({ type: [String], example: [] })
  ipWhitelist: string[];

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastUsedAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 사용 통계 호출 아이템 */
export class AuthConfigUsageCallDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  triggerName: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ format: 'date-time' })
  startedAt: string;
}

/** 사용 통계 응답 */
export class AuthConfigUsageDto {
  @ApiProperty({ example: 42 })
  totalCalls: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastUsedAt?: string | null;

  @ApiProperty({ type: [AuthConfigUsageCallDto] })
  recentCalls: AuthConfigUsageCallDto[];
}
