import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
  ) {}

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto & { serviceType?: string; status?: string },
  ): Promise<PaginatedResponseDto<Integration>> {
    const { page = 1, limit = 20, search, serviceType, status } = query;

    const qb = this.integrationRepository
      .createQueryBuilder('i')
      .where('i.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('i.name ILIKE :search', { search: `%${search}%` });
    }
    if (serviceType) {
      qb.andWhere('i.service_type = :serviceType', { serviceType });
    }
    if (status) {
      qb.andWhere('i.status = :status', { status });
    }

    qb.orderBy('i.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async findById(id: string, workspaceId: string): Promise<Integration> {
    const integration = await this.integrationRepository.findOne({
      where: { id, workspaceId },
    });
    if (!integration) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
    }
    return integration;
  }

  async create(
    workspaceId: string,
    userId: string,
    data: Partial<Integration>,
  ): Promise<Integration> {
    const integration = this.integrationRepository.create({
      ...data,
      workspaceId,
      createdBy: userId,
    });
    return this.integrationRepository.save(integration);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<Integration>,
  ): Promise<Integration> {
    const integration = await this.findById(id, workspaceId);
    Object.assign(integration, data);
    return this.integrationRepository.save(integration);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const integration = await this.findById(id, workspaceId);
    await this.integrationRepository.remove(integration);
  }

  async testConnection(
    id: string,
    workspaceId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.findById(id, workspaceId);
    // TODO: Implement actual connection testing per service type
    return { success: true, message: 'Connection successful' };
  }

  getAvailableServices(): Array<{
    type: string;
    name: string;
    authTypes: string[];
  }> {
    return [
      { type: 'slack', name: 'Slack', authTypes: ['oauth2'] },
      { type: 'google', name: 'Google', authTypes: ['oauth2'] },
      { type: 'github', name: 'GitHub', authTypes: ['oauth2'] },
      {
        type: 'http',
        name: 'HTTP/REST',
        authTypes: ['api_key', 'bearer_token'],
      },
      { type: 'database', name: 'Database', authTypes: ['api_key'] },
      { type: 'email', name: 'Email (SMTP)', authTypes: ['api_key'] },
    ];
  }
}
