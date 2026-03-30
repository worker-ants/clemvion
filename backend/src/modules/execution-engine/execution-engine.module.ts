import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from './handlers/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import { ErrorPolicyHandler } from './error/error-policy.handler';
import { LoopExecutor } from './containers/loop-executor';
import { ForEachExecutor } from './containers/foreach-executor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Execution, NodeExecution, Node, Edge, Workflow]),
  ],
  providers: [
    ExecutionEngineService,
    NodeHandlerRegistry,
    ExecutionContextService,
    ErrorPolicyHandler,
    LoopExecutor,
    ForEachExecutor,
  ],
  exports: [ExecutionEngineService, NodeHandlerRegistry],
})
export class ExecutionEngineModule {}
