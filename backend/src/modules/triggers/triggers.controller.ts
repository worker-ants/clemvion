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
    return this.triggersService.findById(id, workspaceId);
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
}
