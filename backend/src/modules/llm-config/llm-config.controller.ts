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
import { LlmConfigService } from './llm-config.service';
import { LlmService } from '../llm/llm.service';
import { LlmPreviewService } from '../llm/llm-preview.service';
import { CreateLlmConfigDto } from './dto/create-llm-config.dto';
import { UpdateLlmConfigDto } from './dto/update-llm-config.dto';
import { PreviewLlmModelsDto } from './dto/preview-llm-models.dto';
import {
  LlmConfigDto,
  LlmModelListDto,
  LlmTestConnectionResultDto,
} from './dto/responses/llm-config-response.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('LLM Config')
@ApiBearerAuth('access-token')
@Controller('llm-configs')
export class LlmConfigController {
  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly llmService: LlmService,
    private readonly llmPreviewService: LlmPreviewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'LLM 설정 목록 조회',
    description:
      '워크스페이스에 등록된 LLM Provider 설정 목록을 페이지네이션으로 조회합니다. API Key는 마스킹되어 반환됩니다.',
  })
  @ApiOkPaginatedResponse(LlmConfigDto, {
    description: 'LLM 설정 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.llmConfigService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'LLM 설정 단건 조회',
    description: 'ID로 LLM 설정 상세를 조회합니다. API Key는 마스킹됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(LlmConfigDto, { description: 'LLM 설정 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmConfigService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: 'LLM 설정 생성',
    description:
      '새 LLM Provider 설정을 등록합니다. API Key는 암호화되어 저장됩니다. isDefault=true 시 기존 기본 설정은 해제됩니다.',
  })
  @ApiCreatedWrappedResponse(LlmConfigDto, { description: '생성된 LLM 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateLlmConfigDto,
  ) {
    return this.llmConfigService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: 'LLM 설정 수정',
    description:
      'LLM 설정을 부분 수정합니다. API Key 미전달 시 기존 키가 유지되며, 수정 후 내부 클라이언트 캐시가 무효화됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(LlmConfigDto, { description: '수정된 LLM 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateLlmConfigDto,
  ) {
    const result = await this.llmConfigService.update(id, workspaceId, dto);
    this.llmService.clearClientCache(id);
    return result;
  }

  @Patch(':id/set-default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '기본 LLM 설정 지정',
    description:
      '해당 설정을 워크스페이스 기본 LLM으로 지정합니다. 기존 기본 설정은 자동으로 해제됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '기본 설정 변경 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.llmConfigService.setDefault(id, workspaceId);
  }

  @Post('preview-models')
  @HttpCode(HttpStatus.OK)
  @Roles('editor')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Provider 모델 목록 미리보기',
    description:
      '저장되지 않은 폼 자격증명(provider/apiKey/baseUrl)으로 Provider 모델 목록을 실시간 조회합니다. apiKey는 저장되지 않으며 요청 범위에서만 사용됩니다.',
  })
  @ApiBody({ type: PreviewLlmModelsDto })
  @ApiOkWrappedResponse(LlmModelListDto, {
    description: '사용 가능한 모델 목록',
  })
  @ApiBadRequestResponse({
    description: '자격증명 누락/검증 실패 또는 Provider 호출 실패',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async previewModels(@Body() dto: PreviewLlmModelsDto) {
    return this.llmPreviewService.previewModels(dto);
  }

  @Post(':id/test')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'LLM 연결 테스트',
    description:
      '저장된 API Key로 Provider에 테스트 호출을 수행합니다. 응답 시간, 사용 가능 여부를 확인합니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(LlmTestConnectionResultDto, {
    description: '연결 테스트 결과',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmService.testConnection(id, workspaceId);
  }

  @Get(':id/models')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Provider 모델 목록 조회',
    description:
      'Provider에서 사용 가능한 모델 목록을 실시간 조회해 반환합니다. `type` 쿼리로 chat/embedding 만 골라 받을 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['chat', 'embedding'],
    description: '응답에 포함할 모델 타입을 제한',
  })
  @ApiOkWrappedResponse(LlmModelListDto, {
    description: '사용 가능한 모델 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
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
  @ApiOperation({
    summary: 'LLM 설정 삭제',
    description:
      'LLM 설정을 영구 삭제합니다. 삭제와 함께 내부 클라이언트 캐시도 무효화됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    // DB 삭제 성공 후 캐시를 제거해 "캐시는 비었으나 DB 삭제 실패로 레코드 잔존"
    // 으로 발생하는 재-로드 불일치를 방지한다.
    await this.llmConfigService.remove(id, workspaceId);
    this.llmService.clearClientCache(id);
  }
}
