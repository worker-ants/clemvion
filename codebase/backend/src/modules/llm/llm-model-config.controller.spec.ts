import { LlmModelConfigController } from './llm-model-config.controller';
import type { LlmService } from './llm.service';
import type { LlmPreviewService } from './llm-preview.service';

// LLM-구동 부속 엔드포인트(preview / test / list models)는 model-config ↔ llm
// forwardRef 순환을 끊기 위해 ModelConfigController 에서 이 컨트롤러로 이전됐다
// (C-2 cluster 4). 라우트(`model-configs/*`)·동작은 불변 — 위임만 검증한다.
type LlmServiceMethods = Pick<LlmService, 'testConnection' | 'listModels'>;
type PreviewMethods = Pick<LlmPreviewService, 'previewModels'>;

describe('LlmModelConfigController', () => {
  let controller: LlmModelConfigController;
  let mockLlmService: jest.Mocked<LlmServiceMethods>;
  let mockLlmPreviewService: jest.Mocked<PreviewMethods>;

  beforeEach(() => {
    mockLlmService = {
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      listModels: jest.fn().mockResolvedValue([]),
    };
    mockLlmPreviewService = {
      previewModels: jest.fn().mockResolvedValue([]),
    };
    controller = new LlmModelConfigController(
      mockLlmService as unknown as LlmService,
      mockLlmPreviewService as unknown as LlmPreviewService,
    );
  });

  describe('previewModels', () => {
    it('delegates to LlmPreviewService.previewModels and returns result', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmPreviewService.previewModels.mockResolvedValue(models);

      const dto = { provider: 'openai' as const, apiKey: 'sk-xxx' };
      const result = await controller.previewModels(dto as any);

      expect(mockLlmPreviewService.previewModels).toHaveBeenCalledWith(dto);
      expect(result).toBe(models);
    });
  });

  describe('testConnection', () => {
    it('delegates to LlmService.testConnection with id + workspaceId', async () => {
      const outcome = { success: true };
      mockLlmService.testConnection.mockResolvedValue(outcome);

      const result = await controller.testConnection('cfg-1', 'ws-1');

      expect(mockLlmService.testConnection).toHaveBeenCalledWith(
        'cfg-1',
        'ws-1',
      );
      expect(result).toBe(outcome);
    });
  });

  describe('listModels', () => {
    it('delegates to LlmService.listModels passing the optional type filter', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmService.listModels.mockResolvedValue(models);

      const result = await controller.listModels('cfg-1', 'ws-1', 'chat');

      expect(mockLlmService.listModels).toHaveBeenCalledWith('cfg-1', 'ws-1', {
        type: 'chat',
      });
      expect(result).toBe(models);
    });

    it('passes type=undefined when the query param is omitted', async () => {
      await controller.listModels('cfg-1', 'ws-1');
      expect(mockLlmService.listModels).toHaveBeenCalledWith('cfg-1', 'ws-1', {
        type: undefined,
      });
    });
  });

  // ── route prefix preserved (public API unchanged) ──────────────────────────
  it("keeps the 'model-configs' controller route prefix (no API break)", () => {
    const path = Reflect.getMetadata('path', LlmModelConfigController);
    expect(path).toBe('model-configs');
  });

  // ── @Roles guard — preview-models stays editor-gated ──────────────────────
  describe('@Roles decorator presence (metadata check)', () => {
    it("previewModels method has 'editor' role metadata", () => {
      const roles = Reflect.getMetadata(
        'roles',
        LlmModelConfigController.prototype.previewModels,
      );
      expect(roles).toContain('editor');
    });
  });
});
