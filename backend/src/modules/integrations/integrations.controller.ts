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
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IntegrationsService } from './integrations.service';
import {
  ALLOWED_OAUTH_PROVIDERS,
  IntegrationOAuthService,
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

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly oauthService: IntegrationOAuthService,
  ) {}

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: ListIntegrationsQueryDto,
  ) {
    return this.integrationsService.findAll(workspaceId, query);
  }

  @Get('services')
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
  async oauthBegin(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: OAuthBeginDto,
  ) {
    const mode = body.mode === 'request-scopes' ? 'request_scopes' : body.mode;
    return this.oauthService.begin({
      workspaceId,
      userId: user.sub,
      service: body.service,
      scopes: body.scopes,
      mode,
      integrationId: body.integrationId,
      integrationName: body.integrationName,
      scope: body.scope,
    });
  }

  @Public()
  @Get('oauth/callback/:provider')
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const targetOrigin = process.env.FRONTEND_URL || process.env.APP_URL || '*';

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
      const e = err as { message?: string; response?: { message?: string } };
      const message = e.response?.message ?? e.message ?? 'OAuth failed';
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.findById(id, workspaceId);
  }

  @Get(':id/usages')
  async listUsages(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.getUsages(id, workspaceId);
  }

  @Get(':id/activity')
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, workspaceId, user.sub, body);
  }

  @Post(':id/test')
  async testConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.integrationsService.testConnection(id, workspaceId);
  }

  @Post(':id/rotate')
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
  async reauthorize(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.integrationsService.reauthorize(id, workspaceId, user.sub);
  }

  @Post(':id/request-scopes')
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
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.integrationsService.remove(id, workspaceId, user.sub);
  }
}
