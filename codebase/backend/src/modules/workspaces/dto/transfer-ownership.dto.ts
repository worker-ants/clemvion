import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * 워크스페이스 owner 권한을 다른 멤버에게 이양할 때 사용한다.
 * 대상 memberId 는 같은 워크스페이스의 비-owner 멤버여야 하며, 트랜잭션 내에서
 * 두 멤버 role 이 동시에 swap 된다 (대상 → owner, 기존 owner → admin).
 */
export class TransferOwnershipDto {
  @ApiProperty({
    description:
      '새 owner 가 될 WorkspaceMember 의 UUID (현재 워크스페이스 소속)',
    format: 'uuid',
  })
  @IsUUID()
  newOwnerMemberId: string;
}
