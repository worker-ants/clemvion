import { ApiProperty } from '@nestjs/swagger';
import type { QueueGroup } from '../system-status.constants';

export type QueueHealth = 'healthy' | 'degraded' | 'down';

export class QueueCountsDto {
  @ApiProperty({ example: 0, description: '대기 중인 job 수' })
  waiting: number;

  @ApiProperty({ example: 1, description: '처리 중인 job 수' })
  active: number;

  @ApiProperty({ example: 0, description: '재시도 대기(backoff) job 수' })
  delayed: number;

  @ApiProperty({ example: 0, description: '재시도 소진 후 실패한 job 수' })
  failed: number;

  @ApiProperty({ example: 0, description: 'paused 상태 job 수' })
  paused: number;
}

export class QueueStatusDto {
  @ApiProperty({ example: 'background-execution', description: 'BullMQ 큐 이름' })
  name: string;

  @ApiProperty({
    example: 'execution',
    enum: ['execution', 'knowledge-base', 'integration', 'system'],
    description: '모니터링 그룹',
  })
  group: QueueGroup;

  @ApiProperty({ type: QueueCountsDto })
  counts: QueueCountsDto;

  @ApiProperty({ example: 1, description: 'worker concurrency' })
  concurrency: number;

  @ApiProperty({
    example: 0.33,
    description: 'active / concurrency (소수 2자리). concurrency=0 이면 0',
  })
  utilization: number;

  @ApiProperty({ example: false, description: '큐 일시정지 여부' })
  isPaused: boolean;

  @ApiProperty({
    example: 'healthy',
    enum: ['healthy', 'degraded', 'down'],
    description:
      'paused 또는 (waiting>0 & active=0)→down; failed/delayed 임계 초과→degraded; 그 외 healthy',
  })
  health: QueueHealth;
}

export class SystemStatusOverviewDto {
  @ApiProperty({
    example: '2026-06-03T00:00:00.000Z',
    description: '응답 생성 시각 (ISO8601)',
  })
  generatedAt: string;

  @ApiProperty({
    example: 'healthy',
    enum: ['healthy', 'degraded', 'down'],
    description: '큐 health 의 최악값 (down > degraded > healthy)',
  })
  overall: QueueHealth;

  @ApiProperty({ example: 0, description: '전 큐 failed 합산' })
  totalFailed: number;

  @ApiProperty({ type: [QueueStatusDto] })
  queues: QueueStatusDto[];
}
