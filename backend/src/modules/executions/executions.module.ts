import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from '../execution-engine/entities/execution-node-log.entity';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';

@Module({
  imports: [
    // ExecutionNodeLog 는 ExecutionEngineModule 에도 등록되어 있다. 본
    // 모듈은 ExecutionsService 가 Repository 를 직접 주입받아 findById 의
    // executionPath 를 채우는 데 사용하므로 별도 forFeature 등록이 필요.
    // (TypeOrmModule.forFeature 는 모듈 단위 Repository token 을 만들어
    //  주므로 이중 등록은 단순 token 공유 — 데이터 정합성 영향 없음).
    TypeOrmModule.forFeature([Execution, NodeExecution, ExecutionNodeLog]),
    ExecutionEngineModule,
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
