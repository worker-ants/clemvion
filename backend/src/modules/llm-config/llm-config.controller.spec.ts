// Covers only previewModels — full CRUD handler coverage lives in
// llm-config.service.spec.ts for business logic and in e2e tests for routing.
import { LlmConfigController } from './llm-config.controller';
import type { LlmConfigService } from './llm-config.service';
import type { LlmService } from '../llm/llm.service';

type ServiceMethods = Pick<
  LlmService,
  'testConnection' | 'listModels' | 'previewModels' | 'clearClientCache'
>;
type ConfigMethods = Pick<
  LlmConfigService,
  'findAll' | 'findById' | 'create' | 'update' | 'setDefault' | 'remove'
>;

describe('LlmConfigController', () => {
  let controller: LlmConfigController;
  let mockLlmConfigService: jest.Mocked<ConfigMethods>;
  let mockLlmService: jest.Mocked<ServiceMethods>;

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
      previewModels: jest.fn(),
      clearClientCache: jest.fn(),
    };
    controller = new LlmConfigController(
      mockLlmConfigService as unknown as LlmConfigService,
      mockLlmService as unknown as LlmService,
    );
  });

  describe('previewModels', () => {
    it('delegates to LlmService.previewModels with the DTO payload', async () => {
      const models = [{ id: 'gpt-4o', name: 'gpt-4o', type: 'chat' as const }];
      mockLlmService.previewModels.mockResolvedValue(models);

      const dto = { provider: 'openai' as const, apiKey: 'sk-xxx' };
      const result = await controller.previewModels(dto);

      expect(mockLlmService.previewModels).toHaveBeenCalledWith(dto);
      expect(result).toBe(models);
      // preview 는 캐시에 클라이언트를 넣지 않으므로 cache clear 도 호출되지 않아야 한다.
      expect(mockLlmService.clearClientCache).not.toHaveBeenCalled();
    });

    it('forwards baseUrl for azure/local providers', async () => {
      mockLlmService.previewModels.mockResolvedValue([]);

      const dto = {
        provider: 'local' as const,
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
      };
      await controller.previewModels(dto);

      expect(mockLlmService.previewModels).toHaveBeenCalledWith(dto);
    });

    it('propagates service-layer errors (e.g. BadRequest on sanitized auth failure)', async () => {
      const err = new Error('sanitized');
      mockLlmService.previewModels.mockRejectedValue(err);

      await expect(
        controller.previewModels({ provider: 'openai', apiKey: 'bad' }),
      ).rejects.toThrow(err);
    });
  });
});
