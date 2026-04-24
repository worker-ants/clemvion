import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Node } from '../../nodes/entities/node.entity';
import { Edge } from '../../edges/entities/edge.entity';
import { Integration } from '../../integrations/entities/integration.entity';
import { KnowledgeBase } from '../../knowledge-base/entities/knowledge-base.entity';
import { Execution } from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { NodeComponentRegistry } from '../../../nodes/core/node-component.registry';
import { maskSensitiveFields } from '../../../common/utils/mask-sensitive-fields.util';
import { redactConfig } from './redact';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `get_workflow_executions` 와 `get_execution_details` 에 대한 상한. spec
 * §4.1 의 "기본 10, 상한 50" 규약을 한 자리에서 관리한다.
 */
const EXECUTIONS_LIST_DEFAULT_LIMIT = 10;
const EXECUTIONS_LIST_MAX_LIMIT = 50;

/**
 * 단일 실행의 timeline row 수 상한. 루프 노드가 수천 번 회전한 실행을 그대로
 * 직렬화하면 LLM 컨텍스트를 터뜨리므로 여기서 잘라내고 `timelineTruncated`
 * 플래그로 신호한다. 스펙 §4.1.1 에 문구 추가됨.
 */
const TIMELINE_ROW_CAP = 500;

/**
 * `get_execution_details` 가 자동으로 펼치는 sub-workflow 자식 실행 깊이.
 * 2 depth 이상 자손은 `subExecutionsTruncatedDepth` 힌트로 신호해 LLM 이
 * 필요 시 해당 자식 id 로 한 번 더 호출해 내려가도록 유도한다.
 */
const SUB_EXECUTION_INCLUDED_DEPTH = 1;

export const EXECUTION_STATUS_VALUES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'waiting_for_input',
] as const;
type ExecutionStatusFilter = (typeof EXECUTION_STATUS_VALUES)[number];

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
    @InjectRepository(Execution)
    private readonly executionRepo: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepo: Repository<NodeExecution>,
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
    // Gemini는 schema에서 format:'uuid' 힌트가 sanitize로 제거된 상태라 종종
    // 'current_workflow_id_placeholder' 같은 가짜 값을 넣어 호출한다. 이때
    // 그대로 DB로 보내면 Postgres가 `invalid input syntax for type uuid` 500
    // 을 뱉고 어시스턴트 전체 turn이 깨지므로, 여기서 방어적으로 검사해 LLM이
    // 다음 턴에 복구할 수 있도록 tool_result로 반환한다.
    if (!UUID_RE.test(id)) {
      return {
        ok: false,
        error: 'INVALID_ID',
        hint: 'id must be a UUID obtained from list_workflows(). Do not invent placeholders.',
      };
    }
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

  /**
   * 현재 세션 워크플로의 최근 실행 목록을 요약 형태로 반환한다 (spec §4.1).
   * 명시적으로 `workflowId` 를 인자로 받지 않는 이유는 스코프 경계를 한 곳에서
   * 강제하기 위함이며, 호출자(stream service)가 세션의 `workflowId` 를 그대로
   * 넘긴다. 토큰 경제상 각 항목은 detail 없이 상태/타이밍/노드 카운트 요약만
   * 담는다; 사용자가 특정 id 를 특정하면 `getExecutionDetails` 로 깊이 파고든다.
   */
  async getWorkflowExecutions(
    workspaceId: string,
    workflowId: string,
    opts: { limit?: number; status?: string } = {},
  ): Promise<unknown> {
    if (!UUID_RE.test(workflowId)) {
      return {
        ok: false,
        error: 'INVALID_ID',
        hint: 'workflowId must be a UUID from the current session context.',
      };
    }

    // workspace 경계 확인 — 세션 workflowId 가 워크스페이스 밖이면 조회 자체를
    // 거부해 cross-workspace 정보 누출을 원천 차단한다.
    const workflow = await this.workflowRepo.findOne({
      where: { id: workflowId, workspaceId },
    });
    if (!workflow) {
      return { ok: false, error: 'WORKFLOW_NOT_FOUND' };
    }

    const limit = clampLimit(opts.limit);
    const status = normalizeStatusFilter(opts.status);

    const qb = this.executionRepo
      .createQueryBuilder('e')
      .where('e.workflow_id = :workflowId', { workflowId });
    if (status) {
      qb.andWhere('e.status = :status', { status });
    }
    qb.orderBy('e.started_at', 'DESC').limit(limit);
    const executions = await qb.getMany();

    // 노드 카운트를 한 번의 쿼리로 모아 N+1 을 피한다.
    const executionIds = executions.map((e) => e.id);
    const nodeStatsById = await this.loadNodeStats(executionIds);

    return {
      ok: true,
      workflowId,
      workflowName: workflow.name,
      items: executions.map((e) => ({
        id: e.id,
        status: e.status,
        startedAt: e.startedAt,
        finishedAt: e.finishedAt ?? null,
        durationMs: e.durationMs ?? null,
        triggerId: e.triggerId ?? null,
        nodeStats: nodeStatsById.get(e.id) ?? {
          total: 0,
          completed: 0,
          failed: 0,
        },
      })),
    };
  }

  /**
   * 단일 실행의 전체 타임라인 + 직계 자식 sub-workflow 실행(depth 1) 을 묶어
   * 반환한다 (spec §4.1.1). 스코프 허용 조건은 두 가지:
   *   (a) execution.workflowId === 현재 세션 workflowId
   *   (b) execution.parentExecutionId 의 부모가 현재 세션 workflowId 의 실행
   * 둘 다 만족하지 못하면 EXECUTION_NOT_IN_SCOPE. workspace 경계 밖 id 는
   * EXECUTION_NOT_FOUND 로 통합해 존재 여부 누출을 막는다.
   *
   * 자식 실행 내부에 추가 sub-workflow 자손이 존재할 경우, 응답을 2 단계 이상
   * 펼치지 않고 `subExecutionsTruncatedDepth: 1` 힌트로 "더 깊은 자손이 있다"
   * 고 신호한다; LLM 이 필요하면 해당 자식 실행 id 를 한 번 더 호출한다.
   */
  async getExecutionDetails(
    workspaceId: string,
    currentWorkflowId: string,
    executionId: string,
  ): Promise<unknown> {
    if (!UUID_RE.test(executionId)) {
      return {
        ok: false,
        error: 'INVALID_ID',
        hint: 'id must be a UUID obtained from get_workflow_executions().',
      };
    }

    const execution = await this.executionRepo.findOne({
      where: { id: executionId },
      relations: ['workflow'],
    });
    if (!execution || execution.workflow?.workspaceId !== workspaceId) {
      // workspace 밖 id 도 NOT_FOUND 로 합쳐 존재 여부 추론을 막는다.
      return { ok: false, error: 'EXECUTION_NOT_FOUND' };
    }

    const inScope = await this.isExecutionInScope(
      execution,
      workspaceId,
      currentWorkflowId,
    );
    if (!inScope) {
      return { ok: false, error: 'EXECUTION_NOT_IN_SCOPE' };
    }

    // 본 실행 timeline + 직계 자식 실행 목록은 서로 독립적이라 병렬로 로드해
    // 전체 응답 지연을 줄인다. 자식 실행 내부의 timeline 도 `In(childIds)` 한
    // 번으로 모아 N+1 을 피한다.
    const [timelineResult, directChildren] = await Promise.all([
      this.loadTimeline(execution.id),
      this.executionRepo.find({
        where: { parentExecutionId: execution.id },
        relations: ['workflow'],
        order: { startedAt: 'ASC' },
      }),
    ]);

    const childIds = directChildren.map((c) => c.id);
    const [childTimelineMap, deeperExists] = await Promise.all([
      this.loadTimelinesByExecutionIds(childIds),
      // 2-depth 자손 존재 여부를 `getMany().limit(1)` 로 확인.
      // TypeORM 의 `getCount()` 는 LIMIT 를 무시하므로 사용하지 않는다.
      childIds.length > 0
        ? this.executionRepo
            .createQueryBuilder('e')
            .where('e.parent_execution_id IN (:...childIds)', { childIds })
            .limit(1)
            .getMany()
            .then((rows) => rows.length > 0)
        : Promise.resolve(false),
    ]);

    const subExecutions = directChildren
      .map((child) => ({
        execution: this.toExecutionEnvelope(child, child.workflow?.name),
        timeline: childTimelineMap.get(child.id) ?? {
          rows: [],
          truncated: false,
        },
      }))
      .map((entry) => ({
        execution: entry.execution,
        timeline: entry.timeline.rows,
        ...(entry.timeline.truncated ? { timelineTruncated: true } : {}),
      }));

    return {
      ok: true,
      execution: this.toExecutionEnvelope(execution, execution.workflow?.name),
      timeline: timelineResult.rows,
      ...(timelineResult.truncated ? { timelineTruncated: true } : {}),
      subExecutions,
      ...(deeperExists
        ? { subExecutionsTruncatedDepth: SUB_EXECUTION_INCLUDED_DEPTH }
        : {}),
    };
  }

  private async isExecutionInScope(
    execution: Execution,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<boolean> {
    if (execution.workflowId === currentWorkflowId) return true;
    if (!execution.parentExecutionId) return false;
    // 부모 조회에도 workspace 조건을 함께 걸어 cross-workspace ancestor 우회를
    // 방지한다. execution.workflow.workspaceId 는 현재 호출에서 이미
    // workspace 일치가 검증됐지만, 부모 chain 은 별도 검사가 필요하다.
    const parent = await this.executionRepo.findOne({
      where: { id: execution.parentExecutionId },
      relations: ['workflow'],
    });
    if (!parent || parent.workflow?.workspaceId !== workspaceId) return false;
    return parent.workflowId === currentWorkflowId;
  }

  private async loadTimeline(
    executionId: string,
  ): Promise<{ rows: Array<Record<string, unknown>>; truncated: boolean }> {
    // 상한+1 로 페치해 실제 초과 여부를 판정 — 정확히 TIMELINE_ROW_CAP 개가
    // 담긴 실행은 잘림 플래그 없이 그대로 내려간다.
    const raw = await this.nodeExecutionRepo.find({
      where: { executionId },
      relations: ['node'],
      order: { startedAt: 'ASC' },
      take: TIMELINE_ROW_CAP + 1,
    });
    const truncated = raw.length > TIMELINE_ROW_CAP;
    const rows = (truncated ? raw.slice(0, TIMELINE_ROW_CAP) : raw).map((ne) =>
      this.toNodeExecutionEnvelope(ne),
    );
    return { rows, truncated };
  }

  /**
   * 다수 실행의 timeline 을 한 번의 쿼리로 모은다 — 직계 자식 실행의 timeline
   * 을 개별 쿼리로 뽑을 때 발생하던 N+1 을 제거한다. 실행별 상한은 개별
   * `loadTimeline` 과 동일하게 `TIMELINE_ROW_CAP` 을 적용하되, 한 번의 쿼리로
   * 부르는 특성상 개별 실행의 초과 여부는 로드 후 그룹별로 카운트해서 판단한다.
   */
  private async loadTimelinesByExecutionIds(
    executionIds: string[],
  ): Promise<
    Map<string, { rows: Array<Record<string, unknown>>; truncated: boolean }>
  > {
    const map = new Map<
      string,
      { rows: Array<Record<string, unknown>>; truncated: boolean }
    >();
    if (executionIds.length === 0) return map;
    // 각 id 당 상한+1 을 보수적으로 허용. 실제 overshoot 는 그룹핑 후 절단.
    const limit = executionIds.length * (TIMELINE_ROW_CAP + 1);
    const rows = await this.nodeExecutionRepo.find({
      where: { executionId: In(executionIds) },
      relations: ['node'],
      order: { executionId: 'ASC', startedAt: 'ASC' },
      take: limit,
    });
    for (const id of executionIds) {
      map.set(id, { rows: [], truncated: false });
    }
    for (const ne of rows) {
      const entry = map.get(ne.executionId);
      if (!entry) continue;
      if (entry.rows.length >= TIMELINE_ROW_CAP) {
        entry.truncated = true;
        continue;
      }
      entry.rows.push(this.toNodeExecutionEnvelope(ne));
    }
    return map;
  }

  private toNodeExecutionEnvelope(ne: NodeExecution): Record<string, unknown> {
    return {
      nodeExecutionId: ne.id,
      nodeId: ne.nodeId,
      nodeLabel: ne.node?.label ?? null,
      nodeType: ne.node?.type ?? null,
      status: ne.status,
      startedAt: ne.startedAt,
      finishedAt: ne.finishedAt ?? null,
      durationMs: ne.durationMs ?? null,
      inputData: maskSensitiveFields(ne.inputData ?? null),
      outputData: maskSensitiveFields(ne.outputData ?? null),
      error: maskSensitiveFields(ne.error ?? null),
      retryCount: ne.retryCount,
      parentNodeExecutionId: ne.parentNodeExecutionId ?? null,
    };
  }

  private toExecutionEnvelope(
    e: Execution,
    workflowName: string | undefined,
  ): Record<string, unknown> {
    return {
      id: e.id,
      workflowId: e.workflowId,
      workflowName: workflowName ?? null,
      status: e.status,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt ?? null,
      durationMs: e.durationMs ?? null,
      inputData: maskSensitiveFields(e.inputData ?? null),
      outputData: maskSensitiveFields(e.outputData ?? null),
      error: maskSensitiveFields(e.error ?? null),
      parentExecutionId: e.parentExecutionId ?? null,
      recursionDepth: e.recursionDepth ?? 0,
    };
  }

  /**
   * 실행 id 집합에 대한 노드 실행 통계를 DB 에서 그룹 집계해 반환한다. 이전
   * 구현은 모든 `node_execution` row 를 가져와 앱 레벨에서 루프를 돌려 집계
   * 했으나, 루프 노드가 수천 번 돈 실행이 섞여 있으면 불필요한 메모리
   * 부하가 생겼다. GROUP BY 쿼리로 대체하면 반환 row 수는 `executionIds ×
   * 상태종류` 로 고정된다.
   */
  private async loadNodeStats(
    executionIds: string[],
  ): Promise<
    Map<string, { total: number; completed: number; failed: number }>
  > {
    const map = new Map<
      string,
      { total: number; completed: number; failed: number }
    >();
    if (executionIds.length === 0) return map;
    for (const id of executionIds) {
      map.set(id, { total: 0, completed: 0, failed: 0 });
    }
    const rows = await this.nodeExecutionRepo
      .createQueryBuilder('ne')
      .select('ne.execution_id', 'executionId')
      .addSelect('ne.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('ne.execution_id IN (:...ids)', { ids: executionIds })
      .groupBy('ne.execution_id')
      .addGroupBy('ne.status')
      .getRawMany<{ executionId: string; status: string; count: string }>();
    // raw 쿼리 결과는 `status` 가 string 이라 enum 과의 직접 비교가 lint 에 걸려,
    // 값을 string 로 좁혀 비교한다 (런타임 동치).
    const COMPLETED: string = NodeExecutionStatus.COMPLETED;
    const FAILED: string = NodeExecutionStatus.FAILED;
    for (const r of rows) {
      const stat = map.get(r.executionId);
      if (!stat) continue;
      const n = Number(r.count) || 0;
      stat.total += n;
      if (r.status === COMPLETED) stat.completed += n;
      else if (r.status === FAILED) stat.failed += n;
    }
    return map;
  }
}

function clampLimit(requested: number | undefined): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return EXECUTIONS_LIST_DEFAULT_LIMIT;
  }
  return Math.max(
    1,
    Math.min(Math.floor(requested), EXECUTIONS_LIST_MAX_LIMIT),
  );
}

function normalizeStatusFilter(
  status: string | undefined,
): ExecutionStatusFilter | undefined {
  if (!status) return undefined;
  return (EXECUTION_STATUS_VALUES as readonly string[]).includes(status)
    ? (status as ExecutionStatusFilter)
    : undefined;
}
