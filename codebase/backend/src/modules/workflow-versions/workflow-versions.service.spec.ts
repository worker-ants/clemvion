import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  CREATOR_PROJECTION,
  WorkflowVersionsService,
} from './workflow-versions.service';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import {
  buildSwaggerDocument,
  schemaOf,
} from '../../shared/testing/swagger-probe';
import { WorkflowVersionCreatorDto } from './dto/responses/workflow-version-response.dto';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { Workflow } from '../workflows/entities/workflow.entity';

@Controller('probe-wv-creator')
class CreatorProbeController {
  @Get()
  @ApiOkResponse({ type: WorkflowVersionCreatorDto })
  get(): WorkflowVersionCreatorDto {
    return {} as WorkflowVersionCreatorDto;
  }
}

/**
 * **투영 상수와 DTO 가 갈리지 않게 코드로 묶는다.**
 *
 * `CREATOR_PROJECTION` 은 `WorkflowVersionCreatorDto` 가 광고하는 집합과 같아야 한다.
 * 그 일치를 주석으로만 두면 한쪽만 늘어난다 — 이 PR 자신이 그 실패를 겪었다
 * (같은 리터럴이 두 곳에 복제돼 있어 `findOne` 만 투영을 잃었다).
 *
 * 목록끼리 비교하지 않고 **DTO 의 OpenAPI 스키마**에서 뽑는다 — 손으로 적은 두 목록을
 * 맞대면 둘 다 같이 틀린 경우를 못 잡는다.
 */
describe('CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto', () => {
  it('투영 키가 DTO 가 광고하는 프로퍼티와 정확히 일치한다', async () => {
    const doc: OpenAPIObject = await buildSwaggerDocument({
      controllers: [CreatorProbeController],
    });
    // `schemasOf(doc).X` 로 직접 인덱싱하면 이름이 틀렸을 때 무명 `TypeError` 가 난다 —
    // `schemaOf` 는 정확히 그것을 막으려고 있는 헬퍼다 (`11_55_36` INFO#10).
    const schema = schemaOf(doc, 'WorkflowVersionCreatorDto');
    const declared = Object.keys(schema.properties ?? {}).sort();

    // 스키마가 비면 아래 비교가 빈 배열끼리라 조용히 통과한다.
    expect(declared.length).toBeGreaterThan(0);
    expect(Object.keys(CREATOR_PROJECTION).sort()).toEqual(declared);
  });
});

describe('WorkflowVersionsService', () => {
  let service: WorkflowVersionsService;

  const qb = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    create: jest.fn().mockImplementation((d) => d),
    save: jest
      .fn()
      .mockImplementation((d) => Promise.resolve({ id: 'v-id', ...d })),
  };

  const mockWorkflowRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowVersionsService,
        { provide: getRepositoryToken(WorkflowVersion), useValue: mockRepo },
        { provide: getRepositoryToken(Workflow), useValue: mockWorkflowRepo },
      ],
    }).compile();

    service = module.get(WorkflowVersionsService);
    jest.clearAllMocks();
    qb.getOne.mockResolvedValue(null);
  });

  describe('findByWorkflow', () => {
    it('should return versions sorted by version DESC, selecting metadata only (no snapshot)', async () => {
      mockRepo.find.mockResolvedValue([{ id: 'a', version: 2 }]);
      const result = await service.findByWorkflow('wf-1');
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
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
      // m-3 — snapshot 은 목록 select 에서 비적재 (over-fetch 방지).
      const passedSelect = mockRepo.find.mock.calls[0][0].select;
      expect(passedSelect).not.toHaveProperty('snapshot');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should query by both id and workflowId', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'v-1', workflowId: 'wf-1' });
      await service.findOne('wf-1', 'v-1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'v-1', workflowId: 'wf-1' },
        relations: { creator: true },
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
    });

    /**
     * **`creator` 투영이 이 메서드의 보안 경계다.**
     *
     * 컨트롤러가 이 반환값을 가공 없이 돌려주므로, 투영이 없으면 `User` 전 컬럼
     * (`passwordHash`·2FA secret·복구 코드·계정 탈취용 토큰)이 그대로 wire 로 나간다 —
     * 실제로 나가고 있었다 (`review/code/2026/09/06/10_13_22` Critical 1).
     *
     * 위 테스트는 옵션 **전체**를 비교하므로 이 단언과 겹치지만, 겹치는 쪽을 남긴다:
     * 위 단언은 형태가 바뀌면 통째로 갈아엎히는데, 그때 무엇이 **양보하면 안 되는
     * 성질**인지가 이 이름에 남아 있어야 한다. `findByWorkflow` 는 처음부터 투영이
     * 있었고 `findOne` 만 없었다 — 자매 중 하나만 옳았다.
     */
    it('creator 를 참조 3필드로 투영한다 — 없으면 `User` 전 컬럼이 나간다', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'v-1', workflowId: 'wf-1' });
      await service.findOne('wf-1', 'v-1');
      const opts = mockRepo.findOne.mock.calls[0][0] as {
        select?: { creator?: Record<string, unknown> };
      };
      expect(opts.select?.creator).toEqual({
        id: true,
        name: true,
        email: true,
      });
    });

    it('should throw NotFoundException when missing', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('wf-1', 'v-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertWorkspaceOwnership', () => {
    it('returns when workflow belongs to workspace', async () => {
      mockWorkflowRepo.findOne.mockResolvedValue({ id: 'wf-1' });
      await expect(
        service.assertWorkspaceOwnership('wf-1', 'ws-1'),
      ).resolves.toBeUndefined();
      expect(mockWorkflowRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'wf-1', workspaceId: 'ws-1' },
        select: { id: true },
      });
    });

    it('throws NotFoundException when workflow not in workspace', async () => {
      mockWorkflowRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assertWorkspaceOwnership('wf-1', 'ws-other'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createVersion', () => {
    it('should compute next version as latest + 1', async () => {
      qb.getOne.mockResolvedValue({ version: 4 });
      await service.createVersion('wf-1', 'user-1', { foo: 'bar' }, 'summary');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'wf-1',
          version: 5,
          changeSummary: 'summary',
          createdBy: 'user-1',
        }),
      );
    });

    it('should start at version 1 when no prior versions exist', async () => {
      qb.getOne.mockResolvedValue(null);
      await service.createVersion('wf-1', 'user-1', {});
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1 }),
      );
    });
  });
});
