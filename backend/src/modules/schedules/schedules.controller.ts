import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PreviewExpressionDto } from './dto/preview-expression.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Schedules')
@ApiBearerAuth('access-token')
@Controller('schedules')
@UseGuards(RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({
    summary: '스케줄 목록 조회',
    description:
      '현재 워크스페이스의 스케줄 목록을 페이지네이션하여 반환합니다. 검색어(search)로 트리거 이름을 부분 일치 검색할 수 있습니다.',
  })
  @ApiOkResponse({
    description: '스케줄 목록 (페이지네이션)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object' } },
            totalItems: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.schedulesService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '스케줄 단건 조회',
    description:
      '워크스페이스 내의 스케줄 상세 정보를 트리거 및 워크플로우 정보와 함께 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID', format: 'uuid' })
  @ApiOkResponse({
    description: '스케줄 상세',
    schema: {
      type: 'object',
      properties: { data: { type: 'object' } },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.schedulesService.findById(id, workspaceId);
  }

  @Get(':id/preview')
  @ApiOperation({
    summary: '스케줄 다음 실행 시각 미리보기',
    description:
      '등록된 스케줄의 cron·타임존을 기반으로 다음 실행 예정 시각을 반환합니다 (기본 5개, 최대 20개).',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID', format: 'uuid' })
  @ApiQuery({
    name: 'count',
    required: false,
    description: '반환할 실행 시각 개수 (1~20, 기본 5)',
    example: 5,
  })
  @ApiOkResponse({
    description: '다음 실행 예정 시각 목록 (ISO 8601)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            nextRuns: {
              type: 'array',
              items: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 cron 식' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async getPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query('count') count?: string,
  ) {
    return this.schedulesService.getPreview(
      id,
      workspaceId,
      count ? parseInt(count, 10) : 5,
    );
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Cron 식 미리보기',
    description:
      '임의의 cron 식과 타임존을 받아 다음 실행 시각을 계산합니다. 스케줄 생성 전 UI에서 검증 용도로 사용합니다.',
  })
  @ApiOkResponse({
    description: '다음 실행 예정 시각 목록 (ISO 8601)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            nextRuns: {
              type: 'array',
              items: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 cron 식' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  previewExpression(@Body() dto: PreviewExpressionDto) {
    return this.schedulesService.getPreviewFromExpression(
      dto.cronExpression,
      dto.timezone,
      dto.count,
    );
  }

  @Post()
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '스케줄 생성',
    description:
      '새 스케줄을 생성하고 연결된 schedule 타입 트리거를 자동 생성합니다. 활성 상태일 경우 BullMQ 반복 작업이 즉시 등록됩니다.',
  })
  @ApiCreatedResponse({
    description: '생성된 스케줄 정보',
    schema: {
      type: 'object',
      properties: { data: { type: 'object' } },
    },
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 유효하지 않은 cron 식',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(workspaceId, dto);
  }

  @Post(':id/run-now')
  @Roles('editor')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '스케줄 즉시 실행',
    description:
      '스케줄에 연결된 워크플로우를 즉시 한 번 실행합니다. 스케줄 자체의 다음 실행 주기는 변경되지 않습니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID', format: 'uuid' })
  @ApiOkResponse({
    description: '실행 요청 접수 (생성된 실행 ID 반환)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            executionId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: '스케줄에 연결된 워크플로우가 없음',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async runNow(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.runNow(id, workspaceId, user.sub);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '스케줄 수정',
    description:
      '스케줄의 이름·cron·타임존·활성화 상태·파라미터 값을 수정합니다. cron이나 타임존 변경 시 nextRunAt이 재계산되고 BullMQ 작업이 재등록됩니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID', format: 'uuid' })
  @ApiOkResponse({
    description: '수정된 스케줄 정보',
    schema: {
      type: 'object',
      properties: { data: { type: 'object' } },
    },
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 유효하지 않은 cron 식',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @Roles('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '스케줄 삭제',
    description:
      '스케줄과 연결된 트리거·BullMQ 반복 작업을 모두 제거합니다. 과거 실행 이력은 유지됩니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공 (본문 없음)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.schedulesService.remove(id, workspaceId);
  }
}
