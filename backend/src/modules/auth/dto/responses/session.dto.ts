import { ApiProperty } from '@nestjs/swagger';

/** 활성 세션 한 건 (family_id 단위) */
export class SessionDto {
  @ApiProperty({
    description: '세션 식별자 = refresh token family_id',
    format: 'uuid',
  })
  familyId: string;

  @ApiProperty({
    description:
      'UA 에서 파생된 디바이스 라벨 — 예: "Chrome on macOS". 정보가 없으면 null',
    nullable: true,
    example: 'Chrome on macOS',
  })
  deviceLabel: string | null;

  @ApiProperty({
    description: '발급 시점 클라이언트 IP (CF-Connecting-IP 우선)',
    nullable: true,
    example: '203.0.113.7',
  })
  ipAddress: string | null;

  @ApiProperty({
    description: '마지막 refresh 또는 활동 시각',
    nullable: true,
    example: '2026-05-12T03:14:00Z',
  })
  lastUsedAt: string | null;

  @ApiProperty({
    description: '세션 최초 생성 시각',
    example: '2026-05-10T22:00:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'refresh token 만료 시각',
    example: '2026-05-17T22:00:00Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: '이 요청을 보낸 디바이스의 세션이면 true',
    example: false,
  })
  isCurrent: boolean;
}

/** 활성 세션 목록 응답 */
export class SessionListDto {
  @ApiProperty({ type: [SessionDto] })
  data: SessionDto[];
}
