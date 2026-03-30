import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { Workflow } from './entities/workflow.entity';

describe('WorkflowsService', () => {
  let service: WorkflowsService;

  const mockWorkflow: Partial<Workflow> = {
    id: 'wf-uuid-1',
    workspaceId: 'ws-uuid-1',
    name: 'Test Workflow',
    isActive: false,
    tags: [],
    settings: {},
    currentVersion: 1,
    createdBy: 'user-uuid-1',
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
    getMany: jest.fn().mockResolvedValue([mockWorkflow]),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((data) => data),
    save: jest
      .fn()
      .mockImplementation((data) => Promise.resolve({ id: 'new-id', ...data })),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: getRepositoryToken(Workflow), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated workflows', async () => {
      const result = await service.findAll('ws-uuid-1', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('findById', () => {
    it('should return a workflow', async () => {
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      const result = await service.findById('wf-uuid-1', 'ws-uuid-1');
      expect(result.name).toBe('Test Workflow');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findById('nonexistent', 'ws-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a workflow', async () => {
      const result = await service.create('ws-uuid-1', 'user-uuid-1', {
        name: 'New Workflow',
      });
      expect(result.name).toBe('New Workflow');
      expect(result.workspaceId).toBe('ws-uuid-1');
    });
  });

  describe('duplicate', () => {
    it('should create a copy with "(Copy)" suffix', async () => {
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      const result = await service.duplicate(
        'wf-uuid-1',
        'ws-uuid-1',
        'user-uuid-1',
      );
      expect(result.name).toBe('Test Workflow (Copy)');
    });
  });
});
