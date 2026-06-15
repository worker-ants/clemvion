import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowTestDataset } from './entities/workflow-test-dataset.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { WorkflowTestDatasetsService } from './workflow-test-datasets.service';
import { WorkflowTestDatasetsController } from './workflow-test-datasets.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowTestDataset, Workflow])],
  controllers: [WorkflowTestDatasetsController],
  providers: [WorkflowTestDatasetsService],
  exports: [WorkflowTestDatasetsService],
})
export class WorkflowTestDatasetsModule {}
