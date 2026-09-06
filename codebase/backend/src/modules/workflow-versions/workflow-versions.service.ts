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

/**
 * `creator` 관계에서 **응답에 실을 컬럼**. 두 조회 메서드가 공유한다.
 *
 * ## 왜 상수인가 — 이것이 보안 경계다
 *
 * `WorkflowVersion.creator` 는 `@ManyToOne(() => User)` 이고, 이 투영이 없으면 TypeORM 이
 * `User` **전 컬럼**을 싣는다. 컨트롤러가 결과를 가공 없이 반환하므로 그대로
 * `passwordHash`·2FA secret·복구 코드·계정 탈취용 토큰이 wire 로 나간다 — 실제로 나갔다
 * (`review/code/2026/09/06/10_13_22` Critical 1). `findByWorkflow` 는 투영이 있었고
 * `findOne` 은 없었다: **자매 중 하나만 옳았고, 같은 리터럴이 두 곳에 손으로 복제돼
 * 있었기 때문**이다 (`review/code/2026/09/06/10_53_48` W1).
 *
 * 집합은 `WorkflowVersionCreatorDto` 가 광고하는 것과 같아야 한다. 그 일치는 주석이 아니라
 * **테스트가 강제한다** — `workflow-versions.service.spec.ts` 가 이 상수의 키를 그 DTO 의
 * OpenAPI 스키마 프로퍼티와 대조한다. DTO 에 필드를 더하고 여기를 안 고치면 그 자리에서
 * 걸린다(반대 방향도).
 */
export const CREATOR_PROJECTION = {
  id: true,
  name: true,
  email: true,
} as const;

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
        creator: CREATOR_PROJECTION,
      },
    });
  }

  async findOne(
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowVersion> {
    const version = await this.workflowVersionRepository.findOne({
      where: { id: versionId, workflowId },
      relations: { creator: true },
      // **투영이 없으면 `User` 전 컬럼이 그대로 나간다.** 이 메서드의 반환값을 컨트롤러가
      // 가공 없이 돌려주므로, `creator` 를 통째로 실으면 `passwordHash`·`twoFactorSecret`·
      // 복구 코드·계정 탈취용 토큰이 `GET /api/workflows/:wfId/versions/:versionId` 응답에
      // 실린다 (`review/code/2026/09/06/10_13_22` Critical 1).
      //
      // 자매 메서드 `findByWorkflow` 는 처음부터 이 투영을 갖고 있었다 — **한쪽만 있었다.**
      // `WorkflowVersionCreatorDto` 가 광고하는 세 필드와 같은 집합이다.
      select: {
        id: true,
        workflowId: true,
        version: true,
        changeSummary: true,
        snapshot: true,
        createdBy: true,
        createdAt: true,
        creator: CREATOR_PROJECTION,
      },
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
