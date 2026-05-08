import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionNodeLog } from './entities/execution-node-log.entity';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { ExecutionContextService } from './context/execution-context.service';
import { ErrorPolicyHandler } from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { LoopExecutor } from './containers/loop-executor';
import { ForEachExecutor } from './containers/foreach-executor';
import { ParallelExecutor } from './containers/parallel-executor';
import { WebsocketModule } from '../websocket/websocket.module';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { McpModule } from '../mcp/mcp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { BackgroundExecutionProcessor } from './queues/background-execution.processor';
import { ContinuationBusService } from './continuation/continuation-bus.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Execution,
      NodeExecution,
      Node,
      Edge,
      Workflow,
      ExecutionNodeLog,
    ]),
    forwardRef(() => WebsocketModule),
    LlmModule,
    KnowledgeBaseModule,
    IntegrationsModule,
    McpModule,
    NotificationsModule,
    BullModule.registerQueue({ name: BACKGROUND_EXECUTION_QUEUE }),
  ],
  providers: [
    ExecutionEngineService,
    NodeHandlerRegistry,
    NodeComponentRegistry,
    ExecutionContextService,
    ErrorPolicyHandler,
    ExpressionResolverService,
    LoopExecutor,
    ForEachExecutor,
    ParallelExecutor,
    BackgroundExecutionProcessor,
    ContinuationBusService,
  ],
  exports: [
    ExecutionEngineService,
    NodeHandlerRegistry,
    NodeComponentRegistry,
    ExpressionResolverService,
  ],
})
export class ExecutionEngineModule {}
