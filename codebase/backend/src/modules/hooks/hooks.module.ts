import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { HooksController } from './hooks.controller';
import { HooksService } from './hooks.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { ExternalInteractionModule } from '../external-interaction/external-interaction.module';
import { ExecutionsModule } from '../executions/executions.module';
import { ChatChannelModule } from '../chat-channel/chat-channel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Node]),
    ExecutionEngineModule,
    forwardRef(() => ExternalInteractionModule),
    forwardRef(() => ExecutionsModule),
    // ChatChannelInboundAuthenticator 는 ChatChannelModule 에서 export — secret store
    // 의존성은 그 안에 캡슐화 (Guard 패턴).
    ChatChannelModule,
  ],
  controllers: [HooksController],
  providers: [HooksService],
})
export class HooksModule {}
