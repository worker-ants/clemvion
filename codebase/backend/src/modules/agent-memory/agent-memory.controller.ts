import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import { ApiOkPaginatedResponse } from '../../common/swagger';
import { WorkspaceId } from '../../common/decorators';
import { Roles } from '../../common/guards/roles.guard';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { AgentMemoryService } from './agent-memory.service';
import { ListAgentMemoryScopesQueryDto } from './dto/list-agent-memory-scopes.query';
import { ListAgentMemoriesQueryDto } from './dto/list-agent-memories.query';
import { ClearAgentMemoriesQueryDto } from './dto/clear-agent-memories.query';
import {
  AgentMemoryScopeDto,
  AgentMemoryItemDto,
} from './dto/responses/agent-memory-response.dto';

/**
 * AI Agent persistent 메모리 관리 (조회·삭제) admin REST surface
 * (spec/5-system/17-agent-memory.md §6, AGM-12/13). 저장·회수·forgetting
 * (§3·§4) 과 별개의 read/delete 경로.
 *
 * **격리 의무 (§5, AGM-07)**: 모든 라우트는 `@WorkspaceId()` (인증 미들웨어가
 * 주입하는 워크스페이스 컨텍스트) 에서만 workspaceId 를 얻고 쿼리/바디로 받지
 * 않는다. 서비스 SQL 이 `workspace_id = $ws` 를 강제하므로 cross-workspace
 * 누수·삭제가 구조적으로 차단된다.
 *
 * **권한**: 조회(GET)는 워크스페이스 멤버(@Roles('viewer') — RolesGuard 가
 * 멤버십을 검증), 삭제(DELETE)는 editor+ (@Roles('editor')).
 */
@ApiTags('Agent Memory')
@ApiBearerAuth('access-token')
@Controller('agent-memories')
export class AgentMemoryController {
  constructor(private readonly agentMemoryService: AgentMemoryService) {}

  @Get('scopes')
  @Roles('viewer')
  @ApiOperation({
    summary: '메모리 scope 목록 조회',
    description:
      '현재 워크스페이스의 distinct scope_key 목록을 페이지네이션으로 조회합니다. 각 scope 의 메모리 건수와 최신 갱신 시각을 포함하며, q 로 scope_key 부분일치 필터링이 가능합니다. embedding 은 반환하지 않습니다.',
  })
  @ApiOkPaginatedResponse(AgentMemoryScopeDto, {
    description: 'scope 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async listScopes(
    @WorkspaceId() workspaceId: string,
    @Query() query: ListAgentMemoryScopesQueryDto,
  ): Promise<PaginatedResponseDto<AgentMemoryScopeDto>> {
    const limit = query.limit ?? 30;
    const offset = query.offset ?? 0;
    const { items, total } = await this.agentMemoryService.listScopes(
      workspaceId,
      { limit, offset, q: query.q },
    );
    // offset/limit → page 파생 (프로젝트 표준 PaginatedResponseDto shape 유지).
    const page = Math.floor(offset / limit) + 1;
    return PaginatedResponseDto.create(items, total, page, limit);
  }

  @Get()
  @Roles('viewer')
  @ApiOperation({
    summary: 'scope 의 메모리 행 조회',
    description:
      '단일 scope 의 메모리 행을 created_at 내림차순으로 조회합니다. scopeKey 는 필수이며, kind(fact|preference|entity) 로 필터링할 수 있습니다. embedding 벡터는 반환하지 않습니다.',
  })
  @ApiOkPaginatedResponse(AgentMemoryItemDto, {
    description: '메모리 행 목록 및 페이지네이션 메타',
  })
  @ApiBadRequestResponse({ description: 'scopeKey 누락 또는 입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async listMemories(
    @WorkspaceId() workspaceId: string,
    @Query() query: ListAgentMemoriesQueryDto,
  ): Promise<PaginatedResponseDto<AgentMemoryItemDto>> {
    const limit = query.limit ?? 30;
    const offset = query.offset ?? 0;
    const { items, total } = await this.agentMemoryService.listMemories(
      workspaceId,
      query.scopeKey,
      { kind: query.kind, limit, offset },
    );
    const page = Math.floor(offset / limit) + 1;
    return PaginatedResponseDto.create(items, total, page, limit);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '메모리 단건 삭제',
    description:
      '메모리 단건을 영구 삭제(hard delete)합니다. 워크스페이스 교차 삭제는 차단되며(다른 워크스페이스의 id 를 알아도 404), 복구는 보장되지 않습니다.',
  })
  @ApiParam({ name: 'id', description: '메모리 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({
    description: '해당 메모리를 찾을 수 없음 (워크스페이스 교차 차단 포함)',
  })
  async deleteMemory(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ): Promise<void> {
    const affected = await this.agentMemoryService.deleteMemory(
      workspaceId,
      id,
    );
    if (affected === 0) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Agent memory not found',
      });
    }
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: 'scope 전체 메모리 삭제',
    description:
      '한 scope 의 메모리를 전부 영구 삭제(hard delete)합니다. scopeKey 는 필수이며, 워크스페이스 격리가 강제됩니다.',
  })
  @ApiQuery({
    name: 'scopeKey',
    description: '전체 삭제할 scope_key',
    required: true,
  })
  @ApiNoContentResponse({ description: '삭제 성공 (대상 없으면 0건 삭제)' })
  @ApiBadRequestResponse({ description: 'scopeKey 누락' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  async clearScope(
    @WorkspaceId() workspaceId: string,
    @Query() query: ClearAgentMemoriesQueryDto,
  ): Promise<void> {
    // class-validator 가 scopeKey 필수를 1차 검증하지만, 빈/공백만 들어온
    // 케이스를 방어적으로 한 번 더 차단 (spec §6 — scopeKey 필수, 없으면 400).
    if (!query.scopeKey?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'scopeKey query parameter is required',
      });
    }
    await this.agentMemoryService.clearScope(workspaceId, query.scopeKey);
  }
}
