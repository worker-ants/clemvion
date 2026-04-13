import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiProduces,
  ApiQuery,
} from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import { WorkspaceId } from '../../common/decorators';

@ApiTags('Statistics')
@ApiBearerAuth('access-token')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: '실행 통계 요약',
    description:
      '선택된 기간·워크플로우 기준으로 총 실행 건수, 상태별(성공/실패/취소) 건수, 성공률, 평균 실행 시간을 집계하여 반환합니다.',
  })
  @ApiOkResponse({
    description: '실행 통계 요약',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            totalExecutions: { type: 'integer', example: 230 },
            successCount: { type: 'integer', example: 210 },
            failedCount: { type: 'integer', example: 15 },
            cancelledCount: { type: 'integer', example: 5 },
            successRate: { type: 'number', example: 91.3 },
            avgDurationMs: { type: 'integer', example: 1320 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getSummary(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getSummary(workspaceId, query);
  }

  @Get('executions')
  @ApiOperation({
    summary: '기간별 실행 추이',
    description:
      '선택된 기간 동안 일자별 실행 건수를 상태(전체/성공/실패/취소)로 집계하여 시계열 형태로 반환합니다.',
  })
  @ApiOkResponse({
    description: '일자별 실행 집계 배열',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2026-04-10' },
              total: { type: 'integer', example: 32 },
              completed: { type: 'integer', example: 30 },
              failed: { type: 'integer', example: 1 },
              cancelled: { type: 'integer', example: 1 },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getExecutionsByPeriod(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getExecutionsByPeriod(workspaceId, query);
  }

  @Get('errors')
  @ApiOperation({
    summary: '워크플로우별 오류 집계',
    description:
      '선택된 기간 내 실패한 실행을 워크플로우별로 집계합니다. 오류 건수 기준 내림차순, 상위 20건까지 반환합니다.',
  })
  @ApiOkResponse({
    description: '오류 집계 목록',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
              workflowName: { type: 'string', example: '데이터 동기화' },
              errorCount: { type: 'integer', example: 7 },
              lastErrorAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getErrors(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getErrors(workspaceId, query);
  }

  @Get('top-workflows')
  @ApiOperation({
    summary: '상위 워크플로우 통계',
    description:
      '선택된 기간 동안 실행 횟수 기준 상위 10개의 워크플로우와 성공률·평균 실행 시간을 반환합니다.',
  })
  @ApiOkResponse({
    description: '상위 워크플로우 목록',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
              workflowName: { type: 'string', example: 'Slack 알림 플로우' },
              executionCount: { type: 'integer', example: 85 },
              successRate: { type: 'number', example: 97.65 },
              avgDurationMs: { type: 'integer', example: 980 },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getTopWorkflows(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getTopWorkflows(workspaceId, query);
  }

  @Get('node-stats')
  @ApiOperation({
    summary: '노드별 실행 통계',
    description:
      '특정 워크플로우(workflowId 필수)의 노드별 실행 건수, 평균 실행 시간(ms), 오류율(%)을 반환합니다. workflowId 미지정 시 빈 배열을 반환합니다.',
  })
  @ApiOkResponse({
    description: '노드별 실행 집계',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeId: { type: 'string', format: 'uuid' },
              nodeLabel: { type: 'string', example: 'HTTP 요청' },
              nodeType: { type: 'string', example: 'http-request' },
              executionCount: { type: 'integer', example: 120 },
              avgDurationMs: { type: 'integer', example: 420 },
              errorRate: { type: 'number', example: 1.67 },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getNodeStats(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getNodeStats(workspaceId, query);
  }

  @Get('export')
  @ApiOperation({
    summary: '통계 데이터 내보내기',
    description:
      '선택된 기간의 요약/시계열/오류/상위 워크플로우 통계를 한 번에 파일로 내려받습니다. format=csv 는 시계열 CSV, 이 외 기본값은 종합 JSON 을 반환하며 Content-Disposition 헤더로 첨부 파일로 전달됩니다.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    description: '내보내기 포맷 (기본값: json). csv 는 일자별 실행 집계만 포함',
    example: 'csv',
  })
  @ApiProduces('application/json', 'text/csv')
  @ApiOkResponse({
    description:
      '통계 데이터 파일. Content-Disposition 헤더로 첨부(attachment) 다운로드',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'object' },
            executions: { type: 'array', items: { type: 'object' } },
            errors: { type: 'array', items: { type: 'object' } },
            topWorkflows: { type: 'array', items: { type: 'object' } },
          },
        },
      },
      'text/csv': {
        schema: {
          type: 'string',
          example:
            'date,total,completed,failed,cancelled\n2026-04-10,32,30,1,1',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
