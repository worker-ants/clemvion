import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { WorkflowVersionsService } from './workflow-versions.service';
import { WorkflowVersion } from './entities/workflow-version.entity';
import { Workflow } from '../workflows/entities/workflow.entity';

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
    it('should return versions sorted by version DESC', async () => {
      mockRepo.find.mockResolvedValue([{ id: 'a', version: 2 }]);
      const result = await service.findByWorkflow('wf-1');
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
        order: { version: 'DESC' },
        relations: ['creator'],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should query by both id and workflowId', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'v-1', workflowId: 'wf-1' });
      await service.findOne('wf-1', 'v-1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'v-1', workflowId: 'wf-1' },
        relations: ['creator'],
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
