import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ApiOkWrappedResponse } from '../../../common/swagger';
import { WorkspaceId } from '../../../common/decorators/workspace.decorator';
import { BackgroundRunsService } from './background-runs.service';
import { QueryBackgroundRunDto } from './dto/query-background-run.dto';
import { BackgroundRunResponseDto } from './dto/background-run-response.dto';

@ApiTags('Executions')
@ApiBearerAuth('access-token')
@Controller('executions/:executionId/background-runs')
export class BackgroundRunsController {
  constructor(private readonly backgroundRunsService: BackgroundRunsService) {}

  @Get(':backgroundRunId')
  @ApiOperation({
    summary: 'Background 본문 실행 단건 조회',
    description:
      'Background 노드의 `meta.backgroundRunId` 키로 본문 서브그래프의 실행 상태와 NodeExecution 들을 cursor 페이지네이션으로 조회합니다.',
  })
  @ApiParam({
    name: 'executionId',
    description: '메인 워크플로우 실행 UUID (권한 검증 1차 키)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'backgroundRunId',
    description: 'Background 노드 핸들러가 발급한 UUID v4',
    format: 'uuid',
  })
  @ApiOkWrappedResponse(BackgroundRunResponseDto, {
    description: 'Background 본문 실행 결과',
  })
  @ApiBadRequestResponse({
    description: 'cursor 디코딩 실패 또는 limit 범위 오류',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({
    description: '실행 또는 background run 을 찾을 수 없음 (IDOR 차단 포함)',
  })
  async findOne(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Param('backgroundRunId', ParseUUIDPipe) backgroundRunId: string,
    @Query() query: QueryBackgroundRunDto,
    // `@WorkspaceId()` 가 `X-Workspace-Id` 헤더 우선, JWT 폴백 — 워크스페이스
    // 스위칭 컨텍스트와 일관. `@CurrentUser('workspaceId')` 는 JWT 만 읽어 팀
    // 워크스페이스 호출 시 항상 404 (e2e 회귀에서 발견).
    @WorkspaceId() workspaceId: string,
  ): Promise<BackgroundRunResponseDto> {
    return this.backgroundRunsService.getBackgroundRun(
      executionId,
      backgroundRunId,
      query,
      workspaceId,
    );
  }
}
