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
import { RerankConfigService } from './rerank-config.service';
import { CreateRerankConfigDto } from './dto/create-rerank-config.dto';
import { UpdateRerankConfigDto } from './dto/update-rerank-config.dto';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Rerank Config')
@ApiBearerAuth('access-token')
@Controller('rerank-configs')
export class RerankConfigController {
  constructor(private readonly rerankConfigService: RerankConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Rerank 설정 목록 조회',
    description:
      '워크스페이스에 등록된 Rerank Provider 설정 목록을 페이지네이션으로 조회합니다. API Key는 마스킹되어 반환됩니다.',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.rerankConfigService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Rerank 설정 단건 조회',
    description: 'ID로 Rerank 설정 상세를 조회합니다. API Key는 마스킹됩니다.',
  })
  @ApiParam({ name: 'id', description: 'Rerank 설정 UUID', format: 'uuid' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 Rerank 설정을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.rerankConfigService.findById(id, workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: 'Rerank 설정 생성',
    description:
      '새 Rerank Provider 설정을 등록합니다. API Key는 암호화되어 저장됩니다. isDefault=true 시 기존 기본 설정은 해제됩니다.',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateRerankConfigDto,
  ) {
    return this.rerankConfigService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: 'Rerank 설정 수정',
    description:
      'Rerank 설정을 부분 수정합니다. API Key 미전달 시 기존 키가 유지됩니다.',
  })
  @ApiParam({ name: 'id', description: 'Rerank 설정 UUID', format: 'uuid' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 Rerank 설정을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateRerankConfigDto,
  ) {
    return this.rerankConfigService.update(id, workspaceId, dto);
  }

  @Patch(':id/set-default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '기본 Rerank 설정 지정',
    description:
      '해당 설정을 워크스페이스 기본 Rerank로 지정합니다. 기존 기본 설정은 자동으로 해제됩니다.',
  })
  @ApiParam({ name: 'id', description: 'Rerank 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '기본 설정 변경 완료' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 Rerank 설정을 찾을 수 없음' })
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.rerankConfigService.setDefault(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: 'Rerank 설정 삭제',
    description: 'Rerank 설정을 영구 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: 'Rerank 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 Rerank 설정을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.rerankConfigService.remove(id, workspaceId);
  }
}
