import { ConflictException, NotFoundException } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { Node, NodeCategory } from './entities/node.entity';

const WS = 'ws-1';

function makeWorkflow(id: string, workspaceId: string) {
  return { id, workspaceId };
}

function makeNode(id: string, label: string, workflowId = 'wf-1'): Node {
  const node = new Node();
  node.id = id;
  node.label = label;
  node.workflowId = workflowId;
  node.type = 'http_request';
  node.category = NodeCategory.INTEGRATION;
  node.positionX = 0;
  node.positionY = 0;
  node.config = {};
  node.isDisabled = false;
  return node;
}

describe('NodesService', () => {
  let service: NodesService;
  let mockRepo: any;
  let mockWorkflowRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data: any) => ({ ...data }) as Node),
      save: jest.fn((node: any) => Promise.resolve(node)),
      remove: jest.fn(),
    };
    mockWorkflowRepo = {
      // Default: workflow belongs to the caller's workspace.
      findOne: jest.fn().mockResolvedValue(makeWorkflow('wf-1', WS)),
    };
    service = new NodesService(mockRepo, mockWorkflowRepo);
  });

  describe('cross-workspace authorization (IDOR guard)', () => {
    it('findByWorkflow throws NotFoundException for a workflow in another workspace', async () => {
      mockWorkflowRepo.findOne.mockResolvedValue(null);
      await expect(service.findByWorkflow('wf-other', WS)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it('create throws NotFoundException for a workflow in another workspace', async () => {
      mockWorkflowRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create('wf-other', WS, {
          type: 'http_request',
          category: NodeCategory.INTEGRATION,
          label: 'HTTP Request',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('update throws NotFoundException when the node belongs to another workspace', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeNode('n1', 'HTTP Request', 'wf-other'),
      );
      mockWorkflowRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('n1', WS, { label: 'API Call' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('remove throws NotFoundException when the node belongs to another workspace', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeNode('n1', 'HTTP Request', 'wf-other'),
      );
      mockWorkflowRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('n1', WS)).rejects.toThrow(NotFoundException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a node when label is unique', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(makeNode('n1', 'HTTP Request', 'wf-1'));
      mockRepo.save.mockResolvedValue(makeNode('n1', 'HTTP Request', 'wf-1'));

      const result = await service.create('wf-1', WS, {
        type: 'http_request',
        category: NodeCategory.INTEGRATION,
        label: 'HTTP Request',
      });

      expect(result.label).toBe('HTTP Request');
    });

    it('should throw ConflictException when label is duplicated', async () => {
      mockRepo.findOne.mockResolvedValue(
        makeNode('existing', 'HTTP Request', 'wf-1'),
      );

      await expect(
        service.create('wf-1', WS, {
          type: 'http_request',
          category: NodeCategory.INTEGRATION,
          label: 'HTTP Request',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should allow update when label unchanged', async () => {
      const existing = makeNode('n1', 'HTTP Request', 'wf-1');
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue({ ...existing, config: { url: 'test' } });

      const result = await service.update('n1', WS, {
        label: 'HTTP Request',
        config: { url: 'test' },
      });

      expect(result.config).toEqual({ url: 'test' });
    });

    it('should allow rename to a unique label', async () => {
      const existing = makeNode('n1', 'HTTP Request', 'wf-1');
      // First findOne for findById
      mockRepo.findOne
        .mockResolvedValueOnce(existing)
        // Second findOne for assertLabelUnique
        .mockResolvedValueOnce(null);
      mockRepo.save.mockResolvedValue({ ...existing, label: 'API Call' });

      const result = await service.update('n1', WS, { label: 'API Call' });
      expect(result.label).toBe('API Call');
    });

    it('should throw ConflictException when renaming to a duplicate label', async () => {
      const existing = makeNode('n1', 'HTTP Request', 'wf-1');
      const conflicting = makeNode('n2', 'API Call', 'wf-1');
      mockRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(conflicting);

      await expect(
        service.update('n1', WS, { label: 'API Call' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('bulkCreate', () => {
    it('should throw on duplicate labels within the batch', async () => {
      await expect(
        service.bulkCreate('wf-1', [
          {
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'HTTP Request',
          },
          {
            type: 'http_request',
            category: NodeCategory.INTEGRATION,
            label: 'HTTP Request',
          },
        ]),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw when batch label conflicts with existing node', async () => {
      mockRepo.find.mockResolvedValue([
        makeNode('existing', 'HTTP Request', 'wf-1'),
      ]);

      await expect(
        service.bulkCreate('wf-1', [
          {
            type: 'code',
            category: NodeCategory.DATA,
            label: 'HTTP Request',
          },
        ]),
      ).rejects.toThrow(ConflictException);
    });

    it('should create nodes when all labels are unique', async () => {
      mockRepo.find.mockResolvedValue([]);
      const nodes = [
        makeNode('n1', 'HTTP Request', 'wf-1'),
        makeNode('n2', 'Code', 'wf-1'),
      ];
      mockRepo.save.mockResolvedValue(nodes);

      const result = await service.bulkCreate('wf-1', [
        {
          type: 'http_request',
          category: NodeCategory.INTEGRATION,
          label: 'HTTP Request',
        },
        {
          type: 'code',
          category: NodeCategory.DATA,
          label: 'Code',
        },
      ]);

      expect(result).toHaveLength(2);
    });
  });
});
