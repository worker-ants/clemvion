import { Test, TestingModule } from '@nestjs/testing';
import { LlmConfigService } from './llm-config.service';
import { ModelConfigService } from '../model-config/model-config.service';
import { ModelConfig } from '../model-config/entities/model-config.entity';

// LlmConfigService 는 DEPRECATED thin alias — 모든 호출을 kind='chat' 로
// ModelConfigService 에 위임한다. (실제 CRUD 로직은 model-config.service.spec 에서 검증)
describe('LlmConfigService (chat alias)', () => {
  let service: LlmConfigService;
  let mc: jest.Mocked<
    Pick<
      ModelConfigService,
      | 'findAll'
      | 'findById'
      | 'findEntity'
      | 'findDefault'
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
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      setDefault: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      getDecryptedApiKey: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmConfigService,
        { provide: ModelConfigService, useValue: mc },
      ],
    }).compile();
    service = module.get(LlmConfigService);
  });

  it("findAll delegates with kind='chat'", async () => {
    await service.findAll('ws-1', { page: 1, limit: 20 });
    expect(mc.findAll).toHaveBeenCalledWith('ws-1', 'chat', {
      page: 1,
      limit: 20,
    });
  });

  it("findDefault delegates with kind='chat'", async () => {
    await service.findDefault('ws-1');
    expect(mc.findDefault).toHaveBeenCalledWith('ws-1', 'chat');
  });

  it("create injects kind='chat'", async () => {
    const dto = {
      provider: 'openai' as const,
      name: 'x',
      apiKey: 'sk-x',
      defaultModel: 'gpt-4o',
    };
    await service.create('ws-1', dto);
    expect(mc.create).toHaveBeenCalledWith(
      'ws-1',
      'chat',
      expect.objectContaining({ kind: 'chat', provider: 'openai' }),
    );
  });

  it('getDecryptedApiKey coerces null to empty string for chat', () => {
    mc.getDecryptedApiKey.mockReturnValue(null);
    expect(service.getDecryptedApiKey({} as ModelConfig)).toBe('');
  });

  it('getDecryptedApiKey returns plain key string when non-null', () => {
    mc.getDecryptedApiKey.mockReturnValue('sk-plain-key');
    expect(service.getDecryptedApiKey({} as ModelConfig)).toBe('sk-plain-key');
  });

  it("update delegates with expectedKind='chat'", async () => {
    const dto = { name: 'Renamed' };
    await service.update('cfg-1', 'ws-1', dto);
    expect(mc.update).toHaveBeenCalledWith('cfg-1', 'ws-1', dto, 'chat');
  });

  it("setDefault delegates with expectedKind='chat'", async () => {
    await service.setDefault('cfg-1', 'ws-1');
    expect(mc.setDefault).toHaveBeenCalledWith('cfg-1', 'ws-1', 'chat');
  });

  it("remove delegates with expectedKind='chat'", async () => {
    await service.remove('cfg-1', 'ws-1');
    expect(mc.remove).toHaveBeenCalledWith('cfg-1', 'ws-1', 'chat');
  });

  it("findById delegates with expectedKind='chat'", async () => {
    await service.findById('cfg-1', 'ws-1');
    expect(mc.findById).toHaveBeenCalledWith('cfg-1', 'ws-1', 'chat');
  });

  it("findEntity delegates with expectedKind='chat'", async () => {
    await service.findEntity('cfg-1', 'ws-1');
    expect(mc.findEntity).toHaveBeenCalledWith('cfg-1', 'ws-1', 'chat');
  });
});
