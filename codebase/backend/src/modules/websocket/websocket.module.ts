import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { ExecutionsModule } from '../executions/executions.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('jwt.secret') ?? 'fallback',
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
  ],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketService],
})
export class WebsocketModule {}
