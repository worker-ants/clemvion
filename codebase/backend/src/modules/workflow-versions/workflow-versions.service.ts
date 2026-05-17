import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { Workflow } from '../workflows/entities/workflow.entity';

@Injectable()
export class WorkflowVersionsService {
  constructor(
    @InjectRepository(WorkflowVersion)
    private readonly workflowVersionRepository: Repository<WorkflowVersion>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  async assertWorkspaceOwnership(
    workflowId: string,
    workspaceId: string,
  ): Promise<void> {
    const workflow = await this.workflowRepository.findOne({
      where: { id: workflowId, workspaceId },
      select: { id: true },
    });
    if (!workflow) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workflow not found',
      });
    }
  }

  async findByWorkflow(workflowId: string): Promise<WorkflowVersion[]> {
    return this.workflowVersionRepository.find({
      where: { workflowId },
      order: { version: 'DESC' },
      relations: ['creator'],
    });
  }

  async findOne(
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowVersion> {
    const version = await this.workflowVersionRepository.findOne({
      where: { id: versionId, workflowId },
      relations: ['creator'],
    });
    if (!version) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Workflow version not found',
      });
    }
    return version;
  }

  async createVersion(
    workflowId: string,
    userId: string,
    snapshot: Record<string, unknown>,
    changeSummary?: string,
    manager?: EntityManager,
  ): Promise<WorkflowVersion> {
    const repo = manager
      ? manager.getRepository(WorkflowVersion)
      : this.workflowVersionRepository;

    // Compute next version under a row-level write lock so concurrent saves
    // can't allocate the same number. Falls back to a plain query when no
    // transaction is provided (legacy callers); the unique constraint catches
    // the race below either way.
    const qb = repo
      .createQueryBuilder('wv')
      .where('wv.workflow_id = :workflowId', { workflowId })
      .orderBy('wv.version', 'DESC');
    if (manager) qb.setLock('pessimistic_write');
    const latestVersion = await qb.getOne();

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    const version = repo.create({
      workflowId,
      version: nextVersion,
      snapshot,
      changeSummary: changeSummary || undefined,
      createdBy: userId,
    });

    try {
      return await repo.save(version);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        /unique|duplicate/i.test(err.message)
      ) {
        throw new ConflictException({
          code: 'WORKFLOW_VERSION_CONFLICT',
          message: 'Concurrent save detected — please retry',
        });
      }
      throw err;
    }
  }
}
