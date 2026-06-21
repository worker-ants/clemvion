import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from './entities/workflow.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Execution } from '../executions/entities/execution.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { WorkflowVersionsModule } from '../workflow-versions/workflow-versions.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { WorkflowChannelAuthorizer } from './workflow-channel-authorizer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, Node, Edge, Execution]),
    // #570(M-6 WS IDOR)이 WebsocketModule → WorkflowsModule 엣지를 추가하면서
    // WorkflowsModule → ExecutionEngineModule → WebsocketModule → WorkflowsModule
    // 순환이 닫혔다. plain import 는 부팅 시 undefined 로 평가되므로 forwardRef 로 감싼다.
    forwardRef(() => ExecutionEngineModule),
    WorkflowVersionsModule,
    ModelConfigModule,
  ],
  controllers: [WorkflowsController],
  providers: [
    WorkflowsService,
    // refactor 02 M-7 — `workflow:` 채널 authorizer 를 본 모듈이 소유. 클래스를 export →
    // WS 모듈의 CHANNEL_AUTHORIZER 집계 factory 가 주입(gateway→WorkflowsService 역참조 제거).
    WorkflowChannelAuthorizer,
  ],
  exports: [WorkflowsService, WorkflowChannelAuthorizer],
})
export class WorkflowsModule {}
