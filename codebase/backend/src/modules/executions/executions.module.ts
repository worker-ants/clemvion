import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionNodeLog } from '../execution-engine/entities/execution-node-log.entity';
import { Node } from '../nodes/entities/node.entity';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { BackgroundRunsController } from './background-runs/background-runs.controller';
import { BackgroundRunsService } from './background-runs/background-runs.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    // ExecutionNodeLog 는 ExecutionEngineModule 에도 등록되어 있다. 본
    // 모듈은 ExecutionsService 가 Repository 를 직접 주입받아 findById 의
    // executionPath 를 채우는 데 사용하므로 별도 forFeature 등록이 필요.
    // (TypeOrmModule.forFeature 는 모듈 단위 Repository token 을 만들어
    //  주므로 이중 등록은 단순 token 공유 — 데이터 정합성 영향 없음).
    // Node 는 re-run 의 inputOverride 검증(loadTriggerParameterSchema)용.
    TypeOrmModule.forFeature([
      Execution,
      NodeExecution,
      ExecutionNodeLog,
      Node,
    ]),
    ExecutionEngineModule,
    // BackgroundRunsService 가 NotificationsService.findByResource() 에
    // 위임 — Notification Repository 를 본 모듈에서 직접 forFeature 등록
    // 하지 않는다 (단일 ownership 유지).
    NotificationsModule,
    // re_run_initiated 감사 로그 기록 (spec §11) — AuditLogsService 주입.
    AuditLogsModule,
  ],
  controllers: [ExecutionsController, BackgroundRunsController],
  providers: [ExecutionsService, BackgroundRunsService],
  // BackgroundRunsService 는 WebsocketGateway 가 채널 subscribe 가드
  // (`verifyBackgroundRunOwnership`) 호출 때문에 export 한다. 다른 사용처
  // 가 없으면 본 export 를 줄이고 NestJS Guard 로 분리할 수 있다 (follow-up).
  exports: [ExecutionsService, BackgroundRunsService],
})
export class ExecutionsModule {}
