import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('node-stats')
  async getNodeStats(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getNodeStats(workspaceId, query);
  }

  @Get('export')
  async exportData(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const exportFormat = format === 'csv' ? 'csv' : 'json';
    const result = await this.statisticsService.exportData(
      workspaceId,
      query,
      exportFormat,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }
}
