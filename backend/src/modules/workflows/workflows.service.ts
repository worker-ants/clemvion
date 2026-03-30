import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge, EdgeType } from '../edges/entities/edge.entity';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { QueryWorkflowDto } from './dto/query-workflow.dto';
import { SaveCanvasDto } from './dto/save-canvas.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

const MANUAL_TRIGGER_TYPE = 'manual_trigger';
const MANUAL_TRIGGER_DEFAULT_POSITION = { x: 250, y: 300 };

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    workspaceId: string,
    query: QueryWorkflowDto,
  ): Promise<PaginatedResponseDto<Workflow>> {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      search,
      status,
      tag,
      folderId,
    } = query;

    const qb = this.workflowRepository
      .createQueryBuilder('w')
      .where('w.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('w.name ILIKE :search', { search: `%${search}%` });
    }
    if (status === 'active') {
      qb.andWhere('w.is_active = true');
    } else if (status === 'inactive') {
      qb.andWhere('w.is_active = false');
    }
    if (tag) {
      qb.andWhere(':tag = ANY(w.tags)', { tag });
    }
    if (folderId) {
      qb.andWhere('w.folder_id = :folderId', { folderId });
    }

    const sortColumn = this.getSortColumn(sort);
    qb.orderBy(`w.${sortColumn}`, order.toUpperCase() as 'ASC' | 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id, workspaceId },
    });
    if (!workflow) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workflow not found',
      });
    }
    return workflow;
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateWorkflowDto,
  ): Promise<Workflow> {
    return this.dataSource.transaction(async (manager) => {
      const workflow = manager.create(Workflow, {
        ...dto,
        workspaceId,
        createdBy: userId,
      });
      const savedWorkflow = await manager.save(Workflow, workflow);

      // Auto-create Manual Trigger start node
      const triggerNode = manager.create(Node, {
        workflowId: savedWorkflow.id,
        type: MANUAL_TRIGGER_TYPE,
        category: NodeCategory.TRIGGER,
        label: 'Manual Trigger',
        positionX: MANUAL_TRIGGER_DEFAULT_POSITION.x,
        positionY: MANUAL_TRIGGER_DEFAULT_POSITION.y,
        config: {},
        isDisabled: false,
      });
      await manager.save(Node, triggerNode);

      return savedWorkflow;
    });
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateWorkflowDto,
  ): Promise<Workflow> {
    const workflow = await this.findById(id, workspaceId);
    Object.assign(workflow, dto);
    return this.workflowRepository.save(workflow);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const workflow = await this.findById(id, workspaceId);
    await this.workflowRepository.remove(workflow);
  }

  async duplicate(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<Workflow> {
    const original = await this.findById(id, workspaceId);
    const copy = this.workflowRepository.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      isActive: false,
      tags: original.tags,
      folderId: original.folderId,
      settings: original.settings,
      workspaceId,
      createdBy: userId,
    });
    return this.workflowRepository.save(copy);
  }

  async exportWorkflow(
    id: string,
    workspaceId: string,
  ): Promise<Record<string, unknown>> {
    const workflow = await this.findById(id, workspaceId);
    return {
      name: workflow.name,
      description: workflow.description,
      tags: workflow.tags,
      settings: workflow.settings,
      // TODO: Include nodes and edges in export
    };
  }

  async saveCanvas(
    id: string,
    workspaceId: string,
    dto: SaveCanvasDto,
  ): Promise<{ workflow: Workflow; nodes: Node[]; edges: Edge[] }> {
    const workflow = await this.findById(id, workspaceId);

    // Server-side validation: Manual Trigger must exist and be unique
    this.validateManualTrigger(dto);

    return this.dataSource.transaction(async (manager) => {
      // Update workflow name if provided
      if (dto.name !== undefined) {
        workflow.name = dto.name;
      }
      workflow.currentVersion = (workflow.currentVersion ?? 0) + 1;
      await manager.save(Workflow, workflow);

      const savedNodes = await this.syncNodes(manager, id, dto);
      const savedEdges = await this.syncEdges(manager, id, dto);

      return { workflow, nodes: savedNodes, edges: savedEdges };
    });
  }

  private validateManualTrigger(dto: SaveCanvasDto): void {
    const triggerNodes = dto.nodes.filter(
      (n) => n.type === MANUAL_TRIGGER_TYPE,
    );
    if (triggerNodes.length === 0) {
      throw new BadRequestException(
        'Workflow must contain a Manual Trigger node',
      );
    }
    if (triggerNodes.length > 1) {
      throw new BadRequestException(
        'Workflow cannot contain more than one Manual Trigger node',
      );
    }
  }

  private async syncNodes(
    manager: EntityManager,
    workflowId: string,
    dto: SaveCanvasDto,
  ): Promise<Node[]> {
    const existingNodes = await manager.find(Node, {
      where: { workflowId },
    });
    const existingNodeMap = new Map(existingNodes.map((n) => [n.id, n]));
    const submittedNodeIds = new Set(dto.nodes.map((n) => n.id));

    // Delete nodes not in submitted list
    const nodesToDelete = existingNodes.filter(
      (n) => !submittedNodeIds.has(n.id),
    );
    if (nodesToDelete.length > 0) {
      await manager.remove(Node, nodesToDelete);
    }

    // Prepare nodes for batch save
    const nodesToSave: Node[] = [];
    for (const nodeDto of dto.nodes) {
      const existing = existingNodeMap.get(nodeDto.id);
      if (existing) {
        existing.label = nodeDto.label;
        existing.positionX = nodeDto.positionX;
        existing.positionY = nodeDto.positionY;
        existing.config = nodeDto.config ?? {};
        existing.isDisabled = nodeDto.isDisabled ?? false;
        existing.description = nodeDto.description ?? existing.description;
        existing.containerId = nodeDto.containerId ?? null;
        existing.toolOwnerId = nodeDto.toolOwnerId ?? null;
        nodesToSave.push(existing);
      } else {
        const newNode = manager.create(Node, {
          id: nodeDto.id,
          workflowId,
          type: nodeDto.type,
          category: nodeDto.category,
          label: nodeDto.label,
          positionX: nodeDto.positionX,
          positionY: nodeDto.positionY,
          config: nodeDto.config ?? {},
          isDisabled: nodeDto.isDisabled ?? false,
          description: nodeDto.description,
          containerId: nodeDto.containerId ?? null,
          toolOwnerId: nodeDto.toolOwnerId ?? null,
        });
        nodesToSave.push(newNode);
      }
    }

    // Batch save all nodes at once
    return manager.save(Node, nodesToSave);
  }

  private async syncEdges(
    manager: EntityManager,
    workflowId: string,
    dto: SaveCanvasDto,
  ): Promise<Edge[]> {
    // Delete all existing edges
    const existingEdges = await manager.find(Edge, {
      where: { workflowId },
    });
    if (existingEdges.length > 0) {
      await manager.remove(Edge, existingEdges);
    }

    if (dto.edges.length === 0) {
      return [];
    }

    // Batch create all edges
    const newEdges = dto.edges.map((edgeDto) =>
      manager.create(Edge, {
        workflowId,
        sourceNodeId: edgeDto.sourceNodeId,
        sourcePort: edgeDto.sourcePort ?? 'out',
        targetNodeId: edgeDto.targetNodeId,
        targetPort: edgeDto.targetPort ?? 'in',
        type: edgeDto.type ?? EdgeType.DATA,
        condition: edgeDto.condition ?? undefined,
      }),
    );

    return manager.save(Edge, newEdges);
  }

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 'created_at',
      updated_at: 'updated_at',
      name: 'name',
    };
    return allowed[sort] || 'created_at';
  }
}
