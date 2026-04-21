import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';
import { Integration } from '../../integrations/entities/integration.entity';
import { KnowledgeBase } from '../../knowledge-base/entities/knowledge-base.entity';
import { NodeComponentRegistry } from '../../../nodes/core/node-component.registry';
import { redactConfig } from './redact';

/**
 * Read-only "Clarify" 도구들. 모두 `workspace_id` 스코프로 격리되어 있으며,
 * LLM이 사용자의 질문 수를 줄이거나 기존 자산을 참조하는 데 쓴다.
 *
 * Architecture note: intentionally depends on Repositories rather than on
 * `WorkflowsService` / `IntegrationsService` / `KnowledgeBaseService`. Those
 * services expose DTO-wrapped, pagination-aware list methods tailored to
 * their own controllers; here we need minimal read shapes shaped for an LLM
 * tool result. The workspace boundary — the only security-critical filter —
 * is enforced on every query below via `workspace_id = :workspaceId`. If
 * another layer of business logic (e.g. RBAC visibility) lands on those
 * services later, replace the Repository injection with the service DI at
 * that point to inherit the new rule.
 */
@Injectable()
export class ExploreToolsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepo: Repository<Workflow>,
    @InjectRepository(Node)
    private readonly nodeRepo: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepo: Repository<Edge>,
    @InjectRepository(Integration)
    private readonly integrationRepo: Repository<Integration>,
    @InjectRepository(KnowledgeBase)
    private readonly kbRepo: Repository<KnowledgeBase>,
    private readonly nodeRegistry: NodeComponentRegistry,
  ) {}

  getNodeSchema(type: string): unknown {
    const component = this.nodeRegistry.getComponent(type);
    if (!component) return { ok: false, error: 'UNKNOWN_NODE_TYPE' };
    const defs = this.nodeRegistry
      .listDefinitions()
      .find((d) => d.metadata.type === type);
    if (!defs) return { ok: false, error: 'UNKNOWN_NODE_TYPE' };
    return {
      ok: true,
      type,
      metadata: defs.metadata,
      ports: defs.ports,
      configSchema: defs.configSchema,
      defaultConfig: defs.defaultConfig,
      inputSchema: defs.inputSchema,
      outputSchema: defs.outputSchema,
    };
  }

  async listIntegrations(
    workspaceId: string,
    category?: string,
  ): Promise<unknown> {
    const qb = this.integrationRepo
      .createQueryBuilder('i')
      .where('i.workspace_id = :workspaceId', { workspaceId });
    if (category) {
      qb.andWhere('i.service_type = :t', { t: category });
    }
    qb.orderBy('i.created_at', 'DESC').limit(50);
    const rows = await qb.getMany();
    return {
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        serviceType: r.serviceType,
        scope: r.scope,
        status: r.status,
      })),
    };
  }

  async listWorkflows(
    workspaceId: string,
    opts: { search?: string; limit?: number; excludeId?: string } = {},
  ): Promise<unknown> {
    const qb = this.workflowRepo
      .createQueryBuilder('w')
      .where('w.workspace_id = :workspaceId', { workspaceId });
    if (opts.search) {
      qb.andWhere('w.name ILIKE :s', { s: `%${opts.search}%` });
    }
    if (opts.excludeId) {
      qb.andWhere('w.id != :exclude', { exclude: opts.excludeId });
    }
    qb.orderBy('w.updated_at', 'DESC').limit(Math.min(opts.limit ?? 20, 50));
    const rows = await qb.getMany();
    return {
      ok: true,
      items: rows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        tags: w.tags,
        updatedAt: w.updatedAt,
      })),
    };
  }

  async getWorkflow(
    workspaceId: string,
    id: string,
    mode: 'summary' | 'full' = 'summary',
  ): Promise<unknown> {
    const workflow = await this.workflowRepo.findOne({
      where: { id, workspaceId },
    });
    if (!workflow) return { ok: false, error: 'NOT_FOUND' };
    // Nodes and edges are independent reads — run them in parallel to keep
    // tool latency low when the LLM chains several exploration calls.
    const [nodes, edges] = await Promise.all([
      this.nodeRepo.find({ where: { workflowId: id } }),
      this.edgeRepo.find({ where: { workflowId: id } }),
    ]);
    return {
      ok: true,
      name: workflow.name,
      description: workflow.description,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        category: n.category,
        ...(mode === 'full' ? { config: redactConfig(n.config ?? {}) } : {}),
      })),
      edges: edges.map((e) => ({
        source: e.sourceNodeId,
        sourcePort: e.sourcePort,
        target: e.targetNodeId,
        targetPort: e.targetPort,
        type: e.type,
      })),
    };
  }

  async listKnowledgeBases(workspaceId: string): Promise<unknown> {
    const rows = await this.kbRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return {
      ok: true,
      items: rows.map((k) => ({ id: k.id, name: k.name })),
    };
  }
}
