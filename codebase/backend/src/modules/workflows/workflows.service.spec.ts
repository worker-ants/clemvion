import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { Workflow } from './entities/workflow.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { WorkflowVersionsService } from '../workflow-versions/workflow-versions.service';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

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
    save: jest
      .fn()
      .mockImplementation((data) =>
        Promise.resolve({ id: 'node-id', ...data }),
      ),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockEdgeRepository = {
    create: jest.fn().mockImplementation((data) => data),
    save: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockTransactionManager = {
    save: jest
      .fn()
      .mockImplementation((_entity, data) =>
        Promise.resolve(Array.isArray(data) ? data : { id: 'new-id', ...data }),
      ),
    find: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((_entity, data) => data),
  };

  const mockDataSource = {
    transaction: jest
      .fn()
      .mockImplementation((cb) => cb(mockTransactionManager)),
  };

  const mockWorkflowVersionsService = {
    createVersion: jest.fn().mockResolvedValue({ id: 'v-id', version: 2 }),
    findOne: jest.fn(),
    findByWorkflow: jest.fn().mockResolvedValue([]),
  };

  const mockRegistry = {
    applyConfigDefaults: jest.fn(
      (_type: string, raw: Record<string, unknown>) => raw,
    ),
  };

  const mockLlmConfigService = {
    findDefault: jest.fn().mockResolvedValue(null),
  };

  const mockWorkspacesService = {
    findById: jest.fn().mockResolvedValue({ id: 'ws-uuid-1', type: 'team' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: getRepositoryToken(Workflow), useValue: mockRepository },
        { provide: getRepositoryToken(Node), useValue: mockNodeRepository },
        { provide: getRepositoryToken(Edge), useValue: mockEdgeRepository },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: WorkflowVersionsService,
          useValue: mockWorkflowVersionsService,
        },
        { provide: NodeComponentRegistry, useValue: mockRegistry },
        { provide: LlmConfigService, useValue: mockLlmConfigService },
        { provide: WorkspacesService, useValue: mockWorkspacesService },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
    jest.clearAllMocks();
    mockRegistry.applyConfigDefaults.mockImplementation(
      (_type: string, raw: Record<string, unknown>) => raw,
    );
    mockLlmConfigService.findDefault.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated workflows', async () => {
      const result = await service.findAll(
        'ws-uuid-1',
        { page: 1, limit: 20 },
        'user-uuid-1',
      );
      expect(result.data).toHaveLength(1);
      expect(result.pagination.totalItems).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it("ownership='mine' adds created_by = userId predicate in team workspace", async () => {
      mockWorkspacesService.findById.mockResolvedValueOnce({
        id: 'ws-uuid-1',
        type: 'team',
      });
      await service.findAll(
        'ws-uuid-1',
        { page: 1, limit: 20, ownership: 'mine' },
        'user-uuid-1',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'w.created_by = :userId',
        { userId: 'user-uuid-1' },
      );
    });

    it("ownership='shared' adds created_by != userId predicate in team workspace", async () => {
      mockWorkspacesService.findById.mockResolvedValueOnce({
        id: 'ws-uuid-1',
        type: 'team',
      });
      await service.findAll(
        'ws-uuid-1',
        { page: 1, limit: 20, ownership: 'shared' },
        'user-uuid-1',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'w.created_by != :userId',
        { userId: 'user-uuid-1' },
      );
    });

    it('ownership is ignored in personal workspace even when set', async () => {
      mockWorkspacesService.findById.mockResolvedValueOnce({
        id: 'ws-uuid-1',
        type: 'personal',
      });
      await service.findAll(
        'ws-uuid-1',
        { page: 1, limit: 20, ownership: 'mine' },
        'user-uuid-1',
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'w.created_by = :userId',
        expect.anything(),
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'w.created_by != :userId',
        expect.anything(),
      );
    });

    it("ownership='all' does not consult workspace type and does not add created_by predicate", async () => {
      mockWorkspacesService.findById.mockClear();
      mockQueryBuilder.andWhere.mockClear();
      await service.findAll(
        'ws-uuid-1',
        { page: 1, limit: 20, ownership: 'all' },
        'user-uuid-1',
      );
      expect(mockWorkspacesService.findById).not.toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('created_by'),
        expect.anything(),
      );
    });

    it('propagates workspacesService.findById rejection (does not swallow)', async () => {
      mockWorkspacesService.findById.mockRejectedValueOnce(
        new Error('ws-lookup-failed'),
      );
      await expect(
        service.findAll(
          'ws-uuid-1',
          { page: 1, limit: 20, ownership: 'mine' },
          'user-uuid-1',
        ),
      ).rejects.toThrow('ws-lookup-failed');
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
        expect.objectContaining({
          name: 'New Workflow',
          workspaceId: 'ws-uuid-1',
        }),
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
      mockRepository.findOne.mockResolvedValue({
        ...mockWorkflow,
        currentVersion: 1,
      });
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

      const result = await service.saveCanvas(
        'wf-uuid-1',
        'ws-uuid-1',
        'user-uuid-1',
        dto,
      );
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create a version snapshot after committing the canvas', async () => {
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
        changeSummary: 'initial setup',
      };

      await service.saveCanvas('wf-uuid-1', 'ws-uuid-1', 'user-uuid-1', dto);

      expect(mockWorkflowVersionsService.createVersion).toHaveBeenCalledWith(
        'wf-uuid-1',
        'user-uuid-1',
        expect.objectContaining({
          name: 'Updated Name',
          nodes: expect.any(Array),
          edges: expect.any(Array),
        }),
        'initial setup',
        mockTransactionManager,
      );
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
        service.saveCanvas('wf-uuid-1', 'ws-uuid-1', 'user-uuid-1', dto),
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
        service.saveCanvas('wf-uuid-1', 'ws-uuid-1', 'user-uuid-1', dto),
      ).rejects.toThrow(
        'Workflow cannot contain more than one Manual Trigger node',
      );
    });

    it('should reject canvas with duplicate node labels', async () => {
      const dto = {
        nodes: [
          {
            id: 'node-1',
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Manual Trigger',
            positionX: 100,
            positionY: 200,
          },
          {
            id: 'node-2',
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'HTTP Request',
            positionX: 300,
            positionY: 200,
          },
          {
            id: 'node-3',
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'HTTP Request',
            positionX: 500,
            positionY: 200,
          },
        ],
        edges: [],
      };

      await expect(
        service.saveCanvas('wf-uuid-1', 'ws-uuid-1', 'user-uuid-1', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('exportWorkflow', () => {
    it('emits containerIndex / toolOwnerIndex instead of UUIDs', async () => {
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      const nodes = [
        {
          id: 'n1',
          type: 'manual_trigger',
          category: 'trigger',
          label: 'Trig',
          positionX: 0,
          positionY: 0,
          config: {},
          isDisabled: false,
          description: null,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'n2',
          type: 'loop',
          category: 'logic',
          label: 'Loop',
          positionX: 0,
          positionY: 0,
          config: {},
          isDisabled: false,
          description: null,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'n3',
          type: 'http_request',
          category: 'integration',
          label: 'HTTP',
          positionX: 0,
          positionY: 0,
          config: {},
          isDisabled: false,
          description: null,
          containerId: 'n2',
          toolOwnerId: null,
        },
        {
          id: 'n4',
          type: 'ai_agent',
          category: 'ai',
          label: 'AI',
          positionX: 0,
          positionY: 0,
          config: {},
          isDisabled: false,
          description: null,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'n5',
          type: 'http_request',
          category: 'integration',
          label: 'Tool',
          positionX: 0,
          positionY: 0,
          config: {},
          isDisabled: false,
          description: null,
          containerId: null,
          toolOwnerId: 'n4',
        },
      ];
      mockNodeRepository.find.mockResolvedValue(nodes);
      mockEdgeRepository.find.mockResolvedValue([]);

      const result = (await service.exportWorkflow(
        'wf-uuid-1',
        'ws-uuid-1',
      )) as {
        nodes: {
          containerIndex: number | null;
          toolOwnerIndex: number | null;
        }[];
      };

      expect(result.nodes[0].containerIndex).toBeNull();
      expect(result.nodes[0].toolOwnerIndex).toBeNull();
      expect(result.nodes[2].containerIndex).toBe(1);
      expect(result.nodes[2].toolOwnerIndex).toBeNull();
      expect(result.nodes[4].containerIndex).toBeNull();
      expect(result.nodes[4].toolOwnerIndex).toBe(3);
      // No UUID fields leak through
      expect(result.nodes[0]).not.toHaveProperty('containerId');
      expect(result.nodes[0]).not.toHaveProperty('toolOwnerId');
    });
  });

  describe('importWorkflow', () => {
    beforeEach(() => {
      mockTransactionManager.update = jest.fn().mockResolvedValue(undefined);
      mockTransactionManager.save = jest
        .fn()
        .mockImplementation((entity, data) => {
          if (Array.isArray(data)) return Promise.resolve(data);
          if (entity === Node) {
            const newId = `new-${data.label}`;
            return Promise.resolve({ id: newId, ...data });
          }
          return Promise.resolve({ id: 'new-wf-id', ...data });
        });
    });

    it('remaps containerIndex to the new node UUID', async () => {
      const dto = {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          {
            type: 'loop',
            category: NodeCategory.LOGIC,
            label: 'Loop',
            positionX: 0,
            positionY: 0,
          },
          {
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'HTTP',
            positionX: 0,
            positionY: 0,
            containerIndex: 1,
          },
        ],
        edges: [],
      };

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', dto);

      expect(mockTransactionManager.update).toHaveBeenCalledWith(
        Node,
        'new-HTTP',
        { containerId: 'new-Loop' },
      );
    });

    it('remaps toolOwnerIndex to the new node UUID', async () => {
      const dto = {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          {
            type: 'ai_agent',
            category: NodeCategory.AI,
            label: 'AI',
            positionX: 0,
            positionY: 0,
          },
          {
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'Tool',
            positionX: 0,
            positionY: 0,
            toolOwnerIndex: 1,
          },
        ],
        edges: [],
      };

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', dto);

      expect(mockTransactionManager.update).toHaveBeenCalledWith(
        Node,
        'new-Tool',
        { toolOwnerId: 'new-AI' },
      );
    });

    it('rejects payload with duplicate node labels', async () => {
      const dto = {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Same',
            positionX: 0,
            positionY: 0,
          },
          {
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'Same',
            positionX: 0,
            positionY: 0,
          },
        ],
        edges: [],
      };

      await expect(
        service.importWorkflow('ws-uuid-1', 'user-uuid-1', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('importWorkflow — config defaults & LLM 주입', () => {
    beforeEach(() => {
      mockTransactionManager.update = jest.fn().mockResolvedValue(undefined);
      mockTransactionManager.save = jest
        .fn()
        .mockImplementation((entity, data) => {
          if (Array.isArray(data)) return Promise.resolve(data);
          if (entity === Node) {
            return Promise.resolve({ id: `new-${data.label}`, ...data });
          }
          return Promise.resolve({ id: 'new-wf-id', ...data });
        });
    });

    const aiAgentNode = (overrides: Record<string, unknown> = {}) => ({
      type: 'ai_agent',
      category: NodeCategory.AI,
      label: 'AI',
      positionX: 0,
      positionY: 0,
      ...overrides,
    });

    const findSavedNode = (label: string) =>
      mockTransactionManager.save.mock.calls.find(
        ([entity, data]) =>
          entity === Node && (data as { label: string }).label === label,
      )?.[1] as { config: Record<string, unknown> } | undefined;

    it('applies schema defaults via the registry', async () => {
      mockRegistry.applyConfigDefaults.mockImplementation((type, raw) =>
        type === 'ai_agent'
          ? { ...(raw as object), mode: 'single_turn', ragTopK: 5 }
          : raw,
      );

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({ config: {} }),
        ],
        edges: [],
      });

      expect(mockRegistry.applyConfigDefaults).toHaveBeenCalledWith(
        'ai_agent',
        {},
      );
      expect(findSavedNode('AI')?.config).toMatchObject({
        mode: 'single_turn',
        ragTopK: 5,
      });
    });

    it('preserves explicit config values over defaults', async () => {
      mockRegistry.applyConfigDefaults.mockImplementation((_type, raw) => raw);

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({
            config: { mode: 'multi_turn', systemPrompt: 'x' },
          }),
        ],
        edges: [],
      });

      expect(findSavedNode('AI')?.config).toEqual({
        mode: 'multi_turn',
        systemPrompt: 'x',
      });
    });

    it('injects workspace default llmConfigId for AI nodes when missing', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue({
        id: 'llm-default-1',
      });

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({ config: {} }),
        ],
        edges: [],
      });

      expect(findSavedNode('AI')?.config).toMatchObject({
        llmConfigId: 'llm-default-1',
      });
    });

    it('does not overwrite an explicit llmConfigId', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue({
        id: 'llm-default-1',
      });

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({ config: { llmConfigId: 'explicit-1' } }),
        ],
        edges: [],
      });

      expect(findSavedNode('AI')?.config).toMatchObject({
        llmConfigId: 'explicit-1',
      });
    });

    it('leaves llmConfigId undefined when no workspace default', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue(null);

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({ config: {} }),
        ],
        edges: [],
      });

      expect(findSavedNode('AI')?.config).not.toHaveProperty('llmConfigId');
    });

    it('does not inject llmConfigId for non-AI nodes', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue({
        id: 'llm-default-1',
      });

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          {
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'HTTP',
            positionX: 0,
            positionY: 0,
            config: {},
          },
        ],
        edges: [],
      });

      expect(findSavedNode('HTTP')?.config).not.toHaveProperty('llmConfigId');
    });

    it('falls back to raw config when registry returns it (parse failure case)', async () => {
      const rawConfig = { mode: 42 as unknown as string };
      mockRegistry.applyConfigDefaults.mockImplementation((_type, raw) => raw);

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({ config: rawConfig }),
        ],
        edges: [],
      });

      expect(findSavedNode('AI')?.config).toEqual(rawConfig);
    });

    it('looks up workspace default LLM only once per import (hoisting guard)', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue({
        id: 'llm-default-1',
      });

      await service.importWorkflow('ws-uuid-1', 'user-uuid-1', {
        name: 'Imported',
        nodes: [
          {
            type: 'manual_trigger',
            category: NodeCategory.TRIGGER,
            label: 'Trig',
            positionX: 0,
            positionY: 0,
          },
          aiAgentNode({ label: 'A1', config: {} }),
          aiAgentNode({ label: 'A2', config: {} }),
          aiAgentNode({ label: 'A3', config: {} }),
          aiAgentNode({ label: 'A4', config: {} }),
          aiAgentNode({ label: 'A5', config: {} }),
        ],
        edges: [],
      });

      expect(mockLlmConfigService.findDefault).toHaveBeenCalledTimes(1);
    });
  });

  describe('restoreVersion', () => {
    it('should throw BadRequestException when snapshot is malformed', async () => {
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      mockWorkflowVersionsService.findOne.mockResolvedValue({
        id: 'v-bad',
        workflowId: 'wf-uuid-1',
        version: 1,
        snapshot: { name: 'x' /* nodes/edges missing */ },
      });

      await expect(
        service.restoreVersion('wf-uuid-1', 'ws-uuid-1', 'v-bad', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from findOne', async () => {
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      mockWorkflowVersionsService.findOne.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.restoreVersion('wf-uuid-1', 'ws-uuid-1', 'v-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reapply snapshot via saveCanvas with "Restored from vN" summary', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockWorkflow,
        currentVersion: 3,
      });
      mockWorkflowVersionsService.findOne.mockResolvedValue({
        id: 'v-uuid-1',
        workflowId: 'wf-uuid-1',
        version: 2,
        snapshot: {
          name: 'Snapshot Name',
          nodes: [
            {
              id: 'node-1',
              type: 'manual_trigger',
              category: NodeCategory.TRIGGER,
              label: 'Manual Trigger',
              positionX: 0,
              positionY: 0,
              config: {},
            },
          ],
          edges: [],
        },
      });

      const saveCanvasSpy = jest.spyOn(service, 'saveCanvas');

      await service.restoreVersion(
        'wf-uuid-1',
        'ws-uuid-1',
        'v-uuid-1',
        'user-uuid-1',
      );

      expect(mockWorkflowVersionsService.findOne).toHaveBeenCalledWith(
        'wf-uuid-1',
        'v-uuid-1',
      );
      expect(saveCanvasSpy).toHaveBeenCalledWith(
        'wf-uuid-1',
        'ws-uuid-1',
        'user-uuid-1',
        expect.objectContaining({
          name: 'Snapshot Name',
          changeSummary: 'Restored from v2',
        }),
      );
    });
  });
});
