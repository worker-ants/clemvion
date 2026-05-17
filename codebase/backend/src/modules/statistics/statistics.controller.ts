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
import {
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { StatisticsService } from './statistics.service';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import {
  ErrorAggregationDto,
  ExecutionPeriodItemDto,
  LlmUsageSummaryDto,
  LlmUsageTimeseriesDto,
  NodeStatDto,
  StatisticsSummaryDto,
  TopWorkflowDto,
} from './dto/responses/statistics-response.dto';
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
  @ApiOkWrappedResponse(StatisticsSummaryDto, { description: '실행 통계 요약' })
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
  @ApiOkWrappedArrayResponse(ExecutionPeriodItemDto, {
    description: '일자별 실행 집계 배열',
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
  @ApiOkWrappedArrayResponse(ErrorAggregationDto, {
    description: '오류 집계 목록',
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
  @ApiOkWrappedArrayResponse(TopWorkflowDto, {
    description: '상위 워크플로우 목록',
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
  @ApiOkWrappedArrayResponse(NodeStatDto, { description: '노드별 실행 집계' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getNodeStats(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getNodeStats(workspaceId, query);
  }

  @Get('llm-usage/summary')
  @ApiOperation({
    summary: 'LLM 토큰 사용량 요약',
    description:
      '선택된 기간·워크플로우 기준으로 프로바이더×모델별 토큰 합계와 추정 비용(USD)을 반환합니다. 비용은 알려진 모델만 계산되며 미등록 모델은 null입니다.',
  })
  @ApiOkWrappedResponse(LlmUsageSummaryDto, { description: 'LLM 사용량 요약' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getLlmUsageSummary(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getLlmUsageSummary(workspaceId, query);
  }

  @Get('llm-usage/timeseries')
  @ApiOperation({
    summary: 'LLM 토큰 사용량 시계열',
    description:
      '선택된 기간 동안 일자×프로바이더별 토큰 합계와 비용을 시계열로 반환합니다.',
  })
  @ApiOkWrappedResponse(LlmUsageTimeseriesDto, {
    description: '일자별 LLM 사용량',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async getLlmUsageTimeseries(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryStatisticsDto,
  ) {
    return this.statisticsService.getLlmUsageTimeseries(workspaceId, query);
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
