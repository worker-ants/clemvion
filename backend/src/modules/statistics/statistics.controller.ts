import { Controller, Get, Query } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import { WorkspaceId } from '../../common/decorators';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('summary')
  async getSummary(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getSummary(workspaceId, query);
  }

  @Get('executions')
  async getExecutionsByPeriod(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getExecutionsByPeriod(workspaceId, query);
  }

  @Get('errors')
  async getErrors(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getErrors(workspaceId, query);
  }

  @Get('top-workflows')
  async getTopWorkflows(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getTopWorkflows(workspaceId, query);
  }
}
