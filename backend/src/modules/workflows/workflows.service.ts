import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workflow } from './entities/workflow.entity';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { QueryWorkflowDto } from './dto/query-workflow.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
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
    const workflow = this.workflowRepository.create({
      ...dto,
      workspaceId,
      createdBy: userId,
    });
    return this.workflowRepository.save(workflow);
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
      // Nodes and edges will be included when those modules are integrated
    };
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
