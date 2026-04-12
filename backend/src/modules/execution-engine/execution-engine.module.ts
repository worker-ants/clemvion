import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { LoopExecutor } from './containers/loop-executor';
import { ForEachExecutor } from './containers/foreach-executor';
import { WebsocketModule } from '../websocket/websocket.module';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Execution, NodeExecution, Node, Edge, Workflow]),
    forwardRef(() => WebsocketModule),
    LlmModule,
    KnowledgeBaseModule,
    IntegrationsModule,
  ],
  providers: [
    ExecutionEngineService,
    NodeHandlerRegistry,
    ExecutionContextService,
    ErrorPolicyHandler,
    ExpressionResolverService,
    LoopExecutor,
    ForEachExecutor,
  ],
  exports: [ExecutionEngineService, NodeHandlerRegistry],
})
export class ExecutionEngineModule {}
