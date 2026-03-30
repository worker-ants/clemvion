import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Execution } from '../executions/entities/execution.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, Execution])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
