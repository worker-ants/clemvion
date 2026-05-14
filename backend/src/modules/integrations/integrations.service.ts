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
import {
  IntegrationOAuthService,
  type BeginResult,
} from './integration-oauth.service';
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
import { isUnreadableCredentials } from './services/credentials-transformer';
import {
  ConnectionPreview,
  McpTestConnectionService,
} from '../mcp/mcp-test-connection.service';
import {
  MCP_ERROR_CODES,
  MCP_ERROR_MESSAGE_MAX_LEN,
} from '../mcp/mcp-error-codes';
import {
  McpConnectParams,
  ServerCapabilities,
  ServerInfo,
} from '../mcp/mcp-client.service';

/**
 * Public shape returned to the integrations UI for both `previewTest` and
 * `testConnection`. `success`/`message` are universal; `capabilities`,
 * `serverInfo`, `preview` are populated only for `service_type='mcp'`.
 */
export interface IntegrationTestResult {
  success: boolean;
  message: string;
  /** Failure code in the `MCP_*` vocabulary; absent on success. */
  code?: string;
  capabilities?: ServerCapabilities;
  serverInfo?: ServerInfo;
  preview?: ConnectionPreview;
}

/**
 * Strategy for performing the per-service transport test invoked from
 * {@link IntegrationsService.dispatchTest}. New services register a tester
 * here so {@link dispatchTest} stays closed against modification.
 */
type TransportTester = (
  authType: string,
  credentials: Record<string, unknown>,
) => Promise<IntegrationTestResult>;

const ADMIN_ROLES = new Set(['owner', 'admin']);

/**
 * Clamp a free-form error message to {@link MCP_ERROR_MESSAGE_MAX_LEN} so a
 * misbehaving external server cannot inflate the `last_error` JSONB column.
 * The same bound is applied to `IntegrationUsageLog.error.message` for
 * consistency.
 */
function clampMessage(raw: string | undefined): string {
  if (!raw) return 'Unknown error';
  return raw.length > MCP_ERROR_MESSAGE_MAX_LEN
    ? raw.slice(0, MCP_ERROR_MESSAGE_MAX_LEN)
    : raw;
}

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

export type CredentialsStatus = 'ok' | 'needs_reauth';

/**
 * Safe-to-expose hints derived from credentials. Frontend must use these
 * instead of poking at the encrypted `credentials` blob — e.g. for deciding
 * whether the Reauthorize button is enabled (Cafe24 Private apps have no
 * reauthorize entry point). Only Cafe24 currently emits anything here.
 */
export interface IntegrationMeta {
  appType: 'public' | 'private' | null;
}

export type PublicIntegration = Omit<Integration, 'credentials'> & {
  credentials: Record<string, unknown>;
  credentialsStatus: CredentialsStatus;
  meta: IntegrationMeta;
};

/**
 * Thrown when execution-engine code paths try to use an integration whose
 * stored credentials cannot be decrypted (key rotation / corruption). The
 * caller must surface this to the user as a 400 with a reconnect hint rather
 * than attempt the outbound call with empty credentials.
 */
export class IntegrationCredentialsUnreadableError extends BadRequestException {
  constructor(integrationId: string) {
    super({
      code: 'INTEGRATION_CREDENTIALS_UNREADABLE',
      message:
        'Integration credentials could not be decrypted — reconnect required',
      integrationId,
    });
  }
}

@Injectable()
export class IntegrationsService {
  /**
   * Map of `service_type` → transport-level test. Services without an entry
   * fall back to the structural-only validation in {@link dispatchTest}.
   */
  private readonly transportTesters: Map<string, TransportTester>;

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
    private readonly mcpTestConnection: McpTestConnectionService,
  ) {
    this.transportTesters = new Map<string, TransportTester>([
      ['mcp', this.testMcpTransport.bind(this)],
    ]);
  }

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
  ): Promise<IntegrationTestResult> {
    const entity = await this.requireEntity(id, workspaceId);
    if (isUnreadableCredentials(entity.credentials)) {
      return {
        success: false,
        code: 'INTEGRATION_CREDENTIALS_UNREADABLE',
        message:
          'Credentials cannot be decrypted with the current key. Reconnect to rebuild this integration.',
      };
    }
    return this.dispatchTest(
      entity.serviceType,
      entity.authType,
      entity.credentials,
    );
  }

  previewTest(body: PreviewTestDto): Promise<IntegrationTestResult> {
    return this.dispatchTest(body.serviceType, body.authType, body.credentials);
  }

  /**
   * Record an integration call for activity tracking and error surfacing.
   * Invoked by execution engine handlers after they complete an integration
   * call.
   *
   * **Side effect** — `error.code === MCP_AUTH_FAILED` flips
   * `Integration.status` to `error` with `statusReason = 'auth_failed'` so
   * the editor surfaces a "needs reauthorization" badge. Other failure codes
   * only update `lastError`; transient errors do not transition status.
   *
   * **Never throws** — DB failures are swallowed with a console.warn so a
   * logging hiccup cannot break the surrounding tool execution.
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
          error: params.error
            ? {
                code: params.error.code ?? 'unknown',
                message: clampMessage(params.error.message),
              }
            : null,
        }),
      );

      // Single atomic UPDATE — avoids the read-modify-write race where a
      // concurrent success call's save() would overwrite an in-flight
      // status='error' transition. The patch only touches columns we
      // actually want to update; relation fields are intentionally left
      // out so TypeORM's QueryDeepPartialEntity stays satisfied.
      const patch: Record<string, unknown> = { lastUsedAt: new Date() };
      if (params.status === 'failed') {
        patch.lastError = {
          code: params.error?.code ?? 'unknown',
          message: clampMessage(params.error?.message),
          at: new Date().toISOString(),
        };
        if (params.error?.code === MCP_ERROR_CODES.AUTH_FAILED) {
          patch.status = 'error';
          patch.statusReason = 'auth_failed';
        }
      }
      await this.integrationRepository.update(
        { id: params.integrationId },
        patch,
      );
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

    // If the existing row's credentials cannot be decrypted (key rotation),
    // start from a clean slate — merging in the sentinel marker would persist
    // it through re-encryption and defeat the rotation.
    const baseCreds = isUnreadableCredentials(entity.credentials)
      ? {}
      : entity.credentials;
    const merged = { ...baseCreds, ...body.credentials };
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
  ): Promise<BeginResult> {
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
  ): Promise<BeginResult> {
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
   * Fetch the raw entity (with decrypted credentials via the TypeORM
   * transformer) for use by the execution engine.
   *
   * **Authorisation contract** — the caller MUST already have established
   * that the execution has permission to use this integration. This method
   * only enforces the `workspace_id` scope check; it does not verify the
   * individual workflow's ownership, the user triggering the run, or
   * whether the integration is organisation-shared vs. personal. Use
   * exclusively from trusted execution-engine code paths.
   *
   * Credentials on the returned object are NOT masked — callers must treat
   * the result as secret material and avoid logging it.
   */
  async getForExecution(id: string, workspaceId: string): Promise<Integration> {
    const entity = await this.requireEntity(id, workspaceId);
    if (isUnreadableCredentials(entity.credentials)) {
      throw new IntegrationCredentialsUnreadableError(entity.id);
    }
    return entity;
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
    const credsUnreadable = isUnreadableCredentials(entity.credentials);
    const lastErrorUnreadable = isUnreadableCredentials(entity.lastError);
    const meta = this.buildIntegrationMeta(entity, credsUnreadable);
    if (credsUnreadable) {
      // Single corrupted row must not leak the sentinel marker into the API
      // response and must surface as a reconnect prompt rather than a
      // half-broken "connected" card.
      return {
        ...entity,
        credentials: {},
        lastError: lastErrorUnreadable ? null : entity.lastError,
        status: 'error',
        statusReason: 'credentials_unreadable',
        credentialsStatus: 'needs_reauth',
        meta,
      };
    }
    return {
      ...entity,
      credentials: maskCredentials(
        entity.credentials,
        entity.serviceType,
        entity.authType,
      ),
      lastError: lastErrorUnreadable ? null : entity.lastError,
      credentialsStatus: 'ok',
      meta,
    };
  }

  /**
   * Build the safe-to-expose meta hints. Currently only cafe24 emits anything
   * (`appType`) — extracted so FE can decide flow gating (e.g. Reauthorize
   * button visibility) without ever touching the encrypted credentials blob.
   * `credsUnreadable` lets the caller skip a duplicate
   * `isUnreadableCredentials` call when it already has the result.
   */
  private buildIntegrationMeta(
    entity: Integration,
    credsUnreadable: boolean = isUnreadableCredentials(entity.credentials),
  ): IntegrationMeta {
    if (entity.serviceType === 'cafe24' && !credsUnreadable) {
      const appType = entity.credentials?.app_type;
      if (appType === 'public' || appType === 'private') {
        return { appType };
      }
    }
    return { appType: null };
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

  private async dispatchTest(
    serviceType: string,
    authType: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationTestResult> {
    // Step 1: structural validation always runs first — the transport probe
    // would just fail with a less-actionable error if required fields are
    // missing.
    const errors = validateCredentials(serviceType, authType, credentials);
    if (errors.length) {
      return { success: false, message: errors.join('; ') };
    }
    // Step 2: services with a registered transport tester perform a real
    // round-trip; the rest fall back to the structural-only "ok" until a
    // transport tester is added for them.
    const tester = this.transportTesters.get(serviceType);
    if (tester) {
      return tester(authType, credentials);
    }
    return {
      success: true,
      message: 'Connection successful',
    };
  }

  private async testMcpTransport(
    authType: string,
    credentials: Record<string, unknown>,
  ): Promise<IntegrationTestResult> {
    const result = await this.mcpTestConnection.test(
      this.toMcpConnectParams(authType, credentials),
    );
    if (result.success) {
      return {
        success: true,
        message: result.message,
        capabilities: result.capabilities,
        serverInfo: result.serverInfo,
        preview: result.preview,
      };
    }
    return {
      success: false,
      message: result.message,
      code: result.code ?? 'MCP_CONNECT_FAILED',
    };
  }

  /**
   * Converts the validated `Integration.credentials` JSONB shape into the
   * discriminated union {@link McpConnectParams} that {@link McpClientService}
   * accepts. Validation has already ensured required fields exist.
   */
  private toMcpConnectParams(
    authType: string,
    credentials: Record<string, unknown>,
  ): McpConnectParams {
    const url = credentials.url as string;
    const defaultHeaders = credentials.default_headers as
      | Record<string, string>
      | undefined;
    if (authType === 'bearer_token') {
      return {
        authType: 'bearer_token',
        url,
        token: credentials.token as string,
        defaultHeaders,
      };
    }
    if (authType === 'api_key') {
      return {
        authType: 'api_key',
        url,
        headerName: credentials.header_name as string,
        value: credentials.value as string,
        defaultHeaders,
      };
    }
    return { authType: 'none', url, defaultHeaders };
  }

  async resolveRole(
    workspaceId: string,
    userId: string,
  ): Promise<string | null> {
    return this.workspacesService.getMemberRole(workspaceId, userId);
  }
}
