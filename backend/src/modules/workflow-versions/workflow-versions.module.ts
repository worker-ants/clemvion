import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { WorkflowVersionsController } from './workflow-versions.controller';
import { WorkflowVersionsService } from './workflow-versions.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowVersion])],
  controllers: [WorkflowVersionsController],
  providers: [WorkflowVersionsService],
  exports: [WorkflowVersionsService],
})
export class WorkflowVersionsModule {}
