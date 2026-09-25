import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import type { WorkspaceRoleName } from '../../../common/constants/workspace-roles';

// 역할 서열(`common/constants/workspace-roles.ts`)에 없는 이름은 여기서 컴파일이 막힌다 — 반대 방향
// (서열에 역할이 늘었는데 여기 빠짐)은 `workspace-roles.spec.ts` 가 막는다. 순서는 OpenAPI enum 표시
// 순서라 서열(오름차순)에서 파생하지 않고 그대로 둔다.
export const WORKSPACE_ROLES = [
  'owner',
  'admin',
  'editor',
  'viewer',
] as const satisfies readonly WorkspaceRoleName[];
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export class AddMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: WORKSPACE_ROLES, example: 'editor' })
  @IsEnum(WORKSPACE_ROLES)
  role: WorkspaceRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: WORKSPACE_ROLES, example: 'admin' })
  @IsEnum(WORKSPACE_ROLES)
  role: WorkspaceRole;
}
