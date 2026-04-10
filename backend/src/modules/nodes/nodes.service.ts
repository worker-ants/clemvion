import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';

@Injectable()
export class NodesService {
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
  ) {}

  async findByWorkflow(workflowId: string): Promise<Node[]> {
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

  async create(workflowId: string, dto: CreateNodeDto): Promise<Node> {
    await this.assertLabelUnique(workflowId, dto.label);
    const node = this.nodeRepository.create({ ...dto, workflowId });
    return this.saveWithUniqueConstraint(node);
  }

  async update(id: string, dto: UpdateNodeDto): Promise<Node> {
    const node = await this.findById(id);
    if (dto.label !== undefined && dto.label !== node.label) {
      await this.assertLabelUnique(node.workflowId, dto.label, id);
    }
    Object.assign(node, dto);
    return this.saveWithUniqueConstraint(node);
  }

  async remove(id: string): Promise<void> {
    const node = await this.findById(id);
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

  /** Saves node(s) and catches DB unique constraint violations as ConflictException. */
  private async saveWithUniqueConstraint(
    nodeOrNodes: Node | Node[],
  ): Promise<any> {
    try {
      return await this.nodeRepository.save(nodeOrNodes as any);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as any).code === '23505'
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
