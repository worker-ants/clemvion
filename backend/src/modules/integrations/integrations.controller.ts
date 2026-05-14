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
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedWrappedResponse,
  ApiOkPaginatedResponse,
  ApiOkWrappedResponse,
} from '../../common/swagger';
import {
  IntegrationActivityDto,
  IntegrationDto,
  IntegrationUsagesDto,
  OAuthBeginResultDto,
  PreviewTestResultDto,
  ServiceCatalogDto,
  TestConnectionResultDto,
} from './dto/responses/integration-response.dto';
import { IntegrationsService } from './integrations.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import {
  ActivityQueryDto,
  CreateIntegrationDto,
  ListIntegrationsQueryDto,
  OAuthBeginDto,
  PreviewTestDto,
  RequestScopesDto,
  RotateCredentialsDto,
  UpdateIntegrationDto,
  UpdateScopeDto,
} from './dto/integration.dto';
import { findVariant } from './services/service-registry';

@ApiTags('Integrations')
@ApiBearerAuth('access-token')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly oauthService: IntegrationOAuthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '통합 목록 조회',
    description:
      '현재 워크스페이스에 등록된 통합 목록을 페이지네이션으로 조회합니다. 서비스 타입, 상태, 범위(개인/조직)로 필터링할 수 있습니다.',
  })
  @ApiOkPaginatedResponse(IntegrationDto, {
    description: '통합 목록 및 페이지네이션 메타',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: ListIntegrationsQueryDto,
  ) {
    return this.integrationsService.findAll(workspaceId, query);
  }

  @Get('services')
  @ApiOperation({
    summary: '지원 서비스 카탈로그',
    description:
      '플랫폼이 통합 가능한 서비스 메타데이터(서비스 타입, 인증 방식, 스코프 등)를 반환합니다.',
  })
  @ApiOkWrappedResponse(ServiceCatalogDto, {
    description: '지원 서비스 카탈로그',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  getAvailableServices() {
    return this.integrationsService.getAvailableServices();
  }

  /**
   * Structural validation of credentials before persistence.
   *
   * Throttled because this endpoint otherwise lets a user repeatedly submit
   * arbitrary payloads. Credentials are schema-validated against the static
   * SERVICE_REGISTRY — no outbound HTTP is performed (the actual probe lives
   * in per-service handlers in the execution engine).
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('preview-test')
  @ApiOperation({
    summary: '자격 증명 사전 검증',
    description:
      '자격 증명을 저장하기 전에 구조적 유효성을 검증합니다. 외부 네트워크 호출은 수행하지 않으며, 남용 방지를 위해 분당 20회로 제한됩니다.',
  })
  @ApiOkWrappedResponse(PreviewTestResultDto, {
    description: '검증 결과 (마스킹된 자격 증명 포함)',
  })
  @ApiBadRequestResponse({
    description:
      '지원하지 않는 serviceType/authType 조합 또는 자격 증명 검증 실패',
  })
  @ApiTooManyRequestsResponse({ description: '요청 한도 초과 (분당 20회)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  previewTest(@Body() body: PreviewTestDto) {
    if (!findVariant(body.serviceType, body.authType)) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_SERVICE',
        message: `Unsupported service/auth combination: ${body.serviceType}/${body.authType}`,
      });
    }
    return this.integrationsService.previewTest(body);
  }

  @Post('oauth/begin')
  @ApiOperation({
    summary: 'OAuth 인증 시작',
    description:
      'OAuth 흐름을 시작해 인증 URL과 state 토큰을 반환합니다. new/reauthorize/request_scopes 모드를 지원합니다.',
  })
  @ApiOkWrappedResponse(OAuthBeginResultDto, {
    description: '인증 URL 및 state 토큰',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패 또는 미지원 서비스' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiConflictResponse({
    description:
      'CAFE24_PRIVATE_APP_ALREADY_CONNECTED — 동일 (workspaceId, mall_id, app_type=private) 의 connected 통합이 이미 존재. 기존 통합을 사용하거나 삭제 후 재등록.',
  })
  async oauthBegin(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: OAuthBeginDto,
  ) {
    const mode = body.mode === 'request-scopes' ? 'request_scopes' : body.mode;
    const providerMeta =
      body.service === 'cafe24'
        ? {
            mall_id: body.mallId,
            app_type: body.appType,
            ...(body.appType === 'private'
              ? {
                  client_id: body.clientId,
                  client_secret: body.clientSecret,
                }
              : {}),
          }
        : undefined;
    return this.oauthService.begin({
      workspaceId,
      userId: user.sub,
      service: body.service,
      scopes: body.scopes,
      mode,
      integrationId: body.integrationId,
      integrationName: body.integrationName,
      scope: body.scope,
      providerMeta,
    });
  }

  // NOTE: Cafe24 install (`POST oauth/begin` 발급 토큰으로 호출) + OAuth
  // callback handlers 는 `ThirdPartyOAuthController` (`/api/3rd-party/...`)
  // 로 이전됨. 사용자가 호출하는 통합 관리 API 만 본 controller 에 남는다.
  // spec/2-navigation/4-integration.md §9.2 Rationale "Cafe24 App URL 100자
  // 한도 대응" 참조.

  @Get(':id')
  @ApiOperation({
    summary: '통합 단건 조회',
    description:
      'ID로 통합 상세를 조회합니다. 자격 증명은 마스킹되어 반환됩니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, {
    description: '통합 상세 정보 (마스킹된 자격 증명 포함)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.findById(id, workspaceId);
  }

  @Get(':id/usages')
  @ApiOperation({
    summary: '통합 사용처 조회',
    description:
      '해당 통합을 사용 중인 워크플로우·노드 목록을 반환합니다. 삭제 영향도 확인용.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationUsagesDto, {
    description: '통합이 사용 중인 워크플로우·노드 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async listUsages(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.getUsages(id, workspaceId);
  }

  @Get(':id/activity')
  @ApiOperation({
    summary: '통합 최근 활동 조회',
    description:
      '지정 기간(일) 동안의 호출 성공/실패 등 최근 활동 로그를 반환합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationActivityDto, {
    description: '최근 활동 로그 목록',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async activity(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @Query() query: ActivityQueryDto,
  ) {
    return this.integrationsService.getActivity(
      id,
      workspaceId,
      query.limit ?? 20,
      query.days ?? 7,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('editor')
  @ApiOperation({
    summary: '통합 생성',
    description:
      '자격 증명(API Key/토큰) 또는 OAuth preview 토큰을 사용해 새 통합을 생성합니다. scope=organization으로 생성하려면 관리자 권한이 필요합니다.',
  })
  @ApiCreatedWrappedResponse(IntegrationDto, {
    description: '생성된 통합 정보 (자격 증명 마스킹)',
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 자격 증명 유효성 오류',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'organization 범위 생성 권한 부족' })
  @ApiConflictResponse({ description: '동일 조건의 통합이 이미 존재' })
  async create(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateIntegrationDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.create(workspaceId, user.sub, role, body);
  }

  @Patch(':id')
  @Roles('editor')
  @ApiOperation({
    summary: '통합 수정',
    description: '통합의 이름 등 메타 정보를 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, { description: '수정된 통합 정보' })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: 'editor 이상 권한 필요' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, workspaceId, user.sub, body);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: '통합 연결 테스트',
    description:
      '저장된 자격 증명을 사용해 실제 외부 서비스에 테스트 호출을 수행합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(TestConnectionResultDto, {
    description: '연결 테스트 결과 (성공 여부, 메타 정보)',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.testConnection(id, workspaceId);
  }

  @Post(':id/rotate')
  @Roles('editor')
  @ApiOperation({
    summary: '자격 증명 교체(rotate)',
    description:
      '저장된 자격 증명을 새 값으로 교체합니다. 관리자 권한이 필요할 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, {
    description: '교체 후 통합 정보 (마스킹된 자격 증명)',
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 자격 증명 유효성 오류',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '교체 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: RotateCredentialsDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.rotate(
      id,
      workspaceId,
      user.sub,
      role,
      body,
    );
  }

  @Post(':id/reauthorize')
  @ApiOperation({
    summary: '재인증(reauthorize) 시작',
    description:
      '만료되었거나 오류 상태인 OAuth 통합에 대해 재인증 플로우를 트리거합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(OAuthBeginResultDto, {
    description: '재인증 URL 및 state 토큰',
  })
  @ApiBadRequestResponse({ description: 'OAuth 기반 통합이 아님' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async reauthorize(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.reauthorize(id, workspaceId, user.sub);
  }

  @Post(':id/request-scopes')
  @ApiOperation({
    summary: '추가 스코프 요청',
    description:
      '기존 OAuth 통합에 추가 스코프를 요청합니다. provider가 incremental auth를 지원해야 합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(OAuthBeginResultDto, {
    description: '스코프 추가 인증 URL',
  })
  @ApiBadRequestResponse({
    description: '입력값 검증 실패 또는 incremental auth 미지원',
  })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '스코프 요청 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async requestScopes(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: RequestScopesDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.requestScopes(
      id,
      workspaceId,
      user.sub,
      role,
      body,
    );
  }

  @Patch(':id/scope')
  @ApiOperation({
    summary: '통합 범위 변경',
    description:
      '개인(personal) ↔ 조직(organization) 범위를 변경합니다. 조직 범위로 올리려면 관리자 권한이 필요합니다.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiOkWrappedResponse(IntegrationDto, {
    description: '범위가 변경된 통합 정보',
  })
  @ApiBadRequestResponse({ description: '입력값 검증 실패' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '범위 변경 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async updateScope(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateScopeDto,
  ) {
    const role = await this.integrationsService.resolveRole(
      workspaceId,
      user.sub,
    );
    return this.integrationsService.updateScope(
      id,
      workspaceId,
      user.sub,
      role,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('editor')
  @ApiOperation({
    summary: '통합 삭제',
    description:
      '통합을 영구 삭제합니다. 이 통합을 사용 중인 노드는 실행 시 오류가 발생할 수 있으니 사전에 `/usages`로 확인하세요.',
  })
  @ApiParam({ name: 'id', description: '통합 UUID', format: 'uuid' })
  @ApiNoContentResponse({ description: '삭제 성공' })
  @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
  @ApiForbiddenResponse({ description: '삭제 권한 부족' })
  @ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.integrationsService.remove(id, workspaceId, user.sub);
  }
}
