import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { WorkspaceId } from '../../common/decorators';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getSummary(workspaceId);
  }

  @Get('recent-workflows')
  async getRecentWorkflows(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getRecentWorkflows(workspaceId);
  }

  @Get('recent-executions')
  async getRecentExecutions(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getRecentExecutions(workspaceId);
  }
}
