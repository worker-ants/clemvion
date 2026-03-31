import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthConfig } from './entities/auth-config.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthConfigsService {
  constructor(
    @InjectRepository(AuthConfig)
    private readonly authConfigRepository: Repository<AuthConfig>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
  ) {}

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<AuthConfig>> {
    const { page = 1, limit = 20, search } = query;
    const qb = this.authConfigRepository
      .createQueryBuilder('ac')
      .where('ac.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('ac.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('ac.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<AuthConfig> {
    const config = await this.authConfigRepository.findOne({
      where: { id, workspaceId },
    });
    if (!config) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Auth config not found',
      });
    }
    return config;
  }

  async create(
    workspaceId: string,
    data: Partial<AuthConfig>,
  ): Promise<AuthConfig> {
    // Auto-generate key/token if not provided
    const config: Record<string, unknown> =
      (data.config as Record<string, unknown>) || {};
    if (data.type === 'api_key' && !config.key) {
      config.key = `wfk_${randomBytes(24).toString('hex')}`;
    }
    if (data.type === 'bearer_token' && !config.token) {
      config.token = `wft_${randomBytes(32).toString('hex')}`;
    }

    const authConfig = this.authConfigRepository.create({
      ...data,
      config,
      workspaceId,
    });
    return this.authConfigRepository.save(authConfig);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<AuthConfig>,
  ): Promise<AuthConfig> {
    const config = await this.findById(id, workspaceId);
    Object.assign(config, data);
    return this.authConfigRepository.save(config);
  }

  async regenerate(id: string, workspaceId: string): Promise<AuthConfig> {
    const config = await this.findById(id, workspaceId);
    const configData = config.config || {};

    if (config.type === 'api_key') {
      configData.key = `wfk_${randomBytes(24).toString('hex')}`;
    } else if (config.type === 'bearer_token') {
      configData.token = `wft_${randomBytes(32).toString('hex')}`;
    }
    config.config = configData;
    return this.authConfigRepository.save(config);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const config = await this.findById(id, workspaceId);
    await this.authConfigRepository.remove(config);
  }

  async getUsage(
    id: string,
    workspaceId: string,
  ): Promise<{
    totalCalls: number;
    lastUsedAt: Date | null;
    recentCalls: Array<{
      id: string;
      triggerName: string;
      status: string;
      startedAt: Date;
    }>;
  }> {
    const config = await this.findById(id, workspaceId);

    // Find triggers using this auth config
    const triggers = await this.triggerRepository.find({
      where: { authConfigId: id },
    });
    const triggerIds = triggers.map((t) => t.id);

    if (triggerIds.length === 0) {
      return {
        totalCalls: 0,
        lastUsedAt: config.lastUsedAt,
        recentCalls: [],
      };
    }

    const totalCalls = await this.executionRepository
      .createQueryBuilder('e')
      .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
      .getCount();

    const recentExecutions = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.trigger', 't')
      .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
      .orderBy('e.started_at', 'DESC')
      .limit(20)
      .getMany();

    return {
      totalCalls,
      lastUsedAt: config.lastUsedAt,
      recentCalls: recentExecutions.map((e) => ({
        id: e.id,
        triggerName: e.trigger?.name ?? 'Unknown',
        status: e.status,
        startedAt: e.startedAt,
      })),
    };
  }
}
