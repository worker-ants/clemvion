import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ format: 'email' })
  email: string;
}

/** 감사 로그 아이템 */
export class AuditLogDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ type: () => AuditLogUserDto, nullable: true })
  user?: AuditLogUserDto | null;

  @ApiProperty({ example: 'workflow.update' })
  action: string;

  @ApiProperty({ example: 'workflow' })
  resourceType: string;

  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true, example: '127.0.0.1' })
  ipAddress?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
