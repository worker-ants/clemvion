import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { WorkflowTestDatasetsService } from './workflow-test-datasets.service';
import {
  WorkflowTestDataset,
  TestDatasetVisibility,
} from './entities/workflow-test-dataset.entity';
import { Workflow } from '../workflows/entities/workflow.entity';

const WS = 'ws-1';
const WF = 'wf-1';
const OWNER = 'user-owner';
const OTHER = 'user-other';

function makeDataset(over: Partial<WorkflowTestDataset>): WorkflowTestDataset {
  return {
    id: over.id ?? 'ds-1',
    workflowId: over.workflowId ?? WF,
    ownerId: over.ownerId ?? OWNER,
    workspaceId: over.workspaceId ?? WS,
    visibility: over.visibility ?? TestDatasetVisibility.PRIVATE,
    name: over.name ?? 'case A',
    input: over.input ?? { a: 1 },
    createdAt: new Date('2026-06-14T00:00:00.000Z'),
    updatedAt: new Date('2026-06-14T00:00:00.000Z'),
  } as WorkflowTestDataset;
}

describe('WorkflowTestDatasetsService', () => {
  let service: WorkflowTestDatasetsService;
  let datasetRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let workflowRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    datasetRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      // create 는 들어온 부분객체를 그대로 entity 처럼 반환.
      create: jest.fn((d) => makeDataset(d)),
      save: jest.fn(async (e) => ({ ...e, id: e.id ?? 'ds-new' })),
      remove: jest.fn(async () => undefined),
    };
    workflowRepo = { findOne: jest.fn().mockResolvedValue({ id: WF }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowTestDatasetsService,
        {
          provide: getRepositoryToken(WorkflowTestDataset),
          useValue: datasetRepo,
        },
        { provide: getRepositoryToken(Workflow), useValue: workflowRepo },
      ],
    }).compile();
    service = module.get(WorkflowTestDatasetsService);
  });

  describe('assertWorkflow', () => {
    it('워크플로우가 워크스페이스에 없으면 404', async () => {
      workflowRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.list(WF, WS, OWNER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('항상 요청 유저 소유 + 기본 private 로 생성', async () => {
      const dto = { name: 'case A', input: { x: 1 } };
      const res = await service.create(WF, WS, OWNER, dto);
      expect(datasetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: WF,
          workspaceId: WS,
          ownerId: OWNER,
          visibility: TestDatasetVisibility.PRIVATE,
        }),
      );
      expect(res.isOwner).toBe(true);
      expect(res.ownerId).toBe(OWNER);
    });

    it('중복 이름(UNIQUE 23505) → 409 ConflictException', async () => {
      datasetRepo.save.mockRejectedValueOnce(
        new QueryFailedError('q', [], { code: '23505' } as unknown as Error),
      );
      await expect(
        service.create(WF, WS, OWNER, { name: 'dup', input: {} }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('내 것 + 워크스페이스 공유본 필터 쿼리 + isOwner 매핑', async () => {
      const rows = [
        makeDataset({ id: 'mine', ownerId: OWNER }),
        makeDataset({
          id: 'shared',
          ownerId: OTHER,
          visibility: TestDatasetVisibility.WORKSPACE,
        }),
      ];
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      datasetRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await service.list(WF, WS, OWNER);
      expect(res).toHaveLength(2);
      expect(res.find((r) => r.id === 'mine')?.isOwner).toBe(true);
      expect(res.find((r) => r.id === 'shared')?.isOwner).toBe(false);
      // owner OR workspace 조건이 쿼리에 포함됐는지.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('owner_id = :userId OR'),
        expect.objectContaining({ userId: OWNER }),
      );
    });
  });

  describe('update — 소유자만', () => {
    it('소유자는 수정 가능', async () => {
      datasetRepo.findOne.mockResolvedValue(makeDataset({ ownerId: OWNER }));
      const res = await service.update(WF, WS, OWNER, { name: 'new' });
      expect(res.name).toBe('new');
    });

    it('비소유자는 403 Forbidden', async () => {
      datasetRepo.findOne.mockResolvedValue(
        makeDataset({
          ownerId: OWNER,
          visibility: TestDatasetVisibility.WORKSPACE,
        }),
      );
      await expect(
        service.update('ds-1', WS, OTHER, { name: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('대상 데이터셋이 없으면 404 NotFoundException', async () => {
      datasetRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('ds-missing', WS, OWNER, { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('중복 이름(UNIQUE 23505) → 409 ConflictException', async () => {
      datasetRepo.findOne.mockResolvedValue(makeDataset({ ownerId: OWNER }));
      datasetRepo.save.mockRejectedValueOnce(
        new QueryFailedError('q', [], { code: '23505' } as unknown as Error),
      );
      await expect(
        service.update('ds-1', WS, OWNER, { name: 'dup' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove — 소유자만', () => {
    it('비소유자는 403', async () => {
      datasetRepo.findOne.mockResolvedValue(makeDataset({ ownerId: OWNER }));
      await expect(service.remove('ds-1', WS, OTHER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('소유자 remove 성공 → datasetRepo.remove 호출', async () => {
      const ds = makeDataset({ ownerId: OWNER });
      datasetRepo.findOne.mockResolvedValue(ds);
      await service.remove('ds-1', WS, OWNER);
      expect(datasetRepo.remove).toHaveBeenCalledWith(ds);
    });
  });

  describe('clone', () => {
    it('워크스페이스 공유본을 타 유저가 자기 소유 private 사본으로 복제', async () => {
      datasetRepo.findOne.mockResolvedValue(
        makeDataset({
          id: 'shared',
          ownerId: OWNER,
          name: 'case A',
          visibility: TestDatasetVisibility.WORKSPACE,
        }),
      );
      const res = await service.clone('shared', WS, OTHER);
      expect(datasetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: OTHER,
          visibility: TestDatasetVisibility.PRIVATE,
          name: 'case A (Copy)',
        }),
      );
      expect(res.isOwner).toBe(true);
    });

    it('비소유 private 데이터셋은 복제 불가 — 404 (존재 은닉)', async () => {
      datasetRepo.findOne.mockResolvedValue(
        makeDataset({
          ownerId: OWNER,
          visibility: TestDatasetVisibility.PRIVATE,
        }),
      );
      await expect(service.clone('ds-1', WS, OTHER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('소유자 self-clone(private 본인 소유) 성공 — isOwner=true', async () => {
      datasetRepo.findOne.mockResolvedValue(
        makeDataset({
          id: 'own-ds',
          ownerId: OWNER,
          name: 'my case',
          visibility: TestDatasetVisibility.PRIVATE,
        }),
      );
      const res = await service.clone('own-ds', WS, OWNER);
      expect(datasetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: OWNER,
          visibility: TestDatasetVisibility.PRIVATE,
          name: 'my case (Copy)',
        }),
      );
      expect(res.isOwner).toBe(true);
    });
  });
});
