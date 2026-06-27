import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/guards/roles.guard';
import { ApiOkWrappedResponse } from '../../common/swagger';
import { WorkspaceId } from '../../common/decorators';
import { LlmService } from './llm.service';
import { LlmPreviewService } from './llm-preview.service';
import { PreviewModelListDto } from '../model-config/dto/preview-model-list.dto';
import {
  ModelListDto,
  ModelTestConnectionResultDto,
} from '../model-config/dto/responses/model-config-response.dto';

/**
 * ModelConfig 의 LLM-구동 부속 엔드포인트(preview / test / list models).
 *
 * 라우트 프리픽스는 `model-configs` 를 유지(공개 API 무변)하되, 핸들러는 llm
 * 모듈에 둔다 — 이 엔드포인트들은 `LlmService`/`LlmPreviewService` 에 의존하므로
 * `ModelConfigController`(순수 CRUD)에 두면 model-config → llm 역의존이 생겨
 * 모듈 간 forwardRef 순환을 만든다. 핸들러를 llm 모듈로 이전하면 의존은
 * llm → model-config 단방향만 남아 순환이 소멸한다 (refactor 02 C-2 cluster 4).
 *
 * CRUD(생성/조회/수정/삭제/set-default)는 `ModelConfigController` 가 계속 소유한다.
 * API 계약 SoT: spec/2-navigation/6-config.md §3 Model Config API.
 */
@ApiTags('Model Config')
@ApiBearerAuth('access-token')
@Controller('model-configs')
export class LlmModelConfigController {
  constructor(
    private readonly llmService: LlmService,
    private readonly llmPreviewService: LlmPreviewService,
  ) {}

  @Post('preview-models')
  @HttpCode(HttpStatus.OK)
  @Roles('editor')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Provider 모델 목록 미리보기 (chat/embedding)',
    description:
      '저장되지 않은 폼 자격증명으로 Provider 모델 목록을 실시간 조회합니다. apiKey 는 저장되지 않습니다.',
  })
  @ApiBody({ type: PreviewModelListDto })
  @ApiOkWrappedResponse(ModelListDto, { description: '사용 가능한 모델 목록' })
  @ApiBadRequestResponse({
    description: '자격증명 검증 실패 또는 Provider 호출 실패',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async previewModels(@Body() dto: PreviewModelListDto) {
    return this.llmPreviewService.previewModels(dto);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '모델 연결 테스트 (chat/embedding)',
    description: '저장된 자격증명으로 Provider 테스트 호출을 수행합니다.',
  })
  @ApiParam({ name: 'id', description: '모델 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(ModelTestConnectionResultDto, {
    description: '연결 테스트 결과',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 모델 설정을 찾을 수 없음' })
  async listModels(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query('type') type?: 'chat' | 'embedding',
  ) {
    return this.llmService.listModels(id, workspaceId, { type });
  }
}
