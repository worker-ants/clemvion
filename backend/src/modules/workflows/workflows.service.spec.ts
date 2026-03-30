import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { Workflow } from './entities/workflow.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';

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

  const mockNodeRepository = {
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'node-id', ...data })),
  };

  const mockTransactionManager = {
    save: jest.fn().mockImplementation((_entity, data) => Promise.resolve(Array.isArray(data) ? data : { id: 'new-id', ...data })),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((_entity, data) => data),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb) => cb(mockTransactionManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: getRepositoryToken(Workflow), useValue: mockRepository },
        { provide: getRepositoryToken(Node), useValue: mockNodeRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
    jest.clearAllMocks();
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
    it('should create a workflow with manual trigger node atomically', async () => {
      const result = await service.create('ws-uuid-1', 'user-uuid-1', {
        name: 'New Workflow',
      });

      // Transaction should be used
      expect(mockDataSource.transaction).toHaveBeenCalled();

      // Should save workflow
      expect(mockTransactionManager.save).toHaveBeenCalledWith(
        Workflow,
        expect.objectContaining({ name: 'New Workflow', workspaceId: 'ws-uuid-1' }),
      );

      // Should create manual trigger node
      expect(mockTransactionManager.create).toHaveBeenCalledWith(
        Node,
        expect.objectContaining({
          type: 'manual_trigger',
          category: NodeCategory.TRIGGER,
          label: 'Manual Trigger',
        }),
      );

      expect(result).toBeDefined();
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

  describe('saveCanvas', () => {
    beforeEach(() => {
      mockRepository.findOne.mockResolvedValue({ ...mockWorkflow, currentVersion: 1 });
    });

    it('should save canvas with nodes and edges in a transaction', async () => {
      const dto = {
        name: 'Updated Name',
        nodes: [
          {
            id: 'node-1',
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Manual Trigger',
            positionX: 100,
            positionY: 200,
            config: {},
          },
        ],
        edges: [],
      };

      const result = await service.saveCanvas('wf-uuid-1', 'ws-uuid-1', dto);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should reject canvas without manual trigger', async () => {
      const dto = {
        nodes: [
          {
            id: 'node-1',
            type: 'if_else',
            category: NodeCategory.LOGIC,
            label: 'If/Else',
            positionX: 100,
            positionY: 200,
          },
        ],
        edges: [],
      };

      await expect(
        service.saveCanvas('wf-uuid-1', 'ws-uuid-1', dto),
      ).rejects.toThrow('Workflow must contain a Manual Trigger node');
    });

    it('should reject canvas with multiple manual triggers', async () => {
      const dto = {
        nodes: [
          {
            id: 'node-1',
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trigger 1',
            positionX: 100,
            positionY: 200,
          },
          {
            id: 'node-2',
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trigger 2',
            positionX: 300,
            positionY: 200,
          },
        ],
        edges: [],
      };

      await expect(
        service.saveCanvas('wf-uuid-1', 'ws-uuid-1', dto),
      ).rejects.toThrow('Workflow cannot contain more than one Manual Trigger node');
    });
  });
});
