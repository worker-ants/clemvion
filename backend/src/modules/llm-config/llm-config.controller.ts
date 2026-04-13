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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { LlmConfigService } from './llm-config.service';
import { LlmService } from '../llm/llm.service';
import { CreateLlmConfigDto } from './dto/create-llm-config.dto';
import { UpdateLlmConfigDto } from './dto/update-llm-config.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('LLM Config')
@ApiBearerAuth('access-token')
@Controller('llm-configs')
export class LlmConfigController {
  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly llmService: LlmService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'LLM 설정 목록 조회',
    description:
      '워크스페이스에 등록된 LLM Provider 설정 목록을 페이지네이션으로 조회합니다. API Key는 마스킹되어 반환됩니다.',
  })
  @ApiOkResponse({
    description: 'LLM 설정 목록 및 페이지네이션 메타',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
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
    return this.llmConfigService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'LLM 설정 단건 조회',
    description: 'ID로 LLM 설정 상세를 조회합니다. API Key는 마스킹됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'LLM 설정 상세' })
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
  @ApiOperation({
    summary: 'LLM 설정 생성',
    description:
      '새 LLM Provider 설정을 등록합니다. API Key는 암호화되어 저장됩니다. isDefault=true 시 기존 기본 설정은 해제됩니다.',
  })
  @ApiCreatedResponse({ description: '생성된 LLM 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateLlmConfigDto,
  ) {
    return this.llmConfigService.create(workspaceId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'LLM 설정 수정',
    description:
      'LLM 설정을 부분 수정합니다. API Key 미전달 시 기존 키가 유지되며, 수정 후 내부 클라이언트 캐시가 무효화됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkResponse({ description: '수정된 LLM 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
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
  @ApiOperation({
    summary: '기본 LLM 설정 지정',
    description:
      '해당 설정을 워크스페이스 기본 LLM으로 지정합니다. 기존 기본 설정은 자동으로 해제됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '기본 설정 변경 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.llmConfigService.setDefault(id, workspaceId);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'LLM 연결 테스트',
    description:
      '저장된 API Key로 Provider에 테스트 호출을 수행합니다. 응답 시간, 사용 가능 여부를 확인합니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkResponse({
    description: '연결 테스트 결과',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            latencyMs: { type: 'number' },
            message: { type: 'string', nullable: true },
          },
        },
      },
    },
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
  @ApiOperation({
    summary: 'Provider 모델 목록 조회',
    description:
      'Provider에서 사용 가능한 모델 목록을 실시간 조회해 반환합니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiOkResponse({ description: '사용 가능한 모델 목록' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async listModels(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.llmService.listModels(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'LLM 설정 삭제',
    description:
      'LLM 설정을 영구 삭제합니다. 삭제와 함께 내부 클라이언트 캐시도 무효화됩니다.',
  })
  @ApiParam({ name: 'id', description: 'LLM 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 LLM 설정을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    this.llmService.clearClientCache(id);
    await this.llmConfigService.remove(id, workspaceId);
  }
}
