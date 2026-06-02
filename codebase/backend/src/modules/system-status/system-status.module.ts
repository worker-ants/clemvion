import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SystemStatusController } from './system-status.controller';
import { SystemStatusService, QueueHandle } from './system-status.service';
import {
  MONITORED_QUEUES,
  SYSTEM_STATUS_QUEUE_NAMES,
  MONITORED_QUEUE_HANDLES,
} from './system-status.constants';

/**
 * 시스템 상태 모듈 — 12개 BullMQ 큐를 읽기 전용으로 모니터링한다.
 *
 * 각 큐를 `sharedConnection: true` 로 등록해 모니터링 전용 Queue 클라이언트가
 * 큐마다 새 Redis 연결을 만들지 않고 BullMQ root 연결 하나를 공유하도록 한다
 * (Redis 연결 수 통합 정책 — ai-review INFO-12 맥락).
 */
@Module({
  imports: [
    BullModule.registerQueue(
      ...SYSTEM_STATUS_QUEUE_NAMES.map((name) => ({
        name,
        sharedConnection: true,
      })),
    ),
  ],
  controllers: [SystemStatusController],
  providers: [
    SystemStatusService,
    {
      provide: MONITORED_QUEUE_HANDLES,
      useFactory: (...queues: Queue[]): QueueHandle[] =>
        MONITORED_QUEUES.map((meta, index) => ({
          meta,
          queue: queues[index],
        })),
      inject: SYSTEM_STATUS_QUEUE_NAMES.map((name) => getQueueToken(name)),
    },
  ],
})
export class SystemStatusModule {}
