import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * 특정 리소스에 attribute 된 알림 전체 조회 (createdAt ASC).
   *
   * 다른 모듈(예: Background 본문 모니터링 API)이 알림 정보를 자기 응답에
   * 포함시킬 때 Repository 를 직접 주입받지 않고 본 서비스에 위임할 수
   * 있도록 분리. 비즈니스 규약(예: 정렬 기준)을 단일 sink 에 모은다.
   */
  async findByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { resourceType, resourceId },
      order: { createdAt: 'ASC' },
    });
  }

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

    // dismissed (`dismissed_at IS NOT NULL`) 알림은 목록에서 제외 — spec §4.3.
    // hasRecentByResource (중복 방지) 는 본 필터를 적용하지 않는다 (spec §4.4).
    const qb = this.notificationRepository
      .createQueryBuilder('n')
      .where('n.workspace_id = :workspaceId', { workspaceId })
      .andWhere('n.user_id = :userId', { userId })
      .andWhere('n.dismissed_at IS NULL');

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
    // dismissed 알림은 미읽음 카운트에서 제외 — spec §4.3.
    const count = await this.notificationRepository.count({
      where: { workspaceId, userId, isRead: false, dismissedAt: IsNull() },
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
   * 단건 dismiss — 알림을 사용자 popover/list 에서 숨긴다 (soft delete).
   *
   * spec/data-flow/8-notifications.md §4.2.
   * - `dismissed_at IS NULL` 인 행에만 `dismissed_at=now()` 를 적용. 이미 dismissed
   *   인 행은 기존 시각 보존 (멱등성).
   * - 본인 소유 알림이 아니면 `NotFoundException`. 본인 소유 + 이미 dismissed 인
   *   경우는 멱등 성공 (기존 dismissed_at 반환).
   * - row 자체는 보존 (hasRecentByResource 중복 방지에 영향 없도록, spec §4.4).
   */
  async dismiss(
    id: string,
    userId: string,
  ): Promise<{ id: string; dismissedAt: Date }> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    if (notification.dismissedAt) {
      // 멱등 — 이미 dismissed. 기존 시각 그대로 반환.
      return { id: notification.id, dismissedAt: notification.dismissedAt };
    }

    notification.dismissedAt = new Date();
    const saved = await this.notificationRepository.save(notification);
    return { id: saved.id, dismissedAt: saved.dismissedAt as Date };
  }

  /**
   * 일괄 dismiss — 현재 워크스페이스에서 로그인 사용자의 모든 visible 알림을
   * dismiss 처리한다. 이미 dismissed 인 행은 건드리지 않으므로 affected count 에서 제외.
   *
   * spec/data-flow/8-notifications.md §4.2.
   */
  async dismissAll(
    workspaceId: string,
    userId: string,
  ): Promise<{ affected: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ dismissedAt: () => 'NOW()' })
      .where('workspace_id = :workspaceId', { workspaceId })
      .andWhere('user_id = :userId', { userId })
      .andWhere('dismissed_at IS NULL')
      .execute();

    return { affected: result.affected || 0 };
  }

  /**
   * Idempotency 헬퍼 — 같은 (workspace, type, resourceId, title) 조합으로
   * `withinMs` 이내에 발사된 알림이 있는지 검사. `integration_action_required`
   * 같이 동일 상태 전이를 반복 발사하지 않으려는 호출자가 사용 (spec §11.2).
   * title 까지 매칭하므로 다른 status_reason (다른 title) 은 별도 카운트.
   *
   * **dismissed row 포함** — 사용자가 닫았다는 사실이 알림 재발사 빈도를 다시
   * 풀어버리면 같은 장애에 대해 over-noise 가 발생한다. dismiss 는 표시 차원의
   * 결정일 뿐 중복 방지의 "최근 발사 여부" 와 별개 (spec §4.4 + Rationale).
   */
  async hasRecentByResource(params: {
    workspaceId: string;
    type: string;
    resourceId: string;
    title: string;
    withinMs: number;
  }): Promise<boolean> {
    const cutoff = new Date(Date.now() - params.withinMs);
    const count = await this.notificationRepository.count({
      where: {
        workspaceId: params.workspaceId,
        type: params.type,
        resourceId: params.resourceId,
        title: params.title,
        createdAt: MoreThanOrEqual(cutoff),
      },
    });
    return count > 0;
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
