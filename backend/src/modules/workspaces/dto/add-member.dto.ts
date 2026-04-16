import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';

export const WORKSPACE_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const;
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
