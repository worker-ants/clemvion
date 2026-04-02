import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Execution, NodeExecution]),
    ExecutionEngineModule,
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
