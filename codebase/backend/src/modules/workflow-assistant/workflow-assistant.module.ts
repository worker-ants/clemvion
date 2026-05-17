import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowAssistantSession } from './entities/workflow-assistant-session.entity';
import { WorkflowAssistantMessage } from './entities/workflow-assistant-message.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Integration } from '../integrations/entities/integration.entity';
import { KnowledgeBase } from '../knowledge-base/entities/knowledge-base.entity';
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { LlmModule } from '../llm/llm.module';
import { LlmConfigModule } from '../llm-config/llm-config.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { WorkflowAssistantController } from './workflow-assistant.controller';
import { WorkflowAssistantSessionService } from './workflow-assistant-session.service';
import { WorkflowAssistantStreamService } from './workflow-assistant-stream.service';
import { ExploreToolsService } from './tools/explore-tools.service';
import { CandidateLookupService } from './tools/candidate-lookup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowAssistantSession,
      WorkflowAssistantMessage,
      Workflow,
      Node,
      Edge,
      Integration,
      KnowledgeBase,
      Execution,
      NodeExecution,
    ]),
    LlmModule,
    LlmConfigModule,
    // ED-AI-39 candidate picker: 워크스페이스의 Integration / KnowledgeBase
    // 후보를 실어주기 위해 주입. LlmConfigModule 은 이미 위에 있음.
    IntegrationsModule,
    KnowledgeBaseModule,
    // ExecutionEngineModule exports NodeComponentRegistry, which we need for
    // node catalog + schema lookups in the system prompt & explore tools.
    ExecutionEngineModule,
  ],
  controllers: [WorkflowAssistantController],
  providers: [
    WorkflowAssistantSessionService,
    WorkflowAssistantStreamService,
    ExploreToolsService,
    CandidateLookupService,
  ],
  exports: [WorkflowAssistantSessionService],
})
export class WorkflowAssistantModule {}
