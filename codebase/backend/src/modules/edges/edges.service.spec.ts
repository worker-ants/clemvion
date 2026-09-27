import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
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
  let mockNodeRepo: any;

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
    mockNodeRepo = {
      // Default: both endpoints are nodes of the workflow.
      find: jest.fn(({ where }: any) =>
        Promise.resolve(
          (where.id.value as string[]).map((id: string) => ({ id })),
        ),
      ),
    };
    service = new EdgesService(mockRepo, mockWorkflowRepo, mockNodeRepo);
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

    // spec 1-data-model §1.1 — 끝점은 같은 워크플로의 노드만. 종전엔 다른 워크플로(다른 워크스페이스 포함)의 노드를 그대로 저장했다.
    it('끝점 조회는 워크플로로 거른다 — 소속 조건이 빠지면 남의 노드가 통과한다', async () => {
      mockRepo.save.mockResolvedValue(makeEdge('e1'));
      await service.create('wf-1', WS, {
        sourceNodeId: 'a',
        targetNodeId: 'b',
      } as any);
      expect(mockNodeRepo.find).toHaveBeenCalledWith({
        where: { id: In(['a', 'b']), workflowId: 'wf-1' },
        select: { id: true },
      });
    });

    it('이 워크플로에 없는 끝점은 400 — 틀린 끝점을 전부 싣고 저장하지 않는다', async () => {
      mockNodeRepo.find.mockResolvedValue([]);
      const err = await service
        .create('wf-1', WS, { sourceNodeId: 'a', targetNodeId: 'b' } as any)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'sourceNodeId', code: 'INVALID_FIELD' },
          { field: 'targetNodeId', code: 'INVALID_FIELD' },
        ],
      });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('한쪽만 없으면 그 끝점만 싣는다', async () => {
      mockNodeRepo.find.mockResolvedValue([{ id: 'a' }]);
      const err = await service
        .create('wf-1', WS, { sourceNodeId: 'a', targetNodeId: 'b' } as any)
        .catch((e: unknown) => e);
      expect(
        ((err as BadRequestException).getResponse() as { details: unknown })
          .details,
      ).toStrictEqual([
        {
          field: 'targetNodeId',
          message: 'Target node not found in this workflow',
          code: 'INVALID_FIELD',
        },
      ]);
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
