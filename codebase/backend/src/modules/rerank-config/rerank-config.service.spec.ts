import { Test, TestingModule } from '@nestjs/testing';
import { RerankConfigService } from './rerank-config.service';
import { ModelConfigService } from '../model-config/model-config.service';

// RerankConfigService 는 DEPRECATED thin alias — 모든 호출을 kind='rerank' 로
// ModelConfigService 에 위임한다. CRUD·SSRF 로직은 model-config.service.spec 에서 검증.
describe('RerankConfigService (rerank alias)', () => {
  let service: RerankConfigService;
  let mc: jest.Mocked<
    Pick<
      ModelConfigService,
      | 'findAll'
      | 'findById'
      | 'findEntity'
      | 'findDefault'
      | 'resolveConfig'
      | 'create'
      | 'update'
      | 'setDefault'
      | 'remove'
      | 'getDecryptedApiKey'
    >
  >;

  beforeEach(async () => {
    mc = {
      findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
      findById: jest.fn().mockResolvedValue({}),
      findEntity: jest.fn().mockResolvedValue({}),
      findDefault: jest.fn().mockResolvedValue(null),
      resolveConfig: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      setDefault: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      getDecryptedApiKey: jest.fn().mockReturnValue(null),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RerankConfigService,
        { provide: ModelConfigService, useValue: mc },
      ],
    }).compile();
    service = module.get(RerankConfigService);
  });

  it("findAll delegates with kind='rerank'", async () => {
    await service.findAll('ws-1', { page: 1, limit: 20 });
    expect(mc.findAll).toHaveBeenCalledWith('ws-1', 'rerank', {
      page: 1,
      limit: 20,
    });
  });

  it("resolveConfig delegates with kind='rerank'", async () => {
    await service.resolveConfig('r1', 'ws-1');
    expect(mc.resolveConfig).toHaveBeenCalledWith('r1', 'ws-1', 'rerank');
  });

  it("create injects kind='rerank'", async () => {
    const dto = {
      provider: 'cohere' as const,
      name: 'Cohere',
      apiKey: 'co-x',
      defaultModel: 'rerank-3.5',
    };
    await service.create('ws-1', dto);
    expect(mc.create).toHaveBeenCalledWith(
      'ws-1',
      'rerank',
      expect.objectContaining({ kind: 'rerank', provider: 'cohere' }),
    );
  });

  it('getDecryptedApiKey passes through null (self-hosted)', () => {
    expect(service.getDecryptedApiKey({ apiKey: null } as any)).toBeNull();
  });
});
