import { ApiProperty } from '@nestjs/swagger';

/**
 * `POST /api/external/executions/:id/refresh-token` 응답. [Spec EIA §5.5].
 */
export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'iext_ prefixed JWT (단명, default 1h).',
    example: 'iext_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;

  @ApiProperty({
    description: 'ISO 8601 만료 시각.',
    example: '2026-05-21T01:00:00.000Z',
  })
  expiresAt: string;
}
