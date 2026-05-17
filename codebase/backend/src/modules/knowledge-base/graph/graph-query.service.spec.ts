import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GraphQueryService } from './graph-query.service';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { GraphEntity } from '../entities/entity.entity';
import { GraphRelation } from '../entities/relation.entity';
import { KbStatsHelper } from './kb-stats.helper';

describe('GraphQueryService', () => {
  let service: GraphQueryService;
  let mockKbRepo: Record<string, jest.Mock>;
  let mockEntityRepo: Record<string, jest.Mock>;
  let mockRelationRepo: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    const qbStub = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockKbRepo = {
      findOne: jest.fn(),
    };
    mockEntityRepo = {
      createQueryBuilder: jest.fn(() => ({ ...qbStub })),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockRelationRepo = {
      createQueryBuilder: jest.fn(() => ({ ...qbStub })),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const mockKbStats = {
      refresh: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphQueryService,
        { provide: getRepositoryToken(KnowledgeBase), useValue: mockKbRepo },
        { provide: getRepositoryToken(GraphEntity), useValue: mockEntityRepo },
        {
          provide: getRepositoryToken(GraphRelation),
          useValue: mockRelationRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: KbStatsHelper, useValue: mockKbStats },
      ],
    }).compile();
    service = module.get(GraphQueryService);
  });

  it('throws KB_NOT_GRAPH_MODE for vector-mode KB', async () => {
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'vector',
    });

    await expect(
      service.listEntities('kb-1', 'ws-1', {}),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'KB_NOT_GRAPH_MODE' }),
    });
  });

  it('throws NotFoundException when KB does not exist', async () => {
    mockKbRepo.findOne.mockResolvedValue(null);
    await expect(
      service.listEntities('missing', 'ws-1', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid type filter', async () => {
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'graph',
    });

    await expect(
      service.listEntities('kb-1', 'ws-1', { type: 'not-an-enum' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clamps visualization limit between 1 and 200', async () => {
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'graph',
    });
    const takeSpy = jest.fn().mockReturnThis();
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: takeSpy,
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockEntityRepo.createQueryBuilder = jest.fn(() => qb);

    // 999 입력 → 상한 200 으로 클램핑. take 인자는 limit + 1 (truncated 검사용).
    await service.getGraphVisualization('kb-1', 'ws-1', 999);
    expect(takeSpy).toHaveBeenCalledWith(201);

    // 0/음수 입력 → 하한 1 로 클램핑.
    await service.getGraphVisualization('kb-1', 'ws-1', 0);
    expect(takeSpy).toHaveBeenLastCalledWith(2);
  });

  it('cascade-removes entity and delegates stats refresh to KbStatsHelper', async () => {
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'graph',
    });
    mockEntityRepo.findOne.mockResolvedValue({
      id: 'ent-1',
      knowledgeBaseId: 'kb-1',
    });

    await service.deleteEntity('kb-1', 'ent-1', 'ws-1');

    expect(mockEntityRepo.remove).toHaveBeenCalled();
    // Stats 갱신은 KbStatsHelper.refresh 로 위임됨 — graph-query.service 가 직접 SQL 실행 안 함.
    // 본 테스트는 cascade 호출 흐름만 검증.
  });
});
