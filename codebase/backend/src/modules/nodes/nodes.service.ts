import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { omitUndefined } from '../../common/utils/omit-undefined';
import {
  type InvalidReference,
  throwInvalidReferences,
} from '../../common/utils/reference-in-scope';
import { Node } from './entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { assertWorkflowInWorkspace } from '../workflows/workflow-ownership.util';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';

@Injectable()
export class NodesService {
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  async findByWorkflow(
    workflowId: string,
    workspaceId: string,
  ): Promise<Node[]> {
    await assertWorkflowInWorkspace(
      this.workflowRepository,
      workflowId,
      workspaceId,
    );
    return this.nodeRepository.find({
      where: { workflowId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    workflowId: string,
    workspaceId: string,
    dto: CreateNodeDto,
  ): Promise<Node> {
    await assertWorkflowInWorkspace(
      this.workflowRepository,
      workflowId,
      workspaceId,
    );
    await this.assertLabelUnique(workflowId, dto.label);
    await this.assertPlacementInWorkflow(workflowId, dto);
    const node = this.nodeRepository.create({ ...dto, workflowId });
    return this.saveWithUniqueConstraint(node);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateNodeDto,
  ): Promise<Omit<Node, 'workflow'>> {
    // Single query: load the node with its workflow relation and verify the
    // workflow belongs to the caller's workspace. A miss (no row, or a row in a
    // foreign workspace) throws the same NotFoundException so callers cannot
    // probe foreign-workspace rows (IDOR guard).
    const node = await this.nodeRepository.findOne({
      where: { id },
      relations: { workflow: true },
    });
    if (!node || node.workflow?.workspaceId !== workspaceId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Node not found',
      });
    }
    if (dto.label !== undefined && dto.label !== node.label) {
      await this.assertLabelUnique(node.workflowId, dto.label, id);
    }
    await this.assertPlacementInWorkflow(node.workflowId, dto);
    // 보내지 않은 필드는 뺀다(이유는 `omitUndefined` JSDoc). 빼지 않으면 응답에 `description` · `containerId` 가
    // null 로 실리고 위치 · 설정 · 비활성 여부가 빠졌다 — `test/patch-partial-body.e2e-spec.ts` 가 고정한다.
    Object.assign(node, omitUndefined(dto));
    const saved = await this.saveWithUniqueConstraint(node);
    // IDOR 검사에 쓰려고 함께 읽은 `workflow` 관계는 응답이 아니다 — `NodeDto` 가 선언하지 않는데 부모 워크플로 행이 통째로
    // 실렸다(`test/patch-partial-body.e2e-spec.ts` 의 계약 대조가 드러냈다).
    const { workflow: _workflow, ...response } = saved;
    return response;
  }

  /**
   * `containerId` · `toolOwnerId` 는 **같은 워크플로**의 노드만 가리킨다(spec 1-data-model §1.1). 종전엔 다른 워크플로 — 다른
   * 워크스페이스 포함 — 의 노드를 그대로 저장했다(엔진은 워크플로 단위로 읽은 노드 안에서만 매칭해 그 노드는 조용히 실행되지 않았다).
   * type · 순환 검사는 여기서 하지 않는다 — 실행 시점 몫이다(spec data-flow/11-workflow §1.2).
   */
  private async assertPlacementInWorkflow(
    workflowId: string,
    dto: { containerId?: string | null; toolOwnerId?: string | null },
  ): Promise<void> {
    const refs: Array<{ field: string; id: string; what: string }> = [];
    if (dto.containerId != null) {
      refs.push({
        field: 'containerId',
        id: dto.containerId,
        what: 'Container',
      });
    }
    if (dto.toolOwnerId != null) {
      refs.push({
        field: 'toolOwnerId',
        id: dto.toolOwnerId,
        what: 'Tool owner',
      });
    }
    if (refs.length === 0) return;
    // 엣지 끝점 검사(`EdgesService.assertEndpointsInWorkflow`)와 같은 형태 — 한 번의 `In()` 조회로 전부 본다.
    const found = await this.nodeRepository.find({
      where: { id: In(refs.map((ref) => ref.id)), workflowId },
      select: { id: true },
    });
    const foundIds = new Set(found.map((node) => node.id));
    const invalid: InvalidReference[] = refs
      .filter((ref) => !foundIds.has(ref.id))
      .map((ref) => ({
        field: ref.field,
        message: `${ref.what} node not found in this workflow`,
      }));
    if (invalid.length > 0) throwInvalidReferences(invalid);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    // Single query with workflow relation + workspace check (IDOR guard).
    const node = await this.nodeRepository.findOne({
      where: { id },
      relations: { workflow: true },
    });
    if (!node || node.workflow?.workspaceId !== workspaceId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Node not found',
      });
    }
    await this.nodeRepository.remove(node);
  }

  /**
   * Internal batch helper — has no current HTTP route. If exposed later, the
   * controller must pass `@WorkspaceId() workspaceId` (the workspace guard
   * below is already wired) so the cross-workspace IDOR guarantee holds.
   */
  async bulkCreate(
    workflowId: string,
    workspaceId: string,
    dtos: CreateNodeDto[],
  ): Promise<Node[]> {
    await assertWorkflowInWorkspace(
      this.workflowRepository,
      workflowId,
      workspaceId,
    );
    // O(n) batch duplicate detection using Set
    const seen = new Set<string>();
    for (const dto of dtos) {
      if (seen.has(dto.label)) {
        throw new ConflictException({
          code: 'DUPLICATE_NODE_LABEL',
          message: `Duplicate node label in batch: "${dto.label}"`,
        });
      }
      seen.add(dto.label);
    }

    // Check only conflicting labels against DB (not full node list)
    const batchLabels = dtos.map((d) => d.label);
    const conflicts = await this.nodeRepository.find({
      where: { workflowId, label: In(batchLabels) },
      select: { label: true },
    });
    if (conflicts.length > 0) {
      throw new ConflictException({
        code: 'DUPLICATE_NODE_LABEL',
        message: `A node with label "${conflicts[0].label}" already exists in this workflow`,
      });
    }

    const nodes = dtos.map((dto) =>
      this.nodeRepository.create({ ...dto, workflowId }),
    );
    return this.saveWithUniqueConstraint(nodes);
  }

  /**
   * Checks that no other node in the same workflow has the given label.
   * @param excludeNodeId - Node ID to exclude from the check (used during update/rename)
   * @throws ConflictException if a node with the same label already exists
   */
  private async assertLabelUnique(
    workflowId: string,
    label: string,
    excludeNodeId?: string,
  ): Promise<void> {
    const where: Record<string, unknown> = { workflowId, label };
    if (excludeNodeId) {
      where.id = Not(excludeNodeId);
    }
    const existing = await this.nodeRepository.findOne({ where });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_NODE_LABEL',
        message: `A node with label "${label}" already exists in this workflow`,
      });
    }
  }

  private async saveWithUniqueConstraint(node: Node): Promise<Node>;
  private async saveWithUniqueConstraint(nodes: Node[]): Promise<Node[]>;
  private async saveWithUniqueConstraint(
    nodeOrNodes: Node | Node[],
  ): Promise<Node | Node[]> {
    try {
      if (Array.isArray(nodeOrNodes)) {
        return await this.nodeRepository.save(nodeOrNodes);
      }
      return await this.nodeRepository.save(nodeOrNodes);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code?: unknown }).code === '23505'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_NODE_LABEL',
          message: 'A node with this label already exists in this workflow',
        });
      }
      throw err;
    }
  }
}
