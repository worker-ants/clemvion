import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/guards/roles.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiProduces,
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
import type { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import {
  ALLOWED_OAUTH_PROVIDERS,
  Cafe24InstallQuery,
  IntegrationOAuthService,
  callbackContextOf,
} from './integration-oauth.service';
import { CurrentUser, WorkspaceId } from '../../common/decorators';
import type { JwtPayload } from '../../common/decorators';
import { Public } from '../../common/decorators/public.decorator';
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
import { renderCallbackHtml } from './services/oauth-callback.template';

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

  /**
   * Cafe24 Private app "테스트 실행" entry — Cafe24 calls our App URL with
   * the install_token path segment we issued at oauth/begin. The token is
   * the single-row identification key (V043 partial unique index); HMAC
   * verification then runs once against that row's client_secret. See
   * spec/2-navigation/4-integration.md §9.2.
   *
   * Rate limit is tight because the endpoint is public and the install_token
   * — although 256-bit random — is exposed in URL path (logs / Referer).
   * spec ## Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제".
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('oauth/install/cafe24/:installToken')
  @ApiOperation({
    summary: 'Cafe24 Private 앱 설치 진입점 (App URL — install_token)',
    description:
      'Cafe24 Developers "테스트 실행" 시 Cafe24가 호출하는 App URL 엔드포인트. path 의 install_token 으로 pending_install Integration 을 단일 row 조회하고 HMAC 1회 검증 후 Cafe24 authorize URL 로 302 redirect 합니다.',
  })
  @ApiOkResponse({ description: '302 redirect to Cafe24 authorize URL' })
  async cafe24Install(
    @Param('installToken') installToken: string,
    @Query('mall_id') mallId: string | undefined,
    @Query('timestamp') timestamp: string | undefined,
    @Query('hmac') hmac: string | undefined,
    @Query('shop_no') shopNo: string | undefined,
    @Query('user_id') userId: string | undefined,
    @Query('user_name') userName: string | undefined,
    @Query('user_type') userType: string | undefined,
    @Query('lang') lang: string | undefined,
    @Query('nation') nation: string | undefined,
    @Query('is_multi_shop') isMultiShop: string | undefined,
    @Query('auth_config') authConfig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!mallId || !timestamp || !hmac) {
      res.status(400).json({
        code: 'CAFE24_INSTALL_MISSING_PARAMS',
        message: 'mall_id, timestamp, hmac are required',
      });
      return;
    }
    const rawQuery = req.url.includes('?') ? req.url.split('?', 2)[1] : '';
    const query: Cafe24InstallQuery = {
      mall_id: mallId,
      timestamp,
      hmac,
      shop_no: shopNo,
      user_id: userId,
      user_name: userName,
      user_type: userType,
      lang,
      nation,
      is_multi_shop: isMultiShop,
      auth_config: authConfig,
      rawQuery,
    };
    try {
      const redirectUrl = await this.oauthService.handleInstall(
        installToken,
        query,
      );
      res.redirect(302, redirectUrl);
    } catch (err) {
      const e = err as {
        status?: number;
        response?: { code?: string; message?: string };
        message?: string;
      };
      const status = e.status ?? 400;
      const code = e.response?.code ?? 'CAFE24_INSTALL_FAILED';
      const message = e.response?.message ?? e.message ?? 'Install failed';
      res.status(status).json({ code, message });
    }
  }

  /**
   * Legacy App URL — token-less path, deprecated by V043 / variant 2.
   * Responds 410 Gone so external Cafe24 Developers registrations still
   * pointing here see a clean signal. Permanent retirement tracked in
   * plan/in-progress/cafe24-pending-polish.md as a follow-up.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('oauth/install/cafe24')
  @ApiOperation({
    summary: 'Cafe24 Private 앱 설치 진입점 (Deprecated — install_token 없음)',
    description:
      '옛 토큰 없는 라우트. 신규 등록자는 /oauth/install/cafe24/:installToken 을 사용해야 합니다.',
  })
  cafe24InstallLegacy(@Res() res: Response) {
    res.status(410).json({
      code: 'CAFE24_INSTALL_LEGACY_PATH',
      message:
        'This App URL is deprecated. Re-register your Cafe24 Private app using the new /oauth/install/cafe24/:installToken URL shown in the integration setup screen.',
    });
  }

  @Public()
  @Get('oauth/callback/:provider')
  @ApiOperation({
    summary: 'OAuth 콜백 처리',
    description:
      'OAuth provider가 리디렉션하는 콜백 엔드포인트입니다. 인증 불필요. 처리 후 결과를 담은 HTML 페이지를 반환하며 `postMessage`로 부모 창에 결과를 전달합니다.',
  })
  @ApiParam({
    name: 'provider',
    description: 'OAuth provider 식별자 (예: google, github)',
    example: 'google',
  })
  @ApiProduces('text/html')
  @ApiOkResponse({
    description: 'OAuth 처리 결과 HTML 페이지',
  })
  @ApiBadRequestResponse({ description: '지원하지 않는 OAuth provider' })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    // postMessage targetOrigin must not fall back to '*' — any opener
    // tab could read previewToken / integrationId otherwise. FRONTEND_URL
    // is the canonical setting; APP_URL is the backwards-compatible
    // fallback. If neither is set we refuse to render the callback HTML
    // so an env-misconfigured deploy fails closed instead of leaking the
    // OAuth payload to whatever popup opener happens to be there.
    const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL;
    if (!targetOrigin) {
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        '<p>OAuth callback misconfigured: FRONTEND_URL / APP_URL not set.</p>',
      );
      return;
    }

    if (!(ALLOWED_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderCallbackHtml(
          {
            status: 'error',
            provider,
            error: 'Unsupported OAuth provider',
          },
          targetOrigin,
        ),
      );
      return;
    }

    try {
      const result = await this.oauthService.handleCallback(provider, {
        code,
        state,
        error,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderCallbackHtml({ status: 'success', result }, targetOrigin));
    } catch (err) {
      const e = err as {
        message?: string;
        response?: { message?: string; code?: string };
      };
      const errorCode = e.response?.code ?? 'OAUTH_CALLBACK_FAILED';
      const message = e.response?.message ?? e.message ?? 'OAuth failed';

      // If the failure happened after state consumption, the service attached
      // {integrationId, workspaceId, mode} to the error so we can surface the
      // diagnostic on the row (spec/2-navigation/4-integration.md §10.4).
      // Defensive: markIntegrationCallbackError is best-effort by design
      // (internal try/catch), but a future refactor that removes that guard
      // must not be allowed to hang the popup — explicit .catch ensures the
      // error HTML response still runs.
      const ctx = callbackContextOf(err);
      if (ctx?.integrationId && ctx.workspaceId) {
        await this.oauthService
          .markIntegrationCallbackError(
            ctx.integrationId,
            ctx.workspaceId,
            errorCode,
            message,
          )
          .catch(() => {
            /* swallow — never block HTML response */
          });
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        renderCallbackHtml(
          { status: 'error', provider, error: message },
          targetOrigin,
        ),
      );
    }
  }

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
