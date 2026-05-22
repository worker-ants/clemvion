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
import { SecretStoreModule } from '../secret-store/secret-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Node]),
    ExecutionEngineModule,
    forwardRef(() => ExternalInteractionModule),
    forwardRef(() => ExecutionsModule),
    ChatChannelModule,
    // SUMMARY#19: ChatChannelModule 은 SecretStoreModule 을 re-export 하지 않으므로
    // HooksService 가 SecretResolverService 를 직접 inject 하려면 직접 import 필요.
    SecretStoreModule,
  ],
  controllers: [HooksController],
  providers: [HooksService],
})
export class HooksModule {}
