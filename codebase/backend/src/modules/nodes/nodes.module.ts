import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Node } from './entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Node, Workflow]),
    // ExecutionEngineModule 은 NodeComponentRegistry(`GET /nodes/definitions`) 때문에
    // import — 순환 아님(ExecutionEngineModule 은 NodesModule 을 import 하지 않으며,
    // NodesModule 을 import 하는 건 AppModule 뿐). 따라서 forwardRef 불필요.
    ExecutionEngineModule,
  ],
  controllers: [NodesController],
  providers: [NodesService],
  exports: [NodesService],
})
export class NodesModule {}
