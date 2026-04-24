import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LlmConfig } from './entities/llm-config.entity';
import { CreateLlmConfigDto } from './dto/create-llm-config.dto';
import { UpdateLlmConfigDto } from './dto/update-llm-config.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class LlmConfigService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(LlmConfig)
    private readonly llmConfigRepository: Repository<LlmConfig>,
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
    const qb = this.llmConfigRepository
      .createQueryBuilder('lc')
      .where('lc.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('lc.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('lc.is_default', 'DESC').addOrderBy('lc.created_at', 'DESC');

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

  async findEntity(id: string, workspaceId: string): Promise<LlmConfig> {
    const config = await this.llmConfigRepository.findOne({
      where: { id, workspaceId },
    });
    if (!config) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'LLM config not found',
      });
    }
    return config;
  }

  async findDefault(workspaceId: string): Promise<LlmConfig | null> {
    return this.llmConfigRepository.findOne({
      where: { workspaceId, isDefault: true },
    });
  }

  async create(
    workspaceId: string,
    dto: CreateLlmConfigDto,
  ): Promise<Record<string, unknown>> {
    if (!this.encryptionKey) {
      throw new BadRequestException({
        code: 'ENCRYPTION_KEY_MISSING',
        message: 'ENCRYPTION_KEY environment variable is not configured',
      });
    }

    const encryptedKey = encrypt(dto.apiKey, this.encryptionKey);
    const entityFields = {
      workspaceId,
      provider: dto.provider,
      name: dto.name,
      apiKey: encryptedKey,
      baseUrl: dto.baseUrl || undefined,
      defaultModel: dto.defaultModel,
      defaultParams: dto.defaultParams || {},
      isDefault: dto.isDefault || false,
    };

    // isDefault=true 인 경우, clearDefault + insert 사이에 다른 요청이 끼어들어
    // `isDefault=true` 레코드가 2건 생성되는 걸 막기 위해 트랜잭션으로 감싼다.
    // setDefault() 와 동일 패턴.
    let saved: LlmConfig;
    if (dto.isDefault) {
      saved = await this.llmConfigRepository.manager.transaction(
        async (manager) => {
          await manager.update(
            LlmConfig,
            { workspaceId, isDefault: true },
            { isDefault: false },
          );
          const entity = manager.create(LlmConfig, entityFields);
          return manager.save(LlmConfig, entity);
        },
      );
    } else {
      const config = this.llmConfigRepository.create(entityFields);
      saved = await this.llmConfigRepository.save(config);
    }
    return this.maskApiKey(saved);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateLlmConfigDto,
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
    if (dto.baseUrl !== undefined) config.baseUrl = dto.baseUrl || '';
    if (dto.defaultModel !== undefined) config.defaultModel = dto.defaultModel;
    if (dto.defaultParams !== undefined)
      config.defaultParams = dto.defaultParams;

    if (dto.isDefault === false) {
      config.isDefault = false;
    }

    // isDefault=true 전환은 `create()` 와 동일한 이유로 트랜잭션 내에서 기존
    // default 해제 + 본인 업데이트를 한 번에 수행한다.
    let saved: LlmConfig;
    if (dto.isDefault === true) {
      config.isDefault = true;
      saved = await this.llmConfigRepository.manager.transaction(
        async (manager) => {
          await manager.update(
            LlmConfig,
            { workspaceId, isDefault: true },
            { isDefault: false },
          );
          return manager.save(LlmConfig, config);
        },
      );
    } else {
      saved = await this.llmConfigRepository.save(config);
    }
    return this.maskApiKey(saved);
  }

  async setDefault(id: string, workspaceId: string): Promise<void> {
    await this.findEntity(id, workspaceId);
    await this.llmConfigRepository.manager.transaction(async (manager) => {
      await manager.update(
        LlmConfig,
        { workspaceId, isDefault: true },
        { isDefault: false },
      );
      await manager.update(LlmConfig, { id, workspaceId }, { isDefault: true });
    });
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const config = await this.findEntity(id, workspaceId);
    await this.llmConfigRepository.remove(config);
  }

  getDecryptedApiKey(config: LlmConfig): string {
    return decrypt(config.apiKey, this.encryptionKey);
  }

  private async clearDefault(workspaceId: string): Promise<void> {
    await this.llmConfigRepository.update(
      { workspaceId, isDefault: true },
      { isDefault: false },
    );
  }

  private maskApiKey(config: LlmConfig): Record<string, unknown> {
    const { apiKey, ...rest } = config;
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
