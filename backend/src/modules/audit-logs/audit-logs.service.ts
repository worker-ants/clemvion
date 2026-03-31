import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(
    workspaceId: string,
    query: QueryAuditLogDto,
  ): Promise<PaginatedResponseDto<AuditLog>> {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      action,
      resourceType,
      startDate,
      endDate,
    } = query;

    const qb = this.auditLogRepository
      .createQueryBuilder('al')
      .leftJoinAndSelect('al.user', 'user')
      .where('al.workspace_id = :workspaceId', { workspaceId });

    if (action) {
      qb.andWhere('al.action = :action', { action });
    }
    if (resourceType) {
      qb.andWhere('al.resource_type = :resourceType', { resourceType });
    }
    if (startDate) {
      qb.andWhere('al.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('al.created_at <= :endDate', { endDate });
    }

    const sortColumn = this.getSortColumn(sort);
    qb.orderBy(`al.${sortColumn}`, order.toUpperCase() as 'ASC' | 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 'created_at',
      action: 'action',
      resource_type: 'resource_type',
    };
    return allowed[sort] || 'created_at';
  }
}
