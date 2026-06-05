import { Reflector } from '@nestjs/core';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AgentMemoryController } from './agent-memory.controller';
import { AgentMemoryService } from './agent-memory.service';
import { ROLES_KEY } from '../../common/guards/roles.guard';

describe('AgentMemoryController (spec §6, AGM-12/13)', () => {
  let controller: AgentMemoryController;
  let service: {
    listScopes: jest.Mock;
    listMemories: jest.Mock;
    deleteMemory: jest.Mock;
    clearScope: jest.Mock;
  };

  beforeEach(() => {
    service = {
      listScopes: jest.fn(),
      listMemories: jest.fn(),
      deleteMemory: jest.fn(),
      clearScope: jest.fn(),
    };
    controller = new AgentMemoryController(
      service as unknown as AgentMemoryService,
    );
  });

  describe('@Roles 메타데이터 — 삭제는 editor+, 조회는 viewer+', () => {
    const reflector = new Reflector();

    it('deleteMemory / clearScope 는 @Roles(editor) 로 가드된다', () => {
      expect(
        reflector.get<string[]>(
          ROLES_KEY,
          AgentMemoryController.prototype.deleteMemory,
        ),
      ).toEqual(['editor']);
      expect(
        reflector.get<string[]>(
          ROLES_KEY,
          AgentMemoryController.prototype.clearScope,
        ),
      ).toEqual(['editor']);
    });

    it('조회(listScopes/listMemories) 는 @Roles 미적용 (viewer+ 접근)', () => {
      expect(
        reflector.get<string[]>(
          ROLES_KEY,
          AgentMemoryController.prototype.listScopes,
        ),
      ).toBeUndefined();
      expect(
        reflector.get<string[]>(
          ROLES_KEY,
          AgentMemoryController.prototype.listMemories,
        ),
      ).toBeUndefined();
    });
  });

  describe('listScopes (GET /agent-memories/scopes)', () => {
    it('workspaceId + limit/offset/q 를 서비스에 위임하고 PaginatedResponseDto 로 감싼다', async () => {
      service.listScopes.mockResolvedValue({
        items: [{ scopeKey: 'cust-1', count: 3, latestUpdatedAt: 'T' }],
        total: 7,
      });

      const result = await controller.listScopes('ws-1', {
        limit: 30,
        offset: 0,
        q: 'cust',
      });

      expect(service.listScopes).toHaveBeenCalledWith('ws-1', {
        limit: 30,
        offset: 0,
        q: 'cust',
      });
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 30,
        totalItems: 7,
        totalPages: 1,
      });
    });

    it('offset 으로부터 page 를 파생한다 (offset=60, limit=30 → page 3)', async () => {
      service.listScopes.mockResolvedValue({ items: [], total: 100 });
      const result = await controller.listScopes('ws-1', {
        limit: 30,
        offset: 60,
      });
      expect(result.pagination.page).toBe(3);
    });
  });

  describe('listMemories (GET /agent-memories)', () => {
    it('scopeKey + kind + limit/offset 를 서비스에 위임한다', async () => {
      service.listMemories.mockResolvedValue({
        items: [
          {
            id: 'm1',
            content: 'c',
            kind: 'fact',
            scopeKey: 'cust-1',
            createdAt: 'T',
            updatedAt: 'T',
            expiresAt: null,
          },
        ],
        total: 1,
      });

      const result = await controller.listMemories('ws-1', {
        scopeKey: 'cust-1',
        kind: 'preference',
        limit: 30,
        offset: 0,
      });

      expect(service.listMemories).toHaveBeenCalledWith('ws-1', 'cust-1', {
        kind: 'preference',
        limit: 30,
        offset: 0,
      });
      expect(result.data[0].id).toBe('m1');
      expect(result.pagination.totalItems).toBe(1);
    });
  });

  describe('deleteMemory (DELETE /agent-memories/:id)', () => {
    it('affected>0 이면 정상 반환 (204) — id + workspaceId 위임', async () => {
      service.deleteMemory.mockResolvedValue(1);
      await expect(
        controller.deleteMemory('mem-1', 'ws-1'),
      ).resolves.toBeUndefined();
      expect(service.deleteMemory).toHaveBeenCalledWith('ws-1', 'mem-1');
    });

    it('affected=0 이면 NotFoundException (워크스페이스 교차 차단 — AGM-13)', async () => {
      service.deleteMemory.mockResolvedValue(0);
      await expect(controller.deleteMemory('mem-x', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('clearScope (DELETE /agent-memories?scopeKey=)', () => {
    it('scopeKey 가 있으면 workspaceId + scopeKey 위임 (204)', async () => {
      service.clearScope.mockResolvedValue(5);
      await expect(
        controller.clearScope('ws-1', { scopeKey: 'cust-1' }),
      ).resolves.toBeUndefined();
      expect(service.clearScope).toHaveBeenCalledWith('ws-1', 'cust-1');
    });

    it('scopeKey 가 공백만이면 BadRequestException, 서비스 미호출', async () => {
      await expect(
        controller.clearScope('ws-1', { scopeKey: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(service.clearScope).not.toHaveBeenCalled();
    });
  });
});
