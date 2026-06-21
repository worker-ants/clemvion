import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { ExecutionSeqAllocator } from './execution-seq-allocator.service';
import { CHANNEL_AUTHORIZER, ChannelAuthorizer } from './channel-authorizer';
import { NotificationsChannelAuthorizer } from './notifications-channel-authorizer';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { ExecutionsModule } from '../executions/executions.module';
import { ExecutionChannelAuthorizer } from '../executions/execution-channel-authorizer';
import { BackgroundRunChannelAuthorizer } from '../executions/background-runs/background-run-channel-authorizer';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { KbChannelAuthorizer } from '../knowledge-base/kb-channel-authorizer';
import { WorkflowsModule } from '../workflows/workflows.module';
import { WorkflowChannelAuthorizer } from '../workflows/workflow-channel-authorizer';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        // jwt.config 의 dev fallback 과 동일 sentinel 로 통일 — production 부팅 가드
        // (assertProductionConfig 의 INSECURE_JWT_SECRETS) 가 차단하는 값이라, DI 초기화
        // 경합 등으로 이 fallback 이 쓰여도 운영에서 예측가능 secret 서명을 막는다.
        secret: configService.get<string>('jwt.secret') ?? 'dev-jwt-secret',
        signOptions: {
          expiresIn: 900,
        },
      }),
    }),
    forwardRef(() => ExecutionEngineModule),
    forwardRef(() => ExecutionsModule),
    // Gateway 가 kb:${documentId} subscribe 시 KnowledgeBaseService.verifyDocumentOwnership 호출 —
    // KB ↔ WS 양방향 의존이라 forwardRef 필요 (KB Module 가 이미 WebsocketModule 를 forwardRef import).
    forwardRef(() => KnowledgeBaseModule),
    // 04 M-6 — Gateway 가 workflow:${workflowId} subscribe 시 WorkflowsService.findById 로
    // workspace 소유 검증. WS ↔ Workflows 잠재적 순환을 피하기 위해 forwardRef (KB 패턴 동형).
    forwardRef(() => WorkflowsModule),
  ],
  providers: [
    WebsocketGateway,
    WebsocketService,
    ExecutionSeqAllocator,
    // refactor 02 M-7 — `notifications:`(무서비스, userId 비교)는 WS-local authorizer.
    NotificationsChannelAuthorizer,
    // refactor 02 M-7 — 채널 authorizer 집계 지점(gateway 가 이 배열을 CHANNEL_AUTHORIZER 로
    // 주입받아 handleSubscribe 가 첫 매칭 authorizer 만 호출 — gateway→도메인 서비스 역참조 제거).
    // 각 authorizer 는 자기 도메인 모듈이 provider 로 소유·export 한다(execution/background:run=
    // Executions, workflow=Workflows, kb=KnowledgeBase; notifications 만 WS-local). NestJS 11 의
    // `multi: true` 는 이 환경에서 배열로 집계되지 않아(last-write-wins) useFactory 로 명시 집계한다.
    // 신규 채널 = 도메인 모듈에 authorizer + export, 그리고 아래 inject 에 한 줄(gateway·handleSubscribe 무수정).
    {
      provide: CHANNEL_AUTHORIZER,
      useFactory: (...authorizers: ChannelAuthorizer[]): ChannelAuthorizer[] =>
        authorizers,
      inject: [
        ExecutionChannelAuthorizer,
        BackgroundRunChannelAuthorizer,
        WorkflowChannelAuthorizer,
        KbChannelAuthorizer,
        NotificationsChannelAuthorizer,
      ],
    },
  ],
  exports: [WebsocketService],
})
export class WebsocketModule {}
