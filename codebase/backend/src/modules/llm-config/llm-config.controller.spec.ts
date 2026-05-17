// Covers only previewModels — full CRUD handler coverage lives in
// llm-config.service.spec.ts for business logic and in e2e tests for routing.
import { LlmConfigController } from './llm-config.controller';
import type { LlmConfigService } from './llm-config.service';
import type { LlmService } from '../llm/llm.service';
import type { LlmPreviewService } from '../llm/llm-preview.service';

type ServiceMethods = Pick<
  LlmService,
  'testConnection' | 'listModels' | 'clearClientCache'
>;
type PreviewMethods = Pick<LlmPreviewService, 'previewModels'>;
type ConfigMethods = Pick<
  LlmConfigService,
  'findAll' | 'findById' | 'create' | 'update' | 'setDefault' | 'remove'
>;

describe('LlmConfigController', () => {
  let controller: LlmConfigController;
  let mockLlmConfigService: jest.Mocked<ConfigMethods>;
  let mockLlmService: jest.Mocked<ServiceMethods>;
  let mockLlmPreviewService: jest.Mocked<PreviewMethods>;

  beforeEach(() => {
    mockLlmConfigService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setDefault: jest.fn(),
      remove: jest.fn(),
    };
    mockLlmService = {
      testConnection: jest.fn(),
      listModels: jest.fn(),
      clearClientCache: jest.fn(),
    };
    mockLlmPreviewService = {
      previewModels: jest.fn(),
    };
    controller = new LlmConfigController(
      mockLlmConfigService as unknown as LlmConfigService,
      mockLlmService as unknown as LlmService,
      mockLlmPreviewService as unknown as LlmPreviewService,
    );
  });

  describe('previewModels', () => {
    it('delegates to LlmPreviewService.previewModels with the DTO payload', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmPreviewService.previewModels.mockResolvedValue(models);

      const dto = { provider: 'openai' as const, apiKey: 'sk-xxx' };
      const result = await controller.previewModels(dto);

      expect(mockLlmPreviewService.previewModels).toHaveBeenCalledWith(dto);
      expect(result).toBe(models);
      // preview 는 캐시에 클라이언트를 넣지 않으므로 cache clear 도 호출되지 않아야 한다.
      expect(mockLlmService.clearClientCache).not.toHaveBeenCalled();
    });

    it('forwards baseUrl for azure/local providers', async () => {
      mockLlmPreviewService.previewModels.mockResolvedValue([]);

      const dto = {
        provider: 'local' as const,
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
      };
      await controller.previewModels(dto);

      expect(mockLlmPreviewService.previewModels).toHaveBeenCalledWith(dto);
    });

    it('propagates service-layer errors (e.g. BadRequest on sanitized auth failure)', async () => {
      const err = new Error('sanitized');
      mockLlmPreviewService.previewModels.mockRejectedValue(err);

      await expect(
        controller.previewModels({ provider: 'openai', apiKey: 'bad' }),
      ).rejects.toThrow(err);
    });
  });
});
