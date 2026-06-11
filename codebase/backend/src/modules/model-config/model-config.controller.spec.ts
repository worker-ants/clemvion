import { BadRequestException } from '@nestjs/common';
import { ModelConfigController } from './model-config.controller';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { ListModelConfigsQueryDto } from './dto/list-model-configs-query.dto';
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
        controller.findAll('ws-1', { page: 1, limit: 20 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when kind is an invalid string', async () => {
      await expect(
        controller.findAll('ws-1', {
          kind: 'unknown',
          page: 1,
          limit: 20,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates to service with valid kind=chat', async () => {
      const query = { kind: 'chat', page: 1, limit: 20 };
      await controller.findAll('ws-1', query as any);
      expect(mockModelConfigService.findAll).toHaveBeenCalledWith(
        'ws-1',
        'chat',
        query,
      );
    });

    it('delegates to service with valid kind=embedding', async () => {
      const query = { kind: 'embedding', page: 1, limit: 20 };
      await controller.findAll('ws-1', query as any);
      expect(mockModelConfigService.findAll).toHaveBeenCalledWith(
        'ws-1',
        'embedding',
        query,
      );
    });

    it('delegates to service with valid kind=rerank', async () => {
      const query = { kind: 'rerank', page: 1, limit: 20 };
      await controller.findAll('ws-1', query as any);
      expect(mockModelConfigService.findAll).toHaveBeenCalledWith(
        'ws-1',
        'rerank',
        query,
      );
    });
  });

  // ── Regression: `kind` must survive the global whitelist ValidationPipe ─────
  // Previously findAll bound `@Query() query: PaginationQueryDto`, so the
  // `kind` query param (not a PaginationQueryDto property) was rejected by
  // `forbidNonWhitelisted` with "property kind should not exist" → HTTP 400 on
  // the /models page. The dedicated ListModelConfigsQueryDto whitelists `kind`.
  describe('ListModelConfigsQueryDto whitelist', () => {
    // WARNING#1 fix: pipe/metadata instantiated per-test in beforeEach for full
    // isolation — avoids shared state if pipe ever becomes stateful.
    let pipe: CustomValidationPipe;
    let metadata: { type: 'query'; metatype: typeof ListModelConfigsQueryDto };

    beforeEach(() => {
      pipe = new CustomValidationPipe();
      metadata = {
        type: 'query' as const,
        metatype: ListModelConfigsQueryDto,
      };
    });

    it('passes the global whitelist pipe with kind + pagination present', async () => {
      const result = (await pipe.transform(
        { kind: 'chat', limit: '100' },
        metadata,
      )) as ListModelConfigsQueryDto;
      expect(result.kind).toBe('chat');
      expect(result.limit).toBe(100);
    });

    it('still rejects an unknown query property (whitelist intact)', async () => {
      await expect(
        pipe.transform({ kind: 'chat', bogus: 'x' }, metadata),
      ).rejects.toThrow('Input validation failed');
    });

    // WARNING#2 fix: page default value when omitted
    it('defaults page to 1 when page is not provided', async () => {
      const result = (await pipe.transform(
        { kind: 'chat' },
        metadata,
      )) as ListModelConfigsQueryDto;
      expect(result.page).toBe(1);
    });

    // WARNING#2 fix: sort/order defaults when omitted
    it('defaults sort to created_at and order to desc when omitted', async () => {
      const result = (await pipe.transform(
        { kind: 'chat' },
        metadata,
      )) as ListModelConfigsQueryDto;
      expect(result.sort).toBe('created_at');
      expect(result.order).toBe('desc');
    });

    // WARNING#2 fix: kind as number (not string) must be rejected by @IsString
    it('rejects kind when provided as a number (type coercion guard)', async () => {
      await expect(pipe.transform({ kind: 123 }, metadata)).rejects.toThrow(
        'Input validation failed',
      );
    });

    // WARNING#2 + WARNING#3 fix: empty string kind passes @IsString but must be
    // caught by parseKind's !kind falsy branch → BadRequestException
    it('throws BadRequestException when kind is empty string', async () => {
      // The pipe passes '' (satisfies @IsString @IsOptional), but parseKind
      // rejects it via the `!kind` falsy guard.
      const result = (await pipe.transform(
        { kind: '' },
        metadata,
      )) as ListModelConfigsQueryDto;
      // Pipe itself accepts it (IsString passes on '')
      expect(result.kind).toBe('');
      // Controller then rejects it
      await expect(controller.findAll('ws-1', result as any)).rejects.toThrow(
        BadRequestException,
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

    it("setDefault method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        'roles',
        ModelConfigController.prototype.setDefault,
      );
      expect(roles).toContain('editor');
    });

    it("previewModels method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        'roles',
        ModelConfigController.prototype.previewModels,
      );
      expect(roles).toContain('editor');
    });
  });
});
