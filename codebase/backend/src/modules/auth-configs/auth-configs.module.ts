import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthConfig } from './entities/auth-config.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthConfigsController } from './auth-configs.controller';
import { AuthConfigsService } from './auth-configs.service';

@Module({
  imports: [
    // User: reveal 의 비밀번호 재확인. AuditLogsModule: reveal audit 기록.
    TypeOrmModule.forFeature([AuthConfig, Execution, Trigger, User]),
    AuditLogsModule,
  ],
  controllers: [AuthConfigsController],
  providers: [AuthConfigsService],
  exports: [AuthConfigsService],
})
export class AuthConfigsModule {}
