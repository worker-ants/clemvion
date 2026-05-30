import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
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

  /**
   * Cross-workspace IDOR guard: ensure the workflow belongs to the caller's
   * workspace before any node read/mutation. Mirrors WorkflowsService.findById
   * NotFoundException shape so callers cannot probe foreign-workspace rows.
   */
  private async assertWorkflowInWorkspace(
    workflowId: string,
    workspaceId: string,
  ): Promise<void> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, workspaceId },
    });
    if (!workflow) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workflow not found',
      });
    }
  }

  async findByWorkflow(
    workflowId: string,
    workspaceId: string,
  ): Promise<Node[]> {
    await this.assertWorkflowInWorkspace(workflowId, workspaceId);
    return this.nodeRepository.find({
      where: { workflowId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Node> {
    const node = await this.nodeRepository.findOne({ where: { id } });
    if (!node) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Node not found',
      });
    }
    return node;
  }

  async create(
    workflowId: string,
    workspaceId: string,
    dto: CreateNodeDto,
  ): Promise<Node> {
    await this.assertWorkflowInWorkspace(workflowId, workspaceId);
    await this.assertLabelUnique(workflowId, dto.label);
    const node = this.nodeRepository.create({ ...dto, workflowId });
    return this.saveWithUniqueConstraint(node);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateNodeDto,
  ): Promise<Node> {
    const node = await this.findById(id);
    await this.assertWorkflowInWorkspace(node.workflowId, workspaceId);
    if (dto.label !== undefined && dto.label !== node.label) {
      await this.assertLabelUnique(node.workflowId, dto.label, id);
    }
    Object.assign(node, dto);
    return this.saveWithUniqueConstraint(node);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const node = await this.findById(id);
    await this.assertWorkflowInWorkspace(node.workflowId, workspaceId);
    await this.nodeRepository.remove(node);
  }

  async bulkCreate(workflowId: string, dtos: CreateNodeDto[]): Promise<Node[]> {
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
      select: ['label'],
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
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_NODE_LABEL',
          message: 'A node with this label already exists in this workflow',
        });
      }
      throw error;
    }
  }
}
