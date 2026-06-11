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
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
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
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { ModelConfigService } from './model-config.service';
import { LlmService } from '../llm/llm.service';
import { LlmPreviewService } from '../llm/llm-preview.service';
import { CreateModelConfigDto } from './dto/create-model-config.dto';
import { UpdateModelConfigDto } from './dto/update-model-config.dto';
import { PreviewLlmModelsDto } from '../llm-config/dto/preview-llm-models.dto';
import {
  ModelConfigDto,
  ModelListDto,
  ModelTestConnectionResultDto,
} from './dto/responses/model-config-response.dto';
import {
  MODEL_CONFIG_KINDS,
  type ModelConfigKind,
} from './entities/model-config.entity';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

function parseKind(kind: string | undefined): ModelConfigKind {
  if (!kind || !MODEL_CONFIG_KINDS.includes(kind as ModelConfigKind)) {
    throw new BadRequestException({
      code: 'MODEL_CONFIG_INVALID',
      message: `kind query is required and must be one of: ${MODEL_CONFIG_KINDS.join(', ')}`,
    });
  }
  return kind as ModelConfigKind;
}

@ApiTags('Model Config')
@ApiBearerAuth('access-token')
@Controller('model-configs')
export class ModelConfigController {
  constructor(
    private readonly modelConfigService: ModelConfigService,
    private readonly llmService: LlmService,
    private readonly llmPreviewService: LlmPreviewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '모델 설정 목록 조회',
    description:
      'kind(chat/embedding/rerank) 별 모델 설정 목록을 페이지네이션으로 조회합니다. API Key 는 마스킹됩니다.',
  })
  @ApiQuery({ name: 'kind', enum: MODEL_CONFIG_KINDS, required: true })
  @ApiOkPaginatedResponse(ModelConfigDto, { description: '모델 설정 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query('kind') kind: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.modelConfigService.findAll(workspaceId, parseKind(kind), query);
  }

  @Get(':id')
  @ApiOperation({ summary: '모델 설정 단건 조회' })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ModelConfigDto, { description: '모델 설정 상세' })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.modelConfigService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: '모델 설정 생성',
    description:
      'kind 별 모델 설정을 등록합니다. API Key 는 암호화 저장됩니다. isDefault=true 시 동일 kind 의 기존 기본은 해제됩니다.',
  })
  @ApiCreatedWrappedResponse(ModelConfigDto, {
    description: '생성된 모델 설정',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateModelConfigDto,
  ) {
    return this.modelConfigService.create(workspaceId, dto.kind, dto);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({ summary: '모델 설정 수정' })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ModelConfigDto, { description: '수정된 모델 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateModelConfigDto,
  ) {
    const result = await this.modelConfigService.update(id, workspaceId, dto);
    this.llmService.clearClientCache(id);
    return result;
  }

  @Patch(':id/set-default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '기본 모델 설정 지정',
    description:
      '해당 설정을 동일 kind 의 워크스페이스 기본으로 지정합니다. 같은 kind 의 기존 기본은 자동 해제됩니다.',
  })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '기본 설정 변경 완료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.modelConfigService.setDefault(id, workspaceId);
  }

  @Post('preview-models')
  @HttpCode(HttpStatus.OK)
  @Roles('editor')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Provider 모델 목록 미리보기 (chat/embedding)',
    description:
      '저장되지 않은 폼 자격증명으로 Provider 모델 목록을 실시간 조회합니다. apiKey 는 저장되지 않습니다.',
  })
  @ApiBody({ type: PreviewLlmModelsDto })
  @ApiOkWrappedResponse(ModelListDto, { description: '사용 가능한 모델 목록' })
  @ApiBadRequestResponse({
    description: '자격증명 검증 실패 또는 Provider 호출 실패',
  })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async previewModels(@Body() dto: PreviewLlmModelsDto) {
    return this.llmPreviewService.previewModels(dto);
  }

  @Post(':id/test')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '모델 연결 테스트 (chat/embedding)',
    description: '저장된 자격증명으로 Provider 테스트 호출을 수행합니다.',
  })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ModelTestConnectionResultDto, {
    description: '연결 테스트 결과',
  })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmService.testConnection(id, workspaceId);
  }

  @Get(':id/models')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Provider 모델 목록 조회 (chat/embedding)',
    description:
      'Provider 에서 사용 가능한 모델 목록을 실시간 조회합니다. `type` 쿼리로 chat/embedding 제한 가능.',
  })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['chat', 'embedding'],
    description: '응답에 포함할 모델 타입 제한',
  })
  @ApiOkWrappedResponse(ModelListDto, { description: '사용 가능한 모델 목록' })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async listModels(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query('type') type?: 'chat' | 'embedding',
  ) {
    return this.llmService.listModels(id, workspaceId, { type });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({ summary: '모델 설정 삭제' })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.modelConfigService.remove(id, workspaceId);
    this.llmService.clearClientCache(id);
  }
}
