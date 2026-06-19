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
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import { FormInteractionService } from './form-interaction.service';
import { ButtonInteractionService } from './button-interaction.service';
import { RetryTurnService } from './retry-turn.service';
import { ENGINE_DRIVER } from './engine-driver.interface';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { WORKFLOW_EXECUTOR } from '../../nodes/core/workflow-executor.interface';
import { ExecutionContextService } from './context/execution-context.service';
import { ErrorPolicyHandler } from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { LoopExecutor } from './containers/loop-executor';
import { ForEachExecutor } from './containers/foreach-executor';
import { ParallelExecutor } from './containers/parallel-executor';
import { WebsocketModule } from '../websocket/websocket.module';
import { LlmModule } from '../llm/llm.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AgentMemoryModule } from '../agent-memory/agent-memory.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { McpModule } from '../mcp/mcp.module';
import { Cafe24Module } from '../../nodes/integration/cafe24/cafe24.module';
import { MakeshopModule } from '../../nodes/integration/makeshop/makeshop.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { BackgroundExecutionProcessor } from './queues/background-execution.processor';
import { EXECUTION_RUN_QUEUE } from './queues/execution-run.queue';
import { ExecutionRunProcessor } from './queues/execution-run.processor';
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
import { NodeBootstrapService } from './node-bootstrap.service';
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
    AgentMemoryModule,
    IntegrationsModule,
    Cafe24Module,
    MakeshopModule,
    McpModule,
    NotificationsModule,
    BullModule.registerQueue({ name: BACKGROUND_EXECUTION_QUEUE }),
    // Phase 2 (workflow-resumable-execution) — durable continuation 영속 큐.
    // SoT: spec/5-system/4-execution-engine.md §7.4 / §9.3.
    BullModule.registerQueue({ name: CONTINUATION_EXECUTION_QUEUE }),
    // PR1 (exec-intake-queue) — execution intake 큐. execute() 의 fire-and-forget
    // in-process 호출 대체, work-stealing 분산. SoT: §4.1–4.3 / §9.3.
    BullModule.registerQueue({ name: EXECUTION_RUN_QUEUE }),
  ],
  providers: [
    ExecutionEngineService,
    // C-1 step2 — AI 멀티턴 생명주기 추출 서비스. 엔진과 forwardRef 순환 DI.
    AiTurnOrchestrator,
    // C-1 step3 — Form/Button blocking-interaction 추출 서비스. 엔진과 forwardRef
    // 순환 DI (둘 다 ENGINE_DRIVER=엔진 을 주입받고, 엔진은 위임을 위해 주입받음).
    FormInteractionService,
    ButtonInteractionService,
    // C-1 step4 — retry_last_turn 생명주기 추출 서비스. ENGINE_DRIVER(=엔진)을
    // 주입받는다. 후속 ④ 에서 engine→Retry 역방향 주입을 제거해 단방향
    // (Retry→engine)으로 정리 — 외부 진입점은 본 서비스를 직접 호출(아래 exports).
    RetryTurnService,
    {
      // orchestrator + interaction + retry 서비스가 주입받는 EngineDriver
      // capability 를 canonical 엔진에 바인딩.
      provide: ENGINE_DRIVER,
      useExisting: ExecutionEngineService,
    },
    NodeHandlerRegistry,
    NodeComponentRegistry,
    ExecutionContextService,
    ErrorPolicyHandler,
    ExpressionResolverService,
    LoopExecutor,
    ForEachExecutor,
    ParallelExecutor,
    BackgroundExecutionProcessor,
    // PR1 — execution intake worker. execute() 발행 job 을 work-stealing 소비.
    ExecutionRunProcessor,
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
    // C-1 step1 (m-3): 노드 핸들러 bootstrap 을 god-class 에서 분리한 lifecycle 서비스.
    NodeBootstrapService,
    {
      // bootstrap 이 의존하는 WorkflowExecutor capability 를 canonical executor
      // (엔진) 에 바인딩. NodeBootstrapService 가 본 토큰을 주입받아 옛 god-class 의
      // `handlerDeps.build(this)` 자기참조를 DI 경계로 대체한다.
      provide: WORKFLOW_EXECUTOR,
      useExisting: ExecutionEngineService,
    },
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
    // C-1 후속 ④ — retryLastTurn/applyRetryLastTurn 외부 진입점(websocket.gateway·
    // continuation processor)이 엔진 thin delegator 대신 RetryTurnService 를 직접
    // 호출하도록 export (engine→Retry 순환 DI 제거 — strangler-fig 최종 정리).
    RetryTurnService,
    NodeHandlerRegistry,
    NodeComponentRegistry,
    ExpressionResolverService,
    ConversationThreadService,
    ShutdownStateService,
  ],
})
export class ExecutionEngineModule {}
