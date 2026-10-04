import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Edge } from './entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { Node } from '../nodes/entities/node.entity';
import {
  type InvalidReference,
  throwInvalidReferences,
} from '../../common/utils/reference-in-scope';
import { assertWorkflowInWorkspace } from '../workflows/workflow-ownership.util';
import { CreateEdgeDto } from './dto/create-edge.dto';

@Injectable()
export class EdgesService {
  constructor(
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
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
    await this.assertEndpointsInWorkflow(workflowId, dto);

    const edge = this.edgeRepository.create({
      ...dto,
      workflowId,
    });
    return this.edgeRepository.save(edge);
  }

  /**
   * 두 끝점은 **같은 워크플로**의 노드만(spec 1-data-model §1.1). 종전엔 다른 워크플로 — 다른 워크스페이스 포함 — 의 노드를 그대로
   * 저장했고, 없는 id 는 FK 위반(500)이었다. 틀린 끝점은 둘 다 싣는다.
   */
  private async assertEndpointsInWorkflow(
    workflowId: string,
    dto: CreateEdgeDto,
  ): Promise<void> {
    const found = await this.nodeRepository.find({
      where: { id: In([dto.sourceNodeId, dto.targetNodeId]), workflowId },
      select: { id: true },
    });
    const foundIds = new Set(found.map((node) => node.id));
    const invalid: InvalidReference[] = [];
    if (!foundIds.has(dto.sourceNodeId)) {
      invalid.push({
        field: 'sourceNodeId',
        message: 'Source node not found in this workflow',
      });
    }
    if (!foundIds.has(dto.targetNodeId)) {
      invalid.push({
        field: 'targetNodeId',
        message: 'Target node not found in this workflow',
      });
    }
    if (invalid.length > 0) throwInvalidReferences(invalid);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    // Single query: load the edge with its workflow relation and verify the
    // workflow belongs to the caller's workspace. A miss (no row, or a row in a
    // foreign workspace) throws the same NotFoundException so callers cannot
    // probe foreign-workspace rows (IDOR guard).
    const edge = await this.edgeRepository.findOne({
      where: { id },
      relations: { workflow: true },
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
