import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { Folder } from './entities/folder.entity';

describe('FoldersService', () => {
  let service: FoldersService;

  const mockFolder: Partial<Folder> = {
    id: 'folder-uuid-1',
    workspaceId: 'ws-uuid-1',
    name: 'Test Folder',
    parentId: null as unknown as string,
    sortOrder: 0,
  };

  const mockRepository = {
    find: jest.fn().mockResolvedValue([mockFolder]),
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
        FoldersService,
        { provide: getRepositoryToken(Folder), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return folders', async () => {
      const result = await service.findAll('ws-uuid-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return a folder', async () => {
      mockRepository.findOne.mockResolvedValue(mockFolder);
      const result = await service.findById('folder-uuid-1', 'ws-uuid-1');
      expect(result.name).toBe('Test Folder');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(
        service.findById('nonexistent', 'ws-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a folder at root level', async () => {
      const result = await service.create('ws-uuid-1', { name: 'New Folder' });
      expect(result.name).toBe('New Folder');
    });

    it('should enforce max nesting depth', async () => {
      // Build a chain of 5 parents
      let callCount = 0;
      mockRepository.findOne.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) {
          return Promise.resolve({
            id: `parent-${callCount}`,
            parentId: callCount < 5 ? `parent-${callCount + 1}` : null,
            workspaceId: 'ws-uuid-1',
          });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.create('ws-uuid-1', {
          name: 'Deep Folder',
          parentId: 'parent-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update — parentId 재검증 (V-04)', () => {
    beforeEach(() => {
      mockRepository.findOne.mockReset();
      mockRepository.find.mockReset();
    });

    it('renames without parent change (no re-validation)', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'f1',
        workspaceId: 'ws-uuid-1',
        name: 'F1',
        parentId: null,
      });
      const result = await service.update('f1', 'ws-uuid-1', {
        name: 'Renamed',
      });
      expect(result.name).toBe('Renamed');
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('rejects self as parent (cycle → VALIDATION_ERROR)', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'f1',
        workspaceId: 'ws-uuid-1',
        parentId: null,
      });
      await expect(
        service.update('f1', 'ws-uuid-1', { parentId: 'f1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects parent in another workspace / nonexistent', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce({
          id: 'f1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // findById
        .mockResolvedValueOnce(null); // parent lookup → 없음
      await expect(
        service.update('f1', 'ws-uuid-1', { parentId: 'other-ws-folder' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects moving under own descendant (cycle)', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce({
          id: 'f1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // findById
        .mockResolvedValueOnce({
          id: 'f2',
          workspaceId: 'ws-uuid-1',
          parentId: 'f1',
        }); // parent(f2) lookup
      // collectSubtree(f1): f1 의 자식 [f2], f2 의 자식 []
      mockRepository.find
        .mockResolvedValueOnce([{ id: 'f2', parentId: 'f1' }])
        .mockResolvedValueOnce([]);
      await expect(
        service.update('f1', 'ws-uuid-1', { parentId: 'f2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when resulting depth exceeds max', async () => {
      // parent 가 5단계(depth 5) + leaf(height 1) 이동 → 6 > 5.
      mockRepository.findOne
        .mockResolvedValueOnce({
          id: 'f1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // findById
        .mockResolvedValueOnce({
          id: 'p1',
          workspaceId: 'ws-uuid-1',
          parentId: 'p2',
        }) // parent lookup
        // getDepth(p1) 체인: p1→p2→p3→p4→p5→null = depth 5
        .mockResolvedValueOnce({ id: 'p1', parentId: 'p2' })
        .mockResolvedValueOnce({ id: 'p2', parentId: 'p3' })
        .mockResolvedValueOnce({ id: 'p3', parentId: 'p4' })
        .mockResolvedValueOnce({ id: 'p4', parentId: 'p5' })
        .mockResolvedValueOnce({ id: 'p5', parentId: null });
      mockRepository.find.mockResolvedValueOnce([]); // collectSubtree(f1) → leaf
      await expect(
        service.update('f1', 'ws-uuid-1', { parentId: 'p1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows moving to root (parentId null)', async () => {
      mockRepository.findOne.mockResolvedValueOnce({
        id: 'f1',
        workspaceId: 'ws-uuid-1',
        parentId: 'p1',
        name: 'F1',
      });
      const result = await service.update('f1', 'ws-uuid-1', {
        parentId: null,
      });
      expect(result).toBeDefined();
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('allows a valid shallow reparent', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce({
          id: 'f1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // findById
        .mockResolvedValueOnce({
          id: 'p1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // parent lookup
        .mockResolvedValueOnce({ id: 'p1', parentId: null }); // getDepth(p1) → 1
      mockRepository.find.mockResolvedValueOnce([]); // collectSubtree(f1) → leaf, height 1
      const result = await service.update('f1', 'ws-uuid-1', {
        parentId: 'p1',
      });
      expect(result).toBeDefined();
    });

    it('getDepth terminates on cyclic parent chain (no infinite loop)', async () => {
      // 손상 데이터 a→b→a. 가드 없으면 무한루프. create 경유 getDepth('a') 호출.
      mockRepository.findOne.mockImplementation(
        (opts: { where: { id: string } }) => {
          const id = opts.where.id;
          if (id === 'a')
            return Promise.resolve({
              id: 'a',
              parentId: 'b',
              workspaceId: 'ws-uuid-1',
            });
          if (id === 'b')
            return Promise.resolve({
              id: 'b',
              parentId: 'a',
              workspaceId: 'ws-uuid-1',
            });
          return Promise.resolve(null);
        },
      );
      // 무한루프면 jest timeout. 반환되면(성공/실패 무관) 가드가 종료시킨 것.
      await service.create('ws-uuid-1', { name: 'x', parentId: 'a' });
      expect(true).toBe(true);
    });

    it('allows reparent at exactly max depth (parent depth 4 + leaf = 5)', async () => {
      // 경계값 — 정확히 MAX_NESTING_DEPTH(5) 는 허용, 초과만 차단.
      mockRepository.findOne
        .mockResolvedValueOnce({
          id: 'f1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // findById
        .mockResolvedValueOnce({
          id: 'p1',
          workspaceId: 'ws-uuid-1',
          parentId: 'p2',
        }) // parent lookup
        // getDepth(p1): p1→p2→p3→p4→null = depth 4
        .mockResolvedValueOnce({ id: 'p1', parentId: 'p2' })
        .mockResolvedValueOnce({ id: 'p2', parentId: 'p3' })
        .mockResolvedValueOnce({ id: 'p3', parentId: 'p4' })
        .mockResolvedValueOnce({ id: 'p4', parentId: null });
      mockRepository.find.mockResolvedValueOnce([]); // collectSubtree(f1) → leaf, height 1
      const result = await service.update('f1', 'ws-uuid-1', {
        parentId: 'p1',
      });
      expect(result).toBeDefined(); // 4 + 1 = 5 ≤ 5 → 허용
    });

    it('detects cycle across a multi-child, multi-level subtree (BFS 다중 frontier)', async () => {
      // f1 서브트리: [c1, c2] → c1 의 자식 [gc1]. f1 을 gc1(손자) 아래로 이동 → cycle.
      mockRepository.findOne
        .mockResolvedValueOnce({
          id: 'f1',
          workspaceId: 'ws-uuid-1',
          parentId: null,
        }) // findById
        .mockResolvedValueOnce({
          id: 'gc1',
          workspaceId: 'ws-uuid-1',
          parentId: 'c1',
        }); // parent(gc1) lookup
      // collectSubtree(f1): L1 [c1,c2](형제 다중), L2 [gc1](c1·c2 자식 batch), L3 []
      mockRepository.find
        .mockResolvedValueOnce([
          { id: 'c1', parentId: 'f1' },
          { id: 'c2', parentId: 'f1' },
        ])
        .mockResolvedValueOnce([{ id: 'gc1', parentId: 'c1' }])
        .mockResolvedValueOnce([]);
      await expect(
        service.update('f1', 'ws-uuid-1', { parentId: 'gc1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
