import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async findAll(
    workspaceId: string,
    userId: string,
    query: QueryNotificationDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      type,
      isRead,
    } = query;

    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.workspace_id = :workspaceId', { workspaceId })
      .andWhere('n.user_id = :userId', { userId });

    if (type) {
      qb.andWhere('n.type = :type', { type });
    }
    if (isRead !== undefined) {
      qb.andWhere('n.is_read = :isRead', { isRead });
    }

    const sortColumn = this.getSortColumn(sort);
    qb.orderBy(`n.${sortColumn}`, order.toUpperCase() as 'ASC' | 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  async getUnreadCount(
    workspaceId: string,
    userId: string,
  ): Promise<{ count: number }> {
    const count = await this.notificationRepository.count({
      where: { workspaceId, userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllRead(
    workspaceId: string,
    userId: string,
  ): Promise<{ affected: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('workspace_id = :workspaceId', { workspaceId })
      .andWhere('user_id = :userId', { userId })
      .andWhere('is_read = false')
      .execute();

    return { affected: result.affected || 0 };
  }

  /**
   * Persist a batch of notifications in a single INSERT. Safe against empty
   * arrays (no-op). Used by background workers that fan out to many users.
   */
  async createMany(
    entries: Array<{
      workspaceId: string;
      userId: string;
      type: string;
      title: string;
      message: string;
      resourceType?: string;
      resourceId?: string;
      channel?: 'in_app' | 'email' | 'both';
    }>,
  ): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((e) => {
      const row = this.notificationRepository.create({
        workspaceId: e.workspaceId,
        userId: e.userId,
        type: e.type,
        title: e.title,
        message: e.message,
        channel: e.channel ?? 'in_app',
        isRead: false,
      });
      if (e.resourceType) row.resourceType = e.resourceType;
      if (e.resourceId) row.resourceId = e.resourceId;
      return row;
    });
    await this.notificationRepository.save(rows);
  }

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 'created_at',
      type: 'type',
    };
    return allowed[sort] || 'created_at';
  }
}
