import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { pickSortColumn } from '../../common/utils/list-sort';
import { AuditAction } from './audit-action.const';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import type { User } from '../users/entities/user.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 보존 배치 한 번에 지우는 행 수. 잠금 경합과 WAL 증가를 줄인다. */
const PRUNE_BATCH = 1000;
const PRUNE_MAX_BATCHES = 50;

/**
 * `findAll` 이 실제로 내보내는 형태.
 *
 * `user` 는 `AuditLogUserDto` 가 광고하는 3필드만 hydrate 된다. 엔티티의 `user: User` 를
 * 그대로 반환 타입에 쓰면 **타입이 런타임보다 넓어져**, 이 메서드를 재사용하는 다음
 * 코드가 `user.passwordHash` 를 컴파일 통과시키고 런타임엔 조용히 `undefined` 를 받는다.
 * (`review/code/2026/09/05/14_39_31` W6.)
 *
 * 자매 관계 필드 `workspace` 도 함께 뺀다. 이 쿼리는 그것을 join 하지 않아 **런타임에 항상
 * `undefined`** 인데 엔티티 타입은 `Workspace` 라고 말한다 — `user` 만 좁히고 형제를 두면
 * 같은 결함이 옆자리에 그대로 남는다 (`review/code/2026/09/05/15_31_41` W1). 나중에
 * `workspace` 가 필요해지면 `user` 와 같은 형태로 join·투영을 함께 들여온다.
 */
export type AuditLogListItem = Omit<AuditLog, 'user' | 'workspace'> & {
  user: Pick<User, 'id' | 'name' | 'email'> | null;
};

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    // `@Optional()` — 감사 기록은 metrics 모듈 없이도 동작해야 한다(테스트 조립 포함).
    // 관측이 없다고 감사가 멈추면 본말이 뒤집힌다. 선례: `idempotency.interceptor.ts`.
    @Optional() private readonly metrics?: BusinessMetricsService,
  ) {}

  async findAll(
    workspaceId: string,
    query: QueryAuditLogDto,
  ): Promise<PaginatedResponseDto<AuditLogListItem>> {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      action,
      resourceType,
      userId,
      startDate,
      endDate,
    } = query;

    const qb = this.auditLogRepository
      .createQueryBuilder('al')
      // `AuditLogUserDto` 가 광고하는 3필드만 싣는다. `leftJoinAndSelect` 는 `User` 의
      // **전 컬럼**을 실었고, 이 컨트롤러는 엔티티를 그대로 반환하므로 `passwordHash`·
      // `twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes` 와 계정 탈취에
      // 쓰이는 `passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 이 실 응답에
      // 그대로 나갔다 (e2e 로 확인: user 키 26개). 필요한 것만 select 해 애초에 DB 밖으로
      // 나가지 않게 한다 — 워크스페이스 멤버 목록(`workspaces.service.ts`)이 명시 매핑으로
      // 같은 문제를 이미 피하고 있다.
      .leftJoin('al.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .where('al.workspace_id = :workspaceId', { workspaceId });

    if (action) {
      qb.andWhere('al.action = :action', { action });
    }
    if (resourceType) {
      qb.andWhere('al.resource_type = :resourceType', { resourceType });
    }
    if (userId) {
      // [Spec Auth §4.2] 사용자(행위자) 필터
      qb.andWhere('al.user_id = :userId', { userId });
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
    // `getMany()` 는 엔티티 타입을 내지만 위 `addSelect` 로 `user` 는 3필드만 채워진다.
    // 이 캐스트가 그 사실을 타입에 반영하는 유일한 지점이다.
    const data = (await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany()) as AuditLogListItem[];

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  /**
   * 감사 이벤트 한 건을 기록한다.
   *
   * 저장에 실패해도 예외를 던지지 않는다. 감사 기록 실패로 본 요청이 깨지면 안 되기 때문이다.
   * 실패하면 두 가지를 남긴다.
   * - 감사 기록 실패 카운터를 올린다(`recordAuditWriteFailed(resourceType)`). 이 호출도
   *   best-effort 라서 여기서 난 예외도 삼킨다.
   * - warn 로그 한 줄에 `action` · `resourceType` · `resourceId` · `workspaceId` 네 필드와
   *   오류 메시지를 남긴다. 어느 감사 행이 유실됐는지 로그만으로 알 수 있게 하려는 것이다.
   */
  async record(entry: {
    workspaceId: string;
    userId: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const log = this.auditLogRepository.create({
        workspaceId: entry.workspaceId,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details ?? {},
      });
      if (entry.ipAddress) log.ipAddress = entry.ipAddress;
      await this.auditLogRepository.save(log);
    } catch (err) {
      // **삼키는 것 자체는 의도다** — 감사 기록 실패가 본 요청(회전·삭제 같은 특권 작업)을
      // 깨뜨리면 안 된다. 고친 것은 그 뒤가 조용했다는 점이다.
      //
      // 1. 카운터 — 로그는 사후 조회만 되고 비율·추세로 알람을 걸 수 없다.
      // 2. 로그에 **무엇이 유실됐는지** — 종전 메시지는 에러 문구뿐이라, 로그를 봐도 어느
      //    감사가 사라졌는지 알 수 없었다. 유실 사실만 알고 대상을 모르면 복구도 조사도
      //    시작할 수 없다.
      // **관측 호출도 삼킨다.** 이 메서드의 존재 이유가 "감사 실패가 본 요청을 절대
      // 깨뜨리지 않는다" 인데, 여기서 던지면 그 예외가 12개 특권 CRUD producer 로
      // 전파돼 계약을 정면으로 역행한다 — 관측을 붙이면서 관측이 새 실패 경로가 되는 것은
      // 본말전도다. (OTel Counter 는 실측상 non-throwing 이라 발동 가능성은 낮지만,
      // 이 자리는 chokepoint 라 파급이 넓다.)
      try {
        this.metrics?.recordAuditWriteFailed(entry.resourceType);
      } catch {
        // best-effort — 관측 실패는 관측 실패로 끝낸다.
      }
      this.logger.warn(
        `Failed to write audit log (action=${entry.action} ` +
          `resourceType=${entry.resourceType} resourceId=${entry.resourceId} ` +
          `workspaceId=${entry.workspaceId}): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 보존 일수가 지난 감사 로그를 워크스페이스와 무관하게 지운다(REQ-AUDIT-019).
   * 1000행씩 지우고 한 번 호출에 50배치까지만 지운다. 남은 행은 다음 실행이 지운다.
   * `idx_audit_log_created (created_at)`(V157)를 쓴다. 실패는 던지고 배치 서비스가 흡수한다.
   */
  async pruneOlderThanRetention(
    retentionDays: number,
    now: Date = new Date(),
  ): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    let total = 0;
    for (let i = 0; i < PRUNE_MAX_BATCHES; i++) {
      const sub = this.auditLogRepository
        .createQueryBuilder('al')
        .select('al.id')
        .where('al.created_at < :cutoff', { cutoff })
        .limit(PRUNE_BATCH);

      const result = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .from(AuditLog)
        .where(`id IN (${sub.getQuery()})`)
        .setParameters(sub.getParameters())
        .execute();

      const removed = result.affected ?? 0;
      total += removed;
      if (removed < PRUNE_BATCH) break;
    }
    return total;
  }

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 'created_at',
      action: 'action',
      resource_type: 'resource_type',
    };
    return pickSortColumn(allowed, sort, 'created_at');
  }
}
