import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Notification } from '../entities/notification.entity';
import { MailService } from '../../mail/mail.service';
import type { DailyDigest } from '../../mail/daily-digest.types';
import { PRODUCT_DEFAULT_TIMEZONE } from '../../../common/utils/timezone';
import {
  DIGEST_ITEMS_PER_WORKSPACE,
  DIGEST_RECIPIENT_BATCH,
  DIGEST_TYPES,
  DIGEST_WINDOW_MS,
  NOTIFICATION_DIGEST_QUEUE,
} from './notification-digest.constants';

const DIGEST_JOB = 'send-daily-digest';

/** 요약 조회 결과 한 행. */
export interface DigestRow {
  user_id: string;
  workspace_id: string;
  workspace_name: string;
  type: string;
  title: string;
  created_at: Date;
  /** 이 수신자 · 워크스페이스의 24시간 전체 건수. 행은 최신 상한 건만 온다. */
  workspace_total: number;
}

/** `sendDigests` 의 선택 인자. 운영 반복 작업은 쓰지 않는다. */
export interface DigestRunOptions {
  /** 주어지면 이 사용자만 받는 사람 후보로 삼는다(e2e 훅 전용). */
  userIds?: string[];
  /** 주어지면 보낸 요약을 이 배열에 쌓는다(e2e 훅 전용. 메일 내용을 읽을 길이 없어서다). */
  collected?: { userId: string; digest: DailyDigest }[];
}

export interface DigestRunResult {
  recipients: number;
  sent: number;
  failed: number;
}

/**
 * 하루치 실패 알림을 모아 `dailyDigestEmail` 을 켠 사용자에게 한 통씩 보낸다
 * ([알림 설정 「일일 요약」](CLE-OBS-NOTIFY-SETTINGS#일일-요약), CLE-T-BAXAN4).
 *
 * - 매일 09:00 제품 기본 시간대에 BullMQ 반복 작업으로 돈다. 등록은 idempotent 라 여러 인스턴스에서도
 *   한 번만 돈다(선례: `LoginHistoryPrunerService`).
 * - 원천은 `notification` 행이다. 보내는 시각부터 거꾸로 24시간에 만든 행을 모은다. 채널과 닫힘 여부로
 *   거르지 않는다. 인앱과 이메일을 모두 끈 유형은 행이 없으므로 요약에도 들어가지 않는다.
 * - 보낼 것이 없는 사람에게는 보내지 않는다. 발송 실패는 경고만 남기고 재시도하지 않는다
 *   ([알림 「저장과 전달」](CLE-OBS-NOTIFY#저장과-전달) 의 즉시 메일 규칙과 같다).
 */
@Injectable()
@Processor(NOTIFICATION_DIGEST_QUEUE)
export class NotificationDigestService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(NotificationDigestService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly mailService: MailService,
    @InjectQueue(NOTIFICATION_DIGEST_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // scheduler ID 는 큐 이름에서 파생한다. process 가 예외를 삼키므로 removeOnComplete 만 실제로 쓰인다.
    await this.queue.upsertJobScheduler(
      `${NOTIFICATION_DIGEST_QUEUE}-daily`,
      { pattern: '0 9 * * *', tz: PRODUCT_DEFAULT_TIMEZONE },
      {
        name: DIGEST_JOB,
        opts: {
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 30 * 24 * 60 * 60 },
        },
      },
    );
  }

  async process(_job: Job): Promise<void> {
    try {
      const r = await this.sendDigests(new Date());
      if (r.recipients > 0) {
        this.logger.log(
          `daily digest: recipients=${r.recipients} sent=${r.sent} failed=${r.failed}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `daily digest failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendDigests(
    now: Date,
    options: DigestRunOptions = {},
  ): Promise<DigestRunResult> {
    const from = new Date(now.getTime() - DIGEST_WINDOW_MS);
    const result: DigestRunResult = { recipients: 0, sent: 0, failed: 0 };
    let after: string | null = null;

    for (;;) {
      const users = await this.findRecipients(after, options.userIds);
      if (users.length === 0) break;
      result.recipients += users.length;

      const rows = await this.findDigestRows(users, from, now);
      const byUser = groupDigests(rows, from, now);
      for (const user of users) {
        const digest = byUser.get(user.id);
        if (!digest) continue;
        options.collected?.push({ userId: user.id, digest });
        if (await this.sendOne(user, digest)) result.sent += 1;
        else result.failed += 1;
      }

      if (users.length < DIGEST_RECIPIENT_BATCH) break;
      after = users[users.length - 1].id;
    }
    return result;
  }

  /** 일일 요약을 켠 사용자를 id 순으로 한 배치 읽는다. `userIds` 가 있으면 그 안에서만 읽는다. */
  private async findRecipients(
    after: string | null,
    userIds?: string[],
  ): Promise<User[]> {
    const qb = this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.email'])
      .where("u.notification_preferences ->> 'dailyDigestEmail' = 'true'");
    if (after) qb.andWhere('u.id > :after', { after });
    if (userIds) qb.andWhere('u.id IN (:...userIds)', { userIds });
    return qb.orderBy('u.id', 'ASC').limit(DIGEST_RECIPIENT_BATCH).getMany();
  }

  /**
   * 수신자 배치의 요약 행을 읽는다. 워크스페이스마다 최신 `DIGEST_ITEMS_PER_WORKSPACE` 건만 가져오고
   * 전체 건수는 윈도 함수 `COUNT` 로 함께 얻어, 하루치 행을 모두 메모리에 올리지 않는다.
   */
  private async findDigestRows(
    users: User[],
    from: Date,
    now: Date,
  ): Promise<DigestRow[]> {
    return this.notificationRepository.query(
      `SELECT r.user_id, r.workspace_id, w.name AS workspace_name,
              r.type, r.title, r.created_at, r.workspace_total
         FROM (
           SELECT n.user_id, n.workspace_id, n.type, n.title, n.created_at,
                  ROW_NUMBER() OVER (PARTITION BY n.user_id, n.workspace_id
                                     ORDER BY n.created_at DESC, n.id DESC) AS rn,
                  COUNT(*) OVER (PARTITION BY n.user_id, n.workspace_id)::int
                    AS workspace_total
             FROM notification n
            WHERE n.user_id = ANY($1)
              AND n.type = ANY($2)
              AND n.created_at >= $3 AND n.created_at < $4
         ) r
         JOIN workspace w ON w.id = r.workspace_id
        WHERE r.rn <= $5
        ORDER BY r.user_id, w.name, r.workspace_id, r.created_at DESC`,
      [
        users.map((u) => u.id),
        [...DIGEST_TYPES],
        from,
        now,
        DIGEST_ITEMS_PER_WORKSPACE,
      ],
    );
  }

  /** 한 통을 보낸다. 실패는 경고만 남기고 false 를 돌려준다(재시도하지 않는다). */
  private async sendOne(user: User, digest: DailyDigest): Promise<boolean> {
    try {
      await this.mailService.sendDailyDigestEmail(user.email, digest);
      return true;
    } catch (err) {
      this.logger.warn(
        `daily digest email failed (userId=${user.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}

/**
 * 조회 행을 수신자 → 워크스페이스 순으로 묶는다. 행 순서(워크스페이스 이름, 최신 순)를 그대로 따른다.
 * 행은 워크스페이스마다 상한까지만 오므로 건수는 행 수가 아니라 `workspace_total` 로 잡는다.
 */
function groupDigests(
  rows: DigestRow[],
  windowStart: Date,
  windowEnd: Date,
): Map<string, DailyDigest> {
  const byUser = new Map<string, DailyDigest>();
  for (const r of rows) {
    let digest = byUser.get(r.user_id);
    if (!digest) {
      digest = { windowStart, windowEnd, total: 0, workspaces: [] };
      byUser.set(r.user_id, digest);
    }
    let ws = digest.workspaces.find((w) => w.id === r.workspace_id);
    if (!ws) {
      ws = { id: r.workspace_id, name: r.workspace_name, total: 0, items: [] };
      digest.workspaces.push(ws);
    }
    if (ws.items.length === 0) {
      ws.total = Number(r.workspace_total);
      digest.total += ws.total;
    }
    ws.items.push({
      type: r.type,
      title: r.title,
      createdAt: new Date(r.created_at),
    });
  }
  return byUser;
}
