import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RerankConfig } from './entities/rerank-config.entity';
import { CreateRerankConfigDto } from './dto/create-rerank-config.dto';
import { UpdateRerankConfigDto } from './dto/update-rerank-config.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class RerankConfigService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(RerankConfig)
    private readonly rerankConfigRepository: Repository<RerankConfig>,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey =
      this.configService.get<string>('llm.encryptionKey') || '';
  }

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<Record<string, unknown>>> {
    const { page = 1, limit = 20, search } = query;
    const qb = this.rerankConfigRepository
      .createQueryBuilder('rc')
      .where('rc.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('rc.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('rc.is_default', 'DESC').addOrderBy('rc.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const masked = data.map((item) => this.maskApiKey(item));
    return PaginatedResponseDto.create(masked, totalItems, page, limit);
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Record<string, unknown>> {
    const config = await this.findEntity(id, workspaceId);
    return this.maskApiKey(config);
  }

  async findEntity(id: string, workspaceId: string): Promise<RerankConfig> {
    const config = await this.rerankConfigRepository.findOne({
      where: { id, workspaceId },
    });
    if (!config) {
      throw new NotFoundException({
        code: 'RERANK_CONFIG_NOT_FOUND',
        message: 'Rerank config not found',
      });
    }
    return config;
  }

  async findDefault(workspaceId: string): Promise<RerankConfig | null> {
    return this.rerankConfigRepository.findOne({
      where: { workspaceId, isDefault: true },
    });
  }

  /**
   * RAG 리랭킹 후처리에서 사용할 RerankConfig 엔티티를 해석한다.
   * - `rerankConfigId` 가 있으면 해당 설정(없으면 NotFound 의 의미로 throw).
   * - 없으면 워크스페이스 default.
   * - 둘 다 없으면 `RERANK_CONFIG_NOT_FOUND` BadRequest.
   */
  async resolveConfig(
    rerankConfigId: string | undefined,
    workspaceId: string,
  ): Promise<RerankConfig> {
    if (rerankConfigId) {
      return this.findEntity(rerankConfigId, workspaceId);
    }
    const def = await this.findDefault(workspaceId);
    if (!def) {
      throw new BadRequestException({
        code: 'RERANK_CONFIG_NOT_FOUND',
        message: 'No rerank config resolved for workspace',
      });
    }
    return def;
  }

  async create(
    workspaceId: string,
    dto: CreateRerankConfigDto,
  ): Promise<Record<string, unknown>> {
    let encryptedKey: string | null = null;
    if (dto.apiKey) {
      if (!this.encryptionKey) {
        throw new BadRequestException({
          code: 'ENCRYPTION_KEY_MISSING',
          message: 'ENCRYPTION_KEY environment variable is not configured',
        });
      }
      encryptedKey = encrypt(dto.apiKey, this.encryptionKey);
    }

    const entityFields = {
      workspaceId,
      provider: dto.provider,
      name: dto.name,
      apiKey: encryptedKey,
      baseUrl: dto.baseUrl || null,
      defaultModel: dto.defaultModel,
      isDefault: dto.isDefault || false,
    };

    const saved = dto.isDefault
      ? await this.saveWithDefaultSwap(workspaceId, (manager) =>
          manager.save(
            RerankConfig,
            manager.create(RerankConfig, entityFields),
          ),
        )
      : await this.rerankConfigRepository.save(
          this.rerankConfigRepository.create(entityFields),
        );
    return this.maskApiKey(saved);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateRerankConfigDto,
  ): Promise<Record<string, unknown>> {
    const config = await this.findEntity(id, workspaceId);

    if (dto.apiKey) {
      if (!this.encryptionKey) {
        throw new BadRequestException({
          code: 'ENCRYPTION_KEY_MISSING',
          message: 'ENCRYPTION_KEY environment variable is not configured',
        });
      }
      config.apiKey = encrypt(dto.apiKey, this.encryptionKey);
    }
    if (dto.provider !== undefined) config.provider = dto.provider;
    if (dto.name !== undefined) config.name = dto.name;
    if (dto.baseUrl !== undefined) config.baseUrl = dto.baseUrl || null;
    if (dto.defaultModel !== undefined) config.defaultModel = dto.defaultModel;

    if (dto.isDefault === false) {
      config.isDefault = false;
    }

    let saved: RerankConfig;
    if (dto.isDefault === true) {
      config.isDefault = true;
      saved = await this.saveWithDefaultSwap(workspaceId, (manager) =>
        manager.save(RerankConfig, config),
      );
    } else {
      saved = await this.rerankConfigRepository.save(config);
    }
    return this.maskApiKey(saved);
  }

  /**
   * `isDefault=true` 저장 시 기존 default 해제와 새 저장을 하나의 트랜잭션으로
   * 묶어 동시 요청에 의한 중복 default 를 차단한다. `create()`·`update()` 가 공유.
   */
  private async saveWithDefaultSwap(
    workspaceId: string,
    write: (manager: EntityManager) => Promise<RerankConfig>,
  ): Promise<RerankConfig> {
    return this.rerankConfigRepository.manager.transaction(async (manager) => {
      await manager.update(
        RerankConfig,
        { workspaceId, isDefault: true },
        { isDefault: false },
      );
      return write(manager);
    });
  }

  async setDefault(id: string, workspaceId: string): Promise<void> {
    await this.findEntity(id, workspaceId);
    await this.rerankConfigRepository.manager.transaction(async (manager) => {
      await manager.update(
        RerankConfig,
        { workspaceId, isDefault: true },
        { isDefault: false },
      );
      await manager.update(
        RerankConfig,
        { id, workspaceId },
        { isDefault: true },
      );
    });
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const config = await this.findEntity(id, workspaceId);
    await this.rerankConfigRepository.remove(config);
  }

  /**
   * 저장된 (암호화된) apiKey 를 평문으로 복호화한다. tei/local 등 키가 없는
   * 설정은 `null` 반환.
   */
  getDecryptedApiKey(config: RerankConfig): string | null {
    if (!config.apiKey) return null;
    return decrypt(config.apiKey, this.encryptionKey);
  }

  private maskApiKey(config: RerankConfig): Record<string, unknown> {
    const { apiKey, ...rest } = config;
    // apiKey 가 없을 수 있다 (tei/local). 없으면 null 로 노출.
    if (!apiKey) {
      return { ...rest, apiKey: null };
    }
    let masked = '****';
    try {
      const decrypted = decrypt(apiKey, this.encryptionKey);
      if (decrypted.length > 4) {
        masked = `****${decrypted.substring(decrypted.length - 4)}`;
      }
    } catch {
      // If decryption fails, just show masked
    }
    return { ...rest, apiKey: masked };
  }
}
