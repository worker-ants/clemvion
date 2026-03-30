import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowVersion } from './entities/workflow-version.entity';

@Injectable()
export class WorkflowVersionsService {
  constructor(
    @InjectRepository(WorkflowVersion)
    private readonly workflowVersionRepository: Repository<WorkflowVersion>,
  ) {}

  async findByWorkflow(workflowId: string): Promise<WorkflowVersion[]> {
    return this.workflowVersionRepository.find({
      where: { workflowId },
      order: { version: 'DESC' },
      relations: ['creator'],
    });
  }

  async createVersion(
    workflowId: string,
    userId: string,
    snapshot: Record<string, unknown>,
    changeSummary?: string,
  ): Promise<WorkflowVersion> {
    const latestVersion = await this.workflowVersionRepository
      .createQueryBuilder('wv')
      .where('wv.workflow_id = :workflowId', { workflowId })
      .orderBy('wv.version', 'DESC')
      .getOne();

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

    const version = this.workflowVersionRepository.create({
      workflowId,
      version: nextVersion,
      snapshot,
      changeSummary: changeSummary || undefined,
      createdBy: userId,
    });

    return this.workflowVersionRepository.save(version);
  }
}
