import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { HooksController } from './hooks.controller';
import { HooksService } from './hooks.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';

@Module({
  imports: [TypeOrmModule.forFeature([Trigger]), ExecutionEngineModule],
  controllers: [HooksController],
  providers: [HooksService],
})
export class HooksModule {}
