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
import { Cafe24Module } from '../../nodes/integration/cafe24/cafe24.module';
import { MakeshopModule } from '../../nodes/integration/makeshop/makeshop.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { BackgroundExecutionProcessor } from './queues/background-execution.processor';
import { CONTINUATION_EXECUTION_QUEUE } from './queues/continuation-execution.queue';
import { ContinuationBusService } from './continuation/continuation-bus.service';
import { ContinuationExecutionProcessor } from './continuation/continuation-execution.processor';
import { ContinuationDlqMonitorService } from './continuation/continuation-dlq-monitor.service';
import {
  CONTINUATION_DLQ_MONITOR_CONFIG,
  loadContinuationDlqMonitorConfig,
} from './continuation/continuation-dlq-monitor.config';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import { GraphTraversalService } from './graph/graph-traversal.service';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';
import { ShutdownStateService } from './shutdown/shutdown-state.service';
import { DEFAULT_GRACE_MS } from './shutdown/shutdown.constants';

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
    Cafe24Module,
    MakeshopModule,
    McpModule,
    NotificationsModule,
    BullModule.registerQueue({ name: BACKGROUND_EXECUTION_QUEUE }),
    // Phase 2 (workflow-resumable-execution) — durable continuation 영속 큐.
    // SoT: spec/5-system/4-execution-engine.md §7.4 / §9.3.
    BullModule.registerQueue({ name: CONTINUATION_EXECUTION_QUEUE }),
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
    // Phase 2 — BullMQ Worker. 옛 ContinuationBusService.registerContinuationHandlers
    // 의 in-process dispatch 대체.
    ContinuationExecutionProcessor,
    // Phase 3.1 — continuation 큐 dead-letter depth / retry backlog 모니터 + 임계 알람.
    ContinuationDlqMonitorService,
    {
      // Phase 3.1 — DLQ 모니터 설정 주입 (review W-9 — env 직접 읽기 대신 factory).
      provide: CONTINUATION_DLQ_MONITOR_CONFIG,
      useFactory: () => loadContinuationDlqMonitorConfig(),
    },
    ConversationThreadService,
    ExecutionEventEmitter,
    GraphTraversalService,
    NodeHandlerDependenciesProvider,
    ShutdownStateService,
    {
      // SoT: spec §11. ENV var name 은 spec 표와 일치.
      // W-2 fix (SUMMARY#W-2): 비숫자 입력 시 NaN 이 graceMs 로 전파되어
      // retryAfterSec=NaN → Retry-After: NaN 헤더 + drain timeout 0 으로
      // 즉시 SERVER_INTERRUPTED 마킹되는 문제 방어.
      // W-18 fix (SUMMARY#W-18): DEFAULT_GRACE_MS 상수로 단일화.
      provide: 'SHUTDOWN_GRACE_MS',
      useFactory: (): number => {
        const parsed = Number(process.env.SIGTERM_GRACE_MS ?? DEFAULT_GRACE_MS);
        return Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_GRACE_MS;
      },
    },
  ],
  exports: [
    ExecutionEngineService,
    NodeHandlerRegistry,
    NodeComponentRegistry,
    ExpressionResolverService,
    ConversationThreadService,
    ShutdownStateService,
  ],
})
export class ExecutionEngineModule {}
