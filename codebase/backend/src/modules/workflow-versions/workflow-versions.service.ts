import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import type { User } from '../users/entities/user.entity';

/**
 * 응답에 실리는 `creator` — `CREATOR_PROJECTION` 이 싣는 것과 **같은 집합**.
 *
 * 엔티티 타입은 `creator: User` 라고 말하지만 런타임 값은 3필드뿐이다. 그 간극을 그대로
 * 두면 새 소비자가 `version.creator.passwordHash` 를 써도 **컴파일러가 막지 않는다**
 * (`tsc --noEmit` 오류 0건으로 실측됨). 값이 좁고 타입이 넓은 방향이라 유출은 아니지만,
 * 이 PR 이 `select:false` 를 기각한 이유(*"undefined 를 받고 조용히 실패"*)와 **같은 형태의
 * 위험을 읽기 쪽에 재생산**한다 (`review/code/2026/09/06/11_27_53` W4).
 */
export type ProjectedCreator = Pick<User, 'id' | 'name' | 'email'>;

/**
 * 두 조회가 **로드하지 않는** 관계. 타입에서 뺀다.
 *
 * `WorkflowVersion.workflow` 는 `@ManyToOne(() => Workflow)` 로 선언돼 있지만 이 서비스의
 * 두 조회는 `relations: { creator: true }` 만 준다 — 즉 런타임에는 **항상 `undefined`**
 * 인데 엔티티 타입은 `Workflow` 라고 말한다. `creator` 에 대해 방금 고친 것과 **같은
 * 형태의 타입-런타임 간극**이 옆자리에 남아 있었다 (`review/code/2026/09/06/11_55_36` W3).
 *
 * 나중에 `workflow` 가 필요해지면 `creator` 와 같은 형태로 로드·투영을 함께 들여온다 —
 * `audit-logs.service.ts` 의 `AuditLogListItem` 이 같은 이유로 `workspace` 를 뺐다.
 */
type UnloadedRelations = 'workflow';

/**
 * 목록 조회 반환 타입 — `snapshot` 을 제외해 호출부에서 컴파일 타임에 접근 차단.
 * 엔티티 필드 타입(Date 등)을 그대로 유지해 TypeORM 반환값과 호환 유지.
 * `creator` 는 투영된 3필드로 좁힌다 — 위 `ProjectedCreator` 참조.
 */
export type WorkflowVersionListItem = Omit<
  WorkflowVersion,
  'snapshot' | 'creator' | UnloadedRelations
> & { creator: ProjectedCreator };

/**
 * 단건 조회 반환 타입 — 목록과 달리 `snapshot` 을 싣고, `creator` 는 같이 좁힌다.
 *
 * ## 왜 `…Projection` 접미인가 (2026-09-08 개명)
 *
 * 프런트엔드에 **형태가 다른 동명 타입**이 있었다 —
 * [`codebase/frontend/src/lib/api/workflows.ts`](../../../../frontend/src/lib/api/workflows.ts)
 * 의 `WorkflowVersionDetail`. 공유 타입 패키지를 거치지 않는 손-미러다.
 *
 * 두 선언은 실제로 갈려 있다 — 저쪽 `creator` 는 `{ id, name?, email? } | null` 로
 * 옵셔널이고 `createdAt` 은 `string` 인데, 이쪽은 `creator` 를 `{ id, name, email }`
 * **3필드 고정**으로 좁혔고 `createdAt` 은 `Date` 다. 저쪽이 더 넓으므로 런타임 오류는
 * 나지 않는다.
 *
 * **문제는 형태가 아니라 이름이었다.** 같은 이름이라 `grep` 이 두 자리를 같은 것으로
 * 보여 줬고, 한 세션에서 **세 라운드 연속** *"유일 정의"* 오판이 났다
 * (`review/consistency/2026/09/06/13_39_25` W3 ·
 * `review/consistency/2026/09/06/16_29_00` W5).
 *
 * 그래서 **공유 패키지로 합치지 않고 개명했다.** 합치려면 wire 계약(`Date` vs `string`,
 * `creator` 의 nullability)을 한쪽으로 맞춰야 하는데, 그것은 이 결함이 요구하는 것보다
 * 넓은 변경이다. `Projection` 접미는 이 타입이 **DB 투영 결과**라는 사실도 함께 말한다 —
 * 아래 `CREATOR_PROJECTION` 이 그 투영이다.
 */
export type WorkflowVersionDetailProjection = Omit<
  WorkflowVersion,
  'creator' | UnloadedRelations
> & { creator: ProjectedCreator };

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
export const CREATOR_PROJECTION = Object.freeze({
  id: true,
  name: true,
  email: true,
} as const);

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
  // 반환 타입 `WorkflowVersionListItem` 이 `snapshot` 접근을 컴파일 타임에 차단한다
  // (#4 — SUMMARY warning: 타입-런타임 불일치 수정). **그 타입은 이제 `snapshot` 만
  // 빼는 것이 아니다** — `creator` 는 투영된 3필드로 좁고, 로드하지 않는 `workflow` 도
  // 뺀다. 정의를 여기 옮겨 적지 않는다(옮겨 적은 문장이 곧 낡았다,
  // `review/code/2026/09/06/14_25_40` INFO#2) — 타입 선언이 SoT 다.
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
  ): Promise<WorkflowVersionDetailProjection> {
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
