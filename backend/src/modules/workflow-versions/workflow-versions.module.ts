import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { WorkflowVersionsController } from './workflow-versions.controller';
import { WorkflowVersionsService } from './workflow-versions.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowVersion, Workflow])],
  controllers: [WorkflowVersionsController],
  providers: [WorkflowVersionsService],
  exports: [WorkflowVersionsService],
})
export class WorkflowVersionsModule {}
