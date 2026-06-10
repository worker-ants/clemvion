import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ModelConfig, ModelConfigKind } from './entities/model-config.entity';
import { CreateModelConfigDto } from './dto/create-model-config.dto';
import { UpdateModelConfigDto } from './dto/update-model-config.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import { isPrivateHost, resolvesToPrivate } from '../../common/utils/ssrf.util';

/**
 * SSRF 가드 면제 provider — 자가호스팅 endpoint 가 사설망/loopback 을 가리키는 게
 * 정상인 provider. 동시에 apiKey 가 선택(필수 아님)인 provider 집합이기도 하다.
 * spec/5-system/7-llm-client.md §5.5 (tei/local 사설망 예외).
 */
const SELF_HOSTED_PROVIDERS = new Set(['tei', 'local']);

@Injectable()
export class ModelConfigService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(ModelConfig)
    private readonly repo: Repository<ModelConfig>,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey =
      this.configService.get<string>('llm.encryptionKey') || '';
  }

  async findAll(
    workspaceId: string,
    kind: ModelConfigKind,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<Record<string, unknown>>> {
    const { page = 1, limit = 20, search } = query;
    const qb = this.repo
      .createQueryBuilder('mc')
      .where('mc.workspace_id = :workspaceId', { workspaceId })
      .andWhere('mc.kind = :kind', { kind });

    if (search) {
      qb.andWhere('mc.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('mc.is_default', 'DESC').addOrderBy('mc.created_at', 'DESC');

    const [data, totalItems] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const masked = data.map((item) => this.maskApiKey(item));
    return PaginatedResponseDto.create(masked, totalItems, page, limit);
  }

  async findById(
    id: string,
    workspaceId: string,
    expectedKind?: ModelConfigKind,
  ): Promise<Record<string, unknown>> {
    const config = await this.findEntity(id, workspaceId, expectedKind);
    return this.maskApiKey(config);
  }

  async findEntity(
    id: string,
    workspaceId: string,
    expectedKind?: ModelConfigKind,
  ): Promise<ModelConfig> {
    const config = await this.repo.findOne({ where: { id, workspaceId } });
    if (!config) {
      throw this.notFound();
    }
    if (expectedKind && config.kind !== expectedKind) {
      // Cross-kind access via deprecated alias endpoints is a security violation —
      // treat as not-found so as not to leak existence of other-kind configs.
      throw this.notFound();
    }
    return config;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'MODEL_CONFIG_NOT_FOUND',
      message: 'Model config not found',
    });
  }

  async findDefault(
    workspaceId: string,
    kind: ModelConfigKind,
  ): Promise<ModelConfig | null> {
    return this.repo.findOne({ where: { workspaceId, kind, isDefault: true } });
  }

  /**
   * 호출 시점에 사용할 ModelConfig 를 해석한다. id 가 있으면 해당 설정(없으면 throw),
   * 없으면 workspace×kind default. 둘 다 없으면 `MODEL_CONFIG_NOT_FOUND` BadRequest.
   */
  async resolveConfig(
    id: string | undefined,
    workspaceId: string,
    kind: ModelConfigKind,
  ): Promise<ModelConfig> {
    if (id) {
      return this.findEntity(id, workspaceId, kind);
    }
    const def = await this.findDefault(workspaceId, kind);
    if (!def) {
      throw new BadRequestException({
        code: 'MODEL_CONFIG_NOT_FOUND',
        message: `No ${kind} model config resolved for workspace`,
      });
    }
    return def;
  }

  /**
   * KB 임베딩에 사용할 `(config, model)` 을 점진적·하위호환 폴백 체인으로 해석한다 (PR2,
   * spec/5-system/8-embedding-pipeline.md). 임베딩 1급화는 KB 무중단을 위해 단계적으로 전환한다:
   *   (1) `embeddingModelConfigId` 지정 → 1급 kind=embedding config + `config.defaultModel`
   *   (2) 미지정 → 워크스페이스 default kind=embedding config + 그 `defaultModel`
   *   (3) 둘 다 없음(legacy) → 구 `embeddingLlmConfigId`(없으면 ws default chat) + `legacyModel` 문자열
   */
  async resolveEmbedding(opts: {
    embeddingModelConfigId?: string | null;
    embeddingLlmConfigId?: string | null;
    legacyModel: string;
    workspaceId: string;
  }): Promise<{ config: ModelConfig; model: string }> {
    const {
      embeddingModelConfigId,
      embeddingLlmConfigId,
      legacyModel,
      workspaceId,
    } = opts;

    // (1) 명시 지정된 1급 embedding config
    if (embeddingModelConfigId) {
      const config = await this.findEntity(
        embeddingModelConfigId,
        workspaceId,
        'embedding',
      );
      return { config, model: config.defaultModel };
    }

    // (2) 워크스페이스 default kind=embedding
    const embDefault = await this.findDefault(workspaceId, 'embedding');
    if (embDefault) {
      return { config: embDefault, model: embDefault.defaultModel };
    }

    // (3) legacy 폴백 — 구 embedding_llm_config_id(없으면 ws default chat) + embedding_model 문자열.
    // legacy config 는 구 piggyback 이라 kind 무관(보통 chat)으로 조회한다.
    const legacy = embeddingLlmConfigId
      ? await this.findEntity(embeddingLlmConfigId, workspaceId)
      : await this.findDefault(workspaceId, 'chat');
    if (!legacy) {
      throw new BadRequestException({
        code: 'MODEL_CONFIG_NOT_FOUND',
        message:
          'No embedding model config resolved for workspace (no embedding/chat config)',
      });
    }
    return { config: legacy, model: legacyModel };
  }

  async create(
    workspaceId: string,
    kind: ModelConfigKind,
    dto: CreateModelConfigDto,
  ): Promise<Record<string, unknown>> {
    await this.assertBaseUrlNotSsrf(dto.provider, dto.baseUrl);

    const encryptedKey = this.encryptOptionalKey(dto.provider, dto.apiKey);

    const entityFields = {
      workspaceId,
      kind,
      provider: dto.provider,
      name: dto.name,
      apiKey: encryptedKey,
      baseUrl: dto.baseUrl || null,
      defaultModel: dto.defaultModel,
      defaultParams: kind === 'chat' ? dto.defaultParams || {} : {},
      dimension: kind === 'embedding' ? (dto.dimension ?? null) : null,
      isDefault: dto.isDefault || false,
    };

    const saved = dto.isDefault
      ? await this.saveWithDefaultSwap(workspaceId, kind, (manager) =>
          manager.save(ModelConfig, manager.create(ModelConfig, entityFields)),
        )
      : await this.repo.save(this.repo.create(entityFields));
    return this.maskApiKey(saved);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateModelConfigDto,
    expectedKind?: ModelConfigKind,
  ): Promise<Record<string, unknown>> {
    const config = await this.findEntity(id, workspaceId, expectedKind);

    const effectiveProvider = dto.provider ?? config.provider;
    const effectiveBaseUrl =
      dto.baseUrl !== undefined ? dto.baseUrl || null : config.baseUrl;
    await this.assertBaseUrlNotSsrf(effectiveProvider, effectiveBaseUrl);

    if (dto.apiKey) {
      config.apiKey = this.encryptOptionalKey(effectiveProvider, dto.apiKey);
    }
    if (dto.provider !== undefined) config.provider = dto.provider;
    if (dto.name !== undefined) config.name = dto.name;
    if (dto.baseUrl !== undefined) config.baseUrl = dto.baseUrl || null;
    if (dto.defaultModel !== undefined) config.defaultModel = dto.defaultModel;
    if (dto.defaultParams !== undefined && config.kind === 'chat')
      config.defaultParams = dto.defaultParams;
    if (dto.dimension !== undefined && config.kind === 'embedding')
      config.dimension = dto.dimension ?? null;

    if (dto.isDefault === false) {
      config.isDefault = false;
    }

    let saved: ModelConfig;
    if (dto.isDefault === true) {
      config.isDefault = true;
      saved = await this.saveWithDefaultSwap(
        workspaceId,
        config.kind,
        (manager) => manager.save(ModelConfig, config),
      );
    } else {
      saved = await this.repo.save(config);
    }
    return this.maskApiKey(saved);
  }

  /**
   * `isDefault=true` 저장 시 동일 (workspace, kind) 의 기존 default 해제와 새 저장을
   * 하나의 트랜잭션으로 묶어 동시 요청에 의한 중복 default 를 차단한다.
   */
  private async saveWithDefaultSwap(
    workspaceId: string,
    kind: ModelConfigKind,
    write: (manager: EntityManager) => Promise<ModelConfig>,
  ): Promise<ModelConfig> {
    return this.repo.manager.transaction(async (manager) => {
      await manager.update(
        ModelConfig,
        { workspaceId, kind, isDefault: true },
        { isDefault: false },
      );
      return write(manager);
    });
  }

  async setDefault(
    id: string,
    workspaceId: string,
    expectedKind?: ModelConfigKind,
  ): Promise<void> {
    const config = await this.findEntity(id, workspaceId, expectedKind);
    await this.repo.manager.transaction(async (manager) => {
      await manager.update(
        ModelConfig,
        { workspaceId, kind: config.kind, isDefault: true },
        { isDefault: false },
      );
      await manager.update(
        ModelConfig,
        { id, workspaceId },
        { isDefault: true },
      );
    });
  }

  async remove(
    id: string,
    workspaceId: string,
    expectedKind?: ModelConfigKind,
  ): Promise<void> {
    const config = await this.findEntity(id, workspaceId, expectedKind);
    await this.repo.remove(config);
  }

  /** 저장된 (암호화된) apiKey 를 평문으로 복호화. 키가 없으면(local/tei) null. */
  getDecryptedApiKey(config: ModelConfig): string | null {
    if (!config.apiKey) return null;
    return decrypt(config.apiKey, this.encryptionKey);
  }

  private encryptOptionalKey(
    provider: string,
    apiKey: string | undefined,
  ): string | null {
    if (!apiKey) {
      if (!SELF_HOSTED_PROVIDERS.has(provider)) {
        throw new BadRequestException({
          code: 'MODEL_CONFIG_INVALID',
          message: `API key is required for provider '${provider}'`,
        });
      }
      return null;
    }
    if (!this.encryptionKey) {
      throw new BadRequestException({
        code: 'ENCRYPTION_KEY_MISSING',
        message: 'ENCRYPTION_KEY environment variable is not configured',
      });
    }
    return encrypt(apiKey, this.encryptionKey);
  }

  /**
   * 사용자 지정 baseUrl 의 SSRF(사설망/loopback) 시도를 차단한다. tei/local 만 예외.
   * spec/5-system/7-llm-client.md §5.5.
   */
  private async assertBaseUrlNotSsrf(
    provider: string,
    baseUrl: string | undefined | null,
  ): Promise<void> {
    if (!baseUrl) return;
    if (SELF_HOSTED_PROVIDERS.has(provider)) return;
    if (isPrivateHost(baseUrl)) {
      throw new BadRequestException({
        code: 'MODEL_CONFIG_INVALID',
        message:
          'Private/loopback addresses are only allowed for the tei/local provider.',
      });
    }
    if (await resolvesToPrivate(baseUrl)) {
      throw new BadRequestException({
        code: 'MODEL_CONFIG_INVALID',
        message:
          'Hostname resolves to a private/loopback address; only the tei/local provider may target such hosts.',
      });
    }
  }

  private maskApiKey(config: ModelConfig): Record<string, unknown> {
    const MASKED_SUFFIX_LEN = 4;
    const { apiKey, ...rest } = config;
    if (!apiKey) {
      return { ...rest, apiKey: null };
    }
    let masked = '****';
    try {
      const decrypted = decrypt(apiKey, this.encryptionKey);
      if (decrypted.length > MASKED_SUFFIX_LEN) {
        masked = `****${decrypted.substring(decrypted.length - MASKED_SUFFIX_LEN)}`;
      }
    } catch {
      // If decryption fails, just show masked
    }
    return { ...rest, apiKey: masked };
  }
}
