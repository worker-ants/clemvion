import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { AuditAction } from './audit-action.const';
import { BusinessMetricsService } from '../metrics/business-metrics.service';

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
  ): Promise<PaginatedResponseDto<AuditLog>> {
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
    const data = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getMany();

    return PaginatedResponseDto.create(data, totalItems, page, limit);
  }

  /**
   * Record an audit event. Failures are swallowed — audit logging must never
   * break the primary action.
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
      // 깨뜨리지 않는다" 인데, 여기서 던지면 그 예외가 12개+ 특권 CRUD producer 로
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

  private getSortColumn(sort: string): string {
    const allowed: Record<string, string> = {
      created_at: 'created_at',
      action: 'action',
      resource_type: 'resource_type',
    };
    return allowed[sort] || 'created_at';
  }
}
