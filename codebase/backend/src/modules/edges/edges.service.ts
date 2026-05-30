import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Edge } from './entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { assertWorkflowInWorkspace } from '../workflows/workflow-ownership.util';
import { CreateEdgeDto } from './dto/create-edge.dto';

@Injectable()
export class EdgesService {
  constructor(
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  async findByWorkflow(
    workflowId: string,
    workspaceId: string,
  ): Promise<Edge[]> {
    await assertWorkflowInWorkspace(
      this.workflowRepository,
      workflowId,
      workspaceId,
    );
    return this.edgeRepository.find({
      where: { workflowId },
    });
  }

  async create(
    workflowId: string,
    workspaceId: string,
    dto: CreateEdgeDto,
  ): Promise<Edge> {
    await assertWorkflowInWorkspace(
      this.workflowRepository,
      workflowId,
      workspaceId,
    );
    if (dto.sourceNodeId === dto.targetNodeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Self-loop connections are not allowed',
      });
    }

    const edge = this.edgeRepository.create({
      ...dto,
      workflowId,
    });
    return this.edgeRepository.save(edge);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    // Single query: load the edge with its workflow relation and verify the
    // workflow belongs to the caller's workspace. A miss (no row, or a row in a
    // foreign workspace) throws the same NotFoundException so callers cannot
    // probe foreign-workspace rows (IDOR guard).
    const edge = await this.edgeRepository.findOne({
      where: { id },
      relations: ['workflow'],
    });
    if (!edge || edge.workflow?.workspaceId !== workspaceId) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Edge not found',
      });
    }
    await this.edgeRepository.remove(edge);
  }
}
