import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { WebsocketService } from '../websocket/websocket.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** 지연 해석된 WebsocketService 싱글턴 캐시 ({@link getWebsocket}). */
  private websocketService?: WebsocketService;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * WebsocketService 를 앱 컨텍스트에서 지연 해석한다 (strict:false 전역 조회).
   *
   * NotificationsModule 이 WebsocketModule 을 file-level 로 import 하면 nodes 배럴
   * 초기화 중 require 순환(→ workflows → import-workflow.dto 의 `[...ALL_NODE_TYPES]`
   * 미초기화)이 발생하므로, 모듈 import 대신 ModuleRef 로 실행 시점에 싱글턴을 해석해
   * 캐시한다. WebsocketService 는 default singleton 이라 1회 해석 후 재사용 안전.
   */
  private getWebsocket(): WebsocketService {
    if (!this.websocketService) {
      this.websocketService = this.moduleRef.get(WebsocketService, {
        strict: false,
      });
    }
    return this.websocketService;
  }

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
   * - 원자 UPDATE: `dismissed_at IS NULL` 인 행에만 `dismissed_at=now()` 를 적용.
   *   동시 요청 race condition 회피 (review session 17_09_09 I-4) — findOne-then-save
   *   패턴은 last-write-wins 위험이 있어 단일 SQL UPDATE 로 통합.
   * - 본인 소유 알림이 아니면 `NotFoundException`. 본인 소유 + 이미 dismissed 인
   *   경우는 멱등 성공 (기존 dismissed_at 반환).
   * - row 자체는 보존 (hasRecentByResource 중복 방지에 영향 없도록, spec §4.4).
   * - 응답의 `dismissedAt` 은 ISO 8601 UTC 문자열 (DTO 명세 일치, review session
   *   17_09_09 I-18).
   */
  async dismiss(
    id: string,
    userId: string,
  ): Promise<{ id: string; dismissedAt: string }> {
    // 1) 원자 UPDATE — dismissed_at IS NULL 인 행만 갱신. RETURNING 으로 dismissed_at 회수.
    //    TypeORM `.returning(string)` 의 raw SQL 형태로 컬럼명을 정확히 지정한다
    //    (배열 형태는 entity property 이름을 받지만, snake_case 컬럼명과 매핑 시
    //    드라이버에 따라 회귀가 있어 raw SQL 표기가 안정적).
    const updateResult = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ dismissedAt: () => 'NOW()' })
      .where('id = :id', { id })
      .andWhere('user_id = :userId', { userId })
      .andWhere('dismissed_at IS NULL')
      .returning('id, dismissed_at')
      .execute();

    if ((updateResult.affected ?? 0) > 0) {
      const row = (
        updateResult.raw as Array<{
          id: string;
          dismissed_at: Date | string;
        }>
      )[0];
      const dismissedAtIso =
        row.dismissed_at instanceof Date
          ? row.dismissed_at.toISOString()
          : new Date(row.dismissed_at).toISOString();
      return { id: row.id, dismissedAt: dismissedAtIso };
    }

    // 2) UPDATE 가 0행 영향 → 본인 소유 + 이미 dismissed 이거나, 미존재/타인 소유.
    //    findOne 으로 분기. 본인 소유 + 이미 dismissed 면 멱등 성공으로 처리.
    const existing = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Notification not found',
      });
    }
    return {
      id: existing.id,
      dismissedAt: (existing.dismissedAt as Date).toISOString(),
    };
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
   * 단일 알림 적재 표면 — 한 사용자에게 알림 1건을 INSERT 하고 즉시
   * `notification.new` WS emit 한다. 배치가 필요한 fan-out 호출자는 {@link createMany}.
   *
   * spec/data-flow/8-notifications.md §1 (Source → Sink) 의 단일 `notify()` 표면.
   * preference 확인·channel 계산은 현행 설계상 호출자 책임이며(spec §1 표), 본 표면은
   * 적재 + 실시간 push 를 담당한다. 이메일 발송(`channel ∈ {email, both}`)과
   * `email_sent_at` 라이프사이클은 후속 phase (spec §2.2 Planned).
   */
  async notify(entry: {
    workspaceId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    resourceType?: string;
    resourceId?: string;
    channel?: 'in_app' | 'email' | 'both';
  }): Promise<Notification> {
    const row = this.notificationRepository.create({
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      type: entry.type,
      title: entry.title,
      message: entry.message,
      channel: entry.channel ?? 'in_app',
      isRead: false,
    });
    if (entry.resourceType) row.resourceType = entry.resourceType;
    if (entry.resourceId) row.resourceId = entry.resourceId;
    const saved = await this.notificationRepository.save(row);
    this.emitNew(saved);
    return saved;
  }

  /**
   * Persist a batch of notifications in a single INSERT. Safe against empty
   * arrays (no-op). Used by background workers that fan out to many users.
   * 저장된 각 row 에 대해 `notification.new` WS emit — 기존 배치 호출자
   * (background/alerts/integration) 도 실시간 push 를 확보한다 (spec §1·§2.2).
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
    const saved = await this.notificationRepository.save(rows);
    for (const row of saved) {
      this.emitNew(row);
    }
  }

  /**
   * 적재된 알림 row 를 `notifications:<userId>` 채널에 `notification.new` 로 push.
   *
   * WS 전달은 **완전 best-effort** — 적재(source of truth)는 이미 커밋됐으므로 emit
   * 경로의 어떤 실패도 호출자에게 전파되면 안 된다. `emitNotificationEvent` 가 broadcast
   * 예외는 자체 삼키지만, 그 앞단의 {@link getWebsocket}(ModuleRef 지연 해석)도 throw
   * 할 수 있어 여기서 통째로 감싼다 — 해석 실패든 broadcast 실패든 warn 만 남기고 삼킨다.
   */
  private emitNew(row: Notification): void {
    try {
      this.getWebsocket().emitNotificationEvent(row.userId, {
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        resourceType: row.resourceType ?? null,
        resourceId: row.resourceId ?? null,
      });
    } catch (err) {
      this.logger.warn(
        `notification.new emit skipped (id=${row.id}, userId=${row.userId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 'created_at',
      type: 'type',
    };
    return allowed[sort] || 'created_at';
  }
}
