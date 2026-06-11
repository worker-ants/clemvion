import { BadRequestException } from '@nestjs/common';
import { ModelConfigController } from './model-config.controller';
import type { ModelConfigService } from './model-config.service';
import type { LlmService } from '../llm/llm.service';
import type { LlmPreviewService } from '../llm/llm-preview.service';

// Expose the module-private parseKind function via the controller's GET / endpoint,
// since parseKind is an internal helper used by multiple handlers.
type ServiceMethods = Pick<
  ModelConfigService,
  'findAll' | 'findById' | 'create' | 'update' | 'setDefault' | 'remove'
>;
type LlmServiceMethods = Pick<
  LlmService,
  'clearClientCache' | 'testConnection' | 'listModels'
>;
type PreviewMethods = Pick<LlmPreviewService, 'previewModels'>;

describe('ModelConfigController', () => {
  let controller: ModelConfigController;
  let mockModelConfigService: jest.Mocked<ServiceMethods>;
  let mockLlmService: jest.Mocked<LlmServiceMethods>;
  let mockLlmPreviewService: jest.Mocked<PreviewMethods>;

  beforeEach(() => {
    mockModelConfigService = {
      findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
      findById: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      setDefault: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    mockLlmService = {
      clearClientCache: jest.fn(),
      testConnection: jest.fn().mockResolvedValue({ ok: true }),
      listModels: jest.fn().mockResolvedValue([]),
    };
    mockLlmPreviewService = {
      previewModels: jest.fn().mockResolvedValue([]),
    };
    controller = new ModelConfigController(
      mockModelConfigService as unknown as ModelConfigService,
      mockLlmService as unknown as LlmService,
      mockLlmPreviewService as unknown as LlmPreviewService,
    );
  });

  // ── parseKind helper (tested via findAll) ──────────────────────────────────

  describe('findAll / parseKind', () => {
    it('throws BadRequestException when kind is undefined', async () => {
      await expect(
        controller.findAll('ws-1', undefined as any, { page: 1, limit: 20 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when kind is an invalid string', async () => {
      await expect(
        controller.findAll('ws-1', 'unknown' as any, { page: 1, limit: 20 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates to service with valid kind=chat', async () => {
      await controller.findAll('ws-1', 'chat', { page: 1, limit: 20 });
      expect(mockModelConfigService.findAll).toHaveBeenCalledWith(
        'ws-1',
        'chat',
        { page: 1, limit: 20 },
      );
    });

    it('delegates to service with valid kind=embedding', async () => {
      await controller.findAll('ws-1', 'embedding', { page: 1, limit: 20 });
      expect(mockModelConfigService.findAll).toHaveBeenCalledWith(
        'ws-1',
        'embedding',
        { page: 1, limit: 20 },
      );
    });

    it('delegates to service with valid kind=rerank', async () => {
      await controller.findAll('ws-1', 'rerank', { page: 1, limit: 20 });
      expect(mockModelConfigService.findAll).toHaveBeenCalledWith(
        'ws-1',
        'rerank',
        { page: 1, limit: 20 },
      );
    });
  });

  // ── update — clearClientCache called after service update ─────────────────

  describe('update', () => {
    it('calls modelConfigService.update then clears the client cache', async () => {
      const dto = { name: 'New name' };
      const updated = { id: 'cfg-1', name: 'New name' };
      mockModelConfigService.update.mockResolvedValue(updated);

      const result = await controller.update('cfg-1', 'ws-1', dto as any);

      expect(mockModelConfigService.update).toHaveBeenCalledWith(
        'cfg-1',
        'ws-1',
        dto,
      );
      expect(mockLlmService.clearClientCache).toHaveBeenCalledWith('cfg-1');
      expect(result).toBe(updated);
    });

    it('clears cache even if service resolves with an empty object', async () => {
      mockModelConfigService.update.mockResolvedValue({});
      await controller.update('id-x', 'ws-1', {} as any);
      expect(mockLlmService.clearClientCache).toHaveBeenCalledWith('id-x');
    });
  });

  // ── remove — clearClientCache called after service remove ─────────────────

  describe('remove', () => {
    it('calls modelConfigService.remove then clears the client cache', async () => {
      await controller.remove('cfg-2', 'ws-1');

      expect(mockModelConfigService.remove).toHaveBeenCalledWith(
        'cfg-2',
        'ws-1',
      );
      expect(mockLlmService.clearClientCache).toHaveBeenCalledWith('cfg-2');
    });

    it('does NOT call clearClientCache when remove throws', async () => {
      mockModelConfigService.remove.mockRejectedValue(new Error('not found'));
      await expect(controller.remove('bad-id', 'ws-1')).rejects.toThrow();
      expect(mockLlmService.clearClientCache).not.toHaveBeenCalled();
    });
  });

  // ── previewModels ──────────────────────────────────────────────────────────

  describe('previewModels', () => {
    it('delegates to LlmPreviewService.previewModels and returns result', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmPreviewService.previewModels.mockResolvedValue(models);

      const dto = { provider: 'openai' as const, apiKey: 'sk-xxx' };
      const result = await controller.previewModels(dto as any);

      expect(mockLlmPreviewService.previewModels).toHaveBeenCalledWith(dto);
      expect(result).toBe(models);
      expect(mockLlmService.clearClientCache).not.toHaveBeenCalled();
    });
  });

  // ── Roles decorator guard — editor paths ──────────────────────────────────

  describe('@Roles decorator presence (metadata check)', () => {
    it("create method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        'roles',
        ModelConfigController.prototype.create,
      );
      expect(roles).toContain('editor');
    });

    it("update method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        'roles',
        ModelConfigController.prototype.update,
      );
      expect(roles).toContain('editor');
    });

    it("remove method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        'roles',
        ModelConfigController.prototype.remove,
      );
      expect(roles).toContain('editor');
    });
  });
});
