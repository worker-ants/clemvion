import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { Workflow } from '../workflows/entities/workflow.entity';

/**
 * 목록 조회 반환 타입 — `snapshot` 필드를 제외해 호출부에서 컴파일 타임에 접근 차단.
 * 엔티티 필드 타입(Date 등)을 그대로 유지해 TypeORM 반환값과 호환 유지.
 * (#4 — SUMMARY warning: 타입-런타임 불일치 수정)
 */
export type WorkflowVersionListItem = Omit<WorkflowVersion, 'snapshot'>;

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

  // 목록은 메타데이터 + 작성자만 — `snapshot`(워크플로 전체 노드/엣지 JSONB)은
  // 의도적으로 비적재한다. spec/3-workflow-editor/5-version-history.md §7.1(목록)
  // vs §7.2(상세 "+ snapshot 포함") 의 대비 구조가 '목록 비포함' 의도를 명시하며,
  // 목록 UI(version-history-panel)도 메타만 소비한다. snapshot 은 §7.2 상세
  // (findOne) / §6 복원에서만 필요. (m-3 — 목록 호출당 전체 snapshot over-fetch 제거)
  // 반환 타입을 WorkflowVersionListItem(Omit<WorkflowVersion,'snapshot'>) 로 좁혀
  // `snapshot` 접근을 컴파일 타임에 차단 (#4 — SUMMARY warning: 타입-런타임 불일치 수정).
  async findByWorkflow(workflowId: string): Promise<WorkflowVersionListItem[]> {
    return this.workflowVersionRepository.find({
      where: { workflowId },
      order: { version: 'DESC' },
      relations: { creator: true },
      select: {
        id: true,
        workflowId: true,
        version: true,
        changeSummary: true,
        createdBy: true,
        createdAt: true,
        creator: { id: true, name: true, email: true },
      },
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
