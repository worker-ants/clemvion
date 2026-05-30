import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EdgesService } from './edges.service';
import { Edge, EdgeType } from './entities/edge.entity';

const WS = 'ws-1';

function makeEdge(id: string, workflowId = 'wf-1', workspaceId = WS): Edge {
  const edge = new Edge();
  edge.id = id;
  edge.workflowId = workflowId;
  // remove() loads the edge with its `workflow` relation and checks
  // workflow.workspaceId in a single query (IDOR guard).
  edge.workflow = {
    id: workflowId,
    workspaceId,
  } as unknown as Edge['workflow'];
  edge.sourceNodeId = 'src';
  edge.targetNodeId = 'tgt';
  edge.sourcePort = 'out';
  edge.targetPort = 'in';
  edge.type = EdgeType.DATA;
  return edge;
}

describe('EdgesService', () => {
  let service: EdgesService;
  let mockRepo: any;
  let mockWorkflowRepo: any;

  beforeEach(() => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data: any) => ({ ...data }) as Edge),
      save: jest.fn((edge: any) => Promise.resolve(edge)),
      remove: jest.fn(),
    };
    mockWorkflowRepo = {
      // Default: workflow belongs to the caller's workspace.
      findOne: jest.fn().mockResolvedValue({ id: 'wf-1', workspaceId: WS }),
    };
    service = new EdgesService(mockRepo, mockWorkflowRepo);
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
          sourceNodeId: 'a',
          targetNodeId: 'b',
        } as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('remove throws NotFoundException when the edge belongs to another workspace', async () => {
      // Single-query path: edge loaded with its workflow relation in a foreign workspace.
      mockRepo.findOne.mockResolvedValue(
        makeEdge('e1', 'wf-other', 'ws-other'),
      );
      await expect(service.remove('e1', WS)).rejects.toThrow(NotFoundException);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('findByWorkflow', () => {
    it('returns edges for a workflow in the caller workspace', async () => {
      mockRepo.find.mockResolvedValue([makeEdge('e1')]);
      const result = await service.findByWorkflow('wf-1', WS);
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('rejects self-loop connections', async () => {
      await expect(
        service.create('wf-1', WS, {
          sourceNodeId: 'same',
          targetNodeId: 'same',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an edge for an in-workspace workflow', async () => {
      mockRepo.save.mockResolvedValue(makeEdge('e1'));
      const result = await service.create('wf-1', WS, {
        sourceNodeId: 'a',
        targetNodeId: 'b',
      } as any);
      expect(result.id).toBe('e1');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the edge does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing', WS)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes an edge in the caller workspace', async () => {
      mockRepo.findOne.mockResolvedValue(makeEdge('e1', 'wf-1'));
      await service.remove('e1', WS);
      expect(mockRepo.remove).toHaveBeenCalled();
    });
  });
});
