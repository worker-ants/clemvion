import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { WorkspaceInvitationsService } from '../workspace-invitations.service';

export const WORKSPACE_INVITATIONS_PRUNER_QUEUE =
  'workspace-invitations-pruner';
const PRUNE_JOB = 'prune-expired-invitations';

/**
 * 매일 새벽 4시(Asia/Seoul) 에 만료되고 수락되지 않은 workspace_invitation 행을 삭제한다.
 *
 * 초대는 발급 시 `expires_at = now + 7d` 로 TTL 이 붙지만(§1.2), 만료 후에도 row 가
 * 영구 잔존했다 — `pruneExpired` 헬퍼는 존재했으나 프로덕션 호출자가 없었다(데이터 위생 갭).
 * 본 service 가 `login-history-pruner` 와 동일 패턴으로 그 헬퍼를 주기 실행에 연결한다.
 *
 * - 명시적 timezone — 서버 로컬 타임존 변동(EC2 이전·CI 머신 등)으로 인한 시각 표류 차단.
 * - 멀티 인스턴스 안전 — BullMQ repeatable scheduler 가 Redis 중앙 스케줄에 단일 entry 로
 *   등록되고, 워커가 Redis 락으로 한 잡을 한 워커만 집어가므로 k8s `replicas:2` 에서도 전역 1회만 실행.
 * - 03:00 login-history pruner 와 시각을 어긋나게(04:00) 두어 동시 부하를 분산한다.
 *
 * 본 service 는 scheduler/worker 어댑터만 — 실 비즈니스 로직은 `WorkspaceInvitationsService.pruneExpired`.
 */
@Injectable()
@Processor(WORKSPACE_INVITATIONS_PRUNER_QUEUE)
export class WorkspaceInvitationsPrunerService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(WorkspaceInvitationsPrunerService.name);

  constructor(
    private readonly invitations: WorkspaceInvitationsService,
    @InjectQueue(WORKSPACE_INVITATIONS_PRUNER_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // 매일 04:00 Asia/Seoul. upsertJobScheduler 는 idempotent — 같은 ID 를 여러 번
    // 등록해도 Redis 에 단일 repeatable entry 만 남아 멀티 인스턴스에서도 중복되지 않는다.
    // scheduler ID 는 큐 이름에서 파생 — 큐 상수 변경 시 ID 가 함께 따라가 orphan entry 회귀 차단.
    // removeOnComplete 만 실질 동작한다 (process 가 에러를 swallow 해 잡이 항상 성공으로 종료) —
    // removeOnFail 은 process 가 향후 재-throw 로 바뀔 때를 위한 방어적 설정.
    await this.queue.upsertJobScheduler(
      `${WORKSPACE_INVITATIONS_PRUNER_QUEUE}-daily`,
      { pattern: '0 4 * * *', tz: 'Asia/Seoul' },
      {
        name: PRUNE_JOB,
        opts: {
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 30 * 24 * 60 * 60 },
        },
      },
    );
  }

  /** BullMQ 워커 진입점 — 실 로직은 {@link prune} 로 위임한다. */
  async process(_job: Job): Promise<void> {
    await this.prune();
  }

  /**
   * 만료·미수락 초대를 삭제한다. 에러는 swallow 후 로그만 남겨 스케줄 잡이
   * 프로세스를 죽이지 않게 한다 (그래서 잡은 항상 성공 종료 — `removeOnFail` 은
   * 향후 재-throw 전환 대비 placeholder).
   */
  async prune(): Promise<void> {
    try {
      const removed = await this.invitations.pruneExpired(new Date());
      if (removed > 0) {
        this.logger.log(
          `workspace_invitation pruned ${removed} expired row(s)`,
        );
      }
    } catch (err) {
      this.logger.error(
        `workspace_invitation prune failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
