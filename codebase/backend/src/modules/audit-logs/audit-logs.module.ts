import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import {
  AUDIT_LOG_PRUNER_QUEUE,
  AuditLogPrunerService,
} from './jobs/audit-log-pruner.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({ name: AUDIT_LOG_PRUNER_QUEUE }),
  ],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogPrunerService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
