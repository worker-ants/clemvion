import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthConfig } from './entities/auth-config.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { AuthConfigsController } from './auth-configs.controller';
import { AuthConfigsService } from './auth-configs.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthConfig, Execution, Trigger])],
  controllers: [AuthConfigsController],
  providers: [AuthConfigsService],
  exports: [AuthConfigsService],
})
export class AuthConfigsModule {}
