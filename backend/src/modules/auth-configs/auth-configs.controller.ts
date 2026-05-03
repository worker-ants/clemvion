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
  UseGuards,
} from '@nestjs/common';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
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
  ApiOkWrappedResponse,
} from '../../common/swagger';
import { AuthConfigsService } from './auth-configs.service';
import { WorkspaceId } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateAuthConfigDto } from './dto/create-auth-config.dto';
import { UpdateAuthConfigDto } from './dto/update-auth-config.dto';
import {
  AuthConfigDto,
  AuthConfigUsageDto,
} from './dto/responses/auth-config-response.dto';

@ApiTags('Auth Configs')
@ApiBearerAuth('access-token')
@Controller('auth-configs')
@UseGuards(RolesGuard)
export class AuthConfigsController {
  constructor(private readonly authConfigsService: AuthConfigsService) {}

  @Get()
  @ApiOperation({
    summary: '인증 설정 목록 조회',
    description:
      '하위 API(웹훅/트리거)에서 사용하는 커스텀 인증 설정 목록을 페이지네이션으로 반환합니다.',
  })
  @ApiOkPaginatedResponse(AuthConfigDto, {
    description: '인증 설정 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.authConfigsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '인증 설정 단건 조회',
    description: 'ID로 인증 설정 상세를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '인증 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(AuthConfigDto, { description: '인증 설정 상세' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 인증 설정을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.authConfigsService.findById(id, workspaceId);
  }

  @Post()
  @Roles('editor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '인증 설정 생성',
    description:
      '새 인증 설정을 생성합니다. type이 api_key/bearer_token인 경우 키/토큰을 자동으로 발급합니다.',
  })
  @ApiCreatedWrappedResponse(AuthConfigDto, { description: '생성된 인증 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'Editor 미만 권한' })
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() body: CreateAuthConfigDto,
  ) {
    return this.authConfigsService.create(workspaceId, body);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '인증 설정 수정',
    description:
      '이름, 타입, 상세 설정, IP 화이트리스트, 활성 여부 등을 부분 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '인증 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(AuthConfigDto, { description: '수정된 인증 설정' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'Editor 미만 권한' })
  @ApiNotFoundResponse({ description: '해당 인증 설정을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Body() body: UpdateAuthConfigDto,
  ) {
    return this.authConfigsService.update(id, workspaceId, body);
  }

  @Get(':id/usage')
  @ApiOperation({
    summary: '인증 설정 사용 통계',
    description:
      '이 인증 설정을 사용한 총 호출 수, 마지막 사용 시각, 최근 호출 20건의 실행 메타를 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '인증 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(AuthConfigUsageDto, { description: '사용 통계' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 인증 설정을 찾을 수 없음' })
  async getUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.authConfigsService.getUsage(id, workspaceId);
  }

  @Post(':id/regenerate')
  // 키 교체는 기존 토큰을 즉시 무효화해 외부 호출자 중단을 유발하므로 Admin+ 으로 제한.
  @Roles('admin')
  @ApiOperation({
    summary: '인증 키/토큰 재발급',
    description:
      'api_key 또는 bearer_token 타입의 설정에 대해 키/토큰을 새 값으로 교체합니다. 기존 값은 즉시 무효화됩니다.',
  })
  @ApiParam({ name: 'id', description: '인증 설정 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(AuthConfigDto, {
    description: '재발급 후 인증 설정 (새 키/토큰 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'Admin 미만 권한' })
  @ApiNotFoundResponse({ description: '해당 인증 설정을 찾을 수 없음' })
  async regenerate(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.authConfigsService.regenerate(id, workspaceId);
  }

  @Delete(':id')
  @Roles('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '인증 설정 삭제',
    description:
      '인증 설정을 영구 삭제합니다. 이 설정을 참조 중인 트리거는 인증에 실패하므로 사전 확인이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '인증 설정 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'Editor 미만 권한' })
  @ApiNotFoundResponse({ description: '해당 인증 설정을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.authConfigsService.remove(id, workspaceId);
  }
}
