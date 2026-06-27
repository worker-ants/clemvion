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
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { ModelConfigService } from './model-config.service';
import { CreateModelConfigDto } from './dto/create-model-config.dto';
import { UpdateModelConfigDto } from './dto/update-model-config.dto';
import { ModelConfigDto } from './dto/responses/model-config-response.dto';
import {
  MODEL_CONFIG_KINDS,
  type ModelConfigKind,
} from './entities/model-config.entity';
import { WorkspaceId } from '../../common/decorators';
import { ListModelConfigsQueryDto } from './dto/list-model-configs-query.dto';

function parseKind(kind: string | undefined): ModelConfigKind {
  if (!kind || !MODEL_CONFIG_KINDS.includes(kind as ModelConfigKind)) {
    throw new BadRequestException({
      code: 'MODEL_CONFIG_INVALID',
      message: `kind query is required and must be one of: ${MODEL_CONFIG_KINDS.join(', ')}`,
    });
  }
  return kind as ModelConfigKind;
}

/**
 * ModelConfig CRUD (생성·조회·수정·삭제·set-default).
 *
 * LLM-구동 부속 엔드포인트(preview-models / :id/test / :id/models)는 같은
 * `model-configs` 라우트를 쓰되 `LlmModelConfigController`(llm 모듈)가 소유한다
 * — 모듈 간 forwardRef 순환(model-config ↔ llm) 제거를 위해서다
 * (refactor 02 C-2 cluster 4). update/remove 시 LLM 클라이언트 캐시 무효화는
 * `ModelConfigService` 가 옵저버 통지로 처리하므로(LlmService 가 구독), 본
 * 컨트롤러는 llm 모듈에 직접 의존하지 않는다.
 */
@ApiTags('Model Config')
@ApiBearerAuth('access-token')
@Controller('model-configs')
export class ModelConfigController {
  constructor(private readonly modelConfigService: ModelConfigService) {}

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
    @Query() query: ListModelConfigsQueryDto,
  ) {
    return this.modelConfigService.findAll(
      workspaceId,
      parseKind(query.kind),
      query,
    );
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
    return this.modelConfigService.update(id, workspaceId, dto);
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
  }
}
