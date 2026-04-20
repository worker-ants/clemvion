import { ApiProperty } from '@nestjs/swagger';

/** 워크스페이스 목록 아이템 (내 역할 포함) */
export class WorkspaceListItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['personal', 'team'] })
  type: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: ['owner', 'admin', 'editor', 'viewer'] })
  role: string;
}

/** 워크스페이스 기본 DTO */
export class WorkspaceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['personal', 'team'] })
  type: string;

  @ApiProperty()
  slug: string;
}

/** 워크스페이스 멤버 */
export class WorkspaceMemberDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['owner', 'admin', 'editor', 'viewer'] })
  role: string;
}

/** 간단한 멤버 ID + role 응답 */
export class MemberRoleDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['owner', 'admin', 'editor', 'viewer'] })
  role: string;
}

/** 워크스페이스 초대 (Admin+ 조회용) */
export class WorkspaceInvitationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'] })
  role: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  @ApiProperty({ format: 'uuid' })
  invitedBy: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

/** 초대 수락 결과 */
export class InvitationAcceptResultDto {
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty()
  workspaceName: string;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'] })
  role: string;
}

/** 단순 ok 응답 */
export class OkResultDto {
  @ApiProperty({ example: true })
  ok: boolean;
}

/** 생성된 초대 정보 */
export class InvitationCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'] })
  role: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
