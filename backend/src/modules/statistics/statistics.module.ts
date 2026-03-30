import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Execution } from '../executions/entities/execution.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, Execution])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
