import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  LoginHistory,
  LoginHistoryEvent,
} from './entities/login-history.entity';
import { deriveDeviceLabel } from './utils/device-label';

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

export interface LoginHistoryPage {
  data: LoginHistory[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const RETENTION_DAYS = 180;

@Injectable()
export class LoginHistoryService {
  private readonly logger = new Logger(LoginHistoryService.name);

  constructor(
    @InjectRepository(LoginHistory)
    private readonly repository: Repository<LoginHistory>,
  ) {}

  /**
   * 인증 이벤트를 기록. 실패해도 인증 흐름을 막아서는 안 되므로 예외는 삼킨다.
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
      this.logger.warn(
        `login_history record failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async findForUser(query: LoginHistoryQuery): Promise<LoginHistoryPage> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const qb = this.repository
      .createQueryBuilder('lh')
      .where('lh.user_id = :userId', { userId: query.userId })
      .orderBy('lh.created_at', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        qb.andWhere('lh.created_at < :cursor', { cursor: cursorDate });
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? data[data.length - 1].createdAt.toISOString()
      : null;
    return { data, nextCursor };
  }

  /**
   * 보존 기간(180일)을 넘긴 로그인 이력을 삭제한다.
   * 호출자(pruner)는 결과(row count) 만 사용.
   */
  async pruneOlderThanRetention(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const result = await this.repository.delete({
      createdAt: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }
}
