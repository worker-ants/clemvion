import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LoginHistory,
  LoginHistoryEvent,
} from './entities/login-history.entity';
import { deriveDeviceLabel } from './utils/device-label';
import {
  LoginHistoryItemDto,
  LoginHistoryPageDto,
} from './dto/responses/login-history.dto';

export interface LoginEventInput {
  userId?: string | null;
  email: string;
  event: LoginHistoryEvent;
  ip?: string | null;
  userAgent?: string | null;
  familyId?: string | null;
  failureReason?: string | null;
}

export interface LoginHistoryQuery {
  userId: string;
  cursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const RETENTION_DAYS = 180;
/** prune 호출 1회당 최대 삭제 row 수. 잠금 경합 + WAL 팽창 완화. */
const PRUNE_BATCH = 1000;
const PRUNE_MAX_BATCHES = 50;

/**
 * cursor 인코딩: `<iso>|<id>` — `created_at` 단독 사용 시 동일 밀리초 충돌 가능성을 막기 위해
 * id 까지 묶어 secondary tiebreaker 로 사용한다. 손상된 cursor 는 무시하고 첫 페이지부터.
 */
function encodeCursor(row: LoginHistory): string {
  return `${row.createdAt.toISOString()}|${row.id}`;
}
function decodeCursor(
  raw: string | undefined,
): { ts: Date; id: string } | null {
  if (!raw) return null;
  const [iso, id] = raw.split('|');
  if (!iso || !id) return null;
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return null;
  return { ts, id };
}

@Injectable()
export class LoginHistoryService {
  private readonly logger = new Logger(LoginHistoryService.name);

  constructor(
    @InjectRepository(LoginHistory)
    private readonly repository: Repository<LoginHistory>,
  ) {}

  /**
   * 인증 이벤트를 기록. 실패해도 인증 흐름을 막아서는 안 되므로 예외는 삼킨다.
   * 다만 ERROR 수준으로 로그를 남겨 모니터링에서 감지 가능하게 한다.
   */
  async record(input: LoginEventInput): Promise<void> {
    try {
      const entity = this.repository.create({
        userId: input.userId ?? null,
        email: input.email,
        event: input.event,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        deviceLabel: input.userAgent
          ? deriveDeviceLabel(input.userAgent)
          : null,
        familyId: input.familyId ?? null,
        failureReason: input.failureReason ?? null,
      });
      await this.repository.save(entity);
    } catch (err) {
      this.logger.error(
        `login_history record failed (event=${input.event}, user=${input.userId ?? input.email}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async findForUser(query: LoginHistoryQuery): Promise<LoginHistoryPageDto> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const qb = this.repository
      .createQueryBuilder('lh')
      .where('lh.user_id = :userId', { userId: query.userId })
      .orderBy('lh.created_at', 'DESC')
      .addOrderBy('lh.id', 'DESC')
      .take(limit + 1);

    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      qb.andWhere('(lh.created_at, lh.id) < (:cursorTs, :cursorId)', {
        cursorTs: cursor.ts,
        cursorId: cursor.id,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: data.map((row) => this.toDto(row)),
      nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null,
    };
  }

  /**
   * 보존 기간(180일)을 넘긴 로그인 이력을 배치로 삭제한다.
   * 1회 호출에서 최대 PRUNE_BATCH × PRUNE_MAX_BATCHES row 까지만 삭제하며, 그 이상은 다음 cron 에 위임.
   */
  async pruneOlderThanRetention(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    let total = 0;
    for (let i = 0; i < PRUNE_MAX_BATCHES; i++) {
      const sub = this.repository
        .createQueryBuilder('lh')
        .select('lh.id')
        .where('lh.created_at < :cutoff', { cutoff })
        .limit(PRUNE_BATCH);

      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .from(LoginHistory)
        .where(`id IN (${sub.getQuery()})`)
        .setParameters(sub.getParameters())
        .execute();

      const removed = result.affected ?? 0;
      total += removed;
      if (removed < PRUNE_BATCH) break;
    }
    return total;
  }

  // Backwards-compatible alias for callers that still expect to receive raw rows.
  // Used by spec when asserting persisted shape.
  private toDto(row: LoginHistory): LoginHistoryItemDto {
    return {
      id: row.id,
      event: row.event,
      ipAddress: row.ipAddress,
      deviceLabel: row.deviceLabel ?? deriveDeviceLabel(row.userAgent),
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Lower bound used by spec — exposed for testing. */
  static get retentionDays(): number {
    return RETENTION_DAYS;
  }
}
