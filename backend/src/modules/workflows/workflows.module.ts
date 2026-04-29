import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { WorkflowVersionsModule } from '../workflow-versions/workflow-versions.module';
import { LlmConfigModule } from '../llm-config/llm-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, Node, Edge]),
    ExecutionEngineModule,
    WorkflowVersionsModule,
    LlmConfigModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
