import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

const INVITATION_ROLES = ['admin', 'editor', 'viewer'] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

export class CreateInvitationDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: INVITATION_ROLES,
    example: 'editor',
    description:
      '초대할 역할. admin 은 Owner 만 지정할 수 있습니다(403). 같은 이메일에 admin 으로 대기 중인 초대를 덮어쓰는 것도 Owner 만 할 수 있습니다(403).',
  })
  @IsEnum(INVITATION_ROLES)
  role: InvitationRole;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: '초대 메일에 포함된 토큰' })
  @IsString()
  @MinLength(16)
  token: string;
}
