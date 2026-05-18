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
    description:
      '마지막 활동 IP. 발급 이후 refresh 가 한 번도 없었다면 발급 시점 IP. (CF-Connecting-IP 우선 추출)',
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

/**
 * 활성 세션 목록 응답.
 *
 * 응답 shape 은 외부 wrapping 까지 합쳐 `{ data: { items: SessionDto[] } }`.
 * 옛 필드명 `data` → `items` 로 개명 (webauthn credential 목록·login history 와
 * 일관된 `items` key 사용). 호출자는 `res.data.data.items` 로 접근.
 */
export class SessionListDto {
  @ApiProperty({ type: [SessionDto] })
  items: SessionDto[];
}
