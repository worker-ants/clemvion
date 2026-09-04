import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ type: () => AuditLogUserDto, nullable: true })
  user: AuditLogUserDto | null;

  @ApiProperty({
    description:
      '감사 액션 식별자 (`<resource>.<verb>`). 구현된 값의 **단일 진실은 ' +
      '`audit-logs/audit-action.const.ts` 의 `AUDIT_ACTIONS`** 이다 — 여기에 목록을 ' +
      '복제하면 액션이 늘 때마다 낡는다(실제로 `workspace.*`·`member.*`·`user.*` 추가 ' +
      '시점에 이미 낡아 있었고, 2026-08-01 `workflow.*`/`trigger.*`/`schedule.*`/' +
      '`model_config.*` 13개 추가로 다시 어긋났다). 리소스군은 integration · auth_config · ' +
      'workspace · member · execution · user · workflow · trigger · schedule · model_config. ' +
      '(spec/5-system/1-auth.md §4.1) ' +
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

  @ApiProperty({ nullable: true, example: '127.0.0.1' })
  ipAddress: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}
