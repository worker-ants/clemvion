import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { Node } from '../nodes/entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import {
  ListIntegrationsQueryDto,
  CreateIntegrationDto,
  UpdateIntegrationDto,
  RotateCredentialsDto,
  RequestScopesDto,
  UpdateScopeDto,
  PreviewTestDto,
} from './dto/integration.dto';
import {
  SERVICE_REGISTRY,
  findService,
  findVariant,
  maskCredentials,
  validateCredentials,
} from './services/service-registry';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export interface IntegrationUsageNode {
  id: string;
  label: string;
  type: string;
}

export interface IntegrationUsageWorkflow {
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  nodes: IntegrationUsageNode[];
}

export type PublicIntegration = Omit<Integration, 'credentials'> & {
  credentials: Record<string, unknown>;
};

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationUsageLog)
    private readonly usageLogRepository: Repository<IntegrationUsageLog>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    private readonly workspacesService: WorkspacesService,
    private readonly oauthService: IntegrationOAuthService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ---------------------------------------------------------------
  // Listing
  // ---------------------------------------------------------------

  async findAll(
    workspaceId: string,
    query: ListIntegrationsQueryDto,
  ): Promise<PaginatedResponseDto<PublicIntegration>> {
    const { page = 1, limit = 20, q, scope, serviceType, status } = query;

    const qb = this.integrationRepository
      .createQueryBuilder('i')
      .where('i.workspace_id = :workspaceId', { workspaceId });

    if (q) {
      qb.andWhere('i.name ILIKE :search', { search: `%${q}%` });
    }
    if (scope && scope !== 'all') {
      qb.andWhere('i.scope = :scope', { scope });
    }
    if (serviceType && serviceType.length > 0) {
      qb.andWhere('i.service_type IN (:...serviceTypes)', {
        serviceTypes: serviceType,
      });
    }
    if (status === 'connected') {
      qb.andWhere('i.status = :s', { s: 'connected' }).andWhere(
        "(i.token_expires_at IS NULL OR i.token_expires_at > NOW() + INTERVAL '7 days')",
      );
    } else if (status === 'expiring') {
      qb.andWhere('i.status = :s', { s: 'connected' })
        .andWhere('i.token_expires_at IS NOT NULL')
        .andWhere("i.token_expires_at <= NOW() + INTERVAL '7 days'")
        .andWhere('i.token_expires_at > NOW()');
    } else if (status === 'expired') {
      qb.andWhere('i.status = :s', { s: 'expired' });
    } else if (status === 'error') {
      qb.andWhere('i.status = :s', { s: 'error' });
    }

    qb.orderBy('i.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data = rows.map((row) => this.toPublic(row));
    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<PublicIntegration> {
    const row = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    return this.toPublic(row);
  }

  // ---------------------------------------------------------------
  // Create / Update
  // ---------------------------------------------------------------

  async create(
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: CreateIntegrationDto,
  ): Promise<PublicIntegration> {
    this.validateServiceAndAuth(body.serviceType, body.authType);

    const requestedScope = body.scope ?? 'personal';
    if (requestedScope === 'organization' && !this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Admin role is required to create organization-scope integrations',
      });
    }

    let credentials: Record<string, unknown> = body.credentials ?? {};
    let tokenExpiresAt: Date | null = null;
    if (body.previewToken) {
      const preview = await this.oauthService.consumePreviewToken(
        body.previewToken,
        workspaceId,
        userId,
      );
      if (preview.serviceType !== body.serviceType) {
        throw new BadRequestException({
          code: 'OAUTH_PREVIEW_MISMATCH',
          message: 'Preview token does not match the selected service',
        });
      }
      credentials = { ...credentials, ...preview.credentials };
      tokenExpiresAt = preview.tokenExpiresAt;
    }

    const errors = validateCredentials(
      body.serviceType,
      body.authType,
      credentials,
    );
    if (errors.length) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_CREDENTIALS',
        message: errors.join('; '),
      });
    }

    const entity = this.integrationRepository.create({
      workspaceId,
      createdBy: userId,
      serviceType: body.serviceType,
      name: body.name,
      authType: body.authType,
      credentials,
      scope: requestedScope,
      status: 'connected',
      tokenExpiresAt,
    });

    try {
      const saved = await this.integrationRepository.save(entity);
      await this.auditLogsService.record({
        workspaceId,
        userId,
        action: 'integration.created',
        resourceType: 'integration',
        resourceId: saved.id,
        details: {
          serviceType: saved.serviceType,
          authType: saved.authType,
          scope: saved.scope,
        },
      });
      return this.toPublic(saved);
    } catch (err) {
      this.throwIfUniqueViolation(err);
      throw err;
    }
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    body: UpdateIntegrationDto,
  ): Promise<PublicIntegration> {
    const entity = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    const changes: Record<string, unknown> = {};
    if (body.name !== undefined && body.name !== entity.name) {
      changes.name = { from: entity.name, to: body.name };
      entity.name = body.name;
    }
    try {
      const saved = await this.integrationRepository.save(entity);
      if (Object.keys(changes).length > 0) {
        await this.auditLogsService.record({
          workspaceId,
          userId,
          action: 'integration.updated',
          resourceType: 'integration',
          resourceId: saved.id,
          details: changes,
        });
      }
      return this.toPublic(saved);
    } catch (err) {
      this.throwIfUniqueViolation(err);
      throw err;
    }
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const entity = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }

    const usages = await this.getUsages(id, workspaceId);
    if (usages.length > 0) {
      throw new ConflictException({
        code: 'INTEGRATION_IN_USE',
        message: 'Integration is still referenced by workflow nodes',
        usages,
      });
    }

    await this.integrationRepository.remove(entity);
    await this.auditLogsService.record({
      workspaceId,
      userId,
      action: 'integration.deleted',
      resourceType: 'integration',
      resourceId: id,
      details: {
        serviceType: entity.serviceType,
        name: entity.name,
      },
    });
  }

  // ---------------------------------------------------------------
  // Usage tracking
  // ---------------------------------------------------------------

  async getUsages(
    id: string,
    workspaceId: string,
  ): Promise<IntegrationUsageWorkflow[]> {
    // Verify integration belongs to workspace (throws if missing).
    await this.findById(id, workspaceId);

    const rows: Array<{
      node_id: string;
      node_label: string;
      node_type: string;
      workflow_id: string;
      workflow_name: string;
      is_active: boolean;
    }> = await this.nodeRepository
      .createQueryBuilder('n')
      .innerJoin(Workflow, 'w', 'w.id = n.workflow_id')
      .where('w.workspace_id = :workspaceId', { workspaceId })
      .andWhere("n.config ->> 'integrationId' = :integrationId", {
        integrationId: id,
      })
      .select('n.id', 'node_id')
      .addSelect('n.label', 'node_label')
      .addSelect('n.type', 'node_type')
      .addSelect('w.id', 'workflow_id')
      .addSelect('w.name', 'workflow_name')
      .addSelect('w.is_active', 'is_active')
      .orderBy('w.name', 'ASC')
      .addOrderBy('n.label', 'ASC')
      .getRawMany();

    const grouped = new Map<string, IntegrationUsageWorkflow>();
    for (const r of rows) {
      let bucket = grouped.get(r.workflow_id);
      if (!bucket) {
        bucket = {
          workflowId: r.workflow_id,
          workflowName: r.workflow_name,
          isActive: r.is_active,
          nodes: [],
        };
        grouped.set(r.workflow_id, bucket);
      }
      bucket.nodes.push({
        id: r.node_id,
        label: r.node_label,
        type: r.node_type,
      });
    }
    return [...grouped.values()];
  }

  async getActivity(
    id: string,
    workspaceId: string,
    limit: number,
    days: number,
  ): Promise<{
    items: IntegrationUsageLog[];
    summary: {
      totalCalls: number;
      successRate: number;
      dailyCounts: Array<{ date: string; count: number; failed: number }>;
    };
  }> {
    await this.findById(id, workspaceId);
    const effectiveLimit = Math.min(Math.max(limit, 1), 100);
    const effectiveDays = Math.min(Math.max(days, 1), 30);

    const since = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);

    const items = await this.usageLogRepository
      .createQueryBuilder('u')
      .where('u.integration_id = :id', { id })
      .andWhere('u.at >= :since', { since })
      .orderBy('u.at', 'DESC')
      .limit(effectiveLimit)
      .getMany();

    const summaryRows: Array<{
      day: string;
      total: string;
      failed: string;
    }> = await this.usageLogRepository
      .createQueryBuilder('u')
      .where('u.integration_id = :id', { id })
      .andWhere('u.at >= :since', { since })
      .select("DATE_TRUNC('day', u.at)::date::text", 'day')
      .addSelect('COUNT(*)', 'total')
      .addSelect("COUNT(*) FILTER (WHERE u.status = 'failed')", 'failed')
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const totalCalls = summaryRows.reduce((acc, r) => acc + Number(r.total), 0);
    const failedCalls = summaryRows.reduce(
      (acc, r) => acc + Number(r.failed),
      0,
    );
    const successRate =
      totalCalls === 0 ? 1 : (totalCalls - failedCalls) / totalCalls;

    return {
      items,
      summary: {
        totalCalls,
        successRate,
        dailyCounts: summaryRows.map((r) => ({
          date: r.day,
          count: Number(r.total),
          failed: Number(r.failed),
        })),
      },
    };
  }

  // ---------------------------------------------------------------
  // Testing / Rotation / Scopes
  // ---------------------------------------------------------------

  async testConnection(
    id: string,
    workspaceId: string,
  ): Promise<{ success: boolean; message: string }> {
    const entity = await this.requireEntity(id, workspaceId);
    return this.dispatchTest(
      entity.serviceType,
      entity.authType,
      entity.credentials,
    );
  }

  previewTest(
    body: PreviewTestDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.dispatchTest(body.serviceType, body.authType, body.credentials);
  }

  /**
   * Record an integration call for activity tracking and error surfacing.
   * Invoked by execution engine handlers after they complete an integration call.
   */
  async logUsage(params: {
    integrationId: string;
    nodeExecutionId: string;
    workflowId: string;
    status: 'success' | 'failed';
    durationMs: number;
    error?: { code?: string; message?: string } | null;
  }): Promise<void> {
    try {
      await this.usageLogRepository.save(
        this.usageLogRepository.create({
          integrationId: params.integrationId,
          nodeExecutionId: params.nodeExecutionId,
          workflowId: params.workflowId,
          status: params.status,
          durationMs: params.durationMs,
          error: params.error ?? null,
        }),
      );

      const integration = await this.integrationRepository.findOne({
        where: { id: params.integrationId },
      });
      if (!integration) return;

      integration.lastUsedAt = new Date();
      if (params.status === 'failed') {
        integration.lastError = {
          code: params.error?.code ?? 'unknown',
          message: params.error?.message ?? 'Unknown error',
          at: new Date().toISOString(),
        };
      }
      await this.integrationRepository.save(integration);
    } catch (err) {
      // Usage logging must not break execution — swallow and continue.
      console.warn(
        `Failed to log integration usage: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async rotate(
    id: string,
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: RotateCredentialsDto,
  ): Promise<PublicIntegration> {
    const entity = await this.requireEntity(id, workspaceId);

    if (entity.authType === 'oauth2') {
      throw new BadRequestException({
        code: 'INTEGRATION_ROTATE_UNSUPPORTED',
        message: 'Use the reauthorize endpoint to rotate OAuth credentials',
      });
    }
    if (entity.scope === 'organization' && !this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Admin role is required to rotate organization-scope integrations',
      });
    }

    const merged = { ...entity.credentials, ...body.credentials };
    const errors = validateCredentials(
      entity.serviceType,
      entity.authType,
      merged,
    );
    if (errors.length) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_CREDENTIALS',
        message: errors.join('; '),
      });
    }

    const test = await this.dispatchTest(
      entity.serviceType,
      entity.authType,
      merged,
    );
    if (!test.success) {
      throw new BadRequestException({
        code: 'INTEGRATION_TEST_FAILED',
        message: test.message,
      });
    }

    entity.credentials = merged;
    entity.lastRotatedAt = new Date();
    entity.status = 'connected';
    entity.statusReason = null;
    entity.lastError = null;

    const saved = await this.integrationRepository.save(entity);
    await this.auditLogsService.record({
      workspaceId,
      userId,
      action: 'integration.rotated',
      resourceType: 'integration',
      resourceId: saved.id,
      details: { authType: saved.authType },
    });
    return this.toPublic(saved);
  }

  async requestScopes(
    id: string,
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: RequestScopesDto,
  ): Promise<{ authUrl: string; state: string }> {
    const entity = await this.requireEntity(id, workspaceId);

    if (entity.authType !== 'oauth2') {
      throw new BadRequestException({
        code: 'INTEGRATION_SCOPE_UNSUPPORTED',
        message: 'Scope requests are only supported for OAuth integrations',
      });
    }
    if (entity.scope === 'organization' && !this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Admin role is required to modify organization-scope integrations',
      });
    }

    const existingScopes = Array.isArray(entity.credentials.scopes)
      ? (entity.credentials.scopes as string[])
      : [];
    const mergedScopes = Array.from(
      new Set([...existingScopes, ...body.scopes]),
    );

    return this.oauthService.begin({
      workspaceId,
      userId,
      service: entity.serviceType,
      scopes: mergedScopes,
      mode: 'request_scopes',
      integrationId: entity.id,
    });
  }

  async updateScope(
    id: string,
    workspaceId: string,
    userId: string,
    userRole: string | null,
    body: UpdateScopeDto,
  ): Promise<PublicIntegration> {
    if (!this.isAdmin(userRole)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Admin role is required to change integration scope',
      });
    }
    const entity = await this.requireEntity(id, workspaceId);
    const from = entity.scope;
    entity.scope = body.scope;
    const saved = await this.integrationRepository.save(entity);
    if (from !== body.scope) {
      await this.auditLogsService.record({
        workspaceId,
        userId,
        action: 'integration.scope_changed',
        resourceType: 'integration',
        resourceId: saved.id,
        details: { from, to: body.scope },
      });
    }
    return this.toPublic(saved);
  }

  // ---------------------------------------------------------------
  // OAuth
  // ---------------------------------------------------------------

  async reauthorize(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<{ authUrl: string; state: string }> {
    const entity = await this.requireEntity(id, workspaceId);
    const service = findService(entity.serviceType);

    if (!service?.oauthProvider) {
      entity.status = 'connected';
      entity.statusReason = null;
      entity.lastError = null;
      await this.integrationRepository.save(entity);
      await this.auditLogsService.record({
        workspaceId,
        userId,
        action: 'integration.reauthorized',
        resourceType: 'integration',
        resourceId: entity.id,
        details: { mode: 'reset' },
      });
      return { authUrl: '', state: '' };
    }

    const existingScopes = Array.isArray(entity.credentials.scopes)
      ? (entity.credentials.scopes as string[])
      : (service.scopes?.filter((s) => s.recommended).map((s) => s.value) ??
        []);

    return this.oauthService.begin({
      workspaceId,
      userId,
      service: entity.serviceType,
      scopes: existingScopes,
      mode: 'reauthorize',
      integrationId: entity.id,
    });
  }

  // ---------------------------------------------------------------
  // Service metadata
  // ---------------------------------------------------------------

  getAvailableServices() {
    return SERVICE_REGISTRY.map((s) => ({
      type: s.type,
      name: s.name,
      oauthProvider: s.oauthProvider ?? null,
      authTypes: s.authVariants.map((v) => v.authType),
      authVariants: s.authVariants,
      scopes: s.scopes ?? [],
    }));
  }

  /**
   * Fetch the raw entity (with decrypted credentials via the TypeORM transformer)
   * for use by the execution engine. Credentials are NOT masked — callers must
   * treat the returned object as secret material.
   */
  async getForExecution(
    id: string,
    workspaceId: string,
  ): Promise<Integration> {
    return this.requireEntity(id, workspaceId);
  }

  // ---------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------

  private async requireEntity(
    id: string,
    workspaceId: string,
  ): Promise<Integration> {
    const entity = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    return entity;
  }

  private toPublic(entity: Integration): PublicIntegration {
    return {
      ...entity,
      credentials: maskCredentials(
        entity.credentials,
        entity.serviceType,
        entity.authType,
      ),
    };
  }

  private validateServiceAndAuth(serviceType: string, authType: string): void {
    const variant = findVariant(serviceType, authType);
    if (!variant) {
      throw new BadRequestException({
        code: 'INTEGRATION_INVALID_SERVICE',
        message: `Unsupported service/auth combination: ${serviceType}/${authType}`,
      });
    }
  }

  private isAdmin(role: string | null): boolean {
    return !!role && ADMIN_ROLES.has(role);
  }

  private throwIfUniqueViolation(err: unknown): void {
    const code = (err as { code?: string })?.code;
    const constraint = (err as { constraint?: string })?.constraint;
    if (
      code === '23505' &&
      constraint === 'integration_workspace_name_unique'
    ) {
      throw new ConflictException({
        code: 'INTEGRATION_NAME_TAKEN',
        message: 'Integration name is already in use within this workspace',
      });
    }
  }

  private dispatchTest(
    serviceType: string,
    authType: string,
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    // Phase A: structural validation only — per-service transport testing
    // lands in Phase C alongside OAuth begin/preview-test.
    const errors = validateCredentials(serviceType, authType, credentials);
    if (errors.length) {
      return Promise.resolve({ success: false, message: errors.join('; ') });
    }
    return Promise.resolve({
      success: true,
      message: 'Connection successful',
    });
  }

  async resolveRole(
    workspaceId: string,
    userId: string,
  ): Promise<string | null> {
    return this.workspacesService.getMemberRole(workspaceId, userId);
  }
}
