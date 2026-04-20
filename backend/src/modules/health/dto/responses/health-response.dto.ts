import { ApiProperty } from '@nestjs/swagger';

/** 단일 의존성 체크 결과 */
export class HealthCheckItemDto {
  @ApiProperty({ enum: ['healthy', 'unhealthy'] })
  status: string;

  /** 체크 소요 시간(ms) */
  @ApiProperty({ example: 12 })
  latency: number;
}

/** 헬스 체크 응답 DTO */
export class HealthCheckDto {
  @ApiProperty({ enum: ['healthy', 'unhealthy'] })
  status: string;

  @ApiProperty({ example: '1.0.0' })
  version: string;

  /** 기동 후 경과 시간(초) */
  @ApiProperty({ example: 3600 })
  uptime: number;

  /** 의존성별 체크 맵 (예: db, redis) */
  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/HealthCheckItemDto' },
  })
  checks: Record<string, HealthCheckItemDto>;
}
