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

  @ApiProperty({
    description:
      '감사 액션 식별자 (`<resource>.<verb>`). 현재 구현된 값군은 ' +
      '`integration.*` (created·updated·deleted·rotated·scope_changed·reauthorized), ' +
      '`auth_config.*` (create·update·delete·regenerate·reveal), ' +
      '`workspace.transfer_ownership`, `execution.re_run` 이다 ' +
      '(SoT: `AUDIT_ACTIONS` const / spec/5-system/1-auth.md §4.1). ' +
      'DB 는 자유 문자열 컬럼이므로 위 union 밖의 레거시 값(예: `re_run_initiated`)이 ' +
      '과거 row 에 존재할 수 있다 — 클라이언트는 enum 으로 단정하지 말 것.',
    example: 'integration.updated',
  })
  action: string;

  @ApiProperty({ example: 'integration' })
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
