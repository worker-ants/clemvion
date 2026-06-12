import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { WorkflowVersionsModule } from '../workflow-versions/workflow-versions.module';
import { ModelConfigModule } from '../model-config/model-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, Node, Edge]),
    // #570(M-6 WS IDOR)이 WebsocketModule → WorkflowsModule 엣지를 추가하면서
    // WorkflowsModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule
    // 순환이 닫혔다. plain import 는 부팅 시 undefined 로 평가되므로 forwardRef 로 감싼다.
    forwardRef(() => ExecutionEngineModule),
    WorkflowVersionsModule,
    ModelConfigModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
