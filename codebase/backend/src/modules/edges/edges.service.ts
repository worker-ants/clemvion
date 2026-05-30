import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Edge } from './entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { CreateEdgeDto } from './dto/create-edge.dto';

@Injectable()
export class EdgesService {
  constructor(
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  /**
   * Cross-workspace IDOR guard: ensure the workflow belongs to the caller's
   * workspace before any edge read/mutation. Mirrors WorkflowsService.findById
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
  ): Promise<Edge[]> {
    await this.assertWorkflowInWorkspace(workflowId, workspaceId);
    return this.edgeRepository.find({
      where: { workflowId },
    });
  }

  async create(
    workflowId: string,
    workspaceId: string,
    dto: CreateEdgeDto,
  ): Promise<Edge> {
    await this.assertWorkflowInWorkspace(workflowId, workspaceId);
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
    const edge = await this.edgeRepository.findOne({ where: { id } });
    if (!edge) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Edge not found',
      });
    }
    await this.assertWorkflowInWorkspace(edge.workflowId, workspaceId);
    await this.edgeRepository.remove(edge);
  }
}
