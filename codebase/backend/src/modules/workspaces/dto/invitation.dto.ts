import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

const INVITATION_ROLES = ['admin', 'editor', 'viewer'] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

export class CreateInvitationDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: INVITATION_ROLES, example: 'editor' })
  @IsEnum(INVITATION_ROLES)
  role: InvitationRole;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: '초대 메일에 포함된 토큰' })
  @IsString()
  @MinLength(16)
  token: string;
}
