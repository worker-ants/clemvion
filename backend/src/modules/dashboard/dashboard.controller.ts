import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
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
  @ApiOkResponse({
    description: '대시보드 요약 지표',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            totalWorkflows: { type: 'integer', example: 12 },
            activeWorkflows: { type: 'integer', example: 7 },
            runs7d: { type: 'integer', example: 138 },
            runs7dPrevious: { type: 'integer', example: 102 },
            runs7dChangePercent: {
              type: 'number',
              nullable: true,
              example: 35.29,
            },
            successRate: { type: 'number', example: 92.75 },
            avgExecutionTime: {
              type: 'integer',
              description: '평균 실행 시간(ms)',
              example: 1820,
            },
          },
        },
      },
    },
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
  @ApiOkResponse({
    description: '최근 갱신 워크플로우 목록',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: '메일 자동화 워크플로우' },
              isActive: { type: 'boolean', example: true },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
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
  @ApiOkResponse({
    description: '최근 실행 이력 목록',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              workflowId: { type: 'string', format: 'uuid' },
              workflowName: { type: 'string', example: '이메일 알림 플로우' },
              status: {
                type: 'string',
                enum: [
                  'pending',
                  'running',
                  'completed',
                  'failed',
                  'cancelled',
                ],
                example: 'completed',
              },
              durationMs: { type: 'integer', nullable: true, example: 1540 },
              startedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getRecentExecutions(@WorkspaceId() workspaceId: string) {
    return this.dashboardService.getRecentExecutions(workspaceId);
  }
}
