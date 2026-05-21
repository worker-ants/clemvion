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
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedArrayResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { TriggersService } from './triggers.service';
import { CreateTriggerDto } from './dto/create-trigger.dto';
import { UpdateTriggerDto } from './dto/update-trigger.dto';
import { WorkspaceId } from '../../common/decorators';
import { QueryTriggerDto } from './dto/query-trigger.dto';
import {
  TriggerDto,
  TriggerHistoryItemDto,
} from './dto/responses/trigger-response.dto';

@ApiTags('Triggers')
@ApiBearerAuth('access-token')
@Controller('triggers')
export class TriggersController {
  constructor(private readonly triggersService: TriggersService) {}

  @Get()
  @ApiOperation({
    summary: '트리거 목록 조회',
    description:
      '현재 워크스페이스의 트리거 목록을 페이지네이션하여 반환합니다. 타입·활성 상태·이름 검색으로 필터링할 수 있습니다.',
  })
  @ApiOkPaginatedResponse(TriggerDto, {
    description: '트리거 목록 (페이지네이션)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryTriggerDto,
  ) {
    return this.triggersService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '트리거 단건 조회',
    description:
      '워크스페이스 내 트리거 상세 정보를 연결된 워크플로우 정보와 함께 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '트리거 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(TriggerDto, { description: '트리거 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 트리거를 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.triggersService.findOneDetail(id, workspaceId);
  }

  @Post()
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '트리거 생성',
    description:
      'webhook 또는 manual 타입 트리거를 생성합니다. schedule 타입은 Schedules API에서 자동 생성되므로 여기서는 지원하지 않습니다.',
  })
  @ApiCreatedWrappedResponse(TriggerDto, { description: '생성된 트리거 정보' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateTriggerDto,
  ) {
    return this.triggersService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '트리거 수정',
    description:
      '트리거의 이름·활성 상태·설정·엔드포인트 경로·인증 설정을 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '트리거 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(TriggerDto, { description: '수정된 트리거 정보' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 트리거를 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateTriggerDto,
  ) {
    return this.triggersService.update(id, workspaceId, dto);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: '트리거 실행 이력 조회',
    description:
      '해당 트리거로 시작된 최근 실행 10건의 요약(ID/상태/시작 시각/소요 시간)을 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '트리거 UUID', format: 'uuid' })
  @ApiOkWrappedArrayResponse(TriggerHistoryItemDto, {
    description: '최근 실행 이력 (최대 10건)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 트리거를 찾을 수 없음' })
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.triggersService.getHistory(id, workspaceId);
  }

  @Delete(':id')
  @Roles('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '트리거 삭제',
    description: '트리거를 삭제합니다. 과거 실행 이력은 유지됩니다.',
  })
  @ApiParam({ name: 'id', description: '트리거 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공 (본문 없음)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 트리거를 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.triggersService.remove(id, workspaceId);
  }

  // ============================================================
  // External Interaction API — Secret rotation / itk_* revoke
  // [Spec EIA §3.1 EIA-NX-12 / §3.3 EIA-AU-07]
  // ============================================================

  @Post(':id/notification/rotate-secret')
  @Roles('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Outbound notification secret 회전',
    description:
      '새 HMAC secret 을 발급하고 trigger 의 `notification_secret_v2` 컬럼에 저장합니다. 24h grace 동안 NotificationWebhookProcessor 가 두 secret 으로 모두 서명 (v1= 두 개 동봉) — 외부 검증자가 새 secret 으로 미배포 상태여도 기존 secret 으로 통과 가능. grace 종료 후 scheduled job 이 v2 → primary 로 승격. 응답의 `secret` 평문은 1회만 표시되므로 외부 시스템에 즉시 배포해야 합니다.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBadRequestResponse({
    description:
      'NOTIFICATION_NOT_CONFIGURED — trigger 에 notification 설정 없음',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: 'Trigger 없음' })
  async rotateNotificationSecret(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<{ secret: string; rotatedAt: string }> {
    return this.triggersService.rotateNotificationSecret(id, workspaceId);
  }

  @Post(':id/interaction/revoke-token')
  @Roles('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Per-trigger interaction token (itk_*) 재발급',
    description:
      'trigger 의 `config.interaction.tokenStrategy === "per_trigger"` 일 때만 호출 가능. 기존 itk_* 는 즉시 무효화되고 새 itk_* 가 발급됩니다. 응답의 `token` 평문은 1회만 표시되므로 외부 시스템에 즉시 배포해야 합니다.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBadRequestResponse({
    description:
      'NOT_PER_TRIGGER_STRATEGY — interaction.tokenStrategy 가 per_trigger 가 아님',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: 'Trigger 없음' })
  async revokePerTriggerToken(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<{ token: string }> {
    return this.triggersService.revokePerTriggerToken(id, workspaceId);
  }
}
