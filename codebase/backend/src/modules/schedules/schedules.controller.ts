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
} from '@nestjs/common';
import { Roles } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiAcceptedWrappedResponse,
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PreviewExpressionDto } from './dto/preview-expression.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import {
  CronPreviewDto,
  ScheduleDto,
  ScheduleRunNowResultDto,
} from './dto/responses/schedule-response.dto';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import type { Schedule } from './entities/schedule.entity';

@ApiTags('Schedules')
@ApiBearerAuth('access-token')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  /**
   * 응답 경계에서 조인된 `trigger` 를 **참조 수준으로** 좁힌다.
   *
   * 서비스의 조회는 `leftJoinAndSelect('s.trigger', 't')` / `relations: ['trigger']` 로
   * **Trigger 엔티티 전체**를 싣는다. 거기에는 `notificationSecretV2`(평문 서명 secret,
   * 24h rotation grace 동안 non-null) 와 `chatChannelTokenV2`(secret store ref) 가 있다 —
   * `TriggersService.sanitizeForResponse` 가 트리거 자신의 응답에서 빼는 바로 그 컬럼들이
   * **조인을 타고** 여기로 새어 나왔다. §5.4 응답-계약 스윕이 `trigger` 를 "선언되지 않은
   * 키" 로 검출해 드러났다.
   *
   * **서비스가 아니라 컨트롤러에서 좁히는 이유**: `findById`/`create`/`update` 는 응답
   * 전용이 아니라 내부 로직도 소비한다(예: `update` 가 `trigger.isActive` 를 만진다).
   * 서비스 반환 타입을 좁히면 그 경로가 깨진다 — 좁히기는 **나가는 자리**에서 한다.
   */
  private toResponse<T extends Schedule>(schedule: T) {
    const t = schedule.trigger;
    const { trigger: _drop, ...rest } = schedule;
    // `trigger` 는 상시 존재한다 (NOT NULL 1:1 + 네 경로가 전부 채움) — 그래서 분기 없이
    // 항상 싣는다. 관계가 로드되지 않은 채 여기 오면 `t.id` 에서 즉시 터지는데, 그것이
    // 조용히 키를 빠뜨리는 것보다 낫다 (§5.4 기본형 선언과 일치).
    //
    // 반면 `trigger.workflow` 는 **키 생략형**이다 — **생성 응답에만** 없다
    // (방금 저장한 트리거라 관계 미로드). 조회·수정은 `findById` 를 타므로 채워진다.
    return {
      ...rest,
      trigger: {
        id: t.id,
        name: t.name,
        workflowId: t.workflowId,
        ...(t.workflow ? { workflow: { name: t.workflow.name } } : {}),
      },
    };
  }

  @Get()
  @ApiOperation({
    summary: '스케줄 목록 조회',
    description:
      '현재 워크스페이스의 스케줄 목록을 페이지네이션하여 반환합니다. 검색어(search)로 트리거 이름을 부분 일치 검색할 수 있습니다.',
  })
  @ApiOkPaginatedResponse(ScheduleDto, {
    description: '스케줄 목록 (페이지네이션)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryScheduleDto,
  ) {
    const page = await this.schedulesService.findAll(workspaceId, query);
    return { ...page, data: page.data.map((s) => this.toResponse(s)) };
  }

  @Get(':id')
  @ApiOperation({
    summary: '스케줄 단건 조회',
    description:
      '워크스페이스 내의 스케줄 상세 정보를 트리거 및 워크플로우 정보와 함께 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ScheduleDto, { description: '스케줄 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.toResponse(
      await this.schedulesService.findById(id, workspaceId),
    );
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
  @ApiOkWrappedResponse(CronPreviewDto, {
    description: '다음 실행 예정 시각 목록 (ISO 8601)',
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 cron 식' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })
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
  @ApiOkWrappedResponse(CronPreviewDto, {
    description: '다음 실행 예정 시각 목록 (ISO 8601)',
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
  @ApiCreatedWrappedResponse(ScheduleDto, { description: '생성된 스케줄 정보' })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 유효하지 않은 cron 식',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.toResponse(
      await this.schedulesService.create(workspaceId, dto, userId),
    );
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
  @ApiAcceptedWrappedResponse(ScheduleRunNowResultDto, {
    description: '실행 요청 접수 (생성된 실행 ID 반환)',
  })
  @ApiBadRequestResponse({
    description: '스케줄에 연결된 워크플로우가 없음',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
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
  @ApiOkWrappedResponse(ScheduleDto, { description: '수정된 스케줄 정보' })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 유효하지 않은 cron 식',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.toResponse(
      await this.schedulesService.update(id, workspaceId, dto, userId),
    );
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
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.schedulesService.remove(id, workspaceId, userId);
  }
}
