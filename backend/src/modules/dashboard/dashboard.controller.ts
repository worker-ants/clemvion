import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { DashboardService } from './dashboard.service';
import {
  DashboardSummaryDto,
  RecentExecutionDto,
  RecentWorkflowDto,
} from './dto/responses/dashboard-response.dto';
import { WorkspaceId } from '../../common/decorators';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: '대시보드 요약 통계',
    description:
      '현재 워크스페이스의 총/활성 워크플로우 수, 최근 7일 실행 건수(전주 대비 증감 포함), 성공률, 평균 실행 시간을 반환합니다.',
  })
  @ApiOkWrappedResponse(DashboardSummaryDto, {
    description: '대시보드 요약 지표',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getSummary(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getSummary(workspaceId);
  }

  @Get('recent-workflows')
  @ApiOperation({
    summary: '최근 갱신 워크플로우',
    description:
      '현재 워크스페이스에서 최근에 갱신된 워크플로우를 최대 5건 반환합니다 (updated_at 내림차순).',
  })
  @ApiOkWrappedArrayResponse(RecentWorkflowDto, {
    description: '최근 갱신 워크플로우 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getRecentWorkflows(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getRecentWorkflows(workspaceId);
  }

  @Get('recent-executions')
  @ApiOperation({
    summary: '최근 실행 이력',
    description:
      '현재 워크스페이스의 최근 실행 이력을 최대 10건 반환합니다 (started_at 내림차순).',
  })
  @ApiOkWrappedArrayResponse(RecentExecutionDto, {
    description: '최근 실행 이력 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getRecentExecutions(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getRecentExecutions(workspaceId);
  }
}
