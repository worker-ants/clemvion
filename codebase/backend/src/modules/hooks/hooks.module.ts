import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { HooksController } from './hooks.controller';
import { HooksService } from './hooks.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { ExternalInteractionModule } from '../external-interaction/external-interaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trigger, Node]),
    ExecutionEngineModule,
    forwardRef(() => ExternalInteractionModule),
  ],
  controllers: [HooksController],
  providers: [HooksService],
})
export class HooksModule {}
