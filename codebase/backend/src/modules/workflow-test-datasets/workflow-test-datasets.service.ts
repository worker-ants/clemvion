import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import {
  WorkflowTestDataset,
  TestDatasetVisibility,
} from './entities/workflow-test-dataset.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { CreateWorkflowTestDatasetDto } from './dto/create-workflow-test-dataset.dto';
import { UpdateWorkflowTestDatasetDto } from './dto/update-workflow-test-dataset.dto';
import { WorkflowTestDatasetDto } from './dto/responses/workflow-test-dataset-response.dto';

/**
 * 워크플로우 Mock Input 테스트 데이터셋 (§2.2 저장/이름 지정).
 *
 * 권한 모델 (spec §2.2 / Rationale):
 * - 생성 시 항상 요청 유저 소유(ownerId) + private.
 * - 목록: 같은 워크플로우 안에서 "내 것(private 포함) + 워크스페이스 공유본(workspace)".
 * - 수정/삭제: 소유자만 (workspace 공유본도 소유자만 — read-only 공유).
 * - clone: 조회 가능한(내 것 or 공유본) 데이터셋을 자기 소유 private 사본으로 복제.
 *   타 유저가 공유본을 "수정" 하려면 clone 후 사본을 편집한다.
 */
@Injectable()
export class WorkflowTestDatasetsService {
  constructor(
    @InjectRepository(WorkflowTestDataset)
    private readonly datasetRepository: Repository<WorkflowTestDataset>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
  ) {}

  /** workflow 가 해당 workspace 소유인지 검증하고 workspaceId 를 확정한다. */
  private async assertWorkflow(
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

  private toDto(
    entity: WorkflowTestDataset,
    userId: string,
  ): WorkflowTestDatasetDto {
    return {
      id: entity.id,
      workflowId: entity.workflowId,
      ownerId: entity.ownerId,
      visibility: entity.visibility,
      name: entity.name,
      input: entity.input,
      isOwner: entity.ownerId === userId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /** 같은 워크플로우의 "내 것 + 워크스페이스 공유본" 목록 (최근 갱신순). */
  async list(
    workflowId: string,
    workspaceId: string,
    userId: string,
  ): Promise<WorkflowTestDatasetDto[]> {
    await this.assertWorkflow(workflowId, workspaceId);
    const rows = await this.datasetRepository
      .createQueryBuilder('d')
      .where('d.workflow_id = :workflowId', { workflowId })
      .andWhere('d.workspace_id = :workspaceId', { workspaceId })
      .andWhere('(d.owner_id = :userId OR d.visibility = :workspace)', {
        userId,
        workspace: TestDatasetVisibility.WORKSPACE,
      })
      .orderBy('d.updated_at', 'DESC')
      .getMany();
    return rows.map((r) => this.toDto(r, userId));
  }

  async create(
    workflowId: string,
    workspaceId: string,
    userId: string,
    dto: CreateWorkflowTestDatasetDto,
  ): Promise<WorkflowTestDatasetDto> {
    await this.assertWorkflow(workflowId, workspaceId);
    const entity = this.datasetRepository.create({
      workflowId,
      workspaceId,
      ownerId: userId,
      name: dto.name,
      input: dto.input ?? {},
      visibility: dto.visibility ?? TestDatasetVisibility.PRIVATE,
    });
    return this.toDto(await this.saveUnique(entity), userId);
  }

  /**
   * 수정/삭제/clone 대상 조회 — workspace 격리 + 가시성 검사.
   * `requireOwner=true` 면 소유자만(수정/삭제), false 면 조회 가능(내 것 or 공유본; clone).
   */
  private async findAccessible(
    id: string,
    workspaceId: string,
    userId: string,
    requireOwner: boolean,
  ): Promise<WorkflowTestDataset> {
    const entity = await this.datasetRepository.findOne({
      where: { id, workspaceId },
    });
    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Test dataset not found',
      });
    }
    const isOwner = entity.ownerId === userId;
    if (requireOwner) {
      if (!isOwner) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Only the owner can modify this dataset',
        });
      }
    } else if (
      !isOwner &&
      entity.visibility !== TestDatasetVisibility.WORKSPACE
    ) {
      // 비소유 + 비공유(private) → 존재 자체를 숨긴다 (404).
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Test dataset not found',
      });
    }
    return entity;
  }

  async update(
    id: string,
    workspaceId: string,
    userId: string,
    dto: UpdateWorkflowTestDatasetDto,
  ): Promise<WorkflowTestDatasetDto> {
    const entity = await this.findAccessible(id, workspaceId, userId, true);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.input !== undefined) entity.input = dto.input;
    if (dto.visibility !== undefined) entity.visibility = dto.visibility;
    return this.toDto(await this.saveUnique(entity), userId);
  }

  async remove(id: string, workspaceId: string, userId: string): Promise<void> {
    const entity = await this.findAccessible(id, workspaceId, userId, true);
    await this.datasetRepository.remove(entity);
  }

  /** 조회 가능한 데이터셋을 자기 소유 private 사본으로 복제. */
  async clone(
    id: string,
    workspaceId: string,
    userId: string,
  ): Promise<WorkflowTestDatasetDto> {
    const source = await this.findAccessible(id, workspaceId, userId, false);
    const copy = this.datasetRepository.create({
      workflowId: source.workflowId,
      workspaceId: source.workspaceId,
      ownerId: userId,
      name: this.copyName(source.name),
      input: source.input,
      visibility: TestDatasetVisibility.PRIVATE,
    });
    return this.toDto(await this.saveUnique(copy), userId);
  }

  /** (workflowId, ownerId, name) UNIQUE 위반을 409 로 변환. */
  private async saveUnique(
    entity: WorkflowTestDataset,
  ): Promise<WorkflowTestDataset> {
    try {
      return await this.datasetRepository.save(entity);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as { code?: string }).code === '23505'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_NAME',
          message: 'A dataset with this name already exists',
        });
      }
      throw err;
    }
  }

  /** "이름" → "이름 (Copy)" / 충돌 시 "이름 (Copy 2)" … (소유자 namespace 내 유일화). */
  private copyName(base: string): string {
    const suffix = ' (Copy)';
    const max = 255 - suffix.length;
    return `${base.length > max ? base.slice(0, max) : base}${suffix}`;
  }
}
